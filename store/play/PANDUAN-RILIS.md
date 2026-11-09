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
7. **Google Play Billing → AKTIFKAN** (di opsi Android lanjutan/"other options"; cari yang bernama "Google Play Billing" atau "Play Billing"). Wajib untuk langganan di aplikasi (lihat bagian G). Kalau tidak ketemu, kirim screenshot opsinya.
8. Download → ambil file `.aab`.

> ⚠️ **PENGINGAT PEMILIK: V2 WAJIB PAKAI IKON BARU (opsi A: tombol merah mengilap "LLK") + layar pembuka logo mendatar.** Dua gambar di tabel atas itu ikonnya. Jangan pakai ikon lama. Cek hasilnya di HP setelah update: ikon di layar utama & layar pembuka.

Di Play Console:
1. **Pengujian internal → Buat rilis baru** → unggah AAB versi 2 → catatan rilis `<id>Logo layar pembuka & ikon baru</id>` → luncurkan.
2. Pasang/update di HP sendiri → cek layar pembuka & ikon.
3. Kalau sudah bagus: **Pengujian tertutup → Buat rilis baru → Tambahkan dari library** (pilih versi 2) → luncurkan. Penguji cukup **update** dari Play Store; hitungan 14 hari **tidak diulang**.

---

## G. Google Play Billing — langganan di aplikasi dari Play Store

**Prinsip:** di aplikasi Play, pembayaran HARUS lewat Google Play Billing (Midtrans hanya untuk website). Masa aktif langganan selalu diambil dari Google (bukan dihitung sendiri). Pembayaran masuk ke akun Play-mu; Google biasanya memotong sekitar 15% untuk langganan (cek tarif terbaru di Console).

### Yang sudah dikerjakan Claude (kode siap, di branch; belum live)
| Bagian | File | Isi |
|---|---|---|
| Server | `functions/playbilling.js`, `functions/index.js` | `verifyPlayPurchase` (verifikasi token ke Google, acknowledge, aktifkan `subscriptions/{uid}`), `playRtdn` (perpanjangan/batal/habis dari Google) |
| Aplikasi | `index.html` | `llkPlayBuy` (beli lewat Digital Goods API), `llkPlayRestore` + tombol **Pulihkan Langganan**, deteksi langganan Play (tidak boleh beli dobel) |
| Kebijakan | `privacy-policy.html`, `hapus-akun.html` | Google Play Billing dicantumkan; peringatan "langganan Play tidak berhenti otomatis saat akun dihapus" |
| Tes | `functions/test/*.test.js` | 74 tes server lulus; 15 pemeriksaan sisi aplikasi lulus |

Keamanan: token pembelian dicek ke Google (bukan percaya aplikasi), satu token hanya bisa dipakai satu akun (hash di `playPurchases`), tidak ada kunci rahasia (pakai akun layanan Cloud Functions, bukan file JSON). Sebelum langganan dibuat di Play Console, tombol beli otomatis menampilkan "Segera hadir" (tidak ada yang rusak).

### Rancangan produk: 5 langganan, masing-masing 1 base plan
(Dipilih supaya tidak bergantung pada perilaku Digital Goods API untuk langganan dengan banyak base plan. Rancangan lama 3 produk + base plan `bulanan`/`tahunan` tetap dikenali server sebagai cadangan, tapi aplikasi memakai 5 produk ini.)

| Product ID | Nama | Base plan ID | Periode | Harga |
|---|---|---|---|---|
| `llk_basic_monthly` | Pro Basic Bulanan | `monthly` | 1 bulan | Rp35.000 |
| `llk_up_monthly` | Pro Up Bulanan | `monthly` | 1 bulan | Rp75.000 |
| `llk_up_yearly` | Pro Up Tahunan | `yearly` | 1 tahun | Rp700.000 |
| `llk_unlimited_monthly` | Pro Unlimited Bulanan | `monthly` | 1 bulan | Rp100.000 |
| `llk_unlimited_yearly` | Pro Unlimited Tahunan | `yearly` | 1 tahun | Rp1.000.000 |

Product ID harus PERSIS seperti di tabel (tidak bisa diubah setelah dibuat).

> ✅ **Sudah dibuat (6–7 Nov 2026, via sesi Claude di browser):** kelima langganan **Aktif** di Play Console, base plan **`monthly`/`yearly`** (bukan `bulanan`/`tahunan`), hanya dijual di Indonesia, perpanjangan otomatis. Versi 2 sudah dirilis ke **Pengujian internal** (syarat agar menu Langganan terbuka). Server mengenali paket dari **product ID**, jadi nama base plan tidak memengaruhi kode (ada tesnya). Google sempat mengubah 3 harga (Rp990.000 / Rp690.000 / Rp99.000) lalu dikembalikan ke harga benar; **cek ulang harga di Console setelah setiap pengubahan**. Draf versi 2 di jalur Alpha (tertutup) **belum dikirim ditinjau**: tunggu uji beli berhasil.


