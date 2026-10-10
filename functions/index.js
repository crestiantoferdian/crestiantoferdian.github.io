const functions = require('firebase-functions/v1');
const admin = require('firebase-admin');
const crypto = require('crypto');
const { PLANS, resolvePlan, nextSubscription, priceFor, trialKey } = require('./plans');
const OP = require('./orgPlans');
const N = require('./notify');
const R = require('./reminders');

admin.initializeApp();
const db = admin.firestore();

// Diambil dari file functions/.env (lihat README untuk cara membuatnya)
const MIDTRANS_SERVER_KEY = process.env.MIDTRANS_SERVER_KEY;
const MIDTRANS_IS_PRODUCTION = process.env.MIDTRANS_IS_PRODUCTION === 'true';
const MIDTRANS_BASE_URL = MIDTRANS_IS_PRODUCTION
  ? 'https://app.midtrans.com'
  : 'https://app.sandbox.midtrans.com';
function midtransAuthHeader(key) {
  return 'Basic ' + Buffer.from((key || MIDTRANS_SERVER_KEY) + ':').toString('base64');
}

// LLK V2 (Lembaga) punya pengaturan Midtrans sendiri supaya V2 bisa diuji di
// SANDBOX walau V1 sudah PRODUCTION. Kalau kosong: kunci sama dengan V1, mode sandbox.
const MIDTRANS_V2_SERVER_KEY = process.env.MIDTRANS_V2_SERVER_KEY || MIDTRANS_SERVER_KEY;
const MIDTRANS_V2_IS_PRODUCTION = process.env.MIDTRANS_V2_IS_PRODUCTION === 'true';
function midtransCfg(order) {
  const v2 = !!order && order.type === 'org';
  const prod = v2 ? MIDTRANS_V2_IS_PRODUCTION : MIDTRANS_IS_PRODUCTION;
  return {
    key: v2 ? MIDTRANS_V2_SERVER_KEY : MIDTRANS_SERVER_KEY,
    env: prod ? 'production' : 'sandbox',
    snap: prod ? 'https://app.midtrans.com' : 'https://app.sandbox.midtrans.com',
    api: prod ? 'https://api.midtrans.com' : 'https://api.sandbox.midtrans.com',
  };
}
function isPaidStatus(transaction_status, fraud_status) {
  return (transaction_status === 'capture' && fraud_status === 'accept') ||
    transaction_status === 'settlement';
}

// Email (Resend atau Gmail) & Telegram: lihat notify.js untuk isi functions/.env

const TRIAL_DAYS = 31;


/**
 * Kirim email invoice/struk pembayaran setelah langganan berhasil diaktifkan,
 * plus chat Telegram ke pemilik. Kalau email/Telegram belum diisi di .env,
 * fungsi ini diam saja (tidak bikin webhook gagal).
 */
async function sendInvoiceEmail({ toEmail, orderId, plan, label, grossAmount, paidAtMs, subscriptionEndsMs, orgName, v2, env }) {
  const planLabel = label || (resolvePlan(plan) || {}).label || plan;
  // Email invoice ke pembeli + chat Telegram ke pemilik (lihat notify.js). Keduanya tidak pernah
  // menggagalkan aktivasi langganan.
  const mail = N.invoiceEmail({ orderId, label: planLabel, amount: grossAmount, paidAtMs, activeUntilMs: subscriptionEndsMs, orgName, v2 });
  await Promise.all([
    N.sendEmail({ to: toEmail, subject: mail.subject, html: mail.html }),
    N.sendTelegram(N.tgPaid({ v2, orderId, email: toEmail, label: planLabel, amount: grossAmount, orgName, activeUntilMs: subscriptionEndsMs, env })),
  ]);
}

/**
 * 1) Dipanggil otomatis oleh Firebase saat ada akun baru (login Google pertama kali).
 *    Ini SATU-SATUNYA tempat trial dimulai -> tidak bisa direset dari client.
 *    Trial hanya diberikan SEKALI per email: pemakaiannya dicatat di
 *    trialUsage/{hash email}, yang tidak ikut terhapus saat akun dihapus.
 *    Tanpa ini, "Hapus Akun" lalu login lagi = uid baru = trial baru.
 */
