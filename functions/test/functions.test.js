// Uji logika Cloud Functions tanpa Firebase sungguhan: firebase-functions,
// firebase-admin, dan nodemailer diganti tiruan di memori.
// Jalankan: cd functions && npm test
const test = require('node:test');
const assert = require('node:assert');
const crypto = require('crypto');
const Module = require('module');

process.env.MIDTRANS_SERVER_KEY = 'SB-TEST-KEY';

// ── Firestore tiruan ────────────────────────────────────────────────
const store = new Map(); // 'koleksi/id' -> data
const ts = (ms) => ({ toMillis: () => ms, _ms: ms });
let fakeNow = Date.UTC(2026, 9, 1);
function docRef(path) {
  return {
    path,
    async get() {
      const d = store.get(path);
      return { exists: d !== undefined, data: () => d };
    },
    async set(data, opts) {
      store.set(path, opts && opts.merge ? { ...(store.get(path) || {}), ...data } : { ...data });
    },
    async update(data) {
      store.set(path, { ...store.get(path), ...data });
    },
  };
}
const db = {
  collection: (name) => ({ doc: (id) => docRef(name + '/' + id) }),
  async runTransaction(fn) {
    return fn({ get: (ref) => ref.get(), set: (ref, data) => { store.set(ref.path, { ...data }); } });
  },
};
const firestore = () => db;
firestore.Timestamp = { now: () => ts(fakeNow), fromMillis: ts };
const fakeAdmin = { initializeApp() {}, firestore, auth: () => ({ getUser: async () => ({ email: null }) }) };

class HttpsError extends Error {
  constructor(code, msg) { super(msg); this.code = code; }
}
const fakeFunctions = {
  auth: { user: () => ({ onCreate: (fn) => fn, onDelete: (fn) => fn }) },
  https: { onCall: (fn) => fn, onRequest: (fn) => fn, HttpsError },
};
const origLoad = Module._load;
Module._load = function (req, ...rest) {
  if (req === 'firebase-functions/v1') return fakeFunctions;
  if (req === 'firebase-admin') return fakeAdmin;
  if (req === 'nodemailer') return { createTransport: () => ({ sendMail: async () => {} }) };
  return origLoad.call(this, req, ...rest);
};
const fns = require('../index.js');
const { trialKey, nextSubscription } = require('../plans.js');

const DAY = 24 * 60 * 60 * 1000;

// ── Trial ──────────────────────────────────────────────────────────
test('akun baru mendapat trial 31 hari dan emailnya dicatat', async () => {
  store.clear();
  await fns.onUserCreate({ uid: 'u1', email: 'Guru@Gmail.com' });
  const sub = store.get('subscriptions/u1');
  assert.strictEqual(sub.status, 'trial');
  assert.strictEqual(sub.trialEndsAt.toMillis() - fakeNow, 31 * DAY);
  assert.ok(store.get('trialUsage/' + trialKey('guru@gmail.com')));
});

test('hapus akun lalu daftar lagi dengan email sama: trial tidak diberikan lagi', async () => {
  store.clear();
  await fns.onUserCreate({ uid: 'u1', email: 'guru@gmail.com' });
  await fns.onUserDelete({ uid: 'u1', email: 'guru@gmail.com' });
  await fns.onUserCreate({ uid: 'u2', email: 'GURU@gmail.com ' });
  const sub = store.get('subscriptions/u2');
  assert.strictEqual(sub.status, 'expired');
  assert.strictEqual(sub.trialDenied, 'already_used');
});

test('akun lama (sebelum trialUsage ada) yang dihapus ikut tercatat', async () => {
  store.clear();
  await fns.onUserDelete({ uid: 'lama', email: 'lama@gmail.com' });
  await fns.onUserCreate({ uid: 'baru', email: 'lama@gmail.com' });
  assert.strictEqual(store.get('subscriptions/baru').status, 'expired');
});

test('email berbeda tetap mendapat trial', async () => {
  store.clear();
  await fns.onUserCreate({ uid: 'a', email: 'a@gmail.com' });
  await fns.onUserCreate({ uid: 'b', email: 'b@gmail.com' });
  assert.strictEqual(store.get('subscriptions/b').status, 'trial');
});

// ── Transaksi Midtrans ─────────────────────────────────────────────
test('createMidtransTransaction memakai harga paket baru', async () => {
  store.clear();
  let sentBody;
  global.fetch = async (url, opts) => {
    sentBody = JSON.parse(opts.body);
    return { ok: true, json: async () => ({ token: 'tok', redirect_url: 'http://x' }) };
  };
  const res = await fns.createMidtransTransaction({ plan: 'up_yearly' }, { auth: { uid: 'user12345', token: { email: 'a@b.c' } } });
  assert.strictEqual(sentBody.transaction_details.gross_amount, 700000);
  assert.strictEqual(store.get('orders/' + res.orderId).grossAmount, 700000);
});

