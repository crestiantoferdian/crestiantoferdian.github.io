// Simulasi V1 (Playwright, Pixel 7): tombol Back HP di semua jendela/halaman.
// Jalankan: dari root repo 'python3 -m http.server 8765' lalu 'node tests/v1-back.sim.cjs'.
// "KELUAR" = Back ditekan saat riwayat aplikasi habis (di HP: aplikasi tertutup).
// Juga mendeteksi pushState tanpa sentuhan pengguna (Chrome Android melewatinya saat Back).
const {chromium,devices}=require('playwright');
(async()=>{
 const b=await chromium.launch(); const ctx=await b.newContext({...devices['Pixel 7']});
 await ctx.route(/^https?:\/\/(?!localhost)/, r=>r.abort());
 const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
 await p.clock.setFixedTime(new Date('2026-11-02T10:00:00'));
 await p.addInitScript(()=>{try{sessionStorage.setItem('llk_v1_tab','1');localStorage.setItem('llk_v2_choice','lepas');localStorage.setItem('llk_tutorial_add_student_done','1');
   localStorage.setItem('rms4_s',JSON.stringify([{name:'Budi',day:'Senin',time:'15:00',time2:'16:00',instrument:'Piano',payCycle:4,rate:40000,payTiming:'belakang',startDate:'2026-10-01',phone:'08123',extraDates:[],reschedules:[]}]));
   localStorage.setItem('rms4_a',JSON.stringify({'2026-10-12':{Budi:'hadir'},'2026-10-19':{Budi:'hadir'},'2026-10-26':{Budi:'hadir'},'2026-10-05':{Budi:'hadir'}}));
   // deteksi pushState tanpa aktivasi pengguna
   window.__badPush=[]; let inPop=false;
   addEventListener('popstate',()=>{inPop=true;setTimeout(()=>inPop=false,0);},true);
   const op=History.prototype.pushState;
   History.prototype.pushState=function(){ if(inPop||(navigator.userActivation&&!navigator.userActivation.isActive)) window.__badPush.push(new Error().stack.split('\n')[2]); return op.apply(this,arguments); };
 }catch(e){}});
 await p.goto('http://localhost:8765/index.html'); await p.waitForTimeout(2500);
 await p.evaluate(()=>document.querySelectorAll('.overlay.open').forEach(x=>x.classList.remove('open')));
 let fail=0;
 const what=()=>p.evaluate(()=>{const open=llkOpenBackLayers().map(x=>x[0]);return {d:(history.state&&history.state.d)||0,tab:currentTab,layers:open.join(',')||'-',page:llkPageLevelOpen()?(window._profileName?'profil':'sub'):'-'};});
 const back=async(expect)=>{
   const w=await what();
   if(w.d===0){ const ok=expect==='KELUAR'; if(!ok)fail++; console.log('   BACK → KELUAR APLIKASI', ok?'✓':'✗ (seharusnya: '+expect+')'); return 'KELUAR'; }
   await p.evaluate(()=>{const t=document.getElementById('toast');if(t)t.classList.remove('show');});
   const before='['+(w.layers!=='-'?w.layers:'')+(w.page!=='-'?' '+w.page:'')+' '+w.tab+']';
   await p.evaluate(()=>History.prototype.back.call(history)); await p.waitForTimeout(250);
   const a=await what(); const toast=await p.evaluate(()=>{const t=document.getElementById('toast');return t&&t.classList.contains('show')?t.innerText:'';});
   const desc='tab='+a.tab+' jendela='+a.layers+' halaman='+a.page+(toast?' toast="'+toast+'"':'');
   const ok=!expect||desc.includes(expect); if(!ok)fail++;
   console.log('   '+before.padEnd(30)+' BACK →',desc,ok?'✓':'✗ (harap: '+expect+')'); return desc;
 };
 const S=(t)=>console.log('\n▶ '+t);
 const tap=async(sel,opt)=>{ await p.locator(sel).first().click(opt); await p.waitForTimeout(300); };
 const exitTest=async()=>{ await back('Tekan sekali lagi'); await back('KELUAR'); await tap('#tab-absensi'); };

 S('1. Baru buka aplikasi → langsung ketuk kartu → Reschedule (sedang isi) → Back');
 await tap('.s-item',{position:{x:300,y:20}}); await tap('.s-item button[title="Reschedule"]');
 await p.fill('#rs_date','2026-11-04');
 await back('jendela=-'); await exitTest();

 S('2. Ketuk Hadir → jendela absen/progres → Back');
 await tap('.s-item',{position:{x:300,y:20}}); await tap('.s-item .a-hadir');
 await back('jendela=-'); await exitTest();

 S('3. Reschedule → jam (pemilih jam) → Back, Back');
 await tap('.s-item',{position:{x:300,y:20}}); await tap('.s-item button[title="Reschedule"]');
 await tap('#rs_time'); console.log('   jam terbuka:', await p.evaluate(()=>!!document.getElementById('llkClockOv')));
 await back('jendela=rescheduleOverlay'); await back('jendela=-'); await exitTest();

 S('4. Siswa → profil → Jadwal & Jam (Edit) → Back ×4');
 await tap('#tab-siswa'); await tap('.siswa-card [onclick^="openStudentReport"]');
 await tap('button:has-text("Jadwal & Jam")');
 await back('halaman=profil'); await back('tab=siswa jendela=- halaman=-'); await back('tab=absensi'); await exitTest();

 S('5. Profil → Edit Murid → ubah angka → Simpan → dialog "Anda yakin" → Back ×3');
 await tap('#tab-siswa'); await tap('.siswa-card [onclick^="openStudentReport"]'); await tap('button:has-text("Edit Murid")');
 await p.evaluate(()=>llkWizGo(3,{force:true})); await tap('button[aria-label="Kurangi"]'); await tap('button:has-text("Simpan") >> visible=true');
 await back('jendela=overlay'); await back('halaman=profil'); await back('tab=siswa jendela=- halaman=-'); await back('tab=absensi'); await exitTest();

 S('6. Profil → Buat Invoice → Back');
 await tap('#tab-siswa'); await tap('.siswa-card [onclick^="openStudentReport"]');
 await p.evaluate(()=>llkTogglePayCard('Budi')); await tap('button:has-text("Invoice") >> visible=true');
 await back('halaman=profil'); await back('tab=siswa'); await back('tab=absensi'); await exitTest();

 S('7. Lainnya → Pengaturan → Back ×2');
 await tap('#tab-lainnya'); await tap('.menu-item[onclick*="renderPengaturan"]');
 await back('tab=lainnya jendela=- halaman=-'); await back('tab=absensi'); await exitTest();

 S('8. Tutup jendela pakai tombol Batal, lalu Back (tidak boleh "diam")');
 await tap('.s-item',{position:{x:300,y:20}}); await tap('.s-item button[title="Reschedule"]');
 await tap('#rescheduleOverlay button:has-text("Batal")');
 await back('Tekan sekali lagi'); await back('KELUAR'); await tap('#tab-absensi');

 S('9. Pindah-pindah tab (Siswa, Track, Kirim, Materi) → Back');
 for(const t of ['siswa','track','kirim','links']) await tap('#tab-'+t);
 await back('tab=absensi'); await exitTest();

 S('10. Edit Murid → tombol Batal → Back');
 await tap('#tab-siswa'); await tap('.siswa-card [onclick^="openStudentReport"]'); await tap('button:has-text("Edit Murid")');
 await tap('#overlay button:has-text("Batal") >> visible=true');
 await back('tab=siswa jendela=- halaman=-'); await back('tab=absensi'); await exitTest();

 const bad=await p.evaluate(()=>window.__badPush);
 console.log('\npushState tanpa sentuhan pengguna:', bad.length?bad:'tidak ada ✓');
 console.log('Error halaman:', errs.length?errs:'tidak ada ✓');
 console.log(fail?('GAGAL: '+fail):'SEMUA LULUS');
 await b.close();
})();
