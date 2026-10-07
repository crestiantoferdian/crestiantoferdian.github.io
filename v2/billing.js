// ══════════════════════════════════════════════════════════════════════
// HARGA LANGGANAN LLK V2 (Lembaga) — HARUS sama dengan functions/orgPlans.js
// (dicek otomatis oleh functions/test/orgPlans.test.js). Server yang
// menentukan nominal sebenarnya; ini hanya untuk tampilan di aplikasi.
// ══════════════════════════════════════════════════════════════════════
export const DAY_MS = 24 * 60 * 60 * 1000;
export const ORG_TRIAL_DAYS = 31;
export const ORG_BASE = 200000;
export const ORG_BASE_SLOTS = 2;
export const ORG_SLOT = 100000;
export const ORG_BUNDLE = 5;
export const ORG_BUNDLE_PRICE = 449000;
export const ORG_MAX_EXTRA = 95;
export const ORG_PERIODS = {
  monthly: { months: 1, days: 30, label: '1 bulan' },
  yearly: { months: 10, days: 365, label: '1 tahun' },
};
// Midtrans untuk V2 (Client Key boleh terlihat publik). Ganti ke production
// bersamaan dengan MIDTRANS_V2_IS_PRODUCTION=true di functions/.env.
export const MIDTRANS_V2 = { production: false, clientKey: 'Mid-client-otkKdl7AbO8l4lPB' };

export function extraPrice(extra) {
  const n = Math.max(0, Math.floor(extra || 0));
  return Math.floor(n / ORG_BUNDLE) * ORG_BUNDLE_PRICE + (n % ORG_BUNDLE) * ORG_SLOT;
}
export function monthlyPrice(extra) { return ORG_BASE + extraPrice(extra); }
export function periodPrice(extra, period) { return monthlyPrice(extra) * ORG_PERIODS[period].months; }
// Hemat dibanding beli slot satu per satu (Rp51.000 per 5 slot)
export function bundleSaving(extra) { return Math.max(0, extra || 0) * ORG_SLOT - extraPrice(extra); }

export function orgEndsMs(org) {
  if (org && org.activeUntilMs) return org.activeUntilMs;
  return (org && org.createdAtMs ? org.createdAtMs : 0) + ORG_TRIAL_DAYS * DAY_MS;
}
export function orgPaidActive(org, nowMs) { return !!org && org.plan === 'pro' && orgEndsMs(org) > nowMs; }

export function addSlotsPrice(org, add, nowMs) {
  const period = ORG_PERIODS[org.period] ? org.period : 'monthly';
  const cur = Math.max(0, (org.seats || ORG_BASE_SLOTS) - ORG_BASE_SLOTS);
  const diff = periodPrice(cur + add, period) - periodPrice(cur, period);
  // Sisa uji coba gratis tidak ikut dibayar: hitung dari akhir uji coba kalau belum lewat
  const from = Math.max(nowMs, (org.createdAtMs || 0) + ORG_TRIAL_DAYS * DAY_MS);
  const remain = Math.max(0, orgEndsMs(org) - from);
  const days = Math.max(1, Math.ceil(remain / DAY_MS));
  return { amount: Math.ceil((diff * days / ORG_PERIODS[period].days) / 1000) * 1000, days, period };
}
