import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, writeBatch, collection, query, where, getDocs, Timestamp, serverTimestamp } from 'firebase/firestore';
import fs from 'fs';
let pass=0, fail=0;
async function t(name, p){ try{ await p; pass++; console.log('  ✅', name); }catch(e){ fail++; console.log('  ❌', name, '—', e.message); } }
const env = await initializeTestEnvironment({ projectId:'demo-llk', firestore:{ rules: fs.readFileSync(new URL('../firestore.rules', import.meta.url),'utf8'), host:'127.0.0.1', port:8089 } });
const as = (uid,email)=>env.authenticatedContext(uid,{email}).firestore();
const admin=as('admin1','admin@x.com'), mitra=as('mitra1','mitra@x.com'), other=as('other1','other@x.com'), mitra2=as('mitra2','m2@x.com');
const future=Timestamp.fromMillis(Date.now()+7*864e5), past=Timestamp.fromMillis(Date.now()-864e5);

async function createOrg(db, u, orgId, extra={}){
  const b=writeBatch(db);
  b.set(doc(db,'orgs',orgId),{name:'Les Ceria',logo:null,ownerUid:u,seats:2,plan:'trial',createdAt:serverTimestamp(),...extra});
  b.set(doc(db,'orgs',orgId,'members',u),{role:'admin',name:'Admin',email:'admin@x.com',joinedAt:serverTimestamp()});
  b.set(doc(db,'users',u),{orgId,orgRole:'admin',mode:'lembaga'});
  return b.commit();
}
function inviteBatch(db, orgId, code, slot, opts={}){
  const b=writeBatch(db);
  b.set(doc(db,'invites',code),{orgId,orgName:'Les Ceria',name:opts.name||'Budi',honor:opts.honor??30000,emailLock:opts.emailLock??null,slot,status:'open',createdBy:opts.by||'admin1',createdAt:serverTimestamp(),expiresAt:opts.expiresAt||future});
  b.set(doc(db,'orgs',orgId,'slots',String(slot)),{kind:'invite',code});
  return b.commit();
}
function redeemBatch(db, u, email, code, orgId, slot, inv){
  const b=writeBatch(db);
  b.update(doc(db,'invites',code),{status:'used',usedBy:u,usedAt:serverTimestamp()});
  b.set(doc(db,'orgs',orgId,'members',u),{role:'mitra',name:inv.name,email,honor:inv.honor,inviteCode:code,slot,sheetLink:'',joinedAt:serverTimestamp()});
  b.update(doc(db,'orgs',orgId,'slots',String(slot)),{kind:'member',code,uid:u});
  b.set(doc(db,'users',u),{orgId,orgRole:'mitra',mode:'lembaga'});
  return b.commit();
}

console.log('\n[Lembaga]');
await t('Admin membuat lembaga', assertSucceeds(createOrg(admin,'admin1','org1')));
await t('Tidak bisa membuat lembaga atas nama orang lain', assertFails(createOrg(other,'admin1','orgX')));
await t('Tidak bisa membuat lembaga dengan kursi 50', assertFails(createOrg(other,'other1','orgY',{seats:50})));
await t('Orang luar tidak bisa membaca lembaga', assertFails(getDoc(doc(other,'orgs','org1'))));
await t('Admin tidak bisa menambah kursi sendiri', assertFails(updateDoc(doc(admin,'orgs','org1'),{seats:99})));
await t('Admin bisa ganti nama lembaga', assertSucceeds(updateDoc(doc(admin,'orgs','org1'),{name:'Les Ceria Baru'})));
await t('Lembaga baru: uji coba 2 slot (bukan 5)', assertFails(createOrg(other,'other1','orgY',{seats:5})));
await t('Tanggal dibuat tidak bisa dimundurkan/dimajukan (uji coba abadi)', assertFails(createOrg(other,'other1','orgY',{createdAt:Timestamp.fromMillis(Date.now()+400*864e5)})));
await t('Admin tidak bisa memperpanjang langganan sendiri', assertFails(updateDoc(doc(admin,'orgs','org1'),{activeUntil:Timestamp.fromMillis(Date.now()+999*864e5),plan:'pro'})));
// Selanjutnya org1 dianggap sudah berlangganan 5 slot (diisi server setelah bayar)
const paid=async o=>env.withSecurityRulesDisabled(async c=>{ await updateDoc(doc(c.firestore(),'orgs',o),{seats:5,plan:'pro',period:'monthly',activeUntil:Timestamp.fromMillis(Date.now()+30*864e5)}); });
await paid('org1');

