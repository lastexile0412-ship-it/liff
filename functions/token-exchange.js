// /functions/token-exchange.js  (Cloudflare Pages Functions - Module syntax)

export async function onRequestPost({ request, env }) {
  try {
    const { idToken, displayName, pictureUrl, email } = await request.json();
    if (!idToken) return json({ error: 'MISSING_ID_TOKEN' }, 400);

    // 1) 驗證 LINE ID Token
    const verifyRes = await fetch('https://api.line.me/oauth2/v2.1/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        id_token: idToken,
        client_id: env.LINE_LOGIN_CHANNEL_ID, // 你的 LINE Login channel id
      }),
    });
    const verify = await verifyRes.json();
    if (!verify.sub) {
      return json({ error: 'LINE_VERIFY_FAIL', detail: verify }, 401);
    }

    const line_user_id = verify.sub;

    // 2) upsert members（用 Supabase Service Role)
    const memberPayload = {
      line_user_id,
      display_name: displayName ?? verify.name ?? null,
      picture_url: pictureUrl ?? verify.picture ?? null,
      email: email ?? verify.email ?? null,
    };

    const upsertRes = await fetch(`${env.SUPABASE_URL}/rest/v1/members`, {
      method: 'POST',
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates',
      },
      body: JSON.stringify([memberPayload]),
    });

    if (!upsertRes.ok) {
      const t = await upsertRes.text();
      return json({ error: 'UPSERT_MEMBER_FAIL', detail: t }, 500);
    }

    // 3) 簽出 Supabase RLS 用 JWT（HS256）
    const payload = {
      // 讓 RLS 可讀到
      line_user_id,
      role: 'member',
      // 標準欄位（避開過期）
      exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7, // 7天
      iat: Math.floor(Date.now() / 1000),
    };

    const token = await signHS256(payload, env.SUPABASE_JWT_SECRET);

    return json({ token });
  } catch (e) {
    return json({ error: 'SERVER_ERROR', detail: String(e) }, 500);
  }
}

// 小工具：回傳 JSON
function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// 使用 WebCrypto 產生 HS256 JWT（Workers 環境可用）
async function signHS256(payload, secret) {
  const enc = new TextEncoder();
  const header = { alg: 'HS256', typ: 'JWT' };
  const base64url = (buf) =>
    btoa(String.fromCharCode(...new Uint8Array(buf)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

  const headerData = enc.encode(JSON.stringify(header));
  const payloadData = enc.encode(JSON.stringify(payload));

  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const unsigned = `${base64url(headerData)}.${base64url(payloadData)}`;
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(unsigned));

  return `${unsigned}.${base64url(sig)}`;
}
