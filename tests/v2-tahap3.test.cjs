// Uji V2 Tahap 3: tampilan Guru Mitra (sama dengan LLK V1), absensi Hadir/Alpa
// di hari yang sama dengan progres wajib, Izin oleh Admin, Track & Honor.
const { chromium } = require('playwright'); const fs=require('fs');
const FB=__dirname+'/node_modules/firebase/';
const OUT=__dirname+'/out/'; fs.mkdirSync(OUT,{recursive:true});
let pass=0,fail=0; const ok=(c,m)=>{c?pass++:fail++;console.log((c?'  ✅ ':'  ❌ ')+m);};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const DAYS=['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
const wib=new Date(Date.now()+7*3600e3); const TODAY=DAYS[wib.getUTCDay()]; const TOMORROW=DAYS[(wib.getUTCDay()+1)%7];
(async()=>{
  const b=await chromium.launch({executablePath:process.env.CHROME_PATH||undefined});
  async function dev(user,{w=390,h=844,theme=null}={}){
    const ctx=await b.newContext({viewport:{width:w,height:h},serviceWorkers:'block',timezoneId:'Asia/Jakarta',deviceScaleFactor:2});
    await ctx.route('**/*',r=>{const u=r.request().url();
      if(u.startsWith('http://localhost')||u.startsWith('http://127.0.0.1')) return r.continue();
      const m=u.match(/firebasejs\/10\.14\.1\/(firebase-[a-z]+\.js)$/); if(m) return r.fulfill({contentType:'text/javascript',body:fs.readFileSync(FB+m[1],'utf8')});
      return r.abort();});
    await ctx.addInitScript(([u,theme])=>{ window.__LLK_TEST__={host:'127.0.0.1',port:8089,user:u}; window.__wa=[]; window.open=(x)=>{window.__wa.push(x);return null;}; if(theme) localStorage.setItem('llk_theme',theme); },[user,theme]);
    const p=await ctx.newPage(); p.errs=[]; p.on('pageerror',e=>p.errs.push(e.message)); p.on('dialog',d=>d.accept());
    return p;
  }
  const txt=p=>p.evaluate(()=>document.body.innerText);
  const URL=(process.env.BASE_URL||'http://localhost:8765')+'/v2/';

  console.log('\n[Persiapan: lembaga, 1 Guru Mitra, 3 murid hari ini]');
  const A=await dev({uid:'t3admin',email:'owner3@rms.com',displayName:'Pemilik'},{w:1440,h:900});
  await A.goto(URL); await A.waitForSelector('#rcLembaga',{timeout:15000});
  await A.click('#rcLembaga'); await sleep(400); await A.fill('#coName','RMS Tahap 3'); await A.click('#coGo'); await sleep(2000);
  await A.click('#addMitra'); await A.fill('#amName','Budi'); await A.fill('#amHonor','30000'); await A.click('#amGo'); await sleep(1300);
  const code=await A.evaluate(()=>document.querySelector('.modal .code-box').textContent.trim()); await A.click('#icClose'); await sleep(600);
  const M=await dev({uid:'t3budi',email:'budi3@x.com'},{theme:'happy'});
  await M.goto(URL+'?kode='+code); await sleep(2500); await M.click('#jJoin'); await sleep(3000);
  await A.click('[data-tab=murid]'); await sleep(1200); await A.click('[data-view=pelajaran]'); await sleep(300);
  for(const [n,r] of [['Piano','50000'],['Gitar','45000'],['Vokal','45000']]){ await A.click('#addSubj'); await A.fill('#pjName',n); await A.fill('#pjRate',r); await A.click('#pjGo'); await sleep(1200); }
  await A.click('[data-view=daftar]'); await sleep(300);
  const pick=(sel,label)=>A.evaluate(([sel,label])=>{const s=document.querySelector(sel); const o=[...s.options].find(o=>o.textContent===label); s.value=o.value; s.dispatchEvent(new Event('change'));},[sel,label]);
  for(const [nm,subj,day,st,en] of [['Ayu Kinanthi','Vokal',TODAY,'13:00','13:45'],['Nauffal','Piano',TODAY,'13:45','14:30'],['Hosyana','Gitar',TODAY,'15:15','16:00'],['Rere','Piano',TOMORROW,'10:00','11:00']]){
    await A.click('#addStu'); await sleep(300); await A.fill('#sfName',nm); await A.fill('#sfPhone','0812'+nm.length);
    await pick('select[data-c="0"][data-k="subjectId"]',subj); await sleep(100); await pick('select[data-c="0"][data-k="mitraUid"]','Budi');
    await pick('select[data-c="0"][data-s="0"][data-k="day"]',day);
    await A.fill('input[data-c="0"][data-s="0"][data-k="start"]',st); await A.fill('input[data-c="0"][data-s="0"][data-k="end"]',en);
    await A.click('#sfGo'); await sleep(1500);
  }

  console.log('\n[Tampilan Guru Mitra = LLK V1]');
  await M.reload(); await sleep(3000);
  let t=await txt(M);
  ok(M.url().includes('guru.html'),'Mitra otomatis dibuka di halaman Guru Mitra');
  ok(t.includes('Absensi Harian')&&t.includes('Tandai siswa yang hadir')&&t.includes('Hari ini'),'judul & strip tanggal seperti V1');
  ok(t.includes('Ayu Kinanthi')&&t.includes('Nauffal')&&t.includes('Hosyana')&&!t.includes('Rere'),'hanya murid yang dijadwalkan hari ini');
  ok(await M.evaluate(()=>document.documentElement.getAttribute('data-theme')==='happy'&&!!document.querySelector('.s-item .llk-subj-emo')),'tema Happy dari V1 ikut dipakai (ikon emoji)');
  ok(!t.includes('0812'),'No HP ortu tidak pernah tampil');
  const btns=await M.evaluate(()=>[...document.querySelectorAll('.s-item')[0].querySelectorAll('.att-btn')].map(b=>b.getAttribute('aria-label')));
  ok(btns.join(',')==='Hadir,Alpa','tombol hanya Hadir & Alpa (tanpa Izin/Reschedule/Off/Kirim)');
  await M.screenshot({path:OUT+'t3_mitra_absensi.png'});

  console.log('\n[Mitra mengisi Hadir + progres]');
  await M.click('.s-item:has-text("Ayu Kinanthi") .s-avatar'); await sleep(300);
  await M.click('.s-item.expanded .att-btn.a-hadir'); await sleep(400);
  ok(await M.evaluate(()=>document.getElementById('noteOverlay').classList.contains('open')),'tombol Hadir membuka catatan kehadiran');
  await M.click('#noteSaveBtn'); await sleep(400);
  ok((await M.evaluate(()=>document.getElementById('noteMsg').innerText)).includes('Progres wajib'),'progres kosong ditolak');
  await M.fill('#noteProgress','Tiba-tiba 50%'); await M.fill('#notePrSiswa','Latihan pernapasan'); await M.fill('#notePrGuru','Siapkan minus one');
  await M.screenshot({path:OUT+'t3_mitra_catatan.png'});
  await M.click('#noteSaveBtn'); await sleep(1500);
  t=await txt(M);
  ok(t.includes('Tiba-tiba 50%')&&t.includes('PR: Latihan pernapasan'),'progres & PR tampil di kartu');
  ok(await M.evaluate(()=>document.querySelector('.stat-card.s-hadir .stat-num').textContent==='1'),'statistik Hadir = 1');
  await M.click('.s-item:has-text("Nauffal") .s-avatar'); await sleep(300);
  await M.click('.s-item.expanded .att-btn.a-alpa'); await sleep(300);
  await M.fill('#noteReason','Tidak datang tanpa kabar'); await M.click('#noteSaveBtn'); await sleep(1500);
  ok((await txt(M)).includes('Tidak datang tanpa kabar'),'Alpa + alasan tersimpan');

  console.log('\n[Admin: lihat progres & isi Izin]');
  await A.click('[data-tab=absensi]'); await sleep(1500);
  t=await txt(A);
  ok(t.includes('Tiba-tiba 50%')&&t.includes('HADIR')&&t.includes('ALPA')&&t.includes('Budi'),'Admin melihat absensi & progres dari Guru Mitra');
  await A.click('.ab-item:has-text("Hosyana") [data-izin]'); await sleep(300); await A.fill('#izReason','Sakit'); await A.click('#izGo'); await sleep(1500);
  ok((await txt(A)).includes('IZIN')&&(await txt(A)).includes('Sakit'),'Admin mengisi Izin Hosyana');
  await A.screenshot({path:OUT+'t3_admin_absensi.png'});
  // Kotak pilih guru di bawah kalender: hanya jadwal guru itu
  const nAll=await A.evaluate(()=>document.querySelectorAll('.ab-item').length);
  const gOpt=await A.evaluate(()=>[...document.querySelectorAll('#abGuruBar [data-guru]')].map(b=>b.dataset.guru).filter(v=>v&&v!=='none')[0]);
  await A.click(`#abGuruBar [data-guru="${gOpt}"]`); await sleep(1200);
  const gNm=await A.evaluate(v=>window.__llk.S.data.mitras.find(m=>m.id===v).name,gOpt);
  ok(await A.evaluate(nm=>{ const it=[...document.querySelectorAll('.ab-item')]; return it.length>0&&it.every(x=>x.querySelector('.ab-gtag').textContent.includes(nm)); },gNm)&&nAll>=(await A.evaluate(()=>document.querySelectorAll('.ab-item').length)),'pilih guru '+gNm+' (pilihan geser) → hanya jadwal siswa '+gNm);
  ok(await A.evaluate(()=>{ const t=document.querySelector('.ab-gtag'); const cs=getComputedStyle(t); return parseFloat(cs.borderTopWidth)>=2&&parseFloat(cs.fontSize)>=14; }),'nama guru di kartu: besar & berbingkai warna');
  await A.screenshot({path:OUT+'t3_admin_absensi_guru.png'});
  await A.click('#abGuruBar [data-guru=""]'); await sleep(1000);
  // Progres + Kirim WA ortu
  await A.click('.ab-item:has-text("Ayu") [data-prog]'); await sleep(1500);
  t=await A.evaluate(()=>document.querySelector('.modal').innerText);
  ok(t.includes('Tiba-tiba 50%')&&t.includes('Latihan pernapasan')&&/Pertemuan ke-1/.test(await A.$eval('#pgMsg',e=>e.value)),'tombol Progres: progres, PR & pesan WA (pertemuan ke-1)');
  if(!(await A.$eval('#pgSend',e=>e.disabled))){ await A.click('#pgSend'); const wa=await A.evaluate(()=>decodeURIComponent(window.__wa[window.__wa.length-1]||'')); ok(/wa\.me\/62/.test(wa)&&wa.includes('Tiba-tiba 50%'),'Kirim → WA ortu berisi progres'); }
  await A.screenshot({path:OUT+'t3_admin_progres.png'});
  await A.keyboard.press('Escape'); await A.evaluate(()=>{ const o=document.querySelector('.overlay.open, .overlay'); if(o) o.remove(); }); await sleep(300);
  // Kalender ala V1
  await A.click('#abCalBtn'); await sleep(1500);
  ok(await A.evaluate(()=>document.querySelectorAll('.acal-day').length>=28&&document.querySelectorAll('.acal-day.has-data').length>=1),'Kalender: tanggal yang ada absensinya diberi titik');
  await A.screenshot({path:OUT+'t3_admin_kalender.png'});
  await A.click('.acal-day.today'); await sleep(1200);
  ok(!(await A.$('.acal'))&&(await A.$$('.ab-item')).length===nAll,'tap tanggal di kalender → kembali ke daftar absensi tanggal itu');
  // Strip tanggal tetap: 7 hari lalu s/d 7 hari ke depan dari hari ini (tidak ikut bergeser)
  const stripOf=()=>A.evaluate(()=>[...document.querySelectorAll('#dayBar [data-date]')].map(b=>b.dataset.date));
  const dates=await A.evaluate(()=>{const f=d=>{const x=new Date();x.setDate(x.getDate()+d);return x.getFullYear()+'-'+String(x.getMonth()+1).padStart(2,'0')+'-'+String(x.getDate()).padStart(2,'0');};return {m7:f(-7),p7:f(7),z:f(0)};});
  const sh=(d)=>d===-7?dates.m7:d===7?dates.p7:dates.z;
  ok(await A.evaluate(()=>{const b=[...document.getElementById('dayBar').children];return b[0].id==='abCalBtnL'&&b[b.length-1].id==='abCalBtn'&&!!document.getElementById('abCalTop');}),'Admin: tombol Kalender di kedua ujung strip + pojok kanan atas (seperti V1)');
  let strip=await stripOf();
  ok(strip.length===15&&strip[0]===sh(-7)&&strip[14]===sh(7),'strip tanggal: 7 hari lalu s/d 7 hari ke depan ('+strip[0]+' … '+strip[14]+')');
  await A.click('#dayBar [data-date="'+sh(-7)+'"]'); await sleep(1200);
  strip=await stripOf();
  ok(strip[0]===sh(-7)&&strip[14]===sh(7)&&await A.evaluate(k=>document.querySelector('#dayBar [data-date="'+k+'"]').classList.contains('active'),sh(-7)),'pilih tanggal paling kiri → strip tidak bergeser lebih jauh');
  await A.click('#abCalBtn'); await sleep(1000); await A.click('.acal-nav[data-acal="-1"]'); await sleep(600); await A.click('.acal-nav[data-acal="-1"]'); await sleep(600);
  await A.click('.acal-day[data-aday] >> nth=9'); await sleep(1300);
  ok(await A.evaluate(()=>{const c=document.getElementById('abCalBtn');return c.classList.contains('active')&&/\d+ [A-Z][a-z]{2}/.test(c.innerText)&&!document.querySelector('#dayBar [data-date].active');}),'tanggal jauh dari kalender → tombol Kalender menampilkan tanggal itu');
  await A.screenshot({path:OUT+'t3_admin_strip.png'});
  await A.click('#dayBar [data-date="'+sh(0)+'"]'); await sleep(1200);
  await M.reload(); await sleep(3000);
  await M.click('.s-item:has-text("Hosyana") .s-avatar'); await sleep(300);
  t=await M.evaluate(()=>document.querySelector('.s-item.expanded').innerText);
  ok(t.includes('Izin')&&t.includes('Sakit')&&t.includes('diisi oleh Guru Admin'),'di HP Mitra: Hosyana Izin (terkunci, diisi Admin)');

  console.log('\n[Hari lain terkunci]');
  await M.click('#dayBar .date-pill.past >> nth=-1'); await sleep(500);
  await M.click('#dayBar .day-pill.active'); await sleep(200);
  const locked=await M.evaluate(()=>{ const it=document.querySelector('.s-item'); return !it || (!it.querySelector('.att-btn') && it.innerText.includes('minta tolong Guru Admin')); });
  ok(locked,'kemarin: tidak ada tombol absen (minta Admin)');

  console.log('\n[Track, Honor, Siswa]');
  await M.click('[data-tab=track]'); await sleep(400); t=await txt(M);
  ok(t.includes('Track Record')&&/Ayu Kinanthi[\s\S]*1\s*Hadir/.test(t),'Track: Ayu 1 Hadir');
  await M.click('.track-card:has-text("Ayu Kinanthi")'); await sleep(400); t=await txt(M);
  ok(t.includes('Riwayat Pertemuan')&&t.includes('Tiba-tiba 50%')&&t.includes('PR Guru: Siapkan minus one'),'profil murid: riwayat progres, PR & PR guru');
  await M.click('[data-tab=honor]'); await sleep(300); t=await txt(M);
  ok(t.includes('Rp 60.000')&&t.includes('2 sesi'),'Honor: Hadir + Alpa = 2 × Rp 30.000');
  await M.click('[data-tab=siswa]'); await sleep(300); t=await txt(M);
  ok(t.includes('4 siswa diajar')&&t.includes('Rere'),'Siswa: 4 murid yang ditugaskan');
  await M.screenshot({path:OUT+'t3_mitra_siswa.png'});
  await M.click('[data-tab=lainnya]'); await sleep(300);
  await M.click('.llk-theme-opt[data-theme="latte"]'); await sleep(300);
  ok(await M.evaluate(()=>!document.documentElement.getAttribute('data-theme')&&localStorage.getItem('llk_theme')==='latte'),'ganti tema dari Lainnya');
  await M.click('[data-tab=absensi]'); await sleep(400); await M.screenshot({path:OUT+'t3_mitra_absensi_latte.png'});
  // Track & Kalender ala V1 di aplikasi Guru Mitra
  ok(await M.evaluate(()=>{const b=[...document.getElementById('dayBar').children];return b[0].id==='calPillL'&&b[b.length-1].id==='calPill'&&!!document.getElementById('calTop')&&document.querySelectorAll('#dayBar [data-date]').length===15;}),'Guru Mitra: Kalender di kedua ujung strip + pojok kanan atas, strip 15 hari');
  await M.screenshot({path:OUT+'t3_guru_strip.png'});
  await M.click('#calPill'); await sleep(600);
  ok(M.url().includes('guru.html')&&await M.evaluate(()=>!!document.querySelector('.cal-grid')&&!!document.querySelector('.date-detail')),'Absensi → tombol Kalender membuka kalender bulanan + detail hari ini');
  ok(await M.evaluate(()=>document.querySelectorAll('.cal-day.has-data').length>=1),'kalender: tanggal yang ada catatan diberi titik');
  await M.screenshot({path:OUT+'t3_mitra_kalender.png',fullPage:true});
  await M.click('[data-mode=siswa]'); await sleep(400);
  t=await txt(M); ok(t.includes('Estimasi Honor')&&/Rp\s?[1-9]/.test(t),'Track: kartu estimasi honor seperti V1');
  await M.click('#projBtn'); await sleep(400); ok((await txt(M)).includes('Proyeksi Honor'),'Track: tombol proyeksi jika semua hadir');
  await M.click('[data-sf=alpa]'); await sleep(300); ok(await M.evaluate(()=>document.querySelectorAll('.track-card').length>=1),'Track: kotak Alpa bisa ditekan untuk menyaring');
  ok(await M.evaluate(()=>!!document.getElementById('trackSort')),'Track: urutkan (Terbaru / Izin / Alpa / Hadir / Nama)');
  await M.screenshot({path:OUT+'t3_mitra_track.png',fullPage:true});
  await M.click('[data-tab=absensi]'); await sleep(400);

  const D=await dev({uid:'t3budi',email:'budi3@x.com'},{w:1366,h:820,theme:'happy'});
  await D.goto(URL+'guru.html'); await sleep(3000);
  ok(await D.evaluate(()=>{const n=document.querySelector('.bottom-nav').getBoundingClientRect(); return n.height>500&&n.width<320;}),'PC: menu jadi sidebar seperti V1');
  await D.screenshot({path:OUT+'t3_mitra_pc.png'});

  const errs=[A,M,D].flatMap(p=>p.errs); ok(errs.length===0,'tidak ada error JavaScript'+(errs.length?': '+errs.join(' | '):''));
  console.log(`\nHASIL: ${pass} lulus, ${fail} gagal`); await b.close(); process.exit(fail?1:0);
})().catch(e=>{console.error(e);process.exit(2);});
