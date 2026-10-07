// SIMULASI LANGGANAN LLK V2 (Lembaga): uji coba 31 hari (2 slot: Rani yang ikut mengajar
// + Pak Dimas) → slot penuh → berlangganan Paket Mulai + 1 slot (Rp300.000) untuk Bu Sari → murid meledak, tambah 5 slot
// (Rp449.000/bulan, bayar sisa hari) → langganan habis (absensi terkunci) → perpanjang.
// Midtrans & Cloud Functions diganti tiruan: harga dihitung dengan functions/orgPlans.js
// (kode server asli), aktivasi meniru webhook (OP.nextOrg).
const { chromium } = require('playwright'); const fs=require('fs');
const { initializeTestEnvironment } = require('@firebase/rules-unit-testing');
const { doc, getDoc, getDocs, collection, setDoc, updateDoc, Timestamp } = require('firebase/firestore');
const OP=require('../functions/orgPlans.js');
const FB=__dirname+'/node_modules/firebase/';
const OUT=__dirname+'/out/'; fs.mkdirSync(OUT,{recursive:true});
let pass=0,fail=0; const ok=(c,m)=>{c?pass++:fail++;console.log((c?'  ✅ ':'  ❌ ')+m);};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const rp=n=>'Rp '+n.toLocaleString('id-ID');
const DAY=864e5;
const FAKE_SNAP=`window.snap={pay:function(token,cb){ window.__llkPaid(token).then(function(){ setTimeout(function(){ cb.onSuccess({order_id:token}); },200); }); }};`;
(async()=>{
  let t;
  const env=await initializeTestEnvironment({projectId:'llk-67a30',firestore:{host:'127.0.0.1',port:8089,rules:fs.readFileSync(__dirname+'/../firestore.rules','utf8')}});
  const b=await chromium.launch({executablePath:process.env.CHROME_PATH||undefined});
  const orders={}; let ORG=null;
  const admin=async fn=>{ let r; await env.withSecurityRulesDisabled(async c=>{ r=await fn(c.firestore()); }); return r; };
  const orgNow=async()=>admin(async f=>{ const d=(await getDoc(doc(f,'orgs',ORG))).data(); return {...d,activeUntilMs:d.activeUntil?d.activeUntil.toMillis():0,createdAtMs:d.createdAt.toMillis()}; });
  // ── Server tiruan (createOrgTransaction / checkMidtransPayment) ──
  async function server(name,data){
    if(name==='checkMidtransPayment') return {activated:0,checked:0};
    const org=await orgNow(), now=Date.now();
    const used=await admin(async f=>(await getDocs(collection(f,'orgs',data.orgId,'slots'))).size);
    let o;
    if(data.action==='subscribe'){
      if(OP.ORG_BASE_SLOTS+data.extra<used) throw new Error('Slot terpakai '+used);
      if(OP.orgPaidActive(org,now)&&OP.ORG_BASE_SLOTS+data.extra>org.seats) throw new Error('pakai Tambah Slot');
      o={action:'subscribe',extra:data.extra,period:data.period,grossAmount:OP.periodPrice(data.extra,data.period)};
    } else {
      if(!OP.orgPaidActive(org,now)) throw new Error('belum berlangganan');
      const pr=OP.addSlotsPrice(org,data.add,now); o={action:'addSlots',add:data.add,period:pr.period,days:pr.days,grossAmount:pr.amount};
    }
    const id='LLKO-'+data.orgId.slice(0,8)+'-'+now; o.label=OP.orderLabel(o); orders[id]=o;
    return {token:id,orderId:id,grossAmount:o.grossAmount,env:'sandbox'};
  }
  // Pembeli membayar di Snap → "webhook" mengaktifkan order
  async function paid(id){
    const o=orders[id], org=await orgNow(), now=Date.now(), nx=OP.nextOrg(org,o,now);
    await admin(async f=>{
      await updateDoc(doc(f,'orgs',ORG),{seats:nx.seats,plan:nx.plan,period:nx.period,activeUntil:Timestamp.fromMillis(nx.activeUntilMs),lastOrderId:id});
      await setDoc(doc(f,'orgs',ORG,'invoices',id),{action:o.action,extra:o.extra??null,add:o.add||null,period:o.period,amount:o.grossAmount,label:o.label,seats:nx.seats,activeUntil:Timestamp.fromMillis(nx.activeUntilMs),paidAt:Timestamp.fromMillis(now),by:'gRani'});
    });
    o.paid=true;
  }
  async function dev(user,{w=390,h=844}={}){
    const ctx=await b.newContext({viewport:{width:w,height:h},serviceWorkers:'block',timezoneId:'Asia/Jakarta'});
    await ctx.route('**/*',r=>{const u=r.request().url();
      if(u.startsWith('http://localhost')||u.startsWith('http://127.0.0.1')) return r.continue();
      const m=u.match(/firebasejs\/10\.14\.1\/(firebase-[a-z]+\.js)$/); if(m) return r.fulfill({contentType:'text/javascript',body:fs.readFileSync(FB+m[1],'utf8')});
      if(u==='https://app.sandbox.midtrans.com/snap/snap.js') return r.fulfill({contentType:'text/javascript',body:FAKE_SNAP});
      return r.abort();});
    await ctx.addInitScript(u=>{ window.__LLK_TEST__={host:'127.0.0.1',port:8089,user:u}; window.__wa=[]; window.open=(x)=>{window.__wa.push(x);return null;}; },user);
    const p=await ctx.newPage(); p.errs=[]; p.on('pageerror',e=>p.errs.push(e.message)); p.on('dialog',d=>d.accept());
    await p.exposeFunction('__llkServer',server); await p.exposeFunction('__llkPaid',paid);
    return p;
  }
  const txt=p=>p.evaluate(()=>document.body.innerText);
  const modal=p=>p.evaluate(()=>{const m=document.querySelector('.modal');return m?m.innerText:'';});
  const URL=(process.env.BASE_URL||'http://localhost:8765')+'/v2/';

  console.log('\n[1] Rani membuat lembaga → uji coba 31 hari, 2 slot Guru Mitra');
  const A=await dev({uid:'gRani',email:'rani@gmail.com',displayName:'Rani'},{w:1440,h:900});
  await A.goto(URL); await A.waitForSelector('#rcLembaga',{timeout:15000});
  await A.click('#rcLembaga'); await sleep(300);
  ok((await txt(A)).includes('Uji coba gratis 31 hari')&&(await txt(A)).includes('Rp 200.000'),'form daftar lembaga menjelaskan uji coba 31 hari & harga mulai Rp 200.000');
  await A.fill('#coName','Les Musik Rani'); await A.click('#coGo'); await sleep(2000);
  ORG=await A.evaluate(()=>window.__llk.S.org.id);
  t=await txt(A); ok(t.includes('0 / 2'),'slot Guru Mitra 0/2');
  await A.click('#selfTeach'); await sleep(300); await A.fill('#stHonor','40000'); await A.click('#stGo'); await sleep(1800); await A.click('#gaClose'); await sleep(600);
  ok((await txt(A)).includes('1 / 2'),'Rani juga mengajar → memakai 1 slot (1/2)');
  const G={};
  const inviteJoin=async(n,uid,em)=>{
    await A.click('#addMitra'); await A.fill('#amName',n); await A.fill('#amHonor','40000'); await A.click('#amGo'); await sleep(1200);
    const code=await A.evaluate(()=>document.querySelector('.modal .code-box').textContent.trim()); await A.click('#icClose'); await sleep(600);
    const P=await dev({uid,email:em}); await P.goto(URL+'?kode='+code); await sleep(2500); await P.click('#jJoin'); await sleep(2500);
    G[n]=P;
  };
  await inviteJoin('Pak Dimas','gDimas','dimas@gmail.com');
  await A.click('[data-tab=guru]'); await sleep(1500);
  t=await txt(A);
  ok(t.includes('2 / 2')&&await A.evaluate(()=>document.getElementById('addMitra').disabled)&&!!(await A.$('#addSlot')),'Rani + Pak Dimas → slot penuh 2/2, muncul "Tambah Slot Guru" (Bu Sari belum bisa diundang)');
  await A.click('[data-tab=lainnya]'); await sleep(800);
  t=await txt(A); ok(t.includes('Langganan Lembaga')&&t.includes('UJI COBA')&&t.includes('2 slot Guru Mitra'),'Lainnya → Langganan Lembaga: UJI COBA, 2 slot');

  console.log('\n[2] Layar langganan: harga bertingkat & hemat 5 slot');
  await A.click('[data-tab=guru]'); await sleep(1200); await A.click('#addSlot'); await sleep(800);
  const pay=()=>A.evaluate(()=>document.getElementById('suPay').innerText.trim());
  ok((await pay()).includes(rp(200000)),'0 slot tambahan → Bayar '+rp(200000));
  const plus=async n=>{ for(let i=0;i<n;i++){ await A.click('.modal [data-st="1"]'); await sleep(80); } };
  const minus=async n=>{ for(let i=0;i<n;i++){ await A.click('.modal [data-st="-1"]'); await sleep(80); } };
  const seen=[];
  for(let n=1;n<=5;n++){ await plus(1); seen.push(await pay()); }
  ok([300000,400000,500000,600000,649000].every((v,i)=>seen[i].includes(rp(v))),'tambah 1,2,3,4 slot = +100rb, +200rb, +300rb, +400rb → 5 slot jadi +449rb: '+seen.join(' | '));
  t=await modal(A); ok(t.includes('Hemat Rp 51.000')&&t.includes('7 Guru Mitra'),'5 slot: tanda "Hemat Rp 51.000", total 7 Guru Mitra');
  await minus(1); ok((await modal(A)).includes('Tambah 1 slot lagi cuma +Rp 49.000'),'4 slot: saran "Tambah 1 slot lagi cuma +Rp 49.000"');
  await A.click('[data-per=yearly]'); await sleep(150);
  ok((await pay()).includes(rp(6000000))&&(await modal(A)).includes('bayar 10 bulan, aktif 12 bulan'),'tahunan 4 slot = 10 × Rp 600.000 = Rp 6.000.000');
  await A.screenshot({path:OUT+'langganan_pilih.png'});
  await A.click('[data-per=monthly]'); await minus(3); await sleep(150);
  ok((await pay()).includes(rp(300000)),'Rani memilih Paket Mulai + 1 slot bulanan = Rp 300.000');

  console.log('\n[3] Bayar (Midtrans sandbox) → langganan aktif');
  await A.click('#suPay'); await sleep(6000);
  const o1=Object.values(orders)[0];
  ok(o1&&o1.paid&&o1.grossAmount===300000&&o1.extra===1&&o1.period==='monthly','server menerima order Rp 300.000 (1 slot, bulanan) & lunas');
  t=await txt(A); ok(t.includes('Langganan aktif'),'aplikasi menampilkan "Langganan aktif"');
  let org=await orgNow();
  const trialEnd=org.createdAtMs+31*DAY;
  ok(org.seats===3&&org.plan==='pro'&&Math.abs(org.activeUntilMs-(trialEnd+30*DAY))<5*60e3,'lembaga: 3 slot, aktif sampai sisa uji coba + 30 hari (uji coba tidak hangus)');
  await A.click('#waClose').catch(()=>{}); await A.click('[data-tab=guru]'); await sleep(1500);
  t=await txt(A); ok(t.includes('2 / 3')&&!(await A.evaluate(()=>document.getElementById('addMitra').disabled)),'slot 2/3 → bisa mengundang 1 guru lagi');
  await inviteJoin('Bu Sari','gSari','sari@gmail.com');
  await A.click('[data-tab=guru]'); await sleep(1500);
  t=await txt(A); ok(t.includes('3 / 3')&&t.includes('Bu Sari')&&t.includes('Guru Mitra aktif (3)'),'Bu Sari bergabung → Rani, Pak Dimas, Bu Sari (3/3) dengan Rp 300.000');

  console.log('\n[4] Murid meledak: tambah 5 slot sekaligus');
  await A.click('[data-tab=lainnya]'); await sleep(1200);
  t=await txt(A); ok(t.includes('AKTIF')&&t.includes('Riwayat pembayaran')&&t.includes(rp(300000)),'Lainnya: AKTIF + riwayat pembayaran Rp 300.000');
  await A.click('#subAdd'); await sleep(600);
  for(let i=0;i<4;i++){ await A.click('.modal [data-st="1"]'); await sleep(80); }
  t=await modal(A);
  org=await orgNow(); const exp=OP.addSlotsPrice(org,5,Date.now());
  ok(t.includes('8 Guru Mitra')&&t.includes(rp(749000)+'/bulan')&&t.includes('Hemat Rp 51.000'),'5 slot tambahan → 8 Guru Mitra, perpanjangan berikutnya Rp 749.000/bulan, hemat Rp 51.000');
  ok(exp.days>=29&&exp.days<=30&&t.includes(exp.days+' hari tersisa')&&t.includes('gratis selama sisa uji coba')&&(await A.evaluate(()=>document.getElementById('asPay').innerText)).includes(rp(exp.amount)),'bayar hanya '+exp.days+' hari berbayar (sisa uji coba gratis): '+rp(exp.amount));
  await A.screenshot({path:OUT+'langganan_tambah_slot.png'});
  await A.click('#asPay'); await sleep(6000);
  org=await orgNow();
  ok(org.seats===8&&Math.abs(org.activeUntilMs-(trialEnd+30*DAY))<5*60e3,'slot jadi 8, masa aktif tetap');
  await A.click('#waClose').catch(()=>{}); await A.click('[data-tab=guru]'); await sleep(1500);
  ok((await txt(A)).includes('3 / 8'),'tab Guru: slot 3/8');

  console.log('\n[5] Langganan habis → absensi terkunci, data aman');
  await admin(f=>updateDoc(doc(f,'orgs',ORG),{activeUntil:Timestamp.fromMillis(Date.now()-DAY)}));
  await A.reload(); await sleep(3000);
  t=await txt(A);
  ok(t.includes('Langganan lembaga berakhir')&&t.includes('Perpanjang')&&await A.evaluate(()=>document.getElementById('addMitra').disabled),'Admin: banner "Langganan lembaga berakhir", tidak bisa mengundang guru');
  await A.screenshot({path:OUT+'langganan_habis_admin.png'});
  const D=G['Pak Dimas']; await D.reload(); await sleep(3000);
  t=await txt(D); ok(t.includes('Langganan Les Musik Rani sudah berakhir'),'aplikasi Pak Dimas: absensi dikunci, minta Admin memperpanjang');
  await D.screenshot({path:OUT+'langganan_habis_guru.png'});

  console.log('\n[6] Perpanjang 1 bulan');
  await A.click('#subBtn'); await sleep(800);
  t=await modal(A);
  ok((await pay()).includes(rp(749000))&&t.includes('8 Guru Mitra'),'Perpanjang: slot tetap 8 → Rp 749.000');
  await A.click('#suPay'); await sleep(6000);
  org=await orgNow();
  ok(org.activeUntilMs>Date.now()+29*DAY&&org.seats===8,'aktif lagi 30 hari');
  await A.click('#waClose').catch(()=>{}); await A.reload(); await sleep(2500);
  ok(!(await txt(A)).includes('Langganan lembaga berakhir'),'banner hilang');
  await D.reload(); await sleep(3000);
  ok(!(await txt(D)).includes('sudah berakhir'),'aplikasi Pak Dimas bisa absen lagi');
  await A.click('[data-tab=lainnya]'); await sleep(1500);
  await A.screenshot({path:OUT+'langganan_lainnya.png',fullPage:true});
  const inv=await admin(async f=>(await getDocs(collection(f,'orgs',ORG,'invoices'))).size);
  ok(inv===3,'riwayat pembayaran: 3 kali bayar');

  const errs=[A,...Object.values(G)].flatMap(p=>p.errs); ok(errs.length===0,'tidak ada error JavaScript'+(errs.length?': '+errs.join(' | '):''));
  console.log(`\nHASIL: ${pass} lulus, ${fail} gagal`); await b.close(); await env.cleanup(); process.exit(fail?1:0);
})().catch(e=>{console.error(e);process.exit(2);});
