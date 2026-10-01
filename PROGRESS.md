# 📘 Progres Project LesLesanKu (LLK)

_Terakhir diperbarui: 1 Okt 2026 (status Off guru izin + tampilan invoice)_

## 📌 Langkah berikutnya (per 29 Sep 2026)
0. Setelah PR #21 di-merge: Ctrl+Shift+R, cek logo sidebar laptop, tombol paket, dan scroll setelah bayar.
1. Pastikan PR #15 sudah di-merge → buka leslesanku.com (Ctrl+Shift+R): badge masih PRO, murid lengkap, Tambah Murid tidak bergembok.
2. Uji bayar **sandbox** pakai akun Google lain (jendela Samaran): Jadi Pro → Pro Basic → bayar lewat simulator.sandbox.midtrans.com → badge jadi PRO BASIC, murid ke-11 bergembok.
3. Pindah Midtrans ke **production**: Client Key (boleh dikirim ke Claude), Server Key (rahasia, pemilik tempel di Cloud Shell `.env`), Notification URL, cek metode pembayaran aktif.
4. Setelah gajian: Play Console ($25) → PWABuilder (package `com.leslesanku.app`, host `leslesanku.com`, kunci lama) → Play Billing.

## ⏸️ Status baru "Off (guru izin)" + Tampilan Invoice (1 Okt 2026)
- **Off** = guru yang berhalangan. Nilai baru `attendance[dk][key]='off'` (data lama tidak diubah).
  - Tombol **Off** di kartu absen (Absensi & Track), sesudah Reschedule dan sebelum Kirim Progres. Modal: pilihan "Off (guru izin)", cukup alasan (tanpa progres/foto). Boleh diisi di muka seperti Izin.
  - Tidak dihitung bayar (seperti Izin): `countedSessionList`/`countSessions` hanya Hadir+Alpa. Tidak ikut jadwal "bayar di depan" (`upcomingSessionList`), tidak dihitung di Pertemuan Awal.
  - Tampilan: warna abu kebiruan (`--off`, `--off-bg`, `--off-text`, `--off-solid`, `--st-off-bg` di 3 tema), ikon jeda, label "Off · Guru izin". Statistik Absensi/Track/profil murid menampilkan Off bila ada. Tombol Kirim Progres disembunyikan untuk sesi Off.
  - Pengingat les & rekonsiliasi push menganggap Off sudah ditandai. Laporan Sheets tetap hanya Hadir/Alpa.
- **Tampilan Invoice** (Pengaturan Pembayaran + chip "Tampilkan: Harga · Izin · Off" di layar invoice): **Hadir & Alpa wajib tampil**; yang bisa diatur: Harga per pertemuan, Baris Izin, Baris Off (guru izin). Baris Izin (kuning) & Off (abu kebiruan) tanpa nomor, Rp 0.
  - Draft menyimpan `inv.izin` & `inv.off` (tanggal); invoice lama dihitung dari rentang tanggalnya (`llkStatusDates`, `llkInvoiceRows`). Kunci `llk_inv_show_{price,izin,off}` ikut backup. Total & `inv.items` tidak berubah.
  - Saklar Keterangan & Tulisan Alpa (versi sebelumnya) dihapus.

## 🧾 Invoice: keterangan cukup status (1 Okt 2026)
- Kolom KETERANGAN invoice/kuitansi (gambar & pesan WA) kini hanya status: **Hadir / Izin / Alpa** (atau "Terjadwal · jam" untuk bayar di depan). Catatan tambahan kelas seperti "Karena pulang pagi" dan "(tetap dihitung)" tidak ditampilkan. Penanda "· belum dibayar" (tunggakan) tetap.
- Lewat `llkInvItemLabel()` saat menampilkan → invoice lama yang sudah tersimpan juga ikut bersih; data label asli tidak diubah.
- **Izin ikut tampil** (gambar & WA) sebagai baris kuning lembut tanpa nomor, biaya **Rp 0**; total & jumlah pertemuan ditagih tidak berubah. Footer: "10 pertemuan × Rp 45.000 · 2x izin (Rp 0)". Di WA ditandai "• … — Izin (Rp 0)".
  - Draft baru menyimpan `inv.izin` (daftar tanggal): bulanan = Izin di bulan itu s.d. hari ini; per pertemuan = Izin setelah pertemuan terakhir yang sudah dibayar s.d. hari ini (`llkIzinDates`).
  - Invoice lama/custom tanpa `inv.izin` → Izin diambil di antara tanggal pertemuan pertama & terakhirnya (`llkInvoiceRows`). `inv.items` (dasar hitungan bayar) tidak disentuh.

