# Status Rilis Google Play — LesLesanKu (per 19 Okt 2026)

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
6. **Penguji terkumpul** (kabar pemilik, 19 Okt): sekitar **21 akun** di Tim LLK (13 baru + 8 lama), syarat ≥12 terpenuhi di daftar. Dasbor masih menampilkan **"0 penguji saat ini ikut serta"** karena yang dihitung hanya yang sudah menekan "Jadi penguji" lewat link.

### Pelajaran dari proses ini (supaya tidak terulang)
- Membuat rilis tertutup: **jangan klik Upload** untuk AAB yang sama → muncul "Kode versi 1 sudah digunakan". Pakai **Tambahkan dari koleksi** lalu pilih versi 1.
- Ringkasan publikasi sempat memblokir pengiriman: **"Pernyataan ID iklan tidak lengkap"** → Konten aplikasi → ID Iklan → **Tidak** → Simpan, baru tombol "Kirim … perubahan untuk ditinjau" bisa dipakai.
- Halaman Dasbor "2 dari 5" tidak langsung berarti email masukan terisi; cek tab Penguji.
- Syarat 12 penguji dihitung dari yang **ikut serta**, bukan dari jumlah email di daftar. Jangan memakai emulator/akun buatan; penguji harus orang sungguhan dengan HP Android.

## ⏭️ Langkah berikutnya (urut)
1. Pastikan **Tim LLK** tercentang di tab Penguji dan berisi semua email penguji. Klik **Salin link** (Cara penguji bergabung).
2. **Uji satu orang dulu** (link bisa berjeda beberapa jam setelah publikasi; "Item tidak ditemukan" → coba lagi besok), lalu kirim lewat WA ke semua penguji: buka di HP Android dengan Gmail terdaftar → "Jadi penguji" → pasang dari Play Store → buka sesekali, **jangan keluar & jangan hapus aplikasi selama 14 hari**.
3. Pantau Dasbor: "penguji saat ini ikut serta" harus ≥12. Hitungan 14 hari dianggap mulai ketika ≥12 sudah ikut serta (belum dipastikan; anggap begitu supaya aman). Tambah penguji kalau ada yang keluar.
4. Setelah 12 penguji × 14 hari: Dasbor → **Ajukan permohonan untuk produksi** (jawab jujur kuesioner pengujian) → rilis produksi bertahap.

## Setelah itu: Google Play Billing (dikerjakan bersama Claude)
- Pemilik: payments profile + buat 3 langganan `llk_basic`, `llk_up`, `llk_unlimited` (base plan bulanan/tahunan), aktifkan Play Developer API + service account.
- Claude: alur beli via Digital Goods API, verifikasi & acknowledge di server, tombol "Pulihkan Langganan".
- ⚠️ **Sekalian**: ganti ikon aplikasi di HP ke desain **opsi A** dan build ulang PWABuilder **versi 2** (Version code 2, Start URL `/?src=play`, kunci lama yang sama).

## Catatan lain
- Email Midtrans "Scheduled Maintenance" (16 Okt 2026): tidak perlu perubahan kode. LLK tidak memakai refund API maupun `transaction_id`; URL notifikasi di `cloudfunctions.net` (SSL Google). Hanya downtime 18 Nov 2026 23:00–23:45 WIB.
- Akun berisi data murid asli tidak boleh dipakai untuk coba-coba (boleh jadi penguji Play, dipakai normal saja).
