# Status Rilis Google Play — LesLesanKu (per 17 Okt 2026)

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
4. **Pengujian tertutup (Alpha)**: negara **Indonesia**, daftar penguji **"Tim LLK" berisi 7 email** (perlu ≥12, target 15).

## ⏭️ Langkah berikutnya (urut)
1. Tab Penguji pengujian tertutup: centang **Tim LLK**, email masukan `fertunestudio@gmail.com` → Simpan.
2. **Buat rilis baru** di Pengujian tertutup → pakai AAB yang sama (atau "Tambahkan dari library" / promosikan dari internal) → catatan rilis `<id>Versi pertama</id>` (tag `<id-ID>` ditolak) → Simpan → Tinjau → Mulai peluncuran.
3. **Ringkasan publikasi → Kirim perubahan untuk ditinjau** (listing + konten aplikasi + rilis tertutup). Review pertama: beberapa jam–beberapa hari.
4. Setelah disetujui: tab Penguji → **Salin link** opt-in → kirim lewat WA ke semua penguji (buka di HP Android dengan Gmail terdaftar → "Jadi penguji" → pasang dari Play Store → buka sesekali, **jangan keluar 14 hari**).
5. Tambah penguji sampai **≥12 (target 15)** — orang lain yang berbeda, jangan kebanyakan akun milik sendiri.
6. Setelah 12 penguji × 14 hari: Dasbor → **Ajukan permohonan untuk produksi** (jawab jujur kuesioner pengujian) → rilis produksi bertahap.

## Setelah itu: Google Play Billing (dikerjakan bersama Claude)
- Pemilik: payments profile + buat 3 langganan `llk_basic`, `llk_up`, `llk_unlimited` (base plan bulanan/tahunan), aktifkan Play Developer API + service account.
- Claude: alur beli via Digital Goods API, verifikasi & acknowledge di server, tombol "Pulihkan Langganan".
- ⚠️ **Sekalian**: ganti ikon aplikasi di HP ke desain **opsi A** dan build ulang PWABuilder **versi 2** (Version code 2, Start URL `/?src=play`, kunci lama yang sama).

## Catatan lain
- Email Midtrans "Scheduled Maintenance" (16 Okt 2026): tidak perlu perubahan kode. LLK tidak memakai refund API maupun `transaction_id`; URL notifikasi di `cloudfunctions.net` (SSL Google). Hanya downtime 18 Nov 2026 23:00–23:45 WIB.
- Akun berisi data murid asli tidak boleh dipakai untuk coba-coba (boleh jadi penguji Play, dipakai normal saja).
