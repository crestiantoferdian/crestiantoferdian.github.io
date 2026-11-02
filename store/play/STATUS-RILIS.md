# Status Rilis Google Play — LesLesanKu (per 3 Nov 2026)

Ringkasan untuk melanjutkan di chat baru. Panduan langkah lengkap: `store/play/PANDUAN-RILIS.md`.
Bahan listing & jawaban Data Safety: `store/play/LISTING.md`.

> ⚠️ Repo ini publik: jangan tulis kata sandi, isi keystore, atau daftar email penguji di file mana pun.

## Data aplikasi
| Hal | Isi |
|---|---|
| Akun developer | **FerTune Studio** (pribadi, terverifikasi 14 Okt 2026), email kontak `fertunestudio@gmail.com` |
| Nama aplikasi | LesLesanKu – Absensi Les |
| Package | `com.leslesanku.app` (TWA dari PWABuilder, host `leslesanku.com`, Start URL `/?src=play`) |
| Versi | 1.0.0.0 (version code 1), ditandatangani kunci lama (folder PWABuilder 09/09/2026, alias `my-key-alias`) |
| Play App Signing | Aktif. SHA-256 kunci upload & kunci Play sudah ada di `.well-known/assetlinks.json` → bilah alamat browser hilang (sudah dicek di HP) |
| Pembayaran di app Play | Midtrans disembunyikan (`llkPlayPayNotice`), tombol beli → "Segera hadir". Penguji pakai trial 31 hari / akun tester |

## ✅ Sudah selesai
1. **Pengujian internal**: rilis 1 (1.0.0.0) aktif, daftar penguji "Tim LLK", sudah terpasang & jalan di HP.
2. **Listingan Play Store**: nama, deskripsi singkat & lengkap, ikon opsi A, feature graphic, 6 screenshot (data contoh campuran mapel: Matematika, B. Inggris, Piano, Mengaji, dll). Pernyataan aset AI: *Jangan beri label*.
3. **Semua tugas "Selesaikan penyiapan aplikasi"** (11/11):
   - Kebijakan privasi: `https://leslesanku.com/privacy-policy.html`
   - Detail login: **Ya** → akun Google khusus reviewer (berstatus PRO tester, 2FA mati, "Lewati sandi" mati, berisi 3 murid contoh). Petunjuk dalam bahasa Inggris. Sandi hanya ada di Play Console.
   - Iklan: tidak ada iklan
   - Rating konten: kategori "Semua jenis aplikasi lainnya"; hasil IARC 3+ / PEGI 3 / ESRB Everyone (Brasil 14 karena pembelian digital). Pembelian digital = Ya, item acak = Tidak, produk edukasi = Tidak
   - Audiens target: **18+ saja**, kotak "batasi anak di bawah umur" tidak dicentang
   - Keamanan data: 7 jenis data dikumpulkan (Nama, Email, ID pengguna, Nomor telepon[opsional], Riwayat pembelian, Konten buatan pengguna, ID perangkat[opsional]); tidak ada yang dibagikan; terenkripsi; link hapus akun `https://leslesanku.com/hapus-akun.html`. Foto progres TIDAK (hanya di HP)
   - Aplikasi pemerintah: tidak · Fitur keuangan: tidak ada · Kesehatan: tidak ada
   - Kategori: **Pendidikan** · Kontak: `fertunestudio@gmail.com`, situs `https://leslesanku.com` (telepon dikosongkan / format +62)
