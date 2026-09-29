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

const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyAvD4ABTYIjCtPCYzUaRM8AHsjiOamHQLU',
  authDomain: 'llk-67a30.firebaseapp.com', // sementara; leslesanku.com menunggu redirect URI aktif di Google (lihat __/README.md)
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
const S = { user: null, profile: null, org: null, member: null, tab: null, guru: null };

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
    <div class="modal-t">⚠️ ${esc(title)}</div>
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
      <div class="role-ic" style="background:var(--green-bg)">🏫</div>
      <div><div class="role-t">Kembali ke ${esc(S.org.name)}</div><div class="role-d">Sebagai ${S.member.role === 'admin' ? 'Guru Admin' : 'Guru Mitra'}</div></div>
      <div class="role-arrow">›</div>
    </button>` : ''}
    <button class="role-card" id="rcLepas">
      <div class="role-ic" style="background:var(--amber-bg)">👤</div>
      <div><div class="role-t">Guru Lepas</div><div class="role-d">Saya mengajar sendiri — atur murid, jadwal & tagihan sendiri</div></div>
      <div class="role-arrow">›</div>
    </button>
    ${inOrg ? '' : `
    <button class="role-card" id="rcLembaga">
      <div class="role-ic" style="background:var(--red-bg)">🏫</div>
      <div><div class="role-t">Pemilik Lembaga Les</div><div class="role-d">Saya punya guru-guru — kelola jadwal, murid & honor guru</div></div>
      <div class="role-arrow">›</div>
    </button>
    <button class="role-card" id="rcMitra">
      <div class="role-ic" style="background:var(--blue-bg)">🎓</div>
      <div><div class="role-t">Guru Mitra</div><div class="role-d">Saya diundang lembaga — punya kode undangan</div></div>
      <div class="role-arrow">›</div>
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
    <button class="back" id="bk">‹ Kembali</button>
    <h2>🏫 Daftarkan Lembaga Les</h2>
    <div class="sub">Kamu akan menjadi <b>Guru Admin</b> — mengelola jadwal, murid, tagihan & honor Guru Mitra.</div>
    <div id="coMsg"></div>
    <div class="field"><label>Nama lembaga</label><input id="coName" maxlength="80" placeholder="cth: Les Musik Ceria"/></div>
    <div class="field"><label>Logo (opsional)</label>
      <div class="logo-pick"><div class="logo-box" id="coLogoBox">🏫</div>
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
    <button class="back" id="bk">‹ Kembali</button>
    <h2>🎓 Gabung sebagai Guru Mitra</h2>
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
        <div class="card-t" style="color:var(--green)">✓ Kode valid</div>
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
  { k: 'absensi', i: '📋', l: 'Absensi' },
  { k: 'murid', i: '🎓', l: 'Murid' },
  { k: 'guru', i: '👥', l: 'Guru' },
  { k: 'keuangan', i: '💰', l: 'Keuangan' },
  { k: 'lainnya', i: '⚙️', l: 'Lainnya' },
];
const MITRA_TABS = [
  { k: 'jadwal', i: '📅', l: 'Jadwal Saya' },
  { k: 'honor', i: '💵', l: 'Honor' },
  { k: 'lainnya', i: '⚙️', l: 'Lainnya' },
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
    <nav class="bottom-nav">${tabs.map(t => `<button class="bnav ${t.k === S.tab ? 'active' : ''}" data-tab="${t.k}"><span class="bi">${t.i}</span>${t.l}</button>`).join('')}</nav>
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
  if (isAdmin()) {
    if (S.tab === 'guru') return renderGuru(m);
    if (S.tab === 'lainnya') return renderAdminLainnya(m);
    const info = { absensi: ['📋', 'Absensi Harian', 'Pantau absensi semua Guru Mitra — dibangun di Tahap 4.'], murid: ['🎓', 'Data Murid', 'Murid, pelajaran, tarif & jadwal — dibangun di Tahap 2.'], keuangan: ['💰', 'Keuangan', 'Tagihan per pelajaran & rekap honor guru — dibangun di Tahap 5.'] }[S.tab];
    return placeholder(m, info);
  }
  if (S.tab === 'lainnya') return renderMitraLainnya(m);
  if (S.tab === 'honor') return renderMitraHonor(m);
  return placeholder(m, ['📅', 'Jadwal Saya', 'Jadwal & absensi murid yang ditugaskan kepadamu akan muncul di sini (Tahap 3).']);
}
function placeholder(m, [ic, t, d]) {
  m.innerHTML = `<div class="page-title">${t}</div><div class="page-sub">Segera hadir</div>
    <div class="card"><div class="empty"><div class="empty-ic">${ic}</div><div class="empty-t">Sedang dibangun</div><div class="empty-d">${esc(d)}</div></div></div>`;
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
      <div class="t-meta" style="margin-top:10px;white-space:normal">💵 Honor <b style="color:var(--text)">${esc(rupiah(x.honor))}</b> / pertemuan · 📄 Spreadsheet absensi: ${x.sheetLink ? '<b style="color:var(--green)">sudah diisi</b>' : 'belum diisi'}</div>
      <div class="mini-btns">
        <button class="mini" data-honor="${esc(x.id)}">✏️ Ubah Honor</button>
        ${x.sheetLink ? `<button class="mini" data-sheet="${esc(x.id)}">📄 Buka Spreadsheet</button>` : ''}
        <button class="mini mini-red" data-kick="${esc(x.id)}">Keluarkan</button>
      </div>
    </div>`).join('') : '';
  const invHtml = g.invites.length ? g.invites.map(x => {
    const exp = isExpired(x);
    return `
    <div class="card" style="${exp ? 'opacity:0.8' : ''}">
      <div class="row">
        <div class="avatar" style="background:var(--blue-bg);color:var(--blue)">✉️</div>
        <div class="grow"><div class="t-name">${esc(x.name)}</div><div class="t-meta">${esc(rupiah(x.honor))} / pertemuan${x.emailLock ? ' · 🔒 ' + esc(x.emailLock) : ''}</div></div>
        <span class="pill ${exp ? 'pill-red' : 'pill-amber'}">${exp ? 'KEDALUWARSA' : 'MENUNGGU'}</span>
      </div>
      <div class="code-box">${esc(x.id)}</div>
      <div class="t-meta" style="text-align:center;margin-top:6px">${exp ? 'Kedaluwarsa ' : 'Berlaku sampai '}${esc(fmtDate(x.expiresAt))}</div>
      <div class="mini-btns">
        ${exp ? `<button class="mini" data-renew="${esc(x.id)}">🔄 Buat Kode Baru</button>`
              : `<button class="mini mini-green" data-wa="${esc(x.id)}">💬 Kirim via WA</button><button class="mini" data-copy="${esc(x.id)}">📋 Salin</button>`}
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
    ${mitraHtml || '<div class="card"><div class="empty"><div class="empty-ic">👥</div><div class="empty-t">Belum ada Guru Mitra</div><div class="empty-d">Tekan “Tambah Guru Mitra”, lalu kirim kodenya lewat WA.</div></div></div>'}`;
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
    <div class="modal-t">✅ Undangan untuk ${esc(inv.name)}</div>
    <div class="modal-sub">Kirim kode ini ke guru. Berlaku ${INVITE_DAYS} hari & hanya bisa dipakai sekali.</div>
    <div class="code-box" style="font-size:1.3rem;padding:14px">${esc(inv.id)}</div>
    <div class="t-meta" style="text-align:center;margin:8px 0 16px;white-space:normal;word-break:break-all">${esc(inviteLink(inv.id))}</div>
    <button class="btn btn-green" id="icWa">💬 Kirim via WhatsApp</button>
    <button class="btn btn-ghost" id="icCopy">📋 Salin Pesan</button>
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
    <div class="modal-t">✏️ Honor ${esc(x.name)}</div>
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
// ADMIN — LAINNYA
// ══════════════════════════════════════════════════════════════════════
function renderAdminLainnya(m) {
  const logo = S.org.logo ? `<img src="${esc(S.org.logo)}" alt=""/>` : '🏫';
  m.innerHTML = `
    <div class="page-title">Lainnya</div><div class="page-sub">Pengaturan lembaga & akun</div>
    <div class="card">
      <div class="card-t">Profil Lembaga</div>
      <div class="field"><label>Nama lembaga</label><input id="olName" maxlength="80" value="${esc(S.org.name)}"/></div>
      <div class="field"><label>Logo</label><div class="logo-pick"><div class="logo-box" id="olLogoBox">${logo}</div>
        <button class="btn btn-ghost" style="width:auto;padding:10px 16px" id="olLogoBtn">Ganti Logo</button>
        <input type="file" id="olLogo" accept="image/*" style="display:none"/></div></div>
      <button class="btn btn-primary" id="olSave">💾 Simpan</button>
    </div>
    <div class="card">
      <div class="card-t">Paket</div>
      <div class="t-meta" style="white-space:normal">Masa uji coba · <b style="color:var(--text)">${esc(S.org.seats)} kursi Guru Mitra</b>. Pilihan paket berbayar menyusul.</div>
    </div>
    <div class="card" style="padding:4px 14px">
      <button class="menu-item" id="olMode"><div class="menu-ic">🔀</div><div><div class="menu-l">Ganti Mode</div><div class="menu-d">Pindah ke Guru Lepas (data pribadi terpisah)</div></div></button>
      <button class="menu-item" id="olOut"><div class="menu-ic">🚪</div><div><div class="menu-l" style="color:var(--danger)">Keluar (Logout)</div><div class="menu-d">${esc(S.user.email)}</div></div></button>
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
    <div class="card"><div class="empty"><div class="empty-ic">📊</div><div class="empty-t">Rekap honor bulanan</div><div class="empty-d">Muncul otomatis setelah kamu mulai mengisi absensi (Tahap 3 & 5).</div></div></div>`;
}
function renderMitraLainnya(m) {
  m.innerHTML = `
    <div class="page-title">Lainnya</div><div class="page-sub">Profil & pengaturan</div>
    <div class="card">
      <div class="row"><div class="avatar">${esc(initials(S.member.name))}</div><div class="grow"><div class="t-name">${esc(S.member.name)}</div><div class="t-meta">${esc(S.user.email)}</div></div></div>
    </div>
    <div class="card">
      <div class="card-t">📄 Spreadsheet absensi guru</div>
      <div class="t-meta" style="white-space:normal;margin-bottom:10px">Link Google Sheet tempat kamu mencatat absensi mengajar. Tombol 📨 di jadwal akan membuka link ini.</div>
      <div class="field"><input id="mlSheet" type="url" placeholder="https://docs.google.com/spreadsheets/..." value="${esc(S.member.sheetLink || '')}"/></div>
      <button class="btn btn-primary" id="mlSave">💾 Simpan Link</button>
    </div>
    <div class="card" style="padding:4px 14px">
      <button class="menu-item" id="mlMode"><div class="menu-ic">🔀</div><div><div class="menu-l">Ganti Mode</div><div class="menu-d">Pindah ke Guru Lepas untuk murid pribadimu</div></div></button>
      <button class="menu-item" id="mlLeave"><div class="menu-ic">🚪</div><div><div class="menu-l" style="color:var(--danger)">Keluar dari ${esc(S.org.name)}</div><div class="menu-d">Berhenti menjadi Guru Mitra di lembaga ini</div></div></button>
      <button class="menu-item" id="mlOut"><div class="menu-ic">🔒</div><div><div class="menu-l">Logout</div><div class="menu-d">${esc(S.user.email)}</div></div></button>
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
