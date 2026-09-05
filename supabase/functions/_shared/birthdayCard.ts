/**
 * Birthday card PNG for Telegram sendPhoto.
 * Motifs are real raster pictures composited with ImageScript — not SVG drawings.
 * Girls: balloons + flowers. Boys: gold coins + a supercar (not cartoon cars).
 */
import { Image } from 'https://deno.land/x/imagescript@1.3.0/mod.ts';
import { motifPngBytes, type CardMotifId } from './cardMotifs.ts';
import { CARD_PALETTES, normalizeCardGender, type CardGender, type CardPalette } from './cardTheme.ts';

type Img = InstanceType<typeof Image>;

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

/** ImageScript has no Cyrillic glyphs — Latin on the PNG; Telegram caption keeps the original. */
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

/** Deno Edge has no ImageData; @jsquash/webp constructs one while decoding. */
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
  const mod = (await import('npm:@jsquash/webp@1.4.0/decode')) as {
    default: (data: ArrayBuffer) => Promise<WebpDecoded>;
    init: (module?: WebAssembly.Module) => Promise<void>;
  };
  const wasmUrls = [
    'https://unpkg.com/@jsquash/webp@1.4.0/codec/dec/webp_dec.wasm',
    'https://cdn.jsdelivr.net/npm/@jsquash/webp@1.4.0/codec/dec/webp_dec.wasm',
  ];
  let wasmBuf: ArrayBuffer | null = null;
  let lastWasmErr = 'webp wasm missing';
  for (const wasmUrl of wasmUrls) {
    try {
      const wasmRes = await fetch(wasmUrl);
      if (!wasmRes.ok) {
        lastWasmErr = `webp wasm HTTP ${wasmRes.status}`;
        continue;
      }
      wasmBuf = await wasmRes.arrayBuffer();
      break;
    } catch (err) {
      lastWasmErr = err instanceof Error ? err.message : String(err);
    }
  }
  if (!wasmBuf) throw new Error(lastWasmErr);
  await mod.init(await WebAssembly.compile(wasmBuf));
  webpDecodeFn = mod.default;
  return webpDecodeFn;
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
  if (isWebp(buf)) {
    try {
      return await decodeWebpBytes(buf);
    } catch (err) {
      console.error('webp photo decode failed', err);
      return null;
    }
  }
  try {
    return await Image.decode(buf);
  } catch (err) {
    console.warn('photo decode failed', err);
    return null;
  }
}

const PHOTO_SIZE = 140;
const PHOTO_X = 380;
const PHOTO_Y = 118;

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
  if (!img) {
    console.warn('birthday card photo decode failed');
    return null;
  }
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
    if (!res.ok) {
      console.warn('birthday card photo fetch', res.status);
      return null;
    }
    const buf = new Uint8Array(await res.arrayBuffer());
    return buf.byteLength > 32 ? buf : null;
  } catch (err) {
    console.warn('birthday card photo fetch failed', err);
    return null;
  }
}

type MotifSpot = { id: CardMotifId; x: number; y: number; w: number };

function motifSpots(gender: CardGender, simple: boolean): MotifSpot[] {
  const grow = simple ? 28 : 0;
  if (gender === 'female') {
    return [
      { id: 'balloons', x: 10, y: 36, w: 210 + grow },
      { id: 'balloons', x: 668 - grow, y: 22, w: 205 + grow },
      { id: 'flowers', x: 8, y: 348, w: 220 + grow },
      { id: 'flowers', x: 662 - grow, y: 342, w: 218 + grow },
    ];
  }
  if (gender === 'male') {
    return [
      { id: 'coins', x: 14, y: 40, w: 205 + grow },
      { id: 'coins', x: 672 - grow, y: 28, w: 200 + grow },
      { id: 'cars', x: 6, y: 378, w: 248 + grow },
      { id: 'cars', x: 646 - grow, y: 378, w: 248 + grow },
    ];
  }
  return [
    { id: 'balloons', x: 12, y: 34, w: 188 + grow },
    { id: 'coins', x: 686 - grow, y: 30, w: 186 + grow },
    { id: 'flowers', x: 10, y: 356, w: 200 + grow },
    { id: 'cars', x: 662 - grow, y: 354, w: 220 + grow },
  ];
}

const motifCache = new Map<CardMotifId, Img>();

