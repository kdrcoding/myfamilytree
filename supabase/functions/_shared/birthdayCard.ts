/**
 * Birthday card PNG for Telegram sendPhoto.
 * Motifs are PNG pictures (ImageScript-native). WebP portraits use esm.sh,
 * never npm: specifiers — those break when the function is compiled on Edge.
 */
import { Image } from 'https://deno.land/x/imagescript@1.3.0/mod.ts';
import { motifPngBytes, type CardMotifId } from './cardMotifs.ts';
import { CARD_PALETTES, normalizeCardGender, type CardGender, type CardPalette } from './cardTheme.ts';

type Img = InstanceType<typeof Image>;

const W = 1080;
const H = 720;
/** Bigger face — hero of the card, not a tiny memorial orb. */
const PHOTO_SIZE = 288;
const PHOTO_X = Math.round((W - PHOTO_SIZE) / 2);
const PHOTO_Y = 78;
const PHOTO_CX = Math.round(W / 2);
const PHOTO_CY = PHOTO_Y + Math.round(PHOTO_SIZE / 2);

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function truncate(s: string, max: number): string {
  const t = s.trim();
  return t.length > max ? t.slice(0, max - 1) + '…' : t;
}

const CYR_LATIN: Record<string, string> = {
  А: 'A',
  Б: 'B',
  В: 'V',
  Г: 'G',
  Ғ: 'G',
  Д: 'D',
  Е: 'E',
  Ё: 'Yo',
  Ж: 'J',
  З: 'Z',
  И: 'I',
  Й: 'Y',
  К: 'K',
  Қ: 'Q',
  Л: 'L',
  М: 'M',
  Н: 'N',
  О: 'O',
  Ў: 'O',
  П: 'P',
  Р: 'R',
  С: 'S',
  Т: 'T',
  У: 'U',
  Ф: 'F',
  Х: 'X',
  Ҳ: 'H',
  Ц: 'Ts',
  Ч: 'Ch',
  Ш: 'Sh',
  Щ: 'Sh',
  Ъ: '',
  Ы: 'Y',
  Ь: '',
  Э: 'E',
  Ю: 'Yu',
  Я: 'Ya',
};

function cyrToLatinChar(ch: string): string {
  const upper = ch.toUpperCase();
  const mapped = CYR_LATIN[upper];
  if (mapped == null) return ch;
  if (ch === upper) return mapped;
  if (mapped.length <= 1) return mapped.toLowerCase();
  return mapped[0]!.toLowerCase() + mapped.slice(1);
}

export function cardPrintableName(name: string): string {
  if (!/[\u0400-\u04FF]/.test(name)) return name;
  return name.replace(/[\u0400-\u04FF]/g, cyrToLatinChar);
}

function isWebp(buf: Uint8Array): boolean {
  return (
    buf.length >= 12 &&
    buf[0] === 0x52 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x46 &&
    buf[8] === 0x57 &&
    buf[9] === 0x45 &&
    buf[10] === 0x42 &&
    buf[11] === 0x50
  );
}

function coverSquare(img: Img, size: number): Img {
  const cover = (img as { cover?: (w: number, h: number) => Img }).cover;
  if (typeof cover === 'function') return cover.call(img, size, size);
  const scale = Math.max(size / img.width, size / img.height);
  img.resize(Math.max(1, Math.round(img.width * scale)), Math.max(1, Math.round(img.height * scale)));
  const x = Math.max(0, Math.floor((img.width - size) / 2));
  const y = Math.max(0, Math.floor((img.height - size) / 2));
  return img.crop(x, y, Math.min(size, img.width), Math.min(size, img.height));
}

function ensureImageDataPolyfill(): void {
  const g = globalThis as unknown as { ImageData?: unknown };
  if (typeof g.ImageData === 'function') return;
  g.ImageData = class ImageData {
    readonly data: Uint8ClampedArray;
    readonly width: number;
    readonly height: number;
    readonly colorSpace = 'srgb';
    constructor(
      dataOrWidth: Uint8ClampedArray | number,
      widthOrHeight?: number,
      maybeHeight?: number,
    ) {
      if (typeof dataOrWidth === 'number') {
        this.width = dataOrWidth;
        this.height = widthOrHeight ?? 0;
        this.data = new Uint8ClampedArray(this.width * this.height * 4);
      } else {
        this.data = dataOrWidth;
        this.width = widthOrHeight ?? 0;
        this.height =
          maybeHeight ?? Math.max(0, Math.floor(dataOrWidth.length / 4 / Math.max(1, this.width)));
      }
    }
  };
}