console.log('\n[Undangan]');
await t('Admin membuat undangan (kursi 1)', assertSucceeds(inviteBatch(admin,'org1','LLK-AAAA-1111',1)));
await t('Kursi yang sama tidak bisa dipakai 2 undangan', assertFails(inviteBatch(admin,'org1','LLK-AAAA-2222',1)));
await t('Kursi ke-6 (melebihi paket) ditolak', assertFails(inviteBatch(admin,'org1','LLK-AAAA-6666',6)));
await t('Orang luar tidak bisa membuat undangan', assertFails(inviteBatch(other,'org1','LLK-AAAA-3333',2,{by:'other1'})));
await t('Undangan > 8 hari ditolak', assertFails(inviteBatch(admin,'org1','LLK-AAAA-4444',2,{expiresAt:Timestamp.fromMillis(Date.now()+30*864e5)})));
await t('Admin melihat daftar undangan lembaganya', assertSucceeds(getDocs(query(collection(admin,'invites'),where('orgId','==','org1')))));
await t('Orang luar tidak bisa melihat daftar undangan', assertFails(getDocs(query(collection(other,'invites'),where('orgId','==','org1')))));
await t('Siapa pun yang login bisa membuka 1 kode', assertSucceeds(getDoc(doc(mitra,'invites','LLK-AAAA-1111'))));

console.log('\n[Bergabung sebagai Mitra]');
await t('Mitra tidak bisa memalsukan honor saat bergabung', assertFails(redeemBatch(mitra,'mitra1','mitra@x.com','LLK-AAAA-1111','org1',1,{name:'Budi',honor:999999})));
await t('Mitra bergabung dengan kode', assertSucceeds(redeemBatch(mitra,'mitra1','mitra@x.com','LLK-AAAA-1111','org1',1,{name:'Budi',honor:30000})));
await t('Kode yang sudah dipakai tidak bisa dipakai lagi', assertFails(redeemBatch(mitra2,'mitra2','m2@x.com','LLK-AAAA-1111','org1',1,{name:'Budi',honor:30000})));
await t('Mitra bisa membaca lembaganya', assertSucceeds(getDoc(doc(mitra,'orgs','org1'))));
await t('Mitra bisa membaca data & honornya sendiri', assertSucceeds(getDoc(doc(mitra,'orgs','org1','members','mitra1'))));
await t('Mitra tidak bisa membaca data anggota lain', assertFails(getDoc(doc(mitra,'orgs','org1','members','admin1'))));
await t('Mitra tidak bisa menaikkan honornya', assertFails(updateDoc(doc(mitra,'orgs','org1','members','mitra1'),{honor:100000})));
await t('Mitra bisa mengisi link spreadsheet absensinya', assertSucceeds(updateDoc(doc(mitra,'orgs','org1','members','mitra1'),{sheetLink:'https://docs.google.com/x'})));
await t('Mitra tidak bisa membuat undangan', assertFails(inviteBatch(mitra,'org1','LLK-BBBB-1111',2,{by:'mitra1'})));
await t('Mitra tidak bisa menjadikan dirinya admin', assertFails(updateDoc(doc(mitra,'orgs','org1','members','mitra1'),{role:'admin'})));
await t('Admin bisa mengubah honor Mitra', assertSucceeds(updateDoc(doc(admin,'orgs','org1','members','mitra1'),{honor:35000})));

