// Simulasi V1 (Playwright): reschedule vs hitungan tagihan + fitur Sesuaikan Pertemuan.
// Jalankan: dari root repo 'python3 -m http.server 8765' lalu 'node tests/v1-reschedule.sim.cjs'. Jam dipalsukan, Firebase diblokir (mode lokal).
const {chromium}=require('playwright');
(async()=>{
 const b=await chromium.launch(); const ctx=await b.newContext({viewport:{width:412,height:900}});
 await ctx.route(/^https?:\/\/(?!localhost)/, r=>r.abort());
 const p=await ctx.newPage(); p.on('pageerror',e=>console.log('PAGEERR',e.message));
 await p.clock.setFixedTime(new Date('2026-10-26T10:00:00'));
 await p.addInitScript(()=>{try{sessionStorage.setItem('llk_v1_tab','1');localStorage.setItem('llk_v2_choice','lepas');}catch(e){}});
 await p.goto('http://localhost:8765/index.html'); await p.waitForTimeout(2500);
 await p.evaluate(()=>{window._T=[];const o=window.toast;window.toast=function(m){_T.push(String(m).replace(/<[^>]+>/g,''));try{return o.apply(this,arguments);}catch(e){}};
   document.querySelectorAll('.overlay.open').forEach(x=>x.classList.remove('open'));});
 const mk=(name,extra)=>Object.assign({name,day:'Senin',time:'15:00',time2:'16:00',instrument:'Piano',payCycle:4,rate:100000,payTiming:'belakang',startDate:'2026-10-01',phone:'',extraDates:[],reschedules:[]},extra||{});
 const studs=[mk('A_hadir'),mk('A_izin'),mk('A_alpa'),mk('B_asal'),mk('C_maju'),mk('D_samahari'),
  mk('E_2hari',{day2:'Rabu',time2a:'15:00',time2b:'16:00'}),mk('F_tambahan'),mk('G_riwayat'),
  mk('H_lama',{reschedules:[{day:'Senin',date:'2026-11-04',time:'15:00',time2:''}]}), mk('I_edit')];
 await p.evaluate(s=>{students=s;save();render();},studs);
 const day=async(dk)=>{await p.clock.setFixedTime(new Date(dk+'T10:00:00')); await p.evaluate(dk=>{selectAbsDate(dk);},dk);};
 const view=async(dk,filt)=>(await p.evaluate(dk=>{selectAbsDate(dk);return [...document.querySelectorAll('.s-item')].map(c=>({t:c.innerText.replace(/\s+/g,' ').slice(0,120),btn:!!c.querySelector('.a-hadir')}));},dk)).filter(x=>!filt||x.t.includes(filt));
 const closeAll=()=>p.evaluate(()=>document.querySelectorAll('.overlay.open').forEach(x=>x.classList.remove('open')));
 const mark=async(name,status,nth=0)=>{const r=await p.evaluate(([name,status,nth])=>{
   _T.length=0;
   const cards=[...document.querySelectorAll('.s-item')].filter(c=>c.querySelector('.s-name')&&c.querySelector('.s-name').innerText.trim()===name);
   const c=cards[nth]; if(!c) return 'TIDAK ADA KARTU';
   const btn=c.querySelector('.a-'+status); if(!btn) return 'TOMBOL TERKUNCI';
   btn.click();
   const r=document.getElementById('noteReason'); if(r&&!r.value) r.value='tes';
   document.querySelector('button[onclick="saveNote()"]').click();
   const gc=document.getElementById('genericConfirmOverlay');
   const conf=gc&&gc.classList.contains('open')?' [DIALOG: '+document.getElementById('genericConfirmMsg').innerText.slice(0,140)+']':'';
   return 'ok '+_T.join('|')+conf;
 },[name,status,nth]); await closeAll(); return r;};
 const resched=async(name,toDk,time,o={})=>{const r=await p.evaluate(([name,toDk,time,o])=>{
   _T.length=0;
   const cards=[...document.querySelectorAll('.s-item')].filter(c=>c.querySelector('.s-name')&&c.querySelector('.s-name').innerText.trim()===name);
   const c=cards[o.nth||0]; if(!c) return 'NO CARD';
   c.querySelector('button[title="Reschedule"]').click();
   const sel=document.getElementById('rs_from');
   const info='[asal default='+sel.value+']';
   if(o.from){ sel.value=o.from; llkRsFromChanged(); }
   document.getElementById('rs_date').value=toDk; document.getElementById('rs_time').value=time||'15:00'; document.getElementById('rs_time2').value=o.t2||'';
   saveReschedule();
   const gc=document.getElementById('genericConfirmOverlay');
   if(gc&&gc.classList.contains('open')){ const m=document.getElementById('genericConfirmMsg').innerText.slice(0,150); if(o.accept){confirmGenericConfirm(); return info+' DIALOG→diterima: '+m+' | '+_T.join('|');} return info+' DIALOG: '+m; }
   return info+' '+_T.join('|');
 },[name,toDk,time,o]); await closeAll(); return r;};
 const stat=async(names)=>p.evaluate(ns=>ns.map(n=>{const s=students.find(x=>x.name===n);const a=Object.entries(attendance).filter(([d,v])=>Object.keys(v).some(k=>k===n||k.startsWith(n+'_extra_'))).sort().map(([d,v])=>d.slice(5)+':'+Object.entries(v).filter(([k])=>k===n||k.startsWith(n+'_extra_')).map(([k,x])=>(k===n?'':'ex/')+x).join(','));return n.padEnd(11)+' → '+countSessions(n)+'x | '+paymentStatusText(s).replace(/^\S+\s/,'')+' | '+a.join(' ')+' | rs='+JSON.stringify((s.reschedules||[]).map(r=>(r.from||'?')+'>'+r.date));}),names);
 const L=(...a)=>console.log(...a);

 await day('2026-10-26'); for(const s of studs) await mark(s.name,'hadir');
 await day('2026-11-02');
 for(const n of ['A_hadir','A_izin','A_alpa','B_asal','G_riwayat','I_edit']) L('2/11 resched',n, await resched(n,'2026-11-04'));
 L('2/11 D samahari', await resched('D_samahari','2026-11-02','18:00'));
 L('2/11 C hadir', await mark('C_maju','hadir'));
 L('2/11 C resched (kartu sudah Hadir, coba asal 2/11):', await resched('C_maju','2026-11-05'));
 L('2/11 C resched asal 9/11:', await resched('C_maju','2026-11-05','15:00',{from:'2026-11-09'}));
 L('2/11 E Senin→Rabu 4/11 (hari rutin):', await resched('E_2hari','2026-11-04'));
 L('2/11 E terima dialog:', await resched('E_2hari','2026-11-04','15:00',{accept:true}));
 await p.evaluate(()=>{const s=students.find(x=>x.name==='F_tambahan');s.extraDates=[{id:'ex1',date:'2026-11-03',time:'17:00',time2:'',note:'Tambahan Kelas'}];save();});
 L('VIEW Senin 2/11:'); (await view('2026-11-02')).forEach(x=>L('   ',x.btn?'[tombol]':'[KUNCI]',x.t));
 L('2/11 B tekan Hadir kartu asal:', await mark('B_asal','hadir'));
 L('2/11 D hadir kartu baru:', await mark('D_samahari','hadir',1));
 // I: edit murid (simpan form) — reschedule harus tetap ada
 await p.evaluate(()=>{openEdit(students.findIndex(x=>x.name==='I_edit'),1);document.getElementById('f_notes').value='diedit';doSave();});
 L('I setelah Edit Murid disimpan, reschedule:', await p.evaluate(()=>JSON.stringify(students.find(x=>x.name==='I_edit').reschedules)));
 await day('2026-11-03');
 L('3/11 F pindah tambahan:', await resched('F_tambahan','2026-11-05','17:00'));
 L('VIEW 3/11:'); (await view('2026-11-03','F_')).forEach(x=>L('   ',x.btn?'[tombol]':'[KUNCI]',x.t));
 L('3/11 F Hadir kartu asal:', await mark('F_tambahan','hadir'));
 await day('2026-11-04');
 L('VIEW Rabu 4/11:'); (await view('2026-11-04')).forEach(x=>L('   ',x.btn?'[tombol]':'[KUNCI]',x.t));
 for(const [n,s] of [['A_hadir','hadir'],['A_izin','izin'],['A_alpa','alpa'],['B_asal','hadir'],['G_riwayat','hadir'],['H_lama','hadir'],['I_edit','hadir']]) L('4/11',n,s, await mark(n,s));
 const ec=(await view('2026-11-04','E_2hari')); L('   E kartu Rabu:',ec.length); ec.forEach(x=>L('     ',x.t));
 for(let i=0;i<ec.length;i++) L('4/11 E hadir kartu',i, await mark('E_2hari','hadir',i));
 await day('2026-11-05');
 L('5/11 C hadir', await mark('C_maju','hadir')); L('5/11 F hadir', await mark('F_tambahan','hadir'));
 L('VIEW Senin 2/11 dari 5/11 (riwayat):'); (await view('2026-11-02')).forEach(x=>L('   ',x.btn?'[tombol]':'[KUNCI]',x.t));
 L('5/11 G Hadir di 2/11 (riwayat):', await mark('G_riwayat','hadir'));
 L('5/11 H(lama) Hadir di 2/11 (riwayat):', await mark('H_lama','hadir'));
 await day('2026-11-09');
 L('VIEW 9/11 C:'); (await view('2026-11-09','C_maju')).forEach(x=>L('   ',x.btn?'[tombol]':'[KUNCI]',x.t));
 L('9/11 C hadir:', await mark('C_maju','hadir'));
 L('\n=== HASIL ==='); (await stat(studs.map(s=>s.name))).forEach(x=>L(x));

 // ===== FITUR Sesuaikan pertemuan =====
 L('\n=== SESUAIKAN PERTEMUAN ===');
 await p.evaluate(()=>{const s=students.find(x=>x.name==='B_asal');(attendance['2026-11-02']=attendance['2026-11-02']||{})['B_asal']='hadir';save();render();});
 L('B sebelum:', (await stat(['B_asal']))[0]);
 const r1=await p.evaluate(()=>{openEdit(students.findIndex(x=>x.name==='B_asal'),3);const w=document.getElementById('llkPayAdjWrap');return {tampil:w.style.display,label:document.getElementById('llkPayAdjLabel').textContent,nilai:document.getElementById('f_pay_adj').value,hint:document.getElementById('llkPayAdjHint').innerText,dobel:document.getElementById('llkPayAdjDbl').innerText};});
 L(JSON.stringify(r1,null,1));
 const r2=await p.evaluate(()=>{llkPayAdjStep(-1);const h=document.getElementById('llkPayAdjHint').innerText;llkWizGo(4,{force:true});const sum=document.getElementById('llkWizSummary').innerText;_T.length=0;doSave();return {h,sum:sum.replace(/\s+/g,' '),toast:_T.join('|')};});
 L(JSON.stringify(r2,null,1));
 L('B sesudah:', (await stat(['B_asal']))[0]);
 // depan
 await p.evaluate(()=>{const s=students.find(x=>x.name==='A_izin');s.payTiming='depan';s.lastPaidAt=1;s.prepaidThrough=5;save();});
 L('A_izin depan sebelum:', (await stat(['A_izin']))[0]);
 const r3=await p.evaluate(()=>{openEdit(students.findIndex(x=>x.name==='A_izin'),3);const o={label:document.getElementById('llkPayAdjLabel').textContent,nilai:document.getElementById('f_pay_adj').value};document.getElementById('f_pay_adj').value=1;llkPayAdjChanged();o.hint=document.getElementById('llkPayAdjHint').innerText;doSave();return o;});
 L(JSON.stringify(r3)); L('A_izin depan sesudah:', (await stat(['A_izin']))[0]);
 // tidak disentuh = tidak berubah
 const before=await p.evaluate(()=>JSON.stringify(students.find(x=>x.name==='A_alpa')));
 await p.evaluate(()=>{openEdit(students.findIndex(x=>x.name==='A_alpa'),3);doSave();});
 const after=await p.evaluate(()=>JSON.stringify(students.find(x=>x.name==='A_alpa')));
 L('Edit tanpa menyentuh angka → data bayar sama:', JSON.parse(before).lastPaidAt===JSON.parse(after).lastPaidAt);
 // bulanan: tersembunyi
 L('Mode bulanan tampil?', await p.evaluate(()=>{paymentMode='monthly';openEdit(0,3);const d=document.getElementById('llkPayAdjWrap').style.display;closeModal();paymentMode='session';return d;}));
 await b.close();
})();
