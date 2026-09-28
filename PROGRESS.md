# 📘 Progres Project LesLesanKu (LLK)

_Terakhir diperbarui: 28 Sep 2026_

## Info dasar
- **Repo:** `crestiantoferdian/crestiantoferdian.github.io`, di-host di GitHub Pages: https://crestiantoferdian.github.io
- **Domain:** `leslesanku.com` (dibeli di Cloudflare Registrar, kedaluwarsa 28 Sep 2027, auto renew ON, pengingat di Google Calendar 1 Agu 2027). Akun Cloudflare sudah pakai 2FA.
- **V1** (`index.html`): aplikasi PWA satu file (±9.000 baris). Sudah dipakai **2 guru**, salah satunya punya 50+ murid. **Keamanan data adalah prioritas utama.**
- **V2** (`/v2/`): versi multi-guru, baru selesai Tahap 1.
- **Layanan:** Firebase (Auth Google + Firestore, project `llk-67a30`), Cloud Functions untuk trial dan Midtrans (kodenya **tidak ada di repo**), OneSignal untuk notifikasi, Cloudflare Worker `llk-onesignal-bridge` (sumber: `worker/onesignal-bridge-worker.js`).
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
1. **Google Play Billing untuk V1** (sedang dibahas):
   - **Pemilik:** isi Payments profile; upload AAB ke Internal testing; buat langganan `llk_pro` (base plan `bulanan` Rp40.000 dan `tahunan`); tambahkan License testing; aktifkan Play Developer API; buat Service Account dengan izin di Play Console; simpan kuncinya sebagai secret di Cloudflare.
   - **Claude:** deteksi aplikasi dari Play Store (pakai Play Billing) atau browser (tetap Midtrans), verifikasi pembelian di worker Cloudflare, tulis status ke `subscriptions/{uid}`, konfirmasi pembelian ke Google dalam 3 hari, tombol "Pulihkan Langganan".
   - **Masih harus dijawab:** sudah punya akun Play Console dan AAB? Berapa harga tahunan? Setuju verifikasi dipasang di worker Cloudflare?
2. **Pindah ke domain `leslesanku.com`** (PR #9):
   - ✅ Worker `llk-onesignal-bridge` menerima alamat baru + alamat lama (sudah di-deploy).
   - ✅ DNS Cloudflare: 4 record A `@` → 185.199.108–111.153 dan CNAME `www` → `crestiantoferdian.github.io`, semua **DNS only** (jangan diubah ke proxied).
   - ✅ Firebase Authorized domains: `leslesanku.com` dan `www.leslesanku.com` ditambahkan; `crestiantoferdian.github.io` tetap ada.
   - ✅ Data 2 guru aktif sudah tersinkron ke cloud (version 8, 28 Sep 2026).
   - ✅ PR #9 di-merge 28 Sep 2026 23:39 WIB; https://leslesanku.com sudah aktif (HTTPS jalan).
   - ⏳ Sisa: cek GitHub Settings → Pages (login sebagai pemilik `crestiantoferdian`, bukan kolaborator `gitarsaktipol`) → Enforce HTTPS → GitHub Settings → Pages → Enforce HTTPS → ganti Site URL OneSignal → guru login ulang & nyalakan ulang notifikasi.
   - Setelah pindah: pakai `https://leslesanku.com` untuk isian website di Play Console, dan `https://leslesanku.com/privacy-policy.html` untuk kebijakan privasi. Aplikasi Android (TWA) versi baru harus memakai host `leslesanku.com`.
3. **Closed testing** 12 penguji × 14 hari, lalu isi formulir **Data Safety** di Play Console.
4. **Celah reset trial** (perlu kode Cloud Functions).
5. **V2 Tahap 2.**
6. **Midtrans** tetap dipakai untuk versi web. Saat rilis, ganti ke URL dan Client Key production.

## 🔁 Ganti akun di perangkat yang sama
- Login akun A → yang tampil data akun A. Logout lalu login akun B → data B langsung dimuat dari cloud (kosong kalau akun baru), tanpa dialog konfirmasi.
- Sebelum diganti, data perangkat disimpan ke "Pulihkan Cadangan Darurat" (tab Lainnya). Pengaturan akun lama (nama sekolah, info rekening, dll.) dibersihkan supaya tidak terbawa.

## ⚠️ Aturan kerja
- Jangan pernah menghapus atau menimpa data pengguna. Tanyakan dulu kalau ada perubahan yang berisiko ke data.
- Semua perubahan harus lulus tes sebelum di-merge.
- Setiap kali file `worker/onesignal-bridge-worker.js` berubah, kode di Cloudflare harus di-deploy ulang secara manual (Edit code → tempel → Deploy).
- Setiap ada kemajuan berarti, perbarui file ini.
