// ══════════════════════════════════════════════════════════════════════
// LesLesanKu V2 — Lembaga (Guru Admin + Guru Mitra)
// Tahap 1: pilih peran, buat lembaga, undang & gabung Guru Mitra,
//          kerangka tampilan Admin & Mitra.
// Aturan keamanan: /firestore.rules (bagian "LLK V2").
// ══════════════════════════════════════════════════════════════════════
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import { getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, signOut }
  from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import { getFirestore, connectFirestoreEmulator, doc, getDoc, getDocs, updateDoc, writeBatch, collection, query, where, serverTimestamp, Timestamp }
  from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { getFunctions, httpsCallable } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-functions.js';
import * as BL from './billing.js';
import { ICONS, LLK_SUBJECT_ICON } from './v1-shared.js';
import { renderSlipCanvas, canvasToBlob, slipWaText, compressPhoto, slipNo, fmtKey, slipPdfBlob, slipDefaultFormat, SLIP_PDF_FROM } from './slip.js';

// Ikon garis dari sprite di index.html (satu set dengan V1)
const I = (n, c) => `<svg class="ico${c ? ' ' + c : ''}" aria-hidden="true"><use href="#i-${n}"/></svg>`;

// ── Ikon mata pelajaran (sama dengan V1 & aplikasi Guru Mitra: getInstrumentIcon + llkSubjectIcon) ──
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
  if (!n && e && e.indexOf('\u200d') >= 0) n = 'users';
  n = n || 'music';
  if (document.documentElement.getAttribute('data-theme') === 'happy') return `<span class="llk-subj llk-subj-emo" style="${subjectStyle(n)}">${esc(e || '🎵')}</span>`;
  return `<span class="llk-subj" style="${subjectStyle(n)}">${I(n)}</span>`;
}

const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyAvD4ABTYIjCtPCYzUaRM8AHsjiOamHQLU',
  authDomain: 'leslesanku.com', // helper login di /__/auth/ (lihat __/README.md)
  projectId: 'llk-67a30',
  storageBucket: 'llk-67a30.firebasestorage.app',
  messagingSenderId: '894092774293',
  appId: '1:894092774293:web:8c66654aada5b42bf5c49c'
};
const V1_URL = '../?v1=1';
const INVITE_DAYS = 7;
const CHOICE_KEY = 'llk_v2_choice';     // peran terakhir yang dipilih di HP ini
const PENDING_KEY = 'llk_v2_pending';   // aksi yang menunggu login (untuk login via redirect)
const CODE_KEY = 'llk_v2_code';         // kode undangan dari link
// Pilihan "Guru Lepas" (LLK V1) hanya tampil kalau halaman ini dibuka lewat leslesanku.com
// (index.html mengarahkan ke v2/?dari=web). Dibuka langsung di /v2 atau dari menu LLK V1
// (?dari=v1) → hanya Pemilik Lembaga Les & Guru Mitra. Diingat per tab supaya tetap
// berlaku setelah login (redirect Google menghapus ?dari).
const FROM_WEB_KEY = 'llk_v2_from_web';
try {
  const dari = new URLSearchParams(location.search).get('dari');
  if (dari === 'web') sessionStorage.setItem(FROM_WEB_KEY, '1');
  else if (dari === 'v1') sessionStorage.removeItem(FROM_WEB_KEY);
} catch (e) {}
function showLepas() { try { return sessionStorage.getItem(FROM_WEB_KEY) === '1'; } catch (e) { return false; } }

// Mode uji otomatis (hanya aktif kalau halaman diberi window.__LLK_TEST__ oleh skrip pengujian)
const TEST = window.__LLK_TEST__ || null;

const app = initializeApp(FIREBASE_CONFIG);
const db = getFirestore(app);
const auth = TEST ? null : getAuth(app);
if (TEST) connectFirestoreEmulator(db, TEST.host, TEST.port, { mockUserToken: { sub: TEST.user.uid, email: TEST.user.email, email_verified: true } });
// Cloud Functions (pembayaran langganan). Mode uji memakai server tiruan dari skrip pengujian.
const fns = getFunctions(app, 'us-central1');
const callFn = (name, data) => (TEST && window.__llkServer ? window.__llkServer(name, data) : httpsCallable(fns, name)(data).then(r => r.data));

// ── Tema tampilan (per perangkat, sama dengan V1 & aplikasi Guru) & warna lembaga ──
const THEMES = [
  { id: 'latte', name: 'Caffe Latte', desc: 'Hangat & tenang', bg: '#f6f1e9', card: '#fffcf7', ink: '#2b2420' },
  { id: 'happy', name: 'Happy Time', desc: 'Klasik LLK', bg: '#f5f5f7', card: '#ffffff', ink: '#1d1d1f' },
  { id: 'dark', name: 'Dark Mode', desc: 'Malam hari', bg: '#15120f', card: '#1e1a16', ink: '#f3ebe1' },
];
function curTheme() { try { return localStorage.getItem('llk_theme') || 'latte'; } catch (e) { return 'latte'; } }
function applyTheme(id) {
  const r = document.documentElement;
  if (!THEMES.some(t => t.id === id)) id = 'latte';
  if (id === 'latte') r.removeAttribute('data-theme'); else r.setAttribute('data-theme', id);
  if (id === 'happy' && !document.getElementById('llkHappyFont')) { const l = document.createElement('link'); l.id = 'llkHappyFont'; l.rel = 'stylesheet'; l.href = 'https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700;9..40,800&display=swap'; document.head.appendChild(l); }
  try { localStorage.setItem('llk_theme', id); } catch (e) {}
}
applyTheme(curTheme());
const ORG_COLORS = ['#a8372a', '#c0392b', '#d35400', '#b7791f', '#2a7349', '#16a085', '#2f5a8a', '#2563eb', '#6b4e9b', '#be185d', '#4b5563', '#1d1d1f'];
const validHex = c => /^#[0-9a-fA-F]{6}$/.test(String(c || ''));
function hexRgba(h, a) { const n = parseInt(h.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; }
function darkHex(h, f) { const n = parseInt(h.slice(1), 16); const c = x => Math.round(x * (1 - f)).toString(16).padStart(2, '0'); return '#' + c(n >> 16) + c((n >> 8) & 255) + c(n & 255); }
// Warna lembaga menggantikan merah LLK di tombol, menu aktif & logo
function applyOrgColor(hex) {
  const r = document.documentElement.style;
  if (!validHex(hex)) { ['--red', '--red2', '--red-bg'].forEach(k => r.removeProperty(k)); return; }
  r.setProperty('--red', hex); r.setProperty('--red2', darkHex(hex, 0.25)); r.setProperty('--red-bg', hexRgba(hex, 0.12));
}
function orgLogoHtml(o) {
  o = o || {};
  if (o.logo) return `<img src="${esc(o.logo)}" alt=""/>`;
  return esc(String(o.logoText || '').trim() || initials(o.name));
}

// ── State ──
const S = { sel: new Set(), absDate: '', user: null, profile: null, org: null, member: null, tab: null, guru: null, data: null, muridView: 'daftar', filt: { q: '', guru: '', subj: '', status: 'aktif' }, schedGuru: '' };

// ── Util ──
const $ = (id) => document.getElementById(id);
const root = () => $('app');
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function rupiah(n) { return 'Rp ' + Math.round(n || 0).toLocaleString('id-ID'); }
function initials(name) { return String(name || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0] || '').join('').toUpperCase() || '?'; }
function fmtDate(ts) { const d = ts && ts.toDate ? ts.toDate() : new Date(ts); return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }); }
let toastTimer;
function toast(msg, ms) {
  const el = $('toast'); el.textContent = msg; el.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), ms || 2800);
}
function setChoice(c) { try { localStorage.setItem(CHOICE_KEY, c); } catch (e) {} }
function friendlyError(e) {
  const code = (e && e.code) || '';
  if (code.includes('permission-denied')) return S.org && !orgInfo().active ? 'Langganan lembaga sudah habis — perpanjang di menu Lainnya → Langganan.' : 'Akses ditolak oleh server.';
  if (code.includes('unavailable') || !navigator.onLine) return 'Tidak ada koneksi internet.';
  return (e && e.message) || 'Terjadi kesalahan.';
}
// Kode undangan: 8 karakter acak tanpa huruf/angka yang mirip (0/O, 1/I/L)
function genCode() {
  const A = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const bytes = new Uint8Array(8); crypto.getRandomValues(bytes);
  const s = Array.from(bytes, b => A[b % A.length]).join('');
  return 'LLK-' + s.slice(0, 4) + '-' + s.slice(4);
}
function normalizeCode(raw) {
  const s = String(raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/^LLK/, '');
  if (s.length !== 8) return null;
  return 'LLK-' + s.slice(0, 4) + '-' + s.slice(4);
}
function inviteLink(code) { return location.origin + location.pathname.replace(/[^/]*$/, '') + '?kode=' + encodeURIComponent(code); }
function isExpired(inv) { return inv.expiresAt && inv.expiresAt.toMillis() < Date.now(); }

// Kompres gambar (logo) jadi JPEG kecil, disimpan langsung di dokumen lembaga
function compressImage(file, max = 160, q = 0.8) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onerror = () => reject(new Error('Gagal membaca file'));
    r.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('File bukan gambar'));
      img.onload = () => {
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL('image/jpeg', q));
      };
      img.src = r.result;
    };
    r.readAsDataURL(file);
  });
}

// ── Modal ──
function openModal(html) {
  closeModal();
  const ov = document.createElement('div');
  ov.className = 'overlay'; ov.id = 'modalOverlay';
  ov.innerHTML = '<div class="modal">' + html + '</div>';
  ov.addEventListener('click', e => { if (e.target === ov) closeModal(); });
  document.body.appendChild(ov);
  return ov;
}
function closeModal() { const o = $('modalOverlay'); if (o) o.remove(); }
// Konfirmasi dua langkah untuk aksi berbahaya
function confirmDanger({ title, message, confirmText, typeWord }, onYes) {
  openModal(`
    <div class="modal-t">${I('alert')} ${esc(title)}</div>
    <div class="modal-sub">${message}</div>
    ${typeWord ? `<div class="field"><label>Ketik ${esc(typeWord)} untuk konfirmasi</label><input id="cfWord" autocomplete="off"/></div>` : ''}
    <div class="btn-row">
      <button class="btn btn-ghost" id="cfNo">Batal</button>
      <button class="btn btn-danger" id="cfYes" ${typeWord ? 'disabled' : ''}>${esc(confirmText)}</button>
    </div>`);
  $('cfNo').onclick = closeModal;
  if (typeWord) $('cfWord').oninput = (e) => { $('cfYes').disabled = e.target.value.trim().toUpperCase() !== typeWord.toUpperCase(); };
  $('cfYes').onclick = async () => { $('cfYes').disabled = true; try { await onYes(); } finally { closeModal(); } };
}

// ══════════════════════════════════════════════════════════════════════
// LOGIN
// ══════════════════════════════════════════════════════════════════════
function isBareWebView() { const ua = navigator.userAgent || ''; return /; ?wv\)/i.test(ua); }
async function login(pendingAction) {
  if (TEST) return S.user;
  if (S.user) return S.user;
  if (!navigator.onLine) { toast('⚠️ Perlu internet untuk login'); return null; }
  if (isBareWebView()) { alert('Login Google tidak didukung di tampilan ini. Buka lewat Chrome atau aplikasi LesLesanKu resmi.'); return null; }
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' }); // selalu tampilkan pilihan akun
  try {
    const res = await signInWithPopup(auth, provider);
    return res.user;
  } catch (e) {
    if (e.code === 'auth/popup-closed-by-user' || e.code === 'auth/cancelled-popup-request') { toast('Login dibatalkan'); return null; }
    if (e.code === 'auth/popup-blocked' || e.code === 'auth/operation-not-supported-in-this-environment') {
      try { sessionStorage.setItem(PENDING_KEY, pendingAction || ''); } catch (x) {}
      await signInWithRedirect(auth, provider);
      return null;
    }
    toast('⚠️ Login gagal: ' + e.message, 5000);
    return null;
  }
}
async function logout() {
  if (TEST) { location.reload(); return; }
  await signOut(auth);
  S.user = S.profile = S.org = S.member = null;
  renderChooser();
}

// ══════════════════════════════════════════════════════════════════════
// MEMUAT PROFIL & LEMBAGA
// ══════════════════════════════════════════════════════════════════════
async function loadProfile() {
  const snap = await getDoc(doc(db, 'users', S.user.uid));
  S.profile = snap.exists() ? snap.data() : {};
  return S.profile;
}
// Kembalikan true kalau pengguna aktif di sebuah lembaga (dan data sudah dimuat)
async function loadMembership() {
  S.org = S.member = null;
  const orgId = S.profile && S.profile.orgId;
  if (!orgId) return false;
  const m = await getDoc(doc(db, 'orgs', orgId, 'members', S.user.uid)).catch(() => null);
  if (!m || !m.exists()) {
    // Sudah dikeluarkan dari lembaga → bersihkan penanda di profil
    await updateDoc(doc(db, 'users', S.user.uid), { orgId: null, orgRole: null, updatedAt: serverTimestamp() }).catch(() => {});
    S.profile.orgId = null;
    toast('Kamu sudah tidak terdaftar di lembaga sebelumnya', 4000);
    return false;
  }
  S.member = Object.assign({ id: m.id }, m.data());
  const o = await getDoc(doc(db, 'orgs', orgId));
  S.org = Object.assign({ id: o.id }, o.data());
  return true;
}

// ══════════════════════════════════════════════════════════════════════
// LAYAR 1 — PILIH PERAN
// ══════════════════════════════════════════════════════════════════════
function renderChooser() {
  const inOrg = S.org && S.member;
  root().innerHTML = `
  <div class="welcome">
    <h1 class="welcome-h">Selamat datang di</h1>
    <img class="welcome-brand" src="../logo-leslesanku.png" alt="LLK — Les LesanKu"/>
    <div class="sub">Pilih cara kamu memakai aplikasi ini</div>
    ${inOrg ? `
    <button class="role-card" id="rcBack" style="border-color:var(--green)">
      <div class="role-ic" style="background:var(--green-bg);color:var(--green)">${I('cap')}</div>
      <div><div class="role-t">Kembali ke ${esc(S.org.name)}</div><div class="role-d">Sebagai ${S.member.role === 'admin' ? 'Guru Admin' : 'Guru Mitra'}</div></div>
      <div class="role-arrow">${I('chevron-right')}</div>
    </button>` : ''}
    ${!showLepas() ? '' : `
    <button class="role-card" id="rcLepas">
      <div class="role-ic role-ic-app"><img src="../icon-maskable-192.png" alt=""/></div>
      <div><div class="role-t">Guru Lepas <span class="role-tag">LLK V1</span></div><div class="role-d">Saya mengajar sendiri — atur murid, jadwal & tagihan sendiri</div></div>
      <div class="role-arrow">${I('chevron-right')}</div>
    </button>`}
    ${inOrg ? '' : `
    <button class="role-card" id="rcLembaga">
      <div class="role-ic" style="background:var(--red-bg);color:var(--red)">${I('users')}</div>
      <div><div class="role-t">Pemilik Lembaga Les</div><div class="role-d">Saya punya guru-guru — kelola jadwal, murid & honor guru</div></div>
      <div class="role-arrow">${I('chevron-right')}</div>
    </button>
    <button class="role-card" id="rcMitra">
      <div class="role-ic" style="background:var(--blue-bg);color:var(--blue)">${I('user-plus')}</div>
      <div><div class="role-t">Guru Mitra</div><div class="role-d">Saya diundang lembaga — punya kode undangan</div></div>
      <div class="role-arrow">${I('chevron-right')}</div>
    </button>`}
    <div class="welcome-foot">
      ${S.user ? `Login sebagai <b>${esc(S.user.email)}</b> · <a href="#" id="lnkLogout" style="color:var(--red)">Keluar</a>` : 'Pilihanmu disimpan — layar ini hanya muncul sekali'}
    </div>
  </div>`;
  const back = $('rcBack'); if (back) back.onclick = () => enterShell();
  if ($('rcLepas')) $('rcLepas').onclick = () => { setChoice('lepas'); location.href = V1_URL; };
  const l = $('rcLembaga'); if (l) l.onclick = () => startLembaga();
  const m = $('rcMitra'); if (m) m.onclick = () => startMitra();
  const lo = $('lnkLogout'); if (lo) lo.onclick = (e) => { e.preventDefault(); logout(); };
}

async function startLembaga() {
  const u = await login('lembaga'); if (!u) return;
  S.user = u; await loadProfile();
  if (await loadMembership()) return enterShell();
  setChoice('lembaga');
  renderCreateOrg();
}
async function startMitra(prefillCode) {
  const u = await login('mitra'); if (!u) return;
  S.user = u; await loadProfile();
  if (await loadMembership()) return enterShell();
  setChoice('mitra');
  renderJoin(prefillCode || sessionStorage.getItem(CODE_KEY) || '');
}

// ══════════════════════════════════════════════════════════════════════
// LAYAR 2a — BUAT LEMBAGA (jadi Guru Admin)
// ══════════════════════════════════════════════════════════════════════
function renderCreateOrg() {
  let logoData = null;
  root().innerHTML = `
  <div class="panel">
    <button class="back" id="bk">${I('chevron-left')} Kembali</button>
    <h2>Daftarkan Lembaga Les</h2>
    <div class="sub">Kamu akan menjadi <b>Guru Admin</b> — mengelola jadwal, murid, tagihan & honor Guru Mitra.</div>
    <div id="coMsg"></div>
    <div class="field"><label>Nama lembaga</label><input id="coName" maxlength="80" placeholder="cth: Les Musik Ceria"/></div>
    <div class="field"><label>Logo (opsional)</label>
      <div class="logo-pick"><div class="logo-box" id="coLogoBox">${I('image')}</div>
        <button class="btn btn-ghost" style="width:auto;padding:10px 16px" id="coLogoBtn">Pilih Gambar</button>
        <input type="file" id="coLogo" accept="image/*" style="display:none"/></div>
    </div>
    <div class="msg msg-info">Uji coba gratis <b>${BL.ORG_TRIAL_DAYS} hari</b> · 1 Guru Admin + <b>${BL.ORG_BASE_SLOTS} Guru Mitra</b>. Setelah itu mulai ${esc(rupiah(BL.ORG_BASE))}/bulan — tambah guru kapan saja.</div>
    <button class="btn btn-primary" id="coGo">Buat Lembaga</button>
    <div class="welcome-foot" style="padding-top:18px">Login sebagai ${esc(S.user.email)}</div>
  </div>`;
  $('bk').onclick = renderChooser;
  $('coLogoBtn').onclick = () => $('coLogo').click();
  $('coLogo').onchange = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    try { logoData = await compressImage(f); $('coLogoBox').innerHTML = `<img src="${logoData}" alt=""/>`; }
    catch (err) { toast('❌ ' + err.message); }
  };
  $('coGo').onclick = async () => {
    const name = $('coName').value.trim();
    if (!name) { $('coMsg').innerHTML = '<div class="msg msg-err">Nama lembaga wajib diisi.</div>'; return; }
    $('coGo').disabled = true; $('coGo').textContent = 'Membuat…';
    try {
      const orgRef = doc(collection(db, 'orgs'));
      const b = writeBatch(db);
      b.set(orgRef, { name, logo: logoData, ownerUid: S.user.uid, seats: BL.ORG_BASE_SLOTS, plan: 'trial', createdAt: serverTimestamp() });
      b.set(doc(db, 'orgs', orgRef.id, 'members', S.user.uid), { role: 'admin', name: S.user.displayName || name, email: S.user.email || '', joinedAt: serverTimestamp() });
      b.set(doc(db, 'users', S.user.uid), { orgId: orgRef.id, orgRole: 'admin', mode: 'lembaga', updatedAt: serverTimestamp() });
      await b.commit();
      await loadProfile(); await loadMembership();
      toast('✅ Lembaga ' + name + ' berhasil dibuat');
      enterShell();
    } catch (e) {
      console.error(e);
      $('coMsg').innerHTML = `<div class="msg msg-err">Gagal membuat lembaga: ${esc(friendlyError(e))}</div>`;
      $('coGo').disabled = false; $('coGo').textContent = 'Buat Lembaga';
    }
  };
}

// ══════════════════════════════════════════════════════════════════════
// LAYAR 2b — GABUNG SEBAGAI GURU MITRA (kode undangan)
// ══════════════════════════════════════════════════════════════════════
function renderJoin(prefill) {
  root().innerHTML = `
  <div class="panel">
    <button class="back" id="bk">${I('chevron-left')} Kembali</button>
    <h2>Gabung sebagai Guru Mitra</h2>
    <div class="sub">Masukkan kode undangan dari Guru Admin lembaga kamu.</div>
    <div id="jMsg"></div>
    <div class="field"><label>Kode undangan</label><input id="jCode" class="code-input" placeholder="LLK-XXXX-XXXX" maxlength="16" autocomplete="off" value="${esc(prefill || '')}"/></div>
    <button class="btn btn-dark" id="jCheck">Cek Kode</button>
    <div id="jPreview" style="margin-top:16px"></div>
    <div class="welcome-foot" style="padding-top:18px">Login sebagai ${esc(S.user.email)}</div>
  </div>`;
  $('bk').onclick = renderChooser;
  $('jCheck').onclick = checkCode;
  $('jCode').onkeydown = (e) => { if (e.key === 'Enter') checkCode(); };
  if (prefill) checkCode();
}
async function checkCode() {
  const msg = $('jMsg'), prev = $('jPreview');
  msg.innerHTML = ''; prev.innerHTML = '';
  const code = normalizeCode($('jCode').value);
  if (!code) { msg.innerHTML = '<div class="msg msg-err">Format kode salah. Contoh: LLK-AB12-CD34</div>'; return; }
  $('jCode').value = code;
  $('jCheck').disabled = true;
  try {
    const snap = await getDoc(doc(db, 'invites', code));
    if (!snap.exists()) { msg.innerHTML = '<div class="msg msg-err">Kode tidak ditemukan. Periksa lagi atau minta kode baru ke Guru Admin.</div>'; return; }
    const inv = snap.data();
    if (inv.status === 'used') { msg.innerHTML = '<div class="msg msg-err">Kode ini sudah dipakai. Satu kode hanya untuk satu guru.</div>'; return; }
    if (inv.status === 'revoked') { msg.innerHTML = '<div class="msg msg-err">Kode ini sudah dicabut oleh Guru Admin.</div>'; return; }
    if (isExpired(inv)) { msg.innerHTML = '<div class="msg msg-err">Kode ini sudah kedaluwarsa. Minta Guru Admin membuat kode baru.</div>'; return; }
    if (inv.emailLock && inv.emailLock.toLowerCase() !== String(S.user.email || '').toLowerCase()) {
      msg.innerHTML = `<div class="msg msg-err">Kode ini khusus untuk Gmail lain. Login dengan Gmail yang didaftarkan Guru Admin.</div>`; return;
    }
    prev.innerHTML = `
      <div class="preview-card">
        <div class="card-t" style="color:var(--green)">${I('check-circle','sm')} Kode valid</div>
        <div class="t-name" style="font-size:1.05rem">${esc(inv.orgName)}</div>
        <div class="t-meta" style="white-space:normal;margin-top:6px">Kamu diundang sebagai <b>${esc(inv.name)}</b><br>Honor: <b>${esc(rupiah(inv.honor))}</b> per pertemuan</div>
      </div>
      <button class="btn btn-primary" id="jJoin">Gabung ke ${esc(inv.orgName)}</button>`;
    $('jJoin').onclick = () => joinOrg(code, inv);
  } catch (e) {
    msg.innerHTML = `<div class="msg msg-err">Gagal memeriksa kode: ${esc(friendlyError(e))}</div>`;
  } finally { $('jCheck').disabled = false; }
}
async function joinOrg(code, inv) {
  const btn = $('jJoin'); btn.disabled = true; btn.textContent = 'Bergabung…';
  try {
    const b = writeBatch(db);
    b.update(doc(db, 'invites', code), { status: 'used', usedBy: S.user.uid, usedAt: serverTimestamp() });
    b.set(doc(db, 'orgs', inv.orgId, 'members', S.user.uid), {
      role: 'mitra', name: inv.name, email: S.user.email || '', honor: inv.honor,
      inviteCode: code, slot: inv.slot, sheetLink: '', joinedAt: serverTimestamp()
    });
    b.update(doc(db, 'orgs', inv.orgId, 'slots', String(inv.slot)), { kind: 'member', code, uid: S.user.uid });
    b.set(doc(db, 'users', S.user.uid), { orgId: inv.orgId, orgRole: 'mitra', mode: 'lembaga', updatedAt: serverTimestamp() });
    await b.commit();
    try { sessionStorage.removeItem(CODE_KEY); } catch (e) {}
    await loadProfile(); await loadMembership();
    toast('🎉 Selamat bergabung di ' + inv.orgName);
    enterShell();
  } catch (e) {
    console.error(e);
    const already = S.profile && S.profile.orgId;
    $('jMsg').innerHTML = `<div class="msg msg-err">Gagal bergabung: ${esc(already ? 'akun ini sudah terdaftar di lembaga lain. Satu akun Google hanya bisa di satu lembaga.' : friendlyError(e) + ' Kode mungkin baru saja dipakai, dicabut, atau khusus Gmail lain.')}</div>`;
    btn.disabled = false; btn.textContent = 'Gabung';
  }
}

