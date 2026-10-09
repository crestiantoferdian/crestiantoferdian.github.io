// ══════════════════════════════════════════════════════════════════════
// LesLesanKu V2 — tampilan GURU MITRA (Tahap 3)
// Tampilan sengaja SAMA dengan LLK V1 (CSS & ikon disalin dari index.html,
// lihat tools/sync-v1-to-v2.py). Data dari lembaga:
//   orgs/{org}/sched/{classId}  kelas yang ditugaskan (tanpa No HP & tarif)
//   orgs/{org}/att/{classId_YYYY-MM-DD}  absensi: Mitra Hadir/Alpa di HARI
//   yang sama; Izin/Off/koreksi oleh Admin. Dijaga firestore.rules.
// ══════════════════════════════════════════════════════════════════════
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import { getAuth, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import { getFirestore, connectFirestoreEmulator, doc, getDoc, getDocs, setDoc, deleteDoc, updateDoc, writeBatch, collection, query, where, serverTimestamp }
  from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { ICONS, LLK_SUBJECT_ICON } from './v1-shared.js';
import { renderSlipCanvas, canvasToBlob, slipNo, fmtKey, slipPdfBlob } from './slip.js';
import { orgEndsMs } from './billing.js';

const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyAvD4ABTYIjCtPCYzUaRM8AHsjiOamHQLU',
  authDomain: 'leslesanku.com',
  projectId: 'llk-67a30',
  storageBucket: 'llk-67a30.firebasestorage.app',
  messagingSenderId: '894092774293',
  appId: '1:894092774293:web:8c66654aada5b42bf5c49c'
};
const TEST = window.__LLK_TEST__ || null;
const app = initializeApp(FIREBASE_CONFIG);
const db = getFirestore(app);
const auth = TEST ? null : getAuth(app);
if (TEST) connectFirestoreEmulator(db, TEST.host, TEST.port, { mockUserToken: { sub: TEST.user.uid, email: TEST.user.email, email_verified: true } });

const DAYS = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
const DAY_SHORT_JS = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
const MONTH_SHORT_ID = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const MONTH_ID = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

// ── State ──
const G = { user: null, org: null, member: null, sched: [], att: {}, tab: 'absensi', date: '', profile: null, trackPeriod: 'bulan', trackSearch: '', siswaSearch: '' };

// ── Util (sama dengan V1) ──
const $ = (id) => document.getElementById(id);
const pad = (n) => String(n).padStart(2, '0');
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function dk(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function todayStr() { return dk(new Date()); }
function dayNameOf(key) { return DAYS[(new Date(key + 'T00:00:00').getDay() + 6) % 7]; }
function fmtLong(key) { return new Date(key + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }); }
function fmtPretty(key) { return new Date(key + 'T00:00:00').toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }); }
function rupiah(n) { return 'Rp ' + Math.round(n || 0).toLocaleString('id-ID'); }
function I(name, cls) { return '<svg class="ico' + (cls ? ' ' + cls : '') + '" aria-hidden="true" focusable="false"><use href="#i-' + name + '"/></svg>'; }
function ill(name) { return '<svg class="llk-ill" viewBox="0 0 160 120" aria-hidden="true" focusable="false"><use href="#ill-' + name + '"/></svg>'; }
let toastT;
function toast(msg, ms) {
  const el = $('toast'), raw = String(msg == null ? '' : msg);
  const kind = /^(✅|🎉)/.test(raw) ? 'ok' : /^❌/.test(raw) ? 'err' : /^⚠️/.test(raw) ? 'warn' : 'info';
  el.className = 'show is-' + kind;
  el.innerHTML = '<span class="llk-toast-ic">' + I({ ok: 'check', err: 'x', warn: 'alert', info: 'info' }[kind]) + '</span><span></span>';
  el.lastChild.textContent = raw.replace(/^(✅|🎉|❌|⚠️)\s*/, '');
  clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('show'), ms || 2800);
}
function friendlyError(e) {
  const c = (e && e.code) || '';
  if (c.includes('permission-denied')) return 'Ditolak server. Absensi hanya bisa diisi/diubah di hari les itu; selebihnya minta tolong Guru Admin.';
  if (c.includes('unavailable') || !navigator.onLine) return 'Tidak ada koneksi internet.';
  return (e && e.message) || 'Terjadi kesalahan.';
}

// ── Ikon mata pelajaran (logika sama dengan V1: getInstrumentIcon + llkSubjectIcon) ──
function getInstrumentIcon(instrument) {
  if (!instrument) return '🎵';
  if (ICONS[instrument]) return ICONS[instrument];
  const lower = instrument.toLowerCase().trim();
  const keys = Object.keys(ICONS).filter(k => k !== 'Bahasa');
  const exact = keys.find(k => k.toLowerCase() === lower);
  if (exact) return ICONS[exact];
  const part = keys.filter(k => lower.includes(k.toLowerCase()) || k.toLowerCase().includes(lower));
  if (part.length) { part.sort((a, b) => b.length - a.length); return ICONS[part[0]]; }
  if (lower.includes('bahasa') || lower.includes('language')) return '🌐';
  return '🎵';
}
function subjectHue(n) {
  const k = { piano: 1, drum: 4, guitar: 7, mic: 12, violin: 15, music: 18, math: 0, microscope: 2, atom: 3, flask: 5, dna: 6, globe: 8, scroll: 9, chart: 10, laptop: 11, 'book-open': 13, pencil: 14, scale: 16, lang: 17, users: 19 }[n];
  return (k === undefined ? 18 : k) * 18;
}
function subjectStyle(n) {
  const h = subjectHue(n), odd = (h / 18) % 2 === 1;
  if (document.documentElement.getAttribute('data-theme') === 'dark')
    return odd ? `background:hsl(${h},32%,26%);color:hsl(${h},70%,80%)` : `background:hsl(${h},26%,20%);color:hsl(${h},62%,74%)`;
  return odd ? `background:hsl(${h},56%,83%);color:hsl(${h},58%,24%)` : `background:hsl(${h},48%,91%);color:hsl(${h},52%,30%)`;
}
function subjectIcon(instrument) {
  const e = getInstrumentIcon(instrument);
  let n = LLK_SUBJECT_ICON[e];
  if (!n && /\uD83C[\uDDE6-\uDDFF]/.test(e)) n = 'lang';
  if (!n && e && e.indexOf('‍') >= 0) n = 'users';
  n = n || 'music';
  if (document.documentElement.getAttribute('data-theme') === 'happy') return `<span class="llk-subj llk-subj-emo" style="${subjectStyle(n)}">${esc(e || '🎵')}</span>`;
  return `<span class="llk-subj" style="${subjectStyle(n)}">${I(n)}</span>`;
}
const isVokal = (s) => String(s || '').toLowerCase().includes('vok');