## 🔔 Teks notifikasi: nama murid paling depan (30 Sep 2026)
- Notifikasi di HP sering terpotong ("🎵 Sebent…") sehingga nama murid tidak terlihat. Pengingat les sekarang berjudul `🎵 {Nama} · {jam}` dan isinya diawali nama: `{Nama} · {Alat} · mulai 5 menit lagi (jam 19:00). Siapkan materinya ya…`. Awalan 🎵 tetap (dipakai worker untuk membersihkan reminder).
- Pengingat progres: judul `📝 {Nama1, Nama2 +N lagi} · kirim progres`. Berlaku juga untuk notifikasi dalam aplikasi (`checkNotifications`).
- Reminder yang sudah terjadwal ikut diperbarui otomatis saat aplikasi dibuka berikutnya (sig teks berubah → dijadwalkan ulang).

## 🧾 Invoice: tanpa mode bayar, "Perlu Dibayar" hitam (30 Sep 2026)
- Invoice/kuitansi (`renderInvoiceCanvas`) tidak lagi menampilkan "Bayar di Depan/Belakang" (cukup mata pelajaran). Tulisan **PERLU DIBAYAR** kini teks hitam biasa tanpa kotak merah; cap LUNAS (hijau) & DIBATALKAN (abu) tetap.

## ⏰ Pengingat terjadwal otomatis 7 hari ke depan (30 Sep 2026)
- Permintaan pemilik: tidak perlu lagi menekan "Jadwalkan Ulang". Aplikasi web yang tertutup tidak bisa jalan sendiri jam 6 pagi, jadi solusinya: `llkSyncReminders()` menjadwalkan pengingat untuk **7 hari ke depan** (`LLK_REMINDER_DAYS`) sekaligus — les (X menit sebelum), kirim progres & salin laporan (hari yang ada les), PR guru (kemunculan berikutnya) — lewat `llkDesiredReminders(now)`.
- **Otomatis** via `llkAutoSyncReminders(delay)` (ditunda & digabung): saat login selesai, saat tab Absensi hari ini dibuka, saat aplikasi kembali terlihat (`visibilitychange`), dan setiap `save()` (data berubah). Tidak jalan kalau notifikasi mati / belum login / offline.
- **Hemat**: ID pengingat disimpan bersama tanda tangan (`{id, sig}` di `llk_push_ids`, sig = waktu+judul+isi); yang sama dibiarkan, yang berubah dibatalkan lalu dikirim ulang, yang tidak diperlukan lagi dibatalkan. Format lama (string ID) tetap terbaca. Info terakhir di `llk_push_sync_info`.
- Pengaturan Notifikasi: kotak "Otomatis — tidak perlu menekan apa pun" + waktu pembaruan terakhir; tombol diganti **Lihat Jadwal Pengingat** (daftar hari ini + ringkasan per hari berikutnya).
- Diuji: `autotest.js` (11 cek: otomatis tanpa klik, 7 hari, 0 kiriman kalau tidak berubah, ubah jadwal → 1 batal + 1 kirim, izin → batal, pengaturan, notifikasi mati) + semua uji sebelumnya.

