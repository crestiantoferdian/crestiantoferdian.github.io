// Uji sisi aplikasi (index.html) untuk Google Play Billing: beli, pulihkan, tombol, penjaga. Hanya Node (tanpa browser/emulator).
// Jalankan dari folder tests: node play-billing-app.test.cjs   (atau beri jalur index.html & functions/playbilling.js)
const path = require('path');
const fs = require('fs'), vm = require('vm'), assert = require('assert');
const html = fs.readFileSync(process.argv[2] || path.join(__dirname, '..', 'index.html'), 'utf8');
const PB = require(process.argv[3] || path.join(__dirname, '..', 'functions', 'playbilling.js'));

const a = html.indexOf('const LLK_PLAY_SKUS=');
const b = html.indexOf('async function mulaiLangganan(plan){');
const mulaiEnd = html.indexOf('\n}\n', b) + 3;
assert(a > 0 && b > a, 'blok Play Billing tidak ditemukan');
const src = html.slice(a, mulaiEnd);

function makeEnv(o) {
  o = o || {};
  const log = { toasts: [], statuses: [], notice: 0, manage: 0, calls: [], completes: [], loading: 0 };
  const doc = { getElementById: () => null, createElement: () => ({ style: {}, addEventListener() {}, remove() {} }), body: { appendChild() {} } };
  class PaymentRequest {
    constructor(methods, details) { log.pr = { methods, details }; }
    async show() {
      if (o.showError) { const e = new Error('batal'); e.name = o.showError; throw e; }
      return { details: { purchaseToken: o.token === undefined ? 'TOK1' : o.token }, complete: async (s) => { log.completes.push(s); } };
    }
  }
  const svc = o.noService ? null : {
    getDetails: async (ids) => (o.noProduct ? [] : [{ itemId: ids[0] }]),
    listPurchases: async () => o.purchases || [],
  };
  const win = { llkIsPlayApp: () => o.play !== false, PaymentRequest, getDigitalGoodsService: o.noApi ? undefined : async () => { if (!svc) throw new Error('tidak ada'); return svc; } };
  const ctx = {
    window: win, document: doc, console: { warn() {}, error() {}, log() {} }, setTimeout: (f) => 0, clearTimeout() {}, PaymentRequest,
    toast: (m) => log.toasts.push(m), setPaywallStatus: (m) => log.statuses.push(m), llkI: () => '', escapeHtml: (s) => s,
    showGlobalLoading: () => log.loading++, hideGlobalLoading: () => log.loading--,
    currentUser: o.user === false ? null : { uid: 'u1' },
    firebase: { functions: () => ({ httpsCallable: (name) => async (data) => { log.calls.push([name, data]); if (o.verifyError) { const e = new Error(o.verifyError); e.code = 'functions/internal'; throw e; } return { data: o.verifyResult || { access: true, plan: 'up_monthly' } }; } }) },
    _subPaidActive: !!o.activePlay, _subSource: o.activePlay ? 'play' : null, _subPlanKey: null, _subEndsMs: 0, _subPlayAutoRenew: null,
    llkPlayPayNotice: () => log.notice++,
  };
  vm.createContext(ctx);
  // llkPlayManageNotice memakai document; hitung pemanggilannya lewat pembungkus
  vm.runInContext(src + '\nthis.__manage = llkPlayManageNotice; llkPlayManageNotice = function(){ __count(); };', Object.assign(ctx, { __count: () => log.manage++ }));
  return { ctx, log };
}
const run = (env, code) => vm.runInContext(code, env.ctx);
const J = (x) => JSON.parse(JSON.stringify(x));
let n = 0; const ok = (m) => console.log('OK  ' + (++n) + ' ' + m);

