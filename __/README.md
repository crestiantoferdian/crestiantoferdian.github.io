# Helper login Firebase (di-host sendiri)

Salinan resmi dari `https://llk-67a30.firebaseapp.com/__/auth/*` supaya login Google
berjalan lewat domain sendiri (`authDomain: 'leslesanku.com'`) — layar Google jadi
"Lanjutkan ke leslesanku.com" dan login lebih stabil di browser yang membatasi
cookie pihak ketiga.

- `auth/handler.html` & `auth/iframe.html` (GitHub Pages menyajikan `/__/auth/handler`
  dari `handler.html`), `auth/*.js` tidak diubah.
- `firebase/init.json`: konfigurasi publik (sama dengan FIREBASE_CONFIG di index.html).
- Wajib terdaftar di Google Cloud → Credentials → OAuth client "Web client (auto created
  by Google Service)": redirect URI `https://leslesanku.com/__/auth/handler`.
- Firebase menyarankan memperbarui salinan ini sesekali (unduh ulang file yang sama).
