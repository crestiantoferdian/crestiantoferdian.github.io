// Harga V2 di server (functions/orgPlans.js) harus sama persis dengan aplikasi (v2/billing.js)
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { pathToFileURL } = require('url');
const OP = require('../orgPlans.js');

const DAY = 24 * 60 * 60 * 1000;

test('harga & aturan V2: server = aplikasi', async () => {
  const B = await import(pathToFileURL(path.join(__dirname, '../../v2/billing.js')).href);
  for (const k of ['ORG_TRIAL_DAYS', 'ORG_BASE', 'ORG_BASE_SLOTS', 'ORG_SLOT', 'ORG_BUNDLE', 'ORG_BUNDLE_PRICE', 'ORG_MAX_EXTRA']) {
    assert.strictEqual(B[k], OP[k], k);
  }
  assert.deepStrictEqual(B.ORG_PERIODS, OP.ORG_PERIODS);
  const now = Date.UTC(2026, 9, 8);
  for (let n = 0; n <= 30; n++) {
    for (const p of ['monthly', 'yearly']) assert.strictEqual(B.periodPrice(n, p), OP.periodPrice(n, p), `${n} slot ${p}`);
    for (const days of [1, 7, 15, 29, 200]) {
      const org = { seats: 2 + n, plan: 'pro', period: days > 30 ? 'yearly' : 'monthly', activeUntilMs: now + days * DAY - 3600e3 };
      for (const add of [1, 3, 5]) assert.deepStrictEqual(B.addSlotsPrice(org, add, now), OP.addSlotsPrice(org, add, now));
    }
  }
});

test('contoh pemilik: Rani 3 Guru Mitra Rp300rb, tambah 5 slot → +Rp449rb = Rp749rb', () => {
  assert.strictEqual(OP.monthlyPrice(1), 300000);
  assert.strictEqual(OP.monthlyPrice(1 + 5), 749000);
  assert.deepStrictEqual([1, 2, 3, 4, 5].map(OP.extraPrice), [100000, 200000, 300000, 400000, 449000]);
});
