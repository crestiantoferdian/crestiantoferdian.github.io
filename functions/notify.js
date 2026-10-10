/**
 * Notifikasi LLK (seperti Gitar Sakti): email ke pengguna + chat Telegram ke pemilik.
 *
 * Isi di functions/.env (JANGAN di-commit, JANGAN dikirim ke chat):
 *   Email — pilih SALAH SATU:
 *     RESEND_API_KEY=re_xxx               (sama seperti Gitar Sakti; domain pengirim diverifikasi di Resend)
 *     FROM_EMAIL="LesLesanKu <no-reply@leslesanku.com>"
 *   atau Gmail:
 *     SMTP_USER=alamat@gmail.com
 *     SMTP_PASS=app-password-16-huruf    (Google Account → Keamanan → Sandi Aplikasi)
 *   Telegram:
 *     TELEGRAM_BOT_TOKEN=123456:ABC...    (dari @BotFather; boleh bot yang sama dengan Gitar Sakti)
 *     TELEGRAM_CHAT_ID=123456789
 *
 * Kalau belum diisi, fungsi di sini diam saja (tidak pernah menggagalkan pembayaran / login).
 */
const env = (k) => String(process.env[k] || '').trim();
const SITE = 'https://leslesanku.com';
const LOGO = SITE + '/logo-leslesanku.png';

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const rupiah = (n) => 'Rp' + (Number(n) || 0).toLocaleString('id-ID');
const tanggal = (ms) => new Date(ms).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta' });
const jam = (ms) => new Date(ms).toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' }) + ' WIB';

// Jangan pernah menulis token/kunci ke log
function redact(msg) {
  let m = String(msg || '');
  ['TELEGRAM_BOT_TOKEN', 'RESEND_API_KEY', 'SMTP_PASS'].forEach((k) => { const v = env(k); if (v) m = m.split(v).join('***'); });
  return m;
}

let _smtp = null;
async function sendEmail({ to, subject, html }) {
  if (!to) return { skipped: 'no-recipient' };
  try {
    if (env('RESEND_API_KEY')) {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + env('RESEND_API_KEY'), 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: env('FROM_EMAIL') || 'LesLesanKu <onboarding@resend.dev>', to: [to], subject, html }),
      });
      if (!res.ok) { console.error('Resend menolak (' + res.status + '):', redact(await res.text())); return { error: res.status }; }
      return { ok: true, via: 'resend' };
    }
    if (env('SMTP_USER') && env('SMTP_PASS')) {
      if (!_smtp) _smtp = require('nodemailer').createTransport({ service: 'gmail', auth: { user: env('SMTP_USER'), pass: env('SMTP_PASS') } });
      await _smtp.sendMail({ from: '"LesLesanKu" <' + env('SMTP_USER') + '>', to, subject, html });
      return { ok: true, via: 'smtp' };
    }
    console.log('Lewati email (RESEND_API_KEY / SMTP belum diisi):', subject);
    return { skipped: 'not-configured' };
  } catch (e) {
    // Gagal kirim email TIDAK boleh menggagalkan login / pembayaran
    console.error('Gagal kirim email:', redact(e && e.message));
    return { error: true };
  }
}

async function sendTelegram(text) {
  const token = env('TELEGRAM_BOT_TOKEN'), chat = env('TELEGRAM_CHAT_ID');
  if (!token || !chat) { console.log('Lewati Telegram (TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID belum diisi)'); return { skipped: 'not-configured' }; }
  try {
    const res = await fetch('https://api.telegram.org/bot' + token + '/sendMessage', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chat, text, disable_web_page_preview: true }),
    });
    if (!res.ok) { console.error('Telegram menolak (' + res.status + '):', redact(await res.text())); return { error: res.status }; }
    return { ok: true };
  } catch (e) {
    console.error('Gagal kirim Telegram:', redact(e && e.message));
    return { error: true };
  }
}

