// LLK V2 — Admin: Reschedule, Tambah Kelas, Off (guru berhalangan) & Koreksi absensi (seperti V1),
// dan aplikasi Guru Mitra ikut menampilkan jadwal khusus itu.
const { chromium } = require('playwright'); const fs=require('fs');
const FB=__dirname+'/node_modules/firebase/';
const OUT=__dirname+'/out/'; fs.mkdirSync(OUT,{recursive:true});
let pass=0,fail=0; const ok=(c,m)=>{c?pass++:fail++;console.log((c?'  ✅ ':'  ❌ ')+m);};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const DAYS=['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
const wib=new Date(Date.now()+7*3600e3); const TODAY=DAYS[wib.getUTCDay()], TOMORROW=DAYS[(wib.getUTCDay()+1)%7];
const key=d=>d.toISOString().slice(0,10); const K0=key(wib), K1=key(new Date(wib.getTime()+864e5));
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
  console.log('\n[Persiapan: guru Feran, Andi & Bela hari ini, Cici besok]');
  const A=await dev({uid:'jdAdmin',email:'dian@gmail.com',displayName:'Dian'},{w:1280,h:900});
  await A.goto(URL); await A.waitForSelector('#rcLembaga',{timeout:15000});
  await A.click('#rcLembaga'); await sleep(300); await A.fill('#coName','CEK'); await A.click('#coGo'); await sleep(2000);
  await A.click('#addMitra'); await A.fill('#amName','Feran'); await A.fill('#amHonor','30000'); await A.click('#amGo'); await sleep(1300);
  const code=await A.evaluate(()=>document.querySelector('.modal .code-box').textContent.trim()); await A.click('#icClose'); await sleep(500);
  const M=await dev({uid:'jdFeran',email:'feran@x.com',displayName:'Feran'});
  await M.goto(URL+'?kode='+code); await sleep(2500); await M.click('#jJoin'); await sleep(3000);
  await A.click('[data-tab=murid]'); await sleep(1200); await A.click('[data-view=pelajaran]'); await sleep(300);
  await A.click('#addSubj'); await A.fill('#pjName','Piano'); await A.fill('#pjRate','50000'); await A.click('#pjGo'); await sleep(1200);
  await A.click('[data-view=daftar]'); await sleep(300);
  const pick=(sel,label)=>A.evaluate(([sel,label])=>{const s=document.querySelector(sel); const o=[...s.options].find(o=>o.textContent===label); s.value=o.value; s.dispatchEvent(new Event('change'));},[sel,label]);
  for(const [nm,day,st,en] of [['Andi',TODAY,'10:00','10:45'],['Bela',TODAY,'11:00','11:45'],['Cici',TOMORROW,'12:00','12:45']]){
    await A.click('#addStu'); await sleep(300); await A.fill('#sfName',nm); await A.fill('#sfPhone','0812'+nm.length);
    await pick('select[data-c="0"][data-k="subjectId"]','Piano'); await sleep(100); await pick('select[data-c="0"][data-k="mitraUid"]','Feran');
    await pick('select[data-c="0"][data-s="0"][data-k="day"]',day);
    await A.fill('input[data-c="0"][data-s="0"][data-k="start"]',st); await A.fill('input[data-c="0"][data-s="0"][data-k="end"]',en);
    await A.click('#sfGo'); await sleep(1500);
  }
  const names=()=>A.evaluate(()=>[...document.querySelectorAll('.ab-item .ab-name')].map(e=>e.textContent));

  console.log('\n[1] Reschedule: Andi hari ini → besok 16:00');
  await A.click('[data-tab=absensi]'); await sleep(1500);
  await A.click('.ab-item:has-text("Andi") [data-resch]'); await sleep(300);
  await A.fill('#sfDate',K1); await A.fill('#sfStart','16:00'); await A.fill('#sfEnd','16:45'); await A.fill('#sfNote','Ortu minta pindah'); await A.click('#sfGo'); await sleep(2000);
  ok(!(await names()).includes('Andi'),'Andi hilang dari jadwal hari ini');
  await A.click(`[data-date="${K1}"]`); await sleep(1500);
  let t=await txt(A); ok((await names()).includes('Andi')&&t.includes('Pindahan dari')&&t.includes('Ortu minta pindah')&&t.includes('16:00'),'Andi muncul besok 16:00 dengan tanda "Pindahan dari …"');
  await A.screenshot({path:OUT+'jadwal_admin_reschedule.png'});

  console.log('\n[2] Tambah Kelas: Cici hari ini (di luar jadwal rutin)');
  await A.click(`[data-date="${K0}"]`); await sleep(1200);
  await A.click('#abAddCls'); await sleep(300);
  await A.selectOption('#sfCls',{label:'Cici · Piano'}); await A.fill('#sfStart','14:00'); await A.fill('#sfEnd','14:45'); await A.fill('#sfNote','Kelas pengganti'); await A.click('#sfGo'); await sleep(2000);
  t=await txt(A); ok((await names()).includes('Cici')&&t.includes('Kelas tambahan'),'Cici muncul hari ini dengan tanda "Kelas tambahan"');
  await A.click('.ab-item:has-text("Cici") [data-resch], .ab-item:has-text("Cici") [data-sesidel]').catch(()=>{}); await sleep(300);
  await A.keyboard.press('Escape'); await A.evaluate(()=>{ const o=document.getElementById('modalOverlay'); if(o) o.remove(); });
  await A.click('#abAddCls'); await sleep(300); await A.selectOption('#sfCls',{label:'Cici · Piano'}); await A.fill('#sfDate',K1); await A.fill('#sfStart','09:00'); await A.click('#sfGo'); await sleep(800);
  ok((await A.evaluate(()=>document.getElementById('sfMsg2').innerText)).includes('sudah punya sesi'),'menolak tambah kelas Cici besok (sudah ada jadwal rutin)');
  await A.click('#sfNo'); await sleep(300);

  console.log('\n[3] Off: guru berhalangan untuk Bela');
  await A.click('.ab-item:has-text("Bela") [data-off]'); await sleep(300);
  ok(await A.evaluate(()=>document.getElementById('koSt').value==='off'),'tombol Off membuka form dengan status Off');
  await A.fill('#koReason','Guru sakit'); await A.click('#koGo'); await sleep(1500);
  t=await A.evaluate(()=>[...document.querySelectorAll('.ab-item')].find(e=>e.innerText.includes('Bela')).innerText);
  ok(t.includes('OFF')&&t.includes('Guru sakit'),'Bela: OFF · Guru sakit');

  console.log('\n[4] Aplikasi Guru Mitra mengikuti jadwal khusus');
  await M.reload(); await sleep(3500);
  t=await txt(M);
  ok(t.includes('Cici')&&t.includes('Kelas tambahan')&&!t.includes('Andi'),'guru: hari ini Cici (kelas tambahan), Andi tidak ada (dipindah)');
  ok(t.includes('Bela')&&await M.evaluate(()=>[...document.querySelectorAll('.s-item')].find(e=>e.innerText.includes('Bela')).innerText.includes('Off')),'guru: Bela Off (diisi Admin)');
  await M.click('.s-item:has-text("Cici") .s-avatar'); await sleep(300); await M.click('.s-item.expanded .att-btn.a-hadir'); await sleep(400);
  await M.fill('#noteProgress','Kelas pengganti: tangga nada G'); await M.click('#noteSaveBtn'); await sleep(2000);
  ok((await txt(M)).includes('Kelas pengganti: tangga nada G'),'guru mengabsen Hadir kelas tambahan Cici');
  await M.screenshot({path:OUT+'jadwal_guru.png',fullPage:true});
  await M.click(`[data-date="${K1}"]`); await sleep(500);
  t=await txt(M); ok(t.includes('Andi')&&t.includes('Pindahan dari'),'guru: besok ada Andi (pindahan)');

  console.log('\n[5] Koreksi oleh Admin');
  await A.click(`[data-date="${K1}"]`); await sleep(800); await A.click(`[data-date="${K0}"]`); await sleep(1500);
  await A.click('.ab-item:has-text("Cici") [data-koreksi]'); await sleep(300);
  await A.selectOption('#koSt','alpa'); await A.fill('#koReason','Ternyata tidak datang'); await A.click('#koGo'); await sleep(1500);
  t=await A.evaluate(()=>[...document.querySelectorAll('.ab-item')].find(e=>e.innerText.includes('Cici')).innerText);
  ok(t.includes('ALPA')&&t.includes('Ternyata tidak datang'),'Admin mengoreksi Cici jadi Alpa');
  const hon=await A.evaluate(async()=>{ const S=window.__llk.S; return S.data.mitras.find(m=>m.name==='Feran').honor; });
  ok(hon===30000,'honor guru tetap tercatat untuk Alpa (Rp 30.000)');

  console.log('\n[6] Batalkan pindahan');
  await A.click(`[data-date="${K1}"]`); await sleep(1500);
  await A.click('.ab-item:has-text("Andi") [data-sesidel]'); await sleep(300);
  await A.click('#cfYes'); await sleep(1800);
  ok(!(await names()).includes('Andi'),'besok tidak ada Andi lagi');
  await A.click(`[data-date="${K0}"]`); await sleep(1500);
  ok((await names()).includes('Andi'),'Andi kembali ke jadwal hari ini');
  await A.screenshot({path:OUT+'jadwal_admin_hariini.png'});

  const errs=[A,M].flatMap(p=>p.errs); ok(errs.length===0,'tidak ada error JavaScript'+(errs.length?': '+errs.join(' | '):''));
  console.log(`\nHASIL: ${pass} lulus, ${fail} gagal`); await b.close(); process.exit(fail?1:0);
})().catch(e=>{console.error(e);process.exit(2);});