// ── Header (jam & tanggal seperti V1) ──
function updateClock() {
  const n = new Date();
  $('clockEl').textContent = `${pad(n.getHours())}:${pad(n.getMinutes())}`;
  $('dateEl').textContent = n.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' });
}
updateClock(); setInterval(updateClock, 10000);
function paintHeader() {
  $('schoolName').textContent = G.org.name;
  $('schoolSub').textContent = G.member.name + ' · Guru Mitra';
  const el = $('schoolLogo');
  if (G.org.logo) el.innerHTML = `<img src="${esc(G.org.logo)}" style="width:100%;height:100%;object-fit:cover;border-radius:11px;" alt="logo">`;
  else el.textContent = String(G.org.logoText || '').trim() || String(G.org.name || 'LLK').trim().split(/\s+/).slice(0, 2).map(w => w[0] || '').join('').toUpperCase();
  // Warna lembaga (diatur Guru Admin di Lainnya → Profil & Tampilan)
  const c = String(G.org.color || ''), st = document.documentElement.style;
  if (/^#[0-9a-fA-F]{6}$/.test(c)) {
    const n = parseInt(c.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255, d = x => Math.round(x * 0.75).toString(16).padStart(2, '0');
    st.setProperty('--red', c); st.setProperty('--red2', '#' + d(r) + d(g) + d(b)); st.setProperty('--red-glow', `rgba(${r},${g},${b},0.25)`);
  }
}

// ══════════════════════════════════════════════════════════════════════
// DATA
// ══════════════════════════════════════════════════════════════════════
async function loadData() {
  const o = G.org.id, u = G.user.uid;
  const [sc, at, po] = await Promise.all([
    getDocs(query(collection(db, 'orgs', o, 'sched'), where('mitraUid', '==', u))),
    getDocs(query(collection(db, 'orgs', o, 'att'), where('mitraUid', '==', u))),
    getDocs(query(collection(db, 'orgs', o, 'payouts'), where('mitraUid', '==', u))).catch(() => ({ docs: [] })),
  ]);
  G.payouts = po.docs.map(d => Object.assign({ id: d.id }, d.data())).sort((a, b) => b.paidDate.localeCompare(a.paidDate));
  G.sched = sc.docs.map(d => Object.assign({ id: d.id }, d.data()));
  G.att = {}; at.docs.forEach(d => { G.att[d.id] = Object.assign({ id: d.id }, d.data()); });
}
// Sesi pada tanggal tertentu: dari jadwal kelas aktif + absensi yang sudah tercatat
// (supaya riwayat tetap tampil walau kelasnya sudah dipindah/nonaktif).
function sessionsOn(key) {
  const day = dayNameOf(key), out = [], seen = new Set();
  G.sched.filter(c => c.active).forEach(c => (c.schedule || []).filter(x => x.day === day).forEach(x => {
    const id = c.id + '_' + key; if (seen.has(id)) return; seen.add(id);
    out.push({ id, classId: c.id, studentId: c.studentId, name: c.studentName, subject: c.subjectName, start: x.start, end: x.end, rec: G.att[id] || null });
  }));
  Object.values(G.att).filter(a => a.date === key && !seen.has(a.id)).forEach(a => {
    seen.add(a.id); out.push({ id: a.id, classId: a.classId, studentId: a.studentId, name: a.studentName, subject: a.subjectName, start: a.start, end: a.end, rec: a, orphan: true });
  });
  return out.sort((a, b) => String(a.start).localeCompare(String(b.start)) || a.name.localeCompare(b.name));
}
function statusOf(s) { return (s.rec && s.rec.status) || 'belum'; }

// ══════════════════════════════════════════════════════════════════════
// NAVIGASI
// ══════════════════════════════════════════════════════════════════════
function setTab(t) {
  G.tab = t; G.profile = null;
  document.querySelectorAll('.bottom-nav .bnav').forEach(b => b.classList.toggle('active', b.dataset.tab === t));
  render(); window.scrollTo(0, 0);
}
function render() {
  if (G.profile) return renderProfile();
  if (G.tab === 'siswa') return renderSiswa();
  if (G.tab === 'track') return renderTrack();
  if (G.tab === 'honor') return renderHonor();
  if (G.tab === 'lainnya') return renderLainnya();
  return renderAbsensi();
}
document.querySelectorAll('.bottom-nav .bnav').forEach(b => b.onclick = () => setTab(b.dataset.tab));

// ══════════════════════════════════════════════════════════════════════
// ABSENSI — markup sama dengan renderAbsensi() V1
// ══════════════════════════════════════════════════════════════════════
function relDayLabel(key) {
  const diff = Math.round((new Date(key + 'T00:00:00') - new Date(todayStr() + 'T00:00:00')) / 864e5);
  if (diff === 0) return 'Hari ini'; if (diff === -1) return 'Kemarin'; if (diff === 1) return 'Besok';
  return diff < 0 ? (-diff) + ' hari lalu' : diff + ' hari lagi';
}
function dayBarHtml() {
  const today = todayStr(), sel = G.date || today, base = new Date(today + 'T00:00:00');
  let pills = '';
  for (let i = -7; i <= 6; i++) {
    const d = new Date(base); d.setDate(d.getDate() + i);
    const key = dk(d), showMonth = i === -7 || d.getDate() === 1;
    pills += `<button class="day-pill date-pill${key === sel ? ' active' : ''}${key === today && key !== sel ? ' today' : ''}${key < today ? ' past' : ''}" data-date="${key}">`
      + `<span class="dp-d">${key === today ? 'Hari ini' : DAY_SHORT_JS[d.getDay()]}</span><span class="dp-n">${d.getDate()}${showMonth ? ' ' + MONTH_SHORT_ID[d.getMonth()] : ''}</span></button>`;
  }
  return '<div class="day-scroll" id="dayBar">' + pills + '</div>';
}
function centerDayBar() {
  setTimeout(() => { const bar = $('dayBar'), a = bar && bar.querySelector('.day-pill.active'); if (bar && a) bar.scrollLeft = a.offsetLeft - bar.offsetWidth / 2 + a.offsetWidth / 2; }, 50);
}
// Langganan lembaga habis → absensi dikunci (aturan server juga menolak)
function orgActive() {
  const ms = t => (t && t.toMillis ? t.toMillis() : 0), o = G.org || {};
  return orgEndsMs({ activeUntilMs: ms(o.activeUntil), createdAtMs: ms(o.createdAt) || Date.now() }) > Date.now();
}
function renderAbsensi() {
  const today = todayStr(), key = G.date || today, isToday = key === today, isPast = key < today;
  const list = sessionsOn(key);
  const cnt = st => list.filter(s => statusOf(s) === st).length;
  const hadirC = cnt('hadir'), izinC = cnt('izin'), alpaC = cnt('alpa'), offC = cnt('off'), belumC = list.length - hadirC - izinC - alpaC - offC;
  const cards = list.length ? list.map(s => cardHtml(s, key, isToday, isPast)).join('')
    : `<div class="empty">${ill(isPast ? 'calendar' : 'notebook')}<div class="empty-t">Tidak ada jadwal ${isPast ? 'di tanggal ini' : 'hari ' + dayNameOf(key)}</div><div class="empty-d">Pilih tanggal lain di atas. Jadwal murid diatur oleh Guru Admin.</div></div>`;
  $('mainContent').innerHTML =
    `<div class="page-title-area"><div class="page-title">Absensi Harian</div><div class="page-sub">Tandai siswa yang hadir. Catat progress di setiap pertemuan.</div></div>`
    + (orgActive() ? '' : `<div id="subOff" style="display:flex;gap:8px;align-items:flex-start;margin:0 0 12px;padding:12px 14px;border-radius:14px;font-size:0.86rem;line-height:1.5;background:var(--alpa-bg);color:var(--alpa-text)">${I('lock')}<div><b>Langganan ${esc(G.org.name)} sudah berakhir.</b> Absensi dikunci sementara — minta Guru Admin memperpanjang. Data tetap aman.</div></div>`)
    + dayBarHtml()
    + `<div class="stats-row"${offC ? ' style="grid-template-columns:repeat(5,1fr)"' : ''}>
      <div class="stat-card s-hadir"><div class="stat-label">Hadir</div><div class="stat-num">${hadirC}</div></div>
      <div class="stat-card s-izin"><div class="stat-label">Izin</div><div class="stat-num">${izinC}</div></div>
      <div class="stat-card s-alpa"><div class="stat-label">Alpa</div><div class="stat-num">${alpaC}</div></div>
      ${offC ? `<div class="stat-card s-off"><div class="stat-label">Off</div><div class="stat-num">${offC}</div></div>` : ''}
      <div class="stat-card"><div class="stat-label">Belum</div><div class="stat-num" style="color:var(--text2)">${belumC}</div></div>
    </div>
    <div class="list-wrap">
      <div class="list-header"><div>
        <div class="list-title">${dayNameOf(key)} — ${relDayLabel(key)}</div>
        <div style="font-size:0.8rem;color:var(--muted);margin-top:2px;font-weight:500">${fmtLong(key)}</div>
      </div></div>
      ${cards}
    </div>`;
  $('mainContent').querySelectorAll('[data-date]').forEach(b => b.onclick = () => { G.date = b.dataset.date === today ? '' : b.dataset.date; renderAbsensi(); });
  $('mainContent').querySelectorAll('.s-item').forEach(el => el.onclick = () => {
    const was = el.classList.contains('expanded');
    document.querySelectorAll('.s-item.expanded').forEach(e => e.classList.remove('expanded'));
    el.classList.toggle('expanded', !was);
  });
  $('mainContent').querySelectorAll('.s-name[data-stu]').forEach(el => el.onclick = (e) => { e.stopPropagation(); openProfile(el.dataset.stu); });
  $('mainContent').querySelectorAll('[data-att]').forEach(b => b.onclick = (e) => { e.stopPropagation(); openNote(b.dataset.sess, b.dataset.att, key); });
  centerDayBar();
}
function cardHtml(s, key, isToday, isPast) {
  const status = statusOf(s), r = s.rec || {};
  const isIzin = status === 'izin', isAlpa = status === 'alpa', isOff = status === 'off', isHadir = status === 'hadir';
  const badge = isIzin ? `<span class="llk-av-badge" style="background:var(--izin-solid)">${I('minus')}</span>`
    : isAlpa ? `<span class="llk-av-badge" style="background:var(--alpa-solid)">${I('x')}</span>`
    : isOff ? `<span class="llk-av-badge" style="background:var(--off-solid)">${I('pause')}</span>`
    : isHadir ? `<span class="llk-av-badge" style="background:var(--hadir-solid)">${I('check')}</span>` : '';
  const dim = isIzin || isAlpa || isOff;
  const timeColor = isIzin ? 'var(--izin)' : isAlpa ? 'var(--alpa)' : isOff ? 'var(--off)' : isHadir ? 'var(--hadir)' : 'var(--text)';
  const infoRow = isIzin ? `<div style="font-size:0.8rem;color:var(--izin);font-weight:600;margin-top:3px;display:flex;align-items:center;gap:5px">${I('hand', 'sm')} Izin${r.reason ? ' · <span style="font-weight:400;color:var(--text2)">' + esc(r.reason) + '</span>' : ''}</div>`
    : isAlpa ? `<div style="font-size:0.8rem;color:var(--alpa);font-weight:600;margin-top:3px;display:flex;align-items:center;gap:5px">${I('x-circle', 'sm')} Alpa${r.reason ? ' · <span style="font-weight:400;color:var(--text2)">' + esc(r.reason) + '</span>' : ''}</div>`
    : isOff ? `<div style="font-size:0.8rem;color:var(--off);font-weight:600;margin-top:3px;display:flex;align-items:center;gap:5px">${I('pause', 'sm')} Off · Guru izin${r.reason ? ' · <span style="font-weight:400;color:var(--text2)">' + esc(r.reason) + '</span>' : ''}</div>` : '';
  // Tombol: Hadir & Alpa hanya di hari les itu. Izin/Off diisi lewat aplikasi Admin.
  let btns;
  if (isIzin || isOff) btns = `<div class="llk-lock">${I('lock', 'sm')} ${isIzin ? 'Izin' : 'Off'} diisi oleh Guru Admin</div>`;
  else if (isToday) btns = `<button class="att-btn a-hadir ${isHadir ? 'on' : ''}" data-att="hadir" data-sess="${esc(s.id)}" aria-label="Hadir" title="Hadir">${I('check', 'bold')}</button>
      <button class="att-btn a-alpa ${isAlpa ? 'on' : ''}" data-att="alpa" data-sess="${esc(s.id)}" aria-label="Alpa" title="Alpa">${I('x', 'bold')}</button>`;
  else btns = `<div class="llk-lock">${I('lock', 'sm')} ${isPast ? 'Sudah lewat hari — untuk mengubah, minta tolong Guru Admin' : 'Bisa diisi pada hari les'}</div>`;
  return `<div class="s-item status-${status}" style="cursor:pointer">
    <div class="s-avatar ${isVokal(s.subject) ? 'vocal' : ''}" style="${dim ? 'opacity:0.5;' : ''}">${subjectIcon(s.subject)}${badge}</div>
    <div class="s-body">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:4px">
        <div class="s-name" data-stu="${esc(s.studentId)}" style="cursor:pointer;text-decoration:underline;text-underline-offset:4px;text-decoration-thickness:1px;text-decoration-color:var(--border);flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;${dim ? 'color:var(--muted);' : ''}">${esc(s.name)}</div>
        <div class="s-time-row" style="margin-top:0;flex-shrink:0;text-align:right"><span style="color:${timeColor}${dim ? ';text-decoration:line-through' : ''};font-size:${status === 'belum' ? '1.05rem' : '1rem'};font-weight:700">${esc(s.start)}${s.end ? '–' + esc(s.end) : ''}</span></div>
      </div>
      ${infoRow}
      <div class="s-pills" style="margin-top:${dim ? 2 : 5}px"></div>
      ${r.progress ? `<div class="s-note-preview">${I('note')}<span>${esc(r.progress)}</span></div>` : ''}
      ${r.prSiswa ? `<div class="s-note-preview" style="color:var(--plum)">${I('book')}<span>PR: ${esc(r.prSiswa)}</span></div>` : ''}
      ${r.prGuru ? `<div class="s-note-preview" style="color:var(--blue)">${I('tasks')}<span>PR Guru: ${esc(r.prGuru)}</span></div>` : ''}
      <div class="att-btns">${btns}</div>
    </div>
  </div>`;
}

// ── Modal Catat Kehadiran ──
let N = null;
function openNote(sessId, status, key) {
  const s = sessionsOn(key).find(x => x.id === sessId); if (!s) return;
  if (!orgActive()) { toast('🔒 Langganan lembaga berakhir — minta Guru Admin memperpanjang'); return; }
  N = { s, key };
  const r = s.rec || {};
  $('noteTitle').textContent = status === 'hadir' ? 'Catat Kehadiran' : status === 'izin' ? 'Tandai Izin' : 'Tandai Alpa';
  $('noteSub').textContent = s.name + ' · ' + s.subject + ' · ' + s.start + (s.end ? '–' + s.end : '') + ' · ' + fmtLong(key);
  $('noteMsg').innerHTML = '';
  $('noteStatus').value = status;
  $('noteReason').value = r.reason || '';
  $('noteProgress').value = r.progress || '';
  $('notePrSiswa').value = r.prSiswa || '';
  $('notePrGuru').value = r.prGuru || '';
  $('noteDelBtn').style.display = s.rec ? '' : 'none';
  syncNoteFields();
  $('noteOverlay').classList.add('open');
  setTimeout(() => { const f = status === 'hadir' ? $('noteProgress') : $('noteReason'); if (f) f.focus(); }, 250);
}
function syncNoteFields() {
  const h = $('noteStatus').value === 'hadir';
  $('noteProgressWrap').style.display = h ? '' : 'none';
  $('notePrSiswaWrap').style.display = h ? '' : 'none';
  $('notePrGuruWrap').style.display = h ? '' : 'none';
  $('noteReasonWrap').style.display = h ? 'none' : '';
}
$('noteStatus').onchange = syncNoteFields;
function closeNote() { $('noteOverlay').classList.remove('open'); N = null; }
$('noteCancelBtn').onclick = closeNote;
$('noteOverlay').addEventListener('click', e => { if (e.target === $('noteOverlay')) closeNote(); });
$('noteSaveBtn').onclick = async () => {
  if (!N) return;
  const st = $('noteStatus').value, progress = $('noteProgress').value.trim();
  if (st === 'hadir' && !progress) { $('noteMsg').innerHTML = '<div class="llk-callout danger" style="margin-bottom:12px">' + I('alert') + '<div>Progres wajib diisi saat murid Hadir.</div></div>'; $('noteProgress').focus(); return; }
  const btn = $('noteSaveBtn'); btn.disabled = true;
  try {
    // Honor diambil ulang dari server (bisa saja baru diubah Guru Admin)
    const mem = await getDoc(doc(db, 'orgs', G.org.id, 'members', G.user.uid));
    const honor = mem.exists() ? (mem.data().honor || 0) : 0;
    const s = N.s, data = {
      classId: s.classId, studentId: s.studentId || '', studentName: s.name, subjectName: s.subject || '', mitraUid: G.user.uid,
      date: N.key, start: s.start || '', end: s.end || '', status: st,
      progress: st === 'hadir' ? progress : '', prSiswa: st === 'hadir' ? $('notePrSiswa').value.trim() : '', prGuru: st === 'hadir' ? $('notePrGuru').value.trim() : '',
      reason: st === 'hadir' ? '' : $('noteReason').value.trim(), honor, by: G.user.uid, updatedAt: serverTimestamp()
    };
    await setDoc(doc(db, 'orgs', G.org.id, 'att', s.id), data);
    G.att[s.id] = Object.assign({ id: s.id }, data);
    G.member.honor = honor;
    const name = s.name; closeNote(); render();
    toast('✅ ' + name + ' — ' + st);
  } catch (e) { console.error(e); $('noteMsg').innerHTML = '<div class="llk-callout danger" style="margin-bottom:12px">' + I('alert') + '<div>' + esc(friendlyError(e)) + '</div></div>'; }
  finally { btn.disabled = false; }
};
$('noteDelBtn').onclick = async () => {
  if (!N || !N.s.rec) return;
  try {
    await deleteDoc(doc(db, 'orgs', G.org.id, 'att', N.s.id));
    delete G.att[N.s.id]; const name = N.s.name; closeNote(); render(); toast('Tanda ' + name + ' dihapus');
  } catch (e) { $('noteMsg').innerHTML = '<div class="llk-callout danger" style="margin-bottom:12px">' + I('alert') + '<div>' + esc(friendlyError(e)) + '</div></div>'; }
};

// ══════════════════════════════════════════════════════════════════════
// SISWA (murid yang ditugaskan) & PROFIL
// ══════════════════════════════════════════════════════════════════════
function myStudents() {
  const m = new Map();
  G.sched.forEach(c => {
    const k = c.studentId;
    if (!m.has(k)) m.set(k, { id: k, name: c.studentName, classes: [], active: false });
    const x = m.get(k); x.classes.push(c); if (c.active) x.active = true; x.name = c.studentName;
  });
  // Murid lama yang kelasnya sudah tidak ditugaskan, tapi punya riwayat
  Object.values(G.att).forEach(a => { if (!m.has(a.studentId)) m.set(a.studentId, { id: a.studentId, name: a.studentName, classes: [], active: false, subjectOnly: a.subjectName }); });
  // Murid nonaktif tanpa riwayat dengan guru ini tidak perlu ditampilkan
  const hasAtt = new Set(Object.values(G.att).map(a => a.studentId));
  return Array.from(m.values()).filter(x => x.active || hasAtt.has(x.id)).sort((a, b) => a.name.localeCompare(b.name));
}
const subjOfStu = (x) => x.classes.length ? Array.from(new Set(x.classes.map(c => c.subjectName))).join(', ') : (x.subjectOnly || '');
const jadwalOfStu = (x) => x.classes.filter(c => c.active).flatMap(c => (c.schedule || []).map(s => s.day + ' ' + s.start + (s.end ? '–' + s.end : ''))).join(' & ');
function renderSiswa() {
  const q = G.siswaSearch.toLowerCase();
  const all = myStudents(), act = all.filter(x => x.active), inact = all.filter(x => !x.active);
  const card = (x) => `<div class="siswa-card" style="background:${x.active ? 'var(--card)' : 'var(--card2)'};border:1px ${x.active ? 'solid' : 'dashed'} var(--border);border-radius:var(--r-lg);padding:14px 16px;margin-bottom:10px">
      <div style="display:flex;align-items:center;gap:12px;cursor:pointer" data-stu="${esc(x.id)}">
        <div class="track-avatar${isVokal(subjOfStu(x)) ? ' vocal' : ''}" style="${x.active ? '' : 'opacity:0.6'}">${subjectIcon(subjOfStu(x))}</div>
        <div style="flex:1;min-width:0">
          <div style="font-weight:700;font-size:0.98rem;letter-spacing:-0.01em;${x.active ? '' : 'color:var(--text2)'}">${esc(x.name)}${x.active ? '' : ' <span style="font-size:0.68rem;font-weight:700;background:var(--paper-2);color:var(--muted);border-radius:var(--r-pill);padding:2px 8px;letter-spacing:0.03em">TIDAK DIAJAR LAGI</span>'}</div>
          <div style="font-size:0.8rem;color:var(--muted);margin-top:2px;line-height:1.4">${esc(jadwalOfStu(x) || '—')}${subjOfStu(x) ? ' · ' + esc(subjOfStu(x)) : ''}</div>
        </div>
        <span class="menu-arrow">${I('chevron-right')}</span>
      </div></div>`;
  const f = (list) => list.filter(x => !q || x.name.toLowerCase().includes(q));
  const a = f(act), i = f(inact);
  $('mainContent').innerHTML = `<div class="page-title-area"><div class="page-title">Siswa</div><div class="page-sub">${act.length} siswa diajar${inact.length ? ' · ' + inact.length + ' riwayat lama' : ''} · data murid diatur Guru Admin</div></div>
    <div style="padding:10px 20px 24px">
      <div class="track-controls" style="margin-bottom:16px"><div class="track-search">${I('search')}<input type="text" placeholder="Cari nama siswa…" value="${esc(G.siswaSearch)}" id="siswaSearchInput"/></div></div>
      <div id="siswaListWrap">${a.length || i.length ? (a.length ? `<div class="llk-section-label">${I('users')}Semua Siswa · ${a.length}</div>` + a.map(card).join('') : '')
        + (i.length ? `<div class="llk-section-label" style="margin-top:14px">${I('pause')}Riwayat lama · ${i.length}</div>` + i.map(card).join('') : '')
        : `<div class="empty">${ill(all.length ? 'search' : 'students')}<div class="empty-t">${all.length ? 'Tidak ditemukan' : 'Belum ada murid'}</div><div class="empty-d">${all.length ? 'Coba kata kunci lain.' : 'Guru Admin belum menugaskan murid kepadamu.'}</div></div>`}</div>
    </div>`;
  const inp = $('siswaSearchInput');
  inp.oninput = () => { G.siswaSearch = inp.value; renderSiswa(); const n = $('siswaSearchInput'); n.focus(); n.setSelectionRange(n.value.length, n.value.length); };
  $('mainContent').querySelectorAll('[data-stu]').forEach(el => el.onclick = () => openProfile(el.dataset.stu));
}
function openProfile(stuId) { G.profile = { id: stuId, from: G.tab, period: 'all' }; render(); window.scrollTo(0, 0); }
function periodRange(p) {
  const now = new Date(); let from = null, to = null;
  if (p === 'hari') { from = new Date(now.getFullYear(), now.getMonth(), now.getDate()); to = new Date(from); to.setDate(to.getDate() + 1); }
  else if (p === 'minggu') { const diff = now.getDay() === 0 ? -6 : 1 - now.getDay(); from = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diff); to = new Date(from); to.setDate(to.getDate() + 7); }
  else if (p === 'bulan') { from = new Date(now.getFullYear(), now.getMonth(), 1); to = new Date(now.getFullYear(), now.getMonth() + 1, 1); }
  else if (p === 'tahun') { from = new Date(now.getFullYear(), 0, 1); to = new Date(now.getFullYear() + 1, 0, 1); }
  return { from: from ? dk(from) : null, to: to ? dk(to) : null };
}
const inRange = (a, r) => (!r.from || a.date >= r.from) && (!r.to || a.date < r.to);
function renderProfile() {
  const p = G.profile, x = myStudents().find(s => s.id === p.id) || { id: p.id, name: '?', classes: [] };
  const r = periodRange(p.period === 'all' ? 'semua' : p.period);
  const recs = Object.values(G.att).filter(a => a.studentId === p.id && inRange(a, r)).sort((a, b) => b.date.localeCompare(a.date));
  const c = st => recs.filter(a => a.status === st).length;
  const periods = [{ k: 'all', l: 'Semua' }, { k: 'bulan', l: 'Bulan ini' }, { k: 'tahun', l: 'Tahun ini' }];
  const stColor = st => st === 'hadir' ? 'var(--hadir)' : st === 'izin' ? 'var(--izin)' : st === 'off' ? 'var(--off)' : 'var(--alpa)';
  const stLabel = st => st === 'hadir' ? I('check', 'sm') + ' Hadir' : st === 'izin' ? I('hand', 'sm') + ' Izin' : st === 'alpa' ? I('x', 'sm') + ' Alpa' : I('pause', 'sm') + ' Off · Guru izin';
  $('mainContent').innerHTML = `<div class="page-title-area">
      <div class="hist-back" id="pfBack"><span>${I('chevron-left')}</span><div class="hist-back-label">Kembali</div></div>
      <div style="display:flex;align-items:center;gap:14px;margin-top:14px">
        <div class="track-avatar ${isVokal(subjOfStu(x)) ? 'vocal' : ''}" style="width:60px;height:60px;border-radius:18px;flex-shrink:0">${subjectIcon(subjOfStu(x))}</div>
        <div style="min-width:0"><div class="page-title" style="font-size:1.6rem">${esc(x.name)}</div>
          <div style="font-size:0.86rem;color:var(--text2);margin-top:4px;font-weight:600">${esc(subjOfStu(x))}</div>
          <div style="font-size:0.82rem;color:var(--muted);margin-top:1px">${esc(jadwalOfStu(x) || 'Tidak ada jadwal aktif')}</div></div>
      </div></div>
    <div style="padding:4px 20px 80px">
      <div class="day-scroll" style="padding:0 0 4px">${periods.map(q => `<button class="day-pill ${p.period === q.k ? 'active' : ''}" data-per="${q.k}" style="padding:8px 14px;font-size:0.84rem">${q.l}</button>`).join('')}</div>
      <div class="stats-row" style="grid-template-columns:repeat(3,1fr);margin:12px 0">
        <div class="stat-card s-hadir"><div class="stat-label">Hadir</div><div class="stat-num">${c('hadir')}</div></div>
        <div class="stat-card s-izin"><div class="stat-label">Izin</div><div class="stat-num">${c('izin')}</div></div>
        <div class="stat-card s-alpa"><div class="stat-label">Alpa</div><div class="stat-num">${c('alpa')}</div></div>
      </div>
      <div class="llk-section-label" style="margin-top:6px">${I('calendar')}Riwayat Pertemuan</div>
      ${recs.length ? recs.map(a => `<div class="hist-entry" style="margin-bottom:10px;border-left:3px solid ${stColor(a.status)}">
          <div style="display:flex;align-items:center;flex-wrap:wrap;gap:4px 8px;font-size:0.84rem;font-weight:700;color:var(--text);margin-bottom:4px">${esc(fmtPretty(a.date))}
            <span style="display:inline-flex;align-items:center;gap:3px;color:${stColor(a.status)};font-size:0.78rem">${stLabel(a.status)}</span></div>
          ${a.reason ? `<div class="llk-note is-reason">${I('info')}<span>${esc(a.reason)}</span></div>` : ''}
          ${a.progress ? `<div class="llk-note is-progress">${I('note')}<span>${esc(a.progress)}</span></div>` : ''}
          ${a.prSiswa ? `<div class="llk-note is-pr">${I('book')}<span>PR: ${esc(a.prSiswa)}</span></div>` : ''}
          ${a.prGuru ? `<div class="llk-note">${I('tasks')}<span>PR Guru: ${esc(a.prGuru)}</span></div>` : ''}
        </div>`).join('')
      : `<div class="empty">${ill('notebook')}<div class="empty-t">Belum ada catatan</div><div class="empty-d">Tidak ada pertemuan tercatat di periode ini.</div></div>`}
    </div>`;
  $('pfBack').onclick = () => { const t = p.from; G.profile = null; setTab(t); };
  $('mainContent').querySelectorAll('[data-per]').forEach(b => b.onclick = () => { p.period = b.dataset.per; renderProfile(); });
}