// ══════════════════════════════════════════════════════════════════════
// KERANGKA APLIKASI (Admin / Mitra)
// ══════════════════════════════════════════════════════════════════════
const ADMIN_TABS = [
  { k: 'absensi', i: 'absensi', l: 'Absensi' },
  { k: 'murid', i: 'cap', l: 'Siswa' },
  { k: 'guru', i: 'users', l: 'Guru' },
  { k: 'keuangan', i: 'wallet', l: 'Keuangan' },
  { k: 'lainnya', i: 'grid', l: 'Lainnya' },
];
function isAdmin() { return S.member && S.member.role === 'admin'; }
// Guru Mitra memakai halaman sendiri yang tampilannya sama dengan LLK V1
const MITRA_URL = 'guru.html';
function enterShell() {
  setChoice(isAdmin() ? 'lembaga' : 'mitra');
  if (!isAdmin()) { location.replace(MITRA_URL); return; }
  S.tab = isAdmin() ? 'guru' : 'jadwal';
  renderShell();
  syncAttTeach();
}
function renderShell() {
  const tabs = ADMIN_TABS;
  const logo = orgLogoHtml(S.org);
  applyOrgColor(S.org.color);
  root().innerHTML = `
  <div class="shell">
    <nav class="bottom-nav">${tabs.map(t => `<button class="bnav ${t.k === S.tab ? 'active' : ''}" data-tab="${t.k}"><span class="bi">${I(t.i)}</span>${t.l}</button>`).join('')}</nav>
    <div class="shell-main">
      <header class="app-header">
        <div class="h-logo">${logo}</div>
        <div style="min-width:0"><div class="h-name">${esc(S.org.name)}</div><div class="h-sub">${esc(S.org.fullName || S.member.name)}</div></div>
        <div class="h-badge"><span class="h-badge-t">${I('crown', 'sm')}${isAdmin() ? 'Guru Admin' : 'Guru Mitra'}</span></div>
      </header>
      ${subBanner()}
      <main id="main"></main>
    </div>
  </div>`;
  const sb = $('subBtn'); if (sb) sb.onclick = () => openSubscribe();
  tickTrial();
  document.querySelectorAll('.bnav').forEach(b => b.onclick = () => {
    S.tab = b.dataset.tab; S.data = null; renderShell(); // data selalu segar saat pindah menu (mis. guru baru bergabung)
  });
  renderTab();
}
function renderTab() {
  const m = $('main');
  m.classList.toggle('wide', isAdmin() && ['murid', 'keuangan'].includes(S.tab));
  if (isAdmin()) {
    if (S.tab === 'guru') return renderGuru(m);
    if (S.tab === 'absensi') return renderAdminAbsensi(m);
    if (S.tab === 'lainnya') return renderAdminLainnya(m);
    if (S.tab === 'murid') return renderMurid(m);
    if (S.tab === 'keuangan') return renderKeuangan(m);
    return placeholder(m, ['wallet', 'Keuangan', 'Segera hadir.']);
  }
}
function placeholder(m, [ic, t, d]) {
  m.innerHTML = `<div class="page-title">${t}</div><div class="page-sub">Segera hadir</div>
    <div class="card"><div class="empty"><div class="empty-ic">${I(ic)}</div><div class="empty-t">Sedang dibangun</div><div class="empty-d">${esc(d)}</div></div></div>`;
}