type WebpDecoded = { width: number; height: number; data: Uint8ClampedArray | Uint8Array };
let webpDecodeFn: ((data: ArrayBuffer) => Promise<WebpDecoded>) | null = null;

async function getWebpDecode(): Promise<(data: ArrayBuffer) => Promise<WebpDecoded>> {
  if (webpDecodeFn) return webpDecodeFn;
  ensureImageDataPolyfill();
  // esm.sh works on Edge. npm: specifiers fail when shared files are remote-imported.
  const specifiers = [
    'https://esm.sh/@jsquash/webp@1.4.0/decode?target=denonext',
    'https://esm.sh/@jsquash/webp@1.4.0/decode',
  ];
  let last = 'webp decoder missing';
  for (const spec of specifiers) {
    try {
      const mod = (await import(spec)) as {
        default: (data: ArrayBuffer) => Promise<WebpDecoded>;
        init?: (module?: WebAssembly.Module) => Promise<void>;
      };
      const wasmUrls = [
        'https://esm.sh/@jsquash/webp@1.4.0/codec/dec/webp_dec.wasm',
        'https://unpkg.com/@jsquash/webp@1.4.0/codec/dec/webp_dec.wasm',
      ];
      if (typeof mod.init === 'function') {
        for (const wasmUrl of wasmUrls) {
          try {
            const wasmRes = await fetch(wasmUrl);
            if (!wasmRes.ok) continue;
            await mod.init(await WebAssembly.compile(await wasmRes.arrayBuffer()));
            break;
          } catch {
            /* try next wasm host */
          }
        }
      }
      webpDecodeFn = mod.default;
      return webpDecodeFn;
    } catch (err) {
      last = err instanceof Error ? err.message : String(err);
    }
  }
  throw new Error(last);
}

async function decodeWebpBytes(buf: Uint8Array): Promise<Img | null> {
  const copy = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
  const decodeWebp = await getWebpDecode();
  const decoded = await decodeWebp(copy);
  const img = new Image(decoded.width, decoded.height);
  const pixels = decoded.data;
  img.bitmap.set(new Uint8Array(pixels.buffer, pixels.byteOffset, pixels.byteLength));
  return img;
}

async function decodePhoto(buf: Uint8Array): Promise<Img | null> {
  try {
    return await Image.decode(buf);
  } catch {
    /* JPEG/PNG failed — try WebP */
  }
  if (isWebp(buf)) {
    try {
      return await decodeWebpBytes(buf);
    } catch (err) {
      console.error('webp photo decode failed', err);
      return null;
    }
  }
  console.warn('photo decode failed');
  return null;
}

function punchCircle(img: Img): void {
  const cx = img.width / 2;
  const cy = img.height / 2;
  const r2 = (Math.min(img.width, img.height) / 2) ** 2;
  const data = img.bitmap;
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      if (dx * dx + dy * dy > r2) data[(y * img.width + x) * 4 + 3] = 0;
    }
  }
}

async function decodePortrait(bytes: Uint8Array): Promise<Img | null> {
  const img = await decodePhoto(bytes);
  if (!img) return null;
  try {
    const sized = coverSquare(img, PHOTO_SIZE);
    const cropCircle = (sized as { cropCircle?: (feather?: boolean, padding?: number) => Img }).cropCircle;
    if (typeof cropCircle === 'function') cropCircle.call(sized, false, 0);
    else punchCircle(sized);
    return sized;
  } catch (err) {
    console.warn('birthday card photo crop failed', err);
    return null;
  }
}

async function fetchPhotoBytes(photoUrl?: string | null): Promise<Uint8Array | null> {
  if (!photoUrl || !/^https?:/i.test(photoUrl)) return null;
  try {
    const res = await fetch(photoUrl);
    if (!res.ok) return null;
    const buf = new Uint8Array(await res.arrayBuffer());
    return buf.byteLength > 32 ? buf : null;
  } catch {
    return null;
  }
}