// ══════════════════════════════════════════════════════════════════════
// TRACK — markup sama dengan Track Record V1 (per siswa)
// ══════════════════════════════════════════════════════════════════════
function renderTrack() {
  const r = periodRange(G.trackPeriod), q = G.trackSearch.toLowerCase();
  const recs = Object.values(G.att).filter(a => inRange(a, r));
  const tot = st => recs.filter(a => a.status === st).length;
  const rows = myStudents().map(x => {
    const mine = recs.filter(a => a.studentId === x.id);
    return { x, h: mine.filter(a => a.status === 'hadir').length, i: mine.filter(a => a.status === 'izin').length, a: mine.filter(a => a.status === 'alpa').length, n: mine.length };
  }).filter(o => (G.trackPeriod === 'semua' ? (o.x.active || o.n) : o.n) && (!q || o.x.name.toLowerCase().includes(q)))
    .sort((a, b) => b.h - a.h || a.x.name.localeCompare(b.x.name));
  $('mainContent').innerHTML = `<div class="page-title-area"><div class="page-title" style="margin:0">Track Record</div><div class="page-sub">Tap nama murid untuk lihat histori lengkap.</div></div>
    <div class="stats-row">
      <div class="stat-card s-hadir"><div class="stat-label">Hadir</div><div class="stat-num">${tot('hadir')}</div></div>
      <div class="stat-card s-izin"><div class="stat-label">Izin</div><div class="stat-num">${tot('izin')}</div></div>
      <div class="stat-card s-alpa"><div class="stat-label">Alpa</div><div class="stat-num">${tot('alpa')}</div></div>
    </div>
    <div class="track-wrap">
      <div class="period-bar">${['hari', 'minggu', 'bulan', 'tahun', 'semua'].map(p => `<button class="period-btn ${G.trackPeriod === p ? 'active' : ''}" data-per="${p}">${p === 'hari' ? 'Hari Ini' : p.charAt(0).toUpperCase() + p.slice(1)}</button>`).join('')}</div>
      <div class="track-controls"><div class="track-search">${I('search')}<input type="text" placeholder="Cari nama…" value="${esc(G.trackSearch)}" id="trackSearchInput"/></div></div>
      <div id="trackCards">${rows.length ? rows.map(o => `<div class="track-card" data-stu="${esc(o.x.id)}">
        <div class="track-top">
          <div class="track-avatar ${isVokal(subjOfStu(o.x)) ? 'vocal' : ''}">${subjectIcon(subjOfStu(o.x))}</div>
          <div style="min-width:0"><div class="track-name">${esc(o.x.name)}</div><div class="track-inst">${esc(subjOfStu(o.x) || '—')}${jadwalOfStu(o.x) ? ' · ' + esc(jadwalOfStu(o.x)) : ''}</div></div>
          <div class="track-nums">
            <div class="track-num-col"><div class="track-num h">${o.h}</div><div class="track-num-label">Hadir</div></div>
            <div class="track-num-col"><div class="track-num i">${o.i}</div><div class="track-num-label">Izin</div></div>
            <div class="track-num-col"><div class="track-num a">${o.a}</div><div class="track-num-label">Alpa</div></div>
          </div>
        </div></div>`).join('')
      : `<div class="empty">${ill('notebook')}<div class="empty-t">Belum ada catatan kehadiran</div><div class="empty-d">Tandai kehadiran di tab Absensi, rekapnya muncul di sini.</div></div>`}</div>
    </div>`;
  $('mainContent').querySelectorAll('[data-per]').forEach(b => b.onclick = () => { G.trackPeriod = b.dataset.per; renderTrack(); });
  $('mainContent').querySelectorAll('.track-card[data-stu]').forEach(el => el.onclick = () => openProfile(el.dataset.stu));
  const inp = $('trackSearchInput');
  inp.oninput = () => { G.trackSearch = inp.value; renderTrack(); const n = $('trackSearchInput'); n.focus(); n.setSelectionRange(n.value.length, n.value.length); };
}