// ══════════════════════════════════════════════════════════════════════
// ADMIN — TAB GURU (daftar Guru Mitra & undangan)
// ══════════════════════════════════════════════════════════════════════
async function loadGuru() {
  const orgId = S.org.id;
  const [mem, inv, slots] = await Promise.all([
    getDocs(collection(db, 'orgs', orgId, 'members')),
    getDocs(query(collection(db, 'invites'), where('orgId', '==', orgId))),
    getDocs(collection(db, 'orgs', orgId, 'slots')),
  ]);
  S.guru = {
    mitras: mem.docs.map(d => Object.assign({ id: d.id }, d.data())).filter(x => x.role === 'mitra' || (x.role === 'admin' && x.teaches))
      .map(x => x.role === 'admin' ? Object.assign(x, { isSelf: true }) : x)
      .sort((a, b) => (b.isSelf ? 1 : 0) - (a.isSelf ? 1 : 0) || a.name.localeCompare(b.name)),
    invites: inv.docs.map(d => Object.assign({ id: d.id }, d.data())).filter(x => x.status === 'open').sort((a, b) => (a.slot || 0) - (b.slot || 0)),
    slots: slots.docs.map(d => Object.assign({ id: d.id }, d.data())),
  };
  return S.guru;
}
async function renderGuru(m) {
  m.innerHTML = '<div class="page-title">Guru Mitra</div><div class="page-sub">Memuat…</div>';
  let g;
  try { g = await loadGuru(); await loadPayroll(); } catch (e) { m.innerHTML = `<div class="msg msg-err">Gagal memuat: ${esc(friendlyError(e))}</div>`; return; }
  const seats = S.org.seats || 0, used = g.slots.length, full = used >= seats, oi = orgInfo();
  const meTeaches = !!(S.member && S.member.teaches);
  const mitraHtml = g.mitras.length ? g.mitras.map(x => `
    <div class="card">
      <div class="row">
        <div class="avatar">${esc(initials(x.name))}</div>
        <div class="grow"><div class="t-name">${esc(x.name)}${x.isSelf ? ' <span class="pill pill-amber">ANDA</span>' : ''}</div><div class="t-meta">${esc(x.email)}${x.isSelf ? ' · mengajar lewat aplikasi Guru Mitra' : ''}</div></div>
        <span class="pill pill-green">AKTIF</span>
      </div>
      <div class="t-meta" style="margin-top:10px;white-space:normal">${I('wallet','sm')} Honor <b style="color:var(--text)">${esc(rupiah(x.honor))}</b> / pertemuan · ${I('table','sm')} Spreadsheet absensi: ${x.sheetLink ? '<b style="color:var(--green)">sudah diisi</b>' : 'belum diisi'}</div>
      ${(() => { const pi = payInfo(x); return `<div class="t-meta" style="margin-top:4px;white-space:normal">${I('calendar','sm')} Gajian: ${pi.set ? '<b style="color:var(--text)">tanggal ' + x.payDay + '</b> tiap bulan' + (pi.due ? '' : ' · berikutnya ' + esc(fmtKey(pi.next)) + ' · berjalan ' + esc(rupiah(pi.runTotal + pi.total))) : '<span class="t-warn">belum diatur</span> (Ubah Honor & Gajian)'}</div>
        <div class="t-meta" style="margin-top:4px;white-space:normal">${I('card','sm')} Rekening: ${bankLine(x) ? '<b style="color:var(--text)">' + esc(bankLine(x)) + '</b>' : '<span class="t-warn">belum diisi guru</span>'} · ${I('chat','sm')} WA: ${x.phone ? esc(x.phone) : '<span class="t-warn">belum diisi</span>'}</div>
        ${payBtnHtml(x, pi)}`; })()}
      <div class="mini-btns">
        <button class="mini" data-honor="${esc(x.id)}">${I('edit','sm')} Ubah Honor & Gajian</button>
        ${x.sheetLink ? `<button class="mini" data-sheet="${esc(x.id)}">${I('table','sm')} Buka Spreadsheet</button>` : ''}
        ${x.isSelf ? `<button class="mini" data-openguru="1">${I('external','sm')} Buka Aplikasi Guru</button><button class="mini mini-red" data-stopself="1">Berhenti Mengajar</button>`
                   : `<button class="mini mini-red" data-kick="${esc(x.id)}">Keluarkan</button>`}
      </div>
    </div>`).join('') : '';
  // Guru Admin hanya mengurus administrasi. Kalau ia juga mengajar, ia mendaftar
  // sebagai guru (1 kursi) dan mengabsen lewat aplikasi Guru Mitra — akun Google sama.
  const selfCard = meTeaches ? '' : `
    <div class="card" style="border-style:dashed">
      <div class="row"><div class="avatar" style="background:var(--blue-bg);color:var(--blue)">${I('user')}</div>
        <div class="grow"><div class="t-name">Kamu juga mengajar?</div><div class="t-meta" style="white-space:normal">Aplikasi Admin khusus administrasi. Untuk mengajar, daftarkan dirimu sebagai Guru Mitra (memakai 1 slot), lalu pasang aplikasi <b>Guru Mitra</b> di HP — login dengan akun Google yang sama.</div></div></div>
      <button class="btn btn-ghost" id="selfTeach" ${full || !oi.active ? 'disabled' : ''} style="margin-top:12px">${I('user-plus','sm')} Saya juga mengajar</button>
    </div>`;
  const invHtml = g.invites.length ? g.invites.map(x => {
    const exp = isExpired(x);
    return `
    <div class="card" style="${exp ? 'opacity:0.8' : ''}">
      <div class="row">
        <div class="avatar" style="background:var(--blue-bg);color:var(--blue)">${I('mail')}</div>
        <div class="grow"><div class="t-name">${esc(x.name)}</div><div class="t-meta">${esc(rupiah(x.honor))} / pertemuan${x.emailLock ? ' · ' + I('lock','sm') + ' ' + esc(x.emailLock) : ''}</div></div>
        <span class="pill ${exp ? 'pill-red' : 'pill-amber'}">${exp ? 'KEDALUWARSA' : 'MENUNGGU'}</span>
      </div>
      <div class="code-box">${esc(x.id)}</div>
      <div class="t-meta" style="text-align:center;margin-top:6px">${exp ? 'Kedaluwarsa ' : 'Berlaku sampai '}${esc(fmtDate(x.expiresAt))}</div>
      <div class="mini-btns">
        ${exp ? `<button class="mini" data-renew="${esc(x.id)}">${I('refresh','sm')} Buat Kode Baru</button>`
              : `<button class="mini mini-green" data-wa="${esc(x.id)}">${I('chat','sm')} Kirim via WA</button><button class="mini" data-copy="${esc(x.id)}">${I('copy','sm')} Salin</button>`}
        <button class="mini mini-red" data-revoke="${esc(x.id)}">Cabut</button>
      </div>
    </div>`; }).join('') : '';
  m.innerHTML = `
    <div class="page-title">Guru Mitra</div>
    <div class="page-sub">Undang guru dengan kode unik — satu kode untuk satu guru</div>
    ${dueBanner(g.mitras)}
    <div class="card">
      <div class="row"><div class="grow"><div class="card-t" style="margin:0">Slot Guru Mitra</div></div><b>${used} / ${seats}</b></div>
      <div class="seat-bar"><div class="seat-fill" style="width:${seats ? Math.min(100, used / seats * 100) : 0}%;${full ? 'background:var(--amber)' : ''}"></div></div>
      <div class="t-meta" style="margin-top:8px;white-space:normal">${!oi.active ? '<span class="t-warn">Langganan habis</span> — perpanjang dulu untuk mengundang guru.' : full ? 'Slot penuh. Dapat guru baru? Tambah slot ' + esc(rupiah(BL.ORG_SLOT)) + '/bulan (5 slot ' + esc(rupiah(BL.ORG_BUNDLE_PRICE)) + ').' : 'Undangan yang belum dipakai juga menempati slot sampai dicabut.'}${S.member.teaches ? ' Kamu sendiri juga memakai 1 slot karena ikut mengajar.' : ''}</div>
      ${full || !oi.active ? `<button class="btn btn-ghost" id="addSlot" style="margin-top:12px">${I('plus', 'sm')} ${oi.active ? 'Tambah Slot Guru' : 'Perpanjang Langganan'}</button>` : ''}
    </div>
    <button class="btn btn-primary" id="addMitra" ${full || !oi.active ? 'disabled' : ''} style="margin-bottom:18px">＋ Tambah Guru Mitra</button>
    ${selfCard}
    ${g.invites.length ? `<div class="card-t">Undangan belum dipakai (${g.invites.length})</div>${invHtml}` : ''}
    <div class="card-t" style="margin-top:6px">Guru Mitra aktif (${g.mitras.length})</div>
    ${mitraHtml || '<div class="card"><div class="empty"><div class="empty-ic">'+I('users')+'</div><div class="empty-t">Belum ada Guru Mitra</div><div class="empty-d">Tekan “Tambah Guru Mitra”, lalu kirim kodenya lewat WA.</div></div></div>'}`;
  $('addMitra').onclick = openAddMitra;
  const asl = $('addSlot'); if (asl) asl.onclick = () => (orgInfo().paid && orgInfo().active ? openAddSlots() : openSubscribe());
  m.querySelectorAll('[data-wa]').forEach(b => b.onclick = () => shareInvite(g.invites.find(x => x.id === b.dataset.wa)));
  m.querySelectorAll('[data-copy]').forEach(b => b.onclick = () => copyInvite(g.invites.find(x => x.id === b.dataset.copy)));
  m.querySelectorAll('[data-revoke]').forEach(b => b.onclick = () => revokeInvite(g.invites.find(x => x.id === b.dataset.revoke)));
  m.querySelectorAll('[data-renew]').forEach(b => b.onclick = () => renewInvite(g.invites.find(x => x.id === b.dataset.renew)));
  m.querySelectorAll('[data-honor]').forEach(b => b.onclick = () => editHonor(g.mitras.find(x => x.id === b.dataset.honor)));
  m.querySelectorAll('[data-kick]').forEach(b => b.onclick = () => kickMitra(g.mitras.find(x => x.id === b.dataset.kick)));
  m.querySelectorAll('[data-sheet]').forEach(b => b.onclick = () => { const x = g.mitras.find(y => y.id === b.dataset.sheet); if (x && /^https?:\/\//i.test(x.sheetLink)) window.open(x.sheetLink, '_blank'); });
  const st = $('selfTeach'); if (st) st.onclick = openSelfTeach;
  m.querySelectorAll('[data-gaji]').forEach(b => b.onclick = () => openPayout(g.mitras.find(x => x.id === b.dataset.gaji), () => renderTab()));
  m.querySelectorAll('[data-openguru]').forEach(b => b.onclick = () => { location.href = MITRA_URL; });
  m.querySelectorAll('[data-stopself]').forEach(b => b.onclick = stopSelfTeach);
}
function openSelfTeach() {
  openModal(`
    <div class="modal-t">${I('user-plus')} Saya juga mengajar</div>
    <div class="modal-sub">Kamu akan tampil di daftar guru dan bisa diberi murid. Absensi & progres murid-muridmu diisi lewat <b>aplikasi Guru Mitra</b> (akun Google yang sama), persis seperti guru lain. Memakai 1 slot Guru Mitra.</div>
    <div class="field"><label>Honor per pertemuan untuk dirimu (Rp, opsional)</label><input id="stHonor" type="number" inputmode="numeric" min="0" step="1000" value="0"/>
      <div class="hint">Isi kalau ingin gajimu sendiri ikut tercatat di rekap honor. Boleh 0.</div></div>
    <div class="btn-row"><button class="btn btn-ghost" id="stNo">Batal</button><button class="btn btn-primary" id="stGo">${I('check','sm')} Daftarkan</button></div>`);
  $('stNo').onclick = closeModal;
  $('stGo').onclick = async () => {
    const honor = Math.max(0, parseInt($('stHonor').value, 10) || 0);
    $('stGo').disabled = true;
    try {
      const slotsSnap = await getDocs(collection(db, 'orgs', S.org.id, 'slots'));
      const taken = new Set(slotsSnap.docs.map(d => d.id));
      let slot = null; for (let i = 1; i <= (S.org.seats || 0); i++) if (!taken.has(String(i))) { slot = i; break; }
      if (!slot) throw new Error('Slot Guru Mitra sudah penuh — tambah slot dulu.');
      const b = writeBatch(db);
      b.update(doc(db, 'orgs', S.org.id, 'members', S.user.uid), { teaches: true, honor, slot });
      b.set(doc(db, 'orgs', S.org.id, 'slots', String(slot)), { kind: 'self', uid: S.user.uid });
      await b.commit();
      Object.assign(S.member, { teaches: true, honor, slot }); S.data = null;
      closeModal(); showGuruAppInfo(); renderTab();
    } catch (e) { $('stGo').disabled = false; toast('❌ ' + (e.message && !e.code ? e.message : friendlyError(e)), 4000); }
  };
}
function showGuruAppInfo() {
  const link = location.origin + location.pathname.replace(/[^/]*$/, '') + MITRA_URL;
  openModal(`
    <div class="modal-t">${I('check-circle')} Kamu terdaftar sebagai guru</div>
    <div class="modal-sub">Sekarang beri murid untukmu di menu <b>Siswa</b>. Untuk mengabsen, pasang <b>aplikasi Guru Mitra</b> di HP-mu:</div>
    <div class="msg msg-info" style="line-height:1.7">1. Buka link ini di Chrome HP:<br><b style="word-break:break-all">${esc(link)}</b><br>2. Ketuk menu ⋮ → <b>Tambahkan ke layar utama</b> / <b>Instal aplikasi</b><br>3. Di HP-mu akan ada 2 aplikasi: <b>LLK Admin</b> & <b>LLK Guru Mitra</b></div>
    <button class="btn btn-ghost" id="gaCopy">${I('copy')} Salin Link</button>
    <button class="btn btn-ghost" id="gaOpen">${I('external')} Buka Aplikasi Guru sekarang</button>
    <button class="btn btn-ghost" id="gaClose">Tutup</button>`);
  $('gaCopy').onclick = async () => { try { await navigator.clipboard.writeText(link); toast('✅ Link tersalin'); } catch (e) { prompt('Salin link ini:', link); } };
  $('gaOpen').onclick = () => { location.href = MITRA_URL; };
  $('gaClose').onclick = closeModal;
}
async function stopSelfTeach() {
  try {
    const snap = await getDocs(collection(db, 'orgs', S.org.id, 'students'));
    const n = snap.docs.filter(d => d.data().active && (d.data().classes || []).some(c => c.mitraUid === S.user.uid)).length;
    if (n) { toast('⚠️ Masih ada ' + n + ' murid aktif yang kamu ajar. Pindahkan dulu ke guru lain di menu Murid.', 5000); return; }
  } catch (e) { toast('❌ ' + friendlyError(e)); return; }
  confirmDanger({ title: 'Berhenti mengajar?', message: 'Kamu tidak lagi tampil di daftar guru. Riwayat absensimu tetap tersimpan.', confirmText: 'Berhenti Mengajar' }, async () => {
    try {
      const b = writeBatch(db);
      b.update(doc(db, 'orgs', S.org.id, 'members', S.user.uid), { teaches: false });
      if (S.member.slot != null) b.delete(doc(db, 'orgs', S.org.id, 'slots', String(S.member.slot)));
      await b.commit();
      S.member.teaches = false; S.data = null; toast('Kamu berhenti mengajar'); renderTab();
    } catch (e) { toast('❌ ' + friendlyError(e), 4000); }
  });
}

function openAddMitra() {
  openModal(`
    <div class="modal-t">＋ Tambah Guru Mitra</div>
    <div class="modal-sub">Setelah disimpan, kamu dapat kode & link undangan untuk dikirim ke guru lewat WA.</div>
    <div id="amMsg"></div>
    <div class="field"><label>Nama guru</label><input id="amName" maxlength="60" placeholder="cth: Budi Santoso"/></div>
    <div class="field"><label>Honor per pertemuan (Rp)</label><input id="amHonor" type="number" inputmode="numeric" min="0" step="1000" placeholder="cth: 30000"/>
      <div class="hint">Dihitung setiap sesi Hadir atau Alpa yang diisi guru ini.</div></div>
    <div class="field"><label>Gmail guru (opsional)</label><input id="amEmail" type="email" placeholder="cth: budi@gmail.com"/>
      <div class="hint">Kalau diisi, kode hanya bisa dipakai oleh Gmail ini (lebih aman).</div></div>
    <div class="btn-row"><button class="btn btn-ghost" id="amNo">Batal</button><button class="btn btn-primary" id="amGo">Buat Undangan</button></div>`);
  $('amNo').onclick = closeModal;
  $('amGo').onclick = async () => {
    const name = $('amName').value.trim();
    const honor = parseInt($('amHonor').value, 10);
    const email = $('amEmail').value.trim().toLowerCase();
    const err = (t) => { $('amMsg').innerHTML = `<div class="msg msg-err">${esc(t)}</div>`; };
    if (!name) return err('Nama guru wajib diisi.');
    if (!Number.isFinite(honor) || honor < 0) return err('Honor per pertemuan wajib diisi (angka).');
    if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return err('Format Gmail tidak valid.');
    $('amGo').disabled = true; $('amGo').textContent = 'Membuat…';
    try {
      const inv = await createInvite({ name, honor, emailLock: email || null });
      closeModal();
      showInviteCreated(inv);
      renderTab();
    } catch (e) {
      err(e.message === 'FULL' ? 'Slot Guru Mitra sudah penuh — tambah slot dulu.' : 'Gagal membuat undangan: ' + friendlyError(e));
      $('amGo').disabled = false; $('amGo').textContent = 'Buat Undangan';
    }
  };
}
// Buat undangan + tempati kursi kosong pertama (1..seats) dalam satu batch
async function createInvite({ name, honor, emailLock }) {
  const slotsSnap = await getDocs(collection(db, 'orgs', S.org.id, 'slots'));
  const taken = new Set(slotsSnap.docs.map(d => d.id));
  let slot = null;
  for (let i = 1; i <= (S.org.seats || 0); i++) if (!taken.has(String(i))) { slot = i; break; }
  if (!slot) throw new Error('FULL');
  for (let attempt = 0; attempt < 3; attempt++) {
    const code = genCode();
    const data = {
      orgId: S.org.id, orgName: S.org.name, name, honor, emailLock, slot, status: 'open',
      createdBy: S.user.uid, createdAt: serverTimestamp(),
      expiresAt: Timestamp.fromMillis(Date.now() + INVITE_DAYS * 864e5),
    };
    try {
      const b = writeBatch(db);
      b.set(doc(db, 'invites', code), data);
      b.set(doc(db, 'orgs', S.org.id, 'slots', String(slot)), { kind: 'invite', code });
      await b.commit();
      return Object.assign({ id: code }, data, { expiresAt: data.expiresAt });
    } catch (e) {
      if (attempt === 2) throw e; // kemungkinan kecil kode/slot bentrok → coba lagi
    }
  }
}
function inviteMessage(inv) {
  return `Halo ${inv.name} 👋\n\nKamu diundang bergabung sebagai *Guru Mitra* di *${S.org.name}* lewat aplikasi LesLesanKu.\n\n1. Buka link ini: ${inviteLink(inv.id)}\n2. Pilih *Guru Mitra* lalu login dengan akun Google${inv.emailLock ? ' (' + inv.emailLock + ')' : ''}\n3. Kode undangan: *${inv.id}*\n\nKode berlaku sampai ${fmtDate(inv.expiresAt)} dan hanya bisa dipakai sekali.`;
}
function shareInvite(inv) { if (inv) window.open('https://wa.me/?text=' + encodeURIComponent(inviteMessage(inv)), '_blank'); }
async function copyInvite(inv) {
  if (!inv) return;
  try { await navigator.clipboard.writeText(inviteMessage(inv)); toast('✅ Pesan undangan tersalin'); }
  catch (e) { prompt('Salin pesan undangan ini:', inviteMessage(inv)); }
}
function showInviteCreated(inv) {
  openModal(`
    <div class="modal-t">${I('check-circle')} Undangan untuk ${esc(inv.name)}</div>
    <div class="modal-sub">Kirim kode ini ke guru. Berlaku ${INVITE_DAYS} hari & hanya bisa dipakai sekali.</div>
    <div class="code-box" style="font-size:1.3rem;padding:14px">${esc(inv.id)}</div>
    <div class="t-meta" style="text-align:center;margin:8px 0 16px;white-space:normal;word-break:break-all">${esc(inviteLink(inv.id))}</div>
    <button class="btn btn-green" id="icWa">${I('chat')} Kirim via WhatsApp</button>
    <button class="btn btn-ghost" id="icCopy">${I('copy')} Salin Pesan</button>
    <button class="btn btn-ghost" id="icClose">Tutup</button>`);
  $('icWa').onclick = () => shareInvite(inv);
  $('icCopy').onclick = () => copyInvite(inv);
  $('icClose').onclick = closeModal;
}
function revokeInvite(inv) {
  if (!inv) return;
  confirmDanger({ title: 'Cabut undangan?', message: `Kode <b>${esc(inv.id)}</b> untuk <b>${esc(inv.name)}</b> tidak bisa dipakai lagi, dan kursinya kembali kosong.`, confirmText: 'Cabut' }, async () => {
    try {
      const b = writeBatch(db);
      b.update(doc(db, 'invites', inv.id), { status: 'revoked' });
      b.delete(doc(db, 'orgs', S.org.id, 'slots', String(inv.slot)));
      await b.commit();
      toast('Undangan dicabut'); renderTab();
    } catch (e) { toast('❌ Gagal mencabut: ' + friendlyError(e), 4000); }
  });
}
async function renewInvite(inv) {
  if (!inv) return;
  try {
    const b = writeBatch(db);
    b.update(doc(db, 'invites', inv.id), { status: 'revoked' });
    b.delete(doc(db, 'orgs', S.org.id, 'slots', String(inv.slot)));
    await b.commit();
    const n = await createInvite({ name: inv.name, honor: inv.honor, emailLock: inv.emailLock || null });
    showInviteCreated(n); renderTab();
  } catch (e) { toast('❌ Gagal membuat kode baru: ' + friendlyError(e), 4000); }
}
function editHonor(x) {
  if (!x) return;
  openModal(`
    <div class="modal-t">${I('edit')} Honor & Gajian ${esc(x.name)}</div>
    <div class="modal-sub">Honor baru berlaku untuk pertemuan berikutnya.</div>
    <div class="field"><label>Honor per pertemuan (Rp)</label><input id="ehVal" type="number" min="0" step="1000" value="${esc(x.honor)}"/></div>
    <div class="field"><label>Tanggal gajian tiap bulan</label><select id="ehPay"><option value="">Belum diatur</option>${Array.from({ length: 31 }, (_, i) => i + 1).map(d => `<option value="${d}" ${x.payDay === d ? 'selected' : ''}>Tanggal ${d}${d >= 29 ? ' (bulan pendek → hari terakhir)' : ''}</option>`).join('')}</select>
      <div class="hint">Pada tanggal ini muncul tombol <b>Bayar Gaji</b> untuk pertemuan sampai sehari sebelumnya.</div></div>
    <div class="btn-row"><button class="btn btn-ghost" id="ehNo">Batal</button><button class="btn btn-primary" id="ehGo">Simpan</button></div>`);
  $('ehNo').onclick = closeModal;
  $('ehGo').onclick = async () => {
    const v = parseInt($('ehVal').value, 10);
    if (!Number.isFinite(v) || v < 0) { toast('Honor harus angka'); return; }
    const pd = $('ehPay').value ? parseInt($('ehPay').value, 10) : null;
    // payDaySince: tanggal gajian mulai berlaku → hari gajian sebelum tanggal ini tidak dianggap terlambat
    const upd = { honor: v, payDay: pd };
    if (pd !== (x.payDay || null)) upd.payDaySince = pd ? localKey(new Date()) : null;
    try { await updateDoc(doc(db, 'orgs', S.org.id, 'members', x.id), upd); closeModal(); toast('✅ Honor & tanggal gajian disimpan'); renderTab(); }
    catch (e) { toast('❌ ' + friendlyError(e)); }
  };
}
function kickMitra(x) {
  if (!x) return;
  confirmDanger({
    title: 'Keluarkan ' + x.name + '?',
    message: `${esc(x.name)} langsung kehilangan akses ke lembaga ini. Riwayat absensi & catatan yang pernah diisinya <b>tetap tersimpan</b> di lembaga. Kursinya kembali kosong.`,
    confirmText: 'Keluarkan', typeWord: 'KELUAR'
  }, async () => {
    try {
      const b = writeBatch(db);
      b.delete(doc(db, 'orgs', S.org.id, 'members', x.id));
      if (x.slot) b.delete(doc(db, 'orgs', S.org.id, 'slots', String(x.slot)));
      await b.commit();
      toast(x.name + ' dikeluarkan'); renderTab();
    } catch (e) { toast('❌ Gagal: ' + friendlyError(e), 4000); }
  });
}

// ══════════════════════════════════════════════════════════════════════
// TAHAP 2 — ADMIN: MURID, KELAS, JADWAL MINGGUAN, MATA PELAJARAN
// Data:
//   orgs/{org}/subjects/{id}  {name, rate, active}            — hanya Admin
//   orgs/{org}/students/{id}  {name, parentName, phone, note, active, source,
//                              classes:[{id, subjectId, mitraUid, rate|null,
//                                        schedule:[{day,start,end}]}]} — hanya Admin
//   orgs/{org}/sched/{classId} salinan ringkas per kelas untuk Guru Mitra
//                              (tanpa No HP & tarif), ditulis bersamaan.
// ══════════════════════════════════════════════════════════════════════
const DAYS = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
const DAY_SHORT = { Senin: 'Sen', Selasa: 'Sel', Rabu: 'Rab', Kamis: 'Kam', Jumat: 'Jum', Sabtu: 'Sab', Minggu: 'Min' };
const GURU_COLORS = ['#a8372a', '#2f5a8a', '#2a7349', '#a65510', '#6b3fa0', '#0f7c86', '#9c2f6b', '#5b6b1f'];
function newId() { return doc(collection(db, 'orgs', S.org.id, 'students')).id; }
function toMin(t) { const m = /^(\d{1,2}):(\d{2})$/.exec(t || ''); return m ? (+m[1]) * 60 + (+m[2]) : null; }
function slotTxt(x) { return (DAY_SHORT[x.day] || x.day) + ' ' + (x.start || '?') + (x.end ? '–' + x.end : ''); }
function byDayTime(a, b) { return DAYS.indexOf(a.day) - DAYS.indexOf(b.day) || String(a.start).localeCompare(String(b.start)); }

async function loadOrgData(force) {
  if (S.data && !force) return S.data;
  const o = S.org.id;
  const [sub, stu, mem] = await Promise.all([
    getDocs(collection(db, 'orgs', o, 'subjects')),
    getDocs(collection(db, 'orgs', o, 'students')),
    getDocs(collection(db, 'orgs', o, 'members')),
  ]);
  // Daftar guru = Guru Mitra + Guru Admin yang juga terdaftar mengajar (lewat aplikasi Guru Mitra)
  const all = mem.docs.map(d => Object.assign({ id: d.id }, d.data()));
  const mitras = all.filter(x => x.role === 'mitra' || (x.role === 'admin' && x.teaches))
    .map(x => x.role === 'admin' ? Object.assign(x, { name: (x.name || 'Saya') + ' (Anda)', isSelf: true }) : x)
    .sort((a, b) => (b.isSelf ? 1 : 0) - (a.isSelf ? 1 : 0) || a.name.localeCompare(b.name));
  S.data = {
    subjects: sub.docs.map(d => Object.assign({ id: d.id }, d.data())).sort((a, b) => a.name.localeCompare(b.name)),
    students: stu.docs.map(d => Object.assign({ id: d.id }, d.data())).sort((a, b) => a.name.localeCompare(b.name)),
    mitras,
  };
  S.data.mitras.forEach((x, i) => { x.color = GURU_COLORS[i % GURU_COLORS.length]; });
  return S.data;
}
const subjOf = (id) => (S.data.subjects.find(x => x.id === id) || null);
const mitraOf = (uid) => (uid ? S.data.mitras.find(x => x.id === uid) || null : null);
function guruLabel(uid) {
  if (!uid) return '<span class="t-warn">Belum ada guru</span>';
  const g = mitraOf(uid);
  return g ? `<span class="g-dot" style="background:${g.color}"></span>${esc(g.name)}` : '<span class="t-warn">Guru sudah keluar</span>';
}
function rateOf(c) { if (c.rate != null) return c.rate; const sj = subjOf(c.subjectId); return sj ? sj.rate : 0; }

// Data ringkas untuk Guru Mitra — TIDAK berisi No HP/tarif (dijaga juga oleh firestore.rules)
function schedDoc(st, c) {
  const sj = subjOf(c.subjectId);
  return { studentId: st.id, studentName: st.name, subjectId: c.subjectId, subjectName: sj ? sj.name : '', mitraUid: c.mitraUid || null,
    schedule: (c.schedule || []).map(x => ({ day: x.day, start: x.start || '', end: x.end || '' })), active: !!st.active, updatedAt: serverTimestamp() };
}
// Simpan beberapa operasi dalam beberapa batch (batas Firestore 500 per batch)
// Riwayat absensi (progres, PR) ikut terlihat oleh guru yang SEKARANG mengajar kelas itu.
// att.mitraUid = guru yang mengisi (untuk honor, tidak berubah); att.teachUid = guru kelas saat ini.
// Dijalankan setelah siswa dipindah ke guru lain, dan sekali saat aplikasi Admin dibuka
// (memperbaiki riwayat lama yang belum punya teachUid).
async function syncAttTeach() {
  try {
    const d = await loadOrgData(), cur = new Map();
    d.students.forEach(st => (st.classes || []).forEach(c => cur.set(c.id, c.mitraUid || null)));
    const snap = await getDocs(collection(db, 'orgs', S.org.id, 'att'));
    const ops = [];
    snap.docs.forEach(x => {
      const a = x.data(); if (!cur.has(a.classId)) return;
      const want = cur.get(a.classId);
      if ((a.teachUid === undefined ? a.mitraUid : a.teachUid) === want && a.teachUid !== undefined) return;
      ops.push(['set', x.ref, Object.assign({}, a, { teachUid: want })]);
    });
    if (ops.length) await commitOps(ops);
  } catch (e) { console.warn('syncAttTeach:', e); }
}
async function commitOps(ops) {
  for (let i = 0; i < ops.length; i += 400) {
    const b = writeBatch(db);
    ops.slice(i, i + 400).forEach(([kind, ref, data]) => kind === 'del' ? b.delete(ref) : b.set(ref, data));
    await b.commit();
  }
}

async function renderMurid(m) {
  m.innerHTML = '<div class="page-title">Siswa</div><div class="page-sub">Memuat…</div>';
  try { await loadOrgData(); } catch (e) { m.innerHTML = `<div class="msg msg-err">Gagal memuat: ${esc(friendlyError(e))}</div>`; return; }
  const views = [['daftar', 'users', 'Daftar Siswa'], ['jadwal', 'calendar', 'Jadwal Mingguan'], ['pelajaran', 'book-open', 'Mata Pelajaran']];
  m.innerHTML = `
    <div class="page-head">
      <div><div class="page-title">Siswa</div><div class="page-sub" id="mSub"></div></div>
    </div>
    <div class="seg">${views.map(([k, i, l]) => `<button class="seg-b ${S.muridView === k ? 'on' : ''}" data-view="${k}">${I(i, 'sm')} ${l}</button>`).join('')}</div>
    <div id="mBody"></div>`;
  m.querySelectorAll('[data-view]').forEach(b => b.onclick = () => { S.muridView = b.dataset.view; renderMurid(m); });
  const d = S.data, act = d.students.filter(x => x.active);
  const nKelas = act.reduce((n, x) => n + (x.classes || []).length, 0);
  const noGuru = act.reduce((n, x) => n + (x.classes || []).filter(c => !mitraOf(c.mitraUid)).length, 0);
  $('mSub').innerHTML = `${act.length} siswa aktif · ${nKelas} kelas${noGuru ? ` · <span class="t-warn">${noGuru} kelas belum ada guru</span>` : ''}`;
  const body = $('mBody');
  if (S.muridView === 'jadwal') return renderJadwalMingguan(body);
  if (S.muridView === 'pelajaran') return renderPelajaran(body);
  return renderDaftarMurid(body);
}
function rerenderMurid() { const m = $('main'); if (m && S.tab === 'murid') renderMurid(m); }

// ── Daftar Murid ──
function renderDaftarMurid(body) {
  const d = S.data, f = S.filt;
  const opt = (v, l, cur) => `<option value="${esc(v)}" ${cur === v ? 'selected' : ''}>${esc(l)}</option>`;
  body.innerHTML = `
    ${d.subjects.length ? '' : `<div class="callout">${I('info')}<div><b>Mulai dari Mata Pelajaran.</b> Tambahkan pelajaran & tarif standarnya dulu (mis. Piano Rp 50.000), lalu tambahkan murid. <button class="link-btn" id="goPel">Buka Mata Pelajaran →</button></div></div>`}
    <div class="toolbar">
      <div class="search">${I('search', 'sm')}<input id="fQ" placeholder="Cari nama siswa / ortu…" value="${esc(f.q)}"/></div>
      <select id="fGuru">${opt('', 'Semua guru', f.guru)}${d.mitras.map(x => opt(x.id, x.name, f.guru)).join('')}${opt('none', 'Belum punya guru', f.guru)}</select>
      <select id="fSubj">${opt('', 'Semua pelajaran', f.subj)}${d.subjects.map(x => opt(x.id, x.name, f.subj)).join('')}</select>
      <select id="fStat">${opt('aktif', 'Aktif', f.status)}${opt('nonaktif', 'Nonaktif', f.status)}${opt('semua', 'Semua status', f.status)}</select>
      <button class="btn btn-ghost tb-btn" id="impV1">${I('download', 'sm')} Impor dari LLK V1</button>
      <button class="btn btn-primary tb-btn" id="addStu" ${d.subjects.length ? '' : 'disabled'}>${I('plus', 'sm')} Tambah Siswa</button>
    </div>
    <div class="chips" id="fChips"></div>
    <div id="stuList"></div>`;
  const g = $('goPel'); if (g) g.onclick = () => { S.muridView = 'pelajaran'; rerenderMurid(); };
  $('fQ').oninput = (e) => { f.q = e.target.value; drawStudentList(); };
  $('fGuru').onchange = (e) => { f.guru = e.target.value; drawStudentList(); };
  // Tombol cepat "Belum punya guru" (sama dengan pilihan di daftar guru)
  $('fChips').onclick = (e) => { const b = e.target.closest('[data-chip]'); if (!b) return; f.guru = b.dataset.chip === 'none' && f.guru !== 'none' ? 'none' : ''; $('fGuru').value = f.guru; S.sel.clear(); drawStudentList(); };
  $('fSubj').onchange = (e) => { f.subj = e.target.value; drawStudentList(); };
  $('fStat').onchange = (e) => { f.status = e.target.value; drawStudentList(); };
  $('addStu').onclick = () => openStudentForm(null);
  $('impV1').onclick = openImportV1;
  drawStudentList();
}
// Kelas yang cocok dengan filter pelajaran & guru (dipakai juga saat menugaskan sekaligus)
function classMatch(c) {
  const f = S.filt;
  if (f.subj && c.subjectId !== f.subj) return false;
  if (f.guru === 'none' && mitraOf(c.mitraUid)) return false;
  if (f.guru && f.guru !== 'none' && c.mitraUid !== f.guru) return false;
  return true;
}
function filteredStudents() {
  const f = S.filt, q = f.q.trim().toLowerCase();
  return S.data.students.filter(st => {
    if (f.status === 'aktif' && !st.active) return false;
    if (f.status === 'nonaktif' && st.active) return false;
    if (q && !(st.name.toLowerCase().includes(q) || String(st.parentName || '').toLowerCase().includes(q))) return false;
    if ((f.subj || f.guru) && !(st.classes || []).some(classMatch)) return false;
    return true;
  });
}
function drawStudentList() {
  const box = $('stuList'); if (!box) return;
  const list = filteredStudents();
  const ch = $('fChips');
  if (ch) {
    const nNo = S.data.students.filter(st => st.active && (st.classes || []).some(c => !mitraOf(c.mitraUid))).length;
    ch.innerHTML = `<button class="chip ${S.filt.guru === 'none' ? 'on' : ''}" data-chip="none">${I('user-plus', 'sm')} Belum punya guru <span class="chip-n">${nNo}</span></button>`;
  }
  if (!list.length && S.filt.guru === 'none' && !S.filt.q && S.data.students.length) {
    box.innerHTML = `<div class="card"><div class="empty"><div class="empty-ic">${I('check-circle')}</div><div class="empty-t">Semua siswa sudah punya guru</div><div class="empty-d">Tidak ada kelas yang menunggu guru${S.filt.subj ? ' untuk pelajaran ini' : ''}.</div></div></div>`;
    return;
  }
  if (!list.length) {
    box.innerHTML = `<div class="card"><div class="empty"><div class="empty-ic">${I('users')}</div><div class="empty-t">${S.data.students.length ? 'Tidak ada siswa yang cocok' : 'Belum ada siswa'}</div><div class="empty-d">${S.data.students.length ? 'Ubah pencarian atau filter di atas.' : 'Tekan “Tambah Siswa”, atau salin dari LLK V1 dengan “Impor dari LLK V1”.'}</div></div></div>`;
    return;
  }
  const row = st => {
    const cl = st.classes || [];
    const kelas = cl.map(c => { const sj = subjOf(c.subjectId); return `<div class="cl-line"><b>${esc(sj ? sj.name : '—')}</b> · ${guruLabel(c.mitraUid)}</div>`; }).join('');
    const jadwal = cl.map(c => `<div class="cl-line">${esc((c.schedule || []).slice().sort(byDayTime).map(slotTxt).join(', ') || '—')}</div>`).join('');
    const tarif = cl.map(c => `<div class="cl-line">${esc(rupiah(rateOf(c)))}${c.rate != null ? ' <span class="pill pill-amber">KHUSUS</span>' : ''}</div>`).join('');
    return `<tr data-stu="${esc(st.id)}" class="${st.active ? '' : 'is-off'}${S.sel.has(st.id) ? ' is-sel' : ''}">
      <td class="td-chk"><input type="checkbox" data-sel="${esc(st.id)}" ${S.sel.has(st.id) ? 'checked' : ''} aria-label="Pilih ${esc(st.name)}"/></td>
      <td><div class="t-name">${esc(st.name)}</div><div class="t-meta">${esc(st.parentName || '')}</div></td>
      <td>${kelas || '—'}</td><td>${jadwal || '—'}</td><td>${tarif || '—'}</td>
      <td>${st.phone ? esc(st.phone) : '<span class="t-meta">—</span>'}</td>
      <td>${st.active ? '<span class="pill pill-green">AKTIF</span>' : '<span class="pill pill-grey">NONAKTIF</span>'}</td>
      <td class="td-act"><button class="mini" data-edit="${esc(st.id)}">${I('edit', 'sm')} Ubah</button></td></tr>`;
  };
  // Kartu ala LLK V1 (HP) — tabel tetap untuk layar lebar
  const card = st => {
    const cl = st.classes || [], on = S.sel.has(st.id);
    const first = cl.length ? subjOf(cl[0].subjectId) : null;
    const lines = cl.map(c => {
      const sj = subjOf(c.subjectId), jd = (c.schedule || []).slice().sort(byDayTime).map(slotTxt).join(', ');
      return `<div class="stu-line">${jd ? esc(jd) + ' · ' : ''}<b>${esc(sj ? sj.name : '—')}</b></div><div class="stu-guru">${I('user', 'sm')} ${guruLabel(c.mitraUid)}</div>`;
    }).join('');
    return `<div class="stu-card${st.active ? '' : ' is-off'}${on ? ' is-sel' : ''}" data-stu="${esc(st.id)}">
      <label class="stu-chk" aria-label="Pilih ${esc(st.name)}"><input type="checkbox" data-sel="${esc(st.id)}" ${on ? 'checked' : ''}/><span class="chk-box">${I('check', 'sm')}</span></label>
      <div class="track-avatar">${subjectIcon(first ? first.name : '')}</div>
      <div class="grow" style="min-width:0">
        <div class="stu-name">${esc(st.name)}${st.active ? '' : ' <span class="pill pill-grey">NONAKTIF</span>'}</div>
        ${lines || '<div class="stu-line">Belum ada kelas</div>'}
      </div>
      <span class="stu-arrow">${I('chevron-right')}</span>
    </div>`;
  };
  // Pilih beberapa siswa → tugaskan ke 1 guru sekaligus (membagi siswa ke guru-guru)
  const nSel = list.filter(x => S.sel.has(x.id)).length, allOn = nSel === list.length;
  const fSubj = S.filt.subj ? subjOf(S.filt.subj) : null, fNone = S.filt.guru === 'none';
  const selBar = `<div class="sel-bar">
      <label class="sel-all"><input type="checkbox" id="selAll" ${allOn ? 'checked' : ''}/><span class="chk-box">${I('check', 'sm')}</span> Centang semua (${list.length})</label>
      <span class="t-meta">${nSel ? `<b style="color:var(--text)">${nSel} siswa dipilih</b>` : 'Centang siswa untuk menugaskan ke satu guru sekaligus'}</span></div>`;
  const bulk = nSel ? `<div class="bulk-bar"><b>${nSel} siswa dipilih</b>
      <select id="bkGuru"><option value="">Tugaskan ${fSubj ? 'kelas ' + esc(fSubj.name) + ' ' : ''}ke guru…</option>${S.data.mitras.map(g => `<option value="${esc(g.id)}">${esc(g.name)}</option>`).join('')}<option value="__none">Belum ditentukan</option></select>
      <button class="btn btn-primary tb-btn" id="bkGo">${I('check', 'sm')} Terapkan</button>
      <button class="btn btn-ghost tb-btn" id="bkNo">Batal pilih</button>
      ${fSubj || fNone ? `<div class="t-meta" style="flex-basis:100%;white-space:normal">Hanya kelas ${fSubj ? '<b>' + esc(fSubj.name) + '</b> ' : ''}${fNone ? 'yang <b>belum punya guru</b> ' : ''}yang ditugaskan; kelas lain siswa itu tetap pada gurunya.</div>` : ''}</div>` : '';
  const wide = window.matchMedia('(min-width: 900px)').matches;
  box.innerHTML = selBar + bulk + (wide ? `<div class="tbl-wrap"><table class="tbl">
    <thead><tr><th class="td-chk"></th><th>Siswa</th><th>Pelajaran & Guru</th><th>Jadwal</th><th>Tarif / pertemuan</th><th>No HP ortu</th><th>Status</th><th></th></tr></thead>
    <tbody>${list.map(row).join('')}</tbody></table></div>` : `<div class="stu-cards">${list.map(card).join('')}</div>`) + `
    <div class="t-meta" style="margin-top:8px">${list.length} siswa ditampilkan</div>`;
  box.querySelectorAll('[data-stu]').forEach(el => el.onclick = (e) => {
    if (e.target.closest('.td-chk, .stu-chk')) return;
    openStudentForm(S.data.students.find(x => x.id === el.dataset.stu));
  });
  box.querySelectorAll('[data-sel]').forEach(c => c.onchange = () => { c.checked ? S.sel.add(c.dataset.sel) : S.sel.delete(c.dataset.sel); drawStudentList(); });
  box.querySelectorAll('.td-chk').forEach(td => td.onclick = (e) => { if (e.target.tagName !== 'INPUT') { const c = td.querySelector('input'); c.checked = !c.checked; c.dispatchEvent(new Event('change')); } });
  $('selAll').onchange = (e) => { list.forEach(x => e.target.checked ? S.sel.add(x.id) : S.sel.delete(x.id)); drawStudentList(); };
  if (nSel) {
    $('bkNo').onclick = () => { S.sel.clear(); drawStudentList(); };
    $('bkGo').onclick = () => bulkAssign(list.filter(x => S.sel.has(x.id)), $('bkGuru').value);
  }
  // Ganti tampilan kartu/tabel kalau lebar layar berubah (putar HP / ubah ukuran jendela)
  if (!drawStudentList.mq) { drawStudentList.mq = window.matchMedia('(min-width: 900px)'); drawStudentList.mq.addEventListener('change', () => drawStudentList()); }
}
// Hanya kelas yang cocok dengan filter (pelajaran / guru / belum punya guru) yang dipindah ke guru baru
async function bulkAssign(list, guru) {
  if (!guru) { toast('Pilih gurunya dulu'); return; }
  const uid = guru === '__none' ? null : guru, o = S.org.id, ops = [];
  list.forEach(st => {
    const classes = (st.classes || []).map(c => classMatch(c) ? Object.assign({}, c, { mitraUid: uid }) : c);
    ops.push(['set', doc(db, 'orgs', o, 'students', st.id), Object.assign({}, st, { classes, updatedAt: serverTimestamp() })]);
    classes.forEach(c => ops.push(['set', doc(db, 'orgs', o, 'sched', c.id), schedDoc(st, c)]));
  });
  // Field id hanya untuk tampilan, jangan ikut tersimpan
  ops.forEach(op => { if (op[2] && 'id' in op[2] && op[1].path.includes('/students/')) delete op[2].id; });
  $('bkGo').disabled = true;
  try {
    await commitOps(ops);
    const g = mitraOf(uid);
    toast('✅ ' + list.length + ' siswa ditugaskan ke ' + (g ? g.name : 'belum ditentukan'));
    S.sel.clear(); await loadOrgData(true); rerenderMurid(); syncAttTeach();
  } catch (e) { console.error(e); $('bkGo').disabled = false; toast('❌ Gagal: ' + friendlyError(e), 4000); }
}

// ── Form murid (bisa banyak kelas) ──
let F = null; // state form yang sedang dibuka
function openStudentForm(st) {
  const d = S.data;
  F = st ? JSON.parse(JSON.stringify(st)) : { id: null, name: '', parentName: '', phone: '', note: '', active: true, classes: [] };
  if (!F.classes.length) F.classes.push(blankClass());
  const ov = openModal(`
    <div class="modal-t">${I(st ? 'edit' : 'user-plus')} ${st ? 'Ubah Siswa' : 'Tambah Siswa'}</div>
    <div class="modal-sub">No HP ortu & tarif hanya terlihat oleh Guru Admin. Guru Mitra hanya melihat nama murid, pelajaran & jadwalnya.</div>
    <div id="sfMsg"></div>
    <div class="grid2">
      <div class="field"><label>Nama murid</label><input id="sfName" maxlength="80" value="${esc(F.name)}" placeholder="cth: Brilian"/></div>
      <div class="field"><label>Nama ortu (opsional)</label><input id="sfParent" maxlength="80" value="${esc(F.parentName || '')}" placeholder="cth: Bu Rina"/></div>
      <div class="field"><label>No HP / WA ortu</label><input id="sfPhone" type="tel" inputmode="tel" maxlength="20" value="${esc(F.phone || '')}" placeholder="cth: 0812xxxx"/></div>
      <div class="field"><label>Status</label><select id="sfActive"><option value="1" ${F.active ? 'selected' : ''}>Aktif</option><option value="0" ${F.active ? '' : 'selected'}>Nonaktif (berhenti les)</option></select></div>
    </div>
    <div class="field"><label>Catatan (opsional)</label><input id="sfNote" maxlength="200" value="${esc(F.note || '')}"/></div>
    <div class="card-t" style="margin-top:6px">${I('book-open', 'sm')} Kelas yang diikuti</div>
    <div id="sfClasses"></div>
    <button class="btn btn-ghost" id="sfAddClass" style="margin-bottom:14px">${I('plus', 'sm')} Tambah Kelas (pelajaran lain)</button>
    <div class="btn-row">
      ${st ? `<button class="btn btn-danger" id="sfDel" style="flex:0 0 auto;width:auto;padding:0 16px">${I('trash', 'sm')}</button>` : ''}
      <button class="btn btn-ghost" id="sfNo">Batal</button><button class="btn btn-primary" id="sfGo">${I('check', 'sm')} Simpan</button>
    </div>`);
  ov.querySelector('.modal').classList.add('modal-wide');
  drawClasses();
  $('sfAddClass').onclick = () => { readForm(); F.classes.push(blankClass()); drawClasses(); };
  $('sfNo').onclick = closeModal;
  $('sfGo').onclick = saveStudent;
  const del = $('sfDel'); if (del) del.onclick = () => deleteStudent(st);
}
function blankClass() { return { id: newId(), subjectId: (S.data.subjects.find(x => x.active !== false) || {}).id || '', mitraUid: null, rate: null, schedule: [{ day: 'Senin', start: '', end: '' }] }; }
function drawClasses() {
  const d = S.data, box = $('sfClasses');
  box.innerHTML = F.classes.map((c, ci) => {
    const sj = subjOf(c.subjectId);
    const subjOpts = d.subjects.filter(x => x.active !== false || x.id === c.subjectId).map(x => `<option value="${esc(x.id)}" ${x.id === c.subjectId ? 'selected' : ''}>${esc(x.name)}</option>`).join('');
    const guruOpts = `<option value="">Belum ditentukan</option>` + d.mitras.map(x => `<option value="${esc(x.id)}" ${x.id === c.mitraUid ? 'selected' : ''}>${esc(x.name)}</option>`).join('')
      + (c.mitraUid && !mitraOf(c.mitraUid) ? `<option value="${esc(c.mitraUid)}" selected>(guru sudah keluar)</option>` : '');
    const slots = c.schedule.map((x, si) => `
      <div class="slot-row">
        <select data-c="${ci}" data-s="${si}" data-k="day">${DAYS.map(dn => `<option ${dn === x.day ? 'selected' : ''}>${dn}</option>`).join('')}</select>
        <input type="time" data-c="${ci}" data-s="${si}" data-k="start" value="${esc(x.start)}" aria-label="Jam mulai"/>
        <span class="t-meta">s/d</span>
        <input type="time" data-c="${ci}" data-s="${si}" data-k="end" value="${esc(x.end)}" aria-label="Jam selesai"/>
        <button class="icon-btn" data-delslot="${ci}:${si}" title="Hapus hari ini" ${c.schedule.length < 2 ? 'disabled' : ''}>${I('x', 'sm')}</button>
      </div>`).join('');
    return `<div class="class-card">
      <div class="row" style="margin-bottom:10px"><div class="grow card-t" style="margin:0">Kelas ${ci + 1}</div>
        ${F.classes.length > 1 ? `<button class="mini mini-red" data-delclass="${ci}" style="flex:0 0 auto">${I('trash', 'sm')} Hapus kelas</button>` : ''}</div>
      <div class="grid3">
        <div class="field"><label>Pelajaran</label><select data-c="${ci}" data-k="subjectId">${subjOpts || '<option value="">(belum ada pelajaran)</option>'}</select></div>
        <div class="field"><label>Guru</label><select data-c="${ci}" data-k="mitraUid">${guruOpts}</select></div>
        <div class="field"><label>Tarif khusus (opsional)</label><input type="number" inputmode="numeric" min="0" step="1000" data-c="${ci}" data-k="rate" value="${c.rate != null ? esc(c.rate) : ''}" placeholder="Standar ${esc(rupiah(sj ? sj.rate : 0))}"/></div>
      </div>
      <label class="mini-label">Jadwal rutin</label>
      ${slots}
      <button class="link-btn" data-addslot="${ci}">${I('plus', 'sm')} Tambah hari</button>
    </div>`;
  }).join('');
  box.querySelectorAll('[data-delclass]').forEach(b => b.onclick = () => { readForm(); F.classes.splice(+b.dataset.delclass, 1); drawClasses(); });
  box.querySelectorAll('[data-addslot]').forEach(b => b.onclick = () => { readForm(); const c = F.classes[+b.dataset.addslot]; const last = c.schedule[c.schedule.length - 1] || {}; c.schedule.push({ day: 'Senin', start: last.start || '', end: last.end || '' }); drawClasses(); });
  box.querySelectorAll('[data-delslot]').forEach(b => b.onclick = () => { readForm(); const [ci, si] = b.dataset.delslot.split(':').map(Number); F.classes[ci].schedule.splice(si, 1); drawClasses(); });
  box.querySelectorAll('select[data-k="subjectId"]').forEach(sel => sel.onchange = () => { readForm(); drawClasses(); }); // perbarui placeholder tarif standar
}
function readForm() {
  F.name = $('sfName').value.trim(); F.parentName = $('sfParent').value.trim(); F.phone = $('sfPhone').value.trim();
  F.note = $('sfNote').value.trim(); F.active = $('sfActive').value === '1';
  document.querySelectorAll('#sfClasses [data-c]').forEach(el => {
    const c = F.classes[+el.dataset.c], k = el.dataset.k;
    if (el.dataset.s != null) { c.schedule[+el.dataset.s][k] = el.value; return; }
    if (k === 'rate') { const v = el.value.trim(); c.rate = v === '' ? null : Math.max(0, parseInt(v, 10) || 0); }
    else if (k === 'mitraUid') c.mitraUid = el.value || null;
    else c[k] = el.value;
  });
}
async function saveStudent() {
  readForm();
  const err = (t) => { $('sfMsg').innerHTML = `<div class="msg msg-err">${esc(t)}</div>`; $('sfMsg').scrollIntoView({ block: 'nearest' }); };
  if (!F.name) return err('Nama murid wajib diisi.');
  const dup = S.data.students.find(x => x.id !== F.id && x.name.trim().toLowerCase() === F.name.toLowerCase());
  if (dup) return err('Sudah ada murid bernama "' + dup.name + '". Tambahkan inisial supaya berbeda.');
  if (!F.classes.length) return err('Tambahkan minimal 1 kelas.');
  for (let i = 0; i < F.classes.length; i++) {
    const c = F.classes[i];
    if (!c.subjectId) return err('Kelas ' + (i + 1) + ': pilih pelajarannya.');
    if (!c.schedule.length || c.schedule.some(x => !x.day || !x.start)) return err('Kelas ' + (i + 1) + ': isi hari & jam mulai setiap jadwal.');
    if (c.schedule.some(x => x.end && toMin(x.end) <= toMin(x.start))) return err('Kelas ' + (i + 1) + ': jam selesai harus setelah jam mulai.');
  }
  const btn = $('sfGo'); btn.disabled = true;
  const o = S.org.id, isNew = !F.id;
  if (isNew) F.id = newId();
  const old = S.data.students.find(x => x.id === F.id);
  const data = { name: F.name, parentName: F.parentName, phone: F.phone, note: F.note, active: F.active,
    classes: F.classes.map(c => ({ id: c.id, subjectId: c.subjectId, mitraUid: c.mitraUid || null, rate: c.rate, schedule: c.schedule.map(x => ({ day: x.day, start: x.start, end: x.end || '' })).sort(byDayTime) })),
    source: (old && old.source) || 'manual', updatedAt: serverTimestamp() };
  if (isNew) data.createdAt = serverTimestamp(); else if (old && old.createdAt) data.createdAt = old.createdAt;
  const ops = [['set', doc(db, 'orgs', o, 'students', F.id), data]];
  data.classes.forEach(c => ops.push(['set', doc(db, 'orgs', o, 'sched', c.id), schedDoc({ id: F.id, name: F.name, active: F.active }, c)]));
  (old ? old.classes || [] : []).filter(c => !data.classes.some(n => n.id === c.id)).forEach(c => ops.push(['del', doc(db, 'orgs', o, 'sched', c.id)]));
  try {
    await commitOps(ops);
    closeModal(); toast('✅ ' + F.name + (isNew ? ' ditambahkan' : ' disimpan'));
    await loadOrgData(true); rerenderMurid(); if (!isNew) syncAttTeach();
  } catch (e) { console.error(e); if (isNew) F.id = null; btn.disabled = false; err('Gagal menyimpan: ' + friendlyError(e)); }
}
function deleteStudent(st) {
  confirmDanger({ title: 'Hapus ' + st.name + '?', message: `Data murid & semua jadwal kelasnya dihapus permanen. <b>Kalau murid hanya berhenti les, pilih Status “Nonaktif”</b> supaya datanya tetap tersimpan.`, confirmText: 'Hapus Permanen', typeWord: 'HAPUS' }, async () => {
    try {
      const o = S.org.id;
      await commitOps([['del', doc(db, 'orgs', o, 'students', st.id)], ...(st.classes || []).map(c => ['del', doc(db, 'orgs', o, 'sched', c.id)])]);
      toast(st.name + ' dihapus'); await loadOrgData(true); rerenderMurid();
    } catch (e) { toast('❌ Gagal menghapus: ' + friendlyError(e), 4000); }
  });
}

// ── Jadwal Mingguan (semua guru) ──
function weekSessions() {
  const out = [];
  S.data.students.filter(st => st.active).forEach(st => (st.classes || []).forEach(c => (c.schedule || []).forEach(x => {
    const s0 = toMin(x.start); if (s0 == null) return;
    const e0 = toMin(x.end); const sj = subjOf(c.subjectId);
    out.push({ day: x.day, start: x.start, end: x.end, s: s0, e: e0 != null && e0 > s0 ? e0 : s0 + 60, st, c, subj: sj ? sj.name : '—', uid: mitraOf(c.mitraUid) ? c.mitraUid : null });
  })));
  // Bentrok: guru yang sama, hari sama, jam bertumpuk
  out.forEach(a => { a.clash = !!a.uid && out.some(b => b !== a && b.uid === a.uid && b.day === a.day && a.s < b.e && b.s < a.e); });
  return out.sort((a, b) => DAYS.indexOf(a.day) - DAYS.indexOf(b.day) || a.s - b.s);
}
function renderJadwalMingguan(body) {
  const d = S.data, all = weekSessions();
  const gf = S.schedGuru;
  const list = all.filter(x => !gf || (gf === 'none' ? !x.uid : x.uid === gf));
  const clashes = all.filter(x => x.clash).length;
  const perGuru = d.mitras.map(g => ({ g, n: all.filter(x => x.uid === g.id).length }));
  const noGuru = all.filter(x => !x.uid).length;
  body.innerHTML = `
    <div class="toolbar">
      <select id="jgGuru"><option value="">Semua guru</option>${d.mitras.map(x => `<option value="${esc(x.id)}" ${gf === x.id ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}<option value="none" ${gf === 'none' ? 'selected' : ''}>Belum ada guru</option></select>
      <div class="chips">${perGuru.map(({ g, n }) => `<span class="chip"><span class="g-dot" style="background:${g.color}"></span>${esc(g.name)} · ${n} sesi/minggu</span>`).join('')}${noGuru ? `<span class="chip chip-warn">Belum ada guru · ${noGuru}</span>` : ''}</div>
    </div>
    ${clashes ? `<div class="msg msg-err">${I('alert', 'sm')} Ada <b>${clashes} sesi bentrok</b>: guru yang sama punya 2 murid di jam yang bertumpuk. Ditandai merah di bawah.</div>` : ''}
    ${all.length ? `<div class="week">${DAYS.map(dn => {
      const items = list.filter(x => x.day === dn);
      return `<div class="week-col"><div class="week-h">${dn}<span>${items.length}</span></div>
        ${items.map(x => { const g = mitraOf(x.uid); return `<button class="sess ${x.clash ? 'clash' : ''}" data-stu="${esc(x.st.id)}" style="border-left-color:${g ? g.color : 'var(--muted2)'}">
          <div class="sess-t">${esc(x.start)}${x.end ? '–' + esc(x.end) : ''}${x.clash ? ' · BENTROK' : ''}</div>
          <div class="sess-n">${esc(x.st.name)}</div>
          <div class="sess-m">${esc(x.subj)} · ${g ? esc(g.name) : '<span class="t-warn">belum ada guru</span>'}</div></button>`; }).join('') || '<div class="week-empty">—</div>'}
      </div>`; }).join('')}</div>`
    : `<div class="card"><div class="empty"><div class="empty-ic">${I('calendar')}</div><div class="empty-t">Belum ada jadwal</div><div class="empty-d">Jadwal muncul setelah murid ditambahkan di Daftar Murid.</div></div></div>`}`;
  $('jgGuru').onchange = (e) => { S.schedGuru = e.target.value; renderJadwalMingguan(body); };
  body.querySelectorAll('.sess[data-stu]').forEach(b => b.onclick = () => openStudentForm(S.data.students.find(x => x.id === b.dataset.stu)));
}

// ── Mata Pelajaran ──
function renderPelajaran(body) {
  const d = S.data;
  const used = id => d.students.reduce((n, st) => n + (st.classes || []).filter(c => c.subjectId === id).length, 0);
  body.innerHTML = `
    <div class="toolbar"><div class="grow t-meta" style="white-space:normal">Tarif standar dipakai semua kelas pelajaran itu, kecuali murid yang diberi <b>tarif khusus</b>.</div>
      <button class="btn btn-primary tb-btn" id="addSubj">${I('plus', 'sm')} Tambah Pelajaran</button></div>
    ${d.subjects.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Pelajaran</th><th>Tarif standar / pertemuan</th><th>Dipakai</th><th>Status</th><th></th></tr></thead><tbody>
      ${d.subjects.map(x => `<tr data-subj="${esc(x.id)}" class="${x.active === false ? 'is-off' : ''}"><td><div class="t-name">${esc(x.name)}</div></td><td>${esc(rupiah(x.rate))}</td><td>${used(x.id)} kelas</td>
        <td>${x.active === false ? '<span class="pill pill-grey">NONAKTIF</span>' : '<span class="pill pill-green">AKTIF</span>'}</td><td class="td-act"><button class="mini">${I('edit', 'sm')} Ubah</button></td></tr>`).join('')}
    </tbody></table></div>`
    : `<div class="card"><div class="empty"><div class="empty-ic">${I('book-open')}</div><div class="empty-t">Belum ada mata pelajaran</div><div class="empty-d">Contoh: Piano Rp 50.000, Gitar Rp 45.000, Vokal Rp 45.000.</div></div></div>`}`;
  $('addSubj').onclick = () => openSubjectForm(null);
  body.querySelectorAll('tr[data-subj]').forEach(tr => tr.onclick = () => openSubjectForm(d.subjects.find(x => x.id === tr.dataset.subj), used(tr.dataset.subj)));
}
function openSubjectForm(sj, usedN) {
  openModal(`
    <div class="modal-t">${I('book-open')} ${sj ? 'Ubah Pelajaran' : 'Tambah Pelajaran'}</div>
    <div id="pjMsg"></div>
    <div class="field"><label>Nama pelajaran</label><input id="pjName" maxlength="40" value="${esc(sj ? sj.name : '')}" placeholder="cth: Piano"/></div>
    <div class="field"><label>Tarif standar per pertemuan (Rp)</label><input id="pjRate" type="number" inputmode="numeric" min="0" step="1000" value="${esc(sj ? sj.rate : '')}" placeholder="cth: 50000"/>
      <div class="hint">Mengubah tarif berlaku untuk semua murid pelajaran ini yang tidak punya tarif khusus.</div></div>
    ${sj ? `<div class="field"><label>Status</label><select id="pjActive"><option value="1" ${sj.active !== false ? 'selected' : ''}>Aktif</option><option value="0" ${sj.active === false ? 'selected' : ''}>Nonaktif (tidak muncul di pilihan murid baru)</option></select></div>` : ''}
    <div class="btn-row">
      ${sj && !usedN ? `<button class="btn btn-danger" id="pjDel" style="flex:0 0 auto;width:auto;padding:0 16px">${I('trash', 'sm')}</button>` : ''}
      <button class="btn btn-ghost" id="pjNo">Batal</button><button class="btn btn-primary" id="pjGo">${I('check', 'sm')} Simpan</button></div>`);
  $('pjNo').onclick = closeModal;
  const del = $('pjDel'); if (del) del.onclick = async () => {
    try { await commitOps([['del', doc(db, 'orgs', S.org.id, 'subjects', sj.id)]]); closeModal(); toast('Pelajaran dihapus'); await loadOrgData(true); rerenderMurid(); }
    catch (e) { toast('❌ ' + friendlyError(e)); }
  };
  $('pjGo').onclick = async () => {
    const name = $('pjName').value.trim(), rate = parseInt($('pjRate').value, 10);
    const err = t => { $('pjMsg').innerHTML = `<div class="msg msg-err">${esc(t)}</div>`; };
    if (!name) return err('Nama pelajaran wajib diisi.');
    if (!Number.isFinite(rate) || rate < 0) return err('Tarif standar wajib diisi (angka).');
    if (S.data.subjects.some(x => x.id !== (sj && sj.id) && x.name.toLowerCase() === name.toLowerCase())) return err('Pelajaran "' + name + '" sudah ada.');
    const active = $('pjActive') ? $('pjActive').value === '1' : true;
    const o = S.org.id, id = sj ? sj.id : doc(collection(db, 'orgs', o, 'subjects')).id;
    const ops = [['set', doc(db, 'orgs', o, 'subjects', id), { name, rate, active, createdAt: (sj && sj.createdAt) || serverTimestamp(), updatedAt: serverTimestamp() }]];
    // Nama berubah → perbarui salinan jadwal Guru Mitra
    if (sj && sj.name !== name) {
      const tmp = Object.assign({}, sj, { name });
      S.data.students.forEach(st => (st.classes || []).filter(c => c.subjectId === id).forEach(c => {
        const sd = schedDoc(st, c); sd.subjectName = tmp.name; ops.push(['set', doc(db, 'orgs', o, 'sched', c.id), sd]);
      }));
    }
    $('pjGo').disabled = true;
    try { await commitOps(ops); closeModal(); toast('✅ Pelajaran ' + name + ' disimpan'); await loadOrgData(true); rerenderMurid(); }
    catch (e) { $('pjGo').disabled = false; err('Gagal menyimpan: ' + friendlyError(e)); }
  };
}

// ── Impor murid dari LLK V1 (Guru Lepas) di browser yang sama ──
function readV1Students() {
  try { const a = JSON.parse(localStorage.getItem('rms4_s') || '[]'); return Array.isArray(a) ? a.filter(x => x && x.name) : []; } catch (e) { return []; }
}
// Riwayat absensi & progres V1: attendance[tgl][nama] = status, attNotes[tgl_nama] = {progress, prSiswa, prGuru, reason},
// attMeta[tgl_nama] = {time, time2}. Sesi tambahan memakai kunci nama_extra_N.
function readV1Hist() {
  const j = k => { try { const v = JSON.parse(localStorage.getItem(k) || '{}'); return v && typeof v === 'object' ? v : {}; } catch (e) { return {}; } };
  return { att: j('rms4_a'), notes: j('rms4_n'), meta: j('rms4_meta') };
}
function v1HistFor(H, x) {
  const name = x.name, out = [], esc2 = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), extraRe = new RegExp('^' + esc2 + '_extra_');
  const S1 = ['hadir', 'izin', 'alpa', 'off'];
  Object.keys(H.att).filter(dk => /^\d{4}-\d{2}-\d{2}$/.test(dk)).sort().forEach(dk => {
    const day = H.att[dk] || {};
    // Satu catatan per kelas per tanggal (aturan V2): sesi reguler dulu, kalau kosong pakai sesi tambahan
    let key = S1.includes(day[name]) ? name : Object.keys(day).find(k => extraRe.test(k) && S1.includes(day[k]));
    if (!key) return;
    const st = day[key], n = H.notes[dk + '_' + key] || {}, mt = H.meta[dk + '_' + key] || {};
    const txt = v => String(v || '').trim().slice(0, 2000);
    out.push({ date: dk, status: st, progress: st === 'hadir' ? (txt(n.progress) || 'Hadir (tanpa catatan · LLK V1)') : '',
      prSiswa: st === 'hadir' ? txt(n.prSiswa) : '', prGuru: st === 'hadir' ? txt(n.prGuru) : '', reason: st === 'hadir' ? '' : txt(n.reason),
      start: String(mt.time || x.time || ''), end: String(mt.time2 || x.time2 || '') });
  });
  return out;
}
// Salin riwayat V1 ke absensi lembaga (src:'v1' — tidak dihitung tagihan & honor guru).
// Catatan yang sudah ditulis di V2 untuk kelas & tanggal yang sama tidak ditimpa.
async function importV1History(pairs) {
  const H = readV1Hist(), o = S.org.id;
  const snap = await getDocs(collection(db, 'orgs', o, 'att'));
  const own = new Set(snap.docs.filter(d => d.data().src !== 'v1').map(d => d.id));
  const ops = [];
  pairs.forEach(({ x, st, c }) => {
    const sj = subjOf(c.subjectId);
    v1HistFor(H, x).forEach(h => {
      const id = c.id + '_' + h.date; if (own.has(id)) return;
      ops.push(['set', doc(db, 'orgs', o, 'att', id), { classId: c.id, studentId: st.id, studentName: st.name, subjectName: sj ? sj.name : '', mitraUid: null,
        date: h.date, start: h.start, end: h.end, status: h.status, progress: h.progress, prSiswa: h.prSiswa, prGuru: h.prGuru, reason: h.reason,
        honor: 0, by: S.user.uid, teachUid: c.mitraUid || null, src: 'v1', updatedAt: serverTimestamp() }]);
    });
  });
  if (ops.length) await commitOps(ops);
  return ops.length;
}
// Pasangan siswa V1 ↔ siswa lembaga yang sudah ada (nama sama), kelas = pelajaran yang cocok / kelas pertama
function v1ExistingPairs(v1) {
  const out = [];
  v1.forEach(x => {
    const st = S.data.students.find(s => s.name.trim().toLowerCase() === String(x.name).trim().toLowerCase());
    if (!st || !(st.classes || []).length) return;
    const ins = String(x.instrument || '').trim().toLowerCase();
    const c = st.classes.find(k => { const sj = subjOf(k.subjectId); return sj && sj.name.trim().toLowerCase() === ins; }) || st.classes[0];
    out.push({ x, st, c });
  });
  return out;
}
function v1Schedule(x) {
  return [[x.day, x.time, x.time2], [x.day2, x.time2a, x.time2b], [x.day3, x.time3a, x.time3b], [x.day4, x.time4a, x.time4b]]
    .filter(([dd]) => dd && DAYS.includes(dd)).map(([day, start, end]) => ({ day, start: start || '', end: end || '' }));
}
function openImportV1() {
  const v1 = readV1Students();
  if (!v1.length) {
    openModal(`<div class="modal-t">${I('download')} Impor dari LLK V1</div>
      <div class="modal-sub">Data murid LLK V1 tidak ditemukan di browser ini.</div>
      <div class="msg msg-info">Buka <b>LLK V1 (Guru Lepas)</b> di browser & perangkat ini dulu sampai daftar murid tampil, lalu kembali ke halaman ini.</div>
      <button class="btn btn-ghost" id="ivNo">Tutup</button>`);
    $('ivNo').onclick = closeModal; return;
  }
  const have = new Set(S.data.students.map(x => x.name.trim().toLowerCase()));
  const exPairs = v1ExistingPairs(v1), H0 = readV1Hist(), exHist = exPairs.reduce((n, p) => n + v1HistFor(H0, p.x).length, 0);
  const rows = v1.map((x, i) => { const sched = v1Schedule(x).filter(y => y.start); return { i, x, sched, dup: have.has(String(x.name).trim().toLowerCase()), noSched: !sched.length }; })
    .sort((a, b) => (!!a.x.inactive - !!b.x.inactive) || a.x.name.localeCompare(b.x.name));
  const ov = openModal(`
    <div class="modal-t">${I('download')} Impor dari LLK V1</div>
    <div class="modal-sub">Menyalin murid, jadwal & tarif dari LLK V1 di browser ini ke lembaga. <b>Data LLK V1 tidak diubah.</b></div>
    <label class="chk" style="margin:0 0 10px"><input type="checkbox" id="ivHist" checked/> Salin juga <b>riwayat absensi & progres</b> dari V1</label>
    ${exPairs.length ? `<div class="callout" style="margin-bottom:10px">${I('info')}<div><b>${exPairs.length} siswa sudah ada di lembaga.</b> Salin riwayat absensi & progres V1 mereka (${exHist} catatan)? Catatan yang sudah ditulis di V2 tidak ditimpa.
      <div style="margin-top:8px"><button class="btn btn-ghost tb-btn" id="ivHistOnly" ${exHist ? '' : 'disabled'}>${I('download', 'sm')} Salin Riwayat Progres</button></div></div></div>` : ''}
    <div class="toolbar" style="margin-bottom:8px">
      <label class="chk"><input type="checkbox" id="ivAll"/> Pilih semua murid aktif</label>
      <div class="field" style="margin:0;min-width:220px"><select id="ivGuru"><option value="">Guru: belum ditentukan</option>${S.data.mitras.map(g => `<option value="${esc(g.id)}">Guru: ${esc(g.name)}</option>`).join('')}</select></div>
    </div>
    <div class="imp-list">${rows.map(r => `<label class="imp-row ${r.dup || r.noSched ? 'is-off' : ''}">
      <input type="checkbox" data-i="${r.i}" ${r.dup || r.noSched ? 'disabled' : ''}/>
      <div class="grow"><div class="t-name">${esc(r.x.name)} ${r.x.inactive ? '<span class="pill pill-grey">NONAKTIF</span>' : ''} ${r.dup ? '<span class="pill pill-amber">SUDAH ADA</span>' : r.noSched ? '<span class="pill pill-grey">TANPA JADWAL</span>' : ''}</div>
      <div class="t-meta">${esc(r.x.instrument || 'Tanpa pelajaran')} · ${esc(r.sched.map(slotTxt).join(', ') || 'tanpa jadwal rutin')} · ${esc(rupiah(r.x.rate || 40000))}</div></div></label>`).join('')}</div>
    <div id="ivPlan" class="t-meta" style="white-space:normal;margin:10px 0"></div>
    <div class="btn-row"><button class="btn btn-ghost" id="ivNo">Batal</button><button class="btn btn-primary" id="ivGo" disabled>Impor</button></div>`);
  ov.querySelector('.modal').classList.add('modal-wide');
  const boxes = () => Array.from(document.querySelectorAll('.imp-list input[data-i]'));
  const picked = () => boxes().filter(b => b.checked).map(b => v1[+b.dataset.i]);
  const plan = () => {
    const p = picked(), subj = importSubjectPlan(p);
    const newS = subj.filter(x => x.isNew);
    $('ivPlan').innerHTML = p.length ? `<b>${p.length} murid</b> akan ditambahkan.` + (newS.length ? ` Pelajaran baru: ${newS.map(x => `<b>${esc(x.name)}</b> (tarif standar ${esc(rupiah(x.rate))})`).join(', ')}.` : '') + '' : 'Centang murid yang mau disalin. Murid tanpa jadwal rutin tidak bisa diimpor; tambahkan manual.';
    $('ivGo').disabled = !p.length; $('ivGo').textContent = p.length ? 'Impor ' + p.length + ' Murid' : 'Impor';
  };
  boxes().forEach(b => b.onchange = plan);
  $('ivAll').onchange = (e) => { boxes().forEach(b => { const x = v1[+b.dataset.i]; if (!b.disabled && !x.inactive) b.checked = e.target.checked; }); plan(); };
  $('ivNo').onclick = closeModal;
  $('ivGo').onclick = async () => { $('ivGo').disabled = true; $('ivGo').textContent = 'Mengimpor…'; await runImportV1(picked(), $('ivGuru').value || null, $('ivHist').checked); };
  const ho = $('ivHistOnly');
  if (ho) ho.onclick = async () => {
    ho.disabled = true; ho.textContent = 'Menyalin…';
    try { const n = await importV1History(exPairs); closeModal(); toast('✅ ' + n + ' catatan riwayat V1 disalin', 4500); syncAttTeach(); }
    catch (e) { console.error(e); ho.disabled = false; ho.textContent = 'Salin Riwayat Progres'; toast('❌ Gagal menyalin riwayat: ' + friendlyError(e), 5000); }
  };
  plan();
}
// Instrumen V1 → pelajaran lembaga (cocokkan nama; kalau belum ada, buat baru dgn tarif terbanyak)
function importSubjectPlan(list) {
  const map = new Map();
  list.forEach(x => {
    const nm = String(x.instrument || '').trim() || 'Umum', key = nm.toLowerCase();
    if (!map.has(key)) map.set(key, { name: nm, rates: [] });
    map.get(key).rates.push(x.rate || 40000);
  });
  return Array.from(map.entries()).map(([key, v]) => {
    const ex = S.data.subjects.find(s => s.name.trim().toLowerCase() === key);
    if (ex) return { key, id: ex.id, name: ex.name, rate: ex.rate, isNew: false };
    const cnt = {}; v.rates.forEach(r => cnt[r] = (cnt[r] || 0) + 1);
    const rate = +Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a] || b - a)[0];
    return { key, id: doc(collection(db, 'orgs', S.org.id, 'subjects')).id, name: v.name, rate, isNew: true };
  });
}
async function runImportV1(list, mitraUid, withHist) {
  const o = S.org.id, plan = importSubjectPlan(list), ops = [];
  plan.filter(x => x.isNew).forEach(x => ops.push(['set', doc(db, 'orgs', o, 'subjects', x.id), { name: x.name, rate: x.rate, active: true, createdAt: serverTimestamp(), updatedAt: serverTimestamp() }]));
  // supaya schedDoc() bisa menemukan nama pelajaran baru
  plan.filter(x => x.isNew).forEach(x => S.data.subjects.push({ id: x.id, name: x.name, rate: x.rate, active: true }));
  let n = 0, skipped = 0, nh = 0;
  const pairs = [];
  list.forEach(x => {
    const sched = v1Schedule(x).filter(y => y.start);
    if (!sched.length) { skipped++; return; }
    const sp = plan.find(p => p.key === (String(x.instrument || '').trim() || 'Umum').toLowerCase());
    const id = newId(), active = !x.inactive;
    const c = { id: newId(), subjectId: sp.id, mitraUid: mitraUid || null, rate: (x.rate || 40000) === sp.rate ? null : (x.rate || 40000), schedule: sched.sort(byDayTime) };
    ops.push(['set', doc(db, 'orgs', o, 'students', id), { name: String(x.name).trim().slice(0, 80), parentName: '', phone: String(x.phone || '').slice(0, 20), note: String(x.notes || '').slice(0, 200), active, classes: [c], source: 'v1', createdAt: serverTimestamp(), updatedAt: serverTimestamp() }]);
    ops.push(['set', doc(db, 'orgs', o, 'sched', c.id), schedDoc({ id, name: String(x.name).trim().slice(0, 80), active }, c)]);
    pairs.push({ x, st: { id, name: String(x.name).trim().slice(0, 80) }, c });
    n++;
  });
  try {
    await commitOps(ops);
    if (withHist) nh = await importV1History(pairs);
    closeModal(); toast('✅ ' + n + ' murid diimpor' + (nh ? ' · ' + nh + ' catatan riwayat' : '') + (skipped ? ' · ' + skipped + ' dilewati (tanpa jadwal rutin)' : ''), 4500);
  } catch (e) { console.error(e); toast('❌ Gagal mengimpor: ' + friendlyError(e), 5000); }
  await loadOrgData(true); rerenderMurid();
}

// ══════════════════════════════════════════════════════════════════════
// ADMIN — ABSENSI (Tahap 3): pantau absensi & progres semua Guru Mitra per
// tanggal, dan isi Izin (Izin hanya oleh Admin). Kirim progres ke ortu menyusul.
// ══════════════════════════════════════════════════════════════════════
function localKey(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
function dayOfKey(k) { return DAYS[(new Date(k + 'T00:00:00').getDay() + 6) % 7]; }
async function renderAdminAbsensi(m) {
  const today = localKey(new Date());
  const key = S.absDate || today;
  m.innerHTML = '<div class="page-title">Absensi</div><div class="page-sub">Memuat…</div>';
  let att;
  try {
    await loadOrgData();
    const snap = await getDocs(query(collection(db, 'orgs', S.org.id, 'att'), where('date', '==', key)));
    att = {}; snap.docs.forEach(d => { att[d.id] = Object.assign({ id: d.id }, d.data()); });
  } catch (e) { m.innerHTML = `<div class="msg msg-err">Gagal memuat: ${esc(friendlyError(e))}</div>`; return; }
  const day = dayOfKey(key), rows = [], seen = new Set();
  S.data.students.filter(st => st.active).forEach(st => (st.classes || []).forEach(c => (c.schedule || []).filter(x => x.day === day).forEach(x => {
    const id = c.id + '_' + key; if (seen.has(id)) return; seen.add(id);
    const sj = subjOf(c.subjectId);
    rows.push({ id, st, c, name: st.name, subj: sj ? sj.name : '—', uid: c.mitraUid || null, start: x.start, end: x.end, rec: att[id] || null });
  })));
  Object.values(att).filter(a => !seen.has(a.id)).forEach(a => rows.push({ id: a.id, st: null, c: { id: a.classId }, name: a.studentName, subj: a.subjectName, uid: a.mitraUid, start: a.start, end: a.end, rec: a }));
  rows.sort((a, b) => String(a.start).localeCompare(String(b.start)) || a.name.localeCompare(b.name));
  const stOf = r => (r.rec && r.rec.status) || 'belum';
  // Kotak pilih guru di bawah kalender: hanya jadwal guru itu yang tampil
  const gSel = S.absGuru || '';
  const guruOf = r => mitraOf(r.uid) ? r.uid : 'none';
  const cntG = g => rows.filter(r => guruOf(r) === g).length;
  const shown = rows.filter(r => !gSel || guruOf(r) === gSel);
  const n = st => shown.filter(r => stOf(r) === st).length;
  const shift = (k, d) => { const x = new Date(k + 'T00:00:00'); x.setDate(x.getDate() + d); return localKey(x); };
  // Strip tanggal ala V1 (7 hari sebelum s/d 6 hari sesudah tanggal terpilih) + tombol kalender
  const DSH = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'], MSH = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  let pills = '';
  for (let i = -7; i <= 6; i++) {
    const k = shift(key, i), d = new Date(k + 'T00:00:00'), showMonth = i === -7 || d.getDate() === 1;
    pills += `<button class="ab-pill${k === key ? ' active' : ''}${k === today && k !== key ? ' today' : ''}${k < today ? ' past' : ''}" data-date="${k}">`
      + `<span class="dp-d">${k === today ? 'Hari ini' : DSH[d.getDay()]}</span><span class="dp-n">${d.getDate()}${showMonth ? ' ' + MSH[d.getMonth()] : ''}</span></button>`;
  }
  const diff = Math.round((new Date(key + 'T00:00:00') - new Date(today + 'T00:00:00')) / 864e5);
  const rel = diff === 0 ? 'Hari ini' : diff === -1 ? 'Kemarin' : diff === 1 ? 'Besok' : diff < 0 ? (-diff) + ' hari lalu' : diff + ' hari lagi';
  const gName = gSel === 'none' ? 'Belum punya guru' : gSel ? (mitraOf(gSel) || {}).name : '';
  const badge = st => ({ hadir: ['var(--hadir-solid,var(--green))', 'check'], izin: ['var(--izin-solid,var(--amber))', 'minus'], alpa: ['var(--alpa-solid,var(--danger))', 'x'], off: ['#4f5d6e', 'pause'] }[st]);
  const pill = st => ({ hadir: '<span class="pill pill-green">HADIR</span>', izin: '<span class="pill pill-amber">IZIN</span>', alpa: '<span class="pill pill-red">ALPA</span>', off: '<span class="pill pill-grey">OFF</span>' }[st] || '<span class="pill pill-grey">BELUM</span>');
  const item = r => {
    const a = r.rec || {}, st = stOf(r), bd = badge(st), dim = st === 'izin' || st === 'alpa' || st === 'off';
    return `<div class="ab-item status-${st}" data-row="${esc(r.id)}">
      <div class="ab-av" style="${dim ? 'opacity:0.55' : ''}">${subjectIcon(r.subj)}${bd ? `<span class="ab-badge" style="background:${bd[0]}">${I(bd[1])}</span>` : ''}</div>
      <div class="ab-body">
        <div class="ab-top"><div class="ab-name">${esc(r.name)}</div><div class="ab-time">${esc(r.start)}${r.end ? '–' + esc(r.end) : ''}</div></div>
        <div class="ab-sub"><b>${esc(r.subj)}</b></div>
        ${guruTag(r.uid)}
        <div class="ab-st">${pill(st)}${a.src === 'v1' ? '<span class="pill pill-grey">DARI LLK V1</span>' : ''}${a.reason ? `<span class="ab-reason">${esc(a.reason)}</span>` : ''}</div>
        ${a.progress ? `<div class="ab-note">${I('note', 'sm')}<span>${esc(a.progress)}</span></div>` : ''}
        ${a.prSiswa ? `<div class="ab-note" style="color:var(--plum,#6b4e9b)">${I('book', 'sm')}<span>PR: ${esc(a.prSiswa)}</span></div>` : ''}
        ${st === 'izin' ? `<div class="ab-act"><button class="mini" data-unizin="${esc(r.id)}">${I('x', 'sm')} Hapus Izin</button></div>` : (st === 'belum' && r.st ? `<div class="ab-act"><button class="mini" data-izin="${esc(r.id)}">${I('hand', 'sm')} Izin</button></div>` : '')}
        ${st === 'hadir' || st === 'alpa' ? `<div class="ab-act"><button class="mini mini-blue" data-prog="${esc(r.id)}">${I('note', 'sm')} Progres${(r.st && r.st.phone) ? ' & Kirim' : ''}</button></div>` : ''}
      </div>
    </div>`;
  };
  m.innerHTML = `
    <div class="page-head"><div><div class="page-title">Absensi</div>
      <div class="page-sub">Pantau kehadiran semua guru. Siswa berhalangan? Tekan <b>Izin</b>.</div></div></div>
    <div class="ab-days" id="dayBar">${pills}<button class="ab-pill ab-cal${S.absCal ? ' active' : ''}" id="abCalBtn" aria-label="Buka Kalender">${I('calendar')}<span class="dp-d">Kalender</span></button></div>
    <input type="date" id="abDate" value="${key}" class="sr-only" tabindex="-1" aria-hidden="true"/>
    <div class="ab-gurus" id="abGuruBar">
      <button class="ab-gp${!gSel ? ' active' : ''}" data-guru="">${I('users', 'sm')} Semua <span class="ab-gn">${rows.length}</span></button>
      ${S.data.mitras.map(g => `<button class="ab-gp${gSel === g.id ? ' active' : ''}" data-guru="${esc(g.id)}" style="--gc:${esc(g.color || 'var(--red)')}"><span class="g-dot" style="background:${esc(g.color || 'var(--red)')}"></span>${esc(g.name)} <span class="ab-gn">${cntG(g.id)}</span></button>`).join('')}
      ${cntG('none') || gSel === 'none' ? `<button class="ab-gp${gSel === 'none' ? ' active' : ''}" data-guru="none">${I('user-plus', 'sm')} Belum punya guru <span class="ab-gn">${cntG('none')}</span></button>` : ''}
    </div>
    ${S.absCal ? `<div id="abCalWrap">${adminCalendar(key)}</div>` : ''}
    <div class="ab-stats">
      <div class="ab-stat s-hadir"><div class="stat-label">Hadir</div><div class="stat-num">${n('hadir')}</div></div>
      <div class="ab-stat s-izin"><div class="stat-label">Izin</div><div class="stat-num">${n('izin')}</div></div>
      <div class="ab-stat s-alpa"><div class="stat-label">Alpa</div><div class="stat-num">${n('alpa')}</div></div>
      <div class="ab-stat"><div class="stat-label">Belum</div><div class="stat-num">${n('belum')}</div></div>
    </div>
    <div class="ab-list">
      <div class="ab-head"><div class="ab-title">${esc(day)} — ${rel}</div>
        <div class="t-meta">${esc(new Date(key + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }))}${gName ? ' · ' + esc(gName) : ''}</div></div>
      ${shown.length ? shown.map(item).join('')
        : `<div class="empty"><div class="empty-ic">${I('calendar')}</div><div class="empty-t">Tidak ada jadwal ${gName ? esc(gName) + ' ' : ''}hari ${esc(day)}</div><div class="empty-d">Pilih tanggal${gSel ? ' atau guru' : ''} lain.</div></div>`}
    </div>`;
  const go = k => { S.absDate = k === today ? '' : k; renderAdminAbsensi(m); };
  m.querySelectorAll('[data-date]').forEach(bt => bt.onclick = () => go(bt.dataset.date));
  $('abDate').onchange = e => { if (e.target.value) go(e.target.value); };
  $('abCalBtn').onclick = () => { S.absCal = !S.absCal; if (S.absCal) { const d = new Date(key + 'T00:00:00'); S.calY = d.getFullYear(); S.calM = d.getMonth(); } renderAdminAbsensi(m); };
  m.querySelectorAll('[data-guru]').forEach(bt => bt.onclick = () => { S.absGuru = bt.dataset.guru; renderAdminAbsensi(m); });
  m.querySelectorAll('[data-acal]').forEach(bt => bt.onclick = () => { const d = +bt.dataset.acal; S.calM += d; if (S.calM < 0) { S.calM = 11; S.calY--; } if (S.calM > 11) { S.calM = 0; S.calY++; } renderAdminAbsensi(m); });
  m.querySelectorAll('[data-aday]').forEach(bt => bt.onclick = () => { S.absCal = false; go(bt.dataset.aday); });
  m.querySelectorAll('[data-prog]').forEach(bt => bt.onclick = () => openProgres(rows.find(r => r.id === bt.dataset.prog), key));
  if (S.absCal) fillAdminCalendarDots();
  setTimeout(() => { const gb = $('abGuruBar'), ac = gb && gb.querySelector('.ab-gp.active'); if (gb && ac) gb.scrollLeft = ac.offsetLeft - gb.offsetWidth / 2 + ac.offsetWidth / 2; }, 30);
  setTimeout(() => { const bar = $('dayBar'), act = bar && bar.querySelector('.ab-pill.active'); if (bar && act) bar.scrollLeft = act.offsetLeft - bar.offsetWidth / 2 + act.offsetWidth / 2; }, 30);
  m.querySelectorAll('[data-izin]').forEach(bt => bt.onclick = () => openIzin(rows.find(r => r.id === bt.dataset.izin), key, m));
  m.querySelectorAll('[data-unizin]').forEach(bt => bt.onclick = async () => {
    try { await commitOps([['del', doc(db, 'orgs', S.org.id, 'att', bt.dataset.unizin)]]); toast('Izin dihapus'); renderAdminAbsensi(m); }
    catch (e) { toast('❌ ' + friendlyError(e)); }
  });
}
// Nama guru di kartu absensi: besar & berbingkai warna guru
function guruTag(uid) {
  const g = mitraOf(uid);
  if (!g) return `<div class="ab-gtag is-none">${I('user-plus', 'sm')} ${uid ? 'Guru sudah keluar' : 'Belum punya guru'}</div>`;
  return `<div class="ab-gtag" style="--gc:${esc(g.color || 'var(--red)')}"><span class="g-dot" style="background:${esc(g.color || 'var(--red)')}"></span>${esc(g.name)}</div>`;
}
// Kalender bulanan ala V1 untuk Admin: titik = ada absensi tercatat
function adminCalendar(key) {
  const y = S.calY, m = S.calM, first = new Date(y, m, 1).getDay(), days = new Date(y, m + 1, 0).getDate(), today = localKey(new Date());
  const MN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  let cells = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'].map(d => `<div class="acal-dow">${d}</div>`).join('');
  for (let i = 0; i < first; i++) cells += '<div></div>';
  for (let d = 1; d <= days; d++) {
    const k = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    cells += `<button class="acal-day${k === key ? ' selected' : ''}${k === today ? ' today' : ''}" data-aday="${k}">${d}</button>`;
  }
  return `<div class="acal"><div class="acal-head"><button class="acal-nav" data-acal="-1" aria-label="Bulan sebelumnya">${I('chevron-left')}</button><div class="acal-title">${MN[m]} ${y}</div><button class="acal-nav" data-acal="1" aria-label="Bulan berikutnya">${I('chevron-right')}</button></div>
    <div class="acal-grid">${cells}</div><div class="t-meta" style="text-align:center;margin-top:8px">Titik = ada absensi tercatat. Tap tanggal untuk melihatnya.</div></div>`;
}
async function fillAdminCalendarDots() {
  const y = S.calY, m = S.calM, from = `${y}-${String(m + 1).padStart(2, '0')}-01`, to = `${y}-${String(m + 1).padStart(2, '0')}-31`;
  try {
    const snap = await getDocs(query(collection(db, 'orgs', S.org.id, 'att'), where('date', '>=', from), where('date', '<=', to)));
    const has = new Set(snap.docs.map(d => d.data().date));
    document.querySelectorAll('.acal-day[data-aday]').forEach(b => b.classList.toggle('has-data', has.has(b.dataset.aday)));
  } catch (e) { console.warn('kalender:', e); }
}
// Progres pertemuan + kirim ke WA orang tua (format pesan sama dengan LLK V1)
function greetingID() { const h = new Date().getHours(); return h < 11 ? 'Selamat pagi' : h < 15 ? 'Selamat siang' : h < 18 ? 'Selamat sore' : 'Selamat malam'; }
function bulletLines(t) { const l = String(t || '').split('\n').map(x => x.trim()).filter(Boolean); return l.length > 1 ? l.map(x => '• ' + x).join('\n') : (l[0] || ''); }
async function openProgres(r, key) {
  if (!r || !r.rec) return;
  const a = r.rec, st = r.st, prettyDate = new Date(key + 'T00:00:00').toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  let nth = 0;
  try {
    const snap = await getDocs(query(collection(db, 'orgs', S.org.id, 'att'), where('classId', '==', a.classId)));
    nth = snap.docs.map(d => d.data()).filter(x => (x.status === 'hadir' || x.status === 'alpa') && x.date <= key).length;
  } catch (e) { console.warn(e); }
  const nama = r.name, ortu = st && st.parentName ? st.parentName : '';
  const prog = a.status === 'hadir' ? (bulletLines(a.progress) || '-') : 'Tidak hadir (Alpa)' + (a.reason ? ' — ' + a.reason : '');
  const pr = a.prSiswa ? (a.prSiswa.includes('\n') ? bulletLines(a.prSiswa) : a.prSiswa.trim()) : '-';
  const block = v => v.startsWith('• ') ? '\n\n' + v + '\n' : ' ' + v;
  const msg = `${greetingID()},\nKepada Yth. Bapak/Ibu ${ortu || 'orang tua ' + nama},\n\nBerikut kami sampaikan progres les ${nama}:\n🗓️ ${prettyDate}\n${nth ? '🔢 Pertemuan ke-' + nth + '\n' : ''}📝 Progress:${block(prog)}\n📚 PR:${block(pr)}\n\nTerima kasih atas perhatiannya.\n\n— ${S.org.fullName || S.org.name}`
    .replace(/\n{3,}/g, '\n\n');
  const g = mitraOf(a.mitraUid);
  openModal(`
    <div class="modal-t">${I('note')} Progres · ${esc(nama)}</div>
    <div class="modal-sub">${esc(r.subj)} · ${esc(prettyDate)}${nth ? ' · pertemuan ke-' + nth : ''}<br>Dicatat oleh <b>${esc(g ? g.name : a.src === 'v1' ? 'LLK V1' : 'guru sebelumnya')}</b></div>
    <div class="prog-box">
      <div class="prog-l">${a.status === 'hadir' ? 'Progres' : 'Alpa'}</div><div class="prog-v">${esc(a.status === 'hadir' ? (a.progress || '-') : (a.reason || 'Tidak hadir tanpa keterangan'))}</div>
      ${a.prSiswa ? `<div class="prog-l">PR siswa</div><div class="prog-v">${esc(a.prSiswa)}</div>` : ''}
      ${a.prGuru ? `<div class="prog-l">PR guru (catatan guru)</div><div class="prog-v">${esc(a.prGuru)}</div>` : ''}
    </div>
    <div class="field"><label>Pesan WA ke orang tua (bisa diubah)</label><textarea id="pgMsg" rows="9">${esc(msg)}</textarea></div>
    ${st && st.phone ? '' : '<div class="msg msg-info">No HP/WA ortu belum diisi — isi di menu Siswa supaya bisa dikirim langsung. Pesan tetap bisa disalin.</div>'}
    <div class="btn-row"><button class="btn btn-ghost" id="pgCopy">${I('copy', 'sm')} Salin</button><button class="btn btn-primary btn-wa" id="pgSend" ${st && st.phone ? '' : 'disabled'}>${I('chat', 'sm')} Kirim ke WA Ortu</button></div>`);
  $('pgCopy').onclick = async () => { try { await navigator.clipboard.writeText($('pgMsg').value); toast('✅ Pesan disalin'); } catch (e) { $('pgMsg').select(); document.execCommand('copy'); toast('✅ Pesan disalin'); } };
  $('pgSend').onclick = () => { if (!st || !st.phone) return; window.open('https://wa.me/' + waNumber(st.phone) + '?text=' + encodeURIComponent($('pgMsg').value), '_blank'); };
}
function openIzin(r, key, m) {
  if (!r || !r.st) return;
  openModal(`
    <div class="modal-t">${I('hand')} Izin · ${esc(r.name)}</div>
    <div class="modal-sub">${esc(r.subj)} · ${esc(r.start)}${r.end ? '–' + esc(r.end) : ''} · ${esc(dayOfKey(key))} ${esc(key.split('-').reverse().join('/'))}. Izin tidak dihitung tagihan & honor.</div>
    <div class="field"><label>Alasan (opsional)</label><input id="izReason" maxlength="200" placeholder="cth: Sakit, acara keluarga"/></div>
    <div class="btn-row"><button class="btn btn-ghost" id="izNo">Batal</button><button class="btn btn-primary" id="izGo">${I('check', 'sm')} Simpan Izin</button></div>`);
  $('izNo').onclick = closeModal;
  $('izGo').onclick = async () => {
    $('izGo').disabled = true;
    const sj = subjOf(r.c.subjectId);
    try {
      await commitOps([['set', doc(db, 'orgs', S.org.id, 'att', r.id), {
        classId: r.c.id, studentId: r.st.id, studentName: r.st.name, subjectName: sj ? sj.name : '', mitraUid: r.uid || null,
        date: key, start: r.start || '', end: r.end || '', status: 'izin', progress: '', prSiswa: '', prGuru: '',
        reason: $('izReason').value.trim(), honor: 0, by: S.user.uid, teachUid: r.uid || null, updatedAt: serverTimestamp() }]]);
      closeModal(); toast('✅ ' + r.name + ' izin'); renderAdminAbsensi(m);
    } catch (e) { $('izGo').disabled = false; toast('❌ ' + friendlyError(e), 4000); }
  };
}

// ══════════════════════════════════════════════════════════════════════
// ADMIN — KEUANGAN: tagihan bayar di depan (paket N pertemuan), catat
// pembayaran, gaji Guru Mitra (honor tercatat di tiap absensi), pemasukan.
//   orgs/{org}/payments/{id}  {studentId, studentName, classId, subjectName,
//                              sessions, amount, rate, date, note, by, createdAt}
//   orgs/{org}/settings/billing {cycle}   (default 4 pertemuan per paket)
// Sisa paket per kelas = pertemuan dibayar − pertemuan terpakai (Hadir + Alpa).
// Izin & Off tidak memakai paket dan tidak dihitung gaji guru.
// ══════════════════════════════════════════════════════════════════════
function waNumber(p) { let d = String(p || '').replace(/\D/g, ''); if (d.startsWith('0')) d = '62' + d.slice(1); return d; }
function fmtShortKey(k) { return new Date(k + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }); }
function keuRange(p) {
  const t = new Date(), today = localKey(t);
  if (p === 'lalu') { const a = new Date(t.getFullYear(), t.getMonth() - 1, 1), b = new Date(t.getFullYear(), t.getMonth(), 0); return { from: localKey(a), to: localKey(b), label: a.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' }) }; }
  if (p === '30') { const a = new Date(t); a.setDate(a.getDate() - 29); return { from: localKey(a), to: today, label: '30 hari terakhir (' + fmtShortKey(localKey(a)) + ' – ' + fmtShortKey(today) + ')' }; }
  const a = new Date(t.getFullYear(), t.getMonth(), 1), b = new Date(t.getFullYear(), t.getMonth() + 1, 0);
  return { from: localKey(a), to: localKey(b), label: a.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' }) };
}
async function loadKeu() {
  await loadOrgData(true);
  const o = S.org.id;
  const [att, pay, set, pinfo] = await Promise.all([
    getDocs(collection(db, 'orgs', o, 'att')),
    getDocs(collection(db, 'orgs', o, 'payments')),
    getDoc(doc(db, 'orgs', o, 'settings', 'billing')).catch(() => null),
    getDoc(doc(db, 'orgs', o, 'settings', 'payinfo')).catch(() => null),
  ]);
  S.keu = {
    att: att.docs.map(d => Object.assign({ id: d.id }, d.data())).filter(a => a.src !== 'v1'), // riwayat V1 tidak dihitung tagihan
    pay: pay.docs.map(d => Object.assign({ id: d.id }, d.data())).sort((a, b) => b.date.localeCompare(a.date)),
    cycle: (set && set.exists() && set.data().cycle) || 4,
    payInfo: (pinfo && pinfo.exists() && pinfo.data()) || {},
  };
}
const isPaidSession = a => a.status === 'hadir' || a.status === 'alpa';
function classBilling(c) {
  const used = S.keu.att.filter(a => a.classId === c.id && isPaidSession(a)).length;
  const paid = S.keu.pay.filter(p => p.classId === c.id).reduce((n, p) => n + (p.sessions || 0), 0);
  const credit = paid - used, rate = rateOf(c), cycle = S.keu.cycle;
  // Bayar di depan: kalau sisa habis, tagih paket berikutnya (+ pertemuan yang sudah lewat tapi belum dibayar)
  const due = credit <= 0 ? (cycle + Math.max(0, -credit)) * rate : 0;
  return { used, paid, credit, rate, due, owed: Math.max(0, -credit) };
}
async function renderKeuangan(m) {
  m.innerHTML = '<div class="page-title">Keuangan</div><div class="page-sub">Memuat…</div>';
  try { await loadKeu(); await loadPayroll(); } catch (e) { m.innerHTML = `<div class="msg msg-err">Gagal memuat: ${esc(friendlyError(e))}</div>`; return; }
  const per = S.keuPer || 'bulan', R = keuRange(per), inR = k => k >= R.from && k <= R.to;
  const K = S.keu, cycle = K.cycle;
  const payR = K.pay.filter(p => inR(p.date));
  const attR = K.att.filter(a => inR(a.date));
  const kas = payR.reduce((n, p) => n + (p.amount || 0), 0);
  const gaji = attR.filter(isPaidSession).reduce((n, a) => n + (a.honor || 0), 0);
  // Nilai pertemuan terlaksana (Hadir + Alpa × tarif kelas) — "pendapatan yang sudah dipakai murid"
  const classes = []; S.data.students.forEach(st => (st.classes || []).forEach(c => classes.push({ st, c })));
  const rateByClass = new Map(classes.map(x => [x.c.id, rateOf(x.c)]));
  const sesiR = attR.filter(isPaidSession);
  const nilai = sesiR.reduce((n, a) => n + (rateByClass.get(a.classId) || 0), 0);
  // Gaji per guru
  const gIds = Array.from(new Set(attR.map(a => a.mitraUid).filter(Boolean).concat(S.data.mitras.map(g => g.id))));
  const gRows = gIds.map(uid => {
    const mine = attR.filter(a => a.mitraUid === uid), g = mitraOf(uid);
    return { uid, name: g ? g.name : 'Guru sudah keluar', honor: g ? (g.honor || 0) : null,
      h: mine.filter(a => a.status === 'hadir').length, a: mine.filter(a => a.status === 'alpa').length, i: mine.filter(a => a.status === 'izin').length,
      sum: mine.filter(isPaidSession).reduce((n, x) => n + (x.honor || 0), 0) };
  }).filter(r => r.h + r.a + r.i > 0 || mitraOf(r.uid)).sort((a, b) => b.sum - a.sum || a.name.localeCompare(b.name));
  // Proyeksi ala V1: jika semua siswa masuk di seluruh periode (yang sudah tercatat pakai catatannya,
  // sisanya dianggap Hadir) → pendapatan kotor, gaji guru, pendapatan bersih
  const attById = new Map(K.att.map(a => [a.id, a]));
  let pjGross = 0, pjGaji = 0, pjSesi = 0;
  const seenP = new Set();
  for (let d = new Date(R.from + 'T00:00:00'); localKey(d) <= R.to; d.setDate(d.getDate() + 1)) {
    const k = localKey(d), dn = dayOfKey(k);
    classes.filter(x => x.st.active).forEach(x => (x.c.schedule || []).filter(y => y.day === dn).forEach(() => {
      const id = x.c.id + '_' + k; if (seenP.has(id)) return; seenP.add(id);
      const a = attById.get(id);
      if (a && !isPaidSession(a)) return;
      const g = mitraOf(x.c.mitraUid);
      pjGross += rateOf(x.c); pjGaji += a ? (a.honor || 0) : (g ? (g.honor || 0) : 0); pjSesi++;
    }));
  }
  attR.filter(a => isPaidSession(a) && !seenP.has(a.id)).forEach(a => { pjGross += rateByClass.get(a.classId) || 0; pjGaji += a.honor || 0; pjSesi++; });
  // Tagihan per kelas (murid aktif)
  const tRows = classes.filter(x => x.st.active).map(x => Object.assign({ st: x.st, c: x.c, sj: subjOf(x.c.subjectId) }, classBilling(x.c)))
    .sort((a, b) => a.credit - b.credit || a.st.name.localeCompare(b.st.name));
  const nDue = tRows.filter(r => r.credit <= 0).length;
  // Uang titipan = sisa paket yang sudah dibayar tapi belum dipakai (semua murid aktif, saat ini)
  const titip = tRows.reduce((n, r) => n + Math.max(0, r.credit) * r.rate, 0);
  const statusPill = r => r.credit <= 0 ? `<span class="pill pill-red">PERLU BAYAR</span><div class="t-meta" style="margin-top:4px">${esc(rupiah(r.due))}${r.owed ? ' · ' + r.owed + 'x belum dibayar' : ''}</div>`
    : r.credit === 1 ? '<span class="pill pill-amber">SISA 1x</span>' : `<span class="pill pill-green">SISA ${r.credit}x</span>`;
  m.innerHTML = `
    <div class="page-head"><div><div class="page-title">Keuangan</div><div class="page-sub">${esc(R.label)} · bayar di depan per paket <b>${cycle}x pertemuan</b> · <button class="link-btn" id="kfSet">Ubah paket</button></div></div></div>
    <div class="seg">${[['bulan', 'Bulan ini'], ['lalu', 'Bulan lalu'], ['30', '30 hari terakhir']].map(([k, l]) => `<button class="seg-b ${per === k ? 'on' : ''}" data-per="${k}">${l}</button>`).join('')}</div>
    <div class="keu-proj" id="kProj">
      <div class="kp-head">${I('sparkle', 'sm')} Proyeksi ${esc(R.label)} · jika semua siswa masuk</div>
      <div class="kp-grid">
        <div><div class="kp-l">Pendapatan kotor</div><div class="kp-n" id="kpGross">${esc(rupiah(pjGross))}</div><div class="kp-d">${pjSesi} pertemuan × tarif</div></div>
        <div><div class="kp-l">Gaji guru</div><div class="kp-n" id="kpGaji">− ${esc(rupiah(pjGaji))}</div><div class="kp-d">honor per pertemuan</div></div>
        <div><div class="kp-l">Pendapatan bersih</div><div class="kp-n kp-net" id="kpNet">${esc(rupiah(pjGross - pjGaji))}</div><div class="kp-d">kotor − gaji guru</div></div>
      </div>
      <div class="kp-foot">Pertemuan yang sudah tercatat memakai catatannya (Izin tidak dihitung); sisanya dianggap Hadir.</div>
    </div>
    <div class="keu-cards">
      <div class="keu-card"><div class="kc-l">Pemasukan (uang masuk)</div><div class="kc-n" id="kKas">${esc(rupiah(kas))}</div><div class="kc-d">${payR.length} pembayaran · <span id="kTitip">${esc(rupiah(titip))}</span> masih titipan (sisa paket belum terpakai, saat ini)</div></div>
      <div class="keu-card"><div class="kc-l">Gaji guru</div><div class="kc-n" id="kGaji">${esc(rupiah(gaji))}</div><div class="kc-d">${sesiR.length} pertemuan Hadir + Alpa</div></div>
      <div class="keu-card"><div class="kc-l">Selisih (pemasukan − gaji)</div><div class="kc-n" id="kSelisih" style="color:${kas - gaji < 0 ? 'var(--danger)' : 'var(--green)'}">${esc(rupiah(kas - gaji))}</div><div class="kc-d">sebelum biaya lain</div></div>
      <div class="keu-card"><div class="kc-l">Nilai pertemuan terlaksana</div><div class="kc-n" id="kNilai">${esc(rupiah(nilai))}</div><div class="kc-d">${sesiR.length} × tarif kelas · laba pertemuan <b id="kLaba">${esc(rupiah(nilai - gaji))}</b> (nilai − gaji)</div></div>
    </div>

    <div class="card-t" style="margin-top:18px">${I('receipt', 'sm')} Tagihan murid ${nDue ? `<span class="pill pill-red">${nDue} perlu bayar</span>` : ''}</div>
    ${tRows.length ? `<div class="tbl-wrap"><table class="tbl tbl-static" id="tblTagihan"><thead><tr><th>Murid</th><th>Pelajaran & Guru</th><th>Tarif</th><th>Dibayar</th><th>Terpakai</th><th>Status</th><th></th></tr></thead><tbody>
      ${tRows.map(r => `<tr data-cls="${esc(r.c.id)}"><td><div class="t-name">${esc(r.st.name)}</div><div class="t-meta">${esc(r.st.parentName || '')}</div></td>
        <td><div class="cl-line"><b>${esc(r.sj ? r.sj.name : '—')}</b> · ${guruLabel(r.c.mitraUid)}</div></td>
        <td>${esc(rupiah(r.rate))}</td><td>${r.paid}x</td><td>${r.used}x</td><td>${statusPill(r)}</td>
        <td class="td-act"><div class="act-row"><button class="mini" data-pay="${esc(r.c.id)}">${I('wallet', 'sm')} Catat Bayar</button>${r.credit <= 1 && r.st.phone ? `<button class="mini mini-green" data-tagih="${esc(r.c.id)}">${I('chat', 'sm')} Tagih</button>` : ''}</div></td></tr>`).join('')}
    </tbody></table></div>` : `<div class="card"><div class="empty"><div class="empty-t">Belum ada murid</div></div></div>`}

    <div class="card-t" style="margin-top:18px">${I('users', 'sm')} Gaji guru · ${esc(R.label)}</div>
    ${dueBanner(S.data.mitras)}
    <div class="tbl-wrap"><table class="tbl tbl-static" id="tblGaji"><thead><tr><th>Guru</th><th>Hadir</th><th>Alpa</th><th>Izin</th><th>Honor / pertemuan</th><th>Total gaji</th><th>Gajian</th></tr></thead><tbody>
      ${gRows.map(r => { const g = mitraOf(r.uid), pi = g ? payInfo(g) : null; return `<tr data-guru="${esc(r.uid)}"><td><div class="t-name">${esc(r.name)}</div></td><td>${r.h}</td><td>${r.a}</td><td>${r.i} <span class="t-meta">(tidak dibayar)</span></td><td>${r.honor == null ? '—' : esc(rupiah(r.honor))}</td><td><b>${esc(rupiah(r.sum))}</b></td>
        <td>${!g ? '—' : pi.due ? payBtnHtml(g, pi, true) : pi.set ? '<span class="t-meta">tgl ' + g.payDay + ' · berikutnya ' + esc(fmtKey(pi.next)) + '</span>' : '<span class="t-warn">belum diatur</span>'}</td></tr>`; }).join('') || '<tr><td colspan="7" class="t-meta">Belum ada guru</td></tr>'}
      <tr class="tr-total"><td><b>Total</b></td><td>${gRows.reduce((n, r) => n + r.h, 0)}</td><td>${gRows.reduce((n, r) => n + r.a, 0)}</td><td>${gRows.reduce((n, r) => n + r.i, 0)}</td><td></td><td><b>${esc(rupiah(gaji))}</b></td><td></td></tr>
    </tbody></table></div>
    <div class="t-meta" style="margin-top:6px;white-space:normal">Gaji = jumlah honor yang tercatat di setiap absensi Hadir & Alpa (honor saat itu). Izin & Off tidak dibayar.</div>
    ${(() => { const pr = S.pay.payouts.filter(p => inR(p.paidDate)); return `<div class="card-t" style="margin-top:18px">${I('card', 'sm')} Gaji sudah dibayar · ${esc(R.label)}</div>` + (pr.length ? `<div class="tbl-wrap"><table class="tbl tbl-static" id="tblPayout"><thead><tr><th>Tanggal transfer</th><th>Guru</th><th>Periode</th><th>Pertemuan</th><th>Jumlah</th><th></th></tr></thead><tbody>
      ${pr.map(p => `<tr><td>${esc(fmtKey(p.paidDate))}</td><td><div class="t-name">${esc(p.mitraName)}</div>${p.note ? '<div class="t-meta">' + esc(p.note) + '</div>' : ''}</td><td>${esc(fmtKey(p.periodFrom))} – ${esc(fmtKey(p.periodTo))}</td><td>${p.sessions}x</td><td><b>${esc(rupiah(p.total))}</b></td>
        <td class="td-act"><div class="act-row"><button class="mini" data-slip="${esc(p.id)}">${I('receipt', 'sm')} Slip</button><button class="mini mini-red" data-delpo="${esc(p.id)}">${I('trash', 'sm')}</button></div></td></tr>`).join('')}</tbody></table></div>` : '<div class="card"><div class="t-meta">Belum ada gaji yang dibayarkan di periode ini.</div></div>'); })()}

    <div class="card-t" style="margin-top:18px">${I('wallet', 'sm')} Pembayaran masuk · ${esc(R.label)}</div>
    ${payR.length ? `<div class="tbl-wrap"><table class="tbl tbl-static" id="tblBayar"><thead><tr><th>Tanggal</th><th>Murid</th><th>Pelajaran</th><th>Pertemuan</th><th>Jumlah</th><th></th></tr></thead><tbody>
      ${payR.map(p => `<tr><td>${esc(fmtShortKey(p.date))}</td><td><div class="t-name">${esc(p.studentName)}</div>${p.note ? '<div class="t-meta">' + esc(p.note) + '</div>' : ''}</td><td>${esc(p.subjectName)}</td><td>${p.sessions}x</td><td><b>${esc(rupiah(p.amount))}</b></td>
        <td class="td-act"><button class="mini mini-red" data-delpay="${esc(p.id)}">${I('trash', 'sm')}</button></td></tr>`).join('')}
    </tbody></table></div>` : '<div class="card"><div class="t-meta">Belum ada pembayaran di periode ini.</div></div>'}`;
  m.querySelectorAll('[data-per]').forEach(b => b.onclick = () => { S.keuPer = b.dataset.per; renderKeuangan(m); });
  m.querySelectorAll('[data-gaji]').forEach(b => b.onclick = () => openPayout(mitraOf(b.dataset.gaji), () => renderKeuangan(m)));
  m.querySelectorAll('[data-slip]').forEach(b => b.onclick = () => viewSlip(S.pay.payouts.find(p => p.id === b.dataset.slip)));
  m.querySelectorAll('[data-delpo]').forEach(b => b.onclick = () => {
    const p = S.pay.payouts.find(x => x.id === b.dataset.delpo);
    confirmDanger({ title: 'Hapus catatan gaji?', message: `Gaji <b>${esc(p.mitraName)}</b> ${esc(rupiah(p.total))} (${esc(fmtKey(p.paidDate))}) dihapus dari catatan. Pertemuannya akan dihitung belum dibayar lagi. Uang yang sudah ditransfer tidak ikut kembali.`, confirmText: 'Hapus' }, async () => {
      try { await commitOps([['del', doc(db, 'orgs', S.org.id, 'payouts', p.id)]]); toast('Catatan gaji dihapus'); renderKeuangan(m); } catch (e) { toast('❌ ' + friendlyError(e)); }
    });
  });
  $('kfSet').onclick = () => openCycleForm(m);
  const find = id => tRows.find(r => r.c.id === id);
  m.querySelectorAll('[data-pay]').forEach(b => b.onclick = () => openPayForm(find(b.dataset.pay), m));
  m.querySelectorAll('[data-tagih]').forEach(b => b.onclick = () => tagihWA(find(b.dataset.tagih)));
  m.querySelectorAll('[data-delpay]').forEach(b => b.onclick = () => {
    const p = K.pay.find(x => x.id === b.dataset.delpay);
    confirmDanger({ title: 'Hapus pembayaran?', message: `Pembayaran <b>${esc(p.studentName)}</b> ${esc(rupiah(p.amount))} (${esc(fmtShortKey(p.date))}) dihapus. Sisa paket murid ikut berkurang ${p.sessions}x.`, confirmText: 'Hapus' }, async () => {
      try { await commitOps([['del', doc(db, 'orgs', S.org.id, 'payments', p.id)]]); toast('Pembayaran dihapus'); renderKeuangan(m); } catch (e) { toast('❌ ' + friendlyError(e)); }
    });
  });
}
function openPayForm(r, m) {
  if (!r) return;
  const cycle = S.keu.cycle, today = localKey(new Date());
  openModal(`
    <div class="modal-t">${I('wallet')} Catat Pembayaran</div>
    <div class="modal-sub"><b>${esc(r.st.name)}</b> · ${esc(r.sj ? r.sj.name : '')} · tarif ${esc(rupiah(r.rate))}/pertemuan · sisa sekarang ${r.credit}x</div>
    <div class="grid2">
      <div class="field"><label>Jumlah paket</label><select id="pfPak">${[1, 2, 3, 4, 6, 12].map(n => `<option value="${n}">${n} paket = ${n * cycle}x pertemuan</option>`).join('')}</select></div>
      <div class="field"><label>Tanggal bayar</label><input id="pfDate" type="date" value="${today}" max="${today}"/></div>
    </div>
    <div class="field"><label>Jumlah uang (Rp)</label><input id="pfAmt" type="number" inputmode="numeric" min="0" step="1000" value="${cycle * r.rate}"/>
      <div class="hint">Otomatis = pertemuan × tarif. Boleh diubah (mis. diskon).</div></div>
    <div class="field"><label>Catatan (opsional)</label><input id="pfNote" maxlength="120" placeholder="cth: transfer BCA"/></div>
    <div class="btn-row"><button class="btn btn-ghost" id="pfNo">Batal</button><button class="btn btn-primary" id="pfGo">${I('check', 'sm')} Simpan</button></div>`);
  $('pfPak').onchange = () => { $('pfAmt').value = (+$('pfPak').value) * cycle * r.rate; };
  $('pfNo').onclick = closeModal;
  $('pfGo').onclick = async () => {
    const sessions = (+$('pfPak').value) * cycle, amount = parseInt($('pfAmt').value, 10), date = $('pfDate').value;
    if (!Number.isFinite(amount) || amount < 0) { toast('Jumlah uang harus angka'); return; }
    if (!date) { toast('Isi tanggal bayar'); return; }
    $('pfGo').disabled = true;
    try {
      await commitOps([['set', doc(collection(db, 'orgs', S.org.id, 'payments')), {
        studentId: r.st.id, studentName: r.st.name, classId: r.c.id, subjectName: r.sj ? r.sj.name : '', sessions, amount, rate: r.rate, date,
        note: $('pfNote').value.trim(), by: S.user.uid, createdAt: serverTimestamp() }]]);
      closeModal(); toast('✅ Pembayaran ' + r.st.name + ' ' + rupiah(amount) + ' tercatat'); renderKeuangan(m);
    } catch (e) { $('pfGo').disabled = false; toast('❌ ' + friendlyError(e), 4000); }
  };
}
function openCycleForm(m) {
  openModal(`
    <div class="modal-t">${I('sliders')} Paket pembayaran</div>
    <div class="modal-sub">Murid membayar di depan untuk sejumlah pertemuan. Tagihan = jumlah pertemuan × tarif kelas.</div>
    <div class="field"><label>Pertemuan per paket</label><input id="cyVal" type="number" min="1" max="30" value="${S.keu.cycle}"/></div>
    <div class="btn-row"><button class="btn btn-ghost" id="cyNo">Batal</button><button class="btn btn-primary" id="cyGo">${I('check', 'sm')} Simpan</button></div>`);
  $('cyNo').onclick = closeModal;
  $('cyGo').onclick = async () => {
    const v = parseInt($('cyVal').value, 10); if (!(v >= 1 && v <= 30)) { toast('Isi 1–30'); return; }
    try { await commitOps([['set', doc(db, 'orgs', S.org.id, 'settings', 'billing'), { cycle: v }]]); closeModal(); toast('✅ Paket ' + v + 'x pertemuan'); renderKeuangan(m); }
    catch (e) { toast('❌ ' + friendlyError(e)); }
  };
}
function tagihWA(r) {
  if (!r || !r.st.phone) return;
  const cycle = S.keu.cycle, sj = r.sj ? r.sj.name : 'les';
  const text = `Halo ${r.st.parentName ? 'Bapak/Ibu ' + r.st.parentName : 'Bapak/Ibu orang tua/wali ' + r.st.name} 🙏\n\n`
    + `Pembayaran les *${sj}* untuk *${r.st.name}* (${cycle}x pertemuan berikutnya): *${rupiah(cycle * r.rate)}*`
    + (r.owed ? `\nDitambah ${r.owed}x pertemuan yang sudah berjalan: ${rupiah(r.owed * r.rate)}\n*Total: ${rupiah(r.due)}*` : '')
    + (r.credit === 1 ? `\n(Sisa 1x pertemuan yang sudah dibayar.)` : '')
    + payInfoText(S.keu.payInfo)
    + `\n\nTerima kasih.\n— ${S.org.fullName || S.org.name}`;
  window.open('https://wa.me/' + waNumber(r.st.phone) + '?text=' + encodeURIComponent(text), '_blank');
}

// ══════════════════════════════════════════════════════════════════════
// PENGGAJIAN GURU — tanggal gajian per guru (members.payDay), rekening & No WA
// diisi guru sendiri (members.bank / members.phone). Di tanggal gajian muncul
// tombol "Bayar Gaji" → upload bukti transfer → slip honor JPG → WA guru.
//   orgs/{org}/payouts/{id} {mitraUid, mitraName, periodFrom, periodTo, attIds,
//     hadir, alpa, sessions, total, paidDate, bank, proof, note, by, createdAt}
// Yang dibayar: absensi Hadir/Alpa guru itu yang BELUM masuk slip mana pun,
// sampai sehari sebelum tanggal gajian (pertemuan di hari gajian → periode berikutnya).
// ══════════════════════════════════════════════════════════════════════
function addDays(k, n) { const d = new Date(k + 'T00:00:00'); d.setDate(d.getDate() + n); return localKey(d); }
function paydayIn(y, m, pd) { const last = new Date(y, m + 1, 0).getDate(); return localKey(new Date(y, m, Math.min(pd, last))); }
async function loadPayroll() {
  const o = S.org.id;
  const [att, po] = await Promise.all([getDocs(collection(db, 'orgs', o, 'att')), getDocs(collection(db, 'orgs', o, 'payouts'))]);
  S.pay = { att: att.docs.map(d => Object.assign({ id: d.id }, d.data())), payouts: po.docs.map(d => Object.assign({ id: d.id }, d.data())).sort((a, b) => b.paidDate.localeCompare(a.paidDate)) };
  return S.pay;
}
function payInfo(g) {
  const P = S.pay, today = localKey(new Date());
  const paidIds = new Set(P.payouts.filter(p => p.mitraUid === g.id).flatMap(p => p.attIds || []));
  const mine = P.att.filter(a => a.mitraUid === g.id && isPaidSession(a) && !paidIds.has(a.id));
  const sum = l => l.reduce((n, a) => n + (a.honor || 0), 0);
  if (!g.payDay) return { set: false, running: mine, runTotal: sum(mine) };
  const t = new Date();
  let last = paydayIn(t.getFullYear(), t.getMonth(), g.payDay), next;
  if (last > today) { next = last; last = paydayIn(t.getFullYear(), t.getMonth() - 1, g.payDay); }
  else next = paydayIn(t.getFullYear(), t.getMonth() + 1, g.payDay);
  const cutoff = addDays(last, -1);
  const unpaid = mine.filter(a => a.date <= cutoff).sort((a, b) => a.date.localeCompare(b.date));
  const running = mine.filter(a => a.date > cutoff);
  const paidThis = P.payouts.some(p => p.mitraUid === g.id && p.paidDate >= last);
  const late = Math.round((new Date(today + 'T00:00:00') - new Date(last + 'T00:00:00')) / 864e5);
  return { set: true, last, next, cutoff, unpaid, total: sum(unpaid), running, runTotal: sum(running), due: !paidThis && unpaid.length > 0 && last >= (g.payDaySince || ''), late };
}
function bankLine(g) { const b = g.bank || {}; return b.number ? [b.bank, b.number].filter(Boolean).join(' ') + (b.holder ? ' a.n. ' + b.holder : '') : ''; }
function payBtnHtml(g, info, small) {
  if (!info.due) return '';
  const when = info.late === 0 ? 'hari ini gajian' : info.late + ' hari terlambat';
  return `<button class="${small ? 'mini mini-green' : 'btn btn-green'} pay-btn${info.late > 0 ? ' is-late' : ''}" data-gaji="${esc(g.id)}">${I('wallet', 'sm')} Bayar Gaji ${esc(rupiah(info.total))} · ${when}</button>`;
}
function dueBanner(gurus) {
  const due = gurus.map(g => ({ g, i: payInfo(g) })).filter(x => x.i.due);
  if (!due.length) return '';
  return `<div class="gaji-banner">${I('wallet')}<div><b>Waktunya gajian</b><div>${due.map(x => esc(x.g.name) + ' · ' + esc(rupiah(x.i.total)) + (x.i.late ? ' <span class="t-warn">(' + x.i.late + ' hari terlambat)</span>' : ' (hari ini)')).join('<br>')}</div></div></div>`;
}
let PO = null; // pembayaran gaji yang sedang dibuka
function openPayout(g, after) {
  const info = payInfo(g); if (!info.due) return;
  PO = { g, info, proof: null, after };
  const bl = bankLine(g), h = info.unpaid.filter(a => a.status === 'hadir').length, al = info.unpaid.length - h;
  openModal(`
    <div class="modal-t">${I('wallet')} Bayar Gaji · ${esc(g.name)}</div>
    <div class="modal-sub">Periode <b>${esc(fmtKey(info.unpaid[0].date))} – ${esc(fmtKey(info.cutoff))}</b> · gajian tiap tanggal ${g.payDay}</div>
    <div class="po-sum"><div><div class="t-meta">${h} hadir${al ? ' · ' + al + ' alpa (tetap dihonor)' : ''}</div><div class="po-total">${esc(rupiah(info.total))}</div></div>
      <div class="t-meta" style="text-align:right">${info.unpaid.length} pertemuan<br>honor tercatat di tiap absensi</div></div>
    <div class="field"><label>Transfer ke rekening</label>
      ${bl ? `<div class="po-bank"><b>${esc(bl)}</b><button class="mini" id="poCopy" style="flex:0 0 auto">${I('copy', 'sm')} Salin No. Rek</button></div>`
           : `<div class="msg msg-err" style="margin:0">${esc(g.name)} belum mengisi rekening. Minta guru membuka aplikasi Guru → Lainnya → Rekening gaji.</div>`}
    </div>
    <div class="field"><label>Foto bukti transfer</label>
      <div class="po-proof" id="poProofBox"><button class="btn btn-ghost" id="poPick" style="margin:0">${I('camera', 'sm')} Upload bukti transfer</button></div>
      <input type="file" id="poProof" accept="image/*" style="display:none"/></div>
    <div class="grid2">
      <div class="field"><label>Tanggal transfer</label><input id="poDate" type="date" value="${localKey(new Date())}" max="${localKey(new Date())}"/></div>
      <div class="field"><label>Catatan (opsional)</label><input id="poNote" maxlength="80" placeholder="cth: transfer BCA"/></div>
    </div>
    <div id="poMsg"></div>
    <div class="btn-row"><button class="btn btn-ghost" id="poNo">Batal</button><button class="btn btn-primary" id="poGo">${I('check', 'sm')} Simpan & Buat Slip</button></div>`);
  const cp = $('poCopy'); if (cp) cp.onclick = async () => { try { await navigator.clipboard.writeText((g.bank || {}).number || ''); toast('✅ No. rekening tersalin'); } catch (e) { prompt('Salin nomor rekening:', (g.bank || {}).number || ''); } };
  $('poPick').onclick = () => $('poProof').click();
  $('poProof').onchange = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    try { PO.proof = await compressPhoto(f); $('poProofBox').innerHTML = `<img src="${PO.proof}" alt="Bukti transfer"/><button class="mini" id="poRe">${I('refresh', 'sm')} Ganti foto</button>`; $('poRe').onclick = () => $('poProof').click(); }
    catch (err) { toast('❌ ' + err.message); }
  };
  $('poNo').onclick = closeModal;
  $('poGo').onclick = savePayout;
}
async function savePayout() {
  const { g, info } = PO;
  if (!PO.proof) { $('poMsg').innerHTML = '<div class="msg msg-err">Upload foto bukti transfer dulu.</div>'; return; }
  const paidDate = $('poDate').value || localKey(new Date());
  $('poGo').disabled = true; $('poGo').textContent = 'Menyimpan…';
  const ref = doc(collection(db, 'orgs', S.org.id, 'payouts'));
  const p = { mitraUid: g.id, mitraName: g.name.replace(/ \(Anda\)$/, ''), periodFrom: info.unpaid[0].date, periodTo: info.cutoff,
    attIds: info.unpaid.map(a => a.id), hadir: info.unpaid.filter(a => a.status === 'hadir').length, alpa: info.unpaid.filter(a => a.status === 'alpa').length,
    sessions: info.unpaid.length, total: info.total, paidDate, bank: g.bank || {}, proof: PO.proof, note: $('poNote').value.trim(), by: S.user.uid, createdAt: serverTimestamp() };
  try {
    await commitOps([['set', ref, p]]);
    p.id = ref.id;
    await showSlipReady(p, info.unpaid, g);
  } catch (e) { console.error(e); $('poGo').disabled = false; $('poGo').textContent = 'Simpan & Buat Slip'; $('poMsg').innerHTML = `<div class="msg msg-err">Gagal menyimpan: ${esc(friendlyError(e))}</div>`; }
}
// Slip siap → pilih format (JPG / PDF) lalu kirim (dipisah supaya menu bagikan HP tidak diblokir browser)
async function showSlipReady(p, rows, g) {
  const cv = await renderSlipCanvas(p, rows, S.org, S.member.name);
  const jpg = await canvasToBlob(cv, 'image/jpeg', 0.9);
  const after = PO && PO.after;
  const F = { fmt: slipDefaultFormat(rows.length), pdf: null };
  const many = rows.length >= SLIP_PDF_FROM;
  openModal(`
    <div class="modal-t">${I('check-circle')} Gaji ${esc(p.mitraName)} tercatat</div>
    <div class="modal-sub">${esc(rupiah(p.total))} · ${p.sessions} pertemuan · ditransfer ${esc(fmtKey(p.paidDate))}. Kirim slip honor ke WA ${esc(p.mitraName)}:</div>
    <div class="slip-prev"><img src="${URL.createObjectURL(jpg)}" alt="Slip honor"/></div>
    <div class="field" style="margin-bottom:8px"><label>Format slip</label>
      <div class="seg" style="margin-bottom:4px"><button class="seg-b" data-fmt="jpg">${I('image', 'sm')} Gambar JPG</button><button class="seg-b" data-fmt="pdf">${I('receipt', 'sm')} Dokumen PDF</button></div>
      <div class="hint" id="slHint"></div></div>
    <button class="btn btn-green" id="slSend"></button>
    <button class="btn btn-ghost" id="slDl"></button>
    <button class="btn btn-ghost" id="slClose">Selesai</button>`);
  const paint = () => {
    document.querySelectorAll('[data-fmt]').forEach(x => x.classList.toggle('on', x.dataset.fmt === F.fmt));
    const pdf = F.fmt === 'pdf';
    $('slHint').textContent = pdf ? 'PDF ukuran A4, rapi dibaca & dicetak' + (many ? ' — disarankan karena ' + rows.length + ' pertemuan.' : '.')
      : 'Gambar langsung tampil di chat WA' + (many ? '. ' + rows.length + ' pertemuan: gambar jadi panjang, lebih rapi pakai PDF.' : '.');
    $('slSend').innerHTML = `${I('chat')} Kirim Slip ${pdf ? 'PDF' : 'JPG'} ke WA ${esc(p.mitraName)}${g.phone ? ' (' + esc(g.phone) + ')' : ''}`;
    $('slDl').innerHTML = `${I('download')} Unduh Slip (${pdf ? 'PDF' : 'JPG'})`;
  };
  // PDF dibuat lebih dulu (saat format dipilih) supaya tombol kirim tetap dianggap klik langsung oleh HP
  const prepPdf = async () => { if (!F.pdf) { try { F.pdf = await slipPdfBlob(cv, slipNo(p)); } catch (e) { toast('❌ ' + e.message); } } return F.pdf; };
  document.querySelectorAll('[data-fmt]').forEach(x => x.onclick = () => { F.fmt = x.dataset.fmt; paint(); if (F.fmt === 'pdf') prepPdf(); });
  paint(); if (F.fmt === 'pdf') prepPdf();
  const file = async () => (F.fmt === 'pdf' ? { blob: await prepPdf(), ext: 'pdf', type: 'application/pdf' } : { blob: jpg, ext: 'jpg', type: 'image/jpeg' });
  $('slSend').onclick = async () => { const f = await file(); if (f.blob) sendSlip(p, cv, f, g); };
  $('slDl').onclick = async () => { const f = await file(); if (f.blob) dlBlob(f.blob, slipNo(p) + '.' + f.ext); };
  $('slClose').onclick = () => { closeModal(); if (after) after(); };
  if (after) after(true);
}
function dlBlob(blob, name) { const u = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 4000); }
async function sendSlip(p, cv, f, g) {
  const text = slipWaText(p, S.org.name, S.member.name);
  const name = slipNo(p) + '.' + f.ext, file = new File([f.blob], name, { type: f.type });
  const mobile = (navigator.userAgentData && navigator.userAgentData.mobile) || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '');
  try {
    if (mobile && navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], text }); return; }
  } catch (e) { if (e && e.name === 'AbortError') return; }
  // PC (atau HP tanpa fitur bagikan): JPG → gambar disalin (Ctrl+V di chat); PDF → file diunduh lalu dilampirkan
  let copied = false;
  if (f.ext === 'jpg') { try { const png = await canvasToBlob(cv, 'image/png'); await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })]); copied = true; } catch (e) {} }
  const ph = waNumber(g.phone || '');
  window.open('https://wa.me/' + (ph || '') + '?text=' + encodeURIComponent(text), '_blank');
  if (!copied) dlBlob(f.blob, name);
  toast(copied ? '✅ Slip tersalin — di chat WA ' + p.mitraName + ' tekan Ctrl+V lalu kirim'
    : 'ℹ️ Slip ' + f.ext.toUpperCase() + ' diunduh (' + name + ') — lampirkan ke chat WA ' + p.mitraName + ' (📎 → Dokumen, atau seret filenya)', 8000);
}
async function viewSlip(p) {
  const rows = S.pay.att.filter(a => (p.attIds || []).includes(a.id));
  const g = mitraOf(p.mitraUid) || { id: p.mitraUid, name: p.mitraName, phone: '' };
  PO = null;
  await showSlipReady(p, rows, g);
}

