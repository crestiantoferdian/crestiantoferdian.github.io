/**
 * Harga langganan LLK V2 (Lembaga) + aturan masa aktif.
 * Dipisah dari index.js supaya bisa diuji tanpa Firebase (lihat test/).
 *
 * HARUS sama dengan v2/billing.js (aplikasi) — dicek oleh test/orgPlans.test.js.
 *
 * - Paket Mulai Rp200.000/bulan: 1 Guru Admin + 2 slot Guru Mitra.
 * - Tambah slot Guru Mitra: Rp100.000/slot/bulan; setiap 5 slot = Rp449.000
 *   (hemat Rp51.000). Dihitung dari TOTAL slot tambahan, bukan per kali beli.
 * - Tahunan = 10x bulanan (bayar 10 bulan, aktif 12 bulan).
 * - Guru Admin yang juga mengajar memakai 1 slot Guru Mitra (aplikasi Admin tidak untuk mengajar).
 * - Uji coba: 31 hari sejak lembaga dibuat, 2 slot.
 */
const DAY_MS = 24 * 60 * 60 * 1000;
const ORG_TRIAL_DAYS = 31;
const ORG_BASE = 200000;
const ORG_BASE_SLOTS = 2;
const ORG_SLOT = 100000;
const ORG_BUNDLE = 5;
const ORG_BUNDLE_PRICE = 449000;
const ORG_MAX_EXTRA = 95;
const ORG_PERIODS = {
  monthly: { months: 1, days: 30, label: '1 bulan' },
  yearly: { months: 10, days: 365, label: '1 tahun' },
};

// Harga slot tambahan per bulan
function extraPrice(extra) {
  const n = Math.max(0, Math.floor(extra || 0));
  return Math.floor(n / ORG_BUNDLE) * ORG_BUNDLE_PRICE + (n % ORG_BUNDLE) * ORG_SLOT;
}
function monthlyPrice(extra) { return ORG_BASE + extraPrice(extra); }
function periodPrice(extra, period) { return monthlyPrice(extra) * ORG_PERIODS[period].months; }

// Masa aktif lembaga: activeUntil (setelah bayar) atau createdAt + 31 hari (uji coba)
function orgEndsMs(org) {
  if (org && org.activeUntilMs) return org.activeUntilMs;
  return (org && org.createdAtMs ? org.createdAtMs : 0) + ORG_TRIAL_DAYS * DAY_MS;
}
function orgPaidActive(org, nowMs) { return !!org && org.plan === 'pro' && orgEndsMs(org) > nowMs; }

/**
 * Bayar tambah slot di tengah masa aktif: selisih harga dihitung sisa harinya saja
 * (dibulatkan ke atas per Rp1.000). Perpanjangan berikutnya memakai harga baru.
 */
function addSlotsPrice(org, add, nowMs) {
  const period = ORG_PERIODS[org.period] ? org.period : 'monthly';
  const cur = Math.max(0, (org.seats || ORG_BASE_SLOTS) - ORG_BASE_SLOTS);
  const diff = periodPrice(cur + add, period) - periodPrice(cur, period);
  // Sisa uji coba gratis tidak ikut dibayar: hitung dari akhir uji coba kalau belum lewat
  const from = Math.max(nowMs, (org.createdAtMs || 0) + ORG_TRIAL_DAYS * DAY_MS);
  const remain = Math.max(0, orgEndsMs(org) - from);
  const days = Math.max(1, Math.ceil(remain / DAY_MS));
  return { amount: Math.ceil((diff * days / ORG_PERIODS[period].days) / 1000) * 1000, days, period };
}

/**
 * Status lembaga setelah order lunas.
 * subscribe: slot = 2 + extra; masa aktif ditambahkan di ujung masa sekarang
 *            (sisa uji coba / langganan tidak hangus).
 * addSlots : slot bertambah, masa aktif tetap.
 */
function nextOrg(org, order, nowMs) {
  if (order.action === 'addSlots') {
    return { seats: (org.seats || ORG_BASE_SLOTS) + order.add, plan: 'pro', period: org.period || 'monthly', activeUntilMs: orgEndsMs(org) };
  }
  const base = Math.max(nowMs, orgEndsMs(org));
  return { seats: ORG_BASE_SLOTS + order.extra, plan: 'pro', period: order.period, activeUntilMs: base + ORG_PERIODS[order.period].days * DAY_MS };
}

function orderLabel(order) {
  if (order.action === 'addSlots') return 'LLK Lembaga · tambah ' + order.add + ' slot Guru Mitra';
  return 'LLK Lembaga · ' + (ORG_BASE_SLOTS + order.extra) + ' Guru Mitra · ' + ORG_PERIODS[order.period].label;
}

module.exports = {
  DAY_MS, ORG_TRIAL_DAYS, ORG_BASE, ORG_BASE_SLOTS, ORG_SLOT, ORG_BUNDLE, ORG_BUNDLE_PRICE, ORG_MAX_EXTRA, ORG_PERIODS,
  extraPrice, monthlyPrice, periodPrice, orgEndsMs, orgPaidActive, addSlotsPrice, nextOrg, orderLabel,
};