4. **Pengujian tertutup (Alpha)**: negara **Indonesia**, daftar penguji **"Tim LLK"**, email masukan `fertunestudio@gmail.com`. Rilis **1 (1.0.0.0)** dibuat dari "Tambahkan dari koleksi" (AAB yang sama dengan internal), catatan rilis `<id>Versi pertama</id>`.
5. **Dikirim & disetujui Google** (17 Okt 2026): **Pengiriman 1** berisi 14 perubahan (rilis Alpha, negara, penguji, listingan, rating konten, audiens 18+, kebijakan privasi, pernyataan iklan, Keamanan Data, aplikasi kesehatan, kategori Pendidikan) → status **Diterbitkan** hanya ±11 menit setelah dikirim (11.32 → 11.43). Lihat di **Ringkasan publikasi → Aktivitas pengiriman**.
6. **Sumber penguji sekarang = 2 Google Grup** (19 Okt 2026). Di tab Penguji, **"Daftar email" dan "Google Grup" adalah pilihan tunggal (radio)**, jadi daftar email "Tim LLK" **tidak lagi aktif**. Kolom Google Grup berbentuk chip dan menerima **lebih dari satu grup**:
   - **Grup milik pemilik** (dibuat 19 Okt): pemilik + 5 anggota dewasa (saudara/kenalan), ditambahkan langsung, langganan "tanpa email", daftar anggota hanya terlihat pemilik/manajer, hanya bisa bergabung lewat undangan. Anggota baru ditambah lewat groups.google.com → Anggota → Tambahkan anggota, tanpa mengubah Play Console.
   - **Grup dari layanan tester berbayar** (dibeli pemilik di Shopee, ±13 akun, mereka sendiri yang memasang & mengisi laporan). **Tidak bisa diverifikasi**; dasbor layanan itu laporan sepihak, bukan data Google. Ada risiko kebijakan Google Play (penguji harus orang sungguhan); jangan bergantung padanya, dan jawab kuesioner Produksi dengan jujur.
   - **Pengiriman 2 dan 3** (19 Okt 11.38 & 20.30) juga berstatus **Diterbitkan**, jadi kedua grup aktif. Email masukan: `fertunestudio@gmail.com` (tanpa titik di belakang).
7. **Dasbor (19 Okt)**: "9 penguji saat ini ikut serta" dari target ≥12. Yang dihitung hanya yang sudah menekan "Jadi penguji" lewat link, bukan jumlah anggota grup. Orang nyata di grup pemilik baru ±6, jadi **cari ±6 orang dewasa lagi** supaya syarat terpenuhi tanpa mengandalkan layanan berbayar.

