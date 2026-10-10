// LLK V2 — riwayat absensi & progres dari LLK V1 ikut terbawa saat impor,
// dan riwayat kelas ikut terlihat oleh guru yang sekarang mengajar (teachUid).
const { chromium } = require('playwright'); const fs=require('fs');
const { initializeTestEnvironment } = require('@firebase/rules-unit-testing');
const { collection, getDocs } = require('firebase/firestore');
const FB=__dirname+'/node_modules/firebase/';
const OUT=__dirname+'/out/'; fs.mkdirSync(OUT,{recursive:true});
let pass=0,fail=0; const ok=(c,m)=>{c?pass++:fail++;console.log((c?'  ✅ ':'  ❌ ')+m);};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
// Data V1: Andi (Piano, Senin) 5 catatan + 1 sesi tambahan; Bela (Vokal, Rabu) 2 catatan
const V1=[{name:'Andi',instrument:'Piano',day:'Senin',time:'15:00',time2:'15:45',rate:50000,extraDates:[{date:'2026-08-06',time:'16:00',id:0}],payCycle:4},
  {name:'Bela',instrument:'Vokal',day:'Rabu',time:'16:00',time2:'16:45',rate:45000,extraDates:[],payCycle:4}];
const V1A={'2026-08-03':{Andi:'hadir'},'2026-08-06':{'Andi_extra_0':'hadir'},'2026-08-10':{Andi:'izin'},'2026-08-17':{Andi:'hadir'},'2026-08-24':{Andi:'alpa'},
  '2026-08-05':{Bela:'hadir'},'2026-08-12':{Bela:'hadir'}};
const V1N={'2026-08-03_Andi':{progress:'Tangga nada C mayor',prSiswa:'Latihan Für Elise bar 1-8',prGuru:''},'2026-08-06_Andi_extra_0':{progress:'Kelas tambahan: akor dasar'},
  '2026-08-10_Andi':{reason:'Sakit demam'},'2026-08-24_Andi':{reason:'Tidak datang'},'2026-08-05_Bela':{progress:'Pernapasan diafragma'},'2026-08-12_Bela':{progress:'Lagu Indonesia Raya'}};
