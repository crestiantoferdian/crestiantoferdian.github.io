# Rencana Pengajuan Ulang Akses Produksi — LesLesanKu

_Disusun 5 Nov 2026, setelah Google menjawab pengajuan pertama (3 Nov) dengan **"More testing required to access Google Play production"**._

> ⚠️ Repo ini publik: jangan tulis nama, email, atau alamat grup penguji, kata sandi, maupun isi keystore di file ini. Pakai kode seperti P1, P2 untuk penguji.

## 1. Apa yang terjadi
- Email Google 5 Nov 2026: *"We reviewed your application, and determined that your app requires more testing before you can access production."*
- Kemungkinan alasan yang disebut Google: **(a)** penguji tidak terlibat aktif dengan aplikasi selama pengujian tertutup, **(b)** praktik pengujian terbaik tidak diikuti, termasuk **mengumpulkan dan menindaklanjuti masukan pengguna lewat pembaruan aplikasi**.
- Instruksi Google: **uji lagi dengan pengujian tertutup selama tambahan 14 hari dengan penguji nyata**, baru ajukan ulang.
- Panduan resmi Google (Bantuan Konsol Play, "Persyaratan pengujian aplikasi untuk akun developer pribadi baru") menyebut alasan pengujian tambahan: **jumlah penguji ikut serta < 12** *atau* **interaksi penguji tidak memadai**. Jumlah kita sudah 12, jadi penyebab paling mungkin adalah **interaksi**, bukan angka.
- Fakta yang kita tahu (jujur): sebagian penguji berasal dari layanan berbayar pihak ketiga; hanya ±6 penguji nyata; seluruh 6 masukan di Play ("Masukan pengujian") datang **19 Okt saja**, singkat ("bagus", "stabil", "sangat membantu"), tanpa bug/saran spesifik; aplikasi tetap **versi 1** selama pengujian (tidak ada pembaruan sebagai tindak lanjut masukan).

## 2. Daftar periksa kesiapan (Google menyebut 4 area kebijakan)
- [ ] **Konten, fitur, monetisasi** sesuai kebijakan. Risiko: setelah trial 31 hari, pengguna Play melihat paywall dengan tombol beli "Segera hadir". Sebaiknya **Google Play Billing selesai** sebelum atau bersamaan dengan produksi.
- [ ] **Penargetan & rating konten** akurat: audiens 18+, rating sudah diisi, kategori Pendidikan.
- [ ] **Keandalan fungsional**: tidak ada fungsi rusak, error, atau layar kosong. Jalankan **Laporan pra-peluncuran** (Uji dan rilis → Pengujian → Laporan pra-peluncuran) dan perbaiki temuannya.
- [ ] **Kredensial pengujian**: akun Google khusus reviewer masih bisa login dan berfungsi penuh (status PRO tester). Cek ulang sebelum mengajukan.
- [ ] Kebijakan privasi diperbarui dengan **Google Play Billing** saat Billing aktif (sekarang hanya menyebut Midtrans).
- [ ] **Pernyataan status pedagang**: batas **1 Feb 2027** (Kelola akun → Detail akun → Tentang Anda → Status pedagang, lalu per aplikasi di Konten aplikasi). Baca teks Console dulu, isi sesuai kenyataan; pedagang perorangan wajib nomor telepon publik terverifikasi, nomor & alamat tampil publik. Menurut email Google, yang tidak mendistribusikan aplikasi di EEA/Inggris boleh menyatakan non-pedagang. Memberi pernyataan tidak benar melanggar Pasal 11.4.
- [ ] Rekomendasi "Untuk rilis Anda berikutnya" (Uji dan rilis): layar penuh/edge-to-edge (Android 15), API layar penuh usang, batasan orientasi (Android 16). Semuanya kategori *Pengalaman pengguna* (bukan kebijakan). Ditangani saat **build versi 2** (lihat bagian 6). `manifest.json` berisi `"orientation": "portrait"`; mengubahnya menyentuh manifest yang dipakai guru → **tanya pemilik dulu**.

## 3. Rencana 14 hari
**Hari 0** = tanggal ketika ≥12 penguji **nyata** sudah ikut serta (lihat Dasbor). **Hari 14** = Hari 0 + 14. Contoh: Hari 0 = 10 Nov → boleh ajukan lagi ≈ 24 Nov. (Pegang tanggal yang ditunjukkan Dasbor, bukan perhitungan ini.)