// ══════════════════════════════════════════════════════════════════════
// LANGGANAN LEMBAGA — Paket Mulai 1 Admin + 2 Guru Mitra, tambah slot
// Rp100.000 (5 slot Rp449.000), bayar lewat Midtrans (functions/index.js).
// ══════════════════════════════════════════════════════════════════════
function tsMs(t) { return t && t.toMillis ? t.toMillis() : (t && t.seconds ? t.seconds * 1000 : 0); }
function orgInfo() {
  const o = S.org || {}, now = Date.now();
  const org = { seats: o.seats, plan: o.plan, period: o.period, activeUntilMs: tsMs(o.activeUntil), createdAtMs: tsMs(o.createdAt) || now };
  const endsMs = BL.orgEndsMs(org);
  return { org, endsMs, paid: o.plan === 'pro', active: endsMs > now, daysLeft: Math.ceil((endsMs - now) / BL.DAY_MS),
    seats: o.seats || BL.ORG_BASE_SLOTS, extra: Math.max(0, (o.seats || BL.ORG_BASE_SLOTS) - BL.ORG_BASE_SLOTS), period: o.period || 'monthly' };
}
const fmtMs = ms => new Date(ms).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
// Sisa uji coba: "13 hari 5 jam" / "5 jam 12 menit" (diperbarui tiap menit, lihat tickTrial)
function trialLeftTxt(endsMs) {
  const ms = Math.max(0, endsMs - Date.now()), m = Math.floor(ms / 60000), d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60);
  return d ? `${d} hari ${h} jam` : `${h} jam ${m % 60} menit`;
}
let trialTimer = null;
function tickTrial() {
  clearInterval(trialTimer);
  const el = $('subCd'); if (!el) return;
  const endsMs = orgInfo().endsMs;
  trialTimer = setInterval(() => { const e = $('subCd'); if (!e) return clearInterval(trialTimer); e.textContent = trialLeftTxt(endsMs); }, 60000);
}
function subBanner() {
  if (!isAdmin()) return '';
  const i = orgInfo();
  let t = '';
  if (!i.active) t = `<b>${i.paid ? 'Langganan lembaga berakhir' : 'Masa uji coba berakhir'}</b> ${fmtMs(i.endsMs)}. Data tetap aman, tapi Guru Mitra tidak bisa absen & murid baru tidak bisa ditambah.`;
  else if (!i.paid) t = `<b>Uji coba gratis ${BL.ORG_TRIAL_DAYS} hari</b> · sisa <b class="sub-cd" id="subCd">${trialLeftTxt(i.endsMs)}</b><span class="sub-cd-until"> (sampai ${fmtMs(i.endsMs)})</span>`;
  else if (i.paid && i.daysLeft <= 5) t = `<b>Langganan berakhir ${i.daysLeft} hari lagi</b> (${fmtMs(i.endsMs)}).`;
  if (!t) return '';
  return `<div class="sub-banner${i.active ? '' : ' is-off'}${!i.paid && i.active && i.daysLeft > 3 ? ' is-trial' : ''}">${I(i.active ? 'clock' : 'lock')}<div class="grow">${t}</div><button class="mini ${i.active ? '' : 'mini-red'}" id="subBtn">${i.paid ? 'Perpanjang' : 'Beli Sekarang'}</button></div>`;
}
function subCard() {
  const i = orgInfo();
  const status = !i.active ? `<span class="pill pill-red">${i.paid ? 'BERAKHIR' : 'UJI COBA BERAKHIR'}</span>` : i.paid ? '<span class="pill pill-green">AKTIF</span>' : '<span class="pill pill-amber">UJI COBA</span>';
  return `<div class="card" id="subCard">
      <div class="row"><div class="grow"><div class="card-t" style="margin:0">Langganan Lembaga</div></div>${status}</div>
      <div class="t-meta" style="white-space:normal;margin-top:8px;line-height:1.7">
        ${i.paid ? (i.active ? 'Aktif sampai' : 'Berakhir') : (i.active ? 'Uji coba gratis sampai' : 'Uji coba berakhir')} <b style="color:var(--text)">${esc(fmtMs(i.endsMs))}</b>${i.active ? ' · ' + i.daysLeft + ' hari lagi' : ''}<br>
        1 Guru Admin + <b style="color:var(--text)">${i.seats} slot Guru Mitra</b>${i.paid ? ' · ' + (i.period === 'yearly' ? 'tahunan' : 'bulanan') + ' ' + esc(rupiah(BL.periodPrice(i.extra, i.period))) : ''}</div>
      <div class="mini-btns">
        <button class="mini mini-green" id="subGo">${I('card', 'sm')} ${i.paid ? 'Perpanjang' : 'Pilih Paket Langganan'}</button>
        ${i.paid && i.active ? `<button class="mini" id="subAdd">${I('plus', 'sm')} Tambah Slot Guru</button>` : ''}
        <button class="mini" id="subCheck">${I('refresh', 'sm')} Cek status pembayaran</button>
      </div>
      <div id="subInv" class="t-meta" style="margin-top:10px;white-space:normal"></div>
    </div>`;
}
async function bindSubCard() {
  $('subGo').onclick = () => openSubscribe();
  const a = $('subAdd'); if (a) a.onclick = () => openAddSlots();
  $('subCheck').onclick = async () => { $('subCheck').disabled = true; await checkPayments(true); };
  try {
    const snap = await getDocs(collection(db, 'orgs', S.org.id, 'invoices'));
    const list = snap.docs.map(d => Object.assign({ id: d.id }, d.data())).sort((x, y) => tsMs(y.paidAt) - tsMs(x.paidAt));
    if (list.length && $('subInv')) $('subInv').innerHTML = `<div class="card-t" style="margin:6px 0">Riwayat pembayaran</div>` + list.map(x =>
      `<div class="row" style="padding:6px 0;border-top:1px solid var(--border)"><div class="grow">${esc(x.label || '')}<br><span style="font-size:0.78rem">${esc(fmtMs(tsMs(x.paidAt)))} · ${esc(x.id)}</span></div><b style="color:var(--text)">${esc(rupiah(x.amount))}</b></div>`).join('');
  } catch (e) {}
}
// Jumlah slot terisi (undangan + guru, termasuk Guru Admin yang ikut mengajar)
async function usedSlots() {
  const snap = await getDocs(collection(db, 'orgs', S.org.id, 'slots'));
  return snap.size;
}
function stepperHtml(id, v) { return `<div class="stepper"><button class="st-b" data-st="-1" aria-label="Kurangi">−</button><b id="${id}">${v}</b><button class="st-b" data-st="1" aria-label="Tambah">＋</button></div>`; }
async function openSubscribe() {
  const i = orgInfo();
  let used = 0; try { used = await usedSlots(); } catch (e) {}
  const lockUp = i.paid && i.active; // langganan aktif: tambah slot lewat "Tambah Slot Guru" (bayar sisa hari)
  const minX = Math.max(0, used - BL.ORG_BASE_SLOTS), maxX = lockUp ? i.extra : BL.ORG_MAX_EXTRA;
  const F = { extra: Math.min(maxX, Math.max(minX, i.extra)), period: i.paid ? i.period : 'monthly' };
  openModal(`
    <div class="modal-t">${I('card')} ${i.paid ? 'Perpanjang Langganan' : 'Langganan LLK Lembaga'}</div>
    <div class="modal-sub">Paket Mulai: 1 Guru Admin + ${BL.ORG_BASE_SLOTS} Guru Mitra. Dapat guru baru? Tambah slot kapan saja.</div>
    <div class="seg" style="margin-bottom:12px"><button class="seg-b" data-per="monthly">Bulanan</button><button class="seg-b" data-per="yearly">Tahunan · gratis 2 bulan</button></div>
    <div class="field"><label>Slot Guru Mitra tambahan</label>
      <div class="row" style="gap:12px">${stepperHtml('suX', F.extra)}<div class="grow t-meta" id="suGuru" style="white-space:normal"></div></div>
      <div class="hint" id="suHint"></div></div>
    <div class="po-sum" id="suSum" style="display:block"></div>
    <div id="suMsg"></div>
    <button class="btn btn-green" id="suPay"></button>
    <button class="btn btn-ghost" id="suNo">Batal</button>`);
  const paint = () => {
    document.querySelectorAll('[data-per]').forEach(b => b.classList.toggle('on', b.dataset.per === F.period));
    const x = F.extra, mo = BL.monthlyPrice(x), tot = BL.periodPrice(x, F.period), save = BL.bundleSaving(x), r = x % BL.ORG_BUNDLE;
    $('suX').textContent = x;
    $('suGuru').innerHTML = `= <b style="color:var(--text)">${BL.ORG_BASE_SLOTS + x} Guru Mitra</b> + 1 Guru Admin`;
    $('suHint').innerHTML = lockUp && x === maxX ? 'Butuh lebih banyak guru sekarang? Tutup lalu pakai <b>Tambah Slot Guru</b> (bayar sisa hari saja).'
      : x <= minX && minX > 0 ? `Minimal ${minX} slot tambahan — sudah ada ${used} guru/undangan.`
      : r === 4 ? `🎁 Tambah 1 slot lagi cuma +${rupiah(BL.ORG_BUNDLE_PRICE - 4 * BL.ORG_SLOT)} (5 slot = ${rupiah(BL.ORG_BUNDLE_PRICE)})`
      : `${rupiah(BL.ORG_SLOT)}/slot · 5 slot cuma ${rupiah(BL.ORG_BUNDLE_PRICE)} (hemat ${rupiah(BL.ORG_BUNDLE * BL.ORG_SLOT - BL.ORG_BUNDLE_PRICE)})`;
    const startMs = Math.max(Date.now(), i.endsMs), untilMs = startMs + BL.ORG_PERIODS[F.period].days * BL.DAY_MS;
    $('suSum').innerHTML = `
      <div class="row"><div class="grow">Paket Mulai (1 Admin + ${BL.ORG_BASE_SLOTS} Guru Mitra)</div><b>${rupiah(BL.ORG_BASE)}</b></div>
      ${x ? `<div class="row"><div class="grow">${x} slot tambahan${save ? ` <span class="pill pill-green">🎉 Hemat ${rupiah(save)}</span>` : ''}</div><b>${save ? `<s class="t-meta">${rupiah(x * BL.ORG_SLOT)}</s> ` : ''}${rupiah(BL.extraPrice(x))}</b></div>` : ''}
      <div class="row" style="border-top:1px solid var(--border);margin-top:6px;padding-top:6px"><div class="grow">Per bulan</div><b>${rupiah(mo)}</b></div>
      ${F.period === 'yearly' ? `<div class="row"><div class="grow">Tahunan: bayar 10 bulan, aktif 12 bulan</div><b>${rupiah(tot)}</b></div>` : ''}
      <div class="t-meta" style="margin-top:6px;white-space:normal">Aktif sampai <b style="color:var(--text)">${fmtMs(untilMs)}</b>${i.active ? ' (ditambahkan setelah masa sekarang habis)' : ''}</div>`;
    $('suPay').innerHTML = `${I('card', 'sm')} Bayar ${rupiah(tot)}`;
    document.querySelector('[data-st="-1"]').disabled = x <= minX;
    document.querySelector('[data-st="1"]').disabled = x >= maxX;
  };
  document.querySelectorAll('[data-per]').forEach(b => b.onclick = () => { F.period = b.dataset.per; paint(); });
  document.querySelectorAll('[data-st]').forEach(b => b.onclick = () => { F.extra = Math.min(maxX, Math.max(minX, F.extra + +b.dataset.st)); paint(); });
  $('suNo').onclick = closeModal;
  $('suPay').onclick = () => startPayment({ orgId: S.org.id, action: 'subscribe', extra: F.extra, period: F.period }, 'suPay', 'suMsg');
  paint();
}
function openAddSlots() {
  const i = orgInfo();
  const F = { add: 1 };
  openModal(`
    <div class="modal-t">${I('plus')} Tambah Slot Guru Mitra</div>
    <div class="modal-sub">Sekarang ${i.seats} slot. Slot baru langsung bisa dipakai mengundang guru.</div>
    <div class="field"><label>Tambah berapa slot?</label><div class="row" style="gap:12px">${stepperHtml('asN', 1)}<div class="grow t-meta" id="asGuru" style="white-space:normal"></div></div>
      <div class="hint" id="asHint"></div></div>
    <div class="po-sum" id="asSum" style="display:block"></div>
    <div id="asMsg"></div>
    <button class="btn btn-green" id="asPay"></button>
    <button class="btn btn-ghost" id="asNo">Batal</button>`);
  const paint = () => {
    const n = F.add, oldMo = BL.periodPrice(i.extra, i.period), newMo = BL.periodPrice(i.extra + n, i.period);
    const pr = BL.addSlotsPrice(i.org, n, Date.now()), per = i.period === 'yearly' ? '/tahun' : '/bulan';
    const trialLeft = i.org.createdAtMs + BL.ORG_TRIAL_DAYS * BL.DAY_MS > Date.now();
    const save = BL.bundleSaving(i.extra + n) - BL.bundleSaving(i.extra);
    $('asN').textContent = n;
    $('asGuru').innerHTML = `jadi <b style="color:var(--text)">${i.seats + n} Guru Mitra</b>`;
    $('asHint').innerHTML = n % BL.ORG_BUNDLE === 0 || save > 0 ? `🎉 Harga paket 5 slot: Hemat ${rupiah(save)}${per === '/bulan' ? ' tiap bulan' : ''}` : `${rupiah(BL.ORG_SLOT)}/slot/bulan · 5 slot cuma ${rupiah(BL.ORG_BUNDLE_PRICE)}`;
    $('asSum').innerHTML = `
      <div class="row"><div class="grow">Langganan sekarang (${i.seats} slot)</div><b>${rupiah(oldMo)}${per}</b></div>
      <div class="row"><div class="grow">Setelah tambah ${n} slot (${i.seats + n} slot)</div><b>${rupiah(newMo)}${per}</b></div>
      <div class="row" style="border-top:1px solid var(--border);margin-top:6px;padding-top:6px"><div class="grow">Bayar sekarang untuk ${pr.days} hari tersisa (sampai ${fmtMs(i.endsMs)})${trialLeft ? ` — gratis selama sisa uji coba` : ''}</div><b>${rupiah(pr.amount)}</b></div>
      <div class="t-meta" style="margin-top:6px;white-space:normal">Perpanjangan berikutnya ${rupiah(newMo)}${per}.</div>`;
    $('asPay').innerHTML = `${I('card', 'sm')} Bayar ${rupiah(pr.amount)}`;
    document.querySelector('[data-st="-1"]').disabled = n <= 1;
  };
  document.querySelectorAll('[data-st]').forEach(b => b.onclick = () => { F.add = Math.min(BL.ORG_MAX_EXTRA - i.extra, Math.max(1, F.add + +b.dataset.st)); paint(); });
  $('asNo').onclick = closeModal;
  $('asPay').onclick = () => startPayment({ orgId: S.org.id, action: 'addSlots', add: F.add }, 'asPay', 'asMsg');
  paint();
}
let snapLoading = null;
function loadSnap() {
  if (window.snap && window.snap.pay) return Promise.resolve(window.snap);
  if (snapLoading) return snapLoading;
  snapLoading = new Promise((resolve, reject) => {
    const sc = document.createElement('script');
    sc.src = (BL.MIDTRANS_V2.production ? 'https://app.midtrans.com' : 'https://app.sandbox.midtrans.com') + '/snap/snap.js';
    sc.setAttribute('data-client-key', BL.MIDTRANS_V2.clientKey);
    sc.onload = () => (window.snap ? resolve(window.snap) : reject(new Error('Midtrans tidak tersedia')));
    sc.onerror = () => { snapLoading = null; reject(new Error('Gagal memuat Midtrans (cek internet)')); };
    document.head.appendChild(sc);
  });
  return snapLoading;
}
async function startPayment(req, btnId, msgId) {
  const btn = $(btnId), msg = (t, cls) => { $(msgId).innerHTML = `<div class="msg ${cls || 'msg-err'}">${t}</div>`; };
  btn.disabled = true; const label = btn.innerHTML; btn.textContent = 'Menyiapkan pembayaran…';
  let r;
  try { [r] = await Promise.all([callFn('createOrgTransaction', req), loadSnap()]); }
  catch (e) { btn.disabled = false; btn.innerHTML = label; msg(esc((e && e.message) || 'Gagal membuat pembayaran')); return; }
  const done = (kind) => { closeModal(); waitActivation(r.orderId, kind); };
  const cb = {
    onSuccess: () => done('success'),
    onPending: () => done('pending'),
    onError: () => { btn.disabled = false; btn.innerHTML = label; msg('Pembayaran gagal. Coba lagi atau pilih metode lain.'); },
    onClose: () => { btn.disabled = false; btn.innerHTML = label; checkPayments(false); },
  };
  // Jendela Snap kadang "nyangkut" (snap.pay not allowed in this state) → tutup & coba lagi,
  // kalau tetap ditolak buka halaman pembayaran Midtrans langsung.
  try { window.snap.pay(r.token, cb); }
  catch (e1) {
    try { if (window.snap.hide) window.snap.hide(); } catch (e) {}
    try { window.snap.pay(r.token, cb); }
    catch (e2) { if (r.redirectUrl) location.href = r.redirectUrl; else { btn.disabled = false; btn.innerHTML = label; msg(esc(e2.message || 'Gagal membuka Midtrans')); } }
  }
}
// Server mengaktifkan lewat notifikasi Midtrans; aplikasi ikut mengecek supaya cepat tampil
async function waitActivation(orderId, kind) {
  openModal(`<div class="modal-t">${I(kind === 'success' ? 'check-circle' : 'hourglass')} ${kind === 'success' ? 'Pembayaran berhasil' : 'Menunggu pembayaran'}</div>
    <div class="modal-sub" id="waTxt">${kind === 'success' ? 'Mengaktifkan langganan…' : 'Selesaikan pembayaran sesuai petunjuk (transfer VA / QRIS). Langganan aktif otomatis setelah dibayar — boleh tutup jendela ini.'}</div>
    <button class="btn btn-ghost" id="waClose">Tutup</button>`);
  $('waClose').onclick = closeModal;
  for (let k = 0; k < (kind === 'success' ? 12 : 3); k++) {
    if (k) await new Promise(res => setTimeout(res, 2500));
    if (await refreshOrg(orderId)) {
      const i = orgInfo();
      if ($('waTxt')) $('waTxt').innerHTML = `✅ Langganan aktif sampai <b>${esc(fmtMs(i.endsMs))}</b> · ${i.seats} slot Guru Mitra.`;
      toast('✅ Langganan aktif · ' + i.seats + ' slot Guru Mitra', 4000);
      renderShell(); return;
    }
    if (k === 1 || k === 6) await checkPayments(false);
  }
  if (kind === 'success' && $('waTxt')) $('waTxt').innerHTML = 'Pembayaran diterima. Aktivasi sedang diproses — buka Lainnya → <b>Cek status pembayaran</b> beberapa saat lagi.';
}
async function refreshOrg(orderId) {
  try {
    const o = await getDoc(doc(db, 'orgs', S.org.id));
    S.org = Object.assign({ id: o.id }, o.data());
    return orderId ? S.org.lastOrderId === orderId : true;
  } catch (e) { return false; }
}
async function checkPayments(manual) {
  try {
    const before = S.org.lastOrderId;
    await callFn('checkMidtransPayment', {});
    await refreshOrg();
    if (S.org.lastOrderId !== before) { toast('✅ Pembayaran terkonfirmasi — langganan diperbarui', 4000); renderShell(); }
    else if (manual) { toast('Belum ada pembayaran baru yang lunas', 3000); if (S.tab === 'lainnya') renderTab(); }
  } catch (e) { if (manual) { toast('❌ ' + ((e && e.message) || 'Gagal mengecek')); if (S.tab === 'lainnya') renderTab(); } }
}

