# Bahan Google Play Store — LesLesanKu (LLK)

Semua gambar di folder ini memakai **data contoh fiktif** (bukan data guru sungguhan).
Buat ulang kapan saja: jalankan server lokal di folder repo (`python3 -m http.server 8765`) lalu `node store/make-assets.cjs`.

## File gambar
| File | Untuk kolom Play Console | Ukuran |
|---|---|---|
| `app-icon-512.png` | Ikon aplikasi | 512×512 |
| `feature-graphic-1024x500.png` | Feature graphic | 1024×500 |
| `screenshot-1-absensi.png` … `screenshot-6-progres.png` | Screenshot ponsel (urutkan 1→6) | 1080×1920 |

## Teks listing (Bahasa Indonesia)

**Nama aplikasi** (maks. 30 huruf):
> LesLesanKu – Absensi Les

**Deskripsi singkat** (maks. 80 huruf):
> Absensi, progres murid & tagihan les privat dalam satu aplikasi.

**Deskripsi lengkap** (maks. 4000 huruf):

> LesLesanKu (LLK) adalah aplikasi untuk guru les privat — musik, bahasa, matematika, mengaji, dan lainnya — supaya urusan administrasi les tidak lagi tercecer di buku dan chat.
>
> ✅ ABSENSI SEKALI KETUK
> Tandai Hadir, Izin, Alpa, atau Off untuk setiap murid sesuai jadwal hari itu. Jadwal pindahan dan kelas tambahan tetap tercatat rapi tanpa merusak riwayat.
>
> 📝 CATAT PROGRES & PR
> Tulis materi yang dipelajari, PR untuk murid, dan pengingat tugas untukmu sendiri di setiap pertemuan. Bisa dilengkapi foto.
>
> 📤 KIRIM KE ORANG TUA LEWAT WHATSAPP
> Kirim progres pertemuan dan tagihan ke orang tua murid langsung lewat WhatsApp, tanpa ketik ulang. Laporan harian juga bisa disalin ke Google Sheets.
>
> 💰 TAGIHAN & PENGHASILAN
> Pengingat "waktunya bayar" otomatis sesuai jumlah pertemuan, invoice siap kirim, dan estimasi penghasilan per minggu, bulan, atau tahun.
>
> 📚 KURIKULUM & MATERI
> Susun kurikulum per mata pelajaran (bab & topik), simpan link materi, dan daftar PR guru supaya persiapan les lebih mudah.
>
> 🔔 PENGINGAT
> Notifikasi sebelum jadwal les dimulai, pengingat kirim progres, dan PR guru.
>
> ☁️ DATA AMAN
> Login dengan akun Google. Data tersimpan otomatis di cloud dan tersinkron di HP maupun laptop, lengkap dengan fitur backup.
>
> 🎨 BRANDING LES KAMU
> Pasang nama, logo, dan warna lembaga les sendiri.
>
> Coba gratis 31 hari dengan semua fitur Pro.

**Kategori:** Pendidikan (Education) · **Tag:** pendidikan, produktivitas
**Email kontak:** (isi email dukunganmu)
**Situs web:** https://leslesanku.com
**Kebijakan privasi:** https://leslesanku.com/privacy-policy.html
**Link hapus akun:** https://leslesanku.com/hapus-akun.html

## Pengaturan lain di Play Console
- **Target audiens:** 18 tahun ke atas (pengguna = guru, bukan anak-anak).
- **Iklan:** Tidak, aplikasi tidak berisi iklan.
- **Akses aplikasi (App access):** butuh login → berikan akun Google khusus reviewer (bukan akun berisi data asli) beserta petunjuk singkat: "Buka aplikasi → Login dengan Google → pakai akun di atas".
- **Rating konten:** isi kuesioner — tidak ada kekerasan/seksual/perjudian; ada interaksi pengguna? **Tidak** (guru tidak bisa saling chat di dalam aplikasi; WhatsApp dibuka di luar aplikasi).

## Draf jawaban Data Safety
Prinsip: semua data dipakai **hanya untuk menjalankan aplikasi**, tidak dijual, tidak untuk iklan. Penyedia layanan (Firebase/Google Cloud, OneSignal, Midtrans di versi web) dihitung sebagai *service provider*, bukan "berbagi data".

| Pertanyaan | Jawaban |
|---|---|
| Mengumpulkan atau berbagi data pengguna? | **Ya**, mengumpulkan |
| Data dienkripsi saat dikirim? | **Ya** (HTTPS) |
| Pengguna bisa minta data dihapus? | **Ya** — Lainnya → Hapus Akun, atau https://leslesanku.com/hapus-akun.html |
| Berbagi data ke pihak ketiga? | **Tidak** |

Jenis data yang **dikumpulkan** (semua: *tidak dibagikan*, *wajib untuk fungsi aplikasi*, tujuan **Fungsi aplikasi** + **Manajemen akun**):

| Kategori | Jenis | Keterangan |
|---|---|---|
| Info pribadi | **Nama** | Nama akun Google guru; nama murid & orang tua yang diketik guru |
| Info pribadi | **Alamat email** | Email akun Google untuk login, invoice & pengingat (dikirim lewat Resend) |
| Info pribadi | **Nomor telepon** | Nomor WA orang tua murid yang diketik guru |
| Info keuangan | **Riwayat pembelian** | Riwayat langganan aplikasi |
| Aktivitas aplikasi | **Konten buatan pengguna lainnya** | Jadwal, absensi, catatan progres, PR, kurikulum |
| ID perangkat atau ID lain | **ID perangkat atau ID lain** | ID langganan notifikasi push (OneSignal) untuk pengingat jadwal |

Yang **tidak** dikumpulkan: lokasi, kontak HP, SMS, riwayat browser, data kesehatan, data analitik/iklan.
**Foto progres TIDAK dicentang**: foto hanya disimpan di HP (IndexedDB) dan tidak pernah dikirim ke server — menurut aturan Google, data yang tidak meninggalkan perangkat tidak termasuk "dikumpulkan".
