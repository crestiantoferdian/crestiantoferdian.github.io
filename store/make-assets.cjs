// Membuat bahan Play Store: screenshot berbingkai 1080x1920 + feature graphic 1024x500.
// Memakai DATA CONTOH FIKTIF (bukan data guru sungguhan). Jalankan dari folder repo:
//   (python3 -m http.server 8765 &) ; node store/make-assets.cjs
const path = require('path'), fs = require('fs');
const { chromium } = require(path.join(__dirname, '../tests/node_modules/playwright'));
const OUT = path.join(__dirname, 'play'); fs.mkdirSync(OUT, { recursive: true });
const RAW = path.join(OUT, 'raw'); fs.mkdirSync(RAW, { recursive: true });
const BASE = process.env.BASE_URL || 'http://localhost:8765';
const sleep = ms => new Promise(r => setTimeout(r, ms));
// Google Fonts diambil lewat curl (memakai proxy lingkungan), supaya tampilan sama dengan aplikasi asli
const { execFileSync } = require('child_process'); const FONT_CACHE = {};
function fontOrLocal(r) {
  const u = r.request().url();
  if (u.startsWith(BASE)) return r.continue();
  if (/fonts\.(googleapis|gstatic)\.com/.test(u)) {
    try {
      if (!FONT_CACHE[u]) FONT_CACHE[u] = execFileSync('curl', ['-sL', '-A', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120 Safari/537.36', u], { maxBuffer: 2e7 });
      return r.fulfill({ body: FONT_CACHE[u], contentType: u.includes('googleapis') ? 'text/css' : 'font/woff2', headers: { 'access-control-allow-origin': '*' } });
    } catch (e) { return r.abort(); }
  }
  return r.abort();
}

const DAYS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const dk = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const today = new Date(); const TODAY = DAYS[today.getDay()];
const add45 = t => { const [h, m] = t.split(':').map(Number); const x = h * 60 + m + 45; return String(Math.floor(x / 60)).padStart(2, '0') + ':' + String(x % 60).padStart(2, '0'); };
// Murid contoh: 5 les hari ini, sisanya tersebar di hari lain
const DEMO = [
  ['Alya Putri', 'Piano', '13:00', 0], ['Bima Saputra', 'Gitar', '14:00', 0], ['Citra Lestari', 'Vokal', '15:00', 0],
  ['Dafa Pratama', 'Drum', '16:00', 0], ['Elsa Maharani', 'Biola', '17:00', 0],
  ['Farel Akbar', 'Piano', '15:30', 1], ['Gita Ayu', 'Gitar', '16:30', 2], ['Hana Safira', 'Vokal', '14:30', 3],
  ['Ilham Ramadhan', 'Drum', '18:00', 4], ['Jasmine Aulia', 'Piano', '13:30', 5], ['Kenzo Wijaya', 'Gitar', '19:00', 1], ['Laras Wening', 'Biola', '16:00', 3],
];
const dayOff = off => DAYS[(today.getDay() + off) % 7];
const students = DEMO.map(([name, ins, t, off], i) => ({ name, instrument: ins, day: dayOff(off), time: t, time2: add45(t), rate: ins === 'Piano' ? 60000 : 50000,
  phone: '0812' + String(34500000 + i * 1111), parent: 'Ortu ' + name.split(' ')[0], extraDates: [], payCycle: i === 0 ? 4 : 8 }));
const PROG = {
  Piano: ['Tangga nada C mayor 2 oktaf, tempo 80', 'Lagu "Twinkle" tangan kanan & kiri', 'Latihan arpeggio & dinamika piano-forte'],
  Gitar: ['Kunci C, G, Am, F — pindah kunci lancar', 'Strumming pola 8 ketukan', 'Intro lagu pilihan, petikan jari'],
  Vokal: ['Pernapasan diafragma & pemanasan 10 menit', 'Latihan interval terts & kwint', 'Lagu "Bunda" — artikulasi bagus'],
  Drum: ['Rudiment single & double stroke', 'Groove 8-beat dasar + fill sederhana', 'Latihan tempo 90 dengan metronom'],
  Biola: ['Posisi busur & senar kosong', 'Tangga nada D mayor', 'Lagu "Ode to Joy" bagian A'],
};
// Riwayat 4 minggu terakhir (hari ini: 3 sudah hadir, sisanya belum)
const att = {}, notes = {};
for (let back = 28; back >= 0; back--) {
  const d = new Date(today); d.setDate(d.getDate() - back); const key = dk(d), dn = DAYS[d.getDay()];
  students.filter(s => s.day === dn).forEach((s, i) => {
    let st = 'hadir';
    if (back === 0) { if (i >= 3) return; }
    else if ((i + back) % 9 === 4) st = 'izin';
    att[key] = att[key] || {}; att[key][s.name] = st;
    const k = (back / 7) % 3 | 0;
    notes[key + '_' + s.name] = st === 'hadir' ? { progress: PROG[s.instrument][k] || PROG[s.instrument][0], prSiswa: back === 0 ? 'Ulangi latihan 15 menit tiap hari' : '' } : { reason: 'Sakit' };
  });
}
const T0 = Date.now();
const topics = (pre, arr) => arr.map((x, i) => typeof x === 'string' ? { id: pre + 'h' + i, type: 'header', label: x } : { id: pre + 't' + i, type: 'topic', label: x[0] });
const curriculum = {
  Piano: topics('p', ['Tingkat Dasar', ['Posisi duduk & jari'], ['Not balok kunci G'], ['Tangga nada C mayor'], ['Lagu "Twinkle Twinkle"'], 'Tingkat Menengah', ['Tangga nada G & F mayor'], ['Arpeggio 2 oktaf'], ['Dinamika piano & forte'], ['Lagu "Für Elise" bagian A']]),
  Gitar: topics('g', ['Dasar', ['Kunci C, G, Am, F'], ['Strumming 8 ketukan'], 'Lanjutan', ['Petikan jari'], ['Barre chord F & Bm']]),
};
const links = [
  { id: 'l1', type: 'link', name: 'Partitur Piano Dasar', url: 'https://example.com/partitur', icon: 'music' },
  { id: 'l2', type: 'link', name: 'Video Strumming Gitar', url: 'https://example.com/strumming', icon: 'play' },
  { id: 'l3', type: 'link', name: 'Metronom Online', url: 'https://example.com/metronom', icon: 'clock' },
];
const tasks = [
  { id: 't1', text: 'Siapkan partitur lagu pilihan Dafa', done: false, createdAt: T0 },
  { id: 't2', text: 'Cetak lembar latihan tangga nada untuk Alya', done: false, createdAt: T0 - 864e5 },
  { id: 't3', text: 'Rekam contoh vokal untuk Citra', done: true, createdAt: T0 - 2 * 864e5 },
];
const SEED = { rms4_s: students, rms4_a: att, rms4_n: notes, rms4_curriculum: curriculum, rms4_links: links, rms4_tasks: tasks, rms_school_name: 'Studio Musik Harmoni', rms_school_sub: 'Les Musik Privat', llk_theme: 'default' };

(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await b.newContext({ viewport: { width: 390, height: 780 }, deviceScaleFactor: 3, serviceWorkers: 'block', timezoneId: 'Asia/Jakarta', locale: 'id-ID' });
  await ctx.route('**/*', r => fontOrLocal(r));
  await ctx.addInitScript(seed => {
    try { sessionStorage.setItem('llk_v1_tab', '1'); sessionStorage.setItem('llk_play_app', '1'); Object.keys(seed).forEach(k => localStorage.setItem(k, typeof seed[k] === 'string' ? seed[k] : JSON.stringify(seed[k]))); } catch (e) {}
  }, SEED);
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(BASE + '/'); await sleep(3000);
  await p.addStyleTag({ content: '#toast,#loginGate,#trialBanner{display:none!important} *{caret-color:transparent!important}' });
  const shot = async (name, fn) => { await p.evaluate(fn); await sleep(900); await p.evaluate(() => window.scrollTo(0, 0)); await sleep(200); await p.screenshot({ path: path.join(RAW, name + '.png') }); };
  await shot('1-absensi', () => setTab('absensi'));
  await shot('2-siswa', () => setTab('siswa'));
  await shot('3-track', () => setTab('track'));
  await shot('4-kirim', () => setTab('kirim'));
  await shot('5-materi', () => { setTab('links'); if (typeof renderCurriculumSubjectPage === 'function') renderCurriculumSubjectPage('Piano'); });
  // Layar catat progres (murid ke-4 hari ini)
  await shot('6-progres', () => { setTab('absensi'); const n = 'Dafa Pratama', d = new Date(); const k = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    openNoteModal(n, 'hadir', n, k, '16:00', '16:45');
    const set = (id, v) => { const e = document.getElementById(id); if (e) { e.value = v; e.dispatchEvent(new Event('input')); } };
    set('noteProgress', 'Groove 8-beat lancar di tempo 90. Mulai latihan fill tom sederhana.'); set('notePrSiswa', 'Latihan fill 4 ketuk dengan metronom, 15 menit/hari'); set('notePrGuru', 'Siapkan partitur lagu pilihan Dafa'); });
  console.log('errors:', errs.slice(0, 3));

  // ── Bingkai screenshot 1080x1920 + feature graphic 1024x500 ──
  const b64 = f => fs.readFileSync(f).toString('base64');
  const LOGO = 'data:image/png;base64,' + b64(path.join(__dirname, '../logo-leslesanku.png'));
  const ICON = 'data:image/png;base64,' + b64(path.join(__dirname, '../icon-512.png'));
  const FONTS = '<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;9..144,700&family=Plus+Jakarta+Sans:wght@500;600;700;800&display=swap" rel="stylesheet"/>';
  const CAPS = [
    ['1-absensi', 'Absensi les cukup sekali ketuk', 'Hadir, izin, alpa — lengkap dengan catatan progres tiap pertemuan'],
    ['2-siswa', 'Semua murid rapi di satu tempat', 'Jadwal, tarif & kontak orang tua tersimpan otomatis'],
    ['3-track', 'Rekap kehadiran & penghasilan', 'Lihat estimasi pemasukan bulan ini dalam sekejap'],
    ['4-kirim', 'Laporan harian siap dikirim', 'Salin ke Google Sheets atau kirim progres ke WhatsApp orang tua'],
    ['5-materi', 'Kurikulum tersusun per pelajaran', 'Bab & topik bisa diatur ulang, lengkap dengan materi & PR guru'],
    ['6-progres', 'Catat progres & PR tiap pertemuan', 'Orang tua tahu perkembangan anaknya, kamu tidak lupa materi berikutnya'],
  ];
  const fp = await b.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  await fp.route('**/*', r => fontOrLocal(r));
  for (const [f, t, sub] of CAPS) {
    const img = 'data:image/png;base64,' + b64(path.join(RAW, f + '.png'));
    await fp.setContent(`<!doctype html><html><head>${FONTS}<style>
      *{box-sizing:border-box;margin:0}body{width:1080px;height:1920px;overflow:hidden;font-family:'Plus Jakarta Sans',sans-serif;
        background:radial-gradient(ellipse at 20% 0%,#fff6ee 0%,rgba(255,246,238,0) 55%),linear-gradient(165deg,#fbefe6 0%,#f6d9d3 55%,#e9b3ab 100%);position:relative}
      .glow{position:absolute;width:900px;height:900px;border-radius:50%;background:radial-gradient(circle,rgba(168,55,42,0.18),rgba(168,55,42,0) 70%);left:90px;top:520px}
      .cap{position:absolute;top:96px;left:80px;right:80px;text-align:center}
      .t{font-family:'Fraunces',serif;font-weight:700;font-size:78px;line-height:1.08;color:#3a1712;letter-spacing:-0.01em}
      .s{margin-top:22px;font-size:36px;line-height:1.4;color:#6e3a32;font-weight:600}
      .phone{position:absolute;left:50%;top:470px;transform:translateX(-50%);width:760px;padding:18px;border-radius:72px;background:#1d1714;
        box-shadow:0 40px 90px rgba(90,25,18,0.35),0 0 0 3px rgba(255,255,255,0.25) inset}
      .phone img{display:block;width:100%;border-radius:56px}
    </style></head><body><div class="glow"></div><div class="cap"><div class="t">${t}</div><div class="s">${sub}</div></div>
      <div class="phone"><img src="${img}"/></div></body></html>`, { waitUntil: 'load' });
    await fp.evaluate(() => document.fonts.ready); await sleep(300);
    await fp.screenshot({ path: path.join(OUT, 'screenshot-' + f + '.png') });
  }
  // Feature graphic
  const gp = await b.newPage({ viewport: { width: 1024, height: 500 }, deviceScaleFactor: 1 });
  await gp.route('**/*', r => fontOrLocal(r));
  const shotA = 'data:image/png;base64,' + b64(path.join(RAW, '1-absensi.png'));
  const shotB = 'data:image/png;base64,' + b64(path.join(RAW, '3-track.png'));
  await gp.setContent(`<!doctype html><html><head>${FONTS}<style>
    *{box-sizing:border-box;margin:0}body{width:1024px;height:500px;overflow:hidden;font-family:'Plus Jakarta Sans',sans-serif;position:relative;
      background:radial-gradient(ellipse at 15% 10%,#fff8f2 0%,rgba(255,248,242,0) 60%),linear-gradient(120deg,#fbefe6 0%,#f4d3cc 60%,#d98e83 100%)}
    .l{position:absolute;left:64px;top:0;bottom:0;width:520px;display:flex;flex-direction:column;justify-content:center}
    .logo{width:300px;height:auto;margin-bottom:26px}
    .t{font-family:'Fraunces',serif;font-weight:700;font-size:46px;line-height:1.12;color:#3a1712}
    .s{margin-top:16px;font-size:21px;line-height:1.45;color:#6e3a32;font-weight:600}
    .ph{position:absolute;width:250px;padding:8px;border-radius:34px;background:#1d1714;box-shadow:0 26px 60px rgba(90,25,18,0.4)}
    .ph img{display:block;width:100%;border-radius:27px}
    .p1{left:610px;top:70px;transform:rotate(-6deg)}.p2{left:790px;top:40px;transform:rotate(5deg)}
  </style></head><body><div class="l"><img class="logo" src="${LOGO}"/><div class="t">Absensi, progres & tagihan les dalam satu aplikasi</div>
    <div class="s">Untuk guru les privat — musik, bahasa, akademik & lainnya</div></div>
    <div class="ph p2"><img src="${shotB}"/></div><div class="ph p1"><img src="${shotA}"/></div></body></html>`, { waitUntil: 'load' });
  await gp.evaluate(() => document.fonts.ready); await sleep(300);
  await gp.screenshot({ path: path.join(OUT, 'feature-graphic-1024x500.png') });
  // Ikon aplikasi 512x512 (salinan ikon yang sudah ada)
  fs.copyFileSync(path.join(__dirname, '../icon-512.png'), path.join(OUT, 'app-icon-512.png'));
  console.log('selesai:', fs.readdirSync(OUT).filter(x => x.endsWith('.png')).join(', '));
  await b.close();
})();
