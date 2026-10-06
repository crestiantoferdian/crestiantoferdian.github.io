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
  b.set(doc(db,'orgs',orgId),{name:'Les Ceria',logo:null,ownerUid:u,seats:5,plan:'trial',createdAt:serverTimestamp(),...extra});
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
await createOrg(as('admin2','a2@x.com'),'admin2','org2');
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
await t('Admin bisa menghapus murid + jadwalnya', assertSucceeds((async()=>{ const b=writeBatch(a2); b.delete(doc(a2,'orgs','org2','students','s1')); b.delete(doc(a2,'orgs','org2','sched','c1')); await b.commit(); })()));

console.log('\n[V1 tetap aman]');
await t('Guru Lepas bisa baca/tulis backup miliknya', assertSucceeds(setDoc(doc(other,'backups','other1','parts','students'),{data:[]})));
await t('Orang lain tidak bisa baca backup milik orang lain', assertFails(getDoc(doc(mitra,'backups','other1','parts','students'))));
await t('subscriptions tetap tidak bisa ditulis', assertFails(setDoc(doc(other,'subscriptions','other1'),{status:'active'})));

console.log(`\nHASIL: ${pass} lulus, ${fail} gagal`);
await env.cleanup();
process.exit(fail?1:0);
