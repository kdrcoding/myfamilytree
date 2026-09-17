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
const PHOTO_SIZE = 220;
const PHOTO_X = 430;
const PHOTO_Y = 118;

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
    if (typeof cropCircle === 'function') cropCircle.call(sized, false, 2);
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
  const grow = simple ? 36 : 0;
  if (gender === 'female') {
    return [
      { id: 'balloons', x: 18, y: 28, w: 280 + grow },
      { id: 'balloons', x: 790 - grow, y: 18, w: 270 + grow },
      { id: 'flowers', x: 12, y: 430, w: 300 + grow },
      { id: 'flowers', x: 770 - grow, y: 420, w: 300 + grow },
    ];
  }
  if (gender === 'male') {
    return [
      { id: 'coins', x: 16, y: 32, w: 250 + grow },
      { id: 'coins', x: 810 - grow, y: 24, w: 250 + grow },
      { id: 'cars', x: 8, y: 430, w: 360 + grow },
      { id: 'cars', x: 710 - grow, y: 430, w: 360 + grow },
    ];
  }
  return [
    { id: 'balloons', x: 16, y: 28, w: 240 + grow },
    { id: 'coins', x: 820 - grow, y: 24, w: 230 + grow },
    { id: 'flowers', x: 12, y: 440, w: 260 + grow },
    { id: 'cars', x: 780 - grow, y: 430, w: 280 + grow },
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

function cardSvg(opts: {
  p: CardPalette;
  name: string;
  ageLine: string;
  portrait: Img | null;
  simple: boolean;
  whoLine?: string;
}): string {
  const { p, name, ageLine, portrait, simple, whoLine } = opts;
  const photoBlock = portrait
    ? `
      <circle cx="540" cy="228" r="128" fill="#fbbf24" opacity="0.55"/>
      <circle cx="540" cy="228" r="118" fill="${p.accent}" opacity="0.35"/>
      <circle cx="540" cy="228" r="110" fill="${p.accentSoft}"/>
      <circle cx="540" cy="228" r="102" fill="#fff7ed"/>
    `
    : `
      <circle cx="540" cy="210" r="100" fill="#fbbf24" opacity="0.35"/>
      <circle cx="540" cy="210" r="88" fill="${p.accent}"/>
      <circle cx="540" cy="210" r="74" fill="${p.accentSoft}" opacity="0.55"/>
      <ellipse cx="540" cy="198" rx="34" ry="30" fill="#fef3c7"/>
      <rect x="520" y="222" width="40" height="28" rx="8" fill="#fef3c7"/>
      <rect x="528" y="214" width="8" height="14" rx="2" fill="${p.confetti[1]}"/>
      <rect x="540" y="210" width="8" height="16" rx="2" fill="${p.confetti[0]}"/>
      <rect x="552" y="214" width="8" height="14" rx="2" fill="${p.confetti[2]}"/>
      <circle cx="470" cy="150" r="18" fill="${p.confetti[0]}" opacity="0.9"/>
      <circle cx="610" cy="145" r="16" fill="${p.confetti[2]}" opacity="0.9"/>
      <circle cx="455" cy="250" r="12" fill="${p.confetti[3]}" opacity="0.85"/>
      <circle cx="625" cy="255" r="14" fill="${p.confetti[1]}" opacity="0.85"/>
    `;
  const nameY = portrait ? 390 : 360;
  const ageY = (portrait ? 448 : 418) + (whoLine ? 28 : 0);
  const extras = simple
    ? ''
    : `
  <circle cx="96" cy="88" r="12" fill="${p.confetti[2]}" opacity="0.55"/>
  <circle cx="984" cy="118" r="16" fill="${p.confetti[0]}" opacity="0.5"/>
  <circle cx="110" cy="630" r="14" fill="${p.confetti[3]}" opacity="0.45"/>
  <circle cx="970" cy="610" r="18" fill="${p.confetti[1]}" opacity="0.4"/>
  <circle cx="180" cy="160" r="8" fill="${p.confetti[1]}" opacity="0.5"/>
  <circle cx="900" cy="180" r="9" fill="${p.confetti[2]}" opacity="0.45"/>`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${p.bgA}"/>
      <stop offset="50%" stop-color="${p.bgB}"/>
      <stop offset="100%" stop-color="${p.bgC}"/>
    <\/linearGradient>
    <linearGradient id="card" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${p.cardA}"/>
      <stop offset="100%" stop-color="${p.cardB}"/>
    <\/linearGradient>
  <\/defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  ${extras}
  <rect x="46" y="40" width="988" height="640" rx="48" fill="url(#card)"/>
  <rect x="46" y="40" width="988" height="22" rx="8" fill="${p.accent}"/>
  <rect x="46" y="650" width="988" height="30" rx="8" fill="${p.accent}" opacity="0.85"/>
  ${photoBlock}
  <text x="540" y="${nameY - 48}" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="30" fill="${p.muted}">Tug‘ilgan kuningiz muborak</text>
  <text x="540" y="${nameY}" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="52" font-weight="700" fill="${p.ink}">${name}</text>
  ${whoLine ? `<text x="540" y="${nameY + 36}" text-anchor="middle" font-family="system-ui, sans-serif" font-size="22" fill="${p.muted}">${whoLine}</text>` : ''}
  <text x="540" y="${ageY}" text-anchor="middle" font-family="system-ui, sans-serif" font-size="28" fill="${p.accent}">${ageLine}</text>
  <text x="540" y="620" text-anchor="middle" font-family="system-ui, sans-serif" font-size="22" fill="${p.cardA}">Oq-Ariq OILASI · mehr bilan</text>
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
};

async function renderCardBase(opts: {
  p: CardPalette;
  name: string;
  ageLine: string;
  portrait: Img | null;
  simple: boolean;
  whoLine?: string;
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
    opts.age != null ? `Bugun ${opts.age} yosh` : 'Oila sizni tabriklaydi',
  );
  const simple = Boolean(opts.simple);

  let portrait: Img | null = null;
  const bytes = opts.photoBytes ?? (await fetchPhotoBytes(opts.photoUrl));
  if (bytes) portrait = await decodePortrait(bytes);

  const whoLine = opts.whoLine?.trim()
    ? escapeXml(truncate(opts.whoLine.trim(), 42))
    : '';
  const raster = await renderCardBase({ p, name, ageLine, portrait, simple, whoLine });
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
