/**
 * Kirim pemasukan LLK ke aplikasi keuangan pemilik (Fercash).
 *
 * Dipanggil SEKALI per order, tepat setelah pembayaran MIDTRANS berhasil diaktifkan
 * (titik yang sama yang mengirim Telegram "💰 Pembayaran berhasil"; lihat index.js).
 *
 * ATURAN PENTING (jangan dilanggar saat menambah fitur baru):
 *  1. HANYA pembayaran Midtrans PRODUCTION (uang sungguhan). Sandbox tidak dikirim.
 *  2. HANYA pembayaran MIDTRANS. Pembelian lewat GOOGLE PLAY BILLING (nanti) JANGAN
 *     dikirim ke sini: Fercash mencatatnya dari laporan bulanan Google Play, jadi
 *     kalau dikirim juga akan tercatat DUA KALI.
 *  3. Kiriman ini TIDAK BOLEH menggagalkan pembayaran/aktivasi paket: semua kesalahan
 *     ditangkap, batas waktu 10 detik, cukup dicatat ke log.
 *
 * Kunci rahasia TIDAK ditulis di kode: diambil dari Firebase Secret Manager
 * (FERCASH_SECRET, didaftarkan di index.js lewat defineSecret).
 * Fercash aman menerima kiriman ulang: satu orderId hanya tercatat sekali.
 */
const FERCASH_URL = 'https://addtajuxfoxcaezmkice.supabase.co/functions/v1/fercash-terima-pemasukan';
const TIMEOUT_MS = 10000;

// Isi pesan untuk Fercash. produk: "v1" (order LLK-…) atau "lembaga" (order LLKO-…)
function fercashBody({ orderId, grossAmount, label, v2, env }) {
  return {
    orderId: String(orderId),
    nominal: Math.round(Number(grossAmount) || 0),
    produk: v2 ? 'lembaga' : 'v1',
    paket: label || '-',
    env: env === 'production' ? 'production' : 'sandbox',
    status: 'paid',
  };
}

/**
 * data: { orderId, grossAmount, label, v2, env }
 * opts: { secret, url?, timeoutMs? }
 * Hasil: { ok:true } | { skipped: '...' } | { error: ... } — TIDAK pernah melempar error.
 */
async function kirimPemasukan(data, opts = {}) {
  try {
    if (!data || data.env !== 'production') return { skipped: 'bukan-production' };
    const secret = String(opts.secret || '').trim();
    if (!secret) {
      console.warn('Lewati Fercash (FERCASH_SECRET belum diisi) untuk order', data.orderId);
      return { skipped: 'no-secret' };
    }
    const body = fercashBody(data);
    if (!(body.nominal > 0)) {
      console.error('Lewati Fercash: nominal tidak valid untuk order', body.orderId, data.grossAmount);
      return { skipped: 'nominal-tidak-valid' };
    }
    const res = await fetch(opts.url || FERCASH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-fercash-secret': secret },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(opts.timeoutMs || TIMEOUT_MS),
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      console.error('Fercash menolak (' + res.status + ') order ' + body.orderId + ':', String(txt).split(secret).join('***').slice(0, 300));
      return { error: res.status };
    }
    console.log('Fercash: pemasukan tercatat untuk order', body.orderId);
    return { ok: true };
  } catch (e) {
    const msg = String((e && e.message) || e).split(String(opts.secret || '') || '\u0000').join('***');
    console.error('Gagal kirim ke Fercash (order ' + (data && data.orderId) + '):', msg);
    return { error: true };
  }
}

module.exports = { FERCASH_URL, TIMEOUT_MS, fercashBody, kirimPemasukan };
