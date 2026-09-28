const functions = require('firebase-functions/v1');
const admin = require('firebase-admin');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

admin.initializeApp();
const db = admin.firestore();

// Diambil dari file functions/.env (lihat README untuk cara membuatnya)
const MIDTRANS_SERVER_KEY = process.env.MIDTRANS_SERVER_KEY;
const MIDTRANS_IS_PRODUCTION = process.env.MIDTRANS_IS_PRODUCTION === 'true';
const MIDTRANS_BASE_URL = MIDTRANS_IS_PRODUCTION
  ? 'https://app.midtrans.com'
  : 'https://app.sandbox.midtrans.com';

// Kredensial pengirim email invoice (Gmail + App Password, lihat README)
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;

const TRIAL_DAYS = 31;
const PRICES = { monthly: 40000, yearly: 400000 };
const PLAN_LABEL = { monthly: 'Pro Bulanan', yearly: 'Pro Tahunan' };
const DURATION_MS = {
  monthly: 30 * 24 * 60 * 60 * 1000,
  yearly: 365 * 24 * 60 * 60 * 1000,
};

function formatRupiah(n) {
  return 'Rp' + Number(n).toLocaleString('id-ID');
}
function formatTanggalID(ms) {
  return new Date(ms).toLocaleDateString('id-ID', {
    day: 'numeric', month: 'long', year: 'numeric',
  });
}

let _mailTransporter = null;
function getMailTransporter() {
  if (!SMTP_USER || !SMTP_PASS) return null;
  if (!_mailTransporter) {
    _mailTransporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });
  }
  return _mailTransporter;
}

/**
 * Kirim email invoice/struk pembayaran setelah langganan berhasil diaktifkan.
 * Dipanggil dari webhook Midtrans — kalau kredensial SMTP belum diisi di .env,
 * fungsi ini diam saja (tidak bikin webhook gagal), supaya fitur pembayaran
 * inti tetap jalan normal walau invoice belum di-setup.
 */
