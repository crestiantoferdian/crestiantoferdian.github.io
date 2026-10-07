// ══════════════════════════════════════════════════════════════════════
// SLIP HONOR MENGAJAR — gambar (canvas → JPG) atau dokumen PDF (A4, bisa
// beberapa halaman) untuk dikirim ke WA guru.
// Dipakai aplikasi Admin (saat membayar gaji) & aplikasi Guru (riwayat gaji).
// ══════════════════════════════════════════════════════════════════════
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const DAY = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
export const rupiah = n => 'Rp ' + Math.round(n || 0).toLocaleString('id-ID');
export function fmtKey(k, withDay) {
  if (!k) return '-';
  const d = new Date(k + 'T00:00:00');
  return (withDay ? DAY[d.getDay()] + ', ' : '') + d.getDate() + ' ' + MON[d.getMonth()] + ' ' + d.getFullYear();
}
export function slipNo(p) { return 'HON-' + String(p.paidDate || '').replace(/-/g, '') + '-' + String(p.id || '').slice(0, 4).toUpperCase(); }
export const THANKS = 'Terima kasih atas dedikasi, kesabaran, dan ketulusan Anda dalam membimbing murid-murid kami. '
  + 'Setiap pertemuan yang Anda berikan adalah langkah berharga bagi masa depan mereka. '
  + 'Semoga honor ini membawa berkah dan menambah semangat untuk terus menginspirasi.';

function wrap(ctx, text, maxW) {
  const out = []; let line = '';
  String(text || '').split(/\s+/).forEach(w => {
    const t = line ? line + ' ' + w : w;
    if (ctx.measureText(t).width > maxW && line) { out.push(line); line = w; } else line = t;
  });
  if (line) out.push(line);
  return out;
}
function loadImg(src) {
  return new Promise(res => { if (!src) return res(null); const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = src; });
}