### Langkah pemilik (urut; Claude memandu, tanda 🧑 = kamu yang menekan)
1. 🧑 **Build versi 2 dengan Play Billing aktif + ikon baru** (bagian F, langkah 7) → unggah ke **Pengujian internal** → pasang & cek ikon.
2. 🧑 **Profil pembayaran** (kalau belum): Konsol Play → Setelan/Penyiapan → profil pembayaran, isi rekening bank & data pajak (verifikasi bisa makan beberapa hari — mulai lebih awal).
3. 🧑 **Buat 5 langganan** (hanya bisa setelah langkah 1): **Monetisasi dengan Google Play → Produk → Langganan → Buat langganan**. Isi Product ID & nama (tabel di atas), tambah **base plan** (ID `bulanan`/`tahunan`, perpanjang otomatis, periode & harga dalam Rupiah), lalu **Aktifkan** base plan-nya. Nama tombol bisa sedikit berbeda; kirim screenshot kalau bingung.
4. 🧑 **Aktifkan API:** Google Cloud Console → pilih project `llk-67a30` → APIs & Services → Library → **Google Play Android Developer API** → Enable.
5. 🧑 **Undang akun layanan di Play Console:** Pengguna dan izin → Undang pengguna → email akun layanan Cloud Functions (biasanya `llk-67a30@appspot.gserviceaccount.com`; pastikan di Firebase Console → Functions → pilih fungsi → Detail → *Service account*). Beri izin: lihat informasi aplikasi, **lihat data keuangan/pesanan**, dan **kelola pesanan dan langganan**. Izin bisa butuh beberapa jam untuk aktif.
6. 🧑 **Deploy Cloud Functions** lewat Cloud Shell (seperti 29 Sep): `git clone` branch → `cloudshell edit .env` (salin dari file .env pemilik) → `npm ci && npm test` → `npx -y firebase-tools@13 deploy --only functions --project llk-67a30`. Pastikan `npm test` hijau. **Deploy functions DULU, baru merge web.**
7. 🧑 **Notifikasi real-time (perpanjangan otomatis):** setelah deploy, topik Pub/Sub `play-rtdn` terbentuk. Cloud Console → Pub/Sub → Topics → `play-rtdn` → Permissions → beri peran **Pub/Sub Publisher** ke `google-play-developer-notifications@system.gserviceaccount.com`. Lalu Konsol Play → Monetisasi → Penyiapan monetisasi → **Notifikasi developer real-time** → nama topik `projects/llk-67a30/topics/play-rtdn` → **Kirim notifikasi uji**. (Tanpa ini, perpanjangan baru tercatat saat aplikasi dibuka; masih aman karena aplikasi memulihkan otomatis.)
8. 🧑 **Penguji lisensi:** Konsol Play → Setelan → Pengujian lisensi → tambahkan Gmail pengujimu (pembelian uji tidak ditagih; perpanjangannya dipercepat).
9. 🧑 **Uji beli** dengan akun penguji lisensi di aplikasi Play (versi 2): paywall → pilih paket → bayar → cek: badge **PRO**, dokumen `subscriptions/{uid}` berisi `source: "play"`, tombol **Pulihkan Langganan** bekerja (hapus-pasang ulang). Batalkan di Play Store dan pastikan masa aktif tetap sampai tanggal akhir.
10. 🧑 Kalau semua lolos: merge web ke `main` (Claude membuat PR) → promosikan versi 2 ke **Pengujian tertutup** (Tambahkan dari library). Setelah akses Produksi disetujui, promosikan ke Produksi.

### Harga & penagihan ganda di aplikasi Play (perbaikan 9 Nov 2026, atas komplain marketing)
- Google **selalu menagih harga penuh produk** (Rp35.000 / 75.000 / 700.000 / 100.000 / 1.000.000). **Diskon naik paket (50% / 10%) hanya berlaku di website (Midtrans).** Di aplikasi Play semua harga/teks diskon dan harga coret **disembunyikan**.
- Kartu paket di aplikasi Play kini memakai **harga asli dari Google** (Digital Goods API `getDetails`); kalau belum tersedia memakai tabel yang sama. Cek harga di Play Console setelah tiap perubahan.
- **Anti tagih ganda:** pelanggan **website/Midtrans yang masih aktif** tidak bisa membeli lewat Play (muncul pemberitahuan "Langgananmu masih aktif… setelah masa aktif ini berakhir"); pelanggan Play yang masih aktif diarahkan ke Play Store; akun **tester** tetap boleh uji beli. Pesan **sengaja tidak menyebut website/cara bayar lain** (aturan Google Play melarang mengarahkan ke luar Play Billing di dalam aplikasi).
- Sisa masa aktif: kalau Midtrans sudah habis lalu beli Play, masa aktif mulai dari Google (tidak ada sisa yang hilang karena pembelian baru hanya dibuka setelah Midtrans habis). Naik paket berdiskon tetap dilakukan pengguna sendiri di website.
- Tes: `cd tests && npm run test:play` (27 pemeriksaan).

### Catatan
- Pengguna yang membeli lewat Play lalu ganti ke paket lain: diarahkan ke Play Store (aplikasi sengaja tidak membuat langganan kedua).
- Pengembalian dana/pembatalan oleh Google ikut tercatat lewat notifikasi real-time (status jadi `expired`).
- Pelanggan web (Midtrans) yang masa aktifnya lebih lama tidak dikurangi oleh pembelian Play yang lebih pendek.
- Pernyataan **status pedagang** (batas 1 Feb 2027) tetap perlu diisi di Konsol Play.
