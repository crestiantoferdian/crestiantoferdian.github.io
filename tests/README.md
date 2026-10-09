# Tes LesLesanKu V2

Butuh Node.js 20+ dan Java (untuk emulator Firestore).

```bash
cd tests
npm install
npm run test:rules        # aturan keamanan Firestore (firestore.rules)
# jalankan server lokal dari root repo: python3 -m http.server 8765
npm run test:v2           # uji alur V2 di browser (Chromium) + emulator
npm run test:v2t2         # uji V2 Tahap 2: pelajaran, murid, jadwal mingguan, impor V1
npm run test:lainnya      # LAINNYA ADMIN V2: kartu akun, profil & tampilan lembaga (nama panjang, logo, warna, tema), info pembayaran, backup
npm run test:langganan    # LANGGANAN V2: uji coba 2 slot → bayar Paket Mulai + slot → tambah 5 slot (449rb) → habis (absensi terkunci) → perpanjang
npm run test:gaji         # PENGGAJIAN: rekening guru, tanggal gajian, tombol Bayar Gaji, bukti transfer, slip honor → WA guru
npm run test:bulan        # SIMULASI 1 BULAN: absensi harian, izin/alpa, paket 400rb/4x, gaji 40rb → cek angka Keuangan & Honor
npm run test:sim          # SIMULASI: pengguna V1 30 murid → lembaga → 2 Guru Mitra → bagi 10/10/10
npm run test:v2t3         # uji V2 Tahap 3: tampilan Guru Mitra (= V1), absensi, Izin Admin, honor
```

Tes V2 memakai emulator Firestore dengan aturan asli, jadi tidak menyentuh data sungguhan.
