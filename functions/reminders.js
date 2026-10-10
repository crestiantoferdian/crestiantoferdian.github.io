/**
 * Pengingat sebelum langganan / uji coba LLK Lembaga (V2) berakhir:
 * H-3 dan H-1 (hitungan hari kalender WIB) → email ke pemilik lembaga + Telegram ke pemilik LLK.
 * Dijalankan tiap pagi oleh orgEndReminders (index.js). Tiap pengingat hanya sekali per tanggal
 * berakhir (dicatat di orgs/{id}.endReminders), jadi kalau diperpanjang, pengingat baru ikut berlaku.
 */
const WIB_MS = 7 * 60 * 60 * 1000, DAY_MS = 24 * 60 * 60 * 1000;
const wibDay = (ms) => Math.floor((ms + WIB_MS) / DAY_MS);
const toMs = (t) => (t && typeof t.toMillis === 'function' ? t.toMillis() : 0);

async function runOrgEndReminders({ db, getUser, N, OP, nowMs }) {
  const snap = await db.collection('orgs').get();
  let sent = 0;
  for (const d of snap.docs) {
    const o = d.data() || {};
    const createdAtMs = toMs(o.createdAt);
    if (!createdAtMs && !toMs(o.activeUntil)) continue;
    const endsMs = OP.orgEndsMs({ activeUntilMs: toMs(o.activeUntil), createdAtMs });
    const daysLeft = wibDay(endsMs) - wibDay(nowMs);
    if (daysLeft !== 3 && daysLeft !== 1) continue;
    const key = 'h' + daysLeft, done = o.endReminders || {};
    if (done[key] === endsMs) continue;
    let email = null, name = null;
    try { const u = await getUser(o.ownerUid); email = u.email || null; name = u.displayName || null; } catch (e) { console.warn('Pemilik lembaga tidak ditemukan:', o.ownerUid); }
    const info = { name, email, orgName: o.name || 'Lembaga', paid: o.plan === 'pro', daysLeft, endsMs };
    const mail = N.orgEndingEmail(info);
    await Promise.all([
      N.sendEmail({ to: email, subject: mail.subject, html: mail.html }),
      N.sendTelegram(N.tgOrgEnding(info)),
    ]);
    await d.ref.update({ endReminders: Object.assign({}, done, { [key]: endsMs }) });
    sent++;
  }
  return sent;
}

module.exports = { runOrgEndReminders, wibDay };