exports.onUserCreate = functions.auth.user().onCreate(async (user) => {
  const now = admin.firestore.Timestamp.now();
  const key = trialKey(user.email);
  let trialAllowed = true;
  if (key) {
    const usageRef = db.collection('trialUsage').doc(key);
    trialAllowed = await db.runTransaction(async (tx) => {
      const usage = await tx.get(usageRef);
      if (usage.exists) return false;
      tx.set(usageRef, { firstUid: user.uid, firstTrialAt: now });
      return true;
    });
  }
  if (!trialAllowed) {
    console.log('Trial ditolak, email sudah pernah memakai trial:', user.uid);
    await db.collection('subscriptions').doc(user.uid).set({
      status: 'expired',
      trialDenied: 'already_used',
      trialStartedAt: null,
      trialEndsAt: now,
      subscriptionEndsAt: null,
      plan: null,
      tier: null,
      createdAt: now,
    });
    await welcomeNotify(user, { trialDenied: true });
    return;
  }
  const trialEnds = admin.firestore.Timestamp.fromMillis(
    now.toMillis() + TRIAL_DAYS * 24 * 60 * 60 * 1000
  );
  await db.collection('subscriptions').doc(user.uid).set({
    status: 'trial',
    trialStartedAt: now,
    trialEndsAt: trialEnds,
    subscriptionEndsAt: null,
    plan: null,
    tier: null,
    createdAt: now,
  });
  await welcomeNotify(user, { trialEndsMs: trialEnds.toMillis() });
});

// Email "terima kasih sudah bergabung" ke pengguna baru + chat Telegram ke pemilik
async function welcomeNotify(user, { trialEndsMs, trialDenied }) {
  const mail = N.welcomeEmail({ name: user.displayName, trialDays: TRIAL_DAYS, trialEndsMs, trialDenied });
  await Promise.all([
    N.sendEmail({ to: user.email, subject: mail.subject, html: mail.html }),
    N.sendTelegram(N.tgNewUser({ name: user.displayName, email: user.email, trialDenied })),
  ]);
}

/**
 * 1c) LLK V2: lembaga baru dibuat (oleh pemiliknya dari aplikasi) → email selamat datang
 *     ke pemilik + chat Telegram ke pemilik LesLesanKu.
 */
exports.onOrgCreate = functions.firestore.document('orgs/{orgId}').onCreate(async (snap) => {
  const o = snap.data() || {};
  let email = null, name = null;
  try { const u = await admin.auth().getUser(o.ownerUid); email = u.email; name = u.displayName; } catch (e) { console.warn('Pemilik lembaga tidak ditemukan:', o.ownerUid); }
  const createdMs = o.createdAt && o.createdAt.toMillis ? o.createdAt.toMillis() : Date.now();
  const mail = N.orgWelcomeEmail({ name, orgName: o.name || 'Lembaga', trialDays: OP.ORG_TRIAL_DAYS, trialEndsMs: createdMs + OP.ORG_TRIAL_DAYS * 864e5 });
  await Promise.all([
    N.sendEmail({ to: email, subject: mail.subject, html: mail.html }),
    N.sendTelegram(N.tgNewOrg({ orgName: o.name || '-', name, email })),
  ]);
});

/**
 * 1c) LLK Lembaga: tiap pagi 08.00 WIB kirim pengingat H-3 & H-1 sebelum langganan / uji coba
 *     berakhir (email ke pemilik lembaga + Telegram ke pemilik LLK). Lihat reminders.js.
 */
exports.orgEndReminders = functions.pubsub.schedule('0 8 * * *').timeZone('Asia/Jakarta').onRun(async () => {
  const n = await R.runOrgEndReminders({ db, getUser: (uid) => admin.auth().getUser(uid), N, OP, nowMs: Date.now() });
  console.log('Pengingat lembaga terkirim:', n);
  return null;
});

/**
 * 1b) Saat akun dihapus: pastikan email ini tercatat sudah memakai trial.
 *     Menutup celah untuk akun lama yang dibuat sebelum trialUsage ada.
 */
