# Panduan Rilis LesLesanKu ke Google Play (langkah demi langkah)

Panduan ini ditulis supaya pemilik bisa melanjutkan sendiri kalau sesi dengan Claude terputus.
Urutan: **A. Buat file aplikasi (PWABuilder)** → **B. Play Console: buat aplikasi & Internal testing** →
**C. Sambungkan kunci Play ke website** → **D. Closed testing 12 penguji × 14 hari** → **E. Production**.

> ⚠️ Aturan keamanan: file `signing.keystore`, isi `signing-key-info.txt`, dan semua kata sandi **jangan pernah
> dikirim ke chat** atau di-screenshot. Simpan cadangannya (flashdisk / Google Drive pribadi). Kalau hilang,
> aplikasi tidak bisa diperbarui selamanya.

---

## A. Membuat file aplikasi Android di PWABuilder (bisa sekarang, tidak perlu menunggu verifikasi)

1. Buka **https://www.pwabuilder.com** di Chrome/Edge laptop.
2. Ketik `https://leslesanku.com` di kotak alamat → tekan **Start**. Tunggu analisis selesai.
3. Tekan **Package For Stores** → pilih **Android** → **Generate Package** (atau **Options** untuk mengatur).
4. Pastikan pilihan **Google Play** (bukan "Other Android").
5. Isi **Options** seperti ini (yang tidak disebut biarkan bawaan):

   | Kolom | Isi |
   |---|---|
   | Package ID | `com.leslesanku.app` *(permanen, jangan salah ketik)* |
   | App name | `LesLesanKu` |
   | Launcher name | `LesLesanKu` |
   | App version | `1.0.0` |
   | App version code | `1` |
   | Host | `leslesanku.com` |
   | **Start URL** | **`/?src=play`** *(penting: supaya aplikasi tahu ia versi Play → pembayaran Midtrans disembunyikan)* |
   | Theme / status bar color | biarkan dari manifest |
   | Splash screen | pakai `splash-512.png` kalau diminta |
   | Display mode | Standalone |
   | Notification delegation | **Aktif (Enabled)** |
   | Location delegation | Nonaktif |
   | Google Play billing | biarkan nonaktif dulu (dikerjakan nanti) |
   | **Signing key** | **Use mine / Upload existing** → unggah `signing.keystore` dari folder 09/09/2026, lalu isi **Key alias**, **Key password**, **Store password** dari `signing-key-info.txt` *(salin di laptop saja, jangan ke chat)* |

6. Tekan **Download** → dapat file `.zip`. Ekstrak. Isinya antara lain:
   - `....aab` → **ini yang diunggah ke Play Console**
   - `....apk` → untuk dicoba langsung di HP/emulator (opsional)
   - `assetlinks.json` → **tidak perlu diapa-apakan**; website sudah memuat kunci yang sama untuk `com.leslesanku.app`.
7. Simpan folder hasil ini bersama folder kunci.

✅ Cek cepat (opsional): pasang file `.apk` di emulator/HP → buka → harus langsung ke **login LLK V1**, tanpa
halaman pilih peran, dan tombol beli paket menampilkan **"Segera hadir di aplikasi"**. Kalau bilah alamat
browser muncul di atas, itu normal untuk APK uji — hilang setelah langkah C.

---

## B. Play Console: buat aplikasi & Internal testing (setelah verifikasi akun selesai)

1. **Play Console → Buat aplikasi (Create app)**:
   - Nama: `LesLesanKu – Absensi Les` · Bahasa default: **Indonesia** · Jenis: **Aplikasi** · **Gratis**
   - Centang pernyataan kebijakan → **Buat aplikasi**.
2. Menu **Uji (Test) → Pengujian internal (Internal testing)** → **Buat rilis baru**.
   - Saat diminta **Play App Signing**: pilih yang direkomendasikan Google (**Google mengelola kunci**).
   - Unggah file **`.aab`** dari langkah A → isi catatan rilis singkat ("Versi pertama") → **Simpan** → **Tinjau** → **Mulai peluncuran**.
3. Tab **Penguji**: buat daftar email (mis. "Tim LLK") berisi Gmail sendiri → simpan → salin **link undangan**, buka di HP → **Terima** → pasang dari Play Store.

---

## C. Sambungkan kunci Play ke website (WAJIB, supaya tidak muncul bilah alamat browser)

1. Play Console → **Pengaturan (Setup) → Integritas aplikasi (App integrity) → App signing**.
2. Salin **SHA-256 certificate fingerprint** dari bagian **App signing key certificate**
   (bentuknya `AB:12:CD:...`, 32 pasang huruf/angka). *Sidik jari ini BUKAN rahasia — boleh dikirim ke Claude.*
3. Kirim ke Claude → Claude menambahkannya ke `.well-known/assetlinks.json`.
   - Kalau Claude sedang tidak bisa: buka repo GitHub → file `.well-known/assetlinks.json` → ikon pensil (Edit) →
     di blok `"com.leslesanku.app"`, tambahkan sidik jari baru ke daftar `sha256_cert_fingerprints`
     (pisahkan dengan koma, diapit tanda kutip) → **Commit changes**. Contoh:
     ```json
     "sha256_cert_fingerprints": [
       "CA:67:8F:6C:E9:F8:83:56:70:C7:68:34:C8:25:BC:A2:21:B2:7B:EA:E2:3F:34:CB:B9:53:8F:2E:16:02:8B:1B",
       "SIDIK:JARI:DARI:PLAY:CONSOLE"
     ]
     ```
