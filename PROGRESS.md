# 📘 Progres Project LesLesanKu (LLK)

_Terakhir diperbarui: 29 Sep 2026 (perombakan tampilan)_

## 📌 Langkah berikutnya (per 29 Sep 2026)
0. Setelah PR #21 di-merge: Ctrl+Shift+R, cek logo sidebar laptop, tombol paket, dan scroll setelah bayar.
1. Pastikan PR #15 sudah di-merge → buka leslesanku.com (Ctrl+Shift+R): badge masih PRO, murid lengkap, Tambah Murid tidak bergembok.
2. Uji bayar **sandbox** pakai akun Google lain (jendela Samaran): Jadi Pro → Pro Basic → bayar lewat simulator.sandbox.midtrans.com → badge jadi PRO BASIC, murid ke-11 bergembok.
3. Pindah Midtrans ke **production**: Client Key (boleh dikirim ke Claude), Server Key (rahasia, pemilik tempel di Cloud Shell `.env`), Notification URL, cek metode pembayaran aktif.
4. Setelah gajian: Play Console ($25) → PWABuilder (package `com.leslesanku.app`, host `leslesanku.com`, kunci lama) → Play Billing.

## 🎨 Warna tema: header berwarna + slider (30 Sep 2026)
- Permintaan pemilik: warna tema juga mengganti **warna header**, teksnya otomatis **hitam kalau header terang, putih kalau gelap**; pemilih warna berupa **slider geser**, bukan tombol-tombol warna.
- `applySettings()` kini juga memanggil `llkApplyAccentVars(color)` (murni tampilan) yang mengisi `--on-red` (hitam/putih, mana yang lebih kontras) dan `--red-text` (warna tema yang digelapkan otomatis sampai ≥4.5:1 di atas kertas, dipakai untuk teks/tautan/menu aktif). Tombol aksen & badge memakai `--on-red`, jadi warna terang (mis. kuning) tetap terbaca.
- Pengaturan Aplikasi: 3 slider (Warna/hue, Kepekatan, Kecerahan) + kolom hex. `pickColor()` dan `savePengaturan()` tetap sama; key `rms_school_color` tidak berubah. Pratinjau header ikut berubah langsung saat digeser.
- Perbaikan: slider sempat berubah putih saat diklik, karena gaya fokus kolom isian (`.mfield input:focus`) menimpa gradasinya. Sekarang slider memakai gayanya sendiri juga saat fokus.

