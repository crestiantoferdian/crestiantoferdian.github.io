// Uji Google Play Billing (playbilling.js) tanpa Firebase/Google sungguhan.
// Jalankan: cd functions && npm test
const test = require('node:test');
const assert = require('node:assert');
const PB = require('../playbilling.js');

const DAY = 864e5;
const NOW = Date.parse('2026-11-10T00:00:00Z');
const ts = (ms) => ({ toMillis: () => ms, _ms: ms });
const Timestamp = { now: () => ts(NOW), fromMillis: ts };

// Firestore tiruan sangat kecil (transaksi: tulisan ditahan sampai selesai)
function makeDb() {
  const store = new Map();
  const ref = (path) => ({
    path,
    async get() { const d = store.get(path); return { exists: d !== undefined, data: () => d }; },
    async set(data, opts) { store.set(path, opts && opts.merge ? { ...(store.get(path) || {}), ...data } : { ...data }); },
  });
  return {
    store,
    collection: (c) => ({ doc: (id) => ref(c + '/' + id) }),
    async runTransaction(fn) {
      const writes = [];
      const out = await fn({
        get: (r) => r.get(),
        set: (r, data, opts) => writes.push(() => r.set(data, opts)),
      });
      for (const w of writes) await w();
      return out;
    },
  };
}

// Respons subscriptionsv2 tiruan
function sub({ state = 'SUBSCRIPTION_STATE_ACTIVE', productId = 'llk_up_monthly', basePlanId, expiryMs, startMs = NOW - 2 * DAY, orderId = 'GPA.1111-2222-3333-44444', ack = 'ACKNOWLEDGEMENT_STATE_PENDING', test } = {}) {
  return {
    kind: 'androidpublisher#subscriptionPurchaseV2',
    latestOrderId: orderId,
    startTime: new Date(startMs).toISOString(),
    subscriptionState: state,
    acknowledgementState: ack,
    ...(test ? { testPurchase: {} } : {}),
    lineItems: [{
      productId,
      expiryTime: new Date(expiryMs === undefined ? NOW + 20 * DAY : expiryMs).toISOString(),
      autoRenewingPlan: { autoRenewEnabled: true },
      ...(basePlanId ? { offerDetails: { basePlanId } } : {}),
    }],
  };
}

// Klien Play tiruan: `responses[token]` boleh diganti antar-panggilan
function makeClient(responses) {
  const acks = [];
  return {
    acks, responses,
    async getSubscription(token) {
      if (!(token in responses)) { const e = new Error('Play API 404'); e.status = 404; throw e; }
      return responses[token];
    },
    async acknowledge(productId, token) { acks.push([productId, token]); return {}; },
  };
}
const svc = (db, client) => PB.createPlayService({ db, Timestamp, client, now: () => NOW });

// ── Pemetaan produk ────────────────────────────────────────────────
test('product ID Play dipetakan ke paket (5 langganan, base plan cadangan, tak dikenal = null)', () => {
  assert.strictEqual(PB.resolvePlayPlan('llk_basic_monthly'), 'basic_monthly');
  assert.strictEqual(PB.resolvePlayPlan('llk_up_yearly'), 'up_yearly');
  assert.strictEqual(PB.resolvePlayPlan('llk_unlimited_yearly'), 'unlimited_yearly');
  assert.strictEqual(PB.resolvePlayPlan('llk_up', 'tahunan'), 'up_yearly'); // cadangan 3 langganan + base plan
  assert.strictEqual(PB.resolvePlayPlan('llk_basic', 'bulanan'), 'basic_monthly');
  assert.strictEqual(PB.resolvePlayPlan('llk_up'), null);
  assert.strictEqual(PB.resolvePlayPlan('hacker'), null);
  // kebalikan dipakai aplikasi: tiap kunci paket punya 1 SKU
  assert.strictEqual(PB.PLAY_SKUS.up_monthly, 'llk_up_monthly');
  assert.strictEqual(Object.keys(PB.PLAY_SKUS).length, 5);
});

test('semua paket di plans.js punya SKU Play (tidak ada paket yang tidak bisa dibeli)', () => {
  const { PLANS } = require('../plans.js');
  for (const k of Object.keys(PLANS)) assert.ok(PB.PLAY_SKUS[k], 'SKU Play hilang untuk ' + k);
});