// ══════════════════════════════════════════════════════════════════════
// ADMIN — LAINNYA
// ══════════════════════════════════════════════════════════════════════
function payInfoText(p) {
  p = p || {};
  if (!p.number && !p.note) return '';
  return `\n\nPembayaran bisa ditransfer ke:\n${[p.bank, p.number].filter(Boolean).join(' ')}${p.holder ? ' a.n. ' + p.holder : ''}${p.note ? '\n' + p.note : ''}`;
}
function backBar(m, title, sub) {
  return `<button class="back-link" id="olBack">${I('chevron-left', 'sm')} Lainnya</button>
    <div class="page-title">${title}</div><div class="page-sub">${sub}</div>`;
}
function bindBack(m) { $('olBack').onclick = () => renderAdminLainnya(m); }
function renderAdminLainnya(m) {
  const i = orgInfo();
  const plan = !i.active ? '<span class="pill pill-red">LANGGANAN HABIS</span>' : i.paid ? '<span class="pill pill-green">LEMBAGA AKTIF</span>' : '<span class="pill pill-amber">UJI COBA · ' + i.daysLeft + ' HARI</span>';
  const photo = S.user.photoURL ? `<img src="${esc(S.user.photoURL)}" alt=""/>` : esc(initials(S.member.name));
  const mi = (id, ic, l, d, color) => `<button class="menu-item" id="${id}"><div class="menu-ic"${color ? ` style="color:${color}"` : ''}>${I(ic)}</div><div><div class="menu-l"${color ? ` style="color:${color}"` : ''}>${l}</div><div class="menu-d">${d}</div></div>${color ? '' : `<span class="menu-arrow">${I('chevron-right', 'sm')}</span>`}</button>`;
  m.innerHTML = `
    <div class="page-title">Lainnya</div><div class="page-sub">Pengaturan lembaga & akun</div>
    <div class="card acct">
      <div class="acct-av">${photo}</div>
      <div class="grow" style="min-width:0"><div class="t-name">${esc(S.member.name)}</div><div class="t-meta">${esc(S.user.email || '')}</div>
        <div style="margin-top:6px;display:flex;gap:6px;flex-wrap:wrap"><span class="pill pill-grey">GURU ADMIN</span>${plan}</div></div>
    </div>
    ${subCard()}
    <div class="card" style="padding:4px 14px">
      ${mi('olProfil', 'palette', 'Profil & Tampilan Lembaga', 'Nama singkat & panjang, logo, warna, tema tampilan')}
      ${mi('olPay', 'card', 'Info Pembayaran Lembaga', 'Rekening lembaga — ikut tercantum di pesan tagihan WA')}
      ${mi('olBackup', 'download', 'Backup Data Lembaga', 'Unduh semua data lembaga (murid, jadwal, absensi, keuangan, gaji)')}
    </div>
    <div class="card" style="padding:4px 14px">
      ${mi('olMode', 'repeat', 'Ganti Mode', 'Pindah ke Guru Lepas (LLK V1) atau pilihan lain')}
      ${mi('olOut', 'logout', 'Keluar (Logout)', esc(S.user.email || ''), 'var(--danger)')}
    </div>
    <div class="t-meta" style="text-align:center;margin:10px 0 4px">LesLesanKu · LLK Lembaga (V2)</div>`;
  $('olProfil').onclick = () => renderProfilLembaga(m);
  $('olPay').onclick = () => renderPayInfo(m);
  $('olBackup').onclick = backupLembaga;
  $('olMode').onclick = renderChooser;
  $('olOut').onclick = logout;
  bindSubCard();
}
function renderProfilLembaga(m) {
  const o = S.org, F = { color: validHex(o.color) ? o.color : '#a8372a', logo: o.logo || null };
  m.innerHTML = `${backBar(m, 'Profil & Tampilan', 'Tampil di aplikasi Admin, aplikasi Guru Mitra & pesan WA')}
    <div class="card-t">Pratinjau header</div>
    <div class="hdr-prev" id="ppHdr"><div class="hp-logo" id="ppLogo"></div><div style="min-width:0"><div class="hp-n" id="ppName"></div><div class="hp-s" id="ppSub"></div></div></div>
    <div class="card">
      <div class="field"><label>Nama singkat lembaga</label><input id="plName" maxlength="30" value="${esc(o.name)}" placeholder="cth: FMS"/></div>
      <div class="field"><label>Nama panjang lembaga</label><input id="plFull" maxlength="60" value="${esc(o.fullName || '')}" placeholder="cth: Ferdian Music School"/>
        <div class="hint">Tampil di bawah nama singkat & di akhir pesan tagihan WA.</div></div>
      <div class="field"><label>Logo</label>
        <div class="logo-pick"><div class="logo-box" id="plLogoBox"></div>
          <button class="btn btn-ghost" style="width:auto;padding:10px 16px" id="plLogoBtn">${I('image', 'sm')} Pilih Foto</button>
          <button class="btn btn-ghost" style="width:auto;padding:10px 16px;color:var(--danger)" id="plLogoDel">${I('trash', 'sm')} Hapus</button>
          <input type="file" id="plLogo" accept="image/*" style="display:none"/></div>
        <div class="hint" style="margin-top:8px">Tanpa foto? Pakai teks singkat (maks. 4 huruf):</div>
        <input id="plLogoText" maxlength="4" value="${esc(o.logoText || '')}" placeholder="${esc(initials(o.name))}" style="margin-top:6px"/></div>
      <div class="field"><label>Warna lembaga</label>
        <div class="swatches" id="plSw">${ORG_COLORS.map(c => `<button class="sw" data-c="${c}" style="background:${c}" aria-label="Warna ${c}"></button>`).join('')}</div>
        <input id="plHex" maxlength="7" value="${esc(F.color)}" style="font-family:monospace;text-transform:uppercase"/></div>
      <button class="btn btn-primary" id="plSave">${I('check')} Simpan Profil Lembaga</button>
    </div>
    <div class="card">
      <div class="card-t">Tema tampilan <span class="t-meta" style="font-weight:500">— untuk HP/laptop ini</span></div>
      <div class="theme-grid">${THEMES.map(t => `<button class="theme-opt${t.id === curTheme() ? ' on' : ''}" data-th="${t.id}"><span class="tp" style="background:${t.bg}"><i style="top:9px;background:${t.card}"></i><i style="top:21px;right:30px;background:${t.ink};opacity:.55"></i></span>${t.name}<div class="t-meta" style="font-weight:500;font-size:0.7rem">${t.desc}</div></button>`).join('')}</div>
    </div>`;
  bindBack(m);
  const paint = () => {
    const name = $('plName').value.trim() || 'Lembaga', full = $('plFull').value.trim(), txt = $('plLogoText').value.trim();
    $('ppHdr').style.background = F.color; $('ppHdr').style.color = '#fff';
    $('ppName').textContent = name; $('ppSub').textContent = full || S.member.name;
    const lg = F.logo ? `<img src="${esc(F.logo)}" alt=""/>` : esc(txt || initials(name));
    $('ppLogo').innerHTML = lg; $('plLogoBox').innerHTML = F.logo ? `<img src="${esc(F.logo)}" alt=""/>` : I('image');
    $('plLogoDel').style.display = F.logo ? '' : 'none';
    document.querySelectorAll('#plSw .sw').forEach(b => b.classList.toggle('on', b.dataset.c.toLowerCase() === F.color.toLowerCase()));
  };
  ['plName', 'plFull', 'plLogoText'].forEach(id => $(id).oninput = paint);
  document.querySelectorAll('#plSw .sw').forEach(b => b.onclick = () => { F.color = b.dataset.c; $('plHex').value = F.color; paint(); });
  $('plHex').oninput = () => { const v = $('plHex').value.trim(); if (validHex(v)) { F.color = v; paint(); } };
  $('plLogoBtn').onclick = () => $('plLogo').click();
  $('plLogo').onchange = async (e) => { const f = e.target.files[0]; if (!f) return; try { F.logo = await compressImage(f); paint(); } catch (err) { toast('❌ ' + err.message); } };
  $('plLogoDel').onclick = () => { F.logo = null; paint(); };
  document.querySelectorAll('[data-th]').forEach(b => b.onclick = () => {
    applyTheme(b.dataset.th);
    document.querySelectorAll('[data-th]').forEach(x => x.classList.toggle('on', x === b));
    toast('Tema ' + THEMES.find(t => t.id === b.dataset.th).name);
  });
  $('plSave').onclick = async () => {
    const name = $('plName').value.trim();
    if (!name) { toast('Nama singkat lembaga wajib diisi'); return; }
    const upd = { name, fullName: $('plFull').value.trim(), logo: F.logo || null, logoText: $('plLogoText').value.trim(), color: F.color, updatedAt: serverTimestamp() };
    $('plSave').disabled = true;
    try { await updateDoc(doc(db, 'orgs', S.org.id), upd); Object.assign(S.org, upd); toast('✅ Profil lembaga disimpan'); renderShell(); }
    catch (e) { $('plSave').disabled = false; toast('❌ ' + friendlyError(e)); }
  };
  paint();
}
async function renderPayInfo(m) {
  let p = {};
  try { const d = await getDoc(doc(db, 'orgs', S.org.id, 'settings', 'payinfo')); if (d.exists()) p = d.data(); } catch (e) {}
  m.innerHTML = `${backBar(m, 'Info Pembayaran', 'Rekening lembaga untuk pembayaran les dari orang tua murid')}
    <div class="card">
      <div class="field"><label>Bank / e-wallet</label><input id="piBank" maxlength="40" value="${esc(p.bank || '')}" placeholder="cth: BCA"/></div>
      <div class="field"><label>Nomor rekening</label><input id="piNum" maxlength="40" inputmode="numeric" value="${esc(p.number || '')}"/></div>
      <div class="field"><label>Atas nama</label><input id="piHolder" maxlength="80" value="${esc(p.holder || '')}"/></div>
      <div class="field"><label>Catatan (opsional)</label><input id="piNote" maxlength="120" value="${esc(p.note || '')}" placeholder="cth: Mohon kirim bukti transfer ke WA ini"/></div>
      <div class="msg msg-info" id="piPrev" style="white-space:pre-line"></div>
      <button class="btn btn-primary" id="piSave">${I('check')} Simpan</button>
    </div>`;
  bindBack(m);
  const val = () => ({ bank: $('piBank').value.trim(), number: $('piNum').value.trim(), holder: $('piHolder').value.trim(), note: $('piNote').value.trim() });
  const paint = () => { const t = payInfoText(val()).trim(); $('piPrev').textContent = t ? 'Contoh di pesan tagihan:\n' + t : 'Kosong = pesan tagihan tanpa info rekening.'; };
  ['piBank', 'piNum', 'piHolder', 'piNote'].forEach(id => $(id).oninput = paint); paint();
  $('piSave').onclick = async () => {
    try { await commitOps([['set', doc(db, 'orgs', S.org.id, 'settings', 'payinfo'), val()]]); if (S.keu) S.keu.payInfo = val(); toast('✅ Info pembayaran disimpan'); renderAdminLainnya(m); }
    catch (e) { toast('❌ ' + friendlyError(e)); }
  };
}
// Unduh semua data lembaga (JSON) — cadangan pribadi Admin
async function backupLembaga() {
  toast('Menyiapkan backup…', 6000);
  const o = S.org.id, cols = ['members', 'subjects', 'students', 'sched', 'att', 'payments', 'payouts', 'settings', 'invoices'];
  try {
    const out = { app: 'LesLesanKu V2', exportedAt: new Date().toISOString(), org: Object.assign({ id: o }, S.org) };
    const snaps = await Promise.all(cols.map(c => getDocs(collection(db, 'orgs', o, c)).catch(() => null)));
    cols.forEach((c, k) => { out[c] = snaps[k] ? snaps[k].docs.map(d => Object.assign({ id: d.id }, d.data())) : []; });
    const json = JSON.stringify(out, (k, v) => (v && typeof v.toDate === 'function' ? v.toDate().toISOString() : v), 2);
    const name = 'LLK-Lembaga_' + String(S.org.name || 'lembaga').replace(/[^a-zA-Z0-9]+/g, '_') + '_' + localKey(new Date()) + '.json';
    dlBlob(new Blob([json], { type: 'application/json' }), name);
    toast('✅ Backup diunduh: ' + name + ' (' + out.students.length + ' murid)', 6000);
  } catch (e) { toast('❌ Gagal backup: ' + friendlyError(e)); }
}