async function sendInvoiceEmail({ toEmail, orderId, plan, grossAmount, paidAtMs, subscriptionEndsMs }) {
  const transporter = getMailTransporter();
  if (!transporter || !toEmail) {
    console.log('Lewati kirim invoice (SMTP belum di-setup atau email kosong):', orderId);
    return;
  }
  const planLabel = PLAN_LABEL[plan] || plan;
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;border:1px solid #eee;border-radius:12px">
      <h2 style="color:#b31217;margin-bottom:4px">LesLesanKu</h2>
      <p style="color:#666;margin-top:0">Invoice Pembayaran</p>
      <hr style="border:none;border-top:1px solid #eee"/>
      <table style="width:100%;font-size:14px;color:#333;margin-top:12px">
        <tr><td style="padding:4px 0;color:#888">No. Invoice</td><td style="text-align:right">${orderId}</td></tr>
        <tr><td style="padding:4px 0;color:#888">Tanggal Bayar</td><td style="text-align:right">${formatTanggalID(paidAtMs)}</td></tr>
        <tr><td style="padding:4px 0;color:#888">Paket</td><td style="text-align:right">${planLabel}</td></tr>
        <tr><td style="padding:4px 0;color:#888">Jumlah</td><td style="text-align:right;font-weight:bold">${formatRupiah(grossAmount)}</td></tr>
        <tr><td style="padding:4px 0;color:#888">Status</td><td style="text-align:right;color:#1c9e4e;font-weight:bold">Lunas</td></tr>
        <tr><td style="padding:4px 0;color:#888">Aktif Sampai</td><td style="text-align:right">${formatTanggalID(subscriptionEndsMs)}</td></tr>
      </table>
      <hr style="border:none;border-top:1px solid #eee;margin-top:16px"/>
      <p style="font-size:12px;color:#999;margin-top:16px">
        Terima kasih sudah berlangganan LesLesanKu. Email ini dibuat otomatis, mohon tidak membalas ke alamat ini.
      </p>
    </div>`;
  try {
    await transporter.sendMail({
      from: '"LesLesanKu" <' + SMTP_USER + '>',
      to: toEmail,
      subject: `Invoice LesLesanKu — ${orderId}`,
      html,
    });
    console.log('Invoice terkirim ke', toEmail, orderId);
  } catch (err) {
    // Kegagalan kirim email TIDAK menggagalkan proses aktivasi langganan —
    // langganan tetap aktif walau emailnya gagal terkirim (misal SMTP down).
    console.error('Gagal kirim email invoice:', err);
  }
}

/**
 * 1) Dipanggil otomatis oleh Firebase saat ada akun baru (login Google pertama kali).
 *    Ini SATU-SATUNYA tempat trial dimulai -> tidak bisa direset dari client,
 *    karena terikat ke uid, bukan ke device/localStorage.
 */
exports.onUserCreate = functions.auth.user().onCreate(async (user) => {
  const now = admin.firestore.Timestamp.now();
  const trialEnds = admin.firestore.Timestamp.fromMillis(
    now.toMillis() + TRIAL_DAYS * 24 * 60 * 60 * 1000
  );
  await db.collection('subscriptions').doc(user.uid).set({
    status: 'trial',
    trialStartedAt: now,
    trialEndsAt: trialEnds,
    subscriptionEndsAt: null,
    plan: null,
    createdAt: now,
  });
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
  const plan = data.plan; // 'monthly' | 'yearly'
  if (!PRICES[plan]) {
    throw new functions.https.HttpsError('invalid-argument', 'Plan tidak valid.');
  }

  const orderId = `LLK-${uid.slice(0, 8)}-${Date.now()}`;
  const grossAmount = PRICES[plan];
  const email = context.auth.token.email || null; // disimpan supaya webhook nanti tahu ke mana kirim invoice

  await db.collection('orders').doc(orderId).set({
    uid,
    plan,
    grossAmount,
    email,
    status: 'pending',
    createdAt: admin.firestore.Timestamp.now(),
  });

  const resp = await fetch(`${MIDTRANS_BASE_URL}/snap/v1/transactions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Basic ' + Buffer.from(MIDTRANS_SERVER_KEY + ':').toString('base64'),
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
 * 3) Endpoint HTTP yang didaftarkan sebagai "Payment Notification URL" di dashboard Midtrans.
 *    Ini yang benar-benar mengaktifkan/memperpanjang langganan setelah pembayaran sukses,
 *    DAN mengirim email invoice ke pembeli.
 */
exports.midtransWebhook = functions.https.onRequest(async (req, res) => {
  try {
    const { order_id, status_code, gross_amount, signature_key, transaction_status, fraud_status } = req.body;

    const expected = crypto
      .createHash('sha512')
      .update(order_id + status_code + gross_amount + MIDTRANS_SERVER_KEY)
      .digest('hex');
    if (expected !== signature_key) {
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

    const isSuccess =
      (transaction_status === 'capture' && fraud_status === 'accept') ||
      transaction_status === 'settlement';

    if (isSuccess && order.status !== 'paid') {
      const subRef = db.collection('subscriptions').doc(order.uid);
      const subSnap = await subRef.get();
      const now = Date.now();
      const currentEnds =
        subSnap.exists && subSnap.data().subscriptionEndsAt
          ? subSnap.data().subscriptionEndsAt.toMillis()
          : now;
      const base = Math.max(currentEnds, now);
      const newEnds = admin.firestore.Timestamp.fromMillis(base + DURATION_MS[order.plan]);

      await subRef.set(
        {
          status: 'active',
          plan: order.plan,
          subscriptionEndsAt: newEnds,
          lastOrderId: order_id,
          updatedAt: admin.firestore.Timestamp.now(),
        },
        { merge: true }
      );
      await orderRef.update({ status: 'paid' });

      // Kirim invoice — kalau gagal, tidak mempengaruhi status pembayaran yang sudah aktif di atas
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
        orderId: order_id,
        plan: order.plan,
        grossAmount: order.grossAmount,
        paidAtMs: now,
        subscriptionEndsMs: newEnds.toMillis(),
      });
    } else if (['expire', 'cancel', 'deny'].includes(transaction_status)) {
      await orderRef.update({ status: transaction_status });
    }

    res.status(200).send('OK');
  } catch (err) {
    console.error('Webhook error:', err);
    res.status(500).send('Error');
  }
});
