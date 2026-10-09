// v2 — cache dibersihkan & sekarang selalu diperbarui setiap kali online,
// jadi versi offline tidak lagi "membeku" di versi lama.
const CACHE = 'leslesanku-v4';
const FILES = ['./', './logo-llk.png', './logo-leslesanku.png'];

self.addEventListener('install', e => {
  // FIX: caches.addAll() dibungkus .catch() supaya kalau gagal (network
  // flaky, dll), install event TETAP dianggap sukses. Ini penting karena
  // file ini di-import bareng OneSignal lewat importScripts() di
  // OneSignalSDKWorker.js — kalau install event di sini reject, SELURUH
  // worker (termasuk bagian push notification OneSignal) ikut gagal
  // ter-install. Ini yang bikin device baru (pertama kali install, misalnya
  // HP) gagal subscribe total, sementara device lama yang sudah lebih dulu
  // berhasil install tetap jalan normal pakai worker versi lama.
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(FILES))
      .catch(err => console.warn('sw.js: gagal cache awal (diabaikan, tidak menggagalkan install):', err))
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
     .catch(err => console.warn('sw.js: gagal bersihkan cache lama (diabaikan):', err))
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return; // jangan cache request selain GET
  // Helper login Google (/__/auth/…) selalu langsung dari internet, jangan
  // disimpan ke cache — halaman ini sekali pakai & membawa data login.
  if (new URL(e.request.url).pathname.indexOf('/__/') === 0) return;

  e.respondWith(
    fetch(e.request)
      .then(res => {
        // Setiap kali berhasil ambil dari internet (online), simpan salinan
        // TERBARU ini ke cache. Jadi cache selalu "versi terakhir yang online",
        // bukan snapshot beku dari saat sw.js pertama kali di-install.
        const resClone = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, resClone)).catch(()=>{});
        return res;
      })
      .catch(() => caches.match(e.request)) // offline → pakai cache terbaru yang tersimpan
  );
});
