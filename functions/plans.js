/**
 * Katalog paket langganan LLK + aturan perpanjangan.
 * Dipisah dari index.js supaya bisa diuji tanpa Firebase (lihat test/).
 *
 * Harga & batas murid HARUS sama dengan LLK_PLANS di index.html (aplikasi).
 */
const crypto = require('crypto');

const DAY_MS = 24 * 60 * 60 * 1000;
const DURATION_MS = { monthly: 30 * DAY_MS, yearly: 365 * DAY_MS };

// Batas murid AKTIF per tingkat paket (Infinity = tanpa batas)
const TIER_LIMITS = { basic: 10, up: 40, unlimited: Infinity };

const PLANS = {
  basic_monthly: { tier: 'basic', period: 'monthly', price: 35000, label: 'Pro Basic Bulanan' },
  up_monthly: { tier: 'up', period: 'monthly', price: 75000, label: 'Pro Up Bulanan' },
  up_yearly: { tier: 'up', period: 'yearly', price: 700000, label: 'Pro Up Tahunan' },
  unlimited_monthly: { tier: 'unlimited', period: 'monthly', price: 100000, label: 'Pro Unlimited Bulanan' },
  unlimited_yearly: { tier: 'unlimited', period: 'yearly', price: 1000000, label: 'Pro Unlimited Tahunan' },
};

// Paket lama (sebelum ada tingkatan) — hanya untuk memproses order lama yang
// masih tertunda di webhook. Tidak bisa lagi dipakai membuat transaksi baru.
const LEGACY_PLANS = {
  monthly: { tier: 'unlimited', period: 'monthly', price: 40000, label: 'Pro Bulanan' },
  yearly: { tier: 'unlimited', period: 'yearly', price: 400000, label: 'Pro Tahunan' },
};

function resolvePlan(key) {
  return PLANS[key] || LEGACY_PLANS[key] || null;
}

/**
 * Hitung status langganan setelah pembayaran plan `planKey` berhasil.
 * - Paket SAMA dengan yang masih aktif → masa aktif ditambahkan di ujungnya.
 * - Paket BERBEDA (naik/turun paket) → paket baru berlaku mulai sekarang;
 *   sisa masa paket lama tidak dibawa.
 * Pelanggan lama tanpa field `tier` dianggap 'unlimited'.
 */
function nextSubscription(current, planKey, nowMs) {
  const plan = resolvePlan(planKey);
  if (!plan) throw new Error('Plan tidak dikenal: ' + planKey);
  const curEnds = current && current.subscriptionEndsMs ? current.subscriptionEndsMs : 0;
  const curActive = !!current && current.status === 'active' && curEnds > nowMs;
  const curTier = curActive ? current.tier || 'unlimited' : null;
  const base = curTier === plan.tier ? curEnds : nowMs;
  return { tier: plan.tier, plan: planKey, subscriptionEndsMs: base + DURATION_MS[plan.period] };
}

// Naik paket (pelanggan BERBAYAR yang masih aktif pindah ke tingkat lebih tinggi):
//   langganan sekarang BULANAN → paket bulanan diskon 50%, paket tahunan diskon 10%
//   langganan sekarang TAHUNAN → diskon 50%
// HARUS sama dengan llkUpgradeDiscount() di index.html.
const UPGRADE_DISCOUNT = { monthly: { monthly: 0.5, yearly: 0.1 }, yearly: { monthly: 0.5, yearly: 0.5 } };
const TIER_RANK = { basic: 0, up: 1, unlimited: 2 };

/**
 * Harga yang ditagih untuk `planKey`, dihitung dari langganan sekarang (dokumen subscriptions).
 * Trial, tester, dan langganan yang sudah habis tidak mendapat diskon naik paket.
 */
function priceFor(current, planKey, nowMs) {
  const plan = resolvePlan(planKey);
  if (!plan) throw new Error('Plan tidak dikenal: ' + planKey);
  const curEnds = current && current.subscriptionEndsMs ? current.subscriptionEndsMs : 0;
  const paidActive = !!current && current.status === 'active' && !current.isTester && curEnds > nowMs;
  const curTier = paidActive ? current.tier || 'unlimited' : null;
  const upgrade = !!curTier && TIER_RANK[plan.tier] > TIER_RANK[curTier];
  if (!upgrade) return { price: plan.price, fullPrice: plan.price, upgrade: false, discount: 0 };
  const curPlan = resolvePlan(current.plan);
  const curPeriod = curPlan ? curPlan.period : 'monthly';
  const discount = UPGRADE_DISCOUNT[curPeriod][plan.period];
  return { price: Math.round(plan.price * (1 - discount)), fullPrice: plan.price, upgrade: true, discount };
}

// Kunci dokumen trialUsage: hash email (bukan email mentah) supaya koleksi
// ini tidak menyimpan alamat email pengguna yang sudah menghapus akunnya.
function trialKey(email) {
  const norm = String(email || '').trim().toLowerCase();
  if (!norm) return null;
  return crypto.createHash('sha256').update(norm).digest('hex');
}

module.exports = { DAY_MS, DURATION_MS, TIER_LIMITS, PLANS, LEGACY_PLANS, UPGRADE_DISCOUNT, resolvePlan, nextSubscription, priceFor, trialKey };