(async () => {
  // 0. Daftar SKU aplikasi = daftar SKU server
  {
    const e = makeEnv();
    assert.deepStrictEqual(J(run(e, 'LLK_PLAY_SKUS')), PB.PLAY_SKUS);
    ok('product ID aplikasi sama dengan server (5 paket)');
  }
  // 1. Pembelian berhasil
  {
    const e = makeEnv();
    await run(e, "llkPlayBuy('up_monthly')");
    assert.deepStrictEqual(J(e.log.calls), [['verifyPlayPurchase', { productId: 'llk_up_monthly', purchaseToken: 'TOK1' }]]);
    assert.deepStrictEqual(e.log.completes, ['success']);
    assert.strictEqual(e.log.pr.methods[0].supportedMethods, 'https://play.google.com/billing');
    assert.strictEqual(e.log.pr.methods[0].data.sku, 'llk_up_monthly');
    assert.ok(e.log.toasts.some((t) => /berhasil/i.test(t))); assert.strictEqual(e.log.notice, 0);
    ok('beli: Google Play → token → verifikasi server → complete(success) → toast');
  }
  // 2. Produk belum ada → "Segera hadir", tidak membuka pembayaran
  {
    const e = makeEnv({ noProduct: true });
    await run(e, "llkPlayBuy('basic_monthly')");
    assert.strictEqual(e.log.notice, 1); assert.strictEqual(e.log.pr, undefined); assert.strictEqual(e.log.calls.length, 0);
    ok('produk belum dibuat di Play Console → pemberitahuan "Segera hadir", tanpa error');
  }
  // 3. Layanan tidak ada (AAB v1 / Chrome lama) → "Segera hadir"
  for (const [label, o] of [['getDigitalGoodsService tidak ada', { noApi: true }], ['layanan melempar error', { noService: true }]]) {
    const e = makeEnv(o);
    await run(e, "llkPlayBuy('up_yearly')");
    assert.strictEqual(e.log.notice, 1); assert.strictEqual(e.log.calls.length, 0);
    ok('Digital Goods ' + label + ' → "Segera hadir"');
  }
  // 4. Pengguna membatalkan
  {
    const e = makeEnv({ showError: 'AbortError' });
    await run(e, "llkPlayBuy('up_monthly')");
    assert.strictEqual(e.log.toasts.length, 0); assert.strictEqual(e.log.calls.length, 0);
    ok('dibatalkan pengguna → diam (tanpa pesan galat)');
  }
  // 5. Verifikasi server gagal setelah dibayar → complete('unknown') + petunjuk Pulihkan
  {
    const e = makeEnv({ verifyError: 'jaringan putus' });
    await run(e, "llkPlayBuy('up_monthly')");
    assert.deepStrictEqual(e.log.completes, ['unknown']);
    assert.ok(e.log.toasts.some((t) => /belum selesai/i.test(t)));
    assert.ok(e.log.statuses.some((t) => /Pulihkan Langganan/.test(t)));
    ok('server gagal setelah bayar → complete(unknown), pengguna diarahkan ke "Pulihkan Langganan"');
  }
  // 6. Token kosong
  {
    const e = makeEnv({ token: '' });
    await run(e, "llkPlayBuy('up_monthly')");
    assert.strictEqual(e.log.calls.length, 0); assert.ok(e.log.toasts.length === 1);
    ok('token pembelian kosong → ditolak, tidak memanggil server');
  }
  // 7. Sudah punya langganan Play aktif → tidak membuat langganan kedua
  {
    const e = makeEnv({ activePlay: true });
    await run(e, "llkPlayBuy('unlimited_monthly')");
    assert.strictEqual(e.log.manage, 1); assert.strictEqual(e.log.pr, undefined); assert.strictEqual(e.log.calls.length, 0);
    ok('sudah berlangganan lewat Play → diarahkan ke Play Store, tidak ada langganan dobel');
  }
  // 8. Paket tak dikenal
  {
    const e = makeEnv();
    await run(e, "llkPlayBuy('paket_aneh')");
    assert.strictEqual(e.log.notice, 1); assert.strictEqual(e.log.pr, undefined);
    ok('paket tidak dikenal → pemberitahuan, tidak memanggil Google Play');
  }
  // 9. Pulihkan: hanya SKU LLK yang diverifikasi
  {
    const e = makeEnv({ purchases: [{ itemId: 'llk_up_monthly', purchaseToken: 'A' }, { itemId: 'produk_lain', purchaseToken: 'B' }] });
    await run(e, 'llkPlayRestore(false)');
    assert.deepStrictEqual(J(e.log.calls), [['verifyPlayPurchase', { productId: 'llk_up_monthly', purchaseToken: 'A' }]]);
    assert.ok(e.log.toasts.some((t) => /dipulihkan/i.test(t))); assert.strictEqual(e.log.loading, 0);
    ok('pulihkan: hanya produk LLK diverifikasi, ada pesan sukses, loading tertutup');
  }
  // 10. Pulihkan diam-diam tanpa pembelian: tanpa pesan; manual: ada pesan
  {
    const e1 = makeEnv({ purchases: [] }); await run(e1, 'llkPlayRestore(true)');
    assert.strictEqual(e1.log.toasts.length, 0); assert.strictEqual(e1.log.calls.length, 0);
    const e2 = makeEnv({ purchases: [] }); await run(e2, 'llkPlayRestore(false)');
    assert.strictEqual(e2.log.toasts.length, 1); assert.strictEqual(e2.log.loading, 0);
    ok('pulihkan: otomatis diam bila tidak ada; manual memberi tahu');
  }
  // 11. Pulihkan di website / belum login: tidak melakukan apa pun
  {
    const e1 = makeEnv({ play: false, purchases: [{ itemId: 'llk_up_monthly', purchaseToken: 'A' }] }); await run(e1, 'llkPlayRestore(false)');
    const e2 = makeEnv({ user: false, purchases: [{ itemId: 'llk_up_monthly', purchaseToken: 'A' }] }); await run(e2, 'llkPlayRestore(false)');
    assert.strictEqual(e1.log.calls.length + e2.log.calls.length, 0);
    ok('pulihkan: tidak jalan di website maupun saat belum login');
  }
  // 12. Tombol pulihkan hanya di aplikasi Play
  {
    const eP = makeEnv(); const eW = makeEnv({ play: false });
    assert.ok(run(eP, 'llkPlayRestoreHtml()').includes('Pulihkan Langganan'));
    assert.strictEqual(run(eW, 'llkPlayRestoreHtml()'), '');
    ok('tombol "Pulihkan Langganan" hanya tampil di aplikasi Play');
  }
  // 13. mulaiLangganan: Play → Play Billing; website → jalur Midtrans (tidak menyentuh Play)
  {
    const eP = makeEnv(); await run(eP, "mulaiLangganan('up_monthly')"); await new Promise((r) => setImmediate(r));
    assert.strictEqual(eP.log.calls.length, 1);
    const eW = makeEnv({ play: false });
    eW.ctx._llkPayBusy = true; // jalur Midtrans berhenti di penjaga "sedang memproses" (tidak butuh Midtrans di uji ini)
    await run(eW, "mulaiLangganan('up_monthly')");
    assert.strictEqual(eW.log.calls.length, 0); assert.strictEqual(eW.log.pr, undefined);
    ok('mulaiLangganan: aplikasi Play → Play Billing; website → tidak menyentuh Play Billing');
  }
  console.log('\nSemua ' + n + ' pemeriksaan lolos');
})().catch((e) => { console.error('GAGAL:', e && e.stack || e); process.exit(1); });
