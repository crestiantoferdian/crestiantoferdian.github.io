// Uji GANTI PAKET (upgrade/downgrade) langganan Play di aplikasi: mode proration, konfirmasi, jalur gagal yang aman. Hanya Node.
// Jalankan dari folder tests: node play-ganti-paket.test.cjs   (atau beri jalur index.html)
const path = require('path');
const fs = require('fs'), vm = require('vm'), assert = require('assert');
const html = fs.readFileSync(process.argv[2] || path.join(__dirname, '..', 'index.html'), 'utf8');

function grabFn(name) {
  const i = html.indexOf('function ' + name + '('); assert(i > 0, 'fungsi tidak ada: ' + name);
  let d = 0; const j = html.indexOf('{', i);
  for (let k = j; k < html.length; k++) { if (html[k] === '{') d++; if (html[k] === '}') { d--; if (!d) return html.slice(i, k + 1); } }
}
const tiers = html.slice(html.indexOf('const LLK_TIERS=['), html.indexOf('let _currentTier=null;'));
const playBlock = html.slice(html.indexOf('const LLK_PLAY_SKUS='), html.indexOf('async function mulaiLangganan(plan){'));
const tierInfoSrc = grabFn('tierInfo');

function makeEnv(o) {
  o = o || {};
  const log = { els: [], toasts: [], statuses: [], pr: [], calls: [], completes: [], manage: 0, soon: 0, listCalls: 0 };
  const mkEl = () => {
    const q = {}; const el = { style: {}, innerHTML: '', id: '', _q: q, addEventListener() {}, remove() {}, querySelector: (sel) => (q[sel] = q[sel] || { onclick: null }) };
    return el;
  };
  const doc = { getElementById: () => null, createElement: mkEl, body: { appendChild: (e) => log.els.push(e) } };
  class PaymentRequest {
    constructor(methods, details) { log.pr.push({ methods, details }); }
    async show() {
      if (o.showError) { const e = new Error('x'); e.name = o.showError; throw e; }
      return { details: { purchaseToken: o.newToken === undefined ? 'NEWTOK' : o.newToken }, complete: async (s) => { log.completes.push(s); } };
    }
  }
  const list = o.purchases === undefined ? [{ itemId: 'llk_basic_monthly', purchaseToken: 'OLDTOK' }] : o.purchases;
  const svc = o.noService ? null : {
    getDetails: async (ids) => (o.noProduct ? [] : ids.map((id) => ({ itemId: id }))),
    listPurchases: async () => { log.listCalls++; return list; },
  };
  const win = { llkIsPlayApp: () => true, PaymentRequest, getDigitalGoodsService: async () => { if (!svc) throw new Error('x'); return svc; } };
  const ctx = {
    window: win, document: doc, console: { warn() {}, error() {}, log() {} }, PaymentRequest, setTimeout: () => 0, clearTimeout() {},
    toast: (m) => log.toasts.push(m), setPaywallStatus: (m) => log.statuses.push(m), llkI: () => '', escapeHtml: (s) => String(s), llkFmtDateMs: () => '12 Des 2026',
    showGlobalLoading() {}, hideGlobalLoading() {}, currentUser: { uid: 'u1' },
    firebase: { functions: () => ({ httpsCallable: (n) => async (d) => { log.calls.push([n, JSON.parse(JSON.stringify(d))]); if (o.verifyError) throw new Error(o.verifyError); return { data: { access: true } }; } }) },
    _subPaidActive: true, _subSource: 'play', _subEndsMs: Date.now() + 864e5, _subBadgeInfo: null, _subPlanKey: o.cur === undefined ? 'basic_monthly' : o.cur, _currentTier: 'basic',
    _subPlayAutoRenew: true,
    llkPlayPayNotice: () => log.soon++,
  };
  vm.createContext(ctx);
  vm.runInContext(tiers + '\n' + tierInfoSrc + '\n' + playBlock, ctx);
  if (!o.realNotice) vm.runInContext('llkPlayManageNotice=function(){ __manage(); };', Object.assign(ctx, { __manage: () => log.manage++ }));
  vm.runInContext('LLK_PLAY_DEFERRED=' + (o.deferredOff ? 'false' : 'true') + ';', ctx);
  if (o.autoConfirm !== false) vm.runInContext('llkPlayConfirmChange=async function(){ return true; };', ctx);
  return { ctx, log };
}
const run = (e, c) => vm.runInContext(c, e.ctx);
const J = (x) => JSON.parse(JSON.stringify(x));
let n = 0; const ok = (m) => console.log('OK  ' + (++n) + ' ' + m);