type MotifSpot = { id: CardMotifId; x: number; y: number; w: number };

function motifSpots(gender: CardGender, simple: boolean): MotifSpot[] {
  // Keep motifs in the corners — never crowding the face (that “in the clouds” look).
  const grow = simple ? 28 : 0;
  if (gender === 'female') {
    return [
      { id: 'balloons', x: 8, y: 12, w: 220 + grow },
      { id: 'balloons', x: 850 - grow, y: 8, w: 210 + grow },
      { id: 'flowers', x: 8, y: 470, w: 240 + grow },
      { id: 'flowers', x: 830 - grow, y: 460, w: 240 + grow },
    ];
  }
  if (gender === 'male') {
    return [
      { id: 'coins', x: 8, y: 16, w: 200 + grow },
      { id: 'coins', x: 860 - grow, y: 12, w: 200 + grow },
      { id: 'cars', x: 4, y: 470, w: 280 + grow },
      { id: 'cars', x: 780 - grow, y: 470, w: 280 + grow },
    ];
  }
  return [
    { id: 'balloons', x: 8, y: 12, w: 200 + grow },
    { id: 'coins', x: 860 - grow, y: 12, w: 190 + grow },
    { id: 'flowers', x: 8, y: 480, w: 210 + grow },
    { id: 'cars', x: 840 - grow, y: 470, w: 220 + grow },
  ];
}

const motifCache = new Map<CardMotifId, Img>();

async function decodeMotif(id: CardMotifId): Promise<Img> {
  let img = motifCache.get(id);
  if (!img) {
    img = await decodePhoto(await motifPngBytes(id));
    if (!img) throw new Error(`motif decode failed: ${id}`);
    motifCache.set(id, img);
  }
  return img;
}

function cloneImg(img: Img): Img {
  const clone = (img as { clone?: () => Img }).clone;
  if (typeof clone === 'function') return clone.call(img);
  const copy = new Image(img.width, img.height);
  copy.bitmap.set(img.bitmap);
  return copy;
}

function scaledToWidth(img: Img, width: number): Img {
  const copy = cloneImg(img);
  const w = Math.max(1, Math.round(width));
  const h = Math.max(1, Math.round((copy.height * w) / copy.width));
  copy.resize(w, h);
  return copy;
}

async function compositeMotifs(raster: Img, gender: CardGender, simple: boolean): Promise<number> {
  const spots = motifSpots(gender, simple);
  let placed = 0;
  for (const spot of spots) {
    try {
      const src = scaledToWidth(await decodeMotif(spot.id), spot.w);
      const x = Math.max(0, Math.min(raster.width - 2, Math.round(spot.x)));
      const y = Math.max(0, Math.min(raster.height - 2, Math.round(spot.y)));
      raster.composite(src, x, y);
      placed++;
    } catch (err) {
      console.warn('motif composite failed', spot.id, err);
    }
  }
  if (placed === 0) throw new Error('no themed pictures composited');
  return placed;
}

function hexToColor(hex: string): number {
  const n = hex.replace('#', '');
  const r = parseInt(n.slice(0, 2), 16);
  const g = parseInt(n.slice(2, 4), 16);
  const b = parseInt(n.slice(4, 6), 16);
  const rgbaToColor = (
    Image as unknown as { rgbaToColor?: (r: number, g: number, b: number, a: number) => number }
  ).rgbaToColor;
  if (typeof rgbaToColor === 'function') return rgbaToColor(r, g, b, 255);
  return ((r << 24) | (g << 16) | (b << 8) | 255) >>> 0;
}

function paintFallbackCanvas(p: CardPalette): Img {
  const raster = new Image(W, H);
  raster.fill(hexToColor(p.bgB));
  const panel = new Image(980, 620);
  panel.fill(hexToColor(p.cardA));
  raster.composite(panel, 50, 50);
  const bar = new Image(980, 22);
  bar.fill(hexToColor(p.accent));
  raster.composite(bar, 50, 50);
  return raster;
}