async function decodeMotif(id: CardMotifId): Promise<Img> {
  let img = motifCache.get(id);
  if (!img) {
    // Motifs are PNG or WebP. Image.decode handles PNG; WebP uses jsquash.
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
  const raster = new Image(900, 600);
  raster.fill(hexToColor(p.bgB));
  const panel = new Image(788, 496);
  panel.fill(hexToColor(p.cardA));
  raster.composite(panel, 56, 52);
  const bar = new Image(788, 18);
  bar.fill(hexToColor(p.accent));
  raster.composite(bar, 56, 52);
  return raster;
}

function cardSvg(opts: {
  p: CardPalette;
  name: string;
  ageLine: string;
  portrait: Img | null;
  simple: boolean;
}): string {
  const { p, name, ageLine, portrait, simple } = opts;
  const photoBlock = portrait
    ? `
      <circle cx="450" cy="188" r="78" fill="${p.accentSoft}" opacity="0.45"/>
      <circle cx="450" cy="188" r="74" fill="${p.accent}"/>
      <circle cx="450" cy="188" r="70" fill="${p.cardA}"/>
    `
    : `
      <circle cx="450" cy="175" r="62" fill="${p.accent}"/>
      <circle cx="450" cy="175" r="48" fill="${p.accentSoft}" opacity="0.4"/>
      <rect x="430" y="155" width="40" height="36" rx="8" fill="#fef3c7"/>
      <rect x="436" y="145" width="8" height="14" rx="2" fill="${p.confetti[1]}"/>
      <rect x="448" y="142" width="8" height="16" rx="2" fill="${p.confetti[0]}"/>
      <rect x="460" y="145" width="8" height="14" rx="2" fill="${p.confetti[2]}"/>
    `;
  const nameY = portrait ? 310 : 290;
  const ageY = portrait ? 368 : 348;
  const extras = simple
    ? ''
    : `
  <circle cx="90" cy="80" r="8" fill="${p.confetti[2]}" opacity="0.4"/>
  <circle cx="820" cy="110" r="10" fill="${p.confetti[0]}" opacity="0.35"/>
  <circle cx="100" cy="520" r="9" fill="${p.confetti[3]}" opacity="0.35"/>
  <circle cx="800" cy="500" r="11" fill="${p.confetti[2]}" opacity="0.3"/>`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="900" height="600" viewBox="0 0 900 600">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${p.bgA}"/>
      <stop offset="55%" stop-color="${p.bgB}"/>
      <stop offset="100%" stop-color="${p.bgC}"/>
    <\/linearGradient>
    <linearGradient id="card" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${p.cardA}"/>
      <stop offset="100%" stop-color="${p.cardB}"/>
    <\/linearGradient>
  <\/defs>
  <rect width="900" height="600" fill="url(#bg)"/>
  ${extras}
  <rect x="56" y="52" width="788" height="496" rx="40" fill="url(#card)"/>
  <rect x="56" y="52" width="788" height="18" rx="6" fill="${p.accent}"/>
  ${photoBlock}
  <text x="450" y="${nameY - 42}" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="32" fill="${p.muted}">Tug‘ilgan kuningiz muborak</text>
  <text x="450" y="${nameY}" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="44" font-weight="700" fill="${p.ink}">${name}</text>
  <text x="450" y="${ageY}" text-anchor="middle" font-family="system-ui, sans-serif" font-size="26" fill="${p.accent}">${ageLine}</text>
  <text x="450" y="505" text-anchor="middle" font-family="system-ui, sans-serif" font-size="18" fill="${p.muted}">Oq-Ariq OILASI · muhabbat bilan</text>
  <text x="450" y="532" text-anchor="middle" font-family="system-ui, sans-serif" font-size="16" fill="${p.accent}">Kadir · @imkadi</text>
<\/svg>`;
}

export type BirthdayCardOpts = {
  name: string;
  age: number | null;
  photoUrl?: string | null;
  photoBytes?: Uint8Array | null;
  gender?: string | null;
  designSeed?: string;
  /** Fewer SVG extras, larger pictures — used when the full card fails. */
  simple?: boolean;
};

async function renderCardBase(opts: {
  p: CardPalette;
  name: string;
  ageLine: string;
  portrait: Img | null;
  simple: boolean;
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
    opts.age != null ? `Bugun ${opts.age} yosh` : 'Oila sizni nishonlaydi',
  );
  const simple = Boolean(opts.simple);

  let portrait: Img | null = null;
  const bytes = opts.photoBytes ?? (await fetchPhotoBytes(opts.photoUrl));
  if (bytes) portrait = await decodePortrait(bytes);

  const raster = await renderCardBase({ p, name, ageLine, portrait, simple });
  try {
    await compositeMotifs(raster, gender, simple);
  } catch (err) {
    // sendPhoto-only: still post the card if WebP motifs fail to decode.
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
