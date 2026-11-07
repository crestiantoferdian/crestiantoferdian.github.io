/**
 * Google Play Billing untuk aplikasi LLK dari Play Store (TWA).
 * Dipisah dari index.js supaya bisa diuji tanpa Firebase (lihat test/playbilling.test.js).
 *
 * Alur: aplikasi (Digital Goods API) → purchaseToken → verifyPlayPurchase (index.js)
 *   → di sini: tanya Google Play Developer API (subscriptionsv2) → hitung perubahan
 *   `subscriptions/{uid}` → acknowledge. Masa aktif SELALU dari Google (expiryTime),
 *   bukan dihitung sendiri seperti Midtrans.
 *
 * Tidak ada kunci rahasia: panggilan API memakai akun layanan Cloud Functions
 * (Application Default Credentials). Akun itu diundang di Play Console oleh pemilik.
 */
const crypto = require('crypto');
const { PLANS } = require('./plans');

const PACKAGE_NAME = 'com.leslesanku.app';
const API = 'https://androidpublisher.googleapis.com/androidpublisher/v3/applications';

/**
 * Product ID di Play Console → kunci paket di plans.js.
 * Rancangan utama: 5 langganan, masing-masing 1 base plan (hindari kerancuan
 * Digital Goods API untuk langganan dengan banyak base plan).
 */
const PLAY_PRODUCTS = {
  llk_basic_monthly: 'basic_monthly',
  llk_up_monthly: 'up_monthly',
  llk_up_yearly: 'up_yearly',
  llk_unlimited_monthly: 'unlimited_monthly',
  llk_unlimited_yearly: 'unlimited_yearly',
};
// Cadangan: 3 langganan (llk_basic/llk_up/llk_unlimited) dengan base plan bulanan/tahunan.
const PLAY_BASE_PLANS = {
  'llk_basic:bulanan': 'basic_monthly',
  'llk_up:bulanan': 'up_monthly',
  'llk_up:tahunan': 'up_yearly',
  'llk_unlimited:bulanan': 'unlimited_monthly',
  'llk_unlimited:tahunan': 'unlimited_yearly',
};
// Kebalikannya: kunci paket → product ID yang dipakai aplikasi
const PLAY_SKUS = Object.fromEntries(Object.entries(PLAY_PRODUCTS).map(([sku, plan]) => [plan, sku]));

/** Product ID (+ base plan kalau ada) → kunci paket, atau null kalau tidak dikenal. */
function resolvePlayPlan(productId, basePlanId) {
  if (PLAY_PRODUCTS[productId]) return PLAY_PRODUCTS[productId];
  if (basePlanId && PLAY_BASE_PLANS[productId + ':' + basePlanId]) return PLAY_BASE_PLANS[productId + ':' + basePlanId];
  return null;
}