function partyConfetti(p: CardPalette): string {
  // Opaque chips only — no soft haze / “heaven cloud” smudges.
  const bits: string[] = [];
  const colors = p.confetti;
  const spots: [number, number, number, number][] = [
    [120, 70, 14, 0],
    [200, 110, 10, 1],
    [880, 80, 12, 2],
    [960, 120, 16, 3],
    [140, 560, 12, 1],
    [940, 540, 14, 0],
    [300, 95, 8, 3],
    [780, 100, 9, 2],
  ];
  for (const [x, y, r, ci] of spots) {
    bits.push(`<circle cx="${x}" cy="${y}" r="${r}" fill="${colors[ci]}"/>`);
  }
  const rects: [number, number, number, number, number, number][] = [
    [160, 160, 18, 8, 25, 0],
    [900, 170, 16, 8, -20, 2],
    [240, 540, 20, 8, 15, 1],
    [820, 520, 18, 8, -12, 3],
  ];
  for (const [x, y, w, h, rot, ci] of rects) {
    bits.push(
      `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="2" fill="${colors[ci]}" transform="rotate(${rot} ${x + w / 2} ${y + h / 2})"/>`,
    );
  }
  return bits.join('\n  ');
}

function cakeIcon(cx: number, cy: number, p: CardPalette): string {
  return `
    <rect x="${cx - 36}" y="${cy - 8}" width="72" height="44" rx="8" fill="${p.accent}"/>
    <rect x="${cx - 28}" y="${cy - 28}" width="56" height="28" rx="6" fill="${p.accentSoft}"/>
    <rect x="${cx - 8}" y="${cy - 48}" width="6" height="22" rx="2" fill="${p.confetti[1]}"/>
    <rect x="${cx + 2}" y="${cy - 52}" width="6" height="26" rx="2" fill="${p.confetti[0]}"/>
    <rect x="${cx + 12}" y="${cy - 46}" width="6" height="20" rx="2" fill="${p.confetti[2]}"/>
    <circle cx="${cx - 5}" cy="${cy - 52}" r="5" fill="${p.confetti[3]}"/>
    <circle cx="${cx + 5}" cy="${cy - 56}" r="5" fill="#fbbf24"/>
    <circle cx="${cx + 15}" cy="${cy - 50}" r="5" fill="${p.confetti[1]}"/>
  `;
}