// ══════════════════════════════════════════════════════════════════════
// HONOR — dari absensi Hadir + Alpa (honor tercatat saat absen diisi)
// ══════════════════════════════════════════════════════════════════════
function renderHonor() {
  const paid = Object.values(G.att).filter(a => a.status === 'hadir' || a.status === 'alpa');
  const months = new Map();
  paid.forEach(a => { const k = a.date.slice(0, 7); const m = months.get(k) || { n: 0, sum: 0 }; m.n++; m.sum += a.honor || 0; months.set(k, m); });
  const cur = todayStr().slice(0, 7), now = months.get(cur) || { n: 0, sum: 0 };
  const keys = Array.from(months.keys()).sort().reverse();
  const label = k => MONTH_ID[+k.slice(5, 7) - 1] + ' ' + k.slice(0, 4);
  $('mainContent').innerHTML = `<div class="page-title-area"><div class="page-title">Honor</div><div class="page-sub">Dihitung dari setiap sesi Hadir atau Alpa yang kamu isi.</div></div>
    <div style="padding:10px 20px 40px">
      <div class="stats-row" style="grid-template-columns:repeat(2,1fr);margin:0 0 12px">
        <div class="stat-card s-hadir"><div class="stat-label">Sesi ${MONTH_ID[new Date().getMonth()]}</div><div class="stat-num">${now.n}</div></div>
        <div class="stat-card"><div class="stat-label">Honor ${MONTH_ID[new Date().getMonth()]}</div><div class="stat-num" style="font-size:1.25rem">${esc(rupiah(now.sum))}</div></div>
      </div>
      ${(() => {
        // Gaji: yang sudah ditransfer (slip dari Guru Admin) & yang masih menunggu gajian
        const paidIds = new Set((G.payouts || []).flatMap(p => p.attIds || []));
        const wait = paid.filter(a => !paidIds.has(a.id)), waitSum = wait.reduce((n, a) => n + (a.honor || 0), 0);
        const b = G.member.bank || {};
        return `<div class="menu-card" style="padding:14px 16px;margin-bottom:12px">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:10px"><div><div style="font-size:0.8rem;color:var(--muted);font-weight:700">Belum dibayar</div>
            <div style="font-family:var(--font-display);font-size:1.4rem;font-weight:600" id="hnWait">${esc(rupiah(waitSum))}</div><div class="llk-hint" style="margin:0">${wait.length} pertemuan${G.member.payDay ? ' · gajian tiap tanggal ' + G.member.payDay : ' · tanggal gajian belum diatur Admin'}</div></div>
            <div style="text-align:right" class="llk-hint">${b.number ? 'Ditransfer ke<br><b style="color:var(--text)">' + esc([b.bank, b.number].filter(Boolean).join(' ')) + '</b>' : '<span style="color:var(--alpa);font-weight:700">Rekening belum diisi</span><br>Isi di menu Lainnya'}</div></div></div>
        <div class="llk-section-label">${I('receipt')}Gaji diterima</div>
        <div class="menu-card" style="margin-bottom:14px" id="hnPaid">${(G.payouts || []).length ? G.payouts.map(p => `<div class="menu-item" data-slip="${esc(p.id)}">
            <div class="menu-icon green">${I('check')}</div>
            <div class="menu-text"><div class="menu-label">${esc(fmtKey(p.paidDate))} · ${esc(rupiah(p.total))}</div><div class="menu-desc">${p.sessions} pertemuan · ${esc(fmtKey(p.periodFrom))} – ${esc(fmtKey(p.periodTo))}</div></div>
            <span class="menu-arrow">${I('chevron-right')}</span></div>`).join('')
          : '<div class="llk-hint" style="padding:14px 16px;margin:0">Belum ada gaji yang ditransfer. Slip honor muncul di sini setelah Guru Admin membayar.</div>'}</div>`; })()}
      <div class="llk-section-label">${I('wallet')}Honor per pertemuan saat ini: <b style="color:var(--text);margin-left:4px">${esc(rupiah(G.member.honor))}</b></div>
      <div class="menu-card">${keys.length ? keys.map(k => `<div class="menu-item" style="cursor:default">
          <div class="menu-icon green">${I('calendar')}</div>
          <div class="menu-text"><div class="menu-label">${label(k)}</div><div class="menu-desc">${months.get(k).n} sesi (Hadir + Alpa)</div></div>
          <div style="font-weight:800">${esc(rupiah(months.get(k).sum))}</div></div>`).join('')
        : `<div class="empty">${ill('notebook')}<div class="empty-t">Belum ada honor</div><div class="empty-d">Honor muncul setelah kamu mengisi absensi Hadir/Alpa.</div></div>`}</div>
    </div>`;
  $('mainContent').querySelectorAll('[data-slip]').forEach(el => el.onclick = () => openSlip(G.payouts.find(p => p.id === el.dataset.slip)));
}
async function openSlip(p) {
  if (!p) return;
  const rows = (p.attIds || []).map(id => G.att[id]).filter(Boolean);
  const cv = await renderSlipCanvas(p, rows, G.org, 'Guru Admin');
  const blob = await canvasToBlob(cv, 'image/jpeg', 0.9);
  const url = URL.createObjectURL(blob);
  let ov = $('slipOverlay'); if (ov) ov.remove();
  ov = document.createElement('div'); ov.id = 'slipOverlay'; ov.className = 'overlay open';
  ov.innerHTML = `<div class="modal"><div class="modal-handle"></div><div class="modal-title">${I('receipt')} Slip Honor</div>
    <div class="modal-sub">${esc(fmtKey(p.paidDate))} · ${esc(rupiah(p.total))}</div>
    <div style="max-height:56vh;overflow:auto;border:1px solid var(--border);border-radius:var(--r-md);margin-bottom:12px"><img src="${url}" alt="Slip honor" style="width:100%;display:block"/></div>
    <div class="mactions"><button class="mbtn mbtn-cancel" id="slX">Tutup</button><a class="mbtn mbtn-save" id="slDl" href="${url}" download="${esc(slipNo(p))}.jpg" style="text-decoration:none;display:flex;align-items:center;justify-content:center;gap:6px">${I('download')} JPG</a><button class="mbtn mbtn-save" id="slPdf" style="display:flex;align-items:center;justify-content:center;gap:6px">${I('download')} PDF</button></div></div>`;
  document.body.appendChild(ov);
  $('slPdf').onclick = async () => {
    try {
      const pdf = await slipPdfBlob(cv, slipNo(p)), u = URL.createObjectURL(pdf), a = document.createElement('a');
      a.href = u; a.download = slipNo(p) + '.pdf'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 4000);
    } catch (e) { toast('❌ ' + e.message); }
  };
  ov.addEventListener('click', e => { if (e.target === ov) ov.remove(); });
  $('slX').onclick = () => ov.remove();
}

