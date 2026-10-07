// SIMULASI PENGGAJIAN GURU (LLK V2): guru mengisi rekening & No WA → Admin
// mengatur tanggal gajian → tombol "Bayar Gaji" hanya muncul di hari gajian →
// upload bukti transfer → slip honor JPG/PDF dikirim ke WA guru → guru melihat slip.
// Bu Sari mengajar 3 murid (40-an pertemuan/bulan) → slip otomatis PDF beberapa halaman.
const { chromium } = require('playwright'); const fs=require('fs');
const { initializeTestEnvironment } = require('@firebase/rules-unit-testing');
const { doc, setDoc, serverTimestamp } = require('firebase/firestore');
const FB=__dirname+'/node_modules/firebase/'; const JSPDF=fs.readFileSync(__dirname+'/node_modules/jspdf/dist/jspdf.umd.min.js','utf8');
const OUT=__dirname+'/out/'; fs.mkdirSync(OUT,{recursive:true});
let pass=0,fail=0; const ok=(c,m)=>{c?pass++:fail++;console.log((c?'  ✅ ':'  ❌ ')+m);};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const rp=n=>'Rp '+n.toLocaleString('id-ID');
const wib=new Date(Date.now()+7*3600e3), key=d=>d.toISOString().slice(0,10);
const TODAY=key(wib); const plus=(k,n)=>{const d=new Date(k+'T00:00:00Z'); d.setUTCDate(d.getUTCDate()+n); return key(d);};
const TOMORROW=plus(TODAY,1);
(async()=>{
  let t;
  const env=await initializeTestEnvironment({projectId:'llk-67a30',firestore:{host:'127.0.0.1',port:8089,rules:fs.readFileSync(__dirname+'/../firestore.rules','utf8')}});
  const b=await chromium.launch({executablePath:process.env.CHROME_PATH||undefined});
  async function dev(user,{w=390,h=844,clock=null}={}){
    const ctx=await b.newContext({viewport:{width:w,height:h},serviceWorkers:'block',timezoneId:'Asia/Jakarta',permissions:['clipboard-read','clipboard-write']});
    await ctx.route('**/*',r=>{const u=r.request().url();
      if(u.startsWith('http://localhost')||u.startsWith('http://127.0.0.1')) return r.continue();
      const m=u.match(/firebasejs\/10\.14\.1\/(firebase-[a-z]+\.js)$/); if(m) return r.fulfill({contentType:'text/javascript',body:fs.readFileSync(FB+m[1],'utf8')});
      if(u.endsWith('/jspdf.umd.min.js')) return r.fulfill({contentType:'text/javascript',body:JSPDF});
      return r.abort();});
    await ctx.addInitScript(u=>{ window.__LLK_TEST__={host:'127.0.0.1',port:8089,user:u}; window.__wa=[]; window.open=(x)=>{window.__wa.push(x);return null;};
      window.__clip=null; try{ navigator.clipboard.write=async(items)=>{ const bl=await items[0].getType('image/png'); window.__clip={type:bl.type,size:bl.size}; }; }catch(e){} },user);
    const p=await ctx.newPage(); p.errs=[]; p.on('pageerror',e=>p.errs.push(e.message)); p.on('dialog',d=>d.accept());
    if(clock) await p.clock.setFixedTime(new Date(clock));
    return p;
  }
  const txt=p=>p.evaluate(()=>document.body.innerText);
  const URL=(process.env.BASE_URL||'http://localhost:8765')+'/v2/';

  console.log('\n[Persiapan] lembaga, Pak Dimas & Bu Sari (honor Rp 40.000), 3 murid');
  const A=await dev({uid:'gRani',email:'rani@gmail.com',displayName:'Rani'},{w:1440,h:900});
  await A.goto(URL); await A.waitForSelector('#rcLembaga',{timeout:15000});
  await A.click('#rcLembaga'); await sleep(300); await A.fill('#coName','Les Musik Rani'); await A.click('#coGo'); await sleep(2000);
  const G={};
  for(const [n,uid,em] of [['Pak Dimas','gDimas','dimas@gmail.com'],['Bu Sari','gSari','sari@gmail.com']]){
    await A.click('#addMitra'); await A.fill('#amName',n); await A.fill('#amHonor','40000'); await A.click('#amGo'); await sleep(1200);
    const code=await A.evaluate(()=>document.querySelector('.modal .code-box').textContent.trim()); await A.click('#icClose'); await sleep(600);
    const P=await dev({uid,email:em}); await P.goto(URL+'?kode='+code); await sleep(2500); await P.click('#jJoin'); await sleep(2500);
    G[n]={uid,page:P};
  }
  const ORG=await A.evaluate(()=>window.__llk.S.org.id);

  console.log('\n[1] Guru mengisi rekening gaji & No WA (aplikasi Guru → Lainnya)');
  const D=G['Pak Dimas'].page;
  await D.click('[data-tab=lainnya]'); await sleep(300);
  await D.fill('#mlBank','BCA'); await D.fill('#mlNum','1234567890'); await D.fill('#mlHolder','Dimas Pratama'); await D.fill('#mlPhone','081298765432');
  await D.click('#mlBankSave'); await sleep(1000);
  ok((await txt(D)).includes('Rekening & No WA tersimpan'),'Pak Dimas menyimpan rekening BCA & No WA');
  await D.screenshot({path:OUT+'gaji_rekening_guru.png'});
  const S2=G['Bu Sari'].page; await S2.click('[data-tab=lainnya]'); await sleep(300);
  await S2.fill('#mlBank','BRI'); await S2.fill('#mlNum','0987654321'); await S2.fill('#mlHolder','Sari Wulandari'); await S2.fill('#mlPhone','085711112222'); await S2.click('#mlBankSave'); await sleep(900);

  console.log('\n[2] 30 hari mengajar (absensi dengan honor tercatat)');
  const E={'Pak Dimas':{sum:0,n:0},'Bu Sari':{sum:0,n:0,today:0}};
  await env.withSecurityRulesDisabled(async c=>{ const f=c.firestore();
    for(let i=30;i>=0;i--){ const dk=plus(TODAY,-i), dow=new Date(dk+'T00:00:00Z').getUTCDay();
      for(const [g,uid,days,stu,j] of [['Pak Dimas','gDimas',[1,3,5],'Cahaya',0],['Bu Sari','gSari',[2,4,6],'Elang',0],['Bu Sari','gSari',[2,4,6],'Fajar',1],['Bu Sari','gSari',[2,4,6],'Gita Permatasari',2]]){
        if(!days.includes(dow)) continue;
        const st=((i+j)%7===3)?'izin':((i+j)%11===5)?'alpa':'hadir';
        await setDoc(doc(f,'orgs',ORG,'att','k'+uid+j+'_'+dk),{classId:'k'+uid+j,studentId:'s'+uid+j,studentName:stu,subjectName:'Piano',mitraUid:uid,date:dk,start:(15+j)+':00',end:(16+j)+':00',status:st,progress:st==='hadir'?'Lagu ke-'+(30-i):'',prSiswa:'',prGuru:'',reason:'',honor:st==='izin'?0:40000,by:uid,updatedAt:serverTimestamp()});
        if(st!=='izin'){ if(i>0){ E[g].sum+=40000; E[g].n++; } else { E[g].today=(E[g].today||0)+40000; E[g].todayN=(E[g].todayN||0)+1; } }
      }
    }
  });
  console.log('    belum dibayar s/d kemarin: Pak Dimas '+rp(E['Pak Dimas'].sum)+' ('+E['Pak Dimas'].n+'x), Bu Sari '+rp(E['Bu Sari'].sum)+' ('+E['Bu Sari'].n+'x)');

  console.log('\n[3] Admin mengatur tanggal gajian di profil guru');
  const dToday=+TODAY.slice(8), dTom=+TOMORROW.slice(8);
  await A.click('[data-tab=guru]'); await sleep(1500);
  t=await txt(A);
  ok(t.includes('BCA 1234567890 a.n. Dimas Pratama')&&t.includes('081298765432'),'Admin melihat rekening & WA yang diisi guru');
  ok(!(await A.$('[data-gaji]')),'tanggal gajian belum diatur → belum ada tombol Bayar Gaji');
  for(const [n,d] of [['Pak Dimas',dToday],['Bu Sari',dTom]]){
    await A.click(`.card:has-text("${n}") [data-honor]`); await sleep(300); await A.selectOption('#ehPay',String(d)); await A.click('#ehGo'); await sleep(1500);
  }
  t=await txt(A);
  ok(t.includes('Waktunya gajian')&&t.includes('Pak Dimas · '+rp(E['Pak Dimas'].sum)),'hari ini gajian Pak Dimas → banner "Waktunya gajian"');
  const btns=await A.evaluate(()=>[...document.querySelectorAll('[data-gaji]')].map(b=>b.innerText));
  ok(btns.length===1&&btns[0].includes('Bayar Gaji '+rp(E['Pak Dimas'].sum))&&btns[0].includes('hari ini gajian'),'tombol khusus hanya untuk Pak Dimas: '+btns.join(' | '));
  ok(/Bu Sari[\s\S]*Gajian: tanggal \d+ tiap bulan · berikutnya/.test(t),'Bu Sari (gajian besok): belum ada tombol, tampil jadwal gajian berikutnya');
  await A.screenshot({path:OUT+'gaji_admin_guru.png'});

  console.log('\n[4] Bayar gaji: upload bukti transfer → slip honor → WA guru');
  await A.click('.card:has-text("Pak Dimas") [data-gaji]'); await sleep(400);
  t=await A.evaluate(()=>document.querySelector('.modal').innerText);
  ok(t.includes('BCA 1234567890 a.n. Dimas Pratama')&&t.includes(rp(E['Pak Dimas'].sum)),'jendela bayar: rekening tujuan & total gaji');
  await A.click('#poGo'); await sleep(300);
  ok((await A.evaluate(()=>document.getElementById('poMsg').innerText)).includes('Upload foto bukti transfer'),'belum upload bukti → ditolak');
  const R=await b.newPage(); await R.setViewportSize({width:420,height:640});
  await R.setContent(`<body style="margin:0;font-family:sans-serif;background:#0060af;color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;height:640px"><div style="font-size:64px">✔</div><h2>Transfer Berhasil</h2><div style="font-size:30px;font-weight:800">${rp(E['Pak Dimas'].sum)}</div><p>Ke BCA 1234567890<br>a.n. DIMAS PRATAMA</p><p>${TODAY} 10:15 WIB</p></body>`);
  const proof=await R.screenshot(); await R.close();
  await A.setInputFiles('#poProof',{name:'bukti.png',mimeType:'image/png',buffer:proof}); await sleep(800);
  ok(await A.evaluate(()=>!!document.querySelector('#poProofBox img')),'foto bukti transfer tampil');
  await A.fill('#poNote','transfer BCA'); await A.click('#poGo'); await sleep(2500);
  ok((await txt(A)).includes('Gaji Pak Dimas tercatat'),'gaji tercatat → slip honor siap');
  ok(await A.evaluate(()=>document.querySelector('.seg-b.on').dataset.fmt==='jpg'&&document.getElementById('slSend').innerText.includes('JPG')),'9 pertemuan → format awal Gambar JPG (bisa dipilih)');
  await A.click('#slSend'); await sleep(1200);
  const wa=await A.evaluate(()=>decodeURIComponent(window.__wa[window.__wa.length-1]||''));
  ok(wa.startsWith('https://wa.me/6281298765432?text=')&&wa.includes(rp(E['Pak Dimas'].sum))&&wa.includes('Terima kasih atas dedikasi'),'WA Pak Dimas terbuka dengan pesan honor + ucapan terima kasih');
  ok(await A.evaluate(()=>window.__clip&&window.__clip.type==='image/png'),'gambar slip tersalin (PC: Ctrl+V di chat WA)');
  // Simpan contoh slip
  const slip=await A.evaluate(async()=>{ const im=document.querySelector('.slip-prev img'); const r=await fetch(im.src); const bl=await r.blob(); return await new Promise(res=>{const fr=new FileReader(); fr.onload=()=>res(fr.result); fr.readAsDataURL(bl);}); });
  fs.writeFileSync(OUT+'gaji_slip_honor.jpg',Buffer.from(slip.split(',')[1],'base64'));
  await A.click('[data-fmt=pdf]'); await sleep(1500);
  ok(await A.evaluate(()=>document.getElementById('slSend').innerText.includes('PDF')&&document.getElementById('slDl').innerText.includes('PDF')),'pilih Dokumen PDF → tombol kirim & unduh jadi PDF');
  const [dl1]=await Promise.all([A.waitForEvent('download'),A.click('#slDl')]);
  const pdf1=fs.readFileSync(await dl1.path());
  ok(pdf1.slice(0,4).toString()==='%PDF'&&dl1.suggestedFilename().endsWith('.pdf'),'unduh slip PDF Pak Dimas: '+dl1.suggestedFilename());
  await A.click('#slClose'); await sleep(1500);
  ok(!(await A.$('[data-gaji]'))&&!(await txt(A)).includes('Waktunya gajian'),'setelah dibayar, tombol & banner gajian hilang');

  console.log('\n[5] Keuangan & aplikasi guru');
  await A.click('[data-tab=keuangan]'); await sleep(1800);
  t=await A.evaluate(()=>document.getElementById('tblPayout')?document.getElementById('tblPayout').innerText:'');
  ok(t.includes('Pak Dimas')&&t.includes(rp(E['Pak Dimas'].sum))&&t.includes('transfer BCA'),'Keuangan → "Gaji sudah dibayar" mencatat slip Pak Dimas');
  await D.reload(); await sleep(3000); await D.click('[data-tab=honor]'); await sleep(500);
  t=await txt(D);
  ok(t.includes('Gaji diterima')&&t.includes(rp(E['Pak Dimas'].sum)),'aplikasi Pak Dimas: "Gaji diterima" '+rp(E['Pak Dimas'].sum));
  const wait=await D.evaluate(()=>document.getElementById('hnWait').textContent);
  ok(wait===rp(E['Pak Dimas'].today||0),'belum dibayar sisa pertemuan hari ini saja: '+wait);
  await D.click('#hnPaid [data-slip]'); await sleep(1500);
  ok(await D.evaluate(()=>{const im=document.querySelector('#slipOverlay img'); return !!im&&im.naturalHeight>500;}),'Pak Dimas membuka slip honornya');
  await D.screenshot({path:OUT+'gaji_honor_guru.png'});

  console.log('\n[6] Besok: giliran Bu Sari');
  const A2=await dev({uid:'gRani',email:'rani@gmail.com'},{w:1440,h:900,clock:TOMORROW+'T09:00:00+07:00'});
  await A2.goto(URL); await sleep(2500); await A2.click('[data-tab=guru]'); await sleep(1500);
  const b2=await A2.evaluate(()=>[...document.querySelectorAll('[data-gaji]')].map(b=>b.innerText));
  const sariDue=E['Bu Sari'].sum+(E['Bu Sari'].today||0);
  ok(b2.length===1&&b2[0].includes('Bayar Gaji '+rp(sariDue))&&b2[0].includes('hari ini gajian'),'besok tombol muncul untuk Bu Sari (termasuk pertemuan hari ini): '+b2.join(' | '));
  const A3P=await dev({uid:'gRani',email:'rani@gmail.com'},{w:1440,h:900,clock:plus(TOMORROW,2)+'T09:00:00+07:00'});
  await A3P.goto(URL); await sleep(2500); await A3P.click('[data-tab=guru]'); await sleep(1500);
  const b3=await A3P.evaluate(()=>[...document.querySelectorAll('[data-gaji]')].map(b=>b.innerText));
  ok(b3.length===1&&b3[0].includes('2 hari terlambat'),'belum dibayar 2 hari setelahnya → tombol tetap ada, "2 hari terlambat"');

  console.log('\n[7] Bayar Bu Sari (banyak pertemuan) → slip PDF');
  const nSari=E['Bu Sari'].n+(E['Bu Sari'].todayN||0);
  await A2.click('.card:has-text("Bu Sari") [data-gaji]'); await sleep(400);
  await A2.setInputFiles('#poProof',{name:'bukti.png',mimeType:'image/png',buffer:proof}); await sleep(800);
  await A2.click('#poGo'); await sleep(3000);
  ok(await A2.evaluate(()=>document.querySelector('.seg-b.on').dataset.fmt==='pdf'&&document.getElementById('slHint').innerText.includes('disarankan')),nSari+' pertemuan → format awal otomatis Dokumen PDF');
  const [dl2]=await Promise.all([A2.waitForEvent('download'),A2.click('#slSend')]); await sleep(800);
  const pdf2=fs.readFileSync(await dl2.path()); fs.writeFileSync(OUT+'gaji_slip_honor_sari.pdf',pdf2);
  const pages=(pdf2.toString('latin1').match(/\/Type\s*\/Page[^s]/g)||[]).length;
  ok(pdf2.slice(0,4).toString()==='%PDF'&&pages>=2,'slip PDF Bu Sari A4 '+pages+' halaman');
  const wa2=await A2.evaluate(()=>decodeURIComponent(window.__wa[window.__wa.length-1]||''));
  ok(wa2.startsWith('https://wa.me/6285711112222?text=')&&wa2.includes(rp(sariDue)),'PC: PDF terunduh + WA Bu Sari terbuka dengan pesan honor');
  ok((await txt(A2)).includes('lampirkan ke chat WA Bu Sari'),'petunjuk melampirkan PDF ke chat WA');
  // Halaman PDF sebagai gambar (untuk dicek mata)
  const Pv=await dev({uid:'gSari',email:'sari@gmail.com'}); await Pv.goto(URL+'guru.html'); await sleep(3000);
  await Pv.click('[data-tab=honor]'); await sleep(500); await Pv.click('#hnPaid [data-slip]'); await sleep(1500);
  const [dl3]=await Promise.all([Pv.waitForEvent('download'),Pv.click('#slPdf')]);
  ok(fs.readFileSync(await dl3.path()).slice(0,4).toString()==='%PDF','aplikasi Bu Sari: unduh slip PDF');

  const errs=[A,A2,A3P,D,S2,Pv].flatMap(p=>p.errs); ok(errs.length===0,'tidak ada error JavaScript'+(errs.length?': '+errs.join(' | '):''));
  console.log(`\nHASIL: ${pass} lulus, ${fail} gagal`); await b.close(); await env.cleanup(); process.exit(fail?1:0);
})().catch(e=>{console.error(e);process.exit(2);});
