// Ikon Play Store 512x512 (persegi penuh; Google yang membulatkan sudutnya). Beberapa opsi desain.
const path = require('path'), fs = require('fs');
const { chromium } = require(path.join(__dirname, '../tests/node_modules/playwright'));
const { execFileSync } = require('child_process');
const OUT = path.join(__dirname, 'play/icon-opsi');
const BOOK = 'data:image/png;base64,' + fs.readFileSync(path.join(__dirname, '../logo-llk.png')).toString('base64');
const FONT_CSS = execFileSync('curl', ['-sL', '-A', 'Mozilla/5.0 Chrome/120', 'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@800&display=swap']).toString();
const base = `*{margin:0;box-sizing:border-box}body{width:512px;height:512px;overflow:hidden;position:relative;font-family:'Plus Jakarta Sans',sans-serif}
.orb{position:absolute;left:56px;top:56px;width:400px;height:400px;border-radius:50%;display:flex;align-items:center;justify-content:center;
 background:radial-gradient(circle at 35% 28%,#e8604f 0%,#c0392b 42%,#8e2318 78%,#6d170f 100%);
 box-shadow:0 26px 40px rgba(60,10,5,.45),0 8px 14px rgba(60,10,5,.35),inset 0 -18px 30px rgba(60,8,4,.55),inset 0 10px 18px rgba(255,190,170,.45)}
.orb::before{content:"";position:absolute;left:62px;top:26px;width:276px;height:150px;border-radius:50%;
 background:linear-gradient(180deg,rgba(255,255,255,.85),rgba(255,255,255,.08) 85%,rgba(255,255,255,0));filter:blur(.5px)}
.orb::after{content:"";position:absolute;inset:-3px;border-radius:50%;box-shadow:0 0 0 6px rgba(255,255,255,.55),0 0 0 9px rgba(140,30,20,.25)}
.txt{position:relative;color:#fff;font-weight:800;font-size:148px;letter-spacing:-4px;text-shadow:0 6px 0 rgba(90,15,8,.55),0 10px 22px rgba(60,8,4,.5)}
.spark{position:absolute;width:64px;height:64px;right:118px;top:94px;background:radial-gradient(circle,#fff 0 12%,rgba(255,255,255,.0) 60%)}
.spark::before,.spark::after{content:"";position:absolute;left:50%;top:50%;width:64px;height:4px;margin:-2px 0 0 -32px;background:linear-gradient(90deg,transparent,#fff,transparent);border-radius:2px}
.spark::after{transform:rotate(90deg)}`;
const opts = {
  A: `body{background:radial-gradient(circle at 50% 35%,#fff7ef 0%,#f6e3d6 55%,#ecc9bb 100%)}`,
  B: `body{background:radial-gradient(circle at 50% 30%,#4a1c16 0%,#2b100c 70%,#1d0a07 100%)}
      body::before{content:"";position:absolute;inset:0;background:conic-gradient(from 0deg at 50% 50%,rgba(255,200,170,.0),rgba(255,200,170,.18),rgba(255,200,170,0) 12%,rgba(255,200,170,.14) 25%,rgba(255,200,170,0) 37%,rgba(255,200,170,.16) 50%,rgba(255,200,170,0) 62%,rgba(255,200,170,.14) 75%,rgba(255,200,170,0) 87%,rgba(255,200,170,.18))}`,
  C: `body{background:radial-gradient(circle at 50% 35%,#fff7ef 0%,#f6e3d6 55%,#ecc9bb 100%)}
      .txt{display:none}.book{position:relative;width:250px;height:250px;background:url(${BOOK}) center/contain no-repeat;filter:brightness(0) invert(1) drop-shadow(0 8px 10px rgba(60,8,4,.55))}`,
};
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage({ viewport: { width: 512, height: 512 } });
  for (const [k, css] of Object.entries(opts)) {
    await p.setContent(`<!doctype html><html><head><style>${FONT_CSS}${base}${css}</style></head><body><div class="orb">${k === 'C' ? '<div class="book"></div>' : '<div class="txt">LLK</div>'}</div><div class="spark"></div></body></html>`, { waitUntil: 'load' });
    await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(200);
    await p.screenshot({ path: path.join(OUT, 'ikon-' + k + '.png'), omitBackground: false });
  }
  // gambar perbandingan (dibulatkan seperti di Play Store)
  const imgs = Object.keys(opts).map(k => 'data:image/png;base64,' + fs.readFileSync(path.join(OUT, 'ikon-' + k + '.png')).toString('base64'));
  await p.setViewportSize({ width: 1200, height: 520 });
  await p.setContent(`<!doctype html><html><head><style>${FONT_CSS}body{margin:0;background:#f3efe9;font-family:'Plus Jakarta Sans',sans-serif;display:flex;gap:40px;justify-content:center;align-items:center;height:520px}
    .c{text-align:center;font-weight:800;font-size:40px;color:#3a1712}.c img{width:340px;height:340px;border-radius:22%;display:block;margin-bottom:16px;box-shadow:0 10px 30px rgba(0,0,0,.18)}</style></head>
    <body>${imgs.map((s, i) => `<div class="c"><img src="${s}"/>Pilihan ${'ABC'[i]}</div>`).join('')}</body></html>`, { waitUntil: 'load' });
  await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(200);
  await p.screenshot({ path: path.join(OUT, 'perbandingan.png') });
  await b.close(); console.log('ok');
})();