4. Tunggu ±5 menit, hapus & pasang ulang aplikasi di HP → bilah alamat hilang.

---

## D. Closed testing: 12 penguji × 14 hari (syarat akun pribadi baru)

1. Siapkan **≥12 Gmail penguji** (lebih aman 15) yang memakai HP Android.
2. **Uji → Pengujian tertutup (Closed testing)** → **Buat jalur / kelola** → **Buat rilis** → pilih AAB yang sama
   (atau "Promosikan rilis" dari Internal testing) → luncurkan.
3. Tab **Penguji** → tambahkan daftar email (atau Google Group) → salin **link opt-in** → kirim ke penguji lewat WA.
4. Setiap penguji: buka link → **Jadi penguji** → pasang dari Play Store → buka aplikasi beberapa kali selama 14 hari.
   **Jangan keluar dari program sebelum 14 hari.**
5. Sambil menunggu, lengkapi menu **Dasbor → Siapkan aplikasi** (semua bahan ada di `LISTING.md`):
   - **Detail toko (Store listing)**: nama, deskripsi singkat & lengkap, ikon `app-icon-512.png`,
     feature graphic `feature-graphic-1024x500.png`, screenshot `screenshot-1…6`.
   - **Kebijakan privasi**: `https://leslesanku.com/privacy-policy.html`
   - **Akses aplikasi**: akun Google khusus reviewer + petunjuk login.
   - **Iklan**: Tidak ada iklan.
   - **Rating konten**: isi kuesioner (lihat LISTING.md).
   - **Target audiens**: 18+.
   - **Keamanan data (Data safety)**: salin jawaban dari LISTING.md.
   - **Penghapusan akun**: `https://leslesanku.com/hapus-akun.html`
   - **Kategori**: Pendidikan · email kontak.

---

## E. Production (setelah 14 hari)

1. Dasbor → **Ajukan akses produksi** → isi kuesioner pengalaman testing (jawab jujur: siapa pengujinya, masukan apa saja).
2. Setelah disetujui: **Produksi → Buat rilis** → AAB → rilis bertahap (mis. 20% lalu 100%).
3. Review Google biasanya beberapa hari.

---

## Catatan pembayaran
- Selama Google Play Billing belum dipasang, aplikasi Play **tidak menjual** langganan (tombol beli → "Segera hadir").
  Penguji memakai trial 31 hari.
- Langkah Play Billing (dikerjakan bersama Claude): payments profile, buat 3 langganan
  `llk_basic`, `llk_up`, `llk_unlimited` (base plan `bulanan`/`tahunan`), aktifkan Play Developer API +
  service account, lalu Claude memasang tombol beli & verifikasi pembelian.

---

## F. Build ulang aplikasi versi 2 (logo layar pembuka & ikon baru)

Kenapa: layar pembuka versi 1 memakai logo bertumpuk 512 px yang diperbesar Android → pecah & kurang rapi
(masukan penguji, 20 Okt 2026). Gambar baru sudah ada di repo (`node store/make-twa-assets.cjs`):

| File | Dipakai untuk | Link |
|---|---|---|
| `store/play/twa/splash-1024.png` | Layar pembuka: logo mendatar "LLK Les LesanKu", resolusi tinggi | https://leslesanku.com/store/play/twa/splash-1024.png |
| `store/play/twa/icon-maskable-512.png` | Ikon aplikasi di HP (desain opsi A) | https://leslesanku.com/store/play/twa/icon-maskable-512.png |

Langkah di PWABuilder (sama seperti langkah A, bedanya hanya ini):
1. **App version** `1.0.1` · **App version code** `2` (wajib lebih besar dari versi 1).
2. **Start URL** tetap `/?src=play`, **Host** `leslesanku.com`, Package ID tetap `com.leslesanku.app`.
3. **Icon URL** → `https://leslesanku.com/store/play/twa/splash-1024.png` (PWABuilder memakai gambar ini untuk layar pembuka).
4. **Maskable icon URL** → `https://leslesanku.com/store/play/twa/icon-maskable-512.png` (ikon di layar HP Android 8+).
5. **Splash screen background color** → `#F6F1E9`.
6. **Signing key** → kunci LAMA yang sama (folder 09/09/2026). Jangan buat kunci baru.
7. Download → ambil file `.aab`.

Di Play Console:
1. **Pengujian internal → Buat rilis baru** → unggah AAB versi 2 → catatan rilis `<id>Logo layar pembuka & ikon baru</id>` → luncurkan.
2. Pasang/update di HP sendiri → cek layar pembuka & ikon.
3. Kalau sudah bagus: **Pengujian tertutup → Buat rilis baru → Tambahkan dari library** (pilih versi 2) → luncurkan. Penguji cukup **update** dari Play Store; hitungan 14 hari **tidak diulang**.