// ── Keputusan perubahan langganan ──────────────────────────────────
test('decide: aktif → activate; dibatalkan tapi belum habis → tetap activate', () => {
  const p = PB.parsePlaySubscription(sub({}));
  const d = PB.decideSubscriptionUpdate(null, p, 'up_monthly', 'k1', NOW);
  assert.strictEqual(d.action, 'activate');
  assert.strictEqual(d.fields.tier, 'up');
  assert.strictEqual(d.fields.subscriptionEndsMs, NOW + 20 * DAY);
  const c = PB.parsePlaySubscription(sub({ state: 'SUBSCRIPTION_STATE_CANCELED' }));
  assert.strictEqual(PB.decideSubscriptionUpdate(null, c, 'up_monthly', 'k1', NOW).action, 'activate');
  const g = PB.parsePlaySubscription(sub({ state: 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD' }));
  assert.strictEqual(PB.decideSubscriptionUpdate(null, g, 'up_monthly', 'k1', NOW).action, 'activate');
});

test('decide: ON_HOLD / PENDING / sudah lewat tanggal → tidak memberi akses', () => {
  for (const state of ['SUBSCRIPTION_STATE_ON_HOLD', 'SUBSCRIPTION_STATE_PAUSED', 'SUBSCRIPTION_STATE_PENDING', 'SUBSCRIPTION_STATE_EXPIRED']) {
    const p = PB.parsePlaySubscription(sub({ state }));
    assert.strictEqual(PB.decideSubscriptionUpdate(null, p, 'up_monthly', 'k1', NOW).action, 'noop', state);
  }
  const lewat = PB.parsePlaySubscription(sub({ state: 'SUBSCRIPTION_STATE_ACTIVE', expiryMs: NOW - 1 }));
  assert.strictEqual(PB.hasAccess(lewat, NOW), false);
});

test('decide: habis hanya mengakhiri langganan Play yang SEDANG BERLAKU (token itu)', () => {
  const habis = PB.parsePlaySubscription(sub({ state: 'SUBSCRIPTION_STATE_EXPIRED', expiryMs: NOW - DAY }));
  const cur = { status: 'active', tier: 'up', source: 'play', playTokenKey: 'k1', subscriptionEndsMs: NOW + DAY };
  assert.strictEqual(PB.decideSubscriptionUpdate(cur, habis, 'up_monthly', 'k1', NOW).action, 'expire');
  assert.strictEqual(PB.decideSubscriptionUpdate(cur, habis, 'up_monthly', 'TOKEN-LAMA', NOW).action, 'noop');
  // langganan web (Midtrans) tidak disentuh
  const web = { status: 'active', tier: 'up', source: undefined, subscriptionEndsMs: NOW + 5 * DAY };
  assert.strictEqual(PB.decideSubscriptionUpdate(web, habis, 'up_monthly', 'k1', NOW).action, 'noop');
});

test('decide: pelanggan web yang masa aktifnya lebih lama tidak dikurangi', () => {
  const web = { status: 'active', tier: 'unlimited', subscriptionEndsMs: NOW + 300 * DAY };
  const p = PB.parsePlaySubscription(sub({ expiryMs: NOW + 20 * DAY }));
  assert.strictEqual(PB.decideSubscriptionUpdate(web, p, 'up_monthly', 'k1', NOW).action, 'keep');
});

// ── Layanan: pembelian pertama ─────────────────────────────────────
test('pembelian pertama: langganan aktif, token terikat, riwayat tercatat, acknowledge sekali', async () => {
  const db = makeDb();
  const client = makeClient({ T1: sub({}) });
  const r = await svc(db, client).applyPurchase('u1', 'T1', { fromUser: true });
  assert.strictEqual(r.access, true);
  assert.strictEqual(r.plan, 'up_monthly');
  const s = db.store.get('subscriptions/u1');
  assert.strictEqual(s.status, 'active');
  assert.strictEqual(s.plan, 'up_monthly');
  assert.strictEqual(s.tier, 'up');
  assert.strictEqual(s.source, 'play');
  assert.strictEqual(s.subscriptionEndsAt.toMillis(), NOW + 20 * DAY);
  assert.strictEqual(s.playTokenKey, PB.tokenKey('T1'));
  assert.ok(!JSON.stringify([...db.store.keys()]).includes('"T1"') && ![...db.store.keys()].some((k) => k.includes('T1')), 'token asli tidak boleh jadi ID dokumen');
  const bind = db.store.get('playPurchases/' + PB.tokenKey('T1'));
  assert.strictEqual(bind.uid, 'u1');
  const order = db.store.get('orders/PLAY-GPA.1111-2222-3333-44444');
  assert.strictEqual(order.status, 'paid'); assert.strictEqual(order.source, 'play'); assert.strictEqual(order.uid, 'u1');
  assert.strictEqual(order.grossAmount, 75000);
  assert.deepStrictEqual(client.acks, [['llk_up_monthly', 'T1']]);
});

test('verifikasi ulang token yang sudah di-acknowledge: tidak acknowledge lagi', async () => {
  const db = makeDb();
  const client = makeClient({ T1: sub({ ack: 'ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED' }) });
  await svc(db, client).applyPurchase('u1', 'T1', { fromUser: true });
  await svc(db, client).applyPurchase('u1', 'T1', { fromUser: true });
  assert.strictEqual(client.acks.length, 0);
  assert.strictEqual(db.store.get('subscriptions/u1').status, 'active');
});

test('pembelian PENDING (belum dibayar): tidak diaktifkan dan tidak di-acknowledge', async () => {
  const db = makeDb();
  const client = makeClient({ T1: sub({ state: 'SUBSCRIPTION_STATE_PENDING' }) });
  const r = await svc(db, client).applyPurchase('u1', 'T1', { fromUser: true });
  assert.strictEqual(r.access, false);
  assert.strictEqual(db.store.get('subscriptions/u1'), undefined);
  assert.strictEqual(client.acks.length, 0);
});

test('gagal acknowledge tidak menggagalkan aktivasi (dicoba lagi saat verifikasi berikutnya)', async () => {
  const db = makeDb();
  const client = makeClient({ T1: sub({}) });
  client.acknowledge = async () => { throw new Error('jaringan'); };
  const r = await svc(db, client).applyPurchase('u1', 'T1', { fromUser: true });
  assert.strictEqual(r.access, true);
  assert.strictEqual(r.acknowledged, false);
  assert.strictEqual(db.store.get('subscriptions/u1').status, 'active');
});

// ── Keamanan ───────────────────────────────────────────────────────
test('token yang sudah dipakai akun lain ditolak (tidak bisa dibagikan)', async () => {
  const db = makeDb();
  const client = makeClient({ T1: sub({}) });
  await svc(db, client).applyPurchase('u1', 'T1', { fromUser: true });
  await assert.rejects(() => svc(db, client).applyPurchase('u2', 'T1', { fromUser: true }), (e) => e.code === 'token-bound-elsewhere');
  assert.strictEqual(db.store.get('subscriptions/u2'), undefined);
});

test('token palsu / tidak ada di Google: ditolak dan tidak ada yang berubah', async () => {
  const db = makeDb();
  const client = makeClient({});
  await assert.rejects(() => svc(db, client).applyPurchase('u1', 'PALSU', { fromUser: true }), (e) => e.status === 404);
  assert.strictEqual(db.store.size, 0);
});

test('produk tidak dikenal ditolak', async () => {
  const db = makeDb();
  const client = makeClient({ T1: sub({ productId: 'produk_lain' }) });
  await assert.rejects(() => svc(db, client).applyPurchase('u1', 'T1', { fromUser: true }), (e) => e.code === 'unknown-product');
  assert.strictEqual(db.store.get('subscriptions/u1'), undefined);
});

// ── Notifikasi Google (RTDN) ───────────────────────────────────────
test('RTDN perpanjangan: masa aktif ikut Google & riwayat baru; RTDN habis: status expired', async () => {
  const db = makeDb();
  const client = makeClient({ T1: sub({ ack: 'ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED' }) });
  const s = svc(db, client);
  await s.applyPurchase('u1', 'T1', { fromUser: true });
  // perpanjang otomatis: order baru, expiry mundur ke depan
  client.responses.T1 = sub({ ack: 'ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED', expiryMs: NOW + 50 * DAY, startMs: NOW + 20 * DAY, orderId: 'GPA.9999-0000-0000-00001' });
  assert.strictEqual(await s.handleNotification({ subscriptionNotification: { notificationType: 2, purchaseToken: 'T1', subscriptionId: 'llk_up_monthly' } }), true);
  assert.strictEqual(db.store.get('subscriptions/u1').subscriptionEndsAt.toMillis(), NOW + 50 * DAY);
  assert.ok(db.store.get('orders/PLAY-GPA.9999-0000-0000-00001'));
  // kedaluwarsa
  client.responses.T1 = sub({ state: 'SUBSCRIPTION_STATE_EXPIRED', ack: 'ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED', expiryMs: NOW - DAY });
  await s.handleNotification({ subscriptionNotification: { notificationType: 13, purchaseToken: 'T1', subscriptionId: 'llk_up_monthly' } });
  assert.strictEqual(db.store.get('subscriptions/u1').status, 'expired');
});

test('RTDN untuk token yang belum pernah diverifikasi aplikasi: diabaikan, tidak ada perubahan', async () => {
  const db = makeDb();
  const client = makeClient({ T9: sub({}) });
  assert.strictEqual(await svc(db, client).handleNotification({ subscriptionNotification: { purchaseToken: 'T9' } }), false);
  assert.strictEqual(db.store.size, 0);
  assert.strictEqual(await svc(db, client).handleNotification({ testNotification: { version: '1.0' } }), false);
});

test('ganti paket: token lama yang kemudian habis TIDAK mematikan paket baru', async () => {
  const db = makeDb();
  const client = makeClient({
    OLD: sub({ productId: 'llk_basic_monthly', ack: 'ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED' }),
    NEW: sub({ productId: 'llk_unlimited_monthly', orderId: 'GPA.2222', ack: 'ACKNOWLEDGEMENT_STATE_PENDING' }),
  });
  const s = svc(db, client);
  await s.applyPurchase('u1', 'OLD', { fromUser: true });
  await s.applyPurchase('u1', 'NEW', { fromUser: true });
  assert.strictEqual(db.store.get('subscriptions/u1').tier, 'unlimited');
  // Google menandai token lama habis setelah diganti
  client.responses.OLD = sub({ productId: 'llk_basic_monthly', state: 'SUBSCRIPTION_STATE_EXPIRED', expiryMs: NOW - 1000, ack: 'ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED' });
  await s.handleNotification({ subscriptionNotification: { purchaseToken: 'OLD', subscriptionId: 'llk_basic_monthly' } });
  const cur = db.store.get('subscriptions/u1');
  assert.strictEqual(cur.status, 'active');
  assert.strictEqual(cur.tier, 'unlimited');
});

test('langganan web yang masih lama tidak ditimpa pembelian Play yang lebih pendek', async () => {
  const db = makeDb();
  db.store.set('subscriptions/u1', { status: 'active', plan: 'unlimited_yearly', tier: 'unlimited', subscriptionEndsAt: ts(NOW + 300 * DAY) });
  const client = makeClient({ T1: sub({ productId: 'llk_basic_monthly', expiryMs: NOW + 20 * DAY, ack: 'ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED' }) });
  const r = await svc(db, client).applyPurchase('u1', 'T1', { fromUser: true });
  assert.strictEqual(r.action, 'keep');
  const cur = db.store.get('subscriptions/u1');
  assert.strictEqual(cur.tier, 'unlimited');
  assert.strictEqual(cur.subscriptionEndsAt.toMillis(), NOW + 300 * DAY);
});

// ── Klien API ──────────────────────────────────────────────────────
test('klien Play: alamat, header, dan penanganan kesalahan benar', async () => {
  const calls = [];
  const fetchImpl = async (url, opts) => {
    calls.push([url, opts]);
    if (url.includes('GAGAL')) return { ok: false, status: 403, text: async () => JSON.stringify({ error: { message: 'tidak ada izin' } }) };
    return { ok: true, status: 200, text: async () => JSON.stringify({ ok: 1 }) };
  };
  const c = PB.createPlayClient({ getToken: async () => 'ACCESS', fetchImpl });
  await c.getSubscription('tok/en+1');
  assert.ok(calls[0][0].startsWith('https://androidpublisher.googleapis.com/androidpublisher/v3/applications/com.leslesanku.app/purchases/subscriptionsv2/tokens/'));
  assert.ok(calls[0][0].endsWith(encodeURIComponent('tok/en+1')));
  assert.strictEqual(calls[0][1].headers.Authorization, 'Bearer ACCESS');
  await c.acknowledge('llk_up_monthly', 'T');
  assert.ok(calls[1][0].endsWith('/purchases/subscriptions/llk_up_monthly/tokens/T:acknowledge'));
  assert.strictEqual(calls[1][1].method, 'POST');
  await assert.rejects(() => c.getSubscription('GAGAL'), (e) => e.status === 403 && /tidak ada izin/.test(e.message));
});
