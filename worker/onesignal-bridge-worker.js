/**
 * ═══════════════════════════════════════════════════════════════
 * JEMBATAN LLK ↔ ONESIGNAL — Cloudflare Worker (versi aman)
 * ═══════════════════════════════════════════════════════════════
 *
 * LLK (browser/HP) → Worker ini (memegang REST API Key rahasia) → OneSignal.
 *
 * KEAMANAN (baru):
 * - Worker HANYA melayani pengguna yang sedang login di LesLesanKu.
 *   Aplikasi mengirim token login Firebase (field `idToken` di body),
 *   dan worker memverifikasi tanda tangannya pakai kunci publik Google.
 *   Tanpa token yang sah → ditolak (401). Sebelumnya siapa pun bisa
 *   memanggil worker ini langsung (CORS tidak berlaku di luar browser)
 *   dan mengirim notifikasi berisi teks bebas ke HP pengguna LLK.
 * - Isi notifikasi dibatasi panjangnya & waktu kirimnya dibatasi
 *   (maks 60 hari ke depan) supaya tidak bisa disalahgunakan untuk spam.
 *
 * YANG PERLU ADA DI Settings → Variables and Secrets:
 *   ONESIGNAL_API_KEY   (secret, sudah ada)
 *   ONESIGNAL_APP_ID    (sudah ada)
 *   FIREBASE_PROJECT_ID (opsional — default 'llk-67a30')
 *
 * CARA DEPLOY: Workers & Pages → llk-onesignal-bridge → Edit code →
 * hapus semua kode lama → tempel seluruh isi file ini → Deploy.
 * ═══════════════════════════════════════════════════════════════
 */

// Alamat yang boleh memanggil worker dari browser. Alamat lama github.io tetap
// diizinkan selama masa pindah ke domain leslesanku.com.
const ALLOWED_ORIGINS = [
  'https://leslesanku.com',
  'https://www.leslesanku.com',
  'https://crestiantoferdian.github.io',
];
const GOOGLE_JWK_URL = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';
const MAX_TITLE = 120;
const MAX_MESSAGE = 500;
const MAX_FUTURE_MS = 60 * 24 * 60 * 60 * 1000; // 60 hari
const MAX_PAST_MS = 10 * 60 * 1000;             // toleransi 10 menit ke belakang

// Header CORS mengikuti alamat pemanggil kalau ada di daftar; selain itu
// dikembalikan alamat utama (browser akan menolak).
function corsHeadersFor(request) {
  const origin = request.headers.get('Origin') || '';
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin',
  };
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// ── Verifikasi token login Firebase (JWT RS256) ──────────────────
let _jwkCache = { keys: null, expiresAt: 0 };

async function getGoogleKeys(fetchImpl) {
  if (_jwkCache.keys && Date.now() < _jwkCache.expiresAt) return _jwkCache.keys;
  const res = await fetchImpl(GOOGLE_JWK_URL);
  if (!res.ok) throw new Error('Gagal mengambil kunci publik Google');
  const data = await res.json();
  const cc = res.headers.get('cache-control') || '';
  const m = cc.match(/max-age=(\d+)/);
  const ttl = m ? Number(m[1]) * 1000 : 60 * 60 * 1000;
  _jwkCache = { keys: data.keys || [], expiresAt: Date.now() + ttl };
  return _jwkCache.keys;
}