function cardSvg(opts: {
  p: CardPalette;
  name: string;
  ageLine: string;
  portrait: Img | null;
  simple: boolean;
  whoLine?: string;
  headline?: string;
}): string {
  const { p, name, ageLine, portrait, simple, whoLine } = opts;
  const headline = opts.headline?.trim() || 'Tug‘ilgan kuningiz muborak';
  const rOuter = Math.round(PHOTO_SIZE / 2) + 22;
  const rMid = Math.round(PHOTO_SIZE / 2) + 12;
  const rInner = Math.round(PHOTO_SIZE / 2) + 4;
  const photoBlock = portrait
    ? `
      <!-- Solid party frame (no soft halo — that looked memorial / cloudy) -->
      <circle cx="${PHOTO_CX + 6}" cy="${PHOTO_CY + 8}" r="${rOuter}" fill="#0f172a"/>
      <circle cx="${PHOTO_CX}" cy="${PHOTO_CY}" r="${rOuter}" fill="#fbbf24"/>
      <circle cx="${PHOTO_CX}" cy="${PHOTO_CY}" r="${rMid}" fill="#ffffff"/>
      <circle cx="${PHOTO_CX}" cy="${PHOTO_CY}" r="${rInner}" fill="${p.accent}"/>
      <circle cx="${PHOTO_CX}" cy="${PHOTO_CY}" r="${Math.round(PHOTO_SIZE / 2)}" fill="#ffffff"/>
    `
    : `
      <circle cx="${PHOTO_CX + 6}" cy="${PHOTO_CY + 8}" r="118" fill="#0f172a"/>
      <circle cx="${PHOTO_CX}" cy="${PHOTO_CY}" r="118" fill="#fbbf24"/>
      <circle cx="${PHOTO_CX}" cy="${PHOTO_CY}" r="108" fill="#ffffff"/>
      <circle cx="${PHOTO_CX}" cy="${PHOTO_CY}" r="98" fill="${p.accent}"/>
      ${cakeIcon(PHOTO_CX, PHOTO_CY + 8, p)}
    `;
  const nameY = portrait ? 430 : 410;
  const whoY = nameY + 34;
  const ageY = (whoLine ? whoY + 36 : nameY + 40);
  const extras = simple ? '' : partyConfetti(p);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${p.bgA}"/>
      <stop offset="55%" stop-color="${p.bgB}"/>
      <stop offset="100%" stop-color="${p.bgC}"/>
    <\/linearGradient>
    <linearGradient id="card" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="100%" stop-color="${p.cardA}"/>
    <\/linearGradient>
  <\/defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  ${extras}
  <rect x="40" y="36" width="1000" height="648" rx="40" fill="url(#card)"/>
  <rect x="40" y="36" width="1000" height="18" rx="6" fill="${p.accent}"/>
  <rect x="40" y="656" width="1000" height="28" rx="6" fill="${p.accent}"/>
  ${photoBlock}
  <text x="540" y="${nameY - 44}" text-anchor="middle" font-family="system-ui, -apple-system, 'Segoe UI', sans-serif" font-size="26" font-weight="700" fill="${p.accent}" letter-spacing="1">${headline}</text>
  <text x="540" y="${nameY}" text-anchor="middle" font-family="system-ui, -apple-system, 'Segoe UI', sans-serif" font-size="54" font-weight="800" fill="${p.ink}">${name}</text>
  ${whoLine ? `<text x="540" y="${whoY}" text-anchor="middle" font-family="system-ui, sans-serif" font-size="22" fill="${p.muted}">${whoLine}</text>` : ''}
  <text x="540" y="${ageY}" text-anchor="middle" font-family="system-ui, sans-serif" font-size="28" font-weight="700" fill="${p.accent}">${ageLine}</text>
  <text x="540" y="674" text-anchor="middle" font-family="system-ui, sans-serif" font-size="20" font-weight="600" fill="#ffffff">Oq-Ariq OILASI · bayram!</text>
<\/svg>`;
}

export type BirthdayCardOpts = {
  name: string;
  age: number | null;
  photoUrl?: string | null;
  photoBytes?: Uint8Array | null;
  gender?: string | null;
  designSeed?: string;
  simple?: boolean;
  whoLine?: string | null;
  /** Override the top greeting (default: Tug‘ilgan kuningiz muborak). */
  headline?: string | null;
  /** Override the age line under the name (e.g. upcoming “in 5 days”). */
  subtitle?: string | null;
};

async function renderCardBase(opts: {
  p: CardPalette;
  name: string;
  ageLine: string;
  portrait: Img | null;
  simple: boolean;
  whoLine?: string;
  headline?: string;
}): Promise<Img> {
  const svg = cardSvg(opts);
  try {
    return await Image.renderSVG(svg, 1, Image.SVG_MODE_SCALE);
  } catch (err) {
    console.warn('birthday card SVG render failed, using painted fallback', err);
    return paintFallbackCanvas(opts.p);
  }
}

export async function buildBirthdayCardPng(opts: BirthdayCardOpts): Promise<Uint8Array> {
  const gender: CardGender = normalizeCardGender(opts.gender);
  const p = CARD_PALETTES[gender];
  const printable = cardPrintableName(opts.name);
  const name = escapeXml(truncate(printable, 28));
  const ageLine = escapeXml(
    opts.subtitle?.trim()
      ? truncate(opts.subtitle.trim(), 48)
      : opts.age != null
        ? `Bugun ${opts.age} yosh`
        : 'Oila sizni tabriklaydi',
  );
  const headline = escapeXml(
    truncate(opts.headline?.trim() || 'Tug‘ilgan kuningiz muborak', 40),
  );
  const simple = Boolean(opts.simple);

  let portrait: Img | null = null;
  const bytes = opts.photoBytes ?? (await fetchPhotoBytes(opts.photoUrl));
  if (bytes) portrait = await decodePortrait(bytes);

  const whoLine = opts.whoLine?.trim()
    ? escapeXml(truncate(opts.whoLine.trim(), 42))
    : '';
  const raster = await renderCardBase({ p, name, ageLine, portrait, simple, whoLine, headline });
  try {
    await compositeMotifs(raster, gender, simple);
  } catch (err) {
    console.error('themed pictures failed; sending card without them', err);
  }
  if (portrait) {
    try {
      raster.composite(portrait, PHOTO_X, PHOTO_Y);
    } catch (err) {
      console.warn('birthday card photo composite failed', err);
    }
  }
  return await raster.encode();
}
