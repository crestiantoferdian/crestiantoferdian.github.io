// Gambar untuk build ulang aplikasi Android (PWABuilder / TWA) — versi 2.
//  - twa/splash-1024.png        : layar pembuka (logo mendatar LLK Les LesanKu, latar transparen → warna latar #f6f1e9)
//  - twa/icon-maskable-512.png  : ikon peluncur adaptif (desain opsi A, bola di zona aman 80%)
//  - twa/icon-512.png           : salinan ikon opsi A (untuk Play Store / cadangan)
// Jalankan dari folder repo: node store/make-twa-assets.cjs
const path = require('path'), fs = require('fs');
const { chromium } = require(path.join(__dirname, '../tests/node_modules/playwright'));
const OUT = path.join(__dirname, 'play/twa');
fs.mkdirSync(OUT, { recursive: true });
const LOGO = 'data:image/png;base64,' + fs.readFileSync(path.join(__dirname, '../logo-leslesanku.png')).toString('base64');
const ICON_A = 'data:image/png;base64,' + fs.readFileSync(path.join(__dirname, 'play/icon-opsi/ikon-A.png')).toString('base64');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage({ viewport: { width: 1024, height: 1024 } });
  // Splash: logo 760x225 digambar selebar 880px di tengah kanvas 1024 (sisa ruang aman di kiri-kanan)
  await p.setContent(`<!doctype html><html><head><style>*{margin:0}html,body{width:1024px;height:1024px;background:transparent;display:flex;align-items:center;justify-content:center}
    img{width:880px;height:auto;image-rendering:auto}</style></head><body><img src="${LOGO}"/></body></html>`, { waitUntil: 'load' });
  await p.screenshot({ path: path.join(OUT, 'splash-1024.png'), omitBackground: true });
  // Ikon adaptif: latar opsi A penuh + ikon A diperkecil 80% (Android memotong pinggiran ikon adaptif)
  await p.setViewportSize({ width: 512, height: 512 });
  await p.setContent(`<!doctype html><html><head><style>*{margin:0}body{width:512px;height:512px;overflow:hidden;
    background:radial-gradient(circle at 50% 35%,#fff7ef 0%,#f6e3d6 55%,#ecc9bb 100%);display:flex;align-items:center;justify-content:center}
    img{width:410px;height:410px;border-radius:50%;}</style></head><body><img src="${ICON_A}"/></body></html>`, { waitUntil: 'load' });
  await p.screenshot({ path: path.join(OUT, 'icon-maskable-512.png') });
  fs.copyFileSync(path.join(__dirname, 'play/icon-opsi/ikon-A.png'), path.join(OUT, 'icon-512.png'));
  await b.close(); console.log('ok:', fs.readdirSync(OUT).join(', '));
})();