// ── Template email ──────────────────────────────────────────────────
function shell(title, inner) {
  return `<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head><body style="margin:0;background:#f6f1e9;padding:24px 12px;font-family:Arial,Helvetica,sans-serif;color:#2b2420">
  <div style="max-width:520px;margin:0 auto;background:#fffcf7;border:1px solid #e4d9c9;border-radius:16px;overflow:hidden">
    <div style="padding:22px 24px 10px;text-align:center"><img src="${LOGO}" alt="LesLesanKu" width="180" style="max-width:60%;height:auto"/></div>
    <div style="padding:6px 24px 24px">
      <h2 style="font-family:Georgia,serif;font-weight:600;color:#a8372a;margin:8px 0 12px;font-size:22px">${esc(title)}</h2>
      ${inner}
    </div>
    <div style="background:#efe8dc;padding:14px 24px;font-size:12px;color:#6f6459;line-height:1.6">
      Email ini dikirim otomatis oleh LesLesanKu (${SITE.replace('https://', '')}). Mohon tidak membalas email ini.
    </div>
  </div></body></html>`;
}
const btn = (href, label) => `<p style="margin:18px 0 6px"><a href="${href}" style="display:inline-block;background:#a8372a;color:#fff;text-decoration:none;font-weight:bold;padding:12px 20px;border-radius:10px">${esc(label)}</a></p>`;
const row = (k, v, strong) => `<tr><td style="padding:6px 0;color:#6f6459">${esc(k)}</td><td style="padding:6px 0;text-align:right;${strong ? 'font-weight:bold' : ''}">${v}</td></tr>`;

function welcomeEmail({ name, trialDays, trialEndsMs, trialDenied }) {
  const first = String(name || '').split(' ')[0] || 'Bapak/Ibu Guru';
  return {
    subject: 'Selamat datang di LesLesanKu 🎉',
    html: shell('Terima kasih sudah bergabung, ' + first + '!', `
      <p style="line-height:1.6;margin:0 0 10px">Akun LesLesanKu kamu sudah aktif. Sekarang kamu bisa mencatat absensi, progres siswa, jadwal, dan tagihan les — semua tersimpan aman di akun Google-mu.</p>
      ${trialDenied ? '' : `<p style="line-height:1.6;margin:0 0 10px">🎁 Kamu mendapat <b>uji coba gratis ${trialDays} hari</b>${trialEndsMs ? ' (sampai <b>' + tanggal(trialEndsMs) + '</b>)' : ''}.</p>`}
      <p style="line-height:1.6;margin:0 0 4px">Langkah awal:</p>
      <ol style="line-height:1.7;margin:0 0 6px;padding-left:20px"><li>Tambahkan siswa pertamamu di menu <b>Siswa</b>.</li><li>Tandai kehadiran di menu <b>Absensi</b> & tulis progresnya.</li><li>Kirim progres & tagihan ke orang tua lewat WhatsApp.</li></ol>
      ${btn(SITE, 'Buka LesLesanKu')}`),
  };
}
function orgWelcomeEmail({ name, orgName, trialDays, trialEndsMs }) {
  const first = String(name || '').split(' ')[0] || 'Bapak/Ibu';
  return {
    subject: 'Lembaga ' + orgName + ' siap di LLK Lembaga 🎉',
    html: shell('Selamat, ' + first + '! Lembaga kamu sudah terdaftar', `
      <p style="line-height:1.6;margin:0 0 10px">Terima kasih sudah memakai <b>LLK Lembaga</b>. Lembaga <b>${esc(orgName)}</b> sudah aktif dengan <b>uji coba gratis ${trialDays} hari</b>${trialEndsMs ? ' (sampai <b>' + tanggal(trialEndsMs) + '</b>)' : ''} dan 2 slot Guru Mitra.</p>
      <ol style="line-height:1.7;margin:0 0 6px;padding-left:20px"><li>Undang guru di menu <b>Guru</b> (kode undangan / WhatsApp).</li><li>Tambahkan mata pelajaran & siswa di menu <b>Siswa</b>, atau impor dari LLK V1.</li><li>Bagi siswa ke guru, lalu pantau absensi, progres, tagihan & gaji guru.</li></ol>
      ${btn(SITE + '/v2/', 'Buka LLK Lembaga')}`),
  };
}
function invoiceEmail({ orderId, label, amount, paidAtMs, activeUntilMs, orgName, v2 }) {
  return {
    subject: 'Invoice ' + orderId + ' — Pembayaran berhasil',
    html: shell('Pembayaran berhasil, terima kasih!', `
      <p style="line-height:1.6;margin:0 0 12px">Pembayaran ${v2 ? 'langganan <b>LLK Lembaga</b>' + (orgName ? ' untuk <b>' + esc(orgName) + '</b>' : '') : 'langganan <b>LesLesanKu</b>'} sudah kami terima. Berikut invoice-nya:</p>
      <table style="width:100%;font-size:14px;border-collapse:collapse;border-top:1px solid #eee6da;border-bottom:1px solid #eee6da">
        ${row('No. Invoice', esc(orderId))}${row('Tanggal bayar', esc(jam(paidAtMs)))}${row('Paket', esc(label || '-'))}
        ${row('Aktif sampai', esc(activeUntilMs ? tanggal(activeUntilMs) : '-'))}${row('Status', '<span style="color:#1f5a38;font-weight:bold">LUNAS</span>')}
        ${row('Total', esc(rupiah(amount)), true)}
      </table>
      <p style="font-size:13px;color:#6f6459;line-height:1.6;margin:12px 0 0">Simpan email ini sebagai bukti pembayaran. Riwayat pembayaran juga bisa dilihat di aplikasi${v2 ? ' (Lainnya → Langganan Lembaga)' : ''}.</p>
      ${btn(v2 ? SITE + '/v2/' : SITE, v2 ? 'Buka LLK Lembaga' : 'Buka LesLesanKu')}`),
  };
}

