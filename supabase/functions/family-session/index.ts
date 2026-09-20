/**
 * Issue a family@oqariq.family session after verifying the shared family
 * password hash. Soft-unlock stays anon (birth_date only); full editors need JWT.
 */
import { corsHeaders, jsonResponse, requireEnv } from '../_shared/telegram.ts';

const FAMILY_EMAIL = 'family@oqariq.family';
/** Same SHA-256 as src/config/access.ts editorHash — override with FAMILY_PASSWORD_HASH. */
const DEFAULT_EDITOR_HASH =
  '7fcc57f15a0a35995b1ef5fe78808863346e806aa2b86128c48c0133749c7586';

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i)! ^ b.charCodeAt(i)!;
  return diff === 0;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return jsonResponse({ ok: false, error: 'method' }, 405);
  }

  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const password = typeof body.password === 'string' ? body.password : '';
    if (!password || password.length > 200) {
      return jsonResponse({ ok: false, error: 'password' }, 400);
    }

    const expected = (Deno.env.get('FAMILY_PASSWORD_HASH') || DEFAULT_EDITOR_HASH).toLowerCase();
    const got = (await sha256Hex(password)).toLowerCase();
    if (!timingSafeEqual(got, expected)) {
      return jsonResponse({ ok: false, error: 'password' }, 401);
    }

    const url = requireEnv('SUPABASE_URL').replace(/\/$/, '');
    const serviceKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
    const res = await fetch(`${url}/auth/v1/admin/generate_link`, {
      method: 'POST',
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'magiclink',
        email: FAMILY_EMAIL,
      }),
    });
    const payload = (await res.json().catch(() => ({}))) as {
      hashed_token?: string;
      email_otp?: string;
      properties?: { hashed_token?: string };
      msg?: string;
      error?: string;
    };
    if (!res.ok) {
      console.error('generate_link failed', res.status, payload);
      return jsonResponse({ ok: false, error: 'auth_setup' }, 500);
    }
    const tokenHash =
      payload.hashed_token ||
      payload.properties?.hashed_token ||
      '';
    if (!tokenHash) {
      console.error('generate_link missing hashed_token', payload);
      return jsonResponse({ ok: false, error: 'auth_setup' }, 500);
    }

    return jsonResponse({ ok: true, token_hash: tokenHash, email: FAMILY_EMAIL });
  } catch (err) {
    console.error('family-session failed', err);
    return jsonResponse({ ok: false, error: 'failed' }, 500);
  }
});