## 🎨 Perombakan tampilan total — "Buku Catatan Guru" (branch `claude/dazzling-cerf-ra7fos`, 29 Sep 2026)
Murni tampilan: **tidak ada logika, alur data, key localStorage, nama fungsi/variabel, atau aturan Firestore yang diubah.** Data murid aman.
- **Arah desain:** hangat & tenang. Kertas krem `#f6f1e9`, kartu `#fffcf7`, tinta `#2b2420`, aksen bata `#a8372a` (default baru; warna pilihan guru di Pengaturan tetap berlaku lewat `--red`). Status: Hadir `#2a7349`, Izin `#a65510`, Alpa `#b0263f`, info tinta biru `#2f5a8a`. Semua pasangan teks lolos WCAG AA (≥4.5:1).
- **Font:** Fraunces (judul & angka) + Plus Jakarta Sans (UI, dirancang di Jakarta). Invoice (canvas) ikut Plus Jakarta Sans.
- **Token di `:root`** (`index.html` blok `<style>` pertama): warna, spasi 4px, radius (`--r-sm..xl`), bayangan hanya untuk elemen mengambang, motion (`--ease-out`, `--d1..d4` = 150–400ms). Nama variabel lama (`--red`, `--bg`, `--card`, `--hadir`, …) dipertahankan karena dipakai JS/inline style.
- **Ikon:** satu set SVG custom (grid 24px, garis 1.75, ujung membulat) sebagai sprite di awal `<body>`; dipakai lewat `llkI('nama')`. Avatar murid pakai `llkSubjectIcon()` (memetakan hasil `getInstrumentIcon()`; emoji aslinya tetap dipakai untuk teks WA/share). Ikon tautan Materi bawaan dipetakan lewat `llkLinkGlyph()` (data tetap emoji, emoji ketikan guru tampil apa adanya).
- **Ilustrasi empty state:** `llkIll('notebook'|'students'|'search'|'folder'|'calendar')`.
- **Motion:** transisi masuk halaman + stagger daftar (`llkPageEnter()` di `setTab` & navigasi sub-halaman), skeleton loading sebelum render pertama & saat menyiapkan invoice, feedback tekan (scale), toast berstatus (sukses/gagal/peringatan/proses — dibaca dari emoji di awal pesan, `toast()` tetap dipanggil sama), dialog berikon. Hanya transform & opacity; `prefers-reduced-motion` dihormati. Glow/blur (glassmorphism) dihapus.
- **Komponen baru (CSS):** `.llk-btn`, `.llk-icon-btn`, `.llk-row`, `.llk-tile`, `.llk-choice`, `.llk-callout`, `.llk-note`, `.llk-check`, `.llk-section-label`, `.llk-income`, `.llk-statbox`, `.llk-dialog-ic`, `.llk-skel`.
- **Semua halaman:** login, paywall/paket/selamat datang/naik paket, header, nav bawah & sidebar, Absensi, Siswa, profil murid, Track (per siswa & kalender), Kirim, Materi (tautan/folder/PR/kurikulum), Lainnya + semua sub-halaman (backup, pulihkan, notifikasi, pembayaran, progres, pengaturan aplikasi), semua modal & dialog, invoice, hapus akun. Juga `hapus-akun.html`, `privacy-policy.html`, dan V2 (`v2/app.css`, `v2/app.js` ikon, `v2/index.html` sprite+font).
- **Laptop (≥900px):** skala font root 18px (pengganti `zoom:1.08`).
- `manifest.json`: hanya `background_color` (layar splash) → krem `#f6f1e9`; `theme_color` tetap.
- Diuji dengan Playwright (HP 390px & laptop 1366px, tanpa error JS) + uji fungsional: tambah murid, absen + catatan, cari siswa, profil, Track, Kirim, tautan/PR/kurikulum, simpan warna tema, backup, reschedule, gembok batas murid — semua lulus.
- Setelah di-merge: Ctrl+Shift+R di HP & laptop, cek tampilan dengan data asli (50+ murid).

## 🎨 Poles tampilan & perbaikan scroll (PR #21, 29 Sep 2026)
1. **Kartu login:** teks dirapikan jadi 2 baris ("Login dengan akun Google untuk mulai." / "Data absensi & siswa tersimpan otomatis, plus **trial gratis 31 hari**."), `text-wrap:balance`, frasa trial tidak terpotong (`index.html`, `#loginGateMsg`).
2. **Kartu paket (`planCardsHtml`):** tombol harga dibungkus `.llk-plan-btns` dan dipusatkan vertikal di kartu; semua tombol paket (`.llk-plan-btn`) punya animasi hover (naik + membesar) dan animasi tekan (menyusut).
3. **Logo di sidebar laptop (≥900px):** `<img id="sidebarLogo" class="sidebar-logo">` di dalam `.bottom-nav` menggantikan teks "LesLesanKu"; sumber gambar disalin dari logo layar login lewat `llkSetSidebarLogo()` (tidak menggandakan data base64). Tampilan HP tidak berubah.
4. **Bug tidak bisa scroll setelah bayar (laptop):** `showGlobalLoading` dulu mengunci `body.style.overflow='hidden'`; Midtrans Snap menyimpan nilai itu lalu memulihkannya saat ditutup sehingga halaman terkunci sampai reload. Kunci itu dihapus (overlay sudah memblokir wheel/touch) dan ada `llkUnlockPageScroll()` yang dipanggil di semua callback Snap (`onSuccess/onPending/onError/onClose`). **Belum diuji dengan pembayaran sungguhan** — cek di uji sandbox berikutnya bahwa halaman Lainnya bisa di-scroll (untuk Hapus Akun) setelah bayar.
- Tidak ada perubahan yang menyentuh data murid.