function orgEndingEmail({ name, orgName, paid, daysLeft, endsMs }) {
  const first = String(name || '').split(' ')[0] || 'Bapak/Ibu';
  const what = paid ? 'Langganan LLK Lembaga' : 'Masa uji coba LLK Lembaga';
  const when = daysLeft === 1 ? 'besok' : daysLeft + ' hari lagi';
  return {
    subject: '⏳ ' + what + ' ' + orgName + ' berakhir ' + when,
    html: shell(what + ' berakhir ' + when, `
      <p style="line-height:1.6;margin:0 0 10px">Halo ${esc(first)}, ${paid ? 'langganan' : 'masa uji coba gratis'} untuk lembaga <b>${esc(orgName)}</b> berakhir pada <b>${esc(tanggal(endsMs))}</b>.</p>
      <p style="line-height:1.6;margin:0 0 10px">Setelah itu, Guru Mitra tidak bisa mengisi absensi dan siswa baru tidak bisa ditambahkan. Semua data tetap aman dan langsung aktif lagi begitu ${paid ? 'diperpanjang' : 'berlangganan'}.</p>
      ${btn(SITE + '/v2/', paid ? 'Perpanjang Sekarang' : 'Pilih Paket Langganan')}
      <p style="font-size:13px;color:#6f6459;line-height:1.6;margin:10px 0 0">Buka LLK Lembaga → <b>Lainnya</b> → <b>Langganan Lembaga</b>.</p>`),
  };
}

// ── Pesan Telegram untuk pemilik ────────────────────────────────────
const tgNewUser = ({ name, email, trialDenied, total }) =>
  `👤 Pengguna baru LesLesanKu\n\nNama: ${name || '-'}\nEmail: ${email || '-'}\n${trialDenied ? 'Uji coba: ditolak (email sudah pernah trial)' : 'Uji coba gratis dimulai'}${total ? '\nTotal pengguna: ' + total : ''}\nWaktu: ${jam(Date.now())}`;
const tgNewOrg = ({ orgName, name, email }) =>
  `🏫 Lembaga baru di LLK Lembaga\n\nLembaga: ${orgName}\nPemilik: ${name || '-'}\nEmail: ${email || '-'}\nUji coba 14 hari · 2 slot Guru Mitra\nWaktu: ${jam(Date.now())}`;
const tgPaid = ({ v2, orderId, email, label, amount, orgName, activeUntilMs, env: e }) =>
  `💰 Pembayaran berhasil${e === 'sandbox' ? ' (SANDBOX/uji coba)' : ''}!\n\n${v2 ? 'Produk: LLK Lembaga' + (orgName ? ' — ' + orgName : '') : 'Produk: LesLesanKu (V1)'}\nPaket: ${label || '-'}\nTotal: ${rupiah(amount)}\nPembeli: ${email || '-'}\nAktif sampai: ${activeUntilMs ? tanggal(activeUntilMs) : '-'}\nNo. Order: ${orderId}\nWaktu: ${jam(Date.now())}`;

const tgOrgEnding = ({ orgName, name, email, paid, daysLeft, endsMs }) =>
  `⏰ ${paid ? 'Langganan' : 'Uji coba'} lembaga berakhir ${daysLeft === 1 ? 'BESOK' : daysLeft + ' hari lagi'}\n\nLembaga: ${orgName}\nPemilik: ${name || '-'}\nEmail: ${email || '-'}\nBerakhir: ${tanggal(endsMs)}\n(Email pengingat sudah dikirim ke pemilik lembaga)`;

module.exports = { sendEmail, sendTelegram, welcomeEmail, orgWelcomeEmail, invoiceEmail, orgEndingEmail, tgNewUser, tgNewOrg, tgPaid, tgOrgEnding, redact };
