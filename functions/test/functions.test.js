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
    collection: (sub) => collRef(path + '/' + sub),
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
function query(name, filters) {
  return {
    where: (f, op, v) => query(name, [...filters, [f, v]]),
    limit: () => query(name, filters),
    async get() {
      const docs = [...store.entries()]
        .filter(([k, d]) => k.startsWith(name + '/') && !k.slice(name.length + 1).includes('/') && filters.every(([f, v]) => d[f] === v))
        .map(([k, d]) => ({ id: k.slice(name.length + 1), data: () => d, ref: docRef(k) }));
      return { docs, size: docs.length };
    },
  };
}
// Transaksi tiruan: semua tulisan ditahan sampai fungsi selesai (seperti Firestore)
let txLock = Promise.resolve();
function collRef(name) {
  return { doc: (id) => docRef(name + '/' + id), where: (f, op, v) => query(name, [[f, v]]), get: () => query(name, []).get() };
}
const db = {
  collection: collRef,
  runTransaction(fn) {
    const run = txLock.then(async () => {
      const writes = [];
      const out = await fn({
        get: (ref) => ref.get(),
        set: (ref, data, opts) => writes.push(() => ref.set(data, opts)),
        update: (ref, data) => writes.push(() => ref.update(data)),
      });
      for (const w of writes) await w();
      return out;
    });
    txLock = run.catch(() => {});
    return run;
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

test('webhook: dua notifikasi bersamaan tidak memperpanjang dua kali', async () => {
  store.clear();
  store.set('orders/O5', { uid: 'u1', plan: 'up_monthly', grossAmount: 75000, status: 'pending' });
  await Promise.all([
    fns.midtransWebhook(webhookReq('O5', 75000), fakeRes()),
    fns.midtransWebhook(webhookReq('O5', 75000), fakeRes()),
  ]);
  const ends = store.get('subscriptions/u1').subscriptionEndsAt.toMillis();
  assert.ok(ends - Date.now() < 31 * DAY, 'masa aktif hanya 30 hari');
});

test('webhook: nominal tidak cocok dengan order ditolak', async () => {
  store.clear();
  store.set('orders/O6', { uid: 'u1', plan: 'unlimited_yearly', grossAmount: 1000000, status: 'pending' });
  const res = fakeRes();
  await fns.midtransWebhook(webhookReq('O6', 35000), res);
  assert.strictEqual(res.code, 400);
  assert.strictEqual(store.get('subscriptions/u1'), undefined);
});

test('cek status pembayaran: order lunas di Midtrans diaktifkan, milik orang lain tidak', async () => {
  store.clear();
  const now = Date.now();
  store.set('orders/P1', { uid: 'u1', plan: 'basic_monthly', grossAmount: 35000, status: 'pending', createdAt: ts(now) });
  store.set('orders/P2', { uid: 'u1', plan: 'up_monthly', grossAmount: 75000, status: 'pending', createdAt: ts(now) });
  store.set('orders/P3', { uid: 'lain', plan: 'up_monthly', grossAmount: 75000, status: 'pending', createdAt: ts(now) });
  const asked = [];
  global.fetch = async (url) => {
    const id = decodeURIComponent(url.split('/v2/')[1].split('/')[0]);
    asked.push(id);
    if (id === 'P1') return { ok: true, json: async () => ({ order_id: 'P1', transaction_status: 'settlement', gross_amount: '35000.00' }) };
    return { ok: true, json: async () => ({ status_code: '404', status_message: "Transaction doesn't exist." }) };
  };
  const r = await fns.checkMidtransPayment({}, { auth: { uid: 'u1', token: {} } });
  assert.strictEqual(r.activated, 1);
  assert.deepStrictEqual(asked.sort(), ['P1', 'P2']);
  assert.strictEqual(store.get('subscriptions/u1').tier, 'basic');
  assert.strictEqual(store.get('orders/P2').status, 'pending');
  assert.strictEqual(store.get('orders/P3').status, 'pending');
});

test('cek status pembayaran: nominal Midtrans beda dari order → tidak diaktifkan', async () => {
  store.clear();
  store.set('orders/P4', { uid: 'u1', plan: 'unlimited_yearly', grossAmount: 1000000, status: 'pending', createdAt: ts(Date.now()) });
  global.fetch = async () => ({ ok: true, json: async () => ({ order_id: 'P4', transaction_status: 'settlement', gross_amount: '1000.00' }) });
  const r = await fns.checkMidtransPayment({}, { auth: { uid: 'u1', token: {} } });
  assert.strictEqual(r.activated, 0);
  assert.strictEqual(store.get('subscriptions/u1'), undefined);
});

test('cek status pembayaran: wajib login', async () => {
  await assert.rejects(fns.checkMidtransPayment({}, {}), (e) => e.code === 'unauthenticated');
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

// ── LLK V2: langganan lembaga ─────────────────────────────────────
const OP = require('../orgPlans.js');
function seedOrg({ seats = 2, plan = 'trial', createdAgoDays = 3, activeUntil = null, period, slots = [] } = {}) {
  store.clear();
  const now = Date.now();
  store.set('orgs/org1', { name: 'Les Rani', ownerUid: 'rani', seats, plan, period, createdAt: ts(now - createdAgoDays * DAY), activeUntil: activeUntil ? ts(activeUntil) : undefined });
  store.set('orgs/org1/members/rani', { role: 'admin' });
  store.set('orgs/org1/members/dimas', { role: 'mitra' });
  slots.forEach((k, i) => store.set('orgs/org1/slots/' + (k === 'self' ? '0' : i + 1), { kind: k }));
}
const asRani = { auth: { uid: 'rani', token: { email: 'rani@gmail.com' } } };
function fakeSnap() {
  const sent = [];
  global.fetch = async (url, opts) => { sent.push({ url, body: JSON.parse(opts.body), auth: opts.headers.Authorization }); return { ok: true, json: async () => ({ token: 'tok', redirect_url: 'http://x' }) }; };
  return sent;
}

test('harga V2: 200rb + slot 100rb, 5 slot 449rb, tahunan 10x', () => {
  assert.deepStrictEqual([0, 1, 2, 3, 4, 5, 6, 10].map(OP.monthlyPrice), [200000, 300000, 400000, 500000, 600000, 649000, 749000, 1098000]);
  assert.strictEqual(OP.periodPrice(1, 'yearly'), 3000000);
});

test('V2 langganan: Rani (uji coba) pilih 1 slot tambahan bulanan → Rp300.000, ke Midtrans sandbox', async () => {
  seedOrg({ slots: ['member', 'self'] });
  const sent = fakeSnap();
  const r = await fns.createOrgTransaction({ orgId: 'org1', action: 'subscribe', extra: 1, period: 'monthly' }, asRani);
  assert.strictEqual(r.grossAmount, 300000);
  assert.strictEqual(r.env, 'sandbox');
  assert.ok(sent[0].url.startsWith('https://app.sandbox.midtrans.com/'));
  const o = store.get('orders/' + r.orderId);
  assert.strictEqual(o.type, 'org'); assert.strictEqual(o.grossAmount, 300000); assert.strictEqual(o.extra, 1);
});

test('V2 langganan: hanya Guru Admin, pilihan tidak valid ditolak', async () => {
  seedOrg();
  fakeSnap();
  await assert.rejects(fns.createOrgTransaction({ orgId: 'org1', action: 'subscribe', extra: 0, period: 'monthly' }, { auth: { uid: 'dimas', token: {} } }), (e) => e.code === 'permission-denied');
  await assert.rejects(fns.createOrgTransaction({ orgId: 'org1', action: 'subscribe', extra: -1, period: 'monthly' }, asRani), (e) => e.code === 'invalid-argument');
  await assert.rejects(fns.createOrgTransaction({ orgId: 'org1', action: 'subscribe', extra: 0, period: 'mingguan' }, asRani), (e) => e.code === 'invalid-argument');
  await assert.rejects(fns.createOrgTransaction({ orgId: 'org1', action: 'subscribe', extra: 1.5, period: 'monthly' }, asRani), (e) => e.code === 'invalid-argument');
  await assert.rejects(fns.createOrgTransaction({ orgId: 'org1', action: 'subscribe', extra: 0, period: 'monthly' }, {}), (e) => e.code === 'unauthenticated');
});

test('V2 langganan: slot tidak boleh kurang dari guru yang sudah ada (Admin mengajar tidak dihitung)', async () => {
  seedOrg({ seats: 5, slots: ['member', 'member', 'member', 'self'] });
  fakeSnap();
  await assert.rejects(fns.createOrgTransaction({ orgId: 'org1', action: 'subscribe', extra: 0, period: 'monthly' }, asRani), (e) => e.code === 'failed-precondition');
  const r = await fns.createOrgTransaction({ orgId: 'org1', action: 'subscribe', extra: 1, period: 'monthly' }, asRani);
  assert.strictEqual(r.grossAmount, 300000);
});

test('V2 webhook: lunas → slot & masa aktif lembaga diperbarui, sisa uji coba tidak hangus, riwayat tercatat', async () => {
  seedOrg({ createdAgoDays: 21 }); // uji coba tinggal 10 hari
  fakeSnap();
  const r = await fns.createOrgTransaction({ orgId: 'org1', action: 'subscribe', extra: 5, period: 'monthly' }, asRani);
  assert.strictEqual(r.grossAmount, 649000);
  const res = fakeRes();
  await fns.midtransWebhook(webhookReq(r.orderId, 649000), res);
  assert.strictEqual(res.code, 200);
  const org = store.get('orgs/org1');
  assert.strictEqual(org.seats, 7); assert.strictEqual(org.plan, 'pro'); assert.strictEqual(org.period, 'monthly');
  const left = org.activeUntil.toMillis() - Date.now();
  assert.ok(left > 39.9 * DAY && left < 40.1 * DAY, '10 hari sisa uji coba + 30 hari');
  const inv = store.get('orgs/org1/invoices/' + r.orderId);
  assert.strictEqual(inv.amount, 649000); assert.strictEqual(inv.seats, 7);
  await fns.midtransWebhook(webhookReq(r.orderId, 649000), fakeRes());
  assert.strictEqual(store.get('orgs/org1').activeUntil.toMillis(), org.activeUntil.toMillis(), 'notifikasi ganda tidak dobel');
});

test('V2 tambah slot di tengah bulan: bayar sisa hari, diskon 5 slot dihitung dari total', async () => {
  const now = Date.now();
  seedOrg({ seats: 6, plan: 'pro', period: 'monthly', createdAgoDays: 60, activeUntil: now + 15 * DAY, slots: ['member', 'member', 'member', 'member', 'member', 'member'] });
  fakeSnap();
  // 4 slot tambahan (Rp600rb) → 5 slot (Rp649rb): selisih Rp49.000/bulan, sisa 15 hari → Rp25.000 (dibulatkan ke atas)
  const r = await fns.createOrgTransaction({ orgId: 'org1', action: 'addSlots', add: 1 }, asRani);
  assert.strictEqual(r.grossAmount, Math.ceil(49000 * 15 / 30 / 1000) * 1000);
  await fns.midtransWebhook(webhookReq(r.orderId, r.grossAmount), fakeRes());
  const org = store.get('orgs/org1');
  assert.strictEqual(org.seats, 7);
  assert.strictEqual(org.activeUntil.toMillis(), now + 15 * DAY, 'masa aktif tidak berubah');
});

test('V2 tambah slot saat sisa uji coba: hari uji coba tidak ikut dibayar', async () => {
  const now = Date.now();
  // lembaga dibuat 21 hari lalu (uji coba tinggal 10 hari), sudah bayar 1 bulan → aktif sampai 40 hari lagi
  seedOrg({ seats: 3, plan: 'pro', period: 'monthly', createdAgoDays: 21, activeUntil: now + 40 * DAY });
  fakeSnap();
  const r = await fns.createOrgTransaction({ orgId: 'org1', action: 'addSlots', add: 1 }, asRani);
  assert.strictEqual(r.grossAmount, 100000, '30 hari berbayar × Rp100.000/bulan');
});

test('V2 tambah slot saat masih uji coba / langganan aktif lewat "subscribe" lebih banyak → ditolak', async () => {
  seedOrg();
  fakeSnap();
  await assert.rejects(fns.createOrgTransaction({ orgId: 'org1', action: 'addSlots', add: 1 }, asRani), (e) => e.code === 'failed-precondition');
  seedOrg({ seats: 3, plan: 'pro', period: 'monthly', activeUntil: Date.now() + 10 * DAY });
  await assert.rejects(fns.createOrgTransaction({ orgId: 'org1', action: 'subscribe', extra: 4, period: 'monthly' }, asRani), (e) => e.code === 'failed-precondition');
  const r = await fns.createOrgTransaction({ orgId: 'org1', action: 'subscribe', extra: 1, period: 'yearly' }, asRani);
  assert.strictEqual(r.grossAmount, 3000000, 'perpanjang tahunan dengan slot sama boleh');
});

test('V2 webhook: kunci V2 terpisah dari V1 (V1 production, V2 sandbox)', async () => {
  // Order V1 tidak boleh disahkan dengan tanda tangan kunci lain
  seedOrg();
  store.set('orders/V1X', { uid: 'u1', plan: 'up_monthly', grossAmount: 75000, status: 'pending' });
  const req = webhookReq('V1X', 75000);
  req.body.signature_key = crypto.createHash('sha512').update('V1X' + '200' + '75000.00' + 'KUNCI-LAIN').digest('hex');
  const res = fakeRes();
  await fns.midtransWebhook(req, res);
  assert.strictEqual(res.code, 403);
});

test('V2 cek status: order lembaga yang lunas di Midtrans diaktifkan', async () => {
  seedOrg();
  fakeSnap();
  const r = await fns.createOrgTransaction({ orgId: 'org1', action: 'subscribe', extra: 0, period: 'monthly' }, asRani);
  let asked = '';
  global.fetch = async (url) => { asked = url; return { ok: true, json: async () => ({ order_id: r.orderId, transaction_status: 'settlement', gross_amount: '200000.00' }) }; };
  const c = await fns.checkMidtransPayment({}, asRani);
  assert.strictEqual(c.activated, 1);
  assert.ok(asked.startsWith('https://api.sandbox.midtrans.com/v2/'));
  assert.strictEqual(store.get('orgs/org1').plan, 'pro');
});
