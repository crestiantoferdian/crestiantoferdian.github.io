// LLK V2 — menu Lainnya Admin seperti V1: kartu akun, Profil & Tampilan Lembaga
// (nama singkat/panjang, logo teks, warna, tema), Info Pembayaran, Backup data.
const { chromium } = require('playwright'); const fs=require('fs');
const FB=__dirname+'/node_modules/firebase/';
const OUT=__dirname+'/out/'; fs.mkdirSync(OUT,{recursive:true});
let pass=0,fail=0; const ok=(c,m)=>{c?pass++:fail++;console.log((c?'  ✅ ':'  ❌ ')+m);};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  const b=await chromium.launch({executablePath:process.env.CHROME_PATH||undefined});
  async function dev(user,{w=390,h=844}={}){
    const ctx=await b.newContext({viewport:{width:w,height:h},serviceWorkers:'block',acceptDownloads:true});
    await ctx.route('**/*',r=>{const u=r.request().url();
      if(u.startsWith('http://localhost')||u.startsWith('http://127.0.0.1')) return r.continue();
      const m=u.match(/firebasejs\/10\.14\.1\/(firebase-[a-z]+\.js)$/); if(m) return r.fulfill({contentType:'text/javascript',body:fs.readFileSync(FB+m[1],'utf8')});
      return r.abort();});
    await ctx.addInitScript(u=>{ window.__LLK_TEST__={host:'127.0.0.1',port:8089,user:u}; },user);
    const p=await ctx.newPage(); p.errs=[]; p.on('pageerror',e=>p.errs.push(e.message)); p.on('dialog',d=>d.accept());
    return p;
  }
  const txt=p=>p.evaluate(()=>document.body.innerText);
  const URL=(process.env.BASE_URL||'http://localhost:8765')+'/v2/';

  console.log('\n[1] Lainnya: kartu akun & menu');
  const A=await dev({uid:'lnAdmin',email:'dian@gmail.com',displayName:'Dian Saputra'});
  await A.goto(URL); await A.waitForSelector('#rcLembaga',{timeout:15000});
  await A.click('#rcLembaga'); await sleep(300); await A.fill('#coName','CEK'); await A.click('#coGo'); await sleep(2000);
  await A.click('[data-tab=lainnya]'); await sleep(800);
  let t=await txt(A);
  ok(t.includes('dian@gmail.com')&&t.includes('GURU ADMIN')&&t.includes('UJI COBA · 14 HARI'),'kartu akun: email, Guru Admin, uji coba 14 hari');
  ok(['Profil & Tampilan Lembaga','Info Pembayaran Lembaga','Backup Data Lembaga','Langganan Lembaga','Ganti Mode','Keluar (Logout)'].every(x=>t.includes(x)),'menu: Profil & Tampilan, Info Pembayaran, Backup, Langganan, Ganti Mode, Logout');
  await A.screenshot({path:OUT+'lainnya_menu.png',fullPage:true});

  console.log('\n[2] Profil & Tampilan Lembaga');
  await A.click('#olProfil'); await sleep(400);
  await A.fill('#plName','FMS'); await A.fill('#plFull','Ferdian Music School'); await A.fill('#plLogoText','FMS');
  await A.click('.sw[data-c="#2a7349"]'); await sleep(150);
  ok(await A.evaluate(()=>document.getElementById('ppName').textContent==='FMS'&&document.getElementById('ppSub').textContent==='Ferdian Music School'&&document.getElementById('ppLogo').textContent==='FMS'&&getComputedStyle(document.getElementById('ppHdr')).backgroundColor==='rgb(42, 115, 73)'),'pratinjau header langsung berubah (nama, nama panjang, logo teks, warna hijau)');
  await A.screenshot({path:OUT+'lainnya_profil.png',fullPage:true});
  await A.click('#plSave'); await sleep(1500);
  ok(await A.evaluate(()=>document.querySelector('.h-name').textContent==='FMS'&&document.querySelector('.h-sub').textContent==='Ferdian Music School'&&document.querySelector('.h-logo').textContent==='FMS'),'header aplikasi Admin: FMS · Ferdian Music School · logo FMS');
  ok(await A.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--red').trim()==='#2a7349'),'warna lembaga dipakai di aplikasi (tombol, menu aktif, logo)');
  await A.reload(); await sleep(2500);
  ok(await A.evaluate(()=>document.querySelector('.h-name').textContent==='FMS'&&getComputedStyle(document.documentElement).getPropertyValue('--red').trim()==='#2a7349'),'tersimpan di server (tetap setelah dibuka ulang)');

  console.log('\n[3] Tema tampilan');
  await A.click('[data-tab=lainnya]'); await sleep(500); await A.click('#olProfil'); await sleep(400);
  await A.click('[data-th=dark]'); await sleep(300);
  ok(await A.evaluate(()=>document.documentElement.getAttribute('data-theme')==='dark'&&localStorage.getItem('llk_theme')==='dark'&&getComputedStyle(document.body).backgroundColor==='rgb(21, 18, 15)'),'Dark Mode langsung aktif (disimpan di perangkat, sama dengan V1)');
  await A.click('[data-tab=murid]'); await sleep(1200); await A.screenshot({path:OUT+'lainnya_dark_murid.png'});
  await A.click('[data-tab=lainnya]'); await sleep(500); await A.screenshot({path:OUT+'lainnya_dark.png',fullPage:true});
  await A.click('#olProfil'); await sleep(300); await A.click('[data-th=happy]'); await sleep(300);
  ok(await A.evaluate(()=>document.documentElement.getAttribute('data-theme')==='happy'),'Happy Time aktif');
  await A.click('[data-th=latte]'); await sleep(200);
  ok(await A.evaluate(()=>!document.documentElement.hasAttribute('data-theme')),'kembali ke Caffe Latte');

  console.log('\n[4] Info Pembayaran');
  await A.click('#olBack'); await sleep(300); await A.click('#olPay'); await sleep(800);
  await A.fill('#piBank','BCA'); await A.fill('#piNum','1234567890'); await A.fill('#piHolder','Ferdian'); await A.fill('#piNote','Mohon kirim bukti transfer');
  t=await A.evaluate(()=>document.getElementById('piPrev').innerText);
  ok(t.includes('BCA 1234567890 a.n. Ferdian')&&t.includes('Mohon kirim bukti transfer'),'contoh pesan tagihan memuat rekening lembaga');
  await A.click('#piSave'); await sleep(1200);
  await A.click('#olPay'); await sleep(800);
  ok(await A.evaluate(()=>document.getElementById('piNum').value==='1234567890'),'info pembayaran tersimpan');
  await A.click('#olBack'); await sleep(300);

  console.log('\n[5] Backup data lembaga');
  const [dl]=await Promise.all([A.waitForEvent('download'),A.click('#olBackup')]);
  const j=JSON.parse(fs.readFileSync(await dl.path(),'utf8'));
  ok(dl.suggestedFilename().startsWith('LLK-Lembaga_FMS_')&&j.org.fullName==='Ferdian Music School'&&Array.isArray(j.students)&&j.members.length===1&&j.settings.some(x=>x.id==='payinfo'),'file backup JSON berisi profil, anggota, murid & pengaturan: '+dl.suggestedFilename());

  console.log('\n[6] Aplikasi Guru Mitra ikut warna & logo lembaga');
  await A.click('[data-tab=guru]'); await sleep(1200);
  await A.click('#addMitra'); await A.fill('#amName','Pak Dimas'); await A.fill('#amHonor','40000'); await A.click('#amGo'); await sleep(1300);
  const code=await A.evaluate(()=>document.querySelector('.modal .code-box').textContent.trim()); await A.click('#icClose');
  const G=await dev({uid:'lnDimas',email:'dimas@gmail.com'}); await G.goto(URL+'?kode='+code); await sleep(2500); await G.click('#jJoin'); await sleep(3000);
  ok(await G.evaluate(()=>document.getElementById('schoolName').textContent==='FMS'&&document.getElementById('schoolLogo').textContent==='FMS'&&getComputedStyle(document.documentElement).getPropertyValue('--red').trim()==='#2a7349'),'header aplikasi Guru: FMS, logo FMS, warna hijau lembaga');
  await G.screenshot({path:OUT+'lainnya_guru_warna.png'});

  const errs=[A,G].flatMap(p=>p.errs); ok(errs.length===0,'tidak ada error JavaScript'+(errs.length?': '+errs.join(' | '):''));
  console.log(`\nHASIL: ${pass} lulus, ${fail} gagal`); await b.close(); process.exit(fail?1:0);
})().catch(e=>{console.error(e);process.exit(2);});
