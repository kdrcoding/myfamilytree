/**
 * Signed missing-dates page links for Telegram.
 * Format: v1.<expUnix>.<base64url(HMAC-SHA256(secret, "dates-link:v1:"+exp))>
 * Valid for DATES_LINK_TTL_MS from mint time. Bare /dates without a token is locked.
 */

export const DATES_LINK_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function datesLinkSecret(): string | null {
  return Deno.env.get('DATES_LINK_SECRET') || Deno.env.get('TELEGRAM_CRON_SECRET') || null;
}

function b64url(bytes: ArrayBuffer | Uint8Array): string {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let bin = '';
  for (let i = 0; i < u8.length; i++) bin += String.fromCharCode(u8[i]!);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i)! ^ b.charCodeAt(i)!;
  return diff === 0;
}

async function hmacSign(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  return b64url(sig);
}

/** Mint a new token that expires in 7 days. */
export async function createDatesLinkToken(nowMs = Date.now()): Promise<string> {
  const secret = datesLinkSecret();
  if (!secret) throw new Error('DATES_LINK_SECRET or TELEGRAM_CRON_SECRET missing');
  const exp = Math.floor((nowMs + DATES_LINK_TTL_MS) / 1000);
  const sig = await hmacSign(secret, `dates-link:v1:${exp}`);
  return `v1.${exp}.${sig}`;
}

/** True when token is well-formed, signature matches, and not expired. */
export async function verifyDatesLinkToken(
  token: string | null | undefined,
  nowMs = Date.now(),
): Promise<boolean> {
  const secret = datesLinkSecret();
  if (!secret) return false;
  const raw = (token ?? '').trim();
  const m = /^v1\.(\d{9,12})\.([A-Za-z0-9_-]{20,100})$/.exec(raw);
  if (!m) return false;
  const exp = Number(m[1]);
  if (!Number.isFinite(exp) || exp * 1000 < nowMs) return false;
  // Reject absurd far-future tokens (mint skew / clock abuse).
  if (exp * 1000 > nowMs + DATES_LINK_TTL_MS + 60_000) return false;
  const expected = await hmacSign(secret, `dates-link:v1:${exp}`);
  return timingSafeEqual(m[2]!, expected);
}