// payout: {id, mitraName, periodFrom, periodTo, hadir, alpa, sessions, total, paidDate, bank, proof, note}
// rows: absensi yang dibayar [{date, studentName, subjectName, status, honor}]
// org: {name, logo}; adminName: penanda tangan
export async function renderSlipCanvas(payout, rows, org, adminName) {
  const W = 1240, M = 80, rowH = 54, color = '#a8372a';
  const font = (w, sz) => `${w} ${sz}px "Plus Jakarta Sans", "DM Sans", -apple-system, "Segoe UI", Roboto, sans-serif`;
  const meas = document.createElement('canvas').getContext('2d');
  meas.font = font(400, 27);
  const thanks = wrap(meas, THANKS, W - 2 * M - 60);
  const proof = await loadImg(payout.proof || '');
  const logo = await loadImg((org && org.logo) || '');
  const proofW = 520, proofH = proof ? Math.round(proof.height * proofW / proof.width) : 0;
  const list = rows.slice().sort((a, b) => a.date.localeCompare(b.date) || String(a.studentName).localeCompare(b.studentName));
  const H = 600 + rowH * (list.length + 1) + 330 + 120 + thanks.length * 40 + 200 + (proof ? proofH + 120 : 0) + 120;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const c = cv.getContext('2d'), breaks = []; // breaks: titik potong aman untuk halaman PDF
  c.fillStyle = '#ffffff'; c.fillRect(0, 0, W, H);
  // Header
  c.fillStyle = color; c.fillRect(0, 0, W, 210);
  let tx = M;
  if (logo) { c.save(); c.beginPath(); c.arc(M + 60, 105, 60, 0, Math.PI * 2); c.clip(); c.drawImage(logo, M, 45, 120, 120); c.restore(); tx = M + 150; }
  c.fillStyle = '#fff'; c.font = font(800, 46); c.fillText((org && org.name) || 'Lembaga Les', tx, 112);
  c.font = font(500, 26); c.globalAlpha = 0.9; c.fillText('Lembaga les · LesLesanKu', tx, 156); c.globalAlpha = 1;
  c.textAlign = 'right'; c.font = font(800, 40); c.fillText('SLIP HONOR', W - M, 108);
  c.font = font(500, 24); c.fillText(slipNo(payout), W - M, 150); c.textAlign = 'left';
  // Kepada & periode
  let y = 290;
  c.fillStyle = '#6b7280'; c.font = font(700, 22); c.fillText('DIBERIKAN KEPADA', M, y);
  c.textAlign = 'right'; c.fillText('DITRANSFER', W - M, y); c.textAlign = 'left';
  y += 46; c.fillStyle = '#1c1c1e'; c.font = font(800, 38); c.fillText(payout.mitraName || '-', M, y);
  c.textAlign = 'right'; c.font = font(700, 30); c.fillText(fmtKey(payout.paidDate), W - M, y); c.textAlign = 'left';
  y += 42; c.fillStyle = '#4b5563'; c.font = font(500, 26);
  c.fillText('Guru Mitra · periode ' + fmtKey(payout.periodFrom) + ' – ' + fmtKey(payout.periodTo), M, y);
  const b = payout.bank || {};
  if (b.number) { y += 38; c.fillText('Ke rekening ' + [b.bank, b.number].filter(Boolean).join(' ') + (b.holder ? ' a.n. ' + b.holder : ''), M, y); }
  // Tabel pertemuan
  y += 50;
  const cNo = M + 20, cDate = M + 80, cStu = M + 330, cSt = M + 760, cAmt = W - M - 20;
  c.fillStyle = '#f3f4f6'; c.fillRect(M, y, W - 2 * M, rowH);
  c.fillStyle = '#374151'; c.font = font(800, 22);
  c.fillText('NO', cNo, y + 35); c.fillText('TANGGAL', cDate, y + 35); c.fillText('MURID · PELAJARAN', cStu, y + 35); c.fillText('STATUS', cSt, y + 35);
  c.textAlign = 'right'; c.fillText('HONOR', cAmt, y + 35); c.textAlign = 'left';
  y += rowH; breaks.push(y - rowH);
  list.forEach((r, i) => {
    if (i % 2) { c.fillStyle = '#fafafa'; c.fillRect(M, y, W - 2 * M, rowH); }
    c.fillStyle = '#1c1c1e'; c.font = font(500, 24);
    c.fillText(String(i + 1), cNo, y + 35); c.fillText(fmtKey(r.date, true), cDate, y + 35);
    let s = (r.studentName || '') + (r.subjectName ? ' · ' + r.subjectName : '');
    while (c.measureText(s).width > cSt - cStu - 24 && s.length > 4) s = s.slice(0, -2);
    if (s !== (r.studentName || '') + (r.subjectName ? ' · ' + r.subjectName : '')) s = s.trim() + '…';
    c.fillText(s, cStu, y + 35);
    c.fillStyle = r.status === 'alpa' ? '#b0263f' : '#1d7a43'; c.font = font(700, 24);
    c.fillText(r.status === 'alpa' ? 'Alpa' : 'Hadir', cSt, y + 35);
    c.fillStyle = '#1c1c1e'; c.font = font(500, 24); c.textAlign = 'right'; c.fillText(rupiah(r.honor), cAmt, y + 35); c.textAlign = 'left';
    y += rowH; breaks.push(y);
  });
  const tableEnd = y;
  c.strokeStyle = '#e5e7eb'; c.lineWidth = 2; c.beginPath(); c.moveTo(M, y); c.lineTo(W - M, y); c.stroke();
  // Ringkasan
  y += 64;
  c.fillStyle = '#6b7280'; c.font = font(600, 26);
  c.fillText((payout.hadir || 0) + ' hadir' + (payout.alpa ? ' · ' + payout.alpa + ' alpa (tetap dihonor)' : '') + ' · ' + (payout.sessions || 0) + ' pertemuan', M, y);
  c.textAlign = 'right'; c.fillStyle = '#1c1c1e'; c.font = font(800, 46); c.fillText('Total ' + rupiah(payout.total), W - M, y + 6); c.textAlign = 'left';
  y += 80;
  c.strokeStyle = '#1d9e4e'; c.fillStyle = '#1d9e4e'; c.lineWidth = 5; c.font = font(800, 34);
  const sw = c.measureText('DIBAYAR').width + 60; c.strokeRect(M, y, sw, 70); c.fillText('DIBAYAR', M + 30, y + 48);
  c.font = font(500, 24); c.fillText('Ditransfer ' + fmtKey(payout.paidDate), M + sw + 24, y + 45);
  y += 120; breaks.push(y - 30);
  // Kata-kata terima kasih
  const boxH = 70 + thanks.length * 40 + 30;
  c.fillStyle = '#fdf6ee'; c.fillRect(M, y, W - 2 * M, boxH);
  c.fillStyle = color; c.fillRect(M, y, 8, boxH);
  c.fillStyle = '#7e291f'; c.font = font(800, 30); c.fillText('Terima kasih, ' + (payout.mitraName || 'Bapak/Ibu Guru') + '!', M + 34, y + 52);
  c.fillStyle = '#3f3a36'; c.font = font(400, 27);
  thanks.forEach((l, i) => c.fillText(l, M + 34, y + 98 + i * 40));
  y += boxH + 60; breaks.push(y - 40);
  c.fillStyle = '#4b5563'; c.font = font(500, 26); c.fillText('Hormat kami,', M, y);
  c.fillStyle = '#1c1c1e'; c.font = font(800, 30); c.fillText(adminName || 'Guru Admin', M, y + 44);
  c.fillStyle = '#6b7280'; c.font = font(500, 24); c.fillText(((org && org.name) || '') + (payout.note ? ' · ' + payout.note : ''), M, y + 80);
  y += 130;
  // Bukti transfer
  breaks.push(y - 40);
  if (proof) {
    c.fillStyle = '#374151'; c.font = font(800, 22); c.fillText('BUKTI TRANSFER', M, y);
    y += 20; c.drawImage(proof, M, y, proofW, proofH);
    c.strokeStyle = '#e5e7eb'; c.lineWidth = 2; c.strokeRect(M, y, proofW, proofH);
    y += proofH + 40;
  }
  c.fillStyle = '#9ca3af'; c.font = font(500, 22); c.textAlign = 'center';
  c.fillText('Slip honor ini dibuat otomatis dengan LesLesanKu', W / 2, y + 30); c.textAlign = 'left';
  // Potong tinggi sesuai isi
  const out = document.createElement('canvas'); out.width = W; out.height = Math.min(H, y + 70);
  out.getContext('2d').drawImage(cv, 0, 0);
  out._breaks = breaks; out._headerY = breaks[0]; out._rowH = rowH; out._tableEnd = tableEnd;
  return out;
}
export function canvasToBlob(cv, type, q) { return new Promise(res => cv.toBlob(res, type || 'image/jpeg', q || 0.9)); }