## Info dasar
- **Repo:** `crestiantoferdian/crestiantoferdian.github.io`, di-host di GitHub Pages: https://crestiantoferdian.github.io
- **Domain:** `leslesanku.com` (dibeli di Cloudflare Registrar, kedaluwarsa 28 Sep 2027, auto renew ON, pengingat di Google Calendar 1 Agu 2027). Akun Cloudflare sudah pakai 2FA.
- **V1** (`index.html`): aplikasi PWA satu file (±9.000 baris). Sudah dipakai **2 guru**, salah satunya punya 50+ murid. **Keamanan data adalah prioritas utama.**
- **V2** (`/v2/`): versi multi-guru, baru selesai Tahap 1.
- **Layanan:** Firebase (Auth Google + Firestore, project `llk-67a30`), Cloud Functions untuk trial dan Midtrans (kode di `functions/`, salinan versi terpasang "Version 7" 19 Sep 2026; 1st gen, Node.js 20, region us-central1), OneSignal untuk notifikasi, Cloudflare Worker `llk-onesignal-bridge` (sumber: `worker/onesignal-bridge-worker.js`).
- **Data V1:** localStorage `rms4_*`; cloud di `backups/{uid}` + `parts/*`; status langganan di `subscriptions/{uid}` (hanya ditulis server).
- **Tes otomatis:** folder `tests/` (aturan Firestore, V2 e2e, Playwright). Lihat `tests/README.md`.

## ✅ Yang sudah selesai (PR #1–#7, semua sudah di-merge ke main)
1. **Audit dan perbaikan bug V1**
   - Nama murid yang mengandung tanda petik tidak lagi merusak tombol.
   - Hitungan siklus tagihan per sesi sudah benar.
   - Sinkronisasi antar-HP aman: data digabung (tidak saling timpa), memakai transaksi Firestore, dan ada penanda pemilik data.
   - Sudah diuji dengan data 55 murid: jumlah murid dan pemasukan tetap identik, tidak ada data yang hilang.