8. **Pengujian 14 hari selesai** (±3 Nov 2026): Dasbor menampilkan 12 penguji ikut serta (26 Okt: "6 hari secara terus-menerus"), lalu ketiga syarat tercentang dan tombol **Ajukan permohonan untuk produksi** aktif. Statistik 26 Okt: 26 perangkat memasang, 18 membuka/aktif.
9. **Permohonan akses Produksi DIAJUKAN** (3 Nov 2026, 00.14 menurut Console). Status: *"Kami sedang meninjau formulir permohonan Anda… biasanya 7 hari atau kurang, terkadang lebih lama"*; hasil dikirim ke email pemilik akun. Formulir 3 halaman (tiap kolom teks maks 300 karakter): (1) tentang pengujian — cara merekrut penguji (**ditanya langsung: teman/keluarga atau penyedia berbayar** → dijawab jujur, termasuk layanan berbayar), kemudahan merekrut, engagement, ringkasan masukan; (2) tentang aplikasi — target audiens guru les dewasa, nilai bagi pengguna, perkiraan instalasi tahun pertama "0–10 ribu"; (3) kesiapan produksi — perubahan dari hasil pengujian (teks paywall langganan berakhir, Midtrans disembunyikan di Play, bilah alamat dihilangkan, menu LLK Lembaga disembunyikan di Play, rincian "Uang Masuk" bulanan siapa sudah/belum bayar [PR #158/#159]) dan alasan siap produksi. Tombol kirim terakhir bernama **Terapkan**.

### Pelajaran dari proses ini (supaya tidak terulang)
- Membuat rilis tertutup: **jangan klik Upload** untuk AAB yang sama → muncul "Kode versi 1 sudah digunakan". Pakai **Tambahkan dari koleksi** lalu pilih versi 1.
- Ringkasan publikasi sempat memblokir pengiriman: **"Pernyataan ID iklan tidak lengkap"** → Konten aplikasi → ID Iklan → **Tidak** → Simpan, baru tombol "Kirim … perubahan untuk ditinjau" bisa dipakai.
- Halaman Dasbor "2 dari 5" tidak langsung berarti email masukan terisi; cek tab Penguji.
- Syarat 12 penguji dihitung dari yang **ikut serta**, bukan dari jumlah email di daftar. Jangan memakai emulator/akun buatan; penguji harus orang sungguhan dengan HP Android.
- Pindah dari "Daftar email" ke "Google Grup" **menonaktifkan** daftar email (pilihan tunggal) → saudara yang ada di daftar email langsung tidak bisa masuk. Sebelum mengganti sumber penguji, pindahkan dulu semua orangnya ke sumber baru.
- Email masukan jangan berakhiran titik (`fertunestudio@gmail.com.` salah).
- Perubahan daftar penguji ikut masuk **Ringkasan publikasi → Kirim perubahan untuk ditinjau**; di akun ini terbit dalam beberapa menit.
- Akun Google anak (Family Link/terawasi) sering tidak bisa dipakai sebagai anggota grup atau penguji; pakai akun orang tua di HP Android orang tua. Aplikasi target usia 18+.

## ⏭️ Langkah berikutnya (urut)
1. **Tunggu hasil review Produksi** (≤7 hari, kadang lebih) lewat email pemilik akun (cek folder Spam). Jangan klik tautan di email: buka Play Console langsung. **Selama menunggu, jangan keluarkan penguji, jangan ubah/hapus grup penguji**, dan jangan mengubah pengujian tertutup tanpa perlu.
2. **Kalau disetujui:** Produksi → **Buat rilis baru** → **Tambahkan dari koleksi** (jangan Upload ulang), catatan rilis `<id>…</id>`, Simpan → Tinjau → peluncuran bertahap (mis. 20% → 100%) → **Ringkasan publikasi → Kirim perubahan untuk ditinjau**.
3. **Kalau ditolak:** baca alasannya di email/Console, perbaiki, ajukan ulang. Jangan menambah/menutupi apa pun; jawab jujur.
4. **Pernyataan trader status** (pengumuman Google 30 Okt 2026, mulai November): isi sesuai kenyataan saat Console meminta; pakai email kontak publik, bukan Gmail pribadi. Alamat `llk@leslesanku.com` lewat Cloudflare Email Routing masih rencana (cek DNS dulu: Resend sudah memakai domain, jangan sampai ada 2 record SPF).
5. **Setelah tayang:** kerjakan Google Play Billing (bagian di bawah) selama 31 hari trial pengguna baru; sebelum itu pengguna Play yang trialnya habis hanya melihat tombol beli "Segera hadir".

## Setelah itu: Google Play Billing (dikerjakan bersama Claude)
- Pemilik: payments profile + buat 3 langganan `llk_basic`, `llk_up`, `llk_unlimited` (base plan bulanan/tahunan), aktifkan Play Developer API + service account.
- Claude: alur beli via Digital Goods API, verifikasi & acknowledge di server, tombol "Pulihkan Langganan".
- ⚠️ **Sekalian (keputusan pemilik 20 Okt 2026)**: build ulang PWABuilder **versi 2** dengan **layar pembuka logo mendatar** + **ikon opsi A** — gambar sudah siap di `store/play/twa/` (Icon URL = `splash-1024.png`, Maskable icon URL = `icon-maskable-512.png`, background `#F6F1E9`, Version code 2, Start URL `/?src=play`, kunci lama). Langkah lengkap: `PANDUAN-RILIS.md` bagian F. Tes di Pengujian internal dulu, baru promosikan ke tertutup.

## Catatan lain
- Email Midtrans "Scheduled Maintenance" (16 Okt 2026): tidak perlu perubahan kode. LLK tidak memakai refund API maupun `transaction_id`; URL notifikasi di `cloudfunctions.net` (SSL Google). Hanya downtime 18 Nov 2026 23:00–23:45 WIB.
- Akun berisi data murid asli tidak boleh dipakai untuk coba-coba (boleh jadi penguji Play, dipakai normal saja).