| Kapan | Kerjakan |
|---|---|
| Hari ini–Hari 0 | Cari penguji nyata (bagian 5) → target 12–15 orang **guru les** (target audiens). Aktifkan notifikasi masukan (Masukan pengujian → Kelola preferensi). Jangan keluarkan penguji yang sudah ada sebelum penguji nyata ≥12 |
| Hari 0 | Kirim **petunjuk menguji** (bagian 4) ke semua penguji nyata |
| Hari 0–3 | Jalankan **Laporan pra-peluncuran**, cek akun reviewer, perbaiki temuan |
| Hari 1–7 | Kumpulkan masukan (bagian 4–5), catat di **lembar masukan** (bagian 7). Balas masukan di Console (maks 350 karakter) |
| Hari 3–10 | **Rilis versi 2** ke Pengujian tertutup (bagian 6) berisi perbaikan dari masukan nyata |
| Hari 10–14 | Tanyakan lagi ke penguji: sudah update? ada masalah baru? Pastikan jumlah penguji ikut serta tidak turun <12 |
| Hari 14+ | Dasbor → Ajukan permohonan untuk produksi, jawab dengan fakta bagian 8 |

## 4. Petunjuk menguji + pertanyaan masukan (kirim ke penguji)
Google: *beri petunjuk jelas cara menguji & melapor bug, tentukan jenis masukan, dorong memakai sebanyak mungkin fitur, sediakan saluran masukan jelas.*

```
Terima kasih sudah jadi penguji LesLesanKu! 🙏 Selama 14 hari ke depan, tolong coba:
1. Login dengan Google
2. Tambah 1–2 murid & atur jadwalnya
3. Tandai absensi (hadir/izin/alpa) di beberapa hari berbeda
4. Tulis catatan progres & kirim ke WhatsApp
5. Buat invoice/kuitansi
6. Aktifkan pengingat jadwal

Buka aplikasinya beberapa kali, di hari yang berbeda.

Mohon jawab: (a) fitur mana yang kamu coba? (b) apa yang membingungkan atau error? (c) apa yang kurang? Kirim ke saya, ke fertunestudio@gmail.com, atau tekan "Beri masukan" di halaman aplikasi di Play Store.

PENTING: jangan keluar dari program penguji dan jangan hapus aplikasinya sampai saya kabari (minimal 14 hari).
```

## 5. Mencari penguji nyata (target audiens: guru les)
Google menyarankan: jaringan pribadi/profesional **dan komunitas tempat calon pengguna berada**; penguji yang **mewakili target audiens**.
```
Halo guru-guru les! Saya membuat aplikasi LesLesanKu (LLK) untuk mencatat jadwal, absensi, progres murid, dan tagihan les privat. Lagi cari ±12 guru yang mau jadi penguji di Google Play selama 14 hari. Gratis, cukup pakai HP Android + Gmail, dan bantu beri masukan. Yang berminat, kirim Gmail-nya ke saya ya 🙏
```
- Posting sekali di grup guru les/guru musik/komunitas pengajar lalu balas satu per satu (cocok untuk yang tidak suka banyak interaksi).
- Hanya orang dewasa dengan akun Google biasa (bukan akun anak/Family Link) di HP Android. Tambahkan ke grup penguji lewat groups.google.com → Anggota → Tambahkan anggota.