## 🔔 Pengingat baru + desain notifikasi (30 Sep 2026)
- **Dihapus** dari Pengaturan Notifikasi: Pilih Suara, Volume, Tes Suara (membingungkan). Suara di dalam aplikasi tetap nada bawaan.
- **4 pengingat**, masing-masing dengan saklar on/off (`llk_rem_jadwal|progres|laporan|pr`, bawaan nyala):
  1. **Jadwal les** — X menit sebelum les (`llk_push_lead_minutes`).
  2. **Kirim progres ke ortu** — jam (`llk_notif_sheet_time`, bawaan 20:00); hanya kalau masih ada progres hari ini yang belum terkirim (murid hadir yang punya No. WA/Link Sheet).
  3. **Salin laporan harian** — jam (`llk_notif_kirim_time`, 20:00); kalau laporan hari ini belum disalin.
  4. **Cek PR guru** — jam (`llk_notif_pr_time`, bawaan 07:00); kalau ada PR guru belum selesai; kalau jamnya sudah lewat → dijadwalkan besok.
- Semuanya ikut **push** (walau app ditutup) lewat `llkScheduleDailyReminders()` yang dipanggil `scheduleTodayReminders()`, pushKey `tanggal|__progres/__laporan/__pr`. Dibatalkan otomatis di `reconcileMarkedReminders()` begitu tugasnya beres / saklar dimatikan. Saat app terbuka & push belum aktif → pengingat dalam aplikasi (`checkSheetSentReminder`, `checkKirimCopyReminder`, `checkPrGuruReminder`). Mengubah saklar/jam langsung menjadwalkan ulang. Tombol **Coba Notifikasi Sekarang** mengirim contoh ±15 detik.
- **Teks notifikasi lebih ramah**, mis. "🎵 Sebentar lagi les Syalenka! — Piano · mulai jam 11:30 (10 menit lagi). Siapkan materinya ya, semangat mengajar! ✨". Judul reminder les tetap diawali 🎵 (worker membersihkan reminder les berdasarkan awalan itu).
- **Desain notifikasi** (`llkPushDesign(kind)`): ikon LLK (`icon-192.png`), ikon bilah status putih (`notif-badge.png`), gambar banner per jenis (`notif-jadwal|progres|laporan|pr.png`, 1024×512, dibuat dari ilustrasi app), tombol aksi ("Buka Absensi", "Kirim Progres", "Salin Laporan", "Lihat PR Guru"), tautan langsung `/?open=absensi|kirim|pr` (ditangani saat init), dan `ttl`.
- **⚠️ PERLU DEPLOY MANUAL**: `worker/onesignal-bridge-worker.js` diperbarui (`notificationDesign()`: meneruskan url/icon/badge/image/buttons/ttl ke OneSignal, hanya alamat dari domain LesLesanKu). Tempel ulang ke Cloudflare (Workers & Pages → llk-onesignal-bridge → Edit code → Deploy). Sebelum di-deploy, notifikasi tetap jalan dengan teks baru tapi tanpa ikon/gambar/tombol.
- Diuji: `notiftest.js` (18 cek, fetch worker di-mock), `workertest.mjs` (6 cek: desain diteruskan, alamat asing/domain tiruan ditolak, tanpa desain tetap jalan, tanpa login 401), semua uji sebelumnya.

