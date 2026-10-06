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

// Ikon garis dari sprite di index.html (satu set dengan V1)
const I = (n, c) => `<svg class="ico${c ? ' ' + c : ''}" aria-hidden="true"><use href="#i-${n}"/></svg>`;

const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyAvD4ABTYIjCtPCYzUaRM8AHsjiOamHQLU',
  authDomain: 'leslesanku.com', // helper login di /__/auth/ (lihat __/README.md)
  projectId: 'llk-67a30',
  storageBucket: 'llk-67a30.firebasestorage.app',
  messagingSenderId: '894092774293',
  appId: '1:894092774293:web:8c66654aada5b42bf5c49c'
};
const V1_URL = '../';
const INVITE_DAYS = 7;
const CHOICE_KEY = 'llk_v2_choice';     // peran terakhir yang dipilih di HP ini
const PENDING_KEY = 'llk_v2_pending';   // aksi yang menunggu login (untuk login via redirect)
const CODE_KEY = 'llk_v2_code';         // kode undangan dari link

// Mode uji otomatis (hanya aktif kalau halaman diberi window.__LLK_TEST__ oleh skrip pengujian)
const TEST = window.__LLK_TEST__ || null;

const app = initializeApp(FIREBASE_CONFIG);
const db = getFirestore(app);
const auth = TEST ? null : getAuth(app);
if (TEST) connectFirestoreEmulator(db, TEST.host, TEST.port, { mockUserToken: { sub: TEST.user.uid, email: TEST.user.email, email_verified: true } });