console.log('\n[Kunci Gmail & kedaluwarsa]');
await t('Admin membuat undangan terkunci Gmail', assertSucceeds(inviteBatch(admin,'org1','LLK-CCCC-1111',2,{emailLock:'sinta@x.com',name:'Sinta'})));
await t('Gmail lain tidak bisa memakai undangan terkunci', assertFails(redeemBatch(mitra2,'mitra2','m2@x.com','LLK-CCCC-1111','org1',2,{name:'Sinta',honor:30000})));
const sinta=as('sinta1','sinta@x.com');
await t('Gmail yang benar bisa memakai undangan terkunci', assertSucceeds(redeemBatch(sinta,'sinta1','sinta@x.com','LLK-CCCC-1111','org1',2,{name:'Sinta',honor:30000})));
await env.withSecurityRulesDisabled(async c=>{ const db=c.firestore(); await setDoc(doc(db,'invites','LLK-DDDD-1111'),{orgId:'org1',orgName:'x',name:'Lama',honor:1,emailLock:null,slot:3,status:'open',createdBy:'admin1',expiresAt:past}); await setDoc(doc(db,'orgs','org1','slots','3'),{kind:'invite',code:'LLK-DDDD-1111'}); });
await t('Undangan kedaluwarsa tidak bisa dipakai', assertFails(redeemBatch(mitra2,'mitra2','m2@x.com','LLK-DDDD-1111','org1',3,{name:'Lama',honor:1})));
await t('Admin bisa mengosongkan kursi undangan kedaluwarsa', assertSucceeds(deleteDoc(doc(admin,'orgs','org1','slots','3'))));

console.log('\n[Cabut & keluarkan]');
await t('Admin membuat undangan lalu mencabutnya', assertSucceeds((async()=>{ await inviteBatch(admin,'org1','LLK-EEEE-1111',3); const b=writeBatch(admin); b.update(doc(admin,'invites','LLK-EEEE-1111'),{status:'revoked'}); b.delete(doc(admin,'orgs','org1','slots','3')); await b.commit(); })()));
await t('Kursi Mitra aktif tidak bisa dikosongkan tanpa mengeluarkan Mitra', assertFails(deleteDoc(doc(admin,'orgs','org1','slots','1'))));
await t('Admin mengeluarkan Mitra + mengosongkan kursi', assertSucceeds((async()=>{ const b=writeBatch(admin); b.delete(doc(admin,'orgs','org1','members','mitra1')); b.delete(doc(admin,'orgs','org1','slots','1')); await b.commit(); })()));
await t('Mitra yang dikeluarkan tidak bisa membaca lembaga lagi', assertFails(getDoc(doc(mitra,'orgs','org1'))));
await t('Admin tidak bisa dihapus', assertFails(deleteDoc(doc(admin,'orgs','org1','members','admin1'))));
await t('Mitra keluar sendiri + kosongkan kursinya', assertSucceeds((async()=>{ const b=writeBatch(sinta); b.delete(doc(sinta,'orgs','org1','members','sinta1')); b.delete(doc(sinta,'orgs','org1','slots','2')); b.set(doc(sinta,'users','sinta1'),{orgId:null,mode:'lepas'}); await b.commit(); })()));

console.log('\n[Satu lembaga per akun]');
await createOrg(as('admin2','a2@x.com'),'admin2','org2'); await paid('org2');
await inviteBatch(as('admin2','a2@x.com'),'org2','LLK-FFFF-1111',1,{by:'admin2'});
await t('Admin lembaga 1 tidak bisa jadi Mitra di lembaga 2', assertFails(redeemBatch(admin,'admin1','admin@x.com','LLK-FFFF-1111','org2',1,{name:'Budi',honor:30000})));
await t('users.orgId tidak bisa diisi lembaga yang bukan miliknya', assertFails(setDoc(doc(other,'users','other1'),{orgId:'org1'})));

console.log('\n[Kursi penuh]');
for(let i=1;i<=5;i++){ if(i===1||i===2||i===3) await inviteBatch(admin,'org1','LLK-GGGG-000'+i,i).catch(()=>{}); else await inviteBatch(admin,'org1','LLK-GGGG-000'+i,i); }
await t('Undangan ke-6 saat 5 kursi penuh ditolak', assertFails(inviteBatch(admin,'org1','LLK-GGGG-0006',6)));