function b64urlToBytes(str) {
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((str.length + 3) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function b64urlToJson(str) {
  return JSON.parse(new TextDecoder().decode(b64urlToBytes(str)));
}

// Mengembalikan uid pengguna kalau token sah, atau melempar Error.
async function verifyFirebaseIdToken(token, projectId, fetchImpl = fetch, nowMs = Date.now()) {
  if (typeof token !== 'string' || token.split('.').length !== 3) throw new Error('token tidak valid');
  const [h, p, s] = token.split('.');
  const header = b64urlToJson(h);
  const payload = b64urlToJson(p);
  if (header.alg !== 'RS256' || !header.kid) throw new Error('algoritma token tidak didukung');

  const now = Math.floor(nowMs / 1000);
  if (payload.aud !== projectId) throw new Error('token bukan untuk project ini');
  if (payload.iss !== 'https://securetoken.google.com/' + projectId) throw new Error('penerbit token salah');
  if (!payload.sub || typeof payload.sub !== 'string') throw new Error('token tanpa uid');
  if (typeof payload.exp !== 'number' || payload.exp < now - 60) throw new Error('token kedaluwarsa');
  if (typeof payload.iat === 'number' && payload.iat > now + 300) throw new Error('waktu token tidak wajar');

  let keys = await getGoogleKeys(fetchImpl);
  let jwk = keys.find(k => k.kid === header.kid);
  if (!jwk) { // kunci Google baru dirotasi → ambil ulang sekali
    _jwkCache.expiresAt = 0;
    keys = await getGoogleKeys(fetchImpl);
    jwk = keys.find(k => k.kid === header.kid);
  }
  if (!jwk) throw new Error('kunci token tidak dikenal');

  const key = await crypto.subtle.importKey(
    'jwk', { kty: jwk.kty, n: jwk.n, e: jwk.e, alg: 'RS256', ext: true },
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']
  );
  const ok = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5', key, b64urlToBytes(s), new TextEncoder().encode(h + '.' + p)
  );
  if (!ok) throw new Error('tanda tangan token tidak sah');
  return payload.sub;
}

export default {
  _verifyFirebaseIdToken: verifyFirebaseIdToken, // untuk pengujian
  async fetch(request, env, ctx, fetchImpl = fetch) {
    const res = await handle(request, env, fetchImpl);
    for (const [k, v] of Object.entries(corsHeadersFor(request))) res.headers.set(k, v);
    return res;
  },
};

async function handle(request, env, fetchImpl) {
  // Preflight CORS dicek paling awal
  if (request.method === 'OPTIONS') return new Response(null);
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  let body;
  try { body = await request.json(); }
  catch (e) { return json({ error: 'Body harus JSON' }, 400); }

  // ── 1) Wajib login LesLesanKu ──
  const projectId = env.FIREBASE_PROJECT_ID || 'llk-67a30';
  let uid;
  try {
    uid = await verifyFirebaseIdToken(body.idToken, projectId, fetchImpl);
  } catch (err) {
    return json({ error: 'Tidak diizinkan: ' + err.message }, 401);
  }

  try {
    // ── 2a) Bersihkan SEMUA reminder jadwal les yang masih menunggu untuk
    //        1 perangkat, sampai batas waktu tertentu (biasanya akhir hari ini).
    //        Dipakai sebelum menjadwalkan ulang, supaya salinan lama yang ID-nya
    //        sudah tidak diingat aplikasi (penyebab notifikasi dobel) ikut hilang.
    //        Hanya notifikasi berjudul "🎵 …" (reminder les) yang disentuh —
    //        reminder masa trial dll tidak ikut terhapus.
    if (body.action === 'cleanup') {
      const sub = typeof body.subscriptionId === 'string' ? body.subscriptionId.trim() : '';
      if (!/^[0-9a-fA-F-]{8,64}$/.test(sub)) return json({ error: 'subscriptionId tidak valid' }, 400);
      const untilMs = Date.parse(body.until);
      const nowMs = Date.now();
      if (isNaN(untilMs) || untilMs < nowMs || untilMs > nowMs + 2 * 24 * 60 * 60 * 1000) {
        return json({ error: 'until harus antara sekarang dan 2 hari ke depan' }, 400);
      }
      let canceled = 0, checked = 0;
      for (let offset = 0; offset < 300; offset += 50) {
        const listRes = await fetchImpl(
          `https://api.onesignal.com/notifications?app_id=${env.ONESIGNAL_APP_ID}&limit=50&offset=${offset}&kind=1`,
          { headers: { Authorization: `Key ${env.ONESIGNAL_API_KEY}` } }
        );
        if (!listRes.ok) break;
        const page = await listRes.json().catch(() => ({}));
        const list = page.notifications || [];
        for (const n of list) {
          checked++;
          const ids = n.include_player_ids || n.include_subscription_ids || [];
          if (!ids.includes(sub) || n.canceled || n.completed_at) continue;
          const sendAtMs = (n.send_after || 0) * 1000;
          if (sendAtMs <= nowMs || sendAtMs > untilMs) continue;
          const heading = (n.headings && n.headings.en) || '';
          if (!heading.startsWith('🎵')) continue;
          const del = await fetchImpl(
            `https://api.onesignal.com/notifications/${n.id}?app_id=${env.ONESIGNAL_APP_ID}`,
            { method: 'DELETE', headers: { 'Content-Type': 'application/json', Authorization: `Key ${env.ONESIGNAL_API_KEY}` } }
          );
          if (del.ok) canceled++;
        }
        if (list.length < 50) break;
      }
      console.log('cleanup oleh uid', uid, 'dibatalkan', canceled);
      return json({ ok: true, canceled, checked });
    }

    // ── 2b) Batalkan 1 reminder yang sudah terjadwal ──
    if (body.action === 'cancel') {
      const id = String(body.notificationId || '');
      if (!/^[0-9a-fA-F-]{8,64}$/.test(id)) return json({ error: 'notificationId tidak valid' }, 400);
      const cancelRes = await fetchImpl(
        `https://api.onesignal.com/notifications/${id}?app_id=${env.ONESIGNAL_APP_ID}`,
        { method: 'DELETE', headers: { 'Content-Type': 'application/json', Authorization: `Key ${env.ONESIGNAL_API_KEY}` } }
      );
      const cancelResult = await cancelRes.json().catch(() => ({}));
      return json(cancelResult, cancelRes.status);
    }

    // ── 3) Jadwalkan reminder ──
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    const message = typeof body.message === 'string' ? body.message.trim() : '';
    const subscriptionId = typeof body.subscriptionId === 'string' ? body.subscriptionId.trim() : '';
    if (!title || !body.send_after) return json({ error: 'title dan send_after wajib diisi' }, 400);
    if (title.length > MAX_TITLE || message.length > MAX_MESSAGE) return json({ error: 'Judul/isi notifikasi terlalu panjang' }, 400);
    if (!/^[0-9a-fA-F-]{8,64}$/.test(subscriptionId)) {
      return json({ error: 'subscriptionId wajib diisi — device pengirim belum terdaftar dengan benar' }, 400);
    }
    const sendAtMs = Date.parse(body.send_after);
    if (isNaN(sendAtMs)) return json({ error: 'send_after bukan format tanggal yang valid' }, 400);
    const nowMs = Date.now();
    if (sendAtMs < nowMs - MAX_PAST_MS || sendAtMs > nowMs + MAX_FUTURE_MS) {
      return json({ error: 'send_after harus antara sekarang dan 60 hari ke depan' }, 400);
    }

    const payload = {
      app_id: env.ONESIGNAL_APP_ID,
      headings: { en: title },
      contents: { en: message || title },
      send_after: new Date(sendAtMs).toISOString(),
      priority: 10,
      include_subscription_ids: [subscriptionId], // hanya ke device pengirim
    };

    const osResponse = await fetchImpl('https://api.onesignal.com/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Key ${env.ONESIGNAL_API_KEY}` },
      body: JSON.stringify(payload),
    });
    const osResult = await osResponse.json().catch(() => ({}));

    let warning = null;
    if (osResponse.ok && typeof osResult.recipients === 'number' && osResult.recipients === 0) {
      warning = 'Request diterima OneSignal tapi recipients=0 — device belum benar-benar subscribe.';
    }
    console.log('reminder dijadwalkan oleh uid', uid, 'status', osResponse.status);
    return json({ ...osResult, warning }, osResponse.status);
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}