// Status Google yang masih memberi akses sampai expiryTime
const ACCESS_STATES = new Set(['SUBSCRIPTION_STATE_ACTIVE', 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD', 'SUBSCRIPTION_STATE_CANCELED']);

/** Hash token (token asli tidak disimpan sebagai ID dokumen). */
function tokenKey(purchaseToken) {
  return crypto.createHash('sha256').update(String(purchaseToken)).digest('hex');
}

/** Ringkas respons subscriptionsv2 menjadi bentuk yang kita pakai. */
function parsePlaySubscription(resp) {
  const items = (resp && resp.lineItems) || [];
  const li = items[0] || {};
  const expiryMs = li.expiryTime ? Date.parse(li.expiryTime) : 0;
  const startMs = resp && resp.startTime ? Date.parse(resp.startTime) : 0;
  return {
    state: (resp && resp.subscriptionState) || '',
    productId: li.productId || '',
    basePlanId: (li.offerDetails && li.offerDetails.basePlanId) || '',
    expiryMs: Number.isFinite(expiryMs) ? expiryMs : 0,
    startMs: Number.isFinite(startMs) ? startMs : 0,
    latestOrderId: (resp && resp.latestOrderId) || '',
    ackPending: (resp && resp.acknowledgementState) === 'ACKNOWLEDGEMENT_STATE_PENDING',
    autoRenew: !!(li.autoRenewingPlan && li.autoRenewingPlan.autoRenewEnabled),
    test: !!(resp && resp.testPurchase),
  };
}

function hasAccess(play, nowMs) {
  return ACCESS_STATES.has(play.state) && play.expiryMs > nowMs;
}

/**
 * Tentukan perubahan `subscriptions/{uid}` untuk satu pembelian Play.
 * cur  : data subscriptions sekarang { status, tier, source, playTokenKey, subscriptionEndsMs } atau null
 * play : hasil parsePlaySubscription
 * Mengembalikan { action: 'activate'|'expire'|'keep'|'noop', fields? }
 *  - activate: Play memberi akses → langganan aktif sampai expiryTime Google.
 *  - keep    : pengguna masih punya langganan web (Midtrans) yang berakhir LEBIH LAMA → jangan dikurangi.
 *  - expire  : token ini adalah langganan Play yang sedang berlaku dan sudah tidak ada akses.
 *  - noop    : token lama/tidak relevan (mis. diganti paket lain) → jangan mengubah apa pun.
 */
function decideSubscriptionUpdate(cur, play, planKey, key, nowMs) {
  const plan = PLANS[planKey];
  if (!plan) throw new Error('Plan tidak dikenal: ' + planKey);
  if (hasAccess(play, nowMs)) {
    const curEnds = cur && cur.subscriptionEndsMs ? cur.subscriptionEndsMs : 0;
    const curActive = !!cur && cur.status === 'active' && curEnds > nowMs;
    if (curActive && cur.source !== 'play' && curEnds > play.expiryMs) return { action: 'keep' };
    return {
      action: 'activate',
      fields: {
        status: 'active', plan: planKey, tier: plan.tier, source: 'play',
        playTokenKey: key, playState: play.state, playAutoRenew: play.autoRenew,
        subscriptionEndsMs: play.expiryMs,
      },
    };
  }
  const isCurrentPlay = !!cur && cur.source === 'play' && cur.playTokenKey === key;
  if (isCurrentPlay) {
    return { action: 'expire', fields: { status: 'expired', playState: play.state, playAutoRenew: false, subscriptionEndsMs: play.expiryMs } };
  }
  return { action: 'noop' };
}

/** Klien Play Developer API. `getToken` → access token; `fetchImpl` bisa diganti saat uji. */
function createPlayClient({ getToken, fetchImpl, packageName }) {
  const pkg = packageName || PACKAGE_NAME;
  async function call(method, url, body) {
    const token = await getToken();
    const res = await (fetchImpl || fetch)(url, { // fetch dicari saat dipakai (bukan disimpan saat dibuat)
      method,
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let json = {};
    try { json = text ? JSON.parse(text) : {}; } catch (e) { json = { raw: text }; }
    if (!res.ok) {
      const err = new Error('Play API ' + res.status + ': ' + String((json.error && json.error.message) || text).slice(0, 200));
      err.status = res.status;
      throw err;
    }
    return json;
  }
  return {
    getSubscription: (purchaseToken) =>
      call('GET', `${API}/${pkg}/purchases/subscriptionsv2/tokens/${encodeURIComponent(purchaseToken)}`),
    acknowledge: (productId, purchaseToken) =>
      call('POST', `${API}/${pkg}/purchases/subscriptions/${encodeURIComponent(productId)}/tokens/${encodeURIComponent(purchaseToken)}:acknowledge`, {}),
  };
}

/**
 * Layanan inti: dipakai verifyPlayPurchase (aplikasi) dan playRtdn (notifikasi Google).
 * deps: { db, Timestamp, client, now }  — db/Timestamp dari firebase-admin, diganti tiruan saat uji.
 */
function createPlayService({ db, Timestamp, client, now }) {
  const nowMs = () => (now ? now() : Date.now());

  /**
   * Verifikasi token milik `uid`, perbarui langganan, lalu acknowledge.
   * opts.fromUser=true (pembelian/pemulihan dari aplikasi): token baru boleh diikat ke uid ini.
   * opts.fromUser=false (RTDN): hanya token yang SUDAH terikat ke uid.
   */
  async function applyPurchase(uid, purchaseToken, opts) {
    opts = opts || {};
    const key = tokenKey(purchaseToken);
    const bindRef = db.collection('playPurchases').doc(key);
    const bind = await bindRef.get();
    if (bind.exists && bind.data().uid !== uid) {
      const e = new Error('Pembelian ini sudah dipakai akun lain.');
      e.code = 'token-bound-elsewhere';
      throw e;
    }
    if (!bind.exists && opts.fromUser === false) {
      const e = new Error('Token belum terikat ke akun.');
      e.code = 'token-unknown';
      throw e;
    }

    const play = parsePlaySubscription(await client.getSubscription(purchaseToken));
    const planKey = resolvePlayPlan(play.productId, play.basePlanId);
    if (!planKey) {
      const e = new Error('Produk Play tidak dikenal: ' + play.productId);
      e.code = 'unknown-product';
      throw e;
    }

    const now = nowMs();
    const result = await db.runTransaction(async (tx) => {
      const subRef = db.collection('subscriptions').doc(uid);
      const subSnap = await tx.get(subRef);
      const d = subSnap.exists ? subSnap.data() : null;
      const cur = d && {
        status: d.status, tier: d.tier, source: d.source, playTokenKey: d.playTokenKey,
        subscriptionEndsMs: d.subscriptionEndsAt ? d.subscriptionEndsAt.toMillis() : 0,
      };
      const dec = decideSubscriptionUpdate(cur, play, planKey, key, now);
      if (dec.action === 'activate' || dec.action === 'expire') {
        const f = dec.fields;
        tx.set(subRef, {
          status: f.status,
          ...(f.plan ? { plan: f.plan, tier: f.tier } : {}),
          source: 'play',
          playTokenKey: key,
          playState: f.playState,
          playAutoRenew: f.playAutoRenew,
          subscriptionEndsAt: Timestamp.fromMillis(f.subscriptionEndsMs),
          updatedAt: Timestamp.now(),
        }, { merge: true });
      }
      // Ikat token ke uid (sekali; token tidak bisa dipakai akun lain)
      tx.set(bindRef, { uid, productId: play.productId, plan: planKey, lastState: play.state, updatedAt: Timestamp.now() }, { merge: true });
      // Catatan riwayat pembelian (untuk halaman "Paket & Harga")
      if (dec.action === 'activate' && play.latestOrderId) {
        const plan = PLANS[planKey];
        const dur = plan.period === 'yearly' ? 365 * 864e5 : 30 * 864e5;
        tx.set(db.collection('orders').doc('PLAY-' + play.latestOrderId), {
          uid, plan: planKey, label: plan.label + ' · Google Play', grossAmount: plan.price, source: 'play',
          status: 'paid', paidAt: Timestamp.fromMillis(play.startMs || now),
          activeFromMs: Math.max(play.startMs || 0, play.expiryMs - dur), activeUntilMs: play.expiryMs,
        }, { merge: true });
      }
      return { action: dec.action, plan: planKey, tier: PLANS[planKey].tier, state: play.state, endsMs: play.expiryMs, access: hasAccess(play, now) };
    });

    // Acknowledge wajib dalam 3 hari, kalau tidak Google membatalkan & mengembalikan dana.
    // Hanya untuk pembelian yang memang memberi akses (bukan PENDING).
    if (play.ackPending && hasAccess(play, now)) {
      try { await client.acknowledge(play.productId, purchaseToken); result.acknowledged = true; }
      catch (e) { console.error('Acknowledge Play gagal (akan dicoba lagi saat verifikasi berikutnya):', e.message); result.acknowledged = false; }
    }
    return result;
  }

  /** Notifikasi dari Google (Pub/Sub). Mengembalikan true kalau diproses. */
  async function handleNotification(message) {
    const n = message && message.subscriptionNotification;
    if (!n || !n.purchaseToken) return false;
    const bind = await db.collection('playPurchases').doc(tokenKey(n.purchaseToken)).get();
    if (!bind.exists) return false; // token belum pernah diverifikasi aplikasi → akan terikat saat pembeli membuka aplikasi
    await applyPurchase(bind.data().uid, n.purchaseToken, { fromUser: false });
    return true;
  }

  return { applyPurchase, handleNotification };
}

module.exports = {
  PACKAGE_NAME, PLAY_PRODUCTS, PLAY_SKUS, resolvePlayPlan, tokenKey, parsePlaySubscription,
  hasAccess, decideSubscriptionUpdate, createPlayClient, createPlayService,
};
