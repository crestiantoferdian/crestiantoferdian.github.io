// Uji harga & penjaga dobel-tagih di aplikasi Play: tanpa diskon naik paket, harga asli Google, website tetap berdiskon. Hanya Node.
// Jalankan dari folder tests: node play-harga.test.cjs   (atau beri jalur index.html)
const path = require('path');
const fs = require('fs'), vm = require('vm'), assert = require('assert');
const html = fs.readFileSync(process.argv[2] || path.join(__dirname, '..', 'index.html'), 'utf8');

function grabFn(name) {
  const i = html.indexOf('function ' + name + '('); assert(i > 0, 'fungsi tidak ada: ' + name);
  let d = 0; const j = html.indexOf('{', i);
  for (let k = j; k < html.length; k++) { if (html[k] === '{') d++; if (html[k] === '}') { d--; if (!d) return html.slice(i, k + 1); } }
}
const tiers = html.slice(html.indexOf('const LLK_TIERS=['), html.indexOf('let _currentTier=null;'));
const fmt = grabFn('formatRpPlan');
const plan = grabFn('planCardsHtml');
const tierInfoSrc = grabFn('tierInfo');
const a = html.indexOf('const LLK_PLAY_SKUS='), b = html.indexOf('async function mulaiLangganan(plan){');
const playBlock = html.slice(a, b);

function makeEnv(o) {
  o = o || {};
  const log = { els: [], toasts: [], pr: 0, calls: [] };
  const mkEl = () => ({ style: {}, innerHTML: '', addEventListener() {}, remove() {}, id: '' });
  const doc = { getElementById: (id) => (id === 'paywallPlans' ? o.paywallEl || null : null), createElement: () => mkEl(), body: { appendChild: (e) => log.els.push(e) } };
  class PaymentRequest { constructor() { log.pr++; } async show() { return { details: { purchaseToken: 'TOK' }, complete: async () => {} }; } }
  const svc = o.noService ? null : {
    getDetails: async (ids) => (o.details === undefined ? ids.map((id) => ({ itemId: id })) : o.details),
    listPurchases: async () => [],
  };
  const win = { llkIsPlayApp: () => o.play !== false, PaymentRequest, getDigitalGoodsService: async () => { if (!svc) throw new Error('x'); return svc; } };
  const ctx = {
    window: win, document: doc, console: { warn() {}, error() {}, log() {} }, PaymentRequest, setTimeout: () => 0,
    toast: (m) => log.toasts.push(m), setPaywallStatus() {}, llkI: () => '', escapeHtml: (s) => String(s), llkFmtDateMs: () => '12 Des 2026',
    activeStudentCount: () => 5,
    showGlobalLoading() {}, hideGlobalLoading() {}, currentUser: { uid: 'u1' },
    firebase: { functions: () => ({ httpsCallable: (n) => async (d) => { log.calls.push(n); return { data: { access: true } }; } }) },
    _subPaidActive: !!o.paidActive, _subSource: o.source || null, _subEndsMs: o.endsMs || 0, _subBadgeInfo: o.tester ? { isTester: true } : null, _subPlayAutoRenew: o.autoRenew === undefined ? null : o.autoRenew, _currentTier: o.tier || null,
    llkPlayPayNotice: () => (log.soon = (log.soon || 0) + 1),
  };
  vm.createContext(ctx);
  vm.runInContext(tiers + '\n' + tierInfoSrc + '\n' + fmt + '\n' + playBlock + '\n' + plan + '\n_currentPeriod=' + JSON.stringify(o.period || 'monthly') + ';', ctx);
  return { ctx, log };
}
const run = (e, c) => vm.runInContext(c, e.ctx);
let n = 0; const ok = (m) => console.log('OK  ' + (++n) + ' ' + m);

