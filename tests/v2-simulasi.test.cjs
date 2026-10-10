// SIMULASI pemilik: Rani (pengguna LLK V1, 30 murid) kewalahan → minta tolong
// Pak Dimas & Bu Sari. Aplikasi Admin 1 (Rani, khusus administrasi) + aplikasi
// Guru Mitra 3 (Rani sendiri, Pak Dimas, Bu Sari). Di HP Rani ada 2 aplikasi.
// Alur: V1 → LLK Lembaga → daftar → "Saya juga mengajar" → undang 2 guru →
// impor 30 murid V1 → bagi 10/10/10 → cek tiap aplikasi.
const { chromium } = require('playwright'); const fs=require('fs');
const { initializeTestEnvironment } = require('@firebase/rules-unit-testing');
const { doc, getDoc, updateDoc, Timestamp } = require('firebase/firestore');
const FB=__dirname+'/node_modules/firebase/';
const OUT=__dirname+'/out/'; fs.mkdirSync(OUT,{recursive:true});
let pass=0,fail=0; const ok=(c,m)=>{c?pass++:fail++;console.log((c?'  ✅ ':'  ❌ ')+m);};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const DAYS_JS=['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
const TODAY=DAYS_JS[new Date(Date.now()+7*3600e3).getUTCDay()];
// 30 murid V1: 1 guru, jadwal Senin–Sabtu 13:00–20:00 tanpa bentrok
const NAMES=['Ayu Kinanthi','Nauffal','Andaru','Hosyana','Sang Fajar','Rakawening','Natasya','Brilian','Bagas','Senandung','Rafassya','Syalenka','Rosyid','Keana','Arsyla','Azkhana','Bima','Cahaya','Dafa','Elang','Farel','Gendis','Hana','Ilham','Jovan','Kirana','Laras','Mahesa','Nadin','Orion'];
const INST=['Vokal','Piano','Piano','Gitar','Gitar','Gitar','Piano','Gitar','Piano','Gitar','Piano','Piano','Piano','Vokal','Piano','Drum','Gitar','Vokal','Drum','Gitar','Piano','Vokal','Piano','Gitar','Drum','Vokal','Piano','Gitar','Biola','Piano'];
const SLOT=['13:00','13:45','14:30','15:15','16:00','16:45','17:30','18:15','19:00'];
const add45=t=>{const [h,m]=t.split(':').map(Number);const x=h*60+m+45;return String(Math.floor(x/60)).padStart(2,'0')+':'+String(x%60).padStart(2,'0');};
const V1=NAMES.map((n,i)=>{ const day=['Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'][i%6]; const t=SLOT[Math.floor(i/6)%SLOT.length];
  return {name:n,instrument:INST[i],day,time:t,time2:add45(t),rate:INST[i]==='Piano'?50000:45000,phone:'08123'+String(100000+i),extraDates:[],payCycle:4}; });
// 1 murid dengan 2 hari les (hari ke-2 di slot yang belum dipakai)
V1[1].day2='Kamis'; V1[1].time2a='19:45'; V1[1].time2b='20:30';
(async()=>{
  const b=await chromium.launch({executablePath:process.env.CHROME_PATH||undefined});
  async function dev(user,{w=390,h=844,v1=null}={}){
    const ctx=await b.newContext({viewport:{width:w,height:h},serviceWorkers:'block',timezoneId:'Asia/Jakarta'});
    await ctx.route('**/*',r=>{const u=r.request().url();
      if(u.startsWith('http://localhost')||u.startsWith('http://127.0.0.1')) return r.continue();
      const m=u.match(/firebasejs\/10\.14\.1\/(firebase-[a-z]+\.js)$/); if(m) return r.fulfill({contentType:'text/javascript',body:fs.readFileSync(FB+m[1],'utf8')});
      return r.abort();});
    await ctx.addInitScript(([u,v1])=>{ window.__LLK_TEST__={host:'127.0.0.1',port:8089,user:u}; window.__wa=[]; window.open=(x)=>{window.__wa.push(x);return null;};
      if(v1&&!localStorage.getItem('rms4_s')){ localStorage.setItem('rms4_s',JSON.stringify(v1)); localStorage.setItem('llk_theme','happy'); } },[user,v1]);
    const p=await ctx.newPage(); p.errs=[]; p.on('pageerror',e=>p.errs.push(e.message)); p.on('dialog',d=>d.accept());
    return p;
  }
  const txt=p=>p.evaluate(()=>document.body.innerText);
  const BASE=(process.env.BASE_URL||'http://localhost:8765');
  const URL=BASE+'/v2/';

  console.log('\n[1] Rani memakai LLK V1 dengan 30 murid');
  const A=await dev({uid:'simRani',email:'rani@gmail.com',displayName:'Rani'},{w:1440,h:900,v1:V1});
  await A.goto(BASE+'/'); await sleep(2500);
  await A.evaluate(()=>{ const g=document.getElementById('loginGate'); if(g) g.style.display='none'; setTab('lainnya'); });
  await sleep(500);
  let t=await txt(A);
  ok(t.includes('Semua Murid (30)'),'V1: 30 murid');
  ok(t.includes('Punya guru lain? LLK Lembaga'),'V1 → menu "Punya guru lain? LLK Lembaga" ada di Lainnya');
  await A.screenshot({path:OUT+'sim1_v1_lainnya.png'});
  await A.click('text=Punya guru lain? LLK Lembaga'); await A.waitForURL(/\/v2\//); await A.waitForSelector('#rcLembaga',{timeout:15000});
  ok(A.url().includes('/v2/'),'menu itu membuka LLK Lembaga (V2)');
  const v1After=await A.evaluate(()=>JSON.parse(localStorage.getItem('rms4_s')||'[]').length);

  console.log('\n[2] Daftar lembaga (aplikasi Admin)');
  await A.click('#rcLembaga'); await sleep(400); await A.fill('#coName','Les Musik Rani'); await A.click('#coGo'); await sleep(2000);
  t=await txt(A);
  ok(t.includes('GURU ADMIN')&&t.includes('0 / 2'),'lembaga dibuat · uji coba 2 slot Guru Mitra (0/2)');
  ok(!(await A.evaluate(()=>[...document.querySelectorAll('.bnav')].some(b=>/Mengajar/.test(b.textContent)))),'aplikasi Admin tanpa menu mengajar (khusus administrasi)');
  const RG=await dev({uid:'simRani',email:'rani@gmail.com'});
  await RG.goto(URL+'guru.html'); await sleep(3000);
  ok((await txt(RG)).includes('Kamu Guru Admin')&&(await txt(RG)).includes('Saya juga mengajar'),'aplikasi Guru di HP Rani: belum terdaftar mengajar → diarahkan');

  const env=await initializeTestEnvironment({projectId:'llk-67a30',firestore:{host:'127.0.0.1',port:8089,rules:fs.readFileSync(__dirname+'/../firestore.rules','utf8')}});
  // Rani berlangganan Paket Mulai Rp200.000 + 1 slot Rp100.000 = Rp300.000 (3 Guru Mitra: Rani, Dimas, Sari).
  // Pembayaran Midtrans diuji di v2-langganan.test.cjs; di sini cukup hasil aktivasinya.
  const ORGID=await A.evaluate(()=>window.__llk.S.org.id);
  await env.withSecurityRulesDisabled(async c=>{ await updateDoc(doc(c.firestore(),'orgs',ORGID),{seats:3,plan:'pro',period:'monthly',activeUntil:Timestamp.fromMillis(Date.now()+30*864e5)}); });
  await A.reload(); await sleep(2500);
  ok((await txt(A)).includes('0 / 3'),'Rani berlangganan Rp 300.000 → 3 slot Guru Mitra (0/3)');
  console.log('\n[2b] Rani mendaftar "Saya juga mengajar" (memakai 1 slot)');
  await A.click('#selfTeach'); await sleep(300); await A.fill('#stHonor','0'); await A.click('#stGo'); await sleep(2000);
  t=await txt(A);
  ok(t.includes('Kamu terdaftar sebagai guru')&&t.includes('guru.html')&&t.includes('LLK Guru'),'petunjuk pasang aplikasi Guru Mitra di HP Rani');
  await A.screenshot({path:OUT+'sim2_saya_mengajar.png'});
  await A.click('#gaClose'); await sleep(800);
  t=await txt(A); ok(t.includes('1 / 3')&&t.includes('ANDA'),'Rani tampil di daftar guru, memakai 1 slot (1/3)');

  console.log('\n[3] Mendaftarkan 2 guru baru');
  const invite=async(n,email)=>{ await A.click('#addMitra'); await A.fill('#amName',n); await A.fill('#amHonor','35000'); await A.fill('#amEmail',email); await A.click('#amGo'); await sleep(1300);
    const c=await A.evaluate(()=>document.querySelector('.modal .code-box').textContent.trim()); await A.click('#icWa'); await A.click('#icClose'); await sleep(700); return c; };
  const c1=await invite('Pak Dimas','dimas@gmail.com'), c2=await invite('Bu Sari','sari@gmail.com');
  ok(/^LLK-/.test(c1)&&/^LLK-/.test(c2)&&(await A.evaluate(()=>window.__wa.length))===2,'2 kode undangan dibuat & dikirim lewat WA');
  await A.screenshot({path:OUT+'sim3_undangan.png'});
  const D=await dev({uid:'simDimas',email:'dimas@gmail.com',displayName:'Dimas'});
  const Sr=await dev({uid:'simSari',email:'sari@gmail.com',displayName:'Sari'});
  for(const [P,c] of [[D,c1],[Sr,c2]]){ await P.goto(URL+'?kode='+c); await sleep(2500); await P.click('#jJoin'); await sleep(3000); }
  ok(D.url().includes('guru.html')&&Sr.url().includes('guru.html'),'kedua guru bergabung & masuk tampilan guru');
  await A.click('[data-tab=guru]'); await sleep(1500);
  t=await txt(A); ok(t.includes('3 / 3')&&t.includes('Pak Dimas')&&t.includes('Bu Sari')&&t.includes('Guru Mitra aktif (3)'),'3 Guru Mitra: Rani, Pak Dimas, Bu Sari — slot 3/3');
  await A.screenshot({path:OUT+'sim3_guru.png'});

  console.log('\n[4] Salin 30 murid dari V1');
  await A.click('[data-tab=murid]'); await sleep(1500);
  await A.click('#impV1'); await sleep(500);
  await A.check('#ivAll'); await sleep(300);
  t=await A.evaluate(()=>document.getElementById('ivPlan').innerText);
  ok(t.includes('30 murid')&&t.includes('Piano')&&t.includes('Gitar')&&t.includes('Vokal'),'30 murid siap diimpor · pelajaran dibuat otomatis');
  await A.screenshot({path:OUT+'sim4_impor.png'});
  await A.click('#ivGo'); await sleep(4000);
  t=await txt(A); ok(t.includes('30 siswa aktif')&&t.includes('30 kelas belum ada guru'),'30 murid masuk, semua belum ada guru');
  const gurus=await A.evaluate(()=>[...document.querySelectorAll('#bkGuru option, #fGuru option')].map(o=>o.textContent));
  ok(gurus.includes('Rani (Anda)')&&gurus.includes('Pak Dimas')&&gurus.includes('Bu Sari'),'pilihan guru: Rani (Anda), Pak Dimas, Bu Sari');

  console.log('\n[5] Bagi murid 10 / 10 / 10');
  const assign=async(from,to,label)=>{
    await A.evaluate(([from,to])=>{ const cs=[...document.querySelectorAll('[data-sel]')].slice(from,to); cs.forEach(c=>{c.checked=true;c.dispatchEvent(new Event('change'));}); },[from,to]);
    await sleep(300);
    if(from===0) await A.screenshot({path:OUT+'sim5_siswa_laptop.png'});
    await A.selectOption('#bkGuru',{label}); await A.click('#bkGo'); await sleep(3500);
  };
  const adminLabel='Rani (Anda)';
  await assign(0,10,adminLabel);
  await A.screenshot({path:OUT+'sim5_bagi.png'});
  await assign(10,20,'Pak Dimas'); await assign(20,30,'Bu Sari');
  t=await txt(A);
  ok(t.includes('30 siswa aktif')&&!t.includes('belum ada guru'),'semua 30 murid sudah punya guru');
  const per=await A.evaluate(()=>{ const S=window.__llk.S, c={}; S.data.students.forEach(st=>st.classes.forEach(k=>{ const g=S.data.mitras.find(m=>m.id===k.mitraUid); c[g?g.name:'?']=(c[g?g.name:'?']||0)+1; })); return c; });
  ok(Object.values(per).every(n=>n===10)&&Object.keys(per).length===3,'pembagian: '+JSON.stringify(per));
  await A.click('[data-view=jadwal]'); await sleep(600);
  t=await txt(A);
  ok(!t.includes('BENTROK'),'Jadwal Mingguan: tidak ada jadwal bentrok');
  const rekap=(t.match(/[A-Za-z ()]+ · \d+ sesi\/minggu/g)||[]).map(x=>x.trim());
  ok(rekap.length===3&&rekap.reduce((n,x)=>n+ +x.match(/(\d+) sesi/)[1],0)===31,'rekap sesi per guru (31 sesi = 30 murid + 1 murid 2 hari): '+rekap.join(' | '));
  await A.screenshot({path:OUT+'sim5_jadwal_mingguan.png'});

  console.log('\n[6] Tampilan masing-masing guru');
  const names=await A.evaluate(()=>{ const S=window.__llk.S, o={}; S.data.students.forEach(st=>{ const g=S.data.mitras.find(m=>m.id===st.classes[0].mitraUid); (o[g.name]=o[g.name]||[]).push(st.name); }); return o; });
  for(const [P,label] of [[D,'Pak Dimas'],[Sr,'Bu Sari']]){
    await P.reload(); await sleep(3000); await P.click('[data-tab=siswa]'); await sleep(400);
    t=await txt(P);
    const mine=names[label], others=Object.entries(names).filter(([k])=>k!==label).flatMap(([,v])=>v);
    ok(t.includes('10 siswa diajar')&&mine.every(n=>t.includes(n))&&!others.some(n=>t.includes(n)),label+': hanya 10 muridnya sendiri');
    ok(!/08123\d/.test(t),label+': No HP ortu tidak terlihat');
    await P.click('[data-tab=absensi]'); await sleep(400);
  }
  await D.screenshot({path:OUT+'sim6_dimas_absensi.png'}); await D.click('[data-tab=siswa]'); await sleep(300); await D.screenshot({path:OUT+'sim6_dimas_siswa.png'});

  console.log('\n[7] HP Rani: aplikasi Guru Mitra untuk 10 muridnya');
  await RG.reload(); await sleep(3000);
  t=await txt(RG);
  ok(RG.url().includes('guru.html')&&t.includes('Absensi Harian')&&t.includes('Rani · Guru Mitra'),'aplikasi Guru Mitra Rani terbuka seperti V1');
  await RG.click('[data-tab=siswa]'); await sleep(400); t=await txt(RG);
  ok(t.includes('10 siswa diajar')&&names[adminLabel].every(n=>t.includes(n)),'Rani melihat 10 murid miliknya');
  await RG.click('[data-tab=absensi]'); await sleep(400);
  if(await RG.evaluate(()=>document.querySelectorAll('.s-item').length)){
    await RG.evaluate(()=>document.querySelector('.s-item .s-avatar').click()); await sleep(300);
    const lbl=await RG.evaluate(()=>[...document.querySelectorAll('.s-item.expanded .att-btn')].map(b=>b.getAttribute('aria-label')).join(','));
    ok(lbl==='Hadir,Alpa','Rani sebagai Guru Mitra: tombol Hadir & Alpa (sama dengan guru lain)');
    await RG.click('.s-item.expanded .att-btn.a-hadir'); await sleep(300); await RG.fill('#noteProgress','Tangga nada C mayor'); await RG.click('#noteSaveBtn'); await sleep(1500);
    ok((await txt(RG)).includes('Tangga nada C mayor'),'Rani mengisi Hadir + progres di aplikasi Guru');
    await A.click('[data-tab=absensi]'); await sleep(1500);
    ok((await txt(A)).includes('Tangga nada C mayor'),'progres Rani terlihat di aplikasi Admin (tab Absensi)');
  } else ok(true,'(hari ini tidak ada jadwal murid Rani — dilewati)');
  await RG.screenshot({path:OUT+'sim7_rani_guru.png'});
  await RG.click('[data-tab=lainnya]'); await sleep(300);
  ok((await txt(RG)).includes('Buka Aplikasi Admin')&&!(await txt(RG)).includes('Keluar dari'),'Lainnya (Rani): tautan ke aplikasi Admin, tanpa "Keluar dari lembaga"');

  console.log('\n[7b] Admin di HP: tab Siswa ala V1, centang semua siswa Piano → pindah ke Bu Sari');
  const AM=await dev({uid:'simRani',email:'rani@gmail.com',displayName:'Rani'},{w:390,h:844});
  await AM.goto(URL); await sleep(3000);
  t=await txt(AM);
  ok(/GURU ADMIN/.test(t)&&await AM.evaluate(()=>getComputedStyle(document.querySelector('.h-badge'),'::after').animationName==='hbShine'),'lencana GURU ADMIN berbingkai & berkilau');
  ok(t.includes('Siswa')&&!(await AM.evaluate(()=>[...document.querySelectorAll('.bnav')].some(b=>b.textContent.trim()==='Murid'))),'menu "Murid" berganti "Siswa"');
  await AM.click('[data-tab=murid]'); await sleep(1500);
  ok(await AM.evaluate(()=>document.querySelectorAll('.stu-card .track-avatar').length===30&&!document.querySelector('table.tbl')),'HP: 30 kartu siswa ala V1 (ikon pelajaran), bukan tabel');
  await AM.selectOption('#fSubj',{label:'Piano'}); await sleep(300);
  const nPiano=await AM.evaluate(()=>document.querySelectorAll('.stu-card').length);
  const before=await AM.evaluate(()=>{ const S=window.__llk.S, sid=S.data.subjects.find(x=>x.name==='Piano').id; const o={}; S.data.students.forEach(st=>st.classes.forEach(k=>{ o[st.id+'|'+k.subjectId]={p:k.subjectId===sid,g:k.mitraUid}; })); return o; });
  await AM.click('.sel-all'); await sleep(300);
  t=await txt(AM); ok(nPiano>0&&t.includes(nPiano+' siswa dipilih')&&t.includes('Tugaskan kelas Piano'),'centang semua: '+nPiano+' siswa Piano terpilih sekaligus');
  await AM.screenshot({path:OUT+'sim7b_siswa_hp.png'});
  await AM.selectOption('#bkGuru',{label:'Bu Sari'}); await AM.click('#bkGo'); await sleep(3500);
  const after=await AM.evaluate(()=>{ const S=window.__llk.S, sari=S.data.mitras.find(m=>m.name==='Bu Sari').id; const o={}; S.data.students.forEach(st=>st.classes.forEach(k=>{ o[st.id+'|'+k.subjectId]={g:k.mitraUid,sari:k.mitraUid===sari}; })); return o; });
  ok(Object.keys(before).every(k=>before[k].p?after[k].sari:after[k].g===before[k].g),'hanya kelas Piano yang pindah ke Bu Sari; pelajaran lain tetap pada gurunya');
  // Filter "Belum punya guru": jadikan 2 kelas tanpa guru, lalu tugaskan sekaligus
  const ORG2=await AM.evaluate(()=>window.__llk.S.org.id);
  const two=await AM.evaluate(()=>window.__llk.S.data.students.slice(0,2).map(s=>s.id));
  await env.withSecurityRulesDisabled(async c=>{ const db2=c.firestore(); for(const id of two){ const r=doc(db2,'orgs',ORG2,'students',id); const sn=await getDoc(r); await updateDoc(r,{classes:sn.data().classes.map(k=>Object.assign({},k,{mitraUid:null}))}); } });
  await AM.reload(); await sleep(2500); await AM.click('[data-tab=murid]'); await sleep(1500);
  t=await txt(AM); ok(/Belum punya guru\s*2/.test(t),'tombol filter "Belum punya guru (2)"');
  await AM.click('[data-chip=none]'); await sleep(300);
  ok(await AM.evaluate(()=>document.querySelectorAll('.stu-card').length===2&&document.getElementById('fGuru').value==='none'),'filter Belum punya guru: tampil 2 siswa');
  await AM.click('.sel-all'); await sleep(200); await AM.selectOption('#bkGuru',{label:'Pak Dimas'}); await AM.click('#bkGo'); await sleep(3500);
  t=await txt(AM); ok(/Belum punya guru\s*0/.test(t)&&!t.includes('kelas belum ada guru'),'2 siswa ditugaskan ke Pak Dimas → tidak ada lagi yang belum punya guru');
  await AM.screenshot({path:OUT+'sim7b_belum_guru.png'});
  ok(AM.errs.length===0,'tidak ada error JavaScript di aplikasi Admin (HP)'+(AM.errs.length?': '+AM.errs.join(' | '):''));

  console.log('\n[8] Data V1 tetap utuh');
  await A.goto(BASE+'/'); await sleep(1500);
  ok((await A.evaluate(()=>JSON.parse(localStorage.getItem('rms4_s')||'[]').length))===30&&v1After===30,'LLK V1 masih 30 murid (tidak berubah)');

  const errs=[D,Sr,RG].flatMap(p=>p.errs); ok(errs.length===0,'tidak ada error JavaScript di V2'+(errs.length?': '+errs.join(' | '):''));
  console.log(`\nHASIL: ${pass} lulus, ${fail} gagal`); await b.close(); await env.cleanup(); process.exit(fail?1:0);
})().catch(e=>{console.error(e);process.exit(2);});