exports.onUserDelete = functions.auth.user().onDelete(async (user) => {
  const key = trialKey(user.email);
  if (!key) return;
  const usageRef = db.collection('trialUsage').doc(key);
  const usage = await usageRef.get();
  if (!usage.exists) {
    await usageRef.set({ firstUid: user.uid, recordedAtDelete: admin.firestore.Timestamp.now() });
  }
});

/**
 * 2) Dipanggil dari app (httpsCallable) saat user tekan tombol "Berlangganan".
 *    Membuat transaksi Snap di Midtrans dan mengembalikan token untuk dibuka di client.
 */
exports.createMidtransTransaction = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Harus login dulu.');
  }

  const uid = context.auth.uid;
  const plan = data.plan; // salah satu kunci PLANS, mis. 'up_monthly'
  if (!PLANS[plan]) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'Paket tidak valid. Tutup lalu buka lagi aplikasinya supaya memuat daftar paket terbaru.'
    );
  }

  const orderId = `LLK-${uid.slice(0, 8)}-${Date.now()}`;
  // Harga dihitung di server: pelanggan berbayar yang naik paket mendapat diskon 50%
  const subSnap = await db.collection('subscriptions').doc(uid).get();
  const cur = subSnap.exists ? subSnap.data() : null;
  const pr = priceFor(cur && {
    status: cur.status, tier: cur.tier, plan: cur.plan, isTester: cur.isTester === true,
    subscriptionEndsMs: cur.subscriptionEndsAt ? cur.subscriptionEndsAt.toMillis() : 0,
  }, plan, Date.now());
  const grossAmount = pr.price;
  const email = context.auth.token.email || null; // disimpan supaya webhook nanti tahu ke mana kirim invoice

  await db.collection('orders').doc(orderId).set({
    uid,
    plan,
    grossAmount,
    ...(pr.upgrade ? { fullPrice: pr.fullPrice, discount: 'upgrade' + Math.round(pr.discount * 100), label: PLANS[plan].label + ' · diskon naik paket ' + Math.round(pr.discount * 100) + '%' } : {}),
    email,
    status: 'pending',
    createdAt: admin.firestore.Timestamp.now(),
  });

  const resp = await fetch(`${MIDTRANS_BASE_URL}/snap/v1/transactions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: midtransAuthHeader(),
    },
    body: JSON.stringify({
      transaction_details: { order_id: orderId, gross_amount: grossAmount },
      customer_details: { email: email || undefined },
    }),
  });
  const snapData = await resp.json();
  if (!resp.ok) {
    console.error('Gagal membuat transaksi Midtrans:', snapData);
    throw new functions.https.HttpsError('internal', 'Gagal membuat transaksi Midtrans.');
  }

  return { token: snapData.token, redirectUrl: snapData.redirect_url, orderId };
});

/**
 * 2b) LLK V2: Guru Admin membayar langganan lembaga / menambah slot Guru Mitra.
 *     Harga dihitung di server (orgPlans.js), bukan dari aplikasi.
 *     data: { orgId, action: 'subscribe', extra, period } | { orgId, action: 'addSlots', add }
 */
exports.createOrgTransaction = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Harus login dulu.');
  const uid = context.auth.uid;
  const orgId = String((data && data.orgId) || '');
  if (!orgId) throw new functions.https.HttpsError('invalid-argument', 'Lembaga tidak valid.');
  const [orgSnap, memSnap, slotsSnap] = await Promise.all([
    db.collection('orgs').doc(orgId).get(),
    db.collection('orgs').doc(orgId).collection('members').doc(uid).get(),
    db.collection('orgs').doc(orgId).collection('slots').get(),
  ]);
  if (!orgSnap.exists || !memSnap.exists || memSnap.data().role !== 'admin') {
    throw new functions.https.HttpsError('permission-denied', 'Hanya Guru Admin lembaga ini yang bisa membayar langganan.');
  }
  const o = orgSnap.data();
  const org = { ...o, activeUntilMs: o.activeUntil ? o.activeUntil.toMillis() : 0, createdAtMs: o.createdAt ? o.createdAt.toMillis() : Date.now() };
  const used = slotsSnap.size; // undangan + guru (Guru Admin yang ikut mengajar juga memakai slot)
  const now = Date.now();
  let order;
  if (data.action === 'subscribe') {
    const extra = data.extra, period = data.period;
    if (!Number.isInteger(extra) || extra < 0 || extra > OP.ORG_MAX_EXTRA || !OP.ORG_PERIODS[period]) {
      throw new functions.https.HttpsError('invalid-argument', 'Pilihan paket tidak valid.');
    }
    if (OP.ORG_BASE_SLOTS + extra < used) {
      throw new functions.https.HttpsError('failed-precondition', `Slot terpakai ${used} — pilih minimal ${used - OP.ORG_BASE_SLOTS} slot tambahan, atau keluarkan guru dulu.`);
    }
    if (OP.orgPaidActive(org, now) && OP.ORG_BASE_SLOTS + extra > (org.seats || 0)) {
      throw new functions.https.HttpsError('failed-precondition', 'Langganan masih aktif — tambah slot lewat tombol "Tambah Slot Guru".');
    }
    order = { action: 'subscribe', extra, period, grossAmount: OP.periodPrice(extra, period) };
  } else if (data.action === 'addSlots') {
    const add = data.add;
    if (!Number.isInteger(add) || add < 1 || (org.seats || 0) - OP.ORG_BASE_SLOTS + add > OP.ORG_MAX_EXTRA) {
      throw new functions.https.HttpsError('invalid-argument', 'Jumlah slot tidak valid.');
    }
    if (!OP.orgPaidActive(org, now)) {
      throw new functions.https.HttpsError('failed-precondition', 'Pilih paket langganan dulu (slot bisa dipilih di sana).');
    }
    const pr = OP.addSlotsPrice(org, add, now);
    order = { action: 'addSlots', add, period: pr.period, days: pr.days, grossAmount: pr.amount };
  } else {
    throw new functions.https.HttpsError('invalid-argument', 'Aksi tidak valid.');
  }
  if (order.grossAmount < 1000) throw new functions.https.HttpsError('invalid-argument', 'Nominal terlalu kecil.');

  const cfg = midtransCfg({ type: 'org' });
  const orderId = `LLKO-${orgId.slice(0, 8)}-${now}`;
  const email = context.auth.token.email || null;
  const label = OP.orderLabel(order);
  await db.collection('orders').doc(orderId).set({
    type: 'org', orgId, uid, email, ...order, label, env: cfg.env, status: 'pending',
    createdAt: admin.firestore.Timestamp.now(),
  });
  const resp = await fetch(`${cfg.snap}/snap/v1/transactions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: midtransAuthHeader(cfg.key) },
    body: JSON.stringify({
      transaction_details: { order_id: orderId, gross_amount: order.grossAmount },
      item_details: [{ id: order.action, price: order.grossAmount, quantity: 1, name: label.slice(0, 50) }],
      customer_details: { email: email || undefined },
    }),
  });
  const snapData = await resp.json();
  if (!resp.ok) {
    console.error('Gagal membuat transaksi Midtrans (V2):', snapData);
    throw new functions.https.HttpsError('internal', 'Gagal membuat transaksi Midtrans.');
  }
  return { token: snapData.token, redirectUrl: snapData.redirect_url, orderId, grossAmount: order.grossAmount, env: cfg.env };
});