test('createMidtransTransaction menolak paket lama & paket tak dikenal', async () => {
  for (const plan of ['monthly', 'yearly', 'gratis', undefined]) {
    await assert.rejects(
      fns.createMidtransTransaction({ plan }, { auth: { uid: 'user12345', token: {} } }),
      (e) => e.code === 'invalid-argument'
    );
  }
});

// ── Webhook ────────────────────────────────────────────────────────
function webhookReq(orderId, amount, status = 'settlement') {
  const status_code = '200';
  const gross_amount = amount + '.00';
  const signature_key = crypto.createHash('sha512')
    .update(orderId + status_code + gross_amount + process.env.MIDTRANS_SERVER_KEY).digest('hex');
  return { body: { order_id: orderId, status_code, gross_amount, signature_key, transaction_status: status } };
}
function fakeRes() {
  const r = { code: 200, status(c) { r.code = c; return r; }, send() { return r; } };
  return r;
}

test('webhook: bayar Pro Up bulanan → aktif, tier up, 30 hari', async () => {
  store.clear();
  store.set('orders/O1', { uid: 'u1', plan: 'up_monthly', grossAmount: 75000, status: 'pending' });
  store.set('subscriptions/u1', { status: 'trial', trialEndsAt: ts(fakeNow + 5 * DAY) });
  const res = fakeRes();
  const before = Date.now();
  await fns.midtransWebhook(webhookReq('O1', 75000), res);
  const after = Date.now();
  assert.strictEqual(res.code, 200);
  const sub = store.get('subscriptions/u1');
  assert.strictEqual(sub.status, 'active');
  assert.strictEqual(sub.tier, 'up');
  const ends = sub.subscriptionEndsAt.toMillis();
  assert.ok(ends >= before + 30 * DAY && ends <= after + 30 * DAY);
  assert.strictEqual(store.get('orders/O1').status, 'paid');
});

test('webhook: signature salah ditolak', async () => {
  store.clear();
  store.set('orders/O2', { uid: 'u1', plan: 'up_monthly', grossAmount: 75000, status: 'pending' });
  const req = webhookReq('O2', 75000);
  req.body.signature_key = 'palsu';
  const res = fakeRes();
  await fns.midtransWebhook(req, res);
  assert.strictEqual(res.code, 403);
  assert.strictEqual(store.get('subscriptions/u1'), undefined);
});

test('webhook: notifikasi ganda tidak memperpanjang dua kali', async () => {
  store.clear();
  store.set('orders/O3', { uid: 'u1', plan: 'basic_monthly', grossAmount: 35000, status: 'pending' });
  await fns.midtransWebhook(webhookReq('O3', 35000), fakeRes());
  const first = store.get('subscriptions/u1').subscriptionEndsAt.toMillis();
  await fns.midtransWebhook(webhookReq('O3', 35000), fakeRes());
  assert.strictEqual(store.get('subscriptions/u1').subscriptionEndsAt.toMillis(), first);
});

test('webhook: order lama (plan monthly) tetap diproses sebagai Unlimited', async () => {
  store.clear();
  store.set('orders/O4', { uid: 'u1', plan: 'monthly', grossAmount: 40000, status: 'pending' });
  await fns.midtransWebhook(webhookReq('O4', 40000), fakeRes());
  assert.strictEqual(store.get('subscriptions/u1').tier, 'unlimited');
});

// ── Aturan perpanjangan ────────────────────────────────────────────
test('perpanjang paket yang sama: ditambah di ujung masa aktif', () => {
  const now = 1000 * DAY;
  const r = nextSubscription({ status: 'active', tier: 'up', subscriptionEndsMs: now + 10 * DAY }, 'up_monthly', now);
  assert.strictEqual(r.subscriptionEndsMs, now + 40 * DAY);
});

test('ganti paket: berlaku mulai sekarang', () => {
  const now = 1000 * DAY;
  const r = nextSubscription({ status: 'active', tier: 'basic', subscriptionEndsMs: now + 10 * DAY }, 'unlimited_yearly', now);
  assert.strictEqual(r.tier, 'unlimited');
  assert.strictEqual(r.subscriptionEndsMs, now + 365 * DAY);
});

test('pelanggan PRO lama (tanpa tier) dianggap Unlimited saat perpanjang', () => {
  const now = 1000 * DAY;
  const r = nextSubscription({ status: 'active', subscriptionEndsMs: now + 3 * DAY }, 'unlimited_monthly', now);
  assert.strictEqual(r.subscriptionEndsMs, now + 33 * DAY);
});

test('langganan yang sudah habis: mulai dari sekarang', () => {
  const now = 1000 * DAY;
  const r = nextSubscription({ status: 'active', tier: 'up', subscriptionEndsMs: now - DAY }, 'up_monthly', now);
  assert.strictEqual(r.subscriptionEndsMs, now + 30 * DAY);
});