// ── State ──
const S = { user: null, profile: null, org: null, member: null, tab: null, guru: null, data: null, muridView: 'daftar', filt: { q: '', guru: '', subj: '', status: 'aktif' }, schedGuru: '' };

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
  if (code.includes('permission-denied')) return 'Akses ditolak oleh server.';
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
    <div class="welcome-logo">LLK</div>
    <h1>Selamat datang di LesLesanKu</h1>
    <div class="sub">Pilih cara kamu memakai aplikasi ini</div>
    ${inOrg ? `
    <button class="role-card" id="rcBack" style="border-color:var(--green)">
      <div class="role-ic" style="background:var(--green-bg);color:var(--green)">${I('cap')}</div>
      <div><div class="role-t">Kembali ke ${esc(S.org.name)}</div><div class="role-d">Sebagai ${S.member.role === 'admin' ? 'Guru Admin' : 'Guru Mitra'}</div></div>
      <div class="role-arrow">${I('chevron-right')}</div>
    </button>` : ''}
    <button class="role-card" id="rcLepas">
      <div class="role-ic" style="background:var(--amber-bg);color:var(--amber)">${I('user')}</div>
      <div><div class="role-t">Guru Lepas</div><div class="role-d">Saya mengajar sendiri — atur murid, jadwal & tagihan sendiri</div></div>
      <div class="role-arrow">${I('chevron-right')}</div>
    </button>
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
  $('rcLepas').onclick = () => { setChoice('lepas'); location.href = V1_URL; };
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
    <div class="msg msg-info">Masa uji coba: <b>5 kursi Guru Mitra</b>. Paket berbayar diatur nanti.</div>
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
      b.set(orgRef, { name, logo: logoData, ownerUid: S.user.uid, seats: 5, plan: 'trial', createdAt: serverTimestamp() });
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
  { k: 'murid', i: 'cap', l: 'Murid' },
  { k: 'guru', i: 'users', l: 'Guru' },
  { k: 'keuangan', i: 'wallet', l: 'Keuangan' },
  { k: 'lainnya', i: 'grid', l: 'Lainnya' },
];
const MITRA_TABS = [
  { k: 'jadwal', i: 'calendar', l: 'Jadwal Saya' },
  { k: 'honor', i: 'wallet', l: 'Honor' },
  { k: 'lainnya', i: 'grid', l: 'Lainnya' },
];
function isAdmin() { return S.member && S.member.role === 'admin'; }
function enterShell() {
  setChoice(isAdmin() ? 'lembaga' : 'mitra');
  S.tab = isAdmin() ? 'guru' : 'jadwal';
  renderShell();
}
function renderShell() {
  const tabs = isAdmin() ? ADMIN_TABS : MITRA_TABS;
  const logo = S.org.logo ? `<img src="${esc(S.org.logo)}" alt=""/>` : esc(initials(S.org.name));
  root().innerHTML = `
  <div class="shell">
    <nav class="bottom-nav">${tabs.map(t => `<button class="bnav ${t.k === S.tab ? 'active' : ''}" data-tab="${t.k}"><span class="bi">${I(t.i)}</span>${t.l}</button>`).join('')}</nav>
    <div class="shell-main">
      <header class="app-header">
        <div class="h-logo">${logo}</div>
        <div style="min-width:0"><div class="h-name">${esc(S.org.name)}</div><div class="h-sub">${esc(S.member.name)}</div></div>
        <div class="h-badge">${isAdmin() ? 'GURU ADMIN' : 'GURU MITRA'}</div>
      </header>
      <main id="main"></main>
    </div>
  </div>`;
  document.querySelectorAll('.bnav').forEach(b => b.onclick = () => { S.tab = b.dataset.tab; renderShell(); });
  renderTab();
}
function renderTab() {
  const m = $('main');
  m.classList.toggle('wide', isAdmin() && S.tab === 'murid');
  if (isAdmin()) {
    if (S.tab === 'guru') return renderGuru(m);
    if (S.tab === 'lainnya') return renderAdminLainnya(m);
    if (S.tab === 'murid') return renderMurid(m);
    const info = { absensi: ['absensi', 'Absensi Harian', 'Pantau absensi semua Guru Mitra — dibangun di Tahap 4.'], keuangan: ['wallet', 'Keuangan', 'Tagihan per pelajaran & rekap honor guru — dibangun di Tahap 5.'] }[S.tab];
    return placeholder(m, info);
  }
  if (S.tab === 'lainnya') return renderMitraLainnya(m);
  if (S.tab === 'honor') return renderMitraHonor(m);
  return renderMitraJadwal(m);
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
    mitras: mem.docs.map(d => Object.assign({ id: d.id }, d.data())).filter(x => x.role === 'mitra').sort((a, b) => a.name.localeCompare(b.name)),
    invites: inv.docs.map(d => Object.assign({ id: d.id }, d.data())).filter(x => x.status === 'open').sort((a, b) => (a.slot || 0) - (b.slot || 0)),
    slots: slots.docs.map(d => Object.assign({ id: d.id }, d.data())),
  };
  return S.guru;
}
async function renderGuru(m) {
  m.innerHTML = '<div class="page-title">Guru Mitra</div><div class="page-sub">Memuat…</div>';
  let g;
  try { g = await loadGuru(); } catch (e) { m.innerHTML = `<div class="msg msg-err">Gagal memuat: ${esc(friendlyError(e))}</div>`; return; }
  const seats = S.org.seats || 0, used = g.slots.length, full = used >= seats;
  const mitraHtml = g.mitras.length ? g.mitras.map(x => `
    <div class="card">
      <div class="row">
        <div class="avatar">${esc(initials(x.name))}</div>
        <div class="grow"><div class="t-name">${esc(x.name)}</div><div class="t-meta">${esc(x.email)}</div></div>
        <span class="pill pill-green">AKTIF</span>
      </div>
      <div class="t-meta" style="margin-top:10px;white-space:normal">${I('wallet','sm')} Honor <b style="color:var(--text)">${esc(rupiah(x.honor))}</b> / pertemuan · ${I('table','sm')} Spreadsheet absensi: ${x.sheetLink ? '<b style="color:var(--green)">sudah diisi</b>' : 'belum diisi'}</div>
      <div class="mini-btns">
        <button class="mini" data-honor="${esc(x.id)}">${I('edit','sm')} Ubah Honor</button>
        ${x.sheetLink ? `<button class="mini" data-sheet="${esc(x.id)}">${I('table','sm')} Buka Spreadsheet</button>` : ''}
        <button class="mini mini-red" data-kick="${esc(x.id)}">Keluarkan</button>
      </div>
    </div>`).join('') : '';
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
    <div class="card">
      <div class="row"><div class="grow"><div class="card-t" style="margin:0">Kursi Guru Mitra</div></div><b>${used} / ${seats}</b></div>
      <div class="seat-bar"><div class="seat-fill" style="width:${seats ? Math.min(100, used / seats * 100) : 0}%;${full ? 'background:var(--amber)' : ''}"></div></div>
      <div class="t-meta" style="margin-top:8px;white-space:normal">${full ? 'Kursi penuh. Tambah kursi lewat paket langganan (segera hadir), atau cabut undangan yang tidak dipakai.' : 'Undangan yang belum dipakai juga menempati kursi sampai dicabut.'}</div>
    </div>
    <button class="btn btn-primary" id="addMitra" ${full ? 'disabled' : ''} style="margin-bottom:18px">＋ Tambah Guru Mitra</button>
    ${g.invites.length ? `<div class="card-t">Undangan belum dipakai (${g.invites.length})</div>${invHtml}` : ''}
    <div class="card-t" style="margin-top:6px">Guru Mitra aktif (${g.mitras.length})</div>
    ${mitraHtml || '<div class="card"><div class="empty"><div class="empty-ic">'+I('users')+'</div><div class="empty-t">Belum ada Guru Mitra</div><div class="empty-d">Tekan “Tambah Guru Mitra”, lalu kirim kodenya lewat WA.</div></div></div>'}`;
  $('addMitra').onclick = openAddMitra;
  m.querySelectorAll('[data-wa]').forEach(b => b.onclick = () => shareInvite(g.invites.find(x => x.id === b.dataset.wa)));
  m.querySelectorAll('[data-copy]').forEach(b => b.onclick = () => copyInvite(g.invites.find(x => x.id === b.dataset.copy)));
  m.querySelectorAll('[data-revoke]').forEach(b => b.onclick = () => revokeInvite(g.invites.find(x => x.id === b.dataset.revoke)));
  m.querySelectorAll('[data-renew]').forEach(b => b.onclick = () => renewInvite(g.invites.find(x => x.id === b.dataset.renew)));
  m.querySelectorAll('[data-honor]').forEach(b => b.onclick = () => editHonor(g.mitras.find(x => x.id === b.dataset.honor)));
  m.querySelectorAll('[data-kick]').forEach(b => b.onclick = () => kickMitra(g.mitras.find(x => x.id === b.dataset.kick)));
  m.querySelectorAll('[data-sheet]').forEach(b => b.onclick = () => { const x = g.mitras.find(y => y.id === b.dataset.sheet); if (x && /^https?:\/\//i.test(x.sheetLink)) window.open(x.sheetLink, '_blank'); });
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
      err(e.message === 'FULL' ? 'Kursi Guru Mitra sudah penuh.' : 'Gagal membuat undangan: ' + friendlyError(e));
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
    <div class="modal-t">${I('edit')} Honor ${esc(x.name)}</div>
    <div class="modal-sub">Berlaku untuk pertemuan berikutnya.</div>
    <div class="field"><label>Honor per pertemuan (Rp)</label><input id="ehVal" type="number" min="0" step="1000" value="${esc(x.honor)}"/></div>
    <div class="btn-row"><button class="btn btn-ghost" id="ehNo">Batal</button><button class="btn btn-primary" id="ehGo">Simpan</button></div>`);
  $('ehNo').onclick = closeModal;
  $('ehGo').onclick = async () => {
    const v = parseInt($('ehVal').value, 10);
    if (!Number.isFinite(v) || v < 0) { toast('Honor harus angka'); return; }
    try { await updateDoc(doc(db, 'orgs', S.org.id, 'members', x.id), { honor: v }); closeModal(); toast('✅ Honor diperbarui'); renderTab(); }
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
  const mitras = mem.docs.map(d => Object.assign({ id: d.id }, d.data())).filter(x => x.role === 'mitra').sort((a, b) => a.name.localeCompare(b.name));
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
async function commitOps(ops) {
  for (let i = 0; i < ops.length; i += 400) {
    const b = writeBatch(db);
    ops.slice(i, i + 400).forEach(([kind, ref, data]) => kind === 'del' ? b.delete(ref) : b.set(ref, data));
    await b.commit();
  }
}

async function renderMurid(m) {
  m.innerHTML = '<div class="page-title">Murid</div><div class="page-sub">Memuat…</div>';
  try { await loadOrgData(); } catch (e) { m.innerHTML = `<div class="msg msg-err">Gagal memuat: ${esc(friendlyError(e))}</div>`; return; }
  const views = [['daftar', 'users', 'Daftar Murid'], ['jadwal', 'calendar', 'Jadwal Mingguan'], ['pelajaran', 'book-open', 'Mata Pelajaran']];
  m.innerHTML = `
    <div class="page-head">
      <div><div class="page-title">Murid</div><div class="page-sub" id="mSub"></div></div>
    </div>
    <div class="seg">${views.map(([k, i, l]) => `<button class="seg-b ${S.muridView === k ? 'on' : ''}" data-view="${k}">${I(i, 'sm')} ${l}</button>`).join('')}</div>
    <div id="mBody"></div>`;
  m.querySelectorAll('[data-view]').forEach(b => b.onclick = () => { S.muridView = b.dataset.view; renderMurid(m); });
  const d = S.data, act = d.students.filter(x => x.active);
  const nKelas = act.reduce((n, x) => n + (x.classes || []).length, 0);
  const noGuru = act.reduce((n, x) => n + (x.classes || []).filter(c => !mitraOf(c.mitraUid)).length, 0);
  $('mSub').innerHTML = `${act.length} murid aktif · ${nKelas} kelas${noGuru ? ` · <span class="t-warn">${noGuru} kelas belum ada guru</span>` : ''}`;
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
      <div class="search">${I('search', 'sm')}<input id="fQ" placeholder="Cari nama murid / ortu…" value="${esc(f.q)}"/></div>
      <select id="fGuru">${opt('', 'Semua guru', f.guru)}${d.mitras.map(x => opt(x.id, x.name, f.guru)).join('')}${opt('none', 'Belum ada guru', f.guru)}</select>
      <select id="fSubj">${opt('', 'Semua pelajaran', f.subj)}${d.subjects.map(x => opt(x.id, x.name, f.subj)).join('')}</select>
      <select id="fStat">${opt('aktif', 'Aktif', f.status)}${opt('nonaktif', 'Nonaktif', f.status)}${opt('semua', 'Semua status', f.status)}</select>
      <button class="btn btn-ghost tb-btn" id="impV1">${I('download', 'sm')} Impor dari LLK V1</button>
      <button class="btn btn-primary tb-btn" id="addStu" ${d.subjects.length ? '' : 'disabled'}>${I('plus', 'sm')} Tambah Murid</button>
    </div>
    <div id="stuList"></div>`;
  const g = $('goPel'); if (g) g.onclick = () => { S.muridView = 'pelajaran'; rerenderMurid(); };
  $('fQ').oninput = (e) => { f.q = e.target.value; drawStudentList(); };
  $('fGuru').onchange = (e) => { f.guru = e.target.value; drawStudentList(); };
  $('fSubj').onchange = (e) => { f.subj = e.target.value; drawStudentList(); };
  $('fStat').onchange = (e) => { f.status = e.target.value; drawStudentList(); };
  $('addStu').onclick = () => openStudentForm(null);
  $('impV1').onclick = openImportV1;
  drawStudentList();
}
function filteredStudents() {
  const f = S.filt, q = f.q.trim().toLowerCase();
  return S.data.students.filter(st => {
    if (f.status === 'aktif' && !st.active) return false;
    if (f.status === 'nonaktif' && st.active) return false;
    if (q && !(st.name.toLowerCase().includes(q) || String(st.parentName || '').toLowerCase().includes(q))) return false;
    const cl = st.classes || [];
    if (f.subj && !cl.some(c => c.subjectId === f.subj)) return false;
    if (f.guru === 'none' && !cl.some(c => !mitraOf(c.mitraUid))) return false;
    if (f.guru && f.guru !== 'none' && !cl.some(c => c.mitraUid === f.guru)) return false;
    return true;
  });
}
function drawStudentList() {
  const box = $('stuList'); if (!box) return;
  const list = filteredStudents();
  if (!list.length) {
    box.innerHTML = `<div class="card"><div class="empty"><div class="empty-ic">${I('users')}</div><div class="empty-t">${S.data.students.length ? 'Tidak ada murid yang cocok' : 'Belum ada murid'}</div><div class="empty-d">${S.data.students.length ? 'Ubah pencarian atau filter di atas.' : 'Tekan “Tambah Murid”, atau salin dari LLK V1 dengan “Impor dari LLK V1”.'}</div></div></div>`;
    return;
  }
  const row = st => {
    const cl = st.classes || [];
    const kelas = cl.map(c => { const sj = subjOf(c.subjectId); return `<div class="cl-line"><b>${esc(sj ? sj.name : '—')}</b> · ${guruLabel(c.mitraUid)}</div>`; }).join('');
    const jadwal = cl.map(c => `<div class="cl-line">${esc((c.schedule || []).slice().sort(byDayTime).map(slotTxt).join(', ') || '—')}</div>`).join('');
    const tarif = cl.map(c => `<div class="cl-line">${esc(rupiah(rateOf(c)))}${c.rate != null ? ' <span class="pill pill-amber">KHUSUS</span>' : ''}</div>`).join('');
    return `<tr data-stu="${esc(st.id)}" class="${st.active ? '' : 'is-off'}">
      <td><div class="t-name">${esc(st.name)}</div><div class="t-meta">${esc(st.parentName || '')}</div></td>
      <td>${kelas || '—'}</td><td>${jadwal || '—'}</td><td>${tarif || '—'}</td>
      <td>${st.phone ? esc(st.phone) : '<span class="t-meta">—</span>'}</td>
      <td>${st.active ? '<span class="pill pill-green">AKTIF</span>' : '<span class="pill pill-grey">NONAKTIF</span>'}</td>
      <td class="td-act"><button class="mini" data-edit="${esc(st.id)}">${I('edit', 'sm')} Ubah</button></td></tr>`;
  };
  box.innerHTML = `<div class="tbl-wrap"><table class="tbl">
    <thead><tr><th>Murid</th><th>Pelajaran & Guru</th><th>Jadwal</th><th>Tarif / pertemuan</th><th>No HP ortu</th><th>Status</th><th></th></tr></thead>
    <tbody>${list.map(row).join('')}</tbody></table></div>
    <div class="t-meta" style="margin-top:8px">${list.length} murid ditampilkan</div>`;
  box.querySelectorAll('tr[data-stu]').forEach(tr => tr.onclick = () => openStudentForm(S.data.students.find(x => x.id === tr.dataset.stu)));
}

// ── Form murid (bisa banyak kelas) ──
let F = null; // state form yang sedang dibuka
function openStudentForm(st) {
  const d = S.data;
  F = st ? JSON.parse(JSON.stringify(st)) : { id: null, name: '', parentName: '', phone: '', note: '', active: true, classes: [] };
  if (!F.classes.length) F.classes.push(blankClass());
  const ov = openModal(`
    <div class="modal-t">${I(st ? 'edit' : 'user-plus')} ${st ? 'Ubah Murid' : 'Tambah Murid'}</div>
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
    await loadOrgData(true); rerenderMurid();
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
  const rows = v1.map((x, i) => { const sched = v1Schedule(x).filter(y => y.start); return { i, x, sched, dup: have.has(String(x.name).trim().toLowerCase()), noSched: !sched.length }; })
    .sort((a, b) => (!!a.x.inactive - !!b.x.inactive) || a.x.name.localeCompare(b.x.name));
  const ov = openModal(`
    <div class="modal-t">${I('download')} Impor dari LLK V1</div>
    <div class="modal-sub">Menyalin murid, jadwal & tarif dari LLK V1 di browser ini ke lembaga. <b>Data LLK V1 tidak diubah.</b> Riwayat absensi tidak ikut disalin.</div>
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
  $('ivGo').onclick = async () => { $('ivGo').disabled = true; $('ivGo').textContent = 'Mengimpor…'; await runImportV1(picked(), $('ivGuru').value || null); };
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
async function runImportV1(list, mitraUid) {
  const o = S.org.id, plan = importSubjectPlan(list), ops = [];
  plan.filter(x => x.isNew).forEach(x => ops.push(['set', doc(db, 'orgs', o, 'subjects', x.id), { name: x.name, rate: x.rate, active: true, createdAt: serverTimestamp(), updatedAt: serverTimestamp() }]));
  // supaya schedDoc() bisa menemukan nama pelajaran baru
  plan.filter(x => x.isNew).forEach(x => S.data.subjects.push({ id: x.id, name: x.name, rate: x.rate, active: true }));
  let n = 0, skipped = 0;
  list.forEach(x => {
    const sched = v1Schedule(x).filter(y => y.start);
    if (!sched.length) { skipped++; return; }
    const sp = plan.find(p => p.key === (String(x.instrument || '').trim() || 'Umum').toLowerCase());
    const id = newId(), active = !x.inactive;
    const c = { id: newId(), subjectId: sp.id, mitraUid: mitraUid || null, rate: (x.rate || 40000) === sp.rate ? null : (x.rate || 40000), schedule: sched.sort(byDayTime) };
    ops.push(['set', doc(db, 'orgs', o, 'students', id), { name: String(x.name).trim().slice(0, 80), parentName: '', phone: String(x.phone || '').slice(0, 20), note: String(x.notes || '').slice(0, 200), active, classes: [c], source: 'v1', createdAt: serverTimestamp(), updatedAt: serverTimestamp() }]);
    ops.push(['set', doc(db, 'orgs', o, 'sched', c.id), schedDoc({ id, name: String(x.name).trim().slice(0, 80), active }, c)]);
    n++;
  });
  try {
    await commitOps(ops);
    closeModal(); toast('✅ ' + n + ' murid diimpor' + (skipped ? ' · ' + skipped + ' dilewati (tanpa jadwal rutin)' : ''), 4500);
  } catch (e) { console.error(e); toast('❌ Gagal mengimpor: ' + friendlyError(e), 5000); }
  await loadOrgData(true); rerenderMurid();
}

// ══════════════════════════════════════════════════════════════════════
// MITRA — JADWAL SAYA (Tahap 2: lihat jadwal; absensi di Tahap 3)
// ══════════════════════════════════════════════════════════════════════
async function renderMitraJadwal(m) {
  m.innerHTML = '<div class="page-title">Jadwal Saya</div><div class="page-sub">Memuat…</div>';
  let list;
  try {
    const snap = await getDocs(query(collection(db, 'orgs', S.org.id, 'sched'), where('mitraUid', '==', S.user.uid)));
    list = snap.docs.map(d => Object.assign({ id: d.id }, d.data())).filter(x => x.active);
  } catch (e) { m.innerHTML = `<div class="msg msg-err">Gagal memuat jadwal: ${esc(friendlyError(e))}</div>`; return; }
  const sess = [];
  list.forEach(c => (c.schedule || []).forEach(x => sess.push({ day: x.day, start: x.start, end: x.end, name: c.studentName, subj: c.subjectName })));
  sess.sort((a, b) => byDayTime(a, b));
  const murid = new Set(list.map(x => x.studentId)).size;
  m.innerHTML = `<div class="page-title">Jadwal Saya</div>
    <div class="page-sub">${murid} murid · ${sess.length} sesi per minggu · absensi lewat aplikasi segera hadir</div>
    ${sess.length ? DAYS.filter(dn => sess.some(x => x.day === dn)).map(dn => `
      <div class="card"><div class="card-t">${I('calendar', 'sm')} ${dn}</div>
        ${sess.filter(x => x.day === dn).map(x => `<div class="row sched-row"><div class="sched-time">${esc(x.start)}${x.end ? '<br><span class="t-meta">' + esc(x.end) + '</span>' : ''}</div>
          <div class="grow"><div class="t-name">${esc(x.name)}</div><div class="t-meta">${esc(x.subj)}</div></div></div>`).join('')}
      </div>`).join('')
    : `<div class="card"><div class="empty"><div class="empty-ic">${I('calendar')}</div><div class="empty-t">Belum ada murid</div><div class="empty-d">Guru Admin belum menugaskan murid kepadamu.</div></div></div>`}`;
}

// ══════════════════════════════════════════════════════════════════════
// ADMIN — LAINNYA
// ══════════════════════════════════════════════════════════════════════
function renderAdminLainnya(m) {
  const logo = S.org.logo ? `<img src="${esc(S.org.logo)}" alt=""/>` : I('image');
  m.innerHTML = `
    <div class="page-title">Lainnya</div><div class="page-sub">Pengaturan lembaga & akun</div>
    <div class="card">
      <div class="card-t">Profil Lembaga</div>
      <div class="field"><label>Nama lembaga</label><input id="olName" maxlength="80" value="${esc(S.org.name)}"/></div>
      <div class="field"><label>Logo</label><div class="logo-pick"><div class="logo-box" id="olLogoBox">${logo}</div>
        <button class="btn btn-ghost" style="width:auto;padding:10px 16px" id="olLogoBtn">Ganti Logo</button>
        <input type="file" id="olLogo" accept="image/*" style="display:none"/></div></div>
      <button class="btn btn-primary" id="olSave">${I('check')} Simpan</button>
    </div>
    <div class="card">
      <div class="card-t">Paket</div>
      <div class="t-meta" style="white-space:normal">Masa uji coba · <b style="color:var(--text)">${esc(S.org.seats)} kursi Guru Mitra</b>. Pilihan paket berbayar menyusul.</div>
    </div>
    <div class="card" style="padding:4px 14px">
      <button class="menu-item" id="olMode"><div class="menu-ic">${I('repeat')}</div><div><div class="menu-l">Ganti Mode</div><div class="menu-d">Pindah ke Guru Lepas (data pribadi terpisah)</div></div></button>
      <button class="menu-item" id="olOut"><div class="menu-ic" style="color:var(--danger)">${I('logout')}</div><div><div class="menu-l" style="color:var(--danger)">Keluar (Logout)</div><div class="menu-d">${esc(S.user.email)}</div></div></button>
    </div>`;
  let newLogo;
  $('olLogoBtn').onclick = () => $('olLogo').click();
  $('olLogo').onchange = async (e) => { const f = e.target.files[0]; if (!f) return; try { newLogo = await compressImage(f); $('olLogoBox').innerHTML = `<img src="${newLogo}" alt=""/>`; } catch (err) { toast('❌ ' + err.message); } };
  $('olSave').onclick = async () => {
    const name = $('olName').value.trim(); if (!name) { toast('Nama lembaga wajib diisi'); return; }
    const upd = { name, updatedAt: serverTimestamp() }; if (newLogo !== undefined) upd.logo = newLogo;
    try { await updateDoc(doc(db, 'orgs', S.org.id), upd); Object.assign(S.org, upd); toast('✅ Tersimpan'); renderShell(); }
    catch (e) { toast('❌ ' + friendlyError(e)); }
  };
  $('olMode').onclick = renderChooser;
  $('olOut').onclick = logout;
}

// ══════════════════════════════════════════════════════════════════════
// MITRA — HONOR & LAINNYA
// ══════════════════════════════════════════════════════════════════════
function renderMitraHonor(m) {
  m.innerHTML = `
    <div class="page-title">Honor</div><div class="page-sub">Honor dihitung dari setiap sesi Hadir atau Alpa yang kamu isi</div>
    <div class="card" style="background:linear-gradient(135deg,var(--red),var(--red2));color:#fff;border:none">
      <div style="font-size:0.7rem;font-weight:800;letter-spacing:0.06em;opacity:0.85">HONOR PER PERTEMUAN</div>
      <div style="font-size:1.8rem;font-weight:800;margin-top:4px">${esc(rupiah(S.member.honor))}</div>
    </div>
    <div class="card"><div class="empty"><div class="empty-ic">${I('chart')}</div><div class="empty-t">Rekap honor bulanan</div><div class="empty-d">Muncul otomatis setelah kamu mulai mengisi absensi (Tahap 3 & 5).</div></div></div>`;
}
function renderMitraLainnya(m) {
  m.innerHTML = `
    <div class="page-title">Lainnya</div><div class="page-sub">Profil & pengaturan</div>
    <div class="card">
      <div class="row"><div class="avatar">${esc(initials(S.member.name))}</div><div class="grow"><div class="t-name">${esc(S.member.name)}</div><div class="t-meta">${esc(S.user.email)}</div></div></div>
    </div>
    <div class="card">
      <div class="card-t">${I('table','sm')} Spreadsheet absensi guru</div>
      <div class="t-meta" style="white-space:normal;margin-bottom:10px">Link Google Sheet tempat kamu mencatat absensi mengajar. Tombol amplop di jadwal akan membuka link ini.</div>
      <div class="field"><input id="mlSheet" type="url" placeholder="https://docs.google.com/spreadsheets/..." value="${esc(S.member.sheetLink || '')}"/></div>
      <button class="btn btn-primary" id="mlSave">${I('check')} Simpan Link</button>
    </div>
    <div class="card" style="padding:4px 14px">
      <button class="menu-item" id="mlMode"><div class="menu-ic">${I('repeat')}</div><div><div class="menu-l">Ganti Mode</div><div class="menu-d">Pindah ke Guru Lepas untuk murid pribadimu</div></div></button>
      <button class="menu-item" id="mlLeave"><div class="menu-ic" style="color:var(--danger)">${I('logout')}</div><div><div class="menu-l" style="color:var(--danger)">Keluar dari ${esc(S.org.name)}</div><div class="menu-d">Berhenti menjadi Guru Mitra di lembaga ini</div></div></button>
      <button class="menu-item" id="mlOut"><div class="menu-ic">${I('lock')}</div><div><div class="menu-l">Logout</div><div class="menu-d">${esc(S.user.email)}</div></div></button>
    </div>`;
  $('mlSave').onclick = async () => {
    const v = $('mlSheet').value.trim();
    if (v && !/^https?:\/\//i.test(v)) { toast('Link harus diawali https://'); return; }
    try { await updateDoc(doc(db, 'orgs', S.org.id, 'members', S.user.uid), { sheetLink: v }); S.member.sheetLink = v; toast('✅ Link tersimpan'); }
    catch (e) { toast('❌ ' + friendlyError(e)); }
  };
  $('mlMode').onclick = renderChooser;
  $('mlOut').onclick = logout;
  $('mlLeave').onclick = () => confirmDanger({
    title: 'Keluar dari ' + S.org.name + '?',
    message: 'Kamu tidak bisa lagi melihat jadwal & murid lembaga ini. Untuk bergabung lagi, perlu kode undangan baru dari Guru Admin.',
    confirmText: 'Keluar', typeWord: 'KELUAR'
  }, async () => {
    try {
      const b = writeBatch(db);
      b.delete(doc(db, 'orgs', S.org.id, 'members', S.user.uid));
      if (S.member.slot) b.delete(doc(db, 'orgs', S.org.id, 'slots', String(S.member.slot)));
      b.set(doc(db, 'users', S.user.uid), { orgId: null, orgRole: null, mode: 'lepas', updatedAt: serverTimestamp() });
      await b.commit();
      S.org = S.member = null; S.profile.orgId = null;
      toast('Kamu sudah keluar dari lembaga'); renderChooser();
    } catch (e) { toast('❌ Gagal: ' + friendlyError(e), 4000); }
  });
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

  if (!user) {
    if (codeParam) return renderJoinGate(codeParam);
    return renderChooser();
  }
  try {
    await loadProfile();
    if (await loadMembership()) return enterShell();
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
// Dibuka dari link undangan tapi belum login
function renderJoinGate(code) {
  root().innerHTML = `
  <div class="welcome">
    <div class="welcome-logo">LLK</div>
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