// ══════════════════════════════════════════════════════════════════════
// LAINNYA
// ══════════════════════════════════════════════════════════════════════
const THEMES = [
  { id: 'latte', name: 'Caffe Latte', desc: 'Hangat & tenang', tb: '#f6f1e9', tc: '#fffcf7', tt: '#2b2420', tg: '#2a7349' },
  { id: 'happy', name: 'Happy Time', desc: 'Tampilan klasik LLK', tb: '#f5f5f7', tc: '#ffffff', tt: '#1d1d1f', tg: '#1d9e4e' },
  { id: 'dark', name: 'Dark Mode', desc: 'Nyaman di malam hari', tb: '#15120f', tc: '#1e1a16', tt: '#f3ebe1', tg: '#6cc793' }
];
function curTheme() { try { return localStorage.getItem('llk_theme') || 'latte'; } catch (e) { return 'latte'; } }
function applyTheme(id) {
  const root = document.documentElement;
  if (id === 'latte') root.removeAttribute('data-theme'); else root.setAttribute('data-theme', id);
  if (id === 'happy' && !$('llkHappyFont')) { const l = document.createElement('link'); l.id = 'llkHappyFont'; l.rel = 'stylesheet'; l.href = 'https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700;9..40,800&display=swap'; document.head.appendChild(l); }
  try { localStorage.setItem('llk_theme', id); } catch (e) {}
}
function renderLainnya() {
  const cur = curTheme();
  $('mainContent').innerHTML = `<div class="page-title-area"><div class="page-title">Lainnya</div><div class="page-sub">Profil & pengaturan</div></div>
    <div style="padding:10px 20px 40px;display:flex;flex-direction:column;gap:14px">
      <div class="menu-card"><div class="menu-item" style="cursor:default">
        <div class="menu-icon red">${I('user')}</div>
        <div class="menu-text"><div class="menu-label">${esc(G.member.name)}</div><div class="menu-desc">${esc(G.user.email || '')} · Guru Mitra ${esc(G.org.name)}${G.isAdmin ? ' (juga Guru Admin)' : ''}</div></div></div></div>
      <div>
        <div class="llk-section-label">${I('card')}Rekening gaji & No WA</div>
        <div class="menu-card" style="padding:14px 16px">
          <div class="llk-hint" style="margin:0 0 10px">Dipakai Guru Admin untuk mentransfer honor & mengirim slip gaji ke WA-mu. Hanya Guru Admin yang bisa melihatnya.</div>
          <div class="mfield" style="margin:0 0 10px"><label>Bank / e-wallet</label><input id="mlBank" list="mlBankList" maxlength="40" placeholder="cth: BCA" value="${esc((G.member.bank || {}).bank || '')}"/>
            <datalist id="mlBankList">${['BCA', 'BRI', 'BNI', 'Mandiri', 'BSI', 'CIMB Niaga', 'Permata', 'BTN', 'Danamon', 'Bank Jago', 'SeaBank', 'blu by BCA', 'DANA', 'GoPay', 'OVO', 'ShopeePay'].map(x => `<option value="${x}">`).join('')}</datalist></div>
          <div class="mfield" style="margin:0 0 10px"><label>Nomor rekening</label><input id="mlNum" inputmode="numeric" maxlength="40" placeholder="cth: 1234567890" value="${esc((G.member.bank || {}).number || '')}"/></div>
          <div class="mfield" style="margin:0 0 10px"><label>Atas nama</label><input id="mlHolder" maxlength="80" placeholder="Nama sesuai buku tabungan" value="${esc((G.member.bank || {}).holder || '')}"/></div>
          <div class="mfield" style="margin:0 0 10px"><label>No WhatsApp</label><input id="mlPhone" type="tel" inputmode="tel" maxlength="20" placeholder="cth: 0812xxxxxxx" value="${esc(G.member.phone || '')}"/></div>
          <button class="llk-btn primary block" id="mlBankSave">${I('check')} Simpan Rekening</button>
        </div>
      </div>
      <div>
        <div class="llk-section-label">${I('table')}Spreadsheet absensi guru</div>
        <div class="menu-card" style="padding:14px 16px">
          <div class="llk-hint" style="margin:0 0 10px">Link Google Sheet tempat kamu mencatat absensi mengajar (untuk Guru Admin).</div>
          <div class="mfield" style="margin:0 0 10px"><input id="mlSheet" type="url" placeholder="https://docs.google.com/spreadsheets/..." value="${esc(G.member.sheetLink || '')}"/></div>
          <button class="llk-btn primary block" id="mlSave">${I('check')} Simpan Link</button>
        </div>
      </div>
      <div>
        <div class="llk-section-label">${I('palette')}Tema tampilan</div>
        <div class="llk-theme-grid">${THEMES.map(t => `<button class="llk-theme-opt${t.id === cur ? ' on' : ''}" data-theme="${t.id}" style="--tb:${t.tb};--tc:${t.tc};--tt:${t.tt};--tg:${t.tg}">
          <span class="llk-theme-prev"><i class="hd"></i><i class="cd"></i><i class="l1"></i><i class="l2"></i><i class="dot"></i></span>
          <span><span class="llk-theme-nm">${t.name}</span><span class="llk-theme-ds">${t.desc}</span></span></button>`).join('')}</div>
      </div>
      <div class="menu-card">
        <div class="menu-item" id="mlMode"><div class="menu-icon">${I('repeat')}</div><div class="menu-text"><div class="menu-label">Ganti Mode</div><div class="menu-desc">Pindah ke Guru Lepas untuk murid pribadimu</div></div><span class="menu-arrow">${I('chevron-right')}</span></div>
        ${G.isAdmin ? `<div class="menu-item" id="mlAdmin"><div class="menu-icon red">${I('users')}</div><div class="menu-text"><div class="menu-label">Buka Aplikasi Admin</div><div class="menu-desc">Murid, guru, tagihan & laporan lembaga</div></div><span class="menu-arrow">${I('chevron-right')}</span></div>` : `<div class="menu-item" id="mlLeave"><div class="menu-icon" style="color:var(--alpa)">${I('logout')}</div><div class="menu-text"><div class="menu-label" style="color:var(--alpa)">Keluar dari ${esc(G.org.name)}</div><div class="menu-desc">Berhenti menjadi Guru Mitra di lembaga ini</div></div></div>`}
        <div class="menu-item" id="mlOut"><div class="menu-icon">${I('lock')}</div><div class="menu-text"><div class="menu-label">Logout</div><div class="menu-desc">${esc(G.user.email || '')}</div></div></div>
      </div>
    </div>`;
  if (G.isAdmin) $('mlAdmin').onclick = () => { location.href = './'; };
  $('mlBankSave').onclick = async () => {
    const bank = { bank: $('mlBank').value.trim(), number: $('mlNum').value.replace(/[^\d-]/g, '').trim(), holder: $('mlHolder').value.trim() };
    const phone = $('mlPhone').value.replace(/[^\d+]/g, '');
    if (!bank.bank || !bank.number || !bank.holder) { toast('⚠️ Isi bank, nomor rekening & atas nama'); return; }
    if (phone.replace(/\D/g, '').length < 9) { toast('⚠️ No WhatsApp belum benar'); return; }
    try { await updateDoc(doc(db, 'orgs', G.org.id, 'members', G.user.uid), { bank, phone }); G.member.bank = bank; G.member.phone = phone; toast('✅ Rekening & No WA tersimpan'); }
    catch (e) { toast('❌ ' + friendlyError(e)); }
  };
  $('mlSave').onclick = async () => {
    const v = $('mlSheet').value.trim();
    if (v && !/^https?:\/\//i.test(v)) { toast('⚠️ Link harus diawali https://'); return; }
    try { await updateDoc(doc(db, 'orgs', G.org.id, 'members', G.user.uid), { sheetLink: v }); G.member.sheetLink = v; toast('✅ Link tersimpan'); }
    catch (e) { toast('❌ ' + friendlyError(e)); }
  };
  $('mainContent').querySelectorAll('.llk-theme-opt').forEach(b => b.onclick = () => { applyTheme(b.dataset.theme); renderLainnya(); toast('✅ Tema dipakai'); });
  $('mlMode').onclick = () => { location.href = './?pilih=1'; };
  $('mlOut').onclick = async () => { if (TEST) { location.reload(); return; } await signOut(auth); location.replace('./'); };
  if (!G.isAdmin) $('mlLeave').onclick = () => confirmWord('Keluar dari ' + G.org.name + '?', 'Kamu tidak bisa lagi melihat jadwal & murid lembaga ini. Untuk bergabung lagi, perlu kode undangan baru dari Guru Admin.', 'KELUAR', 'Keluar', async () => {
    try {
      const b = writeBatch(db);
      b.delete(doc(db, 'orgs', G.org.id, 'members', G.user.uid));
      if (G.member.slot) b.delete(doc(db, 'orgs', G.org.id, 'slots', String(G.member.slot)));
      b.set(doc(db, 'users', G.user.uid), { orgId: null, orgRole: null, mode: 'lepas', updatedAt: serverTimestamp() });
      await b.commit();
      location.replace('./');
    } catch (e) { toast('❌ Gagal: ' + friendlyError(e), 4000); }
  });
}
function confirmWord(title, msg, word, yes, onYes) {
  $('cfTitle').textContent = title; $('cfMsg').textContent = msg;
  $('cfWordWrap').style.display = ''; $('cfWordLabel').textContent = 'Ketik ' + word + ' untuk konfirmasi'; $('cfWord').value = '';
  $('cfYes').textContent = yes; $('cfYes').disabled = true;
  $('cfWord').oninput = () => { $('cfYes').disabled = $('cfWord').value.trim().toUpperCase() !== word; };
  $('cfNo').onclick = () => $('confirmOverlay').classList.remove('open');
  $('cfYes').onclick = async () => { $('cfYes').disabled = true; await onYes(); $('confirmOverlay').classList.remove('open'); };
  $('confirmOverlay').classList.add('open');
}

// ══════════════════════════════════════════════════════════════════════
// BOOT
// ══════════════════════════════════════════════════════════════════════
function renderNotTeaching() {
  document.querySelector('.bottom-nav').style.display = 'none';
  $('mainContent').innerHTML = `<div class="empty" style="padding-top:60px">${ill('students')}
    <div class="empty-t">Kamu Guru Admin</div>
    <div class="empty-d" style="max-width:360px;margin:6px auto 0">Aplikasi ini untuk guru yang mengajar. Kalau kamu juga mengajar, buka aplikasi Admin → menu <b>Guru</b> → <b>Saya juga mengajar</b>.</div>
    <button class="llk-btn primary" id="ntAdmin" style="margin-top:18px">${I('users')} Buka Aplikasi Admin</button></div>`;
  $('ntAdmin').onclick = () => { location.href = './'; };
}
async function boot(user) {
  if (!user) { location.replace('./'); return; }
  G.user = user;
  try {
    const prof = await getDoc(doc(db, 'users', user.uid));
    const orgId = prof.exists() ? prof.data().orgId : null;
    if (!orgId) { location.replace('./'); return; }
    const m = await getDoc(doc(db, 'orgs', orgId, 'members', user.uid)).catch(() => null);
    if (!m || !m.exists() || !['mitra', 'admin'].includes(m.data().role)) { location.replace('./'); return; }
    G.member = Object.assign({ id: m.id }, m.data());
    // Guru Admin yang juga mengajar memakai aplikasi ini persis seperti Guru Mitra lain;
    // kalau belum mendaftar "Saya juga mengajar", arahkan ke aplikasi Admin.
    G.isAdmin = G.member.role === 'admin';
    const o = await getDoc(doc(db, 'orgs', orgId));
    G.org = Object.assign({ id: o.id }, o.data());
    paintHeader();
    if (G.isAdmin && !G.member.teaches) { renderNotTeaching(); return; }
    await loadData();
    render();
  } catch (e) {
    console.error(e);
    $('mainContent').innerHTML = `<div class="empty">${ill('notebook')}<div class="empty-t">Gagal memuat data</div><div class="empty-d">${esc(friendlyError(e))}</div><button class="llk-btn primary" style="margin-top:16px" onclick="location.reload()">Coba Lagi</button></div>`;
  }
}
// Muat ulang data saat aplikasi dibuka lagi (mis. Admin baru mengisi Izin)
document.addEventListener('visibilitychange', async () => {
  if (document.visibilityState === 'visible' && G.org && !$('noteOverlay').classList.contains('open')) { try { await loadData(); render(); } catch (e) {} }
});
if (TEST) boot(TEST.user);
else { let first = true; onAuthStateChanged(auth, u => { if (first) { first = false; boot(u); } }); }
window.__llkGuru = { G };
