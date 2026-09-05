/** Load motif image bytes (embedded files, or the birthday_card_motifs table). */

export type CardMotifId = 'balloons' | 'flowers' | 'cars' | 'coins';

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

const cache = new Map<CardMotifId, Uint8Array>();

async function loadEmbedded(id: CardMotifId): Promise<Uint8Array | null> {
  try {
    let b64 = '';
    if (id === 'balloons') b64 = (await import('./motifs/balloons.ts')).BALLOONS_B64;
    else if (id === 'flowers') b64 = (await import('./motifs/flowers.ts')).FLOWERS_B64;
    else if (id === 'cars') b64 = (await import('./motifs/cars.ts')).CARS_B64;
    else b64 = (await import('./motifs/coins.ts')).COINS_B64;
    if (!b64) return null;
    return b64ToBytes(b64);
  } catch {
    return null;
  }
}

async function loadFromTable(id: CardMotifId): Promise<Uint8Array> {
  const url = (Deno.env.get('SUPABASE_URL') || '').replace(/\/$/, '');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  if (!url || !key) throw new Error('motif store missing env');
  const res = await fetch(
    `${url}/rest/v1/birthday_card_motifs?id=eq.${encodeURIComponent(id)}&select=b64`,
    { headers: { apikey: key, Authorization: `Bearer ${key}` } },
  );
  if (!res.ok) throw new Error(`motif fetch ${id} ${res.status}`);
  const rows = (await res.json()) as { b64?: string }[];
  const b64 = rows[0]?.b64;
  if (!b64) throw new Error(`motif missing ${id}`);
  return b64ToBytes(b64);
}

export async function motifPngBytes(id: CardMotifId): Promise<Uint8Array> {
  let bytes = cache.get(id);
  if (!bytes) {
    bytes = (await loadEmbedded(id)) ?? (await loadFromTable(id));
    cache.set(id, bytes);
  }
  return bytes;
}