## 6. Rilis versi 2 ke Pengujian tertutup (tindak lanjut masukan)
- Langkah build & rilis: `PANDUAN-RILIS.md` **bagian F** (PWABuilder versi terbaru, App version `1.0.1`, **version code 2**, Start URL `/?src=play`, kunci lama; Icon URL `splash-1024.png`, Maskable icon `icon-maskable-512.png`, background `#F6F1E9`). Rilis lewat **Pengujian internal** dulu → cek di HP → promosikan ke **Pengujian tertutup** (Tambahkan dari library). Penguji cukup **update** dari Play Store.
- Bonus: PWABuilder/templat terbaru biasanya membereskan peringatan *edge-to-edge* dan *API layar penuh usang* (aku tidak bisa memastikan semua hilang; cek lagi di Uji dan rilis sesudahnya).
- Uji di HP **Android 15/16**: judul/tombol tidak tertimpa status bar atau bilah bawah.
- Masukan nyata yang **sudah ada** dan bisa jadi tindak lanjut: layar pembuka v1 pecah (masukan penguji 20 Okt → diperbaiki v2); rincian "Uang Masuk" bulanan, siapa sudah/belum bayar (PR #158/#159, 2 Nov); teks paywall untuk langganan berakhir (PR #135).

## 7. Lembar pencatat masukan (isi terus; jangan tulis nama/email)
| Tgl | Dari (kode) | Saluran | Isi masukan | Tindakan | Dirilis di versi |
|---|---|---|---|---|---|
| 19 Okt | P1–P6 | Masukan pengujian (Play) | Singkat: "bagus", "stabil", "sangat membantu" (4–5 ★) | Dibalas/tidak | — |
| 20 Okt | P? | WhatsApp | Layar pembuka v1 pecah/kurang rapi | Gambar baru `store/play/twa/` | v2 |
| 2 Nov | P? | Chat | Jadwal bulanan: tambah rincian siapa yang bayar | PR #158/#159 | web (live) |
| … | | | | | |

## 8. Kerangka jawaban formulir (isi `[ISI]` dengan fakta; tiap kolom maks 300 karakter, tulis dulu di catatan lalu salin — keluar tanpa Berikutnya/Terapkan = jawaban hilang)
**Halaman 1 — Tentang pengujian tertutup**
1. *Cara merekrut* (ditanya langsung soal penyedia berbayar → jawab jujur):
```
Saya mengajak sesama guru les lewat [ISI: grup/komunitas], keluarga, dan kenalan; mereka bergabung lewat Google Grup. Total [ISI] penguji nyata. Layanan penguji berbayar [ISI: masih dipakai / sudah tidak dipakai], jumlahnya [ISI].
```
2. *Seberapa mudah merekrut:* pilih sesuai kenyataan.
3. *Engagement* (apakah memakai semua fitur, sesuai perilaku pengguna produksi, beda apa):
```
[ISI] dari [ISI] penguji nyata mencoba jadwal, absensi, progres, kirim WhatsApp, invoice. Beda dari pengguna produksi: penguji membuka [ISI: berapa hari/kali], guru sungguhan memakainya tiap hari. Console [tgl]: [ISI] perangkat aktif.
```
4. *Ringkasan masukan & cara mengumpulkan:*
```
Lewat Masukan pengujian di Play, WhatsApp, dan email. [ISI] masukan. Contoh: layar pembuka pecah (diperbaiki v2), tambah rincian Uang Masuk bulanan, ubah teks paywall langganan berakhir. [ISI masukan baru]. Tindak lanjut: rilis v2.
```
**Halaman 2 — Tentang aplikasi**
- *Audiens:* "Guru les privat dewasa di Indonesia (piano, gitar, vokal, bahasa Inggris, matematika, mengaji, dll.) yang mengelola murid sendiri. Bukan untuk anak-anak. Orang tua murid tidak memakai aplikasi, hanya menerima laporan dan tagihan lewat WhatsApp."
- *Nilai bagi pengguna:* "Menggantikan buku catatan dan spreadsheet: jadwal les, absensi (hadir/izin/alpa), catatan progres per pertemuan, tagihan dan kuitansi otomatis yang bisa dikirim ke WhatsApp orang tua, serta pengingat jadwal. Data tersimpan di cloud dan aman saat ganti HP."
- *Instalasi tahun pertama:* **"0 - 10 ribu"** (realistis untuk niche guru les).

**Halaman 3 — Kesiapan produksi** (tombol kirim terakhir = **Terapkan**)
- *Perubahan dari pengujian:*
```
Rilis v2 [ISI: tanggal]: layar pembuka & ikon baru, [ISI perbaikan dari masukan]. Web: rincian Uang Masuk bulanan, teks paywall langganan berakhir. Midtrans disembunyikan di Play. Bilah alamat dihilangkan. Laporan pra-peluncuran [ISI: hasil].
```
- *Cara memutuskan siap:*
```
Penguji nyata [ISI] orang memakai fitur inti [ISI] hari tanpa crash berat. Masukan ditindaklanjuti di v2. Kebijakan privasi, Data Safety, hapus akun, rating, akun reviewer lengkap. Play Billing [ISI: sudah/segera]. Sudah dipakai guru sungguhan di web.
```

## 9. Catatan jujur
- Jangan menulis klaim yang tidak benar di formulir (peninjau membaca). Kalau penyedia berbayar masih ikut dihitung, sebutkan. Lebih baik jumlah penguji nyata yang kuat daripada angka besar yang diragukan.
- Masukan di Play yang ada (6, semuanya 19 Okt) boleh disebut apa adanya, tapi tidak cukup sebagai satu-satunya bukti; kumpulkan masukan baru yang spesifik.
- Selama 14 hari: jangan ubah/hapus grup penguji tanpa memastikan penguji nyata ≥12 tetap ikut serta (risiko hitungan hari terputus).
