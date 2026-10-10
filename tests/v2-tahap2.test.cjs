// Uji V2 Tahap 2: mata pelajaran, murid multi-kelas, jadwal mingguan, impor V1,
// dan Guru Mitra hanya melihat jadwal miliknya (tanpa No HP / tarif).
const { chromium } = require('playwright'); const fs=require('fs');
const FB=__dirname+'/node_modules/firebase/';
const OUT=__dirname+'/out/'; fs.mkdirSync(OUT,{recursive:true});
let pass=0,fail=0; const ok=(c,m)=>{c?pass++:fail++;console.log((c?'  ✅ ':'  ❌ ')+m);};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const V1=[
  {name:'Kenzo',instrument:'Piano',day:'Senin',time:'14:00',time2:'15:00',day2:'Kamis',time2a:'16:00',time2b:'17:00',rate:50000,phone:'0811'},
  {name:'Lala',instrument:'vokal',day:'Selasa',time:'15:00',time2:'16:00',rate:45000},
  {name:'Mika',instrument:'Biola',day:'Rabu',time:'10:00',time2:'11:00',rate:60000},
  {name:'Nina',instrument:'Biola',day:'',time:'',rate:60000},
  {name:'Omar',instrument:'Gitar',day:'Jumat',time:'13:00',rate:40000,inactive:true},
];
(async()=>{
  const b=await chromium.launch({executablePath:process.env.CHROME_PATH||undefined});
  async function dev(user,{w=390,h=844,v1=null}={}){
    const ctx=await b.newContext({viewport:{width:w,height:h},serviceWorkers:'block'});
    await ctx.route('**/*',r=>{const u=r.request().url();
      if(u.startsWith('http://localhost')||u.startsWith('http://127.0.0.1')) return r.continue();
      const m=u.match(/firebasejs\/10\.14\.1\/(firebase-[a-z]+\.js)$/); if(m) return r.fulfill({contentType:'text/javascript',body:fs.readFileSync(FB+m[1],'utf8')});
      return r.abort();});
    await ctx.addInitScript(([u,v1])=>{ window.__LLK_TEST__={host:'127.0.0.1',port:8089,user:u}; window.open=()=>null; if(v1) localStorage.setItem('rms4_s',JSON.stringify(v1)); },[user,v1]);
    const p=await ctx.newPage(); p.errs=[]; p.on('pageerror',e=>p.errs.push(e.message)); p.on('dialog',d=>d.accept());
    return p;
  }
  const txt=p=>p.evaluate(()=>document.body.innerText);
  const URL=(process.env.BASE_URL||'http://localhost:8765')+'/v2/';
  const ORG='Rytmic Music School '+Date.now()%100000;

  console.log('\n[Persiapan: lembaga + 2 Guru Mitra]');
  const A=await dev({uid:'t2admin',email:'owner@rms.com',displayName:'Pemilik'},{w:1440,h:900,v1:V1});
  await A.goto(URL); await A.waitForSelector('#rcLembaga',{timeout:15000});
  await A.click('#rcLembaga'); await sleep(400); await A.fill('#coName',ORG); await A.click('#coGo'); await sleep(2000);
  const codes=[];
  for(const [n,h] of [['Budi',30000],['Sinta',30000]]){ await A.click('#addMitra'); await A.fill('#amName',n); await A.fill('#amHonor',String(h)); await A.click('#amGo'); await sleep(1300); codes.push(await A.evaluate(()=>document.querySelector('.modal .code-box').textContent.trim())); await A.click('#icClose'); await sleep(800); }
  const Mb=await dev({uid:'t2budi',email:'budi@x.com'}); await Mb.goto(URL+'?kode='+codes[0]); await sleep(2500); await Mb.click('#jJoin'); await sleep(2000);
  const Ms=await dev({uid:'t2sinta',email:'sinta@x.com'}); await Ms.goto(URL+'?kode='+codes[1]); await sleep(2500); await Ms.click('#jJoin'); await sleep(2000);
  await Mb.click('[data-tab=siswa]'); await sleep(300);
  ok((await txt(Mb)).includes('Belum ada murid'),'Mitra baru: daftar Siswa kosong');

  console.log('\n[Mata Pelajaran]');
  await A.reload(); await sleep(2500); await A.click('[data-tab=murid]'); await sleep(1500);
  ok((await txt(A)).includes('Mulai dari Mata Pelajaran') && await A.evaluate(()=>document.getElementById('addStu').disabled),'belum ada pelajaran → diarahkan ke Mata Pelajaran');
  await A.click('#goPel'); await sleep(400);
  for(const [n,r] of [['Piano','50000'],['Gitar','45000'],['Vokal','45000']]){ await A.click('#addSubj'); await A.fill('#pjName',n); await A.fill('#pjRate',r); await A.click('#pjGo'); await sleep(1300); }
  let t=await txt(A); ok(t.includes('Piano')&&t.includes('Rp 50.000')&&t.includes('Gitar')&&t.includes('Vokal'),'3 pelajaran + tarif standar tersimpan');
  await A.click('#addSubj'); await A.fill('#pjName','piano'); await A.fill('#pjRate','1'); await A.click('#pjGo'); await sleep(300);
  ok((await txt(A)).includes('sudah ada'),'nama pelajaran kembar ditolak'); await A.evaluate(()=>document.getElementById('pjNo').click());

  console.log('\n[Tambah murid 2 kelas, beda guru]');
  await A.click('[data-view=daftar]'); await sleep(400);
  await A.click('#addStu'); await sleep(300);
  await A.fill('#sfName','Brilian'); await A.fill('#sfParent','Bu Ani'); await A.fill('#sfPhone','081234567');
  const pick=(sel,label)=>A.evaluate(([sel,label])=>{const s=document.querySelector(sel); const o=[...s.options].find(o=>o.textContent===label); s.value=o.value; s.dispatchEvent(new Event('change'));},[sel,label]);
  await pick('select[data-c="0"][data-k="subjectId"]','Piano'); await sleep(100);
  await pick('select[data-c="0"][data-k="mitraUid"]','Budi');
  await A.fill('input[data-c="0"][data-s="0"][data-k="start"]','14:00'); await A.fill('input[data-c="0"][data-s="0"][data-k="end"]','15:00');
  await A.click('#sfAddClass'); await sleep(200);
  await pick('select[data-c="1"][data-k="subjectId"]','Vokal'); await sleep(100);
  await pick('select[data-c="1"][data-k="mitraUid"]','Sinta');
  await A.fill('input[data-c="1"][data-k="rate"]','40000');
  ok(await A.evaluate(()=>document.querySelector('.modal').innerText.includes('Kelas rutin yang diikuti')&&document.querySelectorAll('.add-day-wrap .add-day-btn').length===2),'form siswa: judul "Kelas rutin yang diikuti" + tombol Tambah hari di tengah berbingkai');
  await A.screenshot({path:OUT+'t2_form_siswa.png'});
  await pick('select[data-c="1"][data-s="0"][data-k="day"]','Rabu');
  await A.fill('input[data-c="1"][data-s="0"][data-k="start"]','16:00');
  await A.screenshot({path:OUT+'t2_form.png'});
  await A.click('#sfGo'); await sleep(1800);
  t=await txt(A);
  ok(t.includes('Brilian')&&t.includes('Bu Ani')&&t.includes('081234567'),'murid tampil di tabel (ortu + No HP terlihat Admin)');
  ok(t.includes('Rp 50.000')&&t.includes('Rp 40.000')&&t.includes('KHUSUS'),'tarif standar Piano & tarif khusus Vokal');
  ok(/Sen 14:00–15:00/.test(t)&&/Rab 16:00/.test(t),'jadwal 2 kelas tampil');
  // murid kedua bentrok dengan Budi
  await A.click('#addStu'); await sleep(300); await A.fill('#sfName','Cici');
  await pick('select[data-c="0"][data-k="subjectId"]','Gitar'); await sleep(100); await pick('select[data-c="0"][data-k="mitraUid"]','Budi');
  await A.fill('input[data-c="0"][data-s="0"][data-k="start"]','14:30'); await A.click('#sfGo'); await sleep(1600);
  await A.click('#addStu'); await sleep(300); await A.fill('#sfName','brilian'); await A.fill('input[data-c="0"][data-s="0"][data-k="start"]','10:00'); await A.click('#sfGo'); await sleep(400);
  ok((await txt(A)).includes('Sudah ada murid bernama'),'nama murid kembar ditolak'); await A.evaluate(()=>document.getElementById('sfNo').click());
  await A.click('#addStu'); await sleep(300); await A.fill('#sfName','Dodi'); await A.click('#sfGo'); await sleep(400);
  ok((await txt(A)).includes('isi hari & jam mulai'),'jadwal tanpa jam ditolak'); await A.evaluate(()=>document.getElementById('sfNo').click());

  console.log('\n[Filter & Jadwal Mingguan]');
  await A.click('#fGuru'); await sleep(300);
  ok(await A.evaluate(()=>{const m=document.getElementById('fmenu');return !!m&&m.innerText.includes('Semua guru')&&m.innerText.includes('Sinta')&&!!m.querySelector('.fmenu-i.on');}),'klik filter Guru → menu pilihan setema (bukan daftar bawaan browser)');
  await A.screenshot({path:OUT+'t2_filter_menu.png'});
  await A.click('#fmenu .fmenu-i:has-text("Sinta")'); await sleep(400);
  ok(await A.evaluate(()=>!document.getElementById('fmenu')&&document.getElementById('fGuru').selectedOptions[0].textContent==='Sinta'),'pilih Sinta di menu → menu tertutup, filter terpasang');
  t=await A.evaluate(()=>document.getElementById('stuList').innerText);
  ok(t.includes('Brilian')&&!t.includes('Cici'),'filter guru Sinta: hanya Brilian');
  ok(await A.evaluate(()=>document.querySelector('#fGuru').closest('.fsel').classList.contains('on')&&!!document.querySelector('.f-active #fReset')),'filter diganti → kotak berwarna oranye + pesan "Filter aktif" & tombol Tampilkan semua');
  await A.screenshot({path:OUT+'t2_filter_aktif.png'});
  await A.click('#fReset'); await sleep(400);
  ok(await A.evaluate(()=>!document.querySelector('.f-active')&&document.getElementById('fGuru').value===''&&document.getElementById('stuList').innerText.includes('Cici')),'Tampilkan semua → filter kembali bawaan, semua siswa tampil');
  await A.click('[data-view=jadwal]'); await sleep(500);
  t=await txt(A);
  ok(t.includes('BENTROK')&&t.includes('2 sesi bentrok'),'Brilian 14:00 & Cici 14:30 (Budi, Senin) ditandai bentrok');
  ok(t.includes('Budi · 2 sesi/minggu')&&t.includes('Sinta · 1 sesi/minggu'),'rekap sesi per guru');
  await A.screenshot({path:OUT+'t2_jadwal_pc.png'});

  console.log('\n[Guru Mitra hanya melihat miliknya]');
  const siswa=async P=>{ await P.reload(); await sleep(3000); await P.click('[data-tab=siswa]'); await sleep(400); return txt(P); };
  t=await siswa(Mb);
  ok(t.includes('Brilian')&&t.includes('Cici')&&t.includes('Piano')&&t.includes('2 siswa diajar'),'Budi melihat Brilian (Piano) & Cici');
  ok(!t.includes('Vokal')&&!t.includes('081234567')&&!t.includes('Bu Ani')&&!t.includes('50.000'),'Budi tidak melihat kelas Sinta, No HP, ortu, maupun tarif');
  await Mb.screenshot({path:OUT+'t2_mitra_jadwal.png'});
  t=await siswa(Ms);
  ok(t.includes('Brilian')&&t.includes('Vokal')&&!t.includes('Cici')&&!t.includes('Piano'),'Sinta hanya melihat kelas Vokal Brilian');

  console.log('\n[Ubah murid: pindah guru & nonaktif]');
  await A.click('[data-view=daftar]'); await sleep(400);
  await A.click('tr[data-stu]:has-text("Cici")'); await sleep(300);
  await pick('select[data-c="0"][data-k="mitraUid"]','Sinta'); await A.click('#sfGo'); await sleep(1500);
  ok(!(await siswa(Mb)).includes('Cici'),'Cici dipindah ke Sinta → hilang dari jadwal Budi');
  await A.click('tr[data-stu]:has-text("Brilian")'); await sleep(300);
  await A.selectOption('#sfActive','0'); await A.click('#sfGo'); await sleep(1500);
  ok(!(await A.evaluate(()=>document.getElementById('stuList').innerText)).includes('Brilian'),'Brilian nonaktif → tidak tampil di filter Aktif');
  ok((await siswa(Mb)).includes('Belum ada murid'),'murid nonaktif hilang dari jadwal Mitra');

  console.log('\n[Impor dari LLK V1]');
  await A.click('#impV1'); await sleep(400);
  await A.check('#ivAll'); await sleep(200);
  t=await A.evaluate(()=>document.getElementById('ivPlan').innerText);
  ok(t.includes('3 murid')&&t.includes('Biola')&&!/Pelajaran baru:.*Piano/.test(t),'pilih semua aktif (3, Nina tanpa jadwal tidak bisa dipilih) · Biola jadi pelajaran baru · Piano & Vokal dipakai ulang');
  await A.screenshot({path:OUT+'t2_impor.png'});
  await A.click('#ivGo'); await sleep(2500);
  t=await txt(A);
  ok(t.includes('Kenzo')&&t.includes('Lala')&&t.includes('Mika')&&!t.includes('Nina'),'Kenzo, Lala, Mika diimpor · Nina (tanpa jadwal) dilewati');
  ok(/Sen 14:00–15:00, Kam 16:00–17:00/.test(t),'jadwal hari ke-2 V1 ikut tersalin');
  const lala=await A.evaluate(()=>window.__llk.S.data.students.find(x=>x.name==='Lala'));
  const vok=await A.evaluate(()=>window.__llk.S.data.subjects.find(x=>x.name==='Vokal'));
  ok(lala&&lala.classes[0].subjectId===vok.id&&lala.classes[0].rate===null,'"vokal" (huruf kecil) dicocokkan ke Vokal, tarif sama → ikut standar');
  await A.click('#impV1'); await sleep(400);
  ok((await A.evaluate(()=>[...document.querySelectorAll('.imp-row.is-off')].filter(r=>r.innerText.includes('SUDAH ADA')).length))===3,'impor ulang: 3 murid tertanda SUDAH ADA');
  await A.evaluate(()=>document.getElementById('ivNo').click());

  console.log('\n[Tampilan HP]');
  const H=await dev({uid:'t2admin',email:'owner@rms.com'},{w:390,h:844});
  await H.goto(URL); await sleep(2500); await H.click('[data-tab=murid]'); await sleep(1500);
  const noScroll=await H.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1);
  ok(noScroll,'HP: tabel jadi kartu, tidak ada geser ke samping');
  await H.screenshot({path:OUT+'t2_murid_hp.png',fullPage:true});
  await A.click('[data-view=daftar]'); await sleep(300); await A.screenshot({path:OUT+'t2_murid_pc.png'});

  const errs=[A,Mb,Ms,H].flatMap(p=>p.errs); ok(errs.length===0,'tidak ada error JavaScript'+(errs.length?': '+errs.join(' | '):''));
  console.log(`\nHASIL: ${pass} lulus, ${fail} gagal`); await b.close(); process.exit(fail?1:0);
})().catch(e=>{console.error(e);process.exit(2);});