## 🎨 Tema tampilan: Caffe Latte · Happy Time · Dark Mode (30 Sep 2026)
- Permintaan pemilik: tema hasil perombakan diberi nama **Caffe Latte** (pemilik menulis "Caffe late"), tampilan lama sebelum dirombak dimunculkan lagi sebagai **Happy Time**, plus tema **Dark Mode**. Dipilih di **Lainnya → Pengaturan Aplikasi → Tema tampilan** (3 kartu pratinjau), langsung dipakai tanpa tekan Simpan.
- Disimpan di `localStorage.llk_theme` (`latte`/`happy`/`dark`, ikut `BACKUP_SETTINGS_KEYS`). Dipasang sedini mungkin lewat skrip kecil di `<head>` (atribut `data-theme` di `<html>`) supaya tidak berkedip. JS: `LLK_THEMES`, `llkGetTheme()`, `llkApplyTheme(id, persist)`, `llkPickTheme(id)`, `llkThemePickerHtml()`.
- Tema = override token CSS di `:root[data-theme="happy"|"dark"]`. Token baru supaya tema gelap aman: `--ink/--on-ink` (tombol hitam, toast, kartu penghasilan, hari terpilih), `--hadir-solid/--izin-solid/--alpa-solid/--blue-solid/--plum-solid/--amber-solid` (latar tombol berteks putih), `--st-*-bg` (kartu status), `--input-focus`, `--nb-paper`, `--banner-warn`. Ilustrasi SVG ikut warna tema lewat selector atribut `symbol [fill=…]`.
- **Happy Time** (dari index.html sebelum PR #22): latar #f5f5f7, kartu putih berbayang, DM Sans tebal (dimuat hanya saat tema ini dipakai), sudut lebih bulat, tombol hari terpilih merah, ikon mata pelajaran **emoji**. Warna status sedikit digelapkan dari aslinya supaya lolos kontras 4.5:1.
- **Dark Mode**: kopi gelap (#15120f/#1e1a16), teks #f3ebe1, status lebih terang (kontras ≥5:1), `color-scheme:dark`. `llkReadableOnPaper()` kini mengukur kontras terhadap warna kartu tema aktif (tema gelap → warna aksen diterangkan). Ikon mata pelajaran versi gelap di `llkSubjectStyle()`.
- Warna aksen sekolah (header) tetap dari Pengaturan di semua tema. Invoice/PDF tetap putih (dokumen).
- Diuji: `themetest.js` (11 cek), screenshot semua halaman di tiap tema (`themeshoot.js`), semua uji sebelumnya.
- **Tema hanya mengubah tampilan** (permintaan pemilik): JS hanya membaca tema di `llkSubjectIcon` (emoji di Happy Time) & `llkSubjectStyle` (warna ikon gelap) — tidak ada logika absensi/pembayaran/data yang bergantung tema. Seluruh uji fitur (paytest, inittest, datetest, striptest, meettest, fmttest, statustest, icontest, gatetest, logouttest, func 20/20, colortest 10/10) dijalankan ulang dengan **Happy Time** dan **Dark Mode** aktif (`runtheme.sh` + `forcetheme.js` di scratchpad) → semua lolos, sama dengan Caffe Latte.

## 🟩 Kartu murid berwarna sesuai status (30 Sep 2026)
- Kartu murid di Absensi & Kalender: `.s-item.status-hadir` latar hijau lembut, `status-izin` oranye, `status-alpa` merah muda (garis kiri 4px warna status); Belum tetap polos. Warna inline lama dipindah ke CSS class.
- Diuji: `statustest.js` + semua uji sebelumnya.

## 🎨 Ikon mata pelajaran berwarna (30 Sep 2026)
- Permintaan pemilik: ikon piano & gitar dulu sama-sama abu; semua ikon harus berwarna berbeda.
- `llkSubjectIcon()` kini membungkus ikon dalam `<span class="llk-subj">` yang mengisi kotak avatar dengan warna dari `llkSubjectStyle()`: 20 jenis ikon → 20 hue berjarak 18° (`llkSubjectHue`); alat musik utama berjauhan (piano bata, drum kuning zaitun, gitar hijau, vokal biru, biola ungu, musik umum merah muda). Hue ganjil diberi latar lebih pekat supaya tetangga tetap beda. Kontras ikon vs latar ≥ 4,5:1.
- Diuji: `icontest.js` + semua uji sebelumnya.

## 🚪 Logout → kembali ke layar "Selamat datang" (30 Sep 2026)
- Bug: setelah logout, gate login tetap tersembunyi (sudah di-`hideLoginGate()` saat login), jadi yang terlihat hanya kartu "Belum login" di Lainnya.
- Perbaikan: `logoutFirebase()` memanggil `showWelcomeGate()` setelah signOut → pesan awal (trial gratis 31 hari) & tombol "Lihat-lihat dulu, login nanti" dipulihkan (requireLoginOrBlock bisa menggantinya; teks aslinya disimpan di `window._llkGateMsgDefault`), mode tamu direset, gate ditampilkan.
- Diuji: `gatetest.js` (5 cek, Firebase di-stub) + semua uji sebelumnya.

## 📝 Progres: format poin + jarak sebelum PR (30 Sep 2026)
- Permintaan pemilik: progres tampil seperti daftar poin tanpa tanda `*`, dan ada baris kosong antara progres dan PR.
- `llkBulletLines()`: tiap baris catatan → `• …` (tanda `*`, `-`, `•` di awal baris diganti; baris bernomor `1.` dibiarkan; baris kosong dibuang). `buildProgressText()` menaruh progres (dan PR yang >1 baris) di bawah labelnya dengan baris kosong sebelum & sesudah — berlaku juga untuk template buatan guru. Catatan kosong tetap satu baris ("Progress: -").
- Bagian yang tidak dicentang (tanggal/pertemuan/progres/PR) kini barisnya dibuang, tidak menyisakan label kosong.
- Diuji: `fmttest.js` (6 cek), meettest disesuaikan, semua uji sebelumnya lolos.

## 🔢 Progres: "Pertemuan ke-…" (30 Sep 2026)
- Pilihan baru di Pengaturan Progres Siswa → Format teks progres: **Pertemuan ke-berapa** (field `pertemuan`, default tidak dicentang). Nomornya dari `llkMeetingNumber()` = semua sesi terhitung (Hadir/Alpa, termasuk Pertemuan Awal & tambahan kelas) sampai tanggal itu.
- Template default punya baris `🔢 {pertemuan}`; kalau tidak dicentang, barisnya dibuang (bukan emoji kosong). Template buatan guru tanpa `{pertemuan}` → baris disisipkan otomatis setelah baris `{tanggal}`. Variabel `{pertemuan}` ditambahkan ke daftar variabel.
- Diuji: `meettest.js` (9 cek) + semua uji sebelumnya.

## 🗓️ Absensi: strip 14 tanggal (30 Sep 2026)
- Permintaan pemilik: strip hari di Absensi jadi **14 tanggal** (7 ke belakang, **hari ini di tengah**, 6 ke depan); klik "Sel" = **Selasa kemarin**, bukan minggu depan; di ujung strip ada tombol **Kalender**.
- `dayBarHtml()` kini membuat tombol per tanggal (`selectAbsDate(dk)`, state `selectedAbsDate`, kosong = hari ini). `selectedDay` tetap disinkronkan dari tanggal itu (dipakai Tambah Murid, bagikan jadwal). `selectDay(nama)` lama → kemunculan terakhir hari itu.
- `renderAbsensi` memakai tanggal pasti; tanggal lampau kini bisa diisi langsung di Absensi (dulu diarahkan ke Kalender), termasuk murid yang nonaktif setelah tanggal itu & riwayat yang tidak lagi tercakup jadwal. Judul daftar: "Selasa — Kemarin / Hari ini / 6 hari lagi". Callout "Minggu depan" dari PR sebelumnya dihapus (tidak diperlukan lagi).
- Catatan teknis: nama hari singkat memakai fungsi `llkDayShort()` (bukan const) karena strip digambar saat init sebelum baris const dieksekusi (TDZ).
- Diuji: `striptest.js` (14 cek), datetest disesuaikan, paytest, inittest, logouttest, func.js 20/20, colortest 10/10.

## 📅 Absensi: tanggal terlihat, Hadir di masa depan ditolak, pindah tanggal (30 Sep 2026)
- **Bug:** di tab Absensi, hari yang sudah lewat minggu ini (mis. Selasa saat hari Rabu) membuka **minggu depan** (`getDayDiff` sengaja melompat +7), tapi tanggalnya tidak ditampilkan → guru mengisi progres "kemarin" yang ternyata tersimpan di 6 Okt, jadi Estimasi September kurang 1 sesi.
- **Perbaikan:** (1) `llkAbsDateLine()` menampilkan tanggal sebenarnya + label "Hari ini/Minggu depan", plus tautan "Mau isi Selasa, 29 Sep yang sudah lewat?" → `goToCalendarDate()`. (2) `openNoteModal` menolak **Hadir/Alpa untuk tanggal setelah hari ini** (Izin tetap boleh) dan menawarkan tanggal yang sama minggu lalu (kalau sudah Hadir → langsung Edit Catatan). Reset status di tanggal mendatang tetap bisa. (3) **Pindah tanggal** di Edit Catatan (`#noteDateInput`): status, progres, PR, foto, tugas PR guru, tanda terkirim ikut pindah; ditolak kalau tanggal tujuan sudah punya catatan / belum terjadi.
- **Bug lama ikut diperbaiki:** simpan Edit Catatan dari profil murid dulu selalu melempar ke daftar (noteStudent di-null-kan sebelum dicek). Sekarang tetap di profil / Kalender.
- Cara memperbaiki data pemilik (Dastan): profil → pensil di 6 Okt → "Tanggal / jam sesi ini salah?" → ganti ke 29 Sep → Simpan; lalu Edit Murid → ketik ulang Pertemuan Awal 3 → 15/22/29 Sep → Estimasi September Rp300.000.
- Diuji: `datetest.js` (16 cek), paytest, inittest, logouttest, func.js 20/20, colortest 10/10.

## 🗓️ Pertemuan Awal jadi tanggal Hadir + kirim progres ke WA (30 Sep 2026)
- **Bug:** "Pertemuan Awal = 3" dulu hanya angka (`initialSessions`). Kalau guru lalu menandai Hadir pertemuan kemarin untuk menulis progres, pertemuan itu terhitung dobel (3+1=4 → langsung ditagih).
- **Perbaikan (usulan pemilik):** `llkApplyInitialSessions()` menandai **Hadir** di N tanggal jadwal rutin terakhir **sebelum hari ini** (tanggal yang sudah Hadir/Alpa ikut dihitung, Izin dilewati). Jika murid sudah punya riwayat lebih lama, tanggalnya diambil sebelum pertemuan tercatat pertama (total tidak berkurang). Tanggal otomatis disimpan di `s.initialDates`, angka yang diisi di `s.initialCount`, `initialSessions` jadi 0. Murid tanpa jadwal rutin tetap memakai angka seperti dulu.
- Berlaku untuk **murid baru**, atau di Edit Murid bila angka Pertemuan Awal **diubah / diketik ulang**. Murid lama yang tidak disentuh tidak berubah. Mengubah angka menghapus tanda Hadir otomatis sebelumnya yang belum berisi catatan.
- Untuk menulis progres di tanggal yang sudah Hadir: pakai tombol pensil (Edit catatan) di Kalender/profil, bukan tombol Hadir (itu mereset).
- **Kirim progres ke WA:** tombol amplop muncul kalau murid punya No. WA **atau** Link Sheet (dulu hanya sesuai setelan). Popup menampilkan **Kirim ke WA** dan **Buka Sheet** sekaligus; setelan "Tujuan utama" hanya mengatur urutan. Tab Kirim punya tombol kirim progres per murid. Nomor WA yang sudah diawali 62 tidak lagi jadi 6262. Tombol "Sudah Tercatat" → "Sudah Terkirim".
- Diuji: `inittest.js` (20 cek), paytest, func.js 20/20, colortest 10/10, logouttest.

## 🔧 Slider warna di HP + konfirmasi logout (30 Sep 2026)
- **Bug (Android):** setelah mengetik Nama Kursus, menyentuh slider warna membuat halaman menggulir balik ke kolom nama (keyboard menutup, Chrome menggulir ke kolom yang masih fokus). Perbaikan: `llkSliderTouchStart()` di `onpointerdown/ontouchstart` slider melepas fokus kolom teks lebih dulu. Keyboard sungguhan tidak bisa ditiru di Playwright — **cek langsung di HP**.
- **Logout:** tombol logout (kartu akun di Lainnya & layar paket) kini beranimasi lalu menampilkan dialog "Keluar dari akun? Anda yakin mau keluar dari [email]?" lewat `confirmLogout()` → `logoutFirebase()` (tidak berubah). `showGenericConfirm` dapat parameter ikon opsional; dialognya kini `z-index:10001` supaya tampil di atas layar paket & lembar invoice.

## 💳 Pembayaran Custom, kirim ulang kuitansi, "Perlu Dibayar" (30 Sep 2026)
Permintaan pemilik: (1) ortu yang sudah bayar minta invoice lagi karena terhapus, tapi invoice untuk yang sudah dibayar tidak boleh dibuat lagi; (2) "Belum Lunas" → "Perlu Dibayar"; (3) ortu sering bayar di tengah siklus / sekalian beberapa pertemuan / sampai bulan depan → guru memilih sendiri tanggal yang dibayar, di semua mode.
1. **Kirim Ulang Kuitansi**: tombol di kartu Siswa (saat lunas) dan di profil murid, membuka kuitansi terakhir (nomor & tanggal bayar sama, bukan invoice baru). Kuitansi yang pernah dikirim (`inv.receiptSentAt`) atau dibayar di hari lain diberi tanda **"SALINAN · dikirim ulang [tgl]"** di gambar/PDF & teks WA. Riwayat Invoice di profil kini punya **"Lihat semua"** (tersimpan s/d 24 per murid).
2. Cap invoice & label riwayat: **PERLU DIBAYAR** (dulu BELUM LUNAS). Invoice yang dibatalkan: **DIBATALKAN** (`inv.voidAt`).
3. **Pembayaran Custom** (tombol di profil murid, semua mode): daftar "Belum dibayar · sudah berjalan" + "Jadwal berikutnya" (s/d ±200 hari), dicentang **berurutan dari yang paling lama**, pilihan cepat (yang sudah berjalan, +siklus, s/d akhir bulan ini/depan), total Rp langsung terlihat → simpan membuat kuitansi LUNAS (`inv.custom`).
   - Per pertemuan (depan/belakang): saldo dicatat sebagai angka di `lastPaidAt` (belakang) / `prepaidThrough` (depan) → kalau tanggal yang dibayar jadi izin, jatahnya pindah ke pertemuan berikutnya. Status: "Terbayar di muka · sisa Nx".
   - Bulanan (akhir bulan): field baru **`s.paidThruDate`** (semua pertemuan s/d tanggal itu lunas); bulan yang semua pertemuannya terbayar ikut ditandai di `monthlyPaidThru`. Tagihan akhir bulan hanya berisi tanggal yang belum dibayar.
   - Invoice lama yang belum dibayar otomatis DIBATALKAN saat Pembayaran Custom disimpan.
4. **Batalkan Pembayaran Ini** (di kuitansi terakhir, untuk Pembayaran Custom maupun "Sudah Bayar"): mengembalikan `lastPaidAt/prepaidThrough/monthlyPaidThru/paidThruDate` persis seperti sebelum dicatat (disimpan di `inv.undo`), memulihkan invoice yang tadi dibatalkan.
5. Bug diperbaiki: (a) Bulanan + Bayar di Belakang dengan `monthlyPaidThru` > bulan tagihan dulu dianggap belum bayar (`!==` → `>=`); (b) "Buat Invoice" mode Bayar di Depan dulu ikut menagih pertemuan yang sudah dibayar di muka; (c) di profil murid, menutup invoice / menekan Batal di dialog dulu ikut melempar balik ke daftar (flag `_llkSkipPop`); tombol Back HP kini menutup lembar invoice/Pembayaran Custom.
6. Data: `paidThruDate` ikut dipertahankan saat edit murid & digabung (ambil yang terbaru) saat sinkron cloud; `voidAt` ikut tergabung. Catatan: penggabungan cloud mengambil nilai pembayaran terbesar, jadi pembatalan yang dilakukan saat perangkat lain belum sinkron bisa muncul lagi (jarang).
7. Diuji Playwright (`paytest.js` di scratchpad sesi): 50 cek untuk 4 kombinasi mode (per pertemuan/bulanan × depan/belakang), Sudah Bayar + batalkan, salinan, tombol kembali; func.js 20/20, colortest 10/10.

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