2. **Fitur pembayaran Bayar di Depan / Bayar di Belakang dengan invoice otomatis.** Invoice bisa dijadikan PDF, dicetak, diunduh, atau dikirim ke WA murid/orang tua.
3. **Hapus Akun** dengan dua kali peringatan, mengetik "password", lalu login ulang Google. Tersedia juga halaman publik `hapus-akun.html`.
4. **Kebijakan privasi diperbarui** (`privacy-policy.html`): trial 31 hari, kamera, invoice, rekening, hapus akun, dan retensi data.
5. **Worker Cloudflare diamankan.** Hanya pengguna yang login (token Firebase terverifikasi) yang bisa memakainya. Tersedia aksi `schedule`, `cancel`, dan `cleanup`.
6. **Aturan Firestore V1 + V2** (`firestore.rules`) sudah dipublish.
7. **Tombol notifikasi** diberi animasi saat ditekan dan loading sampai reminder terjadwal.
8. **Perbaikan notifikasi (PR #7):**
   - Murid yang izin, hadir, atau alpa tidak lagi mendapat reminder.
   - Reminder dobel dibersihkan otomatis lewat tombol "Jadwalkan Ulang Reminder Hari Ini".
   - Pembatalan yang gagal dicoba ulang otomatis.
   - Sudah dicek di OneSignal: tiap murid kini hanya punya 1 reminder.
9. **Soal suara notifikasi:** pilihan suara di aplikasi hanya berlaku saat aplikasi terbuka. Saat tertutup, notifikasi memakai suara HP (**Pengaturan HP → Aplikasi → LesLesanKu/Chrome → Notifikasi → Suara**).

## 🧩 LLK V2: konsep dan progres
- **Guru Admin:** kendali penuh atas jadwal, murid, penugasan guru, laporan, kurikulum, dan nomor HP murid.
- **Guru Mitra:**
  - Hanya melihat murid yang ditugaskan kepadanya.
  - Bisa mengisi hadir dan alpa. Status izin hanya diisi Admin.
  - Wajib mengisi progres setelah menekan Hadir.
  - Bisa mengedit data di hari yang sama. Kalau sudah beda hari, harus minta tolong Admin.
  - Tombol kirim pesan diteruskan ke Admin, karena hanya Admin yang punya nomor murid.
  - Link spreadsheet Mitra berisi **absensi guru**, bukan murid.
- **Honor** dihitung per pertemuan dan bisa diatur custom. Alpa tetap dihitung honor.
- **Harga:** maksimal 5 Mitra seharga Rp499.000 (atau Rp5.000.000/tahun), lalu +Rp100.000 per guru tambahan.
- **Satu akun Google** bisa menjadi Guru Lepas sekaligus Guru Mitra.
- **Tahap 1 (selesai):**
  - Pilih peran, buat organisasi.
  - Kode undangan `LLK-XXXX-XXXX`: sekali pakai, berlaku 7 hari, bisa dikunci ke Gmail tertentu.
  - Kuota 5 kursi, bergabung lewat `?kode=`.
  - Tab Guru untuk Admin; Mitra bisa mengatur honor, link spreadsheet, dan keluar dari organisasi.
  - Tampilan HP dan desktop (sidebar muncul di layar ≥900px).
- **Tahap 2 (belum):** murid, mata pelajaran, tarif, jadwal, dan penugasan Mitra.

## ⏳ Yang belum / berikutnya
1. **Google Play Billing untuk V1** (sedang dikerjakan):
   - **Paket langganan baru (keputusan pemilik, 29 Sep 2026)** — menggantikan PRO Rp40.000:
     | Paket | Maks. murid aktif | Bulanan | Tahunan | Product ID Play (usulan) |
     |---|---|---|---|---|
     | Pro Basic | 10 | Rp35.000 | – | `llk_basic` (base plan `bulanan`) |
     | Pro Up | 40 | Rp75.000 | Rp700.000 | `llk_up` (`bulanan`, `tahunan`) |
     | Pro Unlimited | tak terbatas | Rp100.000 | Rp1.000.000 | `llk_unlimited` (`bulanan`, `tahunan`) |
   - **Aturan batas murid:**
     - Yang dihitung hanya murid **aktif** (Nonaktif tidak dihitung).
     - Kalau sudah mencapai/melewati batas: tombol **Tambah Murid** (dan aktifkan-lagi murid nonaktif) tampil dengan **gembok**; kalau diklik → tawarkan **semua paket di atasnya**. Murid yang sudah ada tetap tampil & bisa diabsen, data tidak pernah disembunyikan/dihapus.
     - **Trial 31 hari = setara Pro Unlimited.**
     - **Pelanggan PRO lama (Midtrans)** = Pro Unlimited sampai masa aktifnya habis.
   - **Aplikasi Android (TWA) baru:** dibuat ulang di PWABuilder dengan host `leslesanku.com` dan package **`com.leslesanku.app`** (permanen setelah terbit). Kunci lama dipakai ulang: folder PWABuilder 09/09/2026 berisi `signing.keystore` + `signing-key-info.txt` (disimpan pemilik, jangan pernah dikirim ke chat). `.well-known/assetlinks.json` sudah memuat package baru dengan sidik jari kunci yang sama.
   - **Pemilik:** Payments profile; upload AAB ke Internal testing; buat 3 langganan di atas; License testing; aktifkan Play Developer API; Service Account + izin di Play Console; simpan kuncinya sebagai secret di Cloudflare.
   - **Claude (Play Billing, belum):** deteksi aplikasi dari Play Store (Play Billing) atau browser (Midtrans); verifikasi pembelian di worker Cloudflare; acknowledge dalam 3 hari; tombol "Pulihkan Langganan".
   - ✅ **Paket baru di web (PR #14):** `functions/plans.js` = katalog paket server; `LLK_TIERS` di `index.html` = katalog aplikasi (**harus sama**). Webhook menulis `tier` ke `subscriptions/{uid}`. Ganti paket = berlaku mulai hari itu (sisa masa lama tidak dibawa); paket sama = diperpanjang di ujung. Aplikasi: gembok 🔒 di Tambah Murid & "aktifkan lagi" saat batas tercapai → tawaran paket di atasnya; paywall & layar Selamat Datang menampilkan 3 paket dengan tanda "Cocok untukmu" sesuai jumlah murid aktif; badge akun menampilkan nama paket + tombol "Naik Paket".
   - ✅ **Functions sudah di-deploy** 29 Sep 2026 (4 fungsi, Node.js 22, 1st gen) lewat Google Cloud Shell: `git clone` branch → `cloudshell edit .env` (salin dari file .env pemilik) → `npm ci && npm test` → `npx -y firebase-tools@13 login --no-localhost` → `npx -y firebase-tools@13 deploy --only functions --project llk-67a30`. Catatan: kalau Cloud Shell menyimpan project ID yang salah (mis. `llk-67a30.` bertitik), perbaiki env `GOOGLE_CLOUD_QUOTA_PROJECT` dkk ke `llk-67a30` sebelum deploy. Peringatan "Unhandled error cleaning up build images" = sisa image build di Container Registry (biaya kecil), bisa dibersihkan belakangan.
   - ⏳ (lama) **Deploy functions dulu, baru merge PR #14** (aplikasi baru mengirim kunci paket baru yang ditolak server lama). Lalu pindah Midtrans ke production: Server Key production di `functions/.env` + `MIDTRANS_IS_PRODUCTION=true`, Client Key production + `app.midtrans.com/snap/snap.js` di `index.html`, Notification URL di dashboard Midtrans production → `https://us-central1-llk-67a30.cloudfunctions.net/midtransWebhook`. Akun Midtrans production **sudah aktif** (29 Sep 2026).
2. ✅ **Pindah ke domain `leslesanku.com`** (PR #9, #10) — selesai 29 Sep 2026:
   - ✅ Worker `llk-onesignal-bridge` menerima alamat baru + alamat lama (sudah di-deploy).
   - ✅ DNS Cloudflare: 4 record A `@` → 185.199.108–111.153 dan CNAME `www` → `crestiantoferdian.github.io`, semua **DNS only** (jangan diubah ke proxied).
   - ✅ Firebase Authorized domains: `leslesanku.com` dan `www.leslesanku.com` ditambahkan; `crestiantoferdian.github.io` tetap ada.
   - ✅ Data 2 guru aktif sudah tersinkron ke cloud (version 8, 28 Sep 2026).
   - ✅ PR #9 di-merge 28 Sep 2026 23:39 WIB; https://leslesanku.com sudah aktif (HTTPS jalan).
   - ✅ OneSignal (app "LLK App") → Settings → Push & In-App → Web → Site URL diganti ke `https://leslesanku.com` (29 Sep 2026). Notifikasi di HP pemilik sudah aktif lagi di alamat baru.
   - ✅ HP guru kedua (istri pemilik, guru bahasa Inggris) sudah pindah; GitHub Pages: custom domain `leslesanku.com`, DNS check successful, **Enforce HTTPS** aktif. **Pindah domain selesai.**
   - Catatan: `gitarsaktipol` hanya kolaborator di repo `crestiantoferdian` (tidak ada salinan repo terpisah); semua merge-nya masuk ke repo ini, tapi menu Settings hanya bisa dibuka akun pemilik.
   - Setelah pindah: pakai `https://leslesanku.com` untuk isian website di Play Console, dan `https://leslesanku.com/privacy-policy.html` untuk kebijakan privasi. Aplikasi Android (TWA) versi baru harus memakai host `leslesanku.com`.
3. **Closed testing** 12 penguji × 14 hari, lalu isi formulir **Data Safety** di Play Console.
4. ✅ **Celah reset trial** — kode siap di PR #14, aktif setelah functions di-deploy.
5. **V2 Tahap 2.**
6. **Midtrans** tetap dipakai untuk versi web. Saat rilis, ganti ke URL dan Client Key production.

## 💻 Tampilan laptop (V1)
- Layar ≥900px: menu bawah jadi **sidebar kiri**, isi di tengah (maks. 1120px) sedikit diperbesar, form/modal tampil sebagai jendela di tengah.
- Layar ≥1200px: daftar Absensi, Siswa, Track, dan menu Lainnya jadi **2 kolom**.
- Semuanya lewat CSS `@media` di akhir `<style>` utama `index.html`; tampilan HP (<900px) tidak berubah (dicek piksel per piksel).

## 🔁 Ganti akun di perangkat yang sama
- Tombol login selalu menampilkan jendela "Pilih akun" Google (PR #11).
- Login akun A → yang tampil data akun A. Logout lalu login akun B → data B langsung dimuat dari cloud (kosong kalau akun baru), tanpa dialog konfirmasi.
- Sebelum diganti, data perangkat disimpan ke "Pulihkan Cadangan Darurat" (tab Lainnya). Pengaturan akun lama (nama sekolah, info rekening, dll.) dibersihkan supaya tidak terbawa.

## 🛡️ Anti-kecurangan trial & pembayaran (PR #15, 29 Sep 2026)
Hasil analisis + simulasi; semua di bawah sudah ditutup:
1. **Trial berulang pakai Gmail baru + pulihkan data lama** → file backup & cadangan darurat kini memuat `ownerUid`; data milik akun lain hanya bisa dipulihkan ke akun **berlangganan** (bukan trial) — muncul tawaran "Data dari Akun Google Lain". File lama tanpa `ownerUid` tetap boleh. Pulihkan cadangan saat belum login → pemilik data dicatat sebagai akun asal.
2. **Mundurkan jam HP** → masa aktif dihitung dengan `llkNow()`: jam server (header `Date` dari HEAD `manifest.json`, tidak lewat service worker) + batas bawah `llk_time_floor` (jam server terakhir yang pernah terlihat, juga dari timestamp dokumen `subscriptions`). Status dicek ulang tiap 5 menit selama app terbuka.
3. **Batas murid bisa dilewati** → dicek juga di form Edit (aktifkan lagi), di `doSave` untuk murid baru, dan setelah pulihkan file/teks/cadangan: murid kelebihan dijadikan **nonaktif** (`autoInactiveByLimit`), tidak dihapus.
4. **Bayar tapi tidak aktif (webhook gagal)** → callable baru `checkMidtransPayment` menanyakan status order pending milik user ke Midtrans Core API (`api[.sandbox].midtrans.com/v2/{order}/status`), cocokkan nominal, lalu aktifkan. Dipanggil otomatis setelah jendela bayar ditutup / sukses, sekali saat paywall tampil, dan lewat tombol "🔄 Cek status pembayaran".
5. **Notifikasi ganda bersamaan** → aktivasi order lewat `activateOrder()` dalam transaksi Firestore; webhook juga menolak nominal yang tidak cocok dengan order.
- Sengaja dibiarkan: kalau Firebase gagal dimuat (offline / diblokir), app tetap bisa dipakai tanpa paywall — demi guru yang mengajar tanpa internet.
- Tidak bisa dicegah 100%: orang membuat Gmail baru tiap bulan dan mulai dari nol (tanpa data lama).

## 🔑 Login Google lewat domain sendiri (PR #16 & #17)
- Helper login resmi Firebase di-host di `__/auth/` (lihat `__/README.md`); `authDomain` V1 & V2 = `leslesanku.com` → layar Google menampilkan "Lanjutkan ke leslesanku.com".
- Google Cloud → Credentials → OAuth client "Web client (auto created by Google Service)": origin `https://leslesanku.com` + redirect `https://leslesanku.com/__/auth/handler` (ditambahkan 29 Sep 2026; isian lama firebaseapp.com tetap ada sebagai cadangan).
- Kalau login bermasalah: kembalikan `authDomain` ke `llk-67a30.firebaseapp.com` di `index.html` & `v2/app.js`.
- Berikutnya (opsional): verifikasi merek di Google Auth Platform → Branding agar tampil nama "LesLesanKu" + logo.

## ☁️ Cloud Functions (`functions/`)
- 3 fungsi (1st gen, us-central1): `onUserCreate` (buat trial 31 hari di `subscriptions/{uid}` saat akun baru), `createMidtransTransaction` (callable, buat transaksi Snap, simpan `orders/{orderId}`), `midtransWebhook` (HTTP, verifikasi signature SHA-512 → aktifkan/perpanjang langganan + kirim invoice email).
- Rahasia (`MIDTRANS_SERVER_KEY`, `MIDTRANS_IS_PRODUCTION`, `SMTP_USER`, `SMTP_PASS`) ada di `functions/.env` yang **hanya** tersimpan di Firebase — tidak pernah di-commit (`functions/.gitignore`).
- ⚠️ Node.js 20 dihentikan Google **30 Okt 2026** → `engines.node` sudah 22 di repo; berlaku saat deploy berikutnya.
- ✅ Celah trial ditutup (PR #14, aktif setelah deploy): `onUserCreate` mencatat `trialUsage/{sha256(email)}`; email yang sudah tercatat mendapat `status:'expired', trialDenied:'already_used'` (paywall menampilkan "Trial Gratis Sudah Pernah Dipakai"). Fungsi baru `onUserDelete` mencatat email akun lama yang dihapus. `trialUsage` ditolak untuk client di `firestore.rules`.
- Tes: `cd functions && npm test` (tiruan Firebase di memori, tanpa internet).
- Deploy belum pernah dilakukan dari repo ini; pemilik tidak memakai Firebase CLI → rencana deploy lewat Cloud Console (Edit → Source) atau dipandu.

## ⚠️ Aturan kerja
- Jangan pernah menghapus atau menimpa data pengguna. Tanyakan dulu kalau ada perubahan yang berisiko ke data.
- Semua perubahan harus lulus tes sebelum di-merge.
- Setiap kali file `worker/onesignal-bridge-worker.js` berubah, kode di Cloudflare harus di-deploy ulang secara manual (Edit code → tempel → Deploy).
- Setiap ada kemajuan berarti, perbarui file ini.