// V2: order lunas → perbarui slot & masa aktif lembaga + catat di riwayat pembayaran lembaga
async function activateOrgOrder(orderId) {
  const orderRef = db.collection('orders').doc(orderId);
  const result = await db.runTransaction(async (tx) => {
    const orderSnap = await tx.get(orderRef);
    if (!orderSnap.exists) return { activated: false, notFound: true };
    const order = orderSnap.data();
    if (order.status === 'paid') return { activated: false, order };
    const orgRef = db.collection('orgs').doc(order.orgId);
    const orgSnap = await tx.get(orgRef);
    if (!orgSnap.exists) return { activated: false, order };
    const o = orgSnap.data();
    const now = Date.now();
    const next = OP.nextOrg({ ...o, activeUntilMs: o.activeUntil ? o.activeUntil.toMillis() : 0, createdAtMs: o.createdAt ? o.createdAt.toMillis() : now }, order, now);
    const until = admin.firestore.Timestamp.fromMillis(next.activeUntilMs);
    tx.update(orgRef, { seats: next.seats, plan: next.plan, period: next.period, activeUntil: until, lastOrderId: orderId, billingUpdatedAt: admin.firestore.Timestamp.now() });
    tx.set(orgRef.collection('invoices').doc(orderId), {
      action: order.action, extra: order.extra == null ? null : order.extra, add: order.add || null, period: order.period,
      amount: order.grossAmount, label: order.label || OP.orderLabel(order), seats: next.seats, activeUntil: until,
      paidAt: admin.firestore.Timestamp.fromMillis(now), by: order.uid,
    });
    tx.update(orderRef, { status: 'paid', paidAt: admin.firestore.Timestamp.fromMillis(now) });
    return { activated: true, order, paidAtMs: now, subscriptionEndsMs: next.activeUntilMs, orgName: o.name || '' };
  });
  if (result.activated) {
    await sendInvoiceEmail({
      toEmail: result.order.email, orderId, label: result.order.label, grossAmount: result.order.grossAmount,
      paidAtMs: result.paidAtMs, subscriptionEndsMs: result.subscriptionEndsMs, orgName: result.orgName, v2: true, env: midtransCfg(result.order).env,
    });
  }
  return result;
}