(async () => {
  // ── Pemilihan mode ──
  {
    const e = makeEnv();
    const M = (a, b) => run(e, `llkPlayChangeMode('${a}','${b}')`);
    const P = 'immediateAndChargeProratedPrice', D = 'deferred';
    assert.strictEqual(M('basic_monthly', 'up_monthly'), P);
    assert.strictEqual(M('basic_monthly', 'unlimited_monthly'), P);
    assert.strictEqual(M('up_monthly', 'unlimited_monthly'), P);
    assert.strictEqual(M('up_yearly', 'unlimited_yearly'), P);
    assert.strictEqual(M('unlimited_monthly', 'up_monthly'), D);
    assert.strictEqual(M('up_monthly', 'basic_monthly'), D);
    assert.strictEqual(M('unlimited_yearly', 'up_yearly'), D);
    assert.strictEqual(M('up_monthly', 'up_yearly'), D);
    assert.strictEqual(M('up_yearly', 'up_monthly'), D);
    assert.strictEqual(M('basic_monthly', 'up_yearly'), D);
    assert.strictEqual(M('up_yearly', 'unlimited_monthly'), D);
    ok('mode: naik tingkat & periode sama → immediateAndChargeProratedPrice; turun / ganti periode → deferred');
    const plans = ['basic_monthly', 'up_monthly', 'up_yearly', 'unlimited_monthly', 'unlimited_yearly'];
    const modes = new Set();
    for (const a of plans) for (const b of plans) if (a !== b) modes.add(M(a, b));
    assert.deepStrictEqual([...modes].sort(), [D, P].sort());
    ok('mode: dari semua 20 kombinasi paket hanya dua mode yang dipakai; immediateWithoutProration (dinonaktifkan Google) tidak pernah');
  }
  // ── Naik paket: data PaymentRequest persis sesuai panduan resmi ──
  {
    const e = makeEnv({ purchases: [{ itemId: 'llk_basic_monthly', purchaseToken: 'OLDTOK' }, { itemId: 'produk_lain', purchaseToken: 'X' }] });
    await run(e, "llkPlayBuy('up_monthly')");
    assert.strictEqual(e.log.pr.length, 1);
    assert.deepStrictEqual(J(e.log.pr[0].methods), [{ supportedMethods: 'https://play.google.com/billing', data: { sku: 'llk_up_monthly', oldSku: 'llk_basic_monthly', purchaseToken: 'OLDTOK', prorationMode: 'immediateAndChargeProratedPrice' } }]);
    assert.deepStrictEqual(e.log.calls, [['verifyPlayPurchase', { productId: 'llk_up_monthly', purchaseToken: 'NEWTOK' }]]);
    assert.deepStrictEqual(e.log.completes, ['success']);
    assert.ok(e.log.toasts.some((t) => /Paket diganti ke Pro Up Bulanan/.test(t)));
    ok('NAIK: PaymentRequest {sku, oldSku, purchaseToken lama, prorationMode} sesuai panduan Google; token baru diverifikasi server; complete(success)');
  }
  // ── Turun / ganti periode: deferred ──
  {
    const e = makeEnv({ cur: 'unlimited_monthly', purchases: [{ itemId: 'llk_unlimited_monthly', purchaseToken: 'OLDTOK' }] });
    await run(e, "llkPlayBuy('up_monthly')");
    assert.strictEqual(J(e.log.pr[0].methods)[0].data.prorationMode, 'deferred');
    assert.strictEqual(J(e.log.pr[0].methods)[0].data.oldSku, 'llk_unlimited_monthly');
    assert.ok(e.log.toasts.some((t) => /dijadwalkan saat perpanjangan berikutnya/.test(t)));
    ok('TURUN: mode deferred, pesan "dijadwalkan saat perpanjangan berikutnya"');
    const e2 = makeEnv({ cur: 'up_monthly', purchases: [{ itemId: 'llk_up_monthly', purchaseToken: 'OT' }] });
    await run(e2, "llkPlayBuy('up_yearly')");
    assert.strictEqual(J(e2.log.pr[0].methods)[0].data.prorationMode, 'deferred');
    ok('GANTI PERIODE (bulanan → tahunan, tingkat sama): deferred');
  }
  // ── Konfirmasi ──
  {
    const e = makeEnv({ autoConfirm: false });
    const p = run(e, "llkPlayBuy('up_monthly')");
    for (let i = 0; i < 5; i++) await Promise.resolve();
    const dlg = e.log.els[e.log.els.length - 1];
    assert.ok(/Naik ke Pro Up Bulanan\?/.test(dlg.innerHTML) && /sekarang/.test(dlg.innerHTML) && /selisih harga/.test(dlg.innerHTML) && /belum termasuk pajak/.test(dlg.innerHTML));
    assert.strictEqual(e.log.pr.length, 0, 'pembayaran belum dibuka sebelum konfirmasi');
    dlg._q['#llkPlayChgYes'].onclick(); await p;
    assert.strictEqual(e.log.pr.length, 1);
    ok('KONFIRMASI naik paket: dijelaskan "berlaku sekarang, tagih selisih (belum termasuk pajak)"; pembayaran baru terbuka setelah "Lanjutkan"');
    const e2 = makeEnv({ autoConfirm: false, cur: 'unlimited_monthly', purchases: [{ itemId: 'llk_unlimited_monthly', purchaseToken: 'T' }] });
    const p2 = run(e2, "llkPlayBuy('basic_monthly')");
    for (let i = 0; i < 5; i++) await Promise.resolve();
    const d2 = e2.log.els[e2.log.els.length - 1];
    assert.ok(/Ganti ke Pro Basic Bulanan\?/.test(d2.innerHTML) && /perpanjangan berikutnya/.test(d2.innerHTML) && /12 Des 2026/.test(d2.innerHTML) && /tidak ada tagihan sekarang/.test(d2.innerHTML));
    d2._q['#llkPlayChgNo'].onclick(); await p2;
    assert.strictEqual(e2.log.pr.length, 0); assert.strictEqual(e2.log.calls.length, 0); assert.strictEqual(e2.log.listCalls, 0);
    ok('KONFIRMASI turun paket: tanggal berlaku & "tidak ada tagihan sekarang"; "Batal" → tidak ada pembayaran, tidak menyentuh Google');
  }
  // ── Jalur gagal yang aman ──
  {
    const e = makeEnv({ purchases: [] });
    await run(e, "llkPlayBuy('up_monthly')");
    assert.strictEqual(e.log.pr.length, 0); assert.strictEqual(e.log.manage, 1);
    ok('langganan lama TIDAK ditemukan di Google → petunjuk "batalkan di Play Store", tidak membuat pembelian baru');
    const e2 = makeEnv({ cur: null });
    await run(e2, "llkPlayBuy('up_monthly')");
    assert.strictEqual(e2.log.pr.length, 0); assert.strictEqual(e2.log.manage, 1);
    ok('paket sekarang tidak diketahui → petunjuk aman');
    const e3 = makeEnv({ showError: 'NotSupportedError' });
    await run(e3, "llkPlayBuy('up_monthly')");
    assert.strictEqual(e3.log.manage, 1); assert.strictEqual(e3.log.calls.length, 0); assert.strictEqual(e3.log.pr.length, 1);
    ok('Google menolak penggantian (NotSupportedError) → petunjuk aman; TIDAK mengulang sebagai pembelian baru, tidak memanggil server');
    const e4 = makeEnv({ showError: 'AbortError' });
    await run(e4, "llkPlayBuy('up_monthly')");
    assert.strictEqual(e4.log.toasts.length, 0); assert.strictEqual(e4.log.manage, 0);
    ok('dibatalkan pengguna di lembar Google → diam');
    const e5 = makeEnv({ verifyError: 'jaringan' });
    await run(e5, "llkPlayBuy('up_monthly')");
    assert.deepStrictEqual(e5.log.completes, ['unknown']); assert.ok(e5.log.toasts.some((t) => /belum selesai/.test(t)));
    ok('server gagal setelah bayar → complete(unknown) + pesan (tidak dianggap gagal di Google)');
    const e6 = makeEnv({ newToken: '' });
    await run(e6, "llkPlayBuy('up_monthly')");
    assert.strictEqual(e6.log.calls.length, 0); assert.deepStrictEqual(e6.log.completes, ['fail']);
    ok('token kosong dari Google → tidak memanggil server, complete(fail)');
    const e7 = makeEnv({ noService: true });
    await run(e7, "llkPlayBuy('up_monthly')");
    assert.strictEqual(e7.log.pr.length, 0); assert.strictEqual(e7.log.manage, 1);
    ok('layanan Digital Goods tidak ada → petunjuk aman');
    const e8 = makeEnv({ noProduct: true });
    await run(e8, "llkPlayBuy('up_monthly')");
    assert.strictEqual(e8.log.pr.length, 0); assert.strictEqual(e8.log.soon, 1);
    ok('produk tujuan belum ada di Play Console → "Segera hadir", tidak ada pembayaran');
  }
  // ── Paket sama ──
  {
    const e = makeEnv();
    await run(e, "llkPlayBuy('basic_monthly')");
    assert.strictEqual(e.log.pr.length, 0); assert.strictEqual(e.log.listCalls, 0); assert.ok(e.log.toasts.some((t) => /paket kamu sekarang/i.test(t)));
    ok('memilih paket yang sedang dipakai → hanya pemberitahuan, tidak ada pembayaran');
  }
  // ── Langganan yang sudah dibatalkan: tidak diganti, hanya penjelasan ──
  {
    const e = makeEnv();
    e.ctx._subPlayAutoRenew = false;
    await run(e, "llkPlayBuy('up_monthly')");
    assert.strictEqual(e.log.pr.length, 0); assert.strictEqual(e.log.manage, 1); assert.strictEqual(e.log.listCalls, 0);
    ok('langganan sudah DIBATALKAN (masih aktif) → tidak mencoba penggantian; penjelasan "tetap aktif sampai tanggal, lalu pilih paket baru"');
  }
  // ── Pembelian pertama TIDAK terpengaruh (tanpa oldSku) ──
  {
    const e = makeEnv();
    e.ctx._subPaidActive = false; e.ctx._subSource = null;
    await run(e, "llkPlayBuy('up_monthly')");
    const d = J(e.log.pr[0].methods)[0].data;
    assert.deepStrictEqual(d, { sku: 'llk_up_monthly' });
    ok('pembelian pertama tetap polos {sku} (tanpa oldSku/purchaseToken/prorationMode)');
  }
  // ── Turun dari Unlimited (tombol "Ganti Paket" harus tetap ada di paket tertinggi) ──
  {
    const e = makeEnv({ cur: 'unlimited_monthly', purchases: [{ itemId: 'llk_unlimited_monthly', purchaseToken: 'OLDU' }] });
    assert.strictEqual(run(e, 'llkPlayManagedSub()'), true);
    await run(e, "llkPlayBuy('up_monthly')");
    const d = J(e.log.pr[0].methods)[0].data;
    assert.deepStrictEqual(d, { sku: 'llk_up_monthly', oldSku: 'llk_unlimited_monthly', purchaseToken: 'OLDU', prorationMode: 'deferred' });
    ok('Unlimited bulanan → Up bulanan: deferred (tanpa tagihan sekarang), bawa token lama');
    const e2 = makeEnv({ cur: 'unlimited_yearly', purchases: [{ itemId: 'llk_unlimited_yearly', purchaseToken: 'OLDY' }] });
    await run(e2, "llkPlayBuy('basic_monthly')");
    assert.strictEqual(J(e2.log.pr[0].methods)[0].data.prorationMode, 'deferred');
    ok('Unlimited tahunan → Basic bulanan: deferred');
    const e3 = makeEnv(); e3.ctx._subSource = 'midtrans';
    assert.strictEqual(run(e3, 'llkPlayManagedSub()'), false);
    const e4 = makeEnv(); e4.ctx._subPaidActive = false;
    assert.strictEqual(run(e4, 'llkPlayManagedSub()'), false);
    ok('tombol Ganti Paket hanya untuk langganan berbayar yang dikelola Play');
  }
  // ── Bila fitur deferred dimatikan (LLK_PLAY_DEFERRED=false): hanya petunjuk, tanpa pembayaran ──
  {
    for (const [cur, tgt] of [['unlimited_monthly', 'basic_monthly'], ['up_monthly', 'up_yearly'], ['up_monthly', 'basic_monthly']]) {
      const e = makeEnv({ cur, deferredOff: true, purchases: [{ itemId: 'llk_' + cur, purchaseToken: 'OLD' }] });
      await run(e, `llkPlayBuy('${tgt}')`);
      assert.strictEqual(e.log.pr.length, 0, 'tidak boleh membuka pembayaran Google'); assert.strictEqual(e.log.calls.length, 0);
      assert.strictEqual(e.log.manage, 1, 'harus tampil petunjuk aman');
    }
    ok('SAKLAR MATI: turun paket / ganti periode → hanya petunjuk (tanpa PaymentRequest, tanpa server)');
    const e = makeEnv({ cur: 'basic_monthly', deferredOff: true });
    await run(e, "llkPlayBuy('up_monthly')");
    assert.strictEqual(J(e.log.pr[0].methods)[0].data.prorationMode, 'immediateAndChargeProratedPrice');
    ok('SAKLAR MATI: naik paket langsung tetap jalan');
  }
  // ── Tombol pengelolaan langganan di Play Store ──
  {
    const e = makeEnv({ cur: 'unlimited_monthly', realNotice: true });
    const url = run(e, 'llkPlayManageUrl()');
    assert.strictEqual(url, 'https://play.google.com/store/account/subscriptions?package=com.leslesanku.app&sku=llk_unlimited_monthly');
    run(e, 'llkPlayManageNotice()');
    const h = e.log.els.map((x) => x.innerHTML).join(' ');
    assert.ok(h.includes(url) && /Buka Pengelolaan Langganan/.test(h) && /Batalkan langganan/.test(h) && /tidak hangus/.test(h));
    assert.ok(!/website|midtrans|situs|leslesanku\.com|diskon/i.test(h), 'tidak boleh mengarahkan ke cara bayar lain');
    ok('PESAN turun paket: tombol "Buka Pengelolaan Langganan" → halaman langganan Play (package+sku), netral tanpa menyebut website');
    const e2 = makeEnv({ cur: null, realNotice: true });
    assert.strictEqual(run(e2, 'llkPlayManageUrl()'), 'https://play.google.com/store/account/subscriptions?package=com.leslesanku.app');
    ok('tautan tetap valid walau paket sekarang tidak diketahui (tanpa sku)');
  }
  console.log('\nSemua ' + n + ' pemeriksaan lolos');
})().catch((e) => { console.error('GAGAL:', e && e.stack || e); process.exit(1); });