console.log('\n[Tahap 2: pelajaran, murid, jadwal]');
const a2=as('admin2','a2@x.com'), m3=as('mitra3','m3@x.com');
await t('Mitra bergabung ke lembaga 2', assertSucceeds(redeemBatch(mitra2,'mitra2','m2@x.com','LLK-FFFF-1111','org2',1,{name:'Budi',honor:30000})));
await inviteBatch(a2,'org2','LLK-HHHH-1111',2,{by:'admin2',name:'Rina'});
await redeemBatch(m3,'mitra3','m3@x.com','LLK-HHHH-1111','org2',2,{name:'Rina',honor:30000});
await t('Admin menambah mata pelajaran', assertSucceeds(setDoc(doc(a2,'orgs','org2','subjects','piano'),{name:'Piano',rate:50000,active:true})));
await t('Tarif pelajaran harus angka', assertFails(setDoc(doc(a2,'orgs','org2','subjects','gitar'),{name:'Gitar',rate:'50rb',active:true})));
await t('Mitra tidak bisa membaca tarif pelajaran', assertFails(getDoc(doc(mitra2,'orgs','org2','subjects','piano'))));
await t('Mitra tidak bisa menambah pelajaran', assertFails(setDoc(doc(mitra2,'orgs','org2','subjects','x'),{name:'X',rate:1,active:true})));
const stu={name:'Brilian',parentName:'Bu Rina',phone:'08123',note:'',active:true,classes:[{id:'c1',subjectId:'piano',mitraUid:'mitra2',rate:null,schedule:[{day:'Senin',start:'14:00',end:'15:00'}]}]};
const sch={studentId:'s1',studentName:'Brilian',subjectId:'piano',subjectName:'Piano',mitraUid:'mitra2',schedule:[{day:'Senin',start:'14:00',end:'15:00'}],active:true};
await t('Admin menyimpan murid + jadwal kelas', assertSucceeds((async()=>{ const b=writeBatch(a2); b.set(doc(a2,'orgs','org2','students','s1'),stu); b.set(doc(a2,'orgs','org2','sched','c1'),sch); await b.commit(); })()));
await t('Mitra TIDAK bisa membaca data murid (No HP ortu)', assertFails(getDoc(doc(mitra2,'orgs','org2','students','s1'))));
await t('Mitra TIDAK bisa melihat daftar murid', assertFails(getDocs(collection(mitra2,'orgs','org2','students'))));
await t('Mitra membaca jadwal kelas miliknya', assertSucceeds(getDocs(query(collection(mitra2,'orgs','org2','sched'),where('mitraUid','==','mitra2')))));
await t('Mitra lain tidak bisa membaca jadwal kelas itu', assertFails(getDoc(doc(m3,'orgs','org2','sched','c1'))));
await t('Mitra tidak bisa membaca semua jadwal sekaligus', assertFails(getDocs(collection(m3,'orgs','org2','sched'))));
await t('Jadwal kelas tidak boleh memuat No HP', assertFails(setDoc(doc(a2,'orgs','org2','sched','c2'),{...sch,phone:'08123'})));
await t('Mitra tidak bisa memindahkan kelas ke dirinya', assertFails(updateDoc(doc(m3,'orgs','org2','sched','c1'),{mitraUid:'mitra3'})));
await t('Mitra tidak bisa menambah murid', assertFails(setDoc(doc(mitra2,'orgs','org2','students','s2'),stu)));
await t('Admin lembaga lain tidak bisa membaca murid', assertFails(getDoc(doc(admin,'orgs','org2','students','s1'))));
console.log('\n[Tahap 3: absensi]');
const todayWIB=(()=>{ const d=new Date(Date.now()+7*3600e3); return d.toISOString().slice(0,10); })();
// 2 hari lalu (bukan kemarin): aturan memberi kelonggaran s/d ±01.00 WIB untuk tanggal kemarin (zona WITA/WIT)
const yest=(()=>{ const d=new Date(Date.now()+7*3600e3-2*864e5); return d.toISOString().slice(0,10); })();
const att=(o={})=>({classId:'c1',studentId:'s1',studentName:'Brilian',subjectName:'Piano',mitraUid:'mitra2',date:todayWIB,start:'14:00',end:'15:00',status:'hadir',progress:'Tangga nada C',prSiswa:'',prGuru:'',reason:'',honor:30000,by:'mitra2',...o});
const aref=(db,d=todayWIB,c='c1')=>doc(db,'orgs','org2','att',c+'_'+d);
await t('Mitra mengisi Hadir + progres hari ini', assertSucceeds(setDoc(aref(mitra2),att())));
await t('Hadir tanpa progres ditolak', assertFails(setDoc(aref(mitra2),att({progress:'  '}))));
await t('Mitra tidak bisa mengisi Izin', assertFails(setDoc(aref(mitra2),att({status:'izin'}))));
await t('Mitra tidak bisa menaikkan honor di absensi', assertFails(setDoc(aref(mitra2),att({honor:99999}))));
await t('Mitra tidak bisa mengisi tanggal 2 hari lalu', assertFails(setDoc(aref(mitra2,yest),att({date:yest}))));
await t('Mitra tidak bisa mengabsen kelas guru lain', assertFails(setDoc(aref(m3),att({mitraUid:'mitra3',by:'mitra3'}))));
await t('Mitra lain tidak bisa membaca absensi itu', assertFails(getDoc(aref(m3))));
await t('Mitra mengubah jadi Alpa (hari yang sama)', assertSucceeds(setDoc(aref(mitra2),att({status:'alpa',progress:''}))));
await t('Mitra membaca absensinya sendiri', assertSucceeds(getDocs(query(collection(mitra2,'orgs','org2','att'),where('mitraUid','==','mitra2')))));
await env.withSecurityRulesDisabled(async c=>{ await setDoc(doc(c.firestore(),'orgs','org2','att','c1_'+yest),att({date:yest})); });
await t('Mitra tidak bisa mengubah absensi 2 hari lalu', assertFails(setDoc(aref(mitra2,yest),att({date:yest,progress:'ubah'}))));
await t('Mitra tidak bisa menghapus absensi 2 hari lalu', assertFails(deleteDoc(aref(mitra2,yest))));
await env.withSecurityRulesDisabled(async c=>{ await setDoc(doc(c.firestore(),'orgs','org2','sched','c9'),{...sch,studentId:'s9'}); });
await t('Admin mengisi Izin', assertSucceeds(setDoc(aref(a2,todayWIB,'c9'),att({classId:'c9',status:'izin',progress:'',reason:'Sakit',honor:0,by:'admin2'}))));
await t('Mitra tidak bisa menimpa Izin dari Admin', assertFails(setDoc(aref(mitra2,todayWIB,'c9'),att({classId:'c9'}))));
await t('Admin bisa mengoreksi absensi 2 hari lalu', assertSucceeds(setDoc(aref(a2,yest),att({date:yest,progress:'dikoreksi',by:'admin2'}))));
await t('Mitra menghapus tanda hari ini', assertSucceeds(deleteDoc(aref(mitra2))));