/**
 * Aktifkan/perpanjang langganan untuk 1 order yang SUDAH DIBAYAR.
 * Dijalankan dalam transaksi Firestore: kalau notifikasi Midtrans datang
 * dobel di saat bersamaan (atau webhook & pengecekan manual bersamaan),
 * hanya satu yang berhasil — masa aktif tidak bertambah dua kali.
 */
async function activateOrder(orderId) {
  const orderRef = db.collection('orders').doc(orderId);
  const pre = await orderRef.get();
  if (pre.exists && pre.data().type === 'org') return activateOrgOrder(orderId);
  const result = await db.runTransaction(async (tx) => {
    const orderSnap = await tx.get(orderRef);
    if (!orderSnap.exists) return { activated: false, notFound: true };
    const order = orderSnap.data();
    if (order.status === 'paid') return { activated: false, order };
    const subRef = db.collection('subscriptions').doc(order.uid);
    const subSnap = await tx.get(subRef);
    const now = Date.now();
    const cur = subSnap.exists ? subSnap.data() : null;
    const next = nextSubscription(
      cur && {
        status: cur.status,
        tier: cur.tier,
        subscriptionEndsMs: cur.subscriptionEndsAt ? cur.subscriptionEndsAt.toMillis() : 0,
      },
      order.plan,
      now
    );
    tx.set(
      subRef,
      {
        status: 'active',
        plan: order.plan,
        tier: next.tier,
        subscriptionEndsAt: admin.firestore.Timestamp.fromMillis(next.subscriptionEndsMs),
        lastOrderId: orderId,
        updatedAt: admin.firestore.Timestamp.now(),
      },
      { merge: true }
    );
    tx.update(orderRef, { status: 'paid', paidAt: admin.firestore.Timestamp.fromMillis(now) });
    return { activated: true, order, paidAtMs: now, subscriptionEndsMs: next.subscriptionEndsMs };
  });

  if (result.activated) {
    // Kirim invoice — kalau gagal, tidak mempengaruhi langganan yang sudah aktif
    const order = result.order;
    let toEmail = order.email;
    if (!toEmail) {
      // Jaga-jaga untuk order lama (sebelum field `email` ada) — ambil dari Firebase Auth
      try {
        const userRecord = await admin.auth().getUser(order.uid);
        toEmail = userRecord.email;
      } catch (e) {
        console.warn('Tidak bisa ambil email user untuk invoice:', order.uid);
      }
    }
    await sendInvoiceEmail({
      toEmail,
      orderId,
      plan: order.plan,
      label: order.label,
      grossAmount: order.grossAmount,
      paidAtMs: result.paidAtMs,
      subscriptionEndsMs: result.subscriptionEndsMs,
      env: midtransCfg(order).env,
    });
  }
  return result;
}

