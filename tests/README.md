# Tes LesLesanKu V2

Butuh Node.js 20+ dan Java (untuk emulator Firestore).

```bash
cd tests
npm install
npm run test:rules        # aturan keamanan Firestore (firestore.rules)
# jalankan server lokal dari root repo: python3 -m http.server 8765
npm run test:v2           # uji alur V2 di browser (Chromium) + emulator
```

Tes V2 memakai emulator Firestore dengan aturan asli, jadi tidak menyentuh data sungguhan.