await t('Admin bisa menghapus murid + jadwalnya', assertSucceeds((async()=>{ const b=writeBatch(a2); b.delete(doc(a2,'orgs','org2','students','s1')); b.delete(doc(a2,'orgs','org2','sched','c1')); await b.commit(); })()));

console.log('\n[Guru Admin juga mengajar (aplikasi Guru Mitra)]');
const selfTeach=(db,u,o,slot=0,honor=0)=>{ const b=writeBatch(db); b.update(doc(db,'orgs',o,'members',u),{teaches:true,honor,slot}); b.set(doc(db,'orgs',o,'slots',String(slot)),{kind:'self',uid:u}); return b.commit(); };
await t('Admin mengajar tidak bisa memakai slot berbayar', assertFails(selfTeach(a2,'admin2','org2',3,25000)));
await t('Admin mendaftarkan dirinya sebagai guru (slot 0, gratis)', assertSucceeds(selfTeach(a2,'admin2','org2',0,25000)));
await t('Kursi "self" tidak bisa dibuat untuk orang lain', assertFails((async()=>{ const b=writeBatch(a2); b.set(doc(a2,'orgs','org2','slots','4'),{kind:'self',uid:'mitra2'}); await b.commit(); })()));
await t('Mitra tidak bisa mengubah dirinya jadi admin lewat field baru', assertFails(updateDoc(doc(mitra2,'orgs','org2','members','mitra2'),{teaches:true})));
await t('Kursi "self" tidak bisa dikosongkan selama Admin masih mengajar', assertFails(deleteDoc(doc(a2,'orgs','org2','slots','0'))));
await t('Admin berhenti mengajar + kosongkan kursinya', assertSucceeds((async()=>{ const b=writeBatch(a2); b.update(doc(a2,'orgs','org2','members','admin2'),{teaches:false}); b.delete(doc(a2,'orgs','org2','slots','0')); await b.commit(); })()));

