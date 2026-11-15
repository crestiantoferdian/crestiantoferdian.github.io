/* LLK — layar "Aplikasi macet, muat ulang".
   Dipasang di <head> V1 (index.html) dan V2 (v2/index.html, v2/guru.html).
   Berdiri sendiri (gaya & teks sendiri) supaya tetap bisa tampil walaupun
   bagian lain aplikasi error. TIDAK membaca/mengubah data apa pun.

   Kapan tampil:
   1. Layar kosong/putih: dicek tiap 4 detik setelah halaman selesai dimuat.
      Tampil kalau 2x berturut-turut kosong, atau 1x kosong tepat setelah ada error.
   2. Dipanggil langsung: window.llkShowStuck('akun') — mis. V1 saat akun Google
      di tab/jendela lain berganti (data di tab ini sudah tidak cocok). */
(function(){
  if(window.llkShowStuck) return;
  var shown=false, lastErrAt=0, blankCount=0;

  var TEXT={
    macet:{ t:'Aplikasi sedang macet', d:'Tenang, datamu aman. Muat ulang aplikasi supaya jalan normal lagi.' },
    akun:{ t:'Akun berganti di tab lain', d:'Kamu login dengan akun lain di tab/jendela lain. Muat ulang supaya tab ini memakai data akun yang benar. Datamu aman.' }
  };

  function isStandalone(){
    try{ return (window.matchMedia&&matchMedia('(display-mode: standalone)').matches)||navigator.standalone||sessionStorage.getItem('llk_play_app')==='1'; }catch(e){ return false; }
  }

  function css(){
    return '#llkStuck{position:fixed;inset:0;z-index:2147483646;display:flex;align-items:center;justify-content:center;padding:16px;'+
      'background:rgba(43,36,32,.55);-webkit-backdrop-filter:blur(3px);backdrop-filter:blur(3px);font-family:"Plus Jakarta Sans",system-ui,-apple-system,"Segoe UI",sans-serif;animation:llkStFade .25s ease-out}'+
      '#llkStuck *{box-sizing:border-box}'+
      '#llkStuck .st-card{background:#fffcf7;color:#2b2420;border-radius:22px;max-width:360px;width:100%;padding:26px 22px 20px;text-align:center;box-shadow:0 18px 50px rgba(0,0,0,.28);animation:llkStPop .35s cubic-bezier(.2,1.4,.4,1)}'+
      '#llkStuck .st-ic{width:84px;height:84px;margin:0 auto 14px;border-radius:50%;background:rgba(168,55,42,.10);color:#a8372a;display:flex;align-items:center;justify-content:center;position:relative}'+
      '#llkStuck .st-ic svg{width:44px;height:44px;animation:llkStSpin 1.6s cubic-bezier(.6,.1,.4,.9) infinite}'+
      '#llkStuck .st-ic:after{content:"";position:absolute;inset:-6px;border-radius:50%;border:2px solid rgba(168,55,42,.35);animation:llkStRing 1.6s ease-out infinite}'+
      '#llkStuck h2{font-size:1.15rem;font-weight:800;margin:0 0 6px;line-height:1.3}'+
      '#llkStuck p{font-size:.88rem;color:#6f6459;margin:0 0 16px;line-height:1.5}'+
      '#llkStuck .st-btnwrap{position:relative;margin:0 0 14px}'+
      '#llkStuck button{width:100%;border:0;border-radius:14px;background:#a8372a;color:#fff;font:inherit;font-weight:800;font-size:1rem;padding:14px 16px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;animation:llkStPulse 1.6s ease-in-out infinite}'+
      '#llkStuck button svg{width:20px;height:20px}'+
      '#llkStuck .st-hand{position:absolute;right:18px;bottom:-18px;font-size:30px;line-height:1;pointer-events:none;animation:llkStTap 1.6s ease-in-out infinite}'+
      '#llkStuck .st-alt{font-size:.76rem;color:#7f7369;line-height:1.5;background:#f4ede2;border-radius:12px;padding:10px 12px;margin-top:22px;text-align:left}'+
      '#llkStuck .st-alt b{color:#51473f}'+
      '@keyframes llkStFade{from{opacity:0}to{opacity:1}}'+
      '@keyframes llkStPop{from{transform:scale(.85);opacity:0}to{transform:scale(1);opacity:1}}'+
      '@keyframes llkStSpin{0%{transform:rotate(0)}70%,100%{transform:rotate(360deg)}}'+
      '@keyframes llkStRing{0%{transform:scale(.9);opacity:1}100%{transform:scale(1.25);opacity:0}}'+
      '@keyframes llkStPulse{0%,100%{transform:scale(1);box-shadow:0 0 0 0 rgba(168,55,42,.45)}50%{transform:scale(1.03);box-shadow:0 0 0 10px rgba(168,55,42,0)}}'+
      '@keyframes llkStTap{0%,100%{transform:translate(10px,10px)}45%{transform:translate(0,0)}55%{transform:translate(0,0) scale(.9)}}'+
      '@media (prefers-reduced-motion:reduce){#llkStuck *{animation:none!important}}';
  }

  function refreshIcon(){
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 3v6h-6"/></svg>';
  }

  function show(kind){
    if(shown) return; shown=true;
    var tx=TEXT[kind]||TEXT.macet;
    try{
      var st=document.createElement('style'); st.textContent=css();
      (document.head||document.documentElement).appendChild(st);
      var el=document.createElement('div'); el.id='llkStuck'; el.setAttribute('role','alertdialog'); el.setAttribute('aria-live','assertive');
      var alt=isStandalone()
        ? 'Kalau tombol di atas tidak berhasil: <b>tutup aplikasi</b> (geser dari daftar aplikasi terbuka), lalu <b>buka lagi</b>.'
        : 'Kalau tombol di atas tidak berhasil: tekan ikon <b>⟳ muat ulang</b> di browser, atau <b>tarik layar ke bawah</b> (HP), atau tekan <b>F5</b> (laptop).';
      el.innerHTML='<div class="st-card"><div class="st-ic">'+refreshIcon()+'</div>'+
        '<h2>'+tx.t+'</h2><p>'+tx.d+'</p>'+
        '<div class="st-btnwrap"><button type="button" id="llkStuckBtn">'+refreshIcon()+'Muat Ulang Sekarang</button><span class="st-hand">👆</span></div>'+
        '<div class="st-alt">'+alt+'</div></div>';
      (document.body||document.documentElement).appendChild(el);
      document.getElementById('llkStuckBtn').onclick=function(){
        this.textContent='Memuat ulang…';
        try{ location.reload(); }catch(e){ location.href=location.href; }
      };
    }catch(e){
      // Pengaman terakhir kalau DOM pun bermasalah
      try{ if(confirm(tx.t+'.\n\n'+tx.d+'\n\nMuat ulang sekarang?')) location.reload(); }catch(e2){}
    }
  }
  window.llkShowStuck=show;

  // ── Deteksi layar kosong ────────────────────────────────────────────
  var CONTENT_SEL='img,svg,canvas,video,input,button,textarea,select,iframe';
  function hasContent(el){
    if(!el||el===document.body||el===document.documentElement) return false;
    if(el.matches&&el.matches(CONTENT_SEL)) return true;
    if((el.textContent||'').trim()) return true;
    return !!(el.querySelector&&el.querySelector(CONTENT_SEL));
  }
  function isBlank(){
    if(!document.body) return false;
    var w=window.innerWidth, h=window.innerHeight;
    if(w<50||h<50) return false;
    var xs=[0.2,0.5,0.8], ys=[0.15,0.4,0.65,0.9];
    for(var i=0;i<xs.length;i++) for(var j=0;j<ys.length;j++){
      if(hasContent(document.elementFromPoint(w*xs[i], h*ys[j]))) return false;
    }
    return true;
  }
  function check(){
    if(shown) return;
    if(document.hidden) { blankCount=0; return; }
    var blank=false;
    try{ blank=isBlank(); }catch(e){ return; }
    if(!blank){ blankCount=0; return; }
    blankCount++;
    if(blankCount>=2 || Date.now()-lastErrAt<15000) show('macet');
  }

  function onErr(){
    lastErrAt=Date.now();
    // Cek sebentar lagi: kalau error ini membuat layar kosong, langsung tampilkan instruksi
    setTimeout(check, 2000);
  }
  window.addEventListener('error', function(e){
    // Gambar/skrip yang gagal dimuat juga memicu 'error' (tanpa e.message) — cukup catat
    onErr();
  }, true);
  window.addEventListener('unhandledrejection', onErr);

  function start(){ setTimeout(function(){ check(); setInterval(check, 4000); }, 4000); }
  if(document.readyState==='complete') start(); else window.addEventListener('load', start);
})();