(async()=>{
  const b=await chromium.launch({executablePath:process.env.CHROME_PATH||undefined});
  async function dev(user,{w=390,h=844,v1=false}={}){
    const ctx=await b.newContext({viewport:{width:w,height:h},serviceWorkers:'block',timezoneId:'Asia/Jakarta'});
    await ctx.route('**/*',r=>{const u=r.request().url();
      if(u.startsWith('http://localhost')||u.startsWith('http://127.0.0.1')) return r.continue();
      const m=u.match(/firebasejs\/10\.14\.1\/(firebase-[a-z]+\.js)$/); if(m) return r.fulfill({contentType:'text/javascript',body:fs.readFileSync(FB+m[1],'utf8')});
      return r.abort();});
    await ctx.addInitScript(([u,v1,a,n])=>{ window.__LLK_TEST__={host:'127.0.0.1',port:8089,user:u}; window.__wa=[]; window.open=(x)=>{window.__wa.push(x);return null;};
      if(v1&&!localStorage.getItem('rms4_s')){ localStorage.setItem('rms4_s',JSON.stringify(v1)); localStorage.setItem('rms4_a',JSON.stringify(a)); localStorage.setItem('rms4_n',JSON.stringify(n)); localStorage.setItem('rms4_meta',JSON.stringify({'2026-08-06_Andi_extra_0':{time:'16:00',time2:'16:45'}})); } },[user,v1?V1:null,V1A,V1N]);
    const p=await ctx.newPage(); p.errs=[]; p.on('pageerror',e=>p.errs.push(e.message)); p.on('dialog',d=>d.accept());
    return p;
  }
  const txt=p=>p.evaluate(()=>document.body.innerText);
  const URL=(process.env.BASE_URL||'http://localhost:8765')+'/v2/';
  const env=await initializeTestEnvironment({projectId:'llk-67a30',firestore:{host:'127.0.0.1',port:8089,rules:fs.readFileSync(__dirname+'/../firestore.rules','utf8')}});
  const attOf=async(org)=>{ let out; await env.withSecurityRulesDisabled(async c=>{ const s=await getDocs(collection(c.firestore(),'orgs',org,'att')); out=s.docs.map(d=>Object.assign({id:d.id},d.data())); }); return out; };

  console.log('\n[1] Impor Andi dari V1 beserta riwayatnya');
  const A=await dev({uid:'rwAdmin',email:'dian@gmail.com',displayName:'Dian'},{w:1280,h:900,v1:true});
  await A.goto(URL); await A.waitForSelector('#rcLembaga',{timeout:15000});
  await A.click('#rcLembaga'); await sleep(300); await A.fill('#coName','CEK'); await A.click('#coGo'); await sleep(2000);
  const ORG=await A.evaluate(()=>window.__llk.S.org.id);
  await A.click('[data-tab=murid]'); await sleep(1200); await A.click('#impV1'); await sleep(500);
  ok(await A.evaluate(()=>document.getElementById('ivHist').checked),'pilihan "Salin juga riwayat absensi & progres" tercentang otomatis');
  await A.check('.imp-row:has-text("Andi") input'); await sleep(200);
  await A.screenshot({path:OUT+'riwayat_impor.png'});
  await A.click('#ivGo'); await sleep(3500);
  let att=await attOf(ORG);
  ok(att.length===5&&att.every(a=>a.src==='v1'&&a.mitraUid===null&&a.honor===0),'5 catatan Andi tersalin (Hadir, sesi tambahan, Izin, Hadir, Alpa) sebagai riwayat V1');
  const by=d=>att.find(a=>a.date===d)||{};
  ok(by('2026-08-03').progress==='Tangga nada C mayor'&&by('2026-08-03').prSiswa.includes('Für Elise'),'progres & PR siswa tersalin apa adanya');
  ok(by('2026-08-06').progress.includes('akor dasar')&&by('2026-08-06').start==='16:00','sesi tambahan V1 ikut tersalin (jam 16:00)');
  ok(by('2026-08-10').status==='izin'&&by('2026-08-10').reason==='Sakit demam','Izin + alasan tersalin');
  ok(by('2026-08-17').status==='hadir'&&by('2026-08-17').progress.includes('tanpa catatan'),'Hadir tanpa catatan tetap tercatat');

  console.log('\n[2] Bela sudah ada (diimpor tanpa riwayat) → "Salin Riwayat Progres"');
  await A.click('#impV1'); await sleep(500); await A.uncheck('#ivHist'); await A.check('.imp-row:has-text("Bela") input'); await A.click('#ivGo'); await sleep(3000);
  ok((await attOf(ORG)).length===5,'Bela diimpor tanpa riwayat (pilihan dimatikan)');
  await A.click('#impV1'); await sleep(600);
  let t=await txt(A); ok(t.includes('2 siswa sudah ada di lembaga')&&t.includes('7 catatan'),'tawaran salin riwayat untuk siswa yang sudah ada (7 catatan)');
  await A.click('#ivHistOnly'); await sleep(3500);
  att=await attOf(ORG);
  ok(att.length===7&&att.filter(a=>a.studentName==='Bela').length===2,'riwayat Bela tersalin, riwayat Andi tidak dobel (total 7)');

  console.log('\n[3] Admin: Absensi & Keuangan');
  await A.click('[data-tab=absensi]'); await sleep(1200);
  await A.evaluate(()=>{ const i=document.getElementById('abDate'); i.value='2026-08-03'; i.dispatchEvent(new Event('change')); }); await sleep(1500);
  t=await txt(A); ok(t.includes('Tangga nada C mayor')&&t.includes('DARI LLK V1'),'Absensi 3 Agustus 2026: progres Andi dari LLK V1 tampil');
  await A.screenshot({path:OUT+'riwayat_absensi_admin.png'});
  await A.click('[data-tab=keuangan]'); await sleep(2000);
  ok(await A.evaluate(()=>window.__llk.S.keu.att.every(a=>a.src!=='v1')),'riwayat V1 tidak dihitung sebagai pertemuan terpakai di tagihan');

  console.log('\n[4] Andi dipindah ke guru Feran → Feran melihat riwayatnya');
  await A.click('[data-tab=guru]'); await sleep(1200);
  await A.click('#addMitra'); await A.fill('#amName','Feran'); await A.fill('#amHonor','30000'); await A.fill('#amEmail','feran@gmail.com'); await A.click('#amGo'); await sleep(1300);
  const code=await A.evaluate(()=>document.querySelector('.modal .code-box').textContent.trim()); await A.click('#icClose'); await sleep(500);
  const Fr=await dev({uid:'rwFeran',email:'feran@gmail.com',displayName:'Feran'});
  await Fr.goto(URL+'?kode='+code); await sleep(2500); await Fr.click('#jJoin'); await sleep(3500);
  await A.click('[data-tab=murid]'); await sleep(1500);
  await A.click('tr:has-text("Andi") .tbl-chk'); await sleep(300);
  await A.selectOption('#bkGuru',{label:'Feran'}); await A.click('#bkGo'); await sleep(4500);
  att=await attOf(ORG);
  ok(att.filter(a=>a.studentName==='Andi').every(a=>a.teachUid==='rwFeran'),'riwayat Andi ditandai untuk guru kelas sekarang (Feran)');
  ok(att.filter(a=>a.studentName==='Bela').every(a=>a.teachUid===null),'riwayat Bela tetap (belum punya guru)');
  await Fr.reload(); await sleep(3500);
  await Fr.click('[data-tab=siswa]'); await sleep(500); await Fr.click('[data-stu]'); await sleep(500);
  await Fr.click('[data-per=all]').catch(()=>{}); await sleep(300);
  t=await txt(Fr);
  ok(t.includes('Tangga nada C mayor')&&t.includes('akor dasar')&&t.includes('Sakit demam')&&t.includes('dari LLK V1'),'aplikasi Guru Mitra Feran: profil Andi berisi riwayat progres dari LLK V1');
  await Fr.screenshot({path:OUT+'riwayat_guru_profil.png',fullPage:true});
  await Fr.click('[data-tab=honor]'); await sleep(400);
  ok(await Fr.evaluate(()=>!/Rp\s?[1-9]/.test(document.querySelector('.stats-row').innerText)),'honor Feran tidak ikut bertambah dari riwayat V1');
  const errs=[A,Fr].flatMap(p=>p.errs); ok(errs.length===0,'tidak ada error JavaScript'+(errs.length?': '+errs.join(' | '):''));
  console.log(`\nHASIL: ${pass} lulus, ${fail} gagal`); await b.close(); await env.cleanup(); process.exit(fail?1:0);
})().catch(e=>{console.error(e);process.exit(2);});