console.log('\n[Keuangan]');
const pay={studentId:'s1',studentName:'Brilian',classId:'c1',subjectName:'Piano',sessions:4,amount:400000,rate:100000,date:'2026-10-01',note:'',by:'admin2'};
await t('Admin mencatat pembayaran paket', assertSucceeds(setDoc(doc(a2,'orgs','org2','payments','p1'),pay)));
await t('Pembayaran harus angka', assertFails(setDoc(doc(a2,'orgs','org2','payments','p2'),{...pay,amount:'400rb'})));
await t('Mitra tidak bisa melihat pembayaran', assertFails(getDoc(doc(mitra2,'orgs','org2','payments','p1'))));
await t('Mitra tidak bisa mencatat pembayaran', assertFails(setDoc(doc(mitra2,'orgs','org2','payments','p3'),pay)));
await t('Admin menyimpan pengaturan paket', assertSucceeds(setDoc(doc(a2,'orgs','org2','settings','billing'),{cycle:4})));
await t('Mitra tidak bisa membaca pengaturan', assertFails(getDoc(doc(mitra2,'orgs','org2','settings','billing'))));

console.log('\n[Penggajian]');
await t('Guru mengisi rekening & No WA sendiri', assertSucceeds(updateDoc(doc(mitra2,'orgs','org2','members','mitra2'),{bank:{bank:'BCA',number:'1234567890',holder:'Budi'},phone:'08123'})));
await t('Rekening dengan field aneh ditolak', assertFails(updateDoc(doc(mitra2,'orgs','org2','members','mitra2'),{bank:{bank:'BCA',number:'1',holder:'B',pin:'1234'}})));
await t('Guru tidak bisa mengisi tanggal gajiannya sendiri', assertFails(updateDoc(doc(mitra2,'orgs','org2','members','mitra2'),{payDay:1})));
await t('Admin mengatur tanggal gajian guru', assertSucceeds(updateDoc(doc(a2,'orgs','org2','members','mitra2'),{payDay:25})));
await t('Admin menyimpan tanggal mulai gajian', assertSucceeds(updateDoc(doc(a2,'orgs','org2','members','mitra2'),{payDay:10,payDaySince:'2026-10-07'})));
await t('Guru tidak bisa mengubah tanggal mulai gajiannya', assertFails(updateDoc(doc(mitra2,'orgs','org2','members','mitra2'),{payDaySince:'2020-01-01'})));
await t('Tanggal mulai gajian bukan tanggal ditolak', assertFails(updateDoc(doc(a2,'orgs','org2','members','mitra2'),{payDaySince:'kemarin'})));
await t('Tanggal gajian 32 ditolak', assertFails(updateDoc(doc(a2,'orgs','org2','members','mitra2'),{payDay:32})));
const po={mitraUid:'mitra2',mitraName:'Budi',periodFrom:'2026-09-25',periodTo:'2026-10-24',attIds:['c1_2026-10-01'],hadir:1,alpa:0,sessions:1,total:30000,paidDate:'2026-10-25',bank:{bank:'BCA',number:'1234567890',holder:'Budi'},proof:'data:image/jpeg;base64,AAAA',note:'',by:'admin2'};
await t('Admin mencatat gaji dibayar + bukti transfer', assertSucceeds(setDoc(doc(a2,'orgs','org2','payouts','g1'),po)));
await t('Guru membaca slip gajinya sendiri', assertSucceeds(getDocs(query(collection(mitra2,'orgs','org2','payouts'),where('mitraUid','==','mitra2')))));
await t('Guru lain tidak bisa membaca slip gaji itu', assertFails(getDoc(doc(m3,'orgs','org2','payouts','g1'))));
await t('Guru tidak bisa membuat slip gaji sendiri', assertFails(setDoc(doc(mitra2,'orgs','org2','payouts','g2'),po)));

console.log('\n[Langganan lembaga]');
await env.withSecurityRulesDisabled(async c=>{ const f=c.firestore();
  await setDoc(doc(f,'orgs','org2','invoices','LLKO-1'),{action:'subscribe',amount:300000,seats:3});
  await setDoc(doc(f,'orgs','org2','sched','c8'),{...sch,studentId:'s8'}); });
