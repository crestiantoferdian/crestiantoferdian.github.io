// LLK V2 — Materi, PR Guru, Kurikulum (seperti V1) & Catatan guru → Admin,
// ringkasan pertemuan terakhir & centang kurikulum di profil siswa (aplikasi Guru Mitra).
const { chromium } = require('playwright'); const fs=require('fs');
const FB=__dirname+'/node_modules/firebase/';
const OUT=__dirname+'/out/'; fs.mkdirSync(OUT,{recursive:true});
let pass=0,fail=0; const ok=(c,m)=>{c?pass++:fail++;console.log((c?'  ✅ ':'  ❌ ')+m);};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const DAYS=['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
const TODAY=DAYS[new Date(Date.now()+7*3600e3).getUTCDay()];
(async()=>{
  const b=await chromium.launch({executablePath:process.env.CHROME_PATH||undefined});
  async function dev(user,{w=390,h=844}={}){
    const ctx=await b.newContext({viewport:{width:w,height:h},serviceWorkers:'block',timezoneId:'Asia/Jakarta'});
    await ctx.route('**/*',r=>{const u=r.request().url();
      if(u.startsWith('http://localhost')||u.startsWith('http://127.0.0.1')) return r.continue();
      const m=u.match(/firebasejs\/10\.14\.1\/(firebase-[a-z]+\.js)$/); if(m) return r.fulfill({contentType:'text/javascript',body:fs.readFileSync(FB+m[1],'utf8')});
      return r.abort();});
    await ctx.addInitScript(u=>{ window.__LLK_TEST__={host:'127.0.0.1',port:8089,user:u}; window.__wa=[]; window.open=(x)=>{window.__wa.push(x);return null;}; },user);
    const p=await ctx.newPage(); p.errs=[]; p.on('pageerror',e=>p.errs.push(e.message)); p.on('dialog',d=>d.accept());
    return p;
  }
  const txt=p=>p.evaluate(()=>document.body.innerText);
  const URL=(process.env.BASE_URL||'http://localhost:8765')+'/v2/';

  console.log('\n[Persiapan: lembaga, guru Feran, siswa Nazura (Piano, hari ini)]');
  const A=await dev({uid:'mtAdmin',email:'dian@gmail.com',displayName:'Dian'});
  await A.goto(URL); await A.waitForSelector('#rcLembaga',{timeout:15000});
  await A.click('#rcLembaga'); await sleep(300); await A.fill('#coName','CEK'); await A.click('#coGo'); await sleep(2000);
  await A.click('#addMitra'); await A.fill('#amName','Feran'); await A.fill('#amHonor','30000'); await A.click('#amGo'); await sleep(1300);
  const code=await A.evaluate(()=>document.querySelector('.modal .code-box').textContent.trim()); await A.click('#icClose'); await sleep(500);
  const M=await dev({uid:'mtFeran',email:'feran@x.com',displayName:'Feran'});
  await M.goto(URL+'?kode='+code); await sleep(2500); await M.click('#jJoin'); await sleep(3000);
  await A.click('[data-tab=murid]'); await sleep(1200); await A.click('[data-view=pelajaran]'); await sleep(300);
  await A.click('#addSubj'); await A.fill('#pjName','Piano'); await A.fill('#pjRate','50000'); await A.click('#pjGo'); await sleep(1200);
  await A.click('[data-view=daftar]'); await sleep(300);
  const pick=(sel,label)=>A.evaluate(([sel,label])=>{const s=document.querySelector(sel); const o=[...s.options].find(o=>o.textContent===label); s.value=o.value; s.dispatchEvent(new Event('change'));},[sel,label]);
  await A.click('#addStu'); await sleep(300); await A.fill('#sfName','Nazura'); await A.fill('#sfPhone','08121');
  await pick('select[data-c="0"][data-k="subjectId"]','Piano'); await sleep(100); await pick('select[data-c="0"][data-k="mitraUid"]','Feran');
  await pick('select[data-c="0"][data-s="0"][data-k="day"]',TODAY);
  await A.fill('input[data-c="0"][data-s="0"][data-k="start"]','12:15'); await A.fill('input[data-c="0"][data-s="0"][data-k="end"]','13:00');
  await A.click('#sfGo'); await sleep(1500);

  console.log('\n[1] Admin: tab Materi (Catatan Guru · Materi · PR Guru · Kurikulum)');
  await A.click('[data-tab=materi]'); await sleep(1500);
  let t=await txt(A);
  ok(['Catatan Guru','Materi','PR Guru','Kurikulum'].every(x=>t.includes(x)),'4 kotak seperti tab Materi V1');
  await A.click('[data-sec=materi]'); await sleep(800);
  await A.click('#mtFolder'); await A.fill('#mfName','Piano Dasar'); await A.click('#mfGo'); await sleep(1500);
  await A.click('[data-open]'); await sleep(400); await A.click('#mtLink'); await A.fill('#mfName','Buku Bastien 1'); await A.fill('#mfUrl','drive.google.com/bastien'); await A.click('#mfGo'); await sleep(1500);
  ok((await txt(A)).includes('Buku Bastien 1'),'Admin membuat folder "Piano Dasar" berisi materi Buku Bastien 1');
  await A.click('#matBack'); await sleep(800); await A.click('#matBack'); await sleep(800);
  await A.click('[data-sec=kurikulum]'); await sleep(800); await A.click('[data-kur]'); await sleep(500);
  await A.click('#kuHead'); await A.fill('#kuText','Bab 1 · Dasar'); await A.click('#kuGo'); await sleep(1300);
  for(const x of ['Posisi jari','Tangga nada C']){ await A.click('#kuTopic'); await A.fill('#kuText',x); await A.click('#kuGo'); await sleep(1300); }
  await A.click('[data-kdn="1"]'); await sleep(1300);
  t=await A.evaluate(()=>[...document.querySelectorAll('.kur-l')].map(e=>e.textContent).join('|'));
  ok(t==='Bab 1 · Dasar|Tangga nada C|Posisi jari','kurikulum Piano: Bab + 2 topik, urutan bisa diubah');
  await A.screenshot({path:OUT+'materi_admin_kurikulum.png'});
  await A.click('#matBack'); await sleep(700); await A.click('#matBack'); await sleep(700);
  await A.click('[data-sec=pr]'); await sleep(800); await A.click('#tkAdd'); await A.fill('#tkText','Siapkan lagu untuk konser'); await A.click('#tkGo'); await sleep(1500);
  ok((await txt(A)).includes('Siapkan lagu untuk konser'),'Admin memberi PR ke guru Feran');

  console.log('\n[2] Guru Mitra: tab Materi');
  await M.reload(); await sleep(3500);
  await M.click('[data-tab=materi]'); await sleep(500);
  t=await txt(M); ok(t.includes('Materi')&&t.includes('PR Guru')&&t.includes('Kurikulum')&&t.includes('Catatan ke Admin'),'aplikasi guru: tab Materi (Materi · PR Guru · Kurikulum · Catatan ke Admin)');
  await M.screenshot({path:OUT+'materi_guru_tiles.png'});
  await M.click('[data-sec=materi]'); await sleep(300); await M.click('[data-open]'); await sleep(300); await M.click('[data-url]'); await sleep(200);
  ok((await M.evaluate(()=>window.__wa.slice(-1)[0]))==='https://drive.google.com/bastien','guru membuka materi dari lembaga');
  await M.click('#mtBack'); await sleep(200); await M.click('#mtBack'); await sleep(200);
  await M.click('[data-sec=pr]'); await sleep(300);
  t=await txt(M); ok(t.includes('Siapkan lagu untuk konser')&&t.includes('Dari Guru Admin'),'PR dari Admin muncul di PR Guru');
  await M.fill('#taskInput','Fotokopi buku lagu'); await M.click('#taskAdd'); await sleep(1000);
  await M.click('.llk-row:has-text("Siapkan lagu") [data-tdone]'); await sleep(1000);
  t=await txt(M); ok(t.includes('Fotokopi buku lagu')&&t.includes('Selesai · 1'),'guru menambah PR sendiri & mencentang PR selesai');
  await M.click('#mtBack'); await sleep(200);

  console.log('\n[3] Absensi: PR Guru otomatis, profil siswa (pertemuan terakhir + kurikulum)');
  await M.click('[data-tab=absensi]'); await sleep(400);
  await M.click('.s-item:has-text("Nazura") .s-avatar'); await sleep(300); await M.click('.s-item.expanded .att-btn.a-hadir'); await sleep(400);
  await M.fill('#noteProgress','Posisi jari benar, lanjut tangga nada C'); await M.fill('#notePrSiswa','Latihan 10 menit/hari'); await M.fill('#notePrGuru','Cetak lembar not tangga nada');
  await M.click('#noteSaveBtn'); await sleep(2000);
  await M.click('[data-tab=materi]'); await sleep(300); await M.click('[data-sec=pr]'); await sleep(300);
  t=await txt(M); ok(t.includes('Cetak lembar not tangga nada')&&t.includes('Ditulis saat sesi Nazura'),'PR Guru dari catatan kehadiran otomatis masuk PR Guru');
  await M.click('#mtBack'); await sleep(200);
  await M.click('[data-tab=siswa]'); await sleep(300); await M.click('[data-stu]'); await sleep(1500);
  t=await txt(M);
  ok(t.includes('Pertemuan terakhir')&&t.includes('Posisi jari benar'),'profil siswa: ringkasan pertemuan terakhir (materi terakhir)');
  ok(t.includes('Kurikulum Piano')&&t.includes('0/2'),'profil siswa: kurikulum Piano 0/2');
  await M.click('.kur-item:has-text("Posisi jari")'); await sleep(1500);
  ok((await txt(M)).includes('1/2'),'guru mencentang topik "Posisi jari" → 1/2');
  await M.screenshot({path:OUT+'materi_guru_profil.png',fullPage:true});

  console.log('\n[4] Catatan ke Admin');
  await M.click('#pfNote'); await sleep(300);
  ok(await M.evaluate(()=>document.getElementById('ntStu').selectedOptions[0].textContent==='Nazura'&&document.querySelector('[name=ntKind]:checked').value==='pesan'),'dari profil: siswa & jenis "Pesan" terisi otomatis');
  await M.fill('#ntText','Dompet Nazura ketinggalan di ruang les, tolong kabari ortunya'); await M.click('#ntGo'); await sleep(1500);
  await M.click('[data-tab=lainnya]'); await sleep(300); await M.click('#mlNote'); await sleep(300); await M.click('#ntNew'); await sleep(300);
  await M.click('.nt-kind:has-text("Konsumsi")'); await M.fill('#ntText','Minta air mineral untuk ruang les 2'); await M.click('#ntGo'); await sleep(1500);
  t=await txt(M); ok(t.includes('Terkirim · 2')&&t.includes('Belum dibaca'),'2 catatan terkirim (pesan untuk siswa & konsumsi)');
  await M.screenshot({path:OUT+'materi_guru_catatan.png',fullPage:true});

  console.log('\n[5] Admin menerima & membalas catatan');
  await A.reload(); await sleep(3000);
  ok(await A.evaluate(()=>{ const b=document.getElementById('noteBadge'); return b&&!b.hidden&&b.textContent==='2'; }),'tanda merah "2" di menu Materi aplikasi Admin');
  await A.click('[data-tab=materi]'); await sleep(1500); await A.click('[data-sec=catatan]'); await sleep(600);
  t=await txt(A); ok(t.includes('Dompet Nazura ketinggalan')&&t.includes('Siswa: Nazura')&&t.includes('Minta air mineral'),'Admin melihat 2 catatan dari Feran');
  await A.screenshot({path:OUT+'materi_admin_catatan.png',fullPage:true});
  await A.click('.note-card:has-text("Dompet") [data-nreply]'); await A.fill('#nrText','Sudah saya kabari ortunya, terima kasih'); await A.click('#nrGo'); await sleep(1500);
  await A.click('.note-card:has-text("air mineral") [data-ndone]'); await sleep(1500);
  await A.click('[data-nf=semua]'); await sleep(300);
  t=await txt(A); ok(t.includes('Balasan Anda: Sudah saya kabari')&&t.includes('SELESAI'),'Admin membalas & menandai selesai');
  await M.reload(); await sleep(3500); await M.click('[data-tab=materi]'); await sleep(300); await M.click('[data-sec=catatan]'); await sleep(300);
  t=await txt(M); ok(t.includes('Admin: Sudah saya kabari')&&t.includes('Selesai'),'guru melihat balasan Admin');
  await A.click('[data-tab=materi]'); await sleep(1500); await A.click('[data-sec=pr]'); await sleep(600);
  t=await txt(A); ok(t.includes('Cetak lembar not tangga nada')&&t.includes('Fotokopi buku lagu'),'Admin melihat PR Guru milik Feran');

  const errs=[A,M].flatMap(p=>p.errs); ok(errs.length===0,'tidak ada error JavaScript'+(errs.length?': '+errs.join(' | '):''));
  console.log(`\nHASIL: ${pass} lulus, ${fail} gagal`); await b.close(); process.exit(fail?1:0);
})().catch(e=>{console.error(e);process.exit(2);});