/**
 * 3) Endpoint HTTP yang didaftarkan sebagai "Payment Notification URL" di dashboard Midtrans.
 *    Ini yang benar-benar mengaktifkan/memperpanjang langganan setelah pembayaran sukses,
 *    DAN mengirim email invoice ke pembeli.
 */
exports.midtransWebhook = functions.https.onRequest(async (req, res) => {
  try {
    const { order_id, status_code, gross_amount, signature_key, transaction_status, fraud_status } = req.body;

    const sig = (key) => crypto.createHash('sha512').update(order_id + status_code + gross_amount + key).digest('hex');
    if (sig(MIDTRANS_SERVER_KEY) !== signature_key && sig(MIDTRANS_V2_SERVER_KEY) !== signature_key) {
      console.warn('Signature tidak cocok, notifikasi ditolak:', order_id);
      return res.status(403).send('Invalid signature');
    }

    const orderRef = db.collection('orders').doc(order_id);
    const orderSnap = await orderRef.get();
    if (!orderSnap.exists) {
      console.warn('Order tidak ditemukan:', order_id);
      return res.status(404).send('Order not found');
    }
    const order = orderSnap.data();
    // Kunci yang cocok harus kunci milik jenis order ini (V1 / V2)
    if (sig(midtransCfg(order).key) !== signature_key) {
      console.warn('Signature bukan dari kunci order ini, ditolak:', order_id);
      return res.status(403).send('Invalid signature');
    }
    if (Number(gross_amount) !== Number(order.grossAmount)) {
      console.warn('Nominal tidak cocok dengan order, diabaikan:', order_id, gross_amount, order.grossAmount);
      return res.status(400).send('Amount mismatch');
    }

    if (isPaidStatus(transaction_status, fraud_status)) {
      await activateOrder(order_id);
    } else if (['expire', 'cancel', 'deny'].includes(transaction_status) && order.status === 'pending') {
      await orderRef.update({ status: transaction_status });
    }

    res.status(200).send('OK');
  } catch (err) {
    console.error('Webhook error:', err);
    res.status(500).send('Error');
  }
});

/**
 * 4) Dipanggil dari app: "Sudah bayar tapi belum aktif?" — dan otomatis
 *    setelah jendela pembayaran ditutup. Menanyakan status order-order milik
 *    user yang masih 'pending' LANGSUNG ke Midtrans, lalu mengaktifkan yang
 *    sudah lunas. Cadangan kalau notifikasi webhook gagal/terlambat.
 */
exports.checkMidtransPayment = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Harus login dulu.');
  }
  const uid = context.auth.uid;
  const snap = await db.collection('orders')
    .where('uid', '==', uid)
    .where('status', '==', 'pending')
    .limit(10)
    .get();
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  let activated = 0;
  let checked = 0;
  for (const doc of snap.docs) {
    const order = doc.data();
    if (order.createdAt && order.createdAt.toMillis() < sevenDaysAgo) continue;
    checked++;
    const cfg = midtransCfg(order);
    const resp = await fetch(`${cfg.api}/v2/${encodeURIComponent(doc.id)}/status`, {
      headers: { Accept: 'application/json', Authorization: midtransAuthHeader(cfg.key) },
    });
    const st = await resp.json().catch(() => ({}));
    // Belum ada transaksi (pembeli belum memilih metode bayar) → lewati
    if (!st || !st.transaction_status || String(st.order_id) !== doc.id) continue;
    if (Number(st.gross_amount) !== Number(order.grossAmount)) {
      console.warn('Nominal status tidak cocok dengan order:', doc.id);
      continue;
    }
    if (isPaidStatus(st.transaction_status, st.fraud_status)) {
      const r = await activateOrder(doc.id);
      if (r.activated) activated++;
    } else if (['expire', 'cancel', 'deny'].includes(st.transaction_status)) {
      await doc.ref.update({ status: st.transaction_status });
    }
  }
  return { activated, checked };
});