// Lebih dari sekian pertemuan → slip disarankan PDF (gambar JPG jadi terlalu panjang di WA)
export const SLIP_PDF_FROM = 11;
export const slipDefaultFormat = n => (n >= SLIP_PDF_FROM ? 'pdf' : 'jpg');
const JSPDF_URL = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
let jspdfLoading = null;
function loadJsPDF() {
  if (window.jspdf && window.jspdf.jsPDF) return Promise.resolve(window.jspdf.jsPDF);
  if (jspdfLoading) return jspdfLoading;
  jspdfLoading = new Promise((resolve, reject) => {
    const sc = document.createElement('script'); sc.src = JSPDF_URL; sc.async = true;
    sc.onload = () => (window.jspdf && window.jspdf.jsPDF ? resolve(window.jspdf.jsPDF) : reject(new Error('jsPDF tidak tersedia')));
    sc.onerror = () => { jspdfLoading = null; reject(new Error('Gagal memuat pembuat PDF (cek internet)')); };
    document.head.appendChild(sc);
  });
  return jspdfLoading;
}
// Slip → PDF A4. Halaman dipotong di antara baris (tidak memotong tulisan);
// kalau tabel berlanjut ke halaman berikutnya, judul kolom diulang.
export async function slipPdfBlob(cv, no) {
  const JsPDF = await loadJsPDF();
  const pdf = new JsPDF({ unit: 'mm', format: 'a4' });
  const pageW = 210, pageH = 297, mg = 10, foot = 8, imgW = pageW - 2 * mg;
  const pxPerMm = cv.width / imgW, maxH = Math.floor((pageH - 2 * mg - foot) * pxPerMm);
  const breaks = (cv._breaks || []).filter(b => b > 0 && b < cv.height), hy = cv._headerY, rh = cv._rowH || 0;
  const tableEnd = cv._tableEnd || 0;
  const pages = []; let sy = 0;
  while (sy < cv.height) {
    const head = pages.length && hy != null && sy > hy && sy < tableEnd ? rh : 0; // ulang judul kolom
    const room = maxH - head;
    let end = cv.height;
    if (cv.height - sy > room) {
      const ok = breaks.filter(b => b > sy + 40 && b <= sy + room);
      end = ok.length ? ok[ok.length - 1] : sy + room;
    }
    pages.push({ sy, end, head }); sy = end;
  }
  pages.forEach((pg, i) => {
    const h = pg.end - pg.sy, part = document.createElement('canvas');
    part.width = cv.width; part.height = h + pg.head;
    const c = part.getContext('2d'); c.fillStyle = '#fff'; c.fillRect(0, 0, part.width, part.height);
    if (pg.head) c.drawImage(cv, 0, hy, cv.width, rh, 0, 0, cv.width, rh);
    c.drawImage(cv, 0, pg.sy, cv.width, h, 0, pg.head, cv.width, h);
    if (i) pdf.addPage();
    pdf.addImage(part.toDataURL('image/jpeg', 0.9), 'JPEG', mg, mg, imgW, part.height / pxPerMm);
    pdf.setFontSize(8); pdf.setTextColor(150);
    pdf.text((no ? no + '  ·  ' : '') + 'Halaman ' + (i + 1) + ' dari ' + pages.length, pageW / 2, pageH - mg / 2 - 1, { align: 'center' });
  });
  return pdf.output('blob');
}
export function slipWaText(p, orgName, adminName) {
  const b = p.bank || {};
  return `Halo ${p.mitraName} 👋\n\nHonor mengajar Anda di *${orgName}* sudah kami transfer 🎉\n\n`
    + `💰 *${rupiah(p.total)}* — ${p.sessions} pertemuan\n🗓️ Periode ${fmtKey(p.periodFrom)} – ${fmtKey(p.periodTo)}\n`
    + (b.number ? `🏦 ${[b.bank, b.number].filter(Boolean).join(' ')}${b.holder ? ' a.n. ' + b.holder : ''}\n` : '')
    + `📅 Ditransfer ${fmtKey(p.paidDate)}\n\nSlip honor (rincian pertemuan) & bukti transfer terlampir.\n\n`
    + `${THANKS} 🙏\n\n— ${adminName || 'Guru Admin'}, ${orgName}`;
}
// Kompres foto bukti transfer supaya muat di database (JPEG, sisi terpanjang maks. 1100px)
export function compressPhoto(file, max = 1100, q = 0.72) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onerror = () => reject(new Error('Gagal membaca foto'));
    r.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('File bukan gambar'));
      img.onload = () => {
        const s = Math.min(1, max / Math.max(img.width, img.height));
        const cv = document.createElement('canvas'); cv.width = Math.round(img.width * s); cv.height = Math.round(img.height * s);
        const c = cv.getContext('2d'); c.fillStyle = '#fff'; c.fillRect(0, 0, cv.width, cv.height); c.drawImage(img, 0, 0, cv.width, cv.height);
        let out = cv.toDataURL('image/jpeg', q);
        if (out.length > 850000) out = cv.toDataURL('image/jpeg', 0.5);
        resolve(out);
      };
      img.src = r.result;
    };
    r.readAsDataURL(file);
  });
}
