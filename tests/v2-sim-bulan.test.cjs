// SIMULASI 1 BULAN MENGAJAR (30 hari terakhir) di LLK V2:
// Rani (Admin + juga mengajar), Pak Dimas, Bu Sari — honor Rp 40.000/pertemuan.
// 6 murid, tarif Rp 100.000 → paket bayar di depan Rp 400.000 / 4x pertemuan.
// Setiap hari: murid hadir + guru menulis progres; ada Izin (oleh Admin) & Alpa.
// Admin mencatat pembayaran paket setiap kali sisa paket habis (sebelum les).
// Di akhir: gaji guru & pemasukan di aplikasi dibandingkan dengan hitungan manual.
const { chromium } = require('playwright'); const fs=require('fs');
const { initializeTestEnvironment } = require('@firebase/rules-unit-testing');
const { doc, setDoc, updateDoc, serverTimestamp, Timestamp } = require('firebase/firestore');
const FB=__dirname+'/node_modules/firebase/';
const OUT=__dirname+'/out/'; fs.mkdirSync(OUT,{recursive:true});
let pass=0,fail=0; const ok=(c,m)=>{c?pass++:fail++;console.log((c?'  ✅ ':'  ❌ ')+m);};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const rp=n=>'Rp '+n.toLocaleString('id-ID');
const DJ=['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
const wibNow=new Date(Date.now()+7*3600e3);
const key=d=>d.toISOString().slice(0,10);
const TODAY=key(wibNow);
const DATES=[...Array(30)].map((_,i)=>{const d=new Date(wibNow); d.setUTCDate(d.getUTCDate()-29+i); return key(d);});
const dayOf=k=>DJ[new Date(k+'T00:00:00Z').getUTCDay()];
// Murid: [nama, pelajaran, guru, [[hari,jam],...]]
const MURID=[
  ['Ayu','Vokal','Rani',[['Senin','15:00']]],
  ['Bima','Piano','Rani',[['Rabu','16:00'],['Sabtu','10:00']]],
  ['Cahaya','Gitar','Pak Dimas',[['Selasa','15:00']]],
  ['Dafa','Gitar','Pak Dimas',[['Kamis','15:00'],['Sabtu','13:00']]],
  ['Elang','Piano','Bu Sari',[['Rabu','15:00']]],
  ['Farel','Vokal','Bu Sari',[['Jumat','16:00']]],
];
const end=t=>{const [h,m]=t.split(':').map(Number);const x=h*60+m+60;return String(Math.floor(x/60)).padStart(2,'0')+':'+String(x%60).padStart(2,'0');};
(async()=>{
  const env=await initializeTestEnvironment({projectId:'llk-67a30',firestore:{host:'127.0.0.1',port:8089,rules:fs.readFileSync(__dirname+'/../firestore.rules','utf8')}});
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

  console.log('\n[Persiapan] lembaga Rani, 3 guru (honor Rp 40.000), tarif Rp 100.000');
  const A=await dev({uid:'bRani',email:'rani@gmail.com',displayName:'Rani'},{w:1440,h:900});
  await A.goto(URL); await A.waitForSelector('#rcLembaga',{timeout:15000});
  await A.click('#rcLembaga'); await sleep(300); await A.fill('#coName','Les Musik Rani'); await A.click('#coGo'); await sleep(2000);
  // Rani berlangganan Paket Mulai + 1 slot = Rp300.000 → 3 slot Guru Mitra (Rani, Dimas, Sari)
  { const id=await A.evaluate(()=>window.__llk.S.org.id); await env.withSecurityRulesDisabled(async c=>{ await updateDoc(doc(c.firestore(),'orgs',id),{seats:3,plan:'pro',period:'monthly',activeUntil:Timestamp.fromMillis(Date.now()+30*864e5)}); }); await A.reload(); await sleep(2500); }
  await A.click('#selfTeach'); await sleep(300); await A.fill('#stHonor','40000'); await A.click('#stGo'); await sleep(1800); await A.click('#gaClose'); await sleep(600);
  const G={Rani:{uid:'bRani',page:null}};
  for(const [n,uid,em] of [['Pak Dimas','bDimas','dimas@gmail.com'],['Bu Sari','bSari','sari@gmail.com']]){
    await A.click('#addMitra'); await A.fill('#amName',n); await A.fill('#amHonor','40000'); await A.click('#amGo'); await sleep(1200);
    const code=await A.evaluate(()=>document.querySelector('.modal .code-box').textContent.trim()); await A.click('#icClose'); await sleep(600);
    const P=await dev({uid,email:em}); await P.goto(URL+'?kode='+code); await sleep(2500); await P.click('#jJoin'); await sleep(2500);
    G[n]={uid,page:P};
  }
  G.Rani.page=await dev({uid:'bRani',email:'rani@gmail.com'});
  await A.click('[data-tab=murid]'); await sleep(1200); await A.click('[data-view=pelajaran]'); await sleep(300);
  for(const n of ['Piano','Gitar','Vokal']){ await A.click('#addSubj'); await A.fill('#pjName',n); await A.fill('#pjRate','100000'); await A.click('#pjGo'); await sleep(1100); }
  await A.click('[data-view=daftar]'); await sleep(300);
  const pick=(sel,label)=>A.evaluate(([sel,label])=>{const s=document.querySelector(sel); const o=[...s.options].find(o=>o.textContent===label); s.value=o.value; s.dispatchEvent(new Event('change'));},[sel,label]);
  for(const [nm,subj,guru,slots] of MURID){
    await A.click('#addStu'); await sleep(300); await A.fill('#sfName',nm); await A.fill('#sfPhone','0812555'+nm.length+'00');
    await pick('select[data-c="0"][data-k="subjectId"]',subj); await sleep(80); await pick('select[data-c="0"][data-k="mitraUid"]',guru==='Rani'?'Rani (Anda)':guru);
    for(let i=0;i<slots.length;i++){ if(i) { await A.click('[data-addslot="0"]'); await sleep(150); }
      await pick(`select[data-c="0"][data-s="${i}"][data-k="day"]`,slots[i][0]);
      await A.fill(`input[data-c="0"][data-s="${i}"][data-k="start"]`,slots[i][1]); await A.fill(`input[data-c="0"][data-s="${i}"][data-k="end"]`,end(slots[i][1])); }
    await A.click('#sfGo'); await sleep(1400);
  }
  const data=await A.evaluate(()=>window.__llk.S.data.students.map(s=>({id:s.id,name:s.name,cid:s.classes[0].id})));
  const CLS={}; data.forEach(x=>CLS[x.name]=x);
  ok(Object.keys(CLS).length===6,'6 murid dibuat, masing-masing 1 kelas');
  const db=env.unauthenticatedContext(); // dipakai hanya lewat withSecurityRulesDisabled
  const ORG=await A.evaluate(()=>window.__llk.S.org.id);

  console.log('\n[Simulasi 30 hari] '+DATES[0]+' s/d '+TODAY);
  await A.click('[data-tab=keuangan]'); await sleep(1500); await A.click('[data-per="30"]'); await sleep(1200);
  const E={paid:{},used:{},pay:[],gaji:{Rani:0,'Pak Dimas':0,'Bu Sari':0},sesi:{Rani:{h:0,a:0,i:0},'Pak Dimas':{h:0,a:0,i:0},'Bu Sari':{h:0,a:0,i:0}},progres:0};
  MURID.forEach(([n])=>{E.paid[n]=0;E.used[n]=0;});
  const nth={}; let perluBayarOk=true, perluBayarN=0, uiToday=[];
  for(const dk of DATES){
    for(const [nm,subj,guru,slots] of MURID){
      const sl=slots.find(s=>s[0]===dayOf(dk)); if(!sl) continue;
      nth[nm]=(nth[nm]||0)+1; const n=nth[nm];
      // Kejadian: Ayu izin pertemuan ke-2 (sakit), Farel izin ke-3, Dafa alpa ke-4
      const st=(nm==='Ayu'&&n===2)||(nm==='Farel'&&n===3)?'izin':(nm==='Dafa'&&n===4)?'alpa':'hadir';
      // Bayar di depan: sisa paket habis → Admin mencatat pembayaran 1 paket sebelum les
      if(st!=='izin' && E.paid[nm]-E.used[nm]<=0){
        await A.click('[data-per="30"]'); await sleep(1300);
        const row=await A.evaluate(id=>{const r=document.querySelector('tr[data-cls="'+id+'"]'); return r?r.innerText:'';},CLS[nm].cid);
        if(!row.includes('PERLU BAYAR')) { perluBayarOk=false; console.log('    status '+nm+' '+dk+': '+row.replace(/\s+/g,' ')); }
        perluBayarN++;
        await A.click(`[data-pay="${CLS[nm].cid}"]`); await sleep(300); await A.fill('#pfDate',dk); await A.click('#pfGo'); await sleep(1300);
        E.paid[nm]+=4; E.pay.push({nm,dk,amount:400000});
      }
      const g=guru, rec={classId:CLS[nm].cid,studentId:CLS[nm].id,studentName:nm,subjectName:subj,mitraUid:G[g].uid,date:dk,start:sl[1],end:end(sl[1]),
        status:st,progress:st==='hadir'?'Materi pertemuan ke-'+n+' ('+subj+')':'',prSiswa:st==='hadir'?'Latihan 15 menit/hari':'',prGuru:'',reason:st==='izin'?'Sakit':st==='alpa'?'Tidak datang tanpa kabar':'',
        honor:st==='izin'?0:40000,by:st==='izin'?'bRani':G[g].uid};
      if(st!=='izin'){ E.used[nm]++; E.gaji[g]+=40000; }
      E.sesi[g][st[0]]++; if(st==='hadir') E.progres++;
      if(dk===TODAY && st!=='izin') { uiToday.push({nm,g,st,rec}); continue; } // hari ini diisi lewat aplikasi guru
      // Hari-hari lalu: data persis seperti yang ditulis aplikasi guru/admin pada hari itu
      await env.withSecurityRulesDisabled(async c=>{ await setDoc(doc(c.firestore(),'orgs',ORG,'att',CLS[nm].cid+'_'+dk),{...rec,updatedAt:serverTimestamp()}); });
    }
  }
  ok(perluBayarOk&&perluBayarN===E.pay.length,'setiap kali paket habis, aplikasi menandai "PERLU BAYAR" sebelum les ('+perluBayarN+'x) lalu Admin mencatat pembayaran');
  // Hari ini: guru mengisi lewat aplikasinya
  for(const t of uiToday){
    const P=G[t.g].page; await P.goto(URL+'guru.html'); await sleep(2800);
    await P.evaluate(n=>{ const it=[...document.querySelectorAll('.s-item')].find(x=>x.innerText.includes(n)); it.querySelector('.s-avatar').click(); },t.nm); await sleep(300);
    await P.click('.s-item.expanded .att-btn.a-'+t.st); await sleep(300);
    if(t.st==='hadir'){ await P.fill('#noteProgress',t.rec.progress); await P.fill('#notePrSiswa',t.rec.prSiswa); } else await P.fill('#noteReason',t.rec.reason);
    await P.click('#noteSaveBtn'); await sleep(1500);
  }
  ok(true,'hari ini ('+TODAY+'): '+(uiToday.length?uiToday.map(x=>x.nm+' '+x.st+' oleh '+x.g).join(', ')+' — diisi lewat aplikasi Guru':'tidak ada jadwal'));
  const totSesi=Object.values(E.sesi).reduce((n,s)=>n+s.h+s.a+s.i,0);
  console.log('    '+totSesi+' pertemuan: '+Object.entries(E.sesi).map(([g,s])=>g+' H'+s.h+'/A'+s.a+'/I'+s.i).join(' · ')+' · '+E.pay.length+' pembayaran');

  console.log('\n[Cek 30 hari kemudian] Keuangan Admin vs hitungan manual');
  await A.click('[data-per="30"]'); await sleep(1500);
  const kas=E.pay.reduce((n,p)=>n+p.amount,0), gaji=Object.values(E.gaji).reduce((a,b)=>a+b,0);
  const sesiBayar=Object.values(E.used).reduce((a,b)=>a+b,0);
  const ui=await A.evaluate(()=>({kas:kKas.textContent,gaji:kGaji.textContent,sel:kSelisih.textContent,nilai:kNilai.textContent}));
  ok(ui.kas===rp(kas),'Pemasukan 30 hari: '+ui.kas+' (manual '+rp(kas)+' = '+E.pay.length+' × Rp 400.000)');
  ok(ui.gaji===rp(gaji),'Gaji guru 30 hari: '+ui.gaji+' (manual '+rp(gaji)+' = '+sesiBayar+' pertemuan × Rp 40.000)');
  ok(ui.sel===rp(kas-gaji),'Selisih: '+ui.sel+' (manual '+rp(kas-gaji)+')');
  ok(ui.nilai===rp(sesiBayar*100000),'Nilai pertemuan terlaksana: '+ui.nilai+' (manual '+sesiBayar+' × Rp 100.000)');
  const sisa=Object.keys(E.paid).reduce((n,k)=>n+Math.max(0,E.paid[k]-E.used[k]),0);
  const ex=await A.evaluate(()=>({titip:kTitip.textContent,laba:kLaba.textContent}));
  ok(ex.titip===rp(sisa*100000),'Uang titipan (sisa paket belum terpakai): '+ex.titip+' (manual '+sisa+'x × Rp 100.000)');
  ok(ex.laba===rp(sesiBayar*100000-gaji),'Laba pertemuan terlaksana: '+ex.laba+' (manual '+rp(sesiBayar*100000)+' − '+rp(gaji)+')');
  ok(kas===sesiBayar*100000+sisa*100000,'Cocok: pemasukan = nilai pertemuan terlaksana + uang titipan');
  for(const g of ['Rani','Pak Dimas','Bu Sari']){
    const row=await A.evaluate(uid=>{const r=document.querySelector('#tblGaji tr[data-guru="'+uid+'"]'); return r?[...r.cells].map(c=>c.innerText.trim()):[];},G[g].uid);
    const s=E.sesi[g];
    ok(row[1]===String(s.h)&&row[2]===String(s.a)&&row[3].startsWith(String(s.i))&&row[5]===rp(E.gaji[g]),'Gaji '+g+': H'+row[1]+' A'+row[2]+' I'+row[3].split(' ')[0]+' → '+row[5]+' (manual '+rp(E.gaji[g])+')');
  }
  for(const [nm] of MURID){
    const cr=E.paid[nm]-E.used[nm];
    const row=await A.evaluate(id=>{const r=document.querySelector('#tblTagihan tr[data-cls="'+id+'"]'); return r?[...r.cells].map(c=>c.innerText.trim()):[];},CLS[nm].cid);
    const want=cr<=0?'PERLU BAYAR':'SISA '+cr+'x';
    ok(row[3]===E.paid[nm]+'x'&&row[4]===E.used[nm]+'x'&&row[5].startsWith(want),'Tagihan '+nm+': dibayar '+row[3]+', terpakai '+row[4]+', '+row[5].split('\n')[0]+' (manual: sisa '+cr+'x)');
  }
  await A.screenshot({path:OUT+'bulan_keuangan.png',fullPage:true});

  console.log('\n[Cek di aplikasi masing-masing guru] menu Honor & Track');
  for(const g of ['Rani','Pak Dimas','Bu Sari']){
    const P=G[g].page; await P.goto(URL+'guru.html'); await sleep(2800);
    await P.click('[data-tab=honor]'); await sleep(400);
    const sum=await P.evaluate(()=>[...document.querySelectorAll('.menu-card .menu-item')].reduce((n,el)=>{const m=el.innerText.match(/Rp ([\d.]+)\s*$/);return n+(m?+m[1].replace(/\./g,''):0);},0));
    ok(sum===E.gaji[g],'Honor '+g+' di aplikasinya: '+rp(sum)+' (manual '+rp(E.gaji[g])+')');
    await P.click('[data-tab=track]'); await sleep(300); await P.click('[data-per="semua"]'); await sleep(300);
    const t=await P.evaluate(()=>[...document.querySelectorAll('[data-sf] .n')].map(e=>e.textContent).join('/'));
    const s=E.sesi[g]; ok(t===s.h+'/'+s.i+'/'+s.a,'Track '+g+': Hadir/Izin/Alpa = '+t);
  }
  await G['Bu Sari'].page.click('[data-tab=honor]'); await sleep(300); await G['Bu Sari'].page.screenshot({path:OUT+'bulan_honor_sari.png'});
  // Progres tertulis di setiap pertemuan Hadir
  const nProg=await A.evaluate(async()=>0);
  await A.click('[data-tab=absensi]'); await sleep(1200);
  const tagihan=await A.evaluate(()=>1);
  // Tagih WA untuk murid yang perlu bayar
  await A.click('[data-tab=keuangan]'); await sleep(1500); await A.click('[data-per="30"]'); await sleep(1200);
  ok(await A.evaluate(()=>{ const n=t=>+document.getElementById(t).textContent.replace(/[^\d]/g,''); return n('kpGross')>0&&n('kpGross')-n('kpGaji')===n('kpNet'); }),'Keuangan: proyeksi jika semua siswa masuk (kotor − gaji guru = bersih)');
  await A.screenshot({path:OUT+'bulan_keuangan_proyeksi.png'});
  const tg=await A.$('[data-tagih]');
  if(tg){ await tg.click(); const wa=await A.evaluate(()=>decodeURIComponent(window.__wa[window.__wa.length-1]||'')); ok(/wa\.me\/62812555/.test(wa)&&wa.includes('Rp 400.000'),'Tagih WA: pesan tagihan paket Rp 400.000 ke nomor ortu'); }
  const errs=[A,...Object.values(G).map(x=>x.page)].flatMap(p=>p.errs); ok(errs.length===0,'tidak ada error JavaScript'+(errs.length?': '+errs.join(' | '):''));
  console.log(`\nHASIL: ${pass} lulus, ${fail} gagal`); await b.close(); await env.cleanup(); process.exit(fail?1:0);
})().catch(e=>{console.error(e);process.exit(2);});