await t('Admin melihat riwayat pembayaran langganan', assertSucceeds(getDoc(doc(a2,'orgs','org2','invoices','LLKO-1'))));
await t('Guru Mitra tidak bisa melihat riwayat langganan', assertFails(getDoc(doc(mitra2,'orgs','org2','invoices','LLKO-1'))));
await t('Admin tidak bisa memalsukan riwayat pembayaran', assertFails(setDoc(doc(a2,'orgs','org2','invoices','LLKO-2'),{action:'subscribe',amount:1})));
const a3=as('admin3','a3@x.com');
await createOrg(a3,'admin3','org3');
await t('Uji coba: slot 1 & 2 bisa dipakai', assertSucceeds((async()=>{ await inviteBatch(a3,'org3','LLK-JJJJ-0001',1,{by:'admin3'}); await inviteBatch(a3,'org3','LLK-JJJJ-0002',2,{by:'admin3'}); })()));
await t('Uji coba: slot ke-3 ditolak (harus berlangganan)', assertFails(inviteBatch(a3,'org3','LLK-JJJJ-0003',3,{by:'admin3'})));
await t('Admin mengajar tetap bisa walau 2 slot penuh (gratis)', assertSucceeds(selfTeach(a3,'admin3','org3',0,30000)));
await setDoc(doc(a2,'orgs','org2','students','s5'),{...stu,name:'Citra'});
const expire=(o,ms)=>env.withSecurityRulesDisabled(async c=>{ await updateDoc(doc(c.firestore(),'orgs',o),{activeUntil:Timestamp.fromMillis(Date.now()+ms)}); });
await expire('org2',-864e5);
await t('Langganan habis: Guru Mitra tidak bisa absen', assertFails(setDoc(aref(mitra2,todayWIB,'c8'),att({classId:'c8',studentId:'s8'}))));
await t('Langganan habis: Guru Mitra masih bisa membaca lembaga & absensinya', assertSucceeds(getDocs(query(collection(mitra2,'orgs','org2','att'),where('mitraUid','==','mitra2')))));
await t('Langganan habis: Admin tidak bisa menambah murid', assertFails(setDoc(doc(a2,'orgs','org2','students','s6'),{...stu,name:'Dodi'})));
await t('Langganan habis: data murid lama tetap bisa diubah', assertSucceeds(updateDoc(doc(a2,'orgs','org2','students','s5'),{note:'catatan'})));
await t('Langganan habis: Admin tidak bisa mengundang guru', assertFails(inviteBatch(a2,'org2','LLK-KKKK-0004',4,{by:'admin2'})));
await t('Langganan habis: Admin tetap bisa mengisi Izin', assertSucceeds(setDoc(aref(a2,todayWIB,'c8'),att({classId:'c8',studentId:'s8',status:'izin',progress:'',reason:'Sakit',honor:0,by:'admin2'}))));
await env.withSecurityRulesDisabled(async c=>{ await deleteDoc(doc(c.firestore(),'orgs','org2','att','c8_'+todayWIB)); });
await expire('org2',30*864e5);
await t('Diperpanjang: Guru Mitra bisa absen lagi', assertSucceeds(setDoc(aref(mitra2,todayWIB,'c8'),att({classId:'c8',studentId:'s8'}))));
await env.withSecurityRulesDisabled(async c=>{ await updateDoc(doc(c.firestore(),'orgs','org3'),{createdAt:Timestamp.fromMillis(Date.now()-32*864e5)}); });
await t('Uji coba lewat 31 hari: Admin tidak bisa menambah murid', assertFails(setDoc(doc(a3,'orgs','org3','students','s1'),{...stu})));

console.log('\n[V1 tetap aman]');
await t('Guru Lepas bisa baca/tulis backup miliknya', assertSucceeds(setDoc(doc(other,'backups','other1','parts','students'),{data:[]})));
await t('Orang lain tidak bisa baca backup milik orang lain', assertFails(getDoc(doc(mitra,'backups','other1','parts','students'))));
await t('subscriptions tetap tidak bisa ditulis', assertFails(setDoc(doc(other,'subscriptions','other1'),{status:'active'})));

console.log(`\nHASIL: ${pass} lulus, ${fail} gagal`);
await env.cleanup();
process.exit(fail?1:0);