// ══════════════════════════════════════════════════════════════════════
// BOOT
// ══════════════════════════════════════════════════════════════════════
async function afterAuth(user) {
  S.user = user;
  const url = new URL(location.href);
  const codeParam = url.searchParams.get('kode');
  if (codeParam) { try { sessionStorage.setItem(CODE_KEY, codeParam); } catch (e) {} history.replaceState(null, '', url.pathname); }
  let pending = null; try { pending = sessionStorage.getItem(PENDING_KEY); sessionStorage.removeItem(PENDING_KEY); } catch (e) {}
  // Peran sudah dipilih di halaman awal leslesanku.com (?mulai=lembaga|mitra)
  const mulai = url.searchParams.get('mulai');
  if (mulai) history.replaceState(null, '', url.pathname);
  if (!pending && (mulai === 'lembaga' || mulai === 'mitra')) pending = mulai;

  if (!user) {
    if (codeParam) return renderJoinGate(codeParam);
    if (pending === 'lembaga' || pending === 'mitra') return renderRoleGate(pending);
    return renderChooser();
  }
  const pilih = url.searchParams.get('pilih');
  if (pilih) history.replaceState(null, '', url.pathname);
  try {
    await loadProfile();
    if (await loadMembership()) return pilih ? renderChooser() : enterShell();
  } catch (e) {
    console.error(e);
    root().innerHTML = `<div class="panel"><div class="msg msg-err">Gagal memuat data: ${esc(friendlyError(e))}</div><button class="btn btn-primary" onclick="location.reload()">Coba Lagi</button></div>`;
    return;
  }
  const savedCode = sessionStorage.getItem(CODE_KEY);
  if (pending === 'mitra' || savedCode) return startMitra(savedCode || '');
  if (pending === 'lembaga') return startLembaga();
  return renderChooser();
}
// Peran sudah dipilih di leslesanku.com tapi belum login: satu tombol login untuk peran itu
function renderRoleGate(role) {
  const lembaga = role === 'lembaga';
  root().innerHTML = `
  <div class="welcome">
    <img class="welcome-brand" src="../logo-leslesanku.png" alt="LLK — Les LesanKu"/>
    <h1>${lembaga ? 'Pemilik Lembaga Les' : 'Guru Mitra'}</h1>
    <div class="sub">${lembaga ? 'Kelola guru, jadwal, murid & honor guru lembaga kamu.' : 'Gabung ke lembaga les dengan kode undangan dari Guru Admin.'}<br>Login dengan akun Google untuk melanjutkan.</div>
    <button class="btn btn-primary" id="rgLogin">Login dengan Google</button>
    <button class="btn btn-ghost" id="rgBack">Kembali ke pilihan</button>
  </div>`;
  $('rgLogin').onclick = () => (lembaga ? startLembaga() : startMitra());
  $('rgBack').onclick = () => { location.href = '../'; };
}
// Dibuka dari link undangan tapi belum login
function renderJoinGate(code) {
  root().innerHTML = `
  <div class="welcome">
    <img class="welcome-brand" src="../logo-leslesanku.png" alt="LLK — Les LesanKu"/>
    <h1>Undangan Guru Mitra</h1>
    <div class="sub">Kamu diundang bergabung ke sebuah lembaga les.<br>Login dengan akun Google untuk melanjutkan.</div>
    <div class="code-box" style="margin-bottom:18px">${esc(normalizeCode(code) || code)}</div>
    <button class="btn btn-primary" id="jgLogin">Login dengan Google</button>
    <button class="btn btn-ghost" id="jgBack">Bukan saya / lihat pilihan lain</button>
  </div>`;
  $('jgLogin').onclick = () => startMitra(code);
  $('jgBack').onclick = renderChooser;
}

if (TEST) {
  afterAuth(TEST.user);
} else {
  getRedirectResult(auth).catch(e => console.warn('redirect:', e));
  let first = true;
  onAuthStateChanged(auth, (u) => { if (first) { first = false; afterAuth(u); } else { S.user = u; } });
}

// Untuk pengujian otomatis
window.__llk = { S, genCode, normalizeCode };
