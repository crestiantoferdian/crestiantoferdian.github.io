// SIMULASI pemilik: pengguna LLK V1 dengan 30 murid → buka LLK Lembaga (V2) →
// daftar lembaga → undang 2 Guru Mitra → impor murid V1 → bagi 10/10/10
// (Admin ikut mengajar 10) → cek tampilan tiap guru.
const { chromium } = require('playwright'); const fs=require('fs');
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

  console.log('\n[1] Pemilik memakai LLK V1 dengan 30 murid');
  const A=await dev({uid:'simOwner',email:'pemilik@rms.com',displayName:'Ferdian'},{w:1440,h:900,v1:V1});
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

  console.log('\n[2] Daftar lembaga (jadi Guru Admin)');
  await A.click('#rcLembaga'); await sleep(400); await A.fill('#coName','Rytmic Music School'); await A.click('#coGo'); await sleep(2000);
  ok((await txt(A)).includes('GURU ADMIN')&&(await txt(A)).includes('0 / 5'),'lembaga dibuat · kursi Guru Mitra 0/5');

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
  t=await txt(A); ok(t.includes('2 / 5')&&t.includes('Pak Dimas')&&t.includes('Bu Sari'),'Admin: 2 Guru Mitra aktif (2/5)');

  console.log('\n[4] Salin 30 murid dari V1');
  await A.click('[data-tab=murid]'); await sleep(1500);
  await A.click('#impV1'); await sleep(500);
  await A.check('#ivAll'); await sleep(300);
  t=await A.evaluate(()=>document.getElementById('ivPlan').innerText);
  ok(t.includes('30 murid')&&t.includes('Piano')&&t.includes('Gitar')&&t.includes('Vokal'),'30 murid siap diimpor · pelajaran dibuat otomatis');
  await A.screenshot({path:OUT+'sim4_impor.png'});
  await A.click('#ivGo'); await sleep(4000);
  t=await txt(A); ok(t.includes('30 murid aktif')&&t.includes('30 kelas belum ada guru'),'30 murid masuk, semua belum ada guru');
  const gurus=await A.evaluate(()=>[...document.querySelectorAll('#bkGuru option, #fGuru option')].map(o=>o.textContent));
  ok(gurus.some(x=>x.includes('(Admin)'))&&gurus.includes('Pak Dimas')&&gurus.includes('Bu Sari'),'pilihan guru: Admin sendiri + Pak Dimas + Bu Sari');

  console.log('\n[5] Bagi murid 10 / 10 / 10');
  const assign=async(from,to,label)=>{
    await A.evaluate(([from,to])=>{ const cs=[...document.querySelectorAll('[data-sel]')].slice(from,to); cs.forEach(c=>{c.checked=true;c.dispatchEvent(new Event('change'));}); },[from,to]);
    await sleep(300);
    await A.selectOption('#bkGuru',{label}); await A.click('#bkGo'); await sleep(3500);
  };
  const adminLabel=gurus.find(x=>x.includes('(Admin)'));
  await assign(0,10,adminLabel);
  await A.screenshot({path:OUT+'sim5_bagi.png'});
  await assign(10,20,'Pak Dimas'); await assign(20,30,'Bu Sari');
  t=await txt(A);
  ok(t.includes('30 murid aktif')&&!t.includes('belum ada guru'),'semua 30 murid sudah punya guru');
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

  console.log('\n[7] Admin juga mengajar 10 murid (menu Mengajar)');
  await A.click('[data-tab=mengajar]'); await A.waitForURL(/guru\.html/); await sleep(3000);
  t=await txt(A);
  ok(t.includes('Guru Admin (mengajar)')&&t.includes('Absensi Harian'),'menu Mengajar membuka tampilan guru (sama dengan V1)');
  await A.click('[data-tab=siswa]'); await sleep(400); t=await txt(A);
  ok(t.includes('10 siswa diajar')&&names[adminLabel].every(n=>t.includes(n)),'Admin melihat 10 murid miliknya');
  await A.click('[data-tab=absensi]'); await sleep(400);
  const todayMine=await A.evaluate(()=>document.querySelectorAll('.s-item').length);
  if(todayMine){
    await A.evaluate(()=>document.querySelector('.s-item .s-avatar').click()); await sleep(300);
    const lbl=await A.evaluate(()=>[...document.querySelectorAll('.s-item.expanded .att-btn')].map(b=>b.getAttribute('aria-label')).join(','));
    ok(lbl==='Hadir,Izin,Alpa','Admin (mengajar): tombol Hadir, Izin, Alpa');
    await A.click('.s-item.expanded .att-btn.a-hadir'); await sleep(300); await A.fill('#noteProgress','Tangga nada C mayor'); await A.click('#noteSaveBtn'); await sleep(1500);
    ok((await txt(A)).includes('Tangga nada C mayor'),'Admin mengisi Hadir + progres muridnya sendiri');
  } else ok(true,'(hari ini tidak ada jadwal murid Admin — dilewati)');
  await A.screenshot({path:OUT+'sim7_admin_mengajar.png'});
  await A.click('#tab-honor'); await A.waitForURL(/\/v2\/(\?.*)?$/); await sleep(2500);
  ok((await txt(A)).includes('GURU ADMIN'),'tombol "Panel Admin" kembali ke panel Admin');

  console.log('\n[8] Data V1 tetap utuh');
  await A.goto(BASE+'/'); await sleep(1500);
  ok((await A.evaluate(()=>JSON.parse(localStorage.getItem('rms4_s')||'[]').length))===30&&v1After===30,'LLK V1 masih 30 murid (tidak berubah)');

  const errs=[D,Sr].flatMap(p=>p.errs); ok(errs.length===0,'tidak ada error JavaScript di V2'+(errs.length?': '+errs.join(' | '):''));
  console.log(`\nHASIL: ${pass} lulus, ${fail} gagal`); await b.close(); process.exit(fail?1:0);
})().catch(e=>{console.error(e);process.exit(2);});
