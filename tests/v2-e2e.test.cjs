const { chromium } = require('playwright'); const fs=require('fs');
const FB=__dirname+'/node_modules/firebase/';
const OUT=__dirname+'/out/'; require('fs').mkdirSync(OUT,{recursive:true});
let pass=0,fail=0; const ok=(c,m)=>{c?pass++:fail++;console.log((c?'  ✅ ':'  ❌ ')+m);};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  const b=await chromium.launch({executablePath:process.env.CHROME_PATH||undefined});
  async function dev(user,{w=390,h=844}={}){
    const ctx=await b.newContext({viewport:{width:w,height:h},serviceWorkers:'block'});
    await ctx.route('**/*',r=>{const u=r.request().url();
      if(u.startsWith('http://localhost')||u.startsWith('http://127.0.0.1')) return r.continue();
      const m=u.match(/firebasejs\/10\.14\.1\/(firebase-[a-z]+\.js)$/); if(m) return r.fulfill({contentType:'text/javascript',body:fs.readFileSync(FB+m[1],'utf8')});
      return r.abort();});
    await ctx.addInitScript(u=>{ window.__LLK_TEST__={host:'127.0.0.1',port:8089,user:u}; window.__opened=[]; window.open=(x)=>{window.__opened.push(x);return null;}; },user);
    const p=await ctx.newPage(); p.errs=[]; p.on('pageerror',e=>p.errs.push(e.message)); p.on('dialog',d=>d.accept());
    return p;
  }
  const txt=p=>p.evaluate(()=>document.body.innerText);
  const URL=''+(process.env.BASE_URL||'http://localhost:8765')+'/v2/';

  console.log('\n[Admin membuat lembaga]');
  const A=await dev({uid:'adminA',email:'admin@les.com',displayName:'Bu Rina'});
  await A.goto(URL); await A.waitForSelector('#rcLembaga',{timeout:15000}); await sleep(300);
  ok((await txt(A)).includes('Pemilik Lembaga Les'),'layar pilih peran tampil (3 pilihan)');
  await A.screenshot({path:OUT+'v2_chooser.png'});
  await A.click('#rcLembaga'); await sleep(500);
  await A.fill('#coName','Les Musik Ceria'); await A.click('#coGo'); await sleep(2000);
  ok((await txt(A)).includes('GURU ADMIN') && (await txt(A)).includes('0 / 5'),'lembaga dibuat → masuk sebagai Guru Admin, kursi 0/5');

  console.log('\n[Admin mengundang Guru Mitra]');
  await A.click('#addMitra'); await A.fill('#amName','Budi Santoso'); await A.fill('#amHonor','30000'); await A.click('#amGo'); await sleep(1500);
  const code=await A.evaluate(()=>document.querySelector('.code-box').textContent.trim());
  ok(/^LLK-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(code),'kode undangan dibuat: '+code);
  await A.click('#icWa'); const wa=await A.evaluate(()=>decodeURIComponent(window.__opened[0]||''));
  ok(wa.includes(code)&&wa.includes('?kode='+code),'pesan WA berisi kode & link undangan');
  await A.click('#icClose'); await sleep(800);
  ok((await txt(A)).includes('1 / 5')&&(await txt(A)).includes('MENUNGGU'),'undangan menempati 1 kursi (1/5)');
  await A.screenshot({path:OUT+'v2_admin_guru.png'});

  console.log('\n[Mitra bergabung lewat link]');
  const M=await dev({uid:'mitraB',email:'budi@gmail.com',displayName:'Budi'});
  await M.goto(URL+'?kode='+code); await sleep(2500);
  ok((await txt(M)).toUpperCase().includes('KODE VALID')&&(await txt(M)).includes('Les Musik Ceria')&&(await txt(M)).includes('Rp 30.000'),'link membuka form dengan kode terisi & tervalidasi otomatis');
  await M.screenshot({path:OUT+'v2_join.png'});
  await M.click('#jJoin'); await sleep(2000);
  ok((await txt(M)).includes('GURU MITRA')&&(await txt(M)).includes('Jadwal Saya'),'Mitra masuk ke tampilan Guru Mitra');
  await M.click('[data-tab=honor]'); await sleep(300);
  ok((await txt(M)).includes('Rp 30.000'),'Mitra melihat honornya');
  await M.click('[data-tab=lainnya]'); await sleep(300);
  await M.fill('#mlSheet','https://docs.google.com/spreadsheets/d/abc'); await M.click('#mlSave'); await sleep(800);
  ok((await txt(M)).includes('Link tersimpan'),'Mitra menyimpan link spreadsheet absensi guru');

  console.log('\n[Kode sekali pakai & kunci Gmail]');
  const X=await dev({uid:'otherC',email:'orang@lain.com'});
  await X.goto(URL+'?kode='+code); await sleep(2500);
  ok((await txt(X)).includes('sudah dipakai'),'kode yang sudah dipakai ditolak untuk orang lain');

  console.log('\n[Admin mengelola Guru Mitra]');
  await A.reload(); await sleep(2500);
  let ta=await txt(A);
  ok(ta.includes('Budi Santoso')&&ta.includes('AKTIF')&&ta.includes('sudah diisi'),'Admin melihat Budi aktif & spreadsheet sudah diisi');
  await A.click('[data-honor]'); await A.fill('#ehVal','35000'); await A.click('#ehGo'); await sleep(1200);
  ok((await txt(A)).includes('Rp 35.000'),'Admin mengubah honor Budi');
  await M.reload(); await sleep(2500); await M.click('[data-tab=honor]'); await sleep(300);
  ok((await txt(M)).includes('Rp 35.000'),'honor baru langsung terlihat di HP Mitra');
  await A.click('#addMitra'); await A.fill('#amName','Sinta'); await A.fill('#amHonor','25000'); await A.fill('#amEmail','sinta@gmail.com'); await A.click('#amGo'); await sleep(1500);
  const code2=await A.evaluate(()=>document.querySelector('.code-box').textContent.trim()); await A.click('#icClose');
  await X.goto(URL+'?kode='+code2); await sleep(2500);
  ok((await txt(X)).includes('khusus untuk Gmail lain'),'kode terkunci Gmail ditolak untuk Gmail lain');
  await sleep(500);
  await A.reload(); await sleep(2500);
  // cabut undangan Sinta
  await A.click('[data-revoke]'); await A.click('#cfYes'); await sleep(1500);
  ok((await txt(A)).includes('1 / 5')&&!(await txt(A)).includes('MENUNGGU'),'undangan dicabut → kursi kembali (1/5)');
  // keluarkan Budi
  await A.click('[data-kick]'); ok(await A.evaluate(()=>document.getElementById('cfYes').disabled),'tombol Keluarkan terkunci sebelum ketik KELUAR');
  await A.fill('#cfWord','KELUAR'); await A.click('#cfYes'); await sleep(1500);
  ok((await txt(A)).includes('0 / 5')&&(await txt(A)).includes('Belum ada Guru Mitra'),'Budi dikeluarkan → kursi 0/5');
  await M.reload(); await sleep(3000);
  ok((await txt(M)).includes('Pemilik Lembaga Les')&&!(await txt(M)).includes('GURU MITRA'),'HP Budi kembali ke layar pilih peran (akses dicabut)');

  console.log('\n[Kursi penuh]');
  for(let i=0;i<5;i++){ await A.click('#addMitra'); await A.fill('#amName','Guru '+i); await A.fill('#amHonor','20000'); await A.click('#amGo'); await sleep(1300); await A.click('#icClose'); await sleep(900); }
  ok((await txt(A)).includes('5 / 5') && await A.evaluate(()=>document.getElementById('addMitra').disabled),'5/5 → tombol Tambah Guru Mitra nonaktif');

  console.log('\n[Tampilan laptop]');
  const D=await dev({uid:'adminA',email:'admin@les.com'},{w:1280,h:800});
  await D.goto(URL); await sleep(2500);
  const side=await D.evaluate(()=>{const n=document.querySelector('.bottom-nav').getBoundingClientRect();return n.width<300&&n.height>500;});
  ok(side,'di layar lebar menu pindah ke samping');
  await D.screenshot({path:OUT+'v2_desktop.png'});
  await A.click('[data-tab=lainnya]'); await sleep(300); await A.screenshot({path:OUT+'v2_admin_lainnya.png'});

  const errs=[A,M,X,D].flatMap(p=>p.errs); ok(errs.length===0,'tidak ada error JavaScript'+(errs.length?': '+errs.join(' | '):''));
  console.log(`\nHASIL: ${pass} lulus, ${fail} gagal`); await b.close(); process.exit(fail?1:0);
})().catch(e=>{console.error(e);process.exit(2);});