(async () => {
  // ── Website: diskon naik paket TETAP ada (jangan sampai ikut hilang) ──
  {
    const e = makeEnv({ play: false });
    const h = run(e, "planCardsHtml({minTier:'up', upgrade:true})");
    assert.ok(/Rp50\.000/.test(h) && /Rp900\.000/.test(h), 'harga diskon website');
    assert.ok(/diskon naik paket/i.test(h) && /<s /.test(h));
    ok('WEBSITE: Naik Paket tetap menampilkan diskon (Up bulanan → Unlimited: Rp50.000 / Rp900.000)');
    const h2 = run(e, 'planCardsHtml({minTier:null})');
    for (const p of ['Rp35.000', 'Rp75.000', 'Rp700.000', 'Rp100.000', 'Rp1.000.000']) assert.ok(h2.includes(p), p);
    ok('WEBSITE: harga reguler 35.000 / 75.000 / 700.000 / 100.000 / 1.000.000 tidak berubah');
  }
  // ── Aplikasi Play: tanpa diskon, harga penuh ──
  {
    const e = makeEnv({ play: true });
    const h = run(e, "planCardsHtml({minTier:'up', upgrade:true})");
    assert.ok(!/diskon/i.test(h), 'tidak boleh ada kata diskon'); assert.ok(!/<s /.test(h), 'tidak boleh ada harga coret');
    assert.ok(h.includes('Rp100.000') && h.includes('Rp1.000.000'));
    assert.ok(!h.includes('Rp50.000') && !h.includes('Rp900.000'));
    ok('PLAY: Naik Paket tanpa diskon/coret; Unlimited Rp100.000 / Rp1.000.000 (harga penuh yang ditagih Google)');
    const full = run(e, "planCardsHtml({minTier:null, upgrade:true})");
    assert.ok(!/diskon/i.test(full)); ok('PLAY: kartu paket penuh pun tanpa teks diskon');
  }
  // ── Harga dari Google ──
  {
    const details = [
      { itemId: 'llk_basic_monthly', price: { currency: 'IDR', value: '35000' } },
      { itemId: 'llk_up_monthly', price: { currency: 'IDR', value: '75000' } },
      { itemId: 'llk_up_yearly', price: { currency: 'IDR', value: '690000' } },
      { itemId: 'llk_unlimited_monthly', price: { currency: 'IDR', value: '99000' } },
      { itemId: 'llk_unlimited_yearly', price: { currency: 'IDR', value: '990000' } },
    ];
    const e = makeEnv({ play: true, details });
    await run(e, 'llkPlayLoadPrices()');
    const h = run(e, 'planCardsHtml({minTier:null})');
    assert.ok(h.includes('Rp99.000') && h.includes('Rp990.000') && h.includes('Rp690.000'), 'harga dari Google dipakai');
    assert.ok(!h.includes('Rp1.000.000') && !h.includes('Rp100.000'), 'harga tabel tidak dipakai lagi');
    assert.ok(h.includes('hemat Rp198.000'), 'hemat dihitung dari harga Google (99.000×12−990.000)');
    ok('PLAY: harga kartu paket mengikuti harga asli Google Play (getDetails), "hemat" ikut dihitung ulang');
    // paywall ikut diperbarui setelah harga termuat
    const pw = { innerHTML: 'lama' };
    const e2 = makeEnv({ play: true, details, paywallEl: pw });
    await run(e2, 'llkPlayLoadPrices()');
    assert.ok(pw.innerHTML.includes('Rp99.000') && pw.innerHTML.includes('Pulihkan Langganan'));
    ok('PLAY: paywall yang sudah terbuka diperbarui otomatis begitu harga Google termuat');
  }
  {
    const eUsd = makeEnv({ play: true, details: [{ itemId: 'llk_up_monthly', price: { currency: 'USD', value: '4.99' } }] });
    await run(eUsd, 'llkPlayLoadPrices()'); assert.ok(run(eUsd, 'planCardsHtml({minTier:null})').includes('Rp75.000'));
    const eNone = makeEnv({ play: true, noService: true });
    await run(eNone, 'llkPlayLoadPrices()'); assert.ok(run(eNone, 'planCardsHtml({minTier:null})').includes('Rp100.000'));
    const eEmpty = makeEnv({ play: true, details: [] });
    await run(eEmpty, 'llkPlayLoadPrices()'); assert.ok(run(eEmpty, 'planCardsHtml({minTier:null})').includes('Rp75.000'));
    ok('PLAY: mata uang bukan IDR / layanan tidak ada / produk kosong → pakai harga tabel (tidak error)');
    const eWeb = makeEnv({ play: false, details: [{ itemId: 'llk_up_monthly', price: { currency: 'IDR', value: '1' } }] });
    vm.runInContext('_llkPlayPrices={llk_up_monthly:{currency:"IDR",value:1}}', eWeb.ctx);
    assert.ok(run(eWeb, 'planCardsHtml({minTier:null})').includes('Rp75.000'));
    ok('WEBSITE: harga Google tidak pernah dipakai di luar aplikasi Play');
  }
  // ── Penjaga dobel-tagih ──
  {
    const e = makeEnv({ paidActive: true, source: null, endsMs: Date.now() + 864e5 });
    await run(e, "llkPlayBuy('unlimited_monthly')");
    assert.strictEqual(e.log.pr, 0); assert.strictEqual(e.log.calls.length, 0);
    const html1 = e.log.els.map((x) => x.innerHTML).join(' ');
    assert.ok(/masih aktif/.test(html1) && /12 Des 2026/.test(html1) && /dua kali/.test(html1));
    assert.ok(!/website|midtrans|diskon|situs|browser|leslesanku/i.test(html1), 'pesan harus netral, tanpa mengarahkan ke cara bayar lain');
    ok('PLAY: pelanggan website/Midtrans yang masih aktif → pembelian Play dicegah, pesan netral (tanpa menyebut website/diskon)');
  }
  {
    const e = makeEnv({ paidActive: true, tester: true });
    await run(e, "llkPlayBuy('up_monthly')");
    assert.strictEqual(e.log.pr, 1); ok('PLAY: akun tester tetap boleh uji beli');
    const e2 = makeEnv({ paidActive: false });
    await run(e2, "llkPlayBuy('up_monthly')");
    assert.strictEqual(e2.log.pr, 1); ok('PLAY: langganan website sudah habis / trial → boleh beli lewat Play');
    const e3 = makeEnv({ paidActive: true, source: 'play' });
    await run(e3, "llkPlayBuy('up_monthly')");
    assert.strictEqual(e3.log.pr, 0);
    ok('PLAY: sudah berlangganan lewat Play → tidak membuat langganan kedua');
  }
  // ── Petunjuk mengganti paket (penggantian langsung belum tersedia di aplikasi) ──
  {
    const e = makeEnv({ paidActive: true, source: 'play', tier: 'basic', endsMs: Date.now() + 864e5, autoRenew: true });
    await run(e, "llkPlayBuy('up_monthly')");
    const t = e.log.els.map((x) => x.innerHTML).join(' ');
    assert.strictEqual(e.log.pr, 0);
    assert.ok(/Pro Basic/.test(t) && /12 Des 2026/.test(t) && /Batalkan langganan/.test(t) && /Play Store/.test(t) && /mengganti paket/i.test(t));
    ok('PLAY: masih berlangganan → petunjuk jelas: batalkan di Play Store, paket tetap aktif sampai tanggal, lalu pilih paket baru');
    const e2 = makeEnv({ paidActive: true, source: 'play', tier: 'up', endsMs: Date.now() + 864e5, autoRenew: false });
    await run(e2, "llkPlayBuy('unlimited_monthly')");
    const t2 = e2.log.els.map((x) => x.innerHTML).join(' ');
    assert.ok(/sudah dibatalkan/.test(t2) && /tetap aktif/.test(t2) && /Pro Up/.test(t2) && /12 Des 2026/.test(t2));
    assert.ok(!/Batalkan langganan/.test(t2), 'yang sudah dibatalkan tidak disuruh membatalkan lagi');
    ok('PLAY: sudah dibatalkan → pesan "tetap aktif sampai tanggal, lalu bisa pilih paket baru" (tidak disuruh batalkan lagi)');
  }
  // ── Catatan pajak hanya di aplikasi Play ──
  {
    const ep = makeEnv({ play: true }), ew = makeEnv({ play: false });
    assert.ok(/belum termasuk pajak/i.test(run(ep, 'planCardsHtml({minTier:null})')));
    assert.ok(!/pajak/i.test(run(ew, 'planCardsHtml({minTier:null})')));
    ok('PLAY: kartu paket memberi catatan "harga belum termasuk pajak (PPN)"; website tidak');
  }
  console.log('\nSemua ' + n + ' pemeriksaan lolos');
})().catch((e) => { console.error('GAGAL:', e && e.stack || e); process.exit(1); });
