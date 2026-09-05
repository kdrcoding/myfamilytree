/**
 * Colorful birthday card PNG — 5 layouts, gender palettes, and
 * obvious gender motifs (balloons+flowers for girls, money+cars for guys).
 */
import { Image } from 'https://deno.land/x/imagescript@1.3.0/mod.ts';
import {
  CARD_PALETTES,
  normalizeCardGender,
  pickCardDesign,
  type CardDesign,
  type CardGender,
  type CardPalette,
} from './cardTheme.ts';

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

function coverSquare(img: InstanceType<typeof Image>, size: number): InstanceType<typeof Image> {
  const cover = (img as { cover?: (w: number, h: number) => InstanceType<typeof Image> }).cover;
  if (typeof cover === 'function') return cover.call(img, size, size);
  const scale = Math.max(size / img.width, size / img.height);
  img.resize(Math.max(1, Math.round(img.width * scale)), Math.max(1, Math.round(img.height * scale)));
  const x = Math.max(0, Math.floor((img.width - size) / 2));
  const y = Math.max(0, Math.floor((img.height - size) / 2));
  return img.crop(x, y, Math.min(size, img.width), Math.min(size, img.height));
}

async function decodePhoto(buf: Uint8Array): Promise<InstanceType<typeof Image> | null> {
  try {
    return await Image.decode(buf);
  } catch {
    // JPEG/PNG failed — family photos are often stored as WebP.
  }
  if (!isWebp(buf)) return null;
  try {
    const copy = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
    const mod = (await import('npm:@jsquash/webp@1.4.0')) as {
      decode?: (data: ArrayBuffer) => Promise<{
        width: number;
        height: number;
        data: Uint8ClampedArray | Uint8Array;
      }>;
      default?: (data: ArrayBuffer) => Promise<{
        width: number;
        height: number;
        data: Uint8ClampedArray | Uint8Array;
      }>;
    };
    const decodeWebp = mod.decode ?? mod.default;
    if (!decodeWebp) return null;
    const decoded = await decodeWebp(copy);
    const img = new Image(decoded.width, decoded.height);
    const pixels = decoded.data;
    img.bitmap.set(new Uint8Array(pixels.buffer, pixels.byteOffset, pixels.byteLength));
    return img;
  } catch (err) {
    console.error('webp photo decode failed', err);
    return null;
  }
}

function balloon(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  color: string,
  stringEndY: number,
  sway = 8,
): string {
  return `
    <ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${color}"/>
    <ellipse cx="${cx - rx * 0.28}" cy="${cy - ry * 0.28}" rx="${rx * 0.22}" ry="${ry * 0.18}" fill="#ffffff" opacity="0.4"/>
    <polygon points="${cx - 5},${cy + ry - 1} ${cx + 5},${cy + ry - 1} ${cx},${cy + ry + 9}" fill="${color}"/>
    <line x1="${cx}" y1="${cy + ry + 9}" x2="${cx + sway}" y2="${stringEndY}" stroke="#64748b" stroke-width="2"/>
  `;
}

function flower(cx: number, cy: number, petal: string, center: string, size = 1): string {
  const pr = 11 * size;
  const r = 8 * size;
  const petals = [0, 72, 144, 216, 288]
    .map((deg) => {
      const rad = (deg * Math.PI) / 180;
      const px = (cx + Math.cos(rad) * pr).toFixed(1);
      const py = (cy + Math.sin(rad) * pr).toFixed(1);
      return `<circle cx="${px}" cy="${py}" r="${r.toFixed(1)}" fill="${petal}"/>`;
    })
    .join('');
  return `${petals}<circle cx="${cx}" cy="${cy}" r="${(6.4 * size).toFixed(1)}" fill="${center}"/>`;
}

function leaf(cx: number, cy: number, rx = 13, ry = 6): string {
  return `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="#16a34a"/>`;
}

function bill(x: number, y: number, w = 70, h = 36, fill = '#22c55e', dark = '#166534'): string {
  return `
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="5" fill="${fill}"/>
    <rect x="${x + 5}" y="${y + 4}" width="${w - 10}" height="${h - 8}" rx="3" fill="none" stroke="${dark}" stroke-width="2"/>
    <circle cx="${x + w / 2}" cy="${y + h / 2}" r="${Math.min(w, h) * 0.22}" fill="#86efac"/>
    <circle cx="${x + w / 2}" cy="${y + h / 2}" r="${Math.min(w, h) * 0.12}" fill="${dark}"/>
  `;
}

function billStack(x: number, y: number): string {
  return (
    bill(x + 8, y, 72, 38, '#4ade80', '#166534') +
    bill(x + 4, y + 7, 72, 38, '#22c55e', '#166534') +
    bill(x, y + 14, 72, 38, '#16a34a', '#14532d')
  );
}

function coin(cx: number, cy: number, r: number): string {
  return `
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="#d97706"/>
    <circle cx="${cx}" cy="${cy}" r="${r - 3}" fill="#fbbf24"/>
    <circle cx="${cx}" cy="${cy}" r="${Math.max(3, r * 0.32)}" fill="#b45309"/>
  `;
}

function coinStack(cx: number, cy: number, n = 4): string {
  let s = '';
  for (let i = 0; i < n; i++) s += coin(cx + (i % 2) * 3, cy - i * 7, 13);
  return s;
}

function carRight(x: number, y: number, body: string, glass: string): string {
  return `
    <path d="M${x + 8} ${y + 22} L${x + 26} ${y + 22} L${x + 38} ${y + 6} L${x + 82} ${y + 6} L${x + 98} ${y + 22} L${x + 122} ${y + 22} L${x + 122} ${y + 40} L${x + 8} ${y + 40} Z" fill="${body}"/>
    <path d="M${x + 42} ${y + 9} L${x + 78} ${y + 9} L${x + 90} ${y + 22} L${x + 34} ${y + 22} Z" fill="${glass}"/>
    <rect x="${x + 112}" y="${y + 26}" width="8" height="7" rx="1" fill="#fde68a"/>
    <circle cx="${x + 34}" cy="${y + 40}" r="11" fill="#0f172a"/>
    <circle cx="${x + 34}" cy="${y + 40}" r="5" fill="#94a3b8"/>
    <circle cx="${x + 96}" cy="${y + 40}" r="11" fill="#0f172a"/>
    <circle cx="${x + 96}" cy="${y + 40}" r="5" fill="#94a3b8"/>
  `;
}

function carLeft(x: number, y: number, body: string, glass: string): string {
  return `
    <path d="M${x + 116} ${y + 22} L${x + 98} ${y + 22} L${x + 86} ${y + 6} L${x + 42} ${y + 6} L${x + 26} ${y + 22} L${x + 2} ${y + 22} L${x + 2} ${y + 40} L${x + 116} ${y + 40} Z" fill="${body}"/>
    <path d="M${x + 82} ${y + 9} L${x + 46} ${y + 9} L${x + 34} ${y + 22} L${x + 90} ${y + 22} Z" fill="${glass}"/>
    <rect x="${x + 4}" y="${y + 26}" width="8" height="7" rx="1" fill="#fde68a"/>
    <circle cx="${x + 90}" cy="${y + 40}" r="11" fill="#0f172a"/>
    <circle cx="${x + 90}" cy="${y + 40}" r="5" fill="#94a3b8"/>
    <circle cx="${x + 28}" cy="${y + 40}" r="11" fill="#0f172a"/>
    <circle cx="${x + 28}" cy="${y + 40}" r="5" fill="#94a3b8"/>
  `;
}

/** Girls: plenty of balloons with flower bouquets — must read at a glance. */
function girlBalloonsAndFlowers(p: CardPalette, design: CardDesign): string {
  const extraInner =
    design === 'cake'
      ? ''
      : `${flower(248, 468, '#f43f5e', '#fbbf24', 0.78)}${flower(652, 468, '#f472b6', '#fff1f2', 0.78)}`;
  return `
    ${balloon(108, 118, 26, 34, p.confetti[0], 268, 10)}
    ${balloon(162, 92, 22, 30, p.confetti[1], 250, -8)}
    ${balloon(64, 148, 18, 24, p.confetti[3], 292, 6)}
    ${balloon(198, 128, 16, 22, '#fbbf24', 260, 12)}
    ${balloon(792, 108, 26, 34, p.confetti[2], 258, -10)}
    ${balloon(842, 86, 20, 28, '#fbbf24', 236, 8)}
    ${balloon(746, 142, 18, 24, p.confetti[0], 280, -6)}
    ${balloon(700, 118, 16, 22, p.confetti[3], 250, 10)}
    ${leaf(86, 468)}
    ${leaf(118, 486)}
    ${leaf(148, 472)}
    ${flower(102, 452, '#fb7185', '#fbbf24', 1.2)}
    ${flower(138, 470, '#f9a8d4', '#fff7ed', 1)}
    ${flower(74, 478, '#f43f5e', '#fde68a', 0.9)}
    ${leaf(782, 462)}
    ${leaf(818, 484)}
    ${leaf(848, 470)}
    ${flower(802, 448, '#f472b6', '#fbbf24', 1.15)}
    ${flower(836, 468, '#fb7185', '#fff1f2', 0.95)}
    ${flower(768, 476, '#f9a8d4', '#fde68a', 0.88)}
    ${flower(214, 214, '#f9a8d4', '#fbbf24', 0.72)}
    ${flower(686, 208, '#fb7185', '#fff7ed', 0.72)}
    ${extraInner}
  `;
}

/** Guys: cash stacks, gold coins, and cars — must read at a glance. */
function guyMoneyAndCars(_p: CardPalette, design: CardDesign): string {
  const extra =
    design === 'garden' || design === 'balloons'
      ? `${bill(250, 470, 64, 32)}${bill(586, 470, 64, 32)}${coin(330, 492, 12)}${coin(570, 492, 12)}`
      : '';
  return `
    ${bill(62, 86, 68, 34)}
    ${bill(88, 118, 62, 32, '#4ade80', '#166534')}
    ${billStack(64, 168)}
    ${bill(770, 84, 70, 36)}
    ${bill(748, 122, 64, 32, '#4ade80', '#166534')}
    ${billStack(748, 168)}
    ${coin(196, 128, 14)}
    ${coin(230, 156, 11)}
    ${coin(704, 136, 14)}
    ${coin(668, 164, 11)}
    ${coin(448, 92, 12)}
    ${carRight(58, 448, '#dc2626', '#e0f2fe')}
    ${carLeft(718, 448, '#1e3a8a', '#e0f2fe')}
    ${coinStack(208, 478, 5)}
    ${coinStack(692, 478, 5)}
    ${bill(318, 88, 58, 30, '#16a34a', '#14532d')}
    ${bill(524, 88, 58, 30, '#22c55e', '#166534')}
    ${extra}
  `;
}

function cakeDecor(p: CardPalette, inset = false): string {
  const lx = inset ? 210 : 80;
  const rx = inset ? 600 : 730;
  return `
    <rect x="${lx}" y="430" width="90" height="54" rx="10" fill="${p.accent}"/>
    <rect x="${lx + 8}" y="410" width="74" height="28" rx="8" fill="${p.accentSoft}"/>
    <rect x="${lx + 28}" y="392" width="8" height="22" rx="2" fill="#fde68a"/>
    <rect x="${lx + 48}" y="388" width="8" height="26" rx="2" fill="#fda4af"/>
    <rect x="${lx + 68}" y="392" width="8" height="22" rx="2" fill="#fde68a"/>
    <rect x="${rx}" y="430" width="90" height="54" rx="10" fill="${p.accent}"/>
    <rect x="${rx + 8}" y="410" width="74" height="28" rx="8" fill="${p.accentSoft}"/>
    <circle cx="${lx + 40}" cy="120" r="14" fill="${p.confetti[2]}"/>
    <circle cx="${rx + 50}" cy="108" r="16" fill="${p.confetti[0]}"/>
  `;
}

function starsDecor(p: CardPalette, inset = false): string {
  const lx = inset ? 250 : 110;
  const rx = inset ? 650 : 780;
  return `
    <polygon points="${lx},90 ${lx + 8},112 ${lx + 32},112 ${lx + 12},126 ${lx + 20},148 ${lx},134 ${lx - 20},148 ${lx - 12},126 ${lx - 32},112 ${lx - 8},112" fill="${p.confetti[2]}"/>
    <polygon points="${rx},86 ${rx + 6},104 ${rx + 26},104 ${rx + 10},116 ${rx + 16},134 ${rx},124 ${rx - 16},134 ${rx - 10},116 ${rx - 26},104 ${rx - 6},104" fill="${p.confetti[0]}"/>
    <polygon points="${rx + 40},160 ${rx + 44},172 ${rx + 58},172 ${rx + 48},180 ${rx + 52},192 ${rx + 40},184 ${rx + 28},192 ${rx + 32},180 ${rx + 22},172 ${rx + 36},172" fill="${p.confetti[3]}"/>
    <circle cx="${inset ? 250 : 96}" cy="200" r="6" fill="${p.confetti[1]}"/>
    <circle cx="${inset ? 650 : 800}" cy="240" r="7" fill="${p.confetti[2]}"/>
  `;
}

function gardenDecor(p: CardPalette): string {
  return `
    <circle cx="108" cy="118" r="16" fill="${p.confetti[0]}"/>
    <circle cx="128" cy="108" r="14" fill="${p.confetti[1]}"/>
    <circle cx="118" cy="132" r="12" fill="${p.confetti[3]}"/>
    <circle cx="118" cy="118" r="7" fill="${p.confetti[2]}"/>
    <circle cx="790" cy="112" r="16" fill="${p.confetti[1]}"/>
    <circle cx="770" cy="124" r="14" fill="${p.confetti[0]}"/>
    <circle cx="808" cy="128" r="12" fill="${p.confetti[3]}"/>
    <circle cx="790" cy="122" r="7" fill="${p.confetti[2]}"/>
    <ellipse cx="100" cy="470" rx="28" ry="12" fill="${p.accentSoft}" opacity="0.45"/>
    <ellipse cx="800" cy="470" rx="28" ry="12" fill="${p.accentSoft}" opacity="0.45"/>
  `;
}

function ribbonsDecor(p: CardPalette, inset = false): string {
  const lx = inset ? 220 : 88;
  const rx = inset ? 626 : 758;
  return `
    <rect x="${lx}" y="100" width="54" height="54" rx="8" fill="${p.accent}"/>
    <rect x="${lx + 20}" y="96" width="14" height="62" fill="${p.confetti[2]}"/>
    <rect x="${lx - 4}" y="120" width="62" height="14" fill="${p.confetti[2]}"/>
    <rect x="${rx}" y="96" width="54" height="54" rx="8" fill="${p.accentSoft}"/>
    <rect x="${rx + 20}" y="92" width="14" height="62" fill="${p.confetti[2]}"/>
    <rect x="${rx - 4}" y="116" width="62" height="14" fill="${p.confetti[2]}"/>
    <path d="M70 500 Q 200 430 450 500 T 830 500" fill="none" stroke="${p.accentSoft}" stroke-width="8"/>
  `;
}

function balloons(p: CardPalette): string {
  return `
    <ellipse cx="110" cy="120" rx="24" ry="32" fill="${p.confetti[0]}"/>
    <line x1="110" y1="152" x2="118" y2="210" stroke="#64748b" stroke-width="2"/>
    <ellipse cx="168" cy="96" rx="20" ry="28" fill="${p.confetti[1]}"/>
    <line x1="168" y1="124" x2="160" y2="186" stroke="#64748b" stroke-width="2"/>
    <ellipse cx="760" cy="118" rx="24" ry="32" fill="${p.confetti[2]}"/>
    <line x1="760" y1="150" x2="752" y2="208" stroke="#64748b" stroke-width="2"/>
    <ellipse cx="812" cy="90" rx="18" ry="24" fill="${p.confetti[3]}"/>
    <line x1="812" y1="114" x2="820" y2="170" stroke="#64748b" stroke-width="2"/>
  `;
}

function layoutDecor(design: CardDesign, p: CardPalette, inset: boolean): string {
  if (design === 'cake') return cakeDecor(p, inset);
  if (design === 'stars') return starsDecor(p, inset);
  if (design === 'garden') return inset ? '' : gardenDecor(p);
  if (design === 'ribbons') return ribbonsDecor(p, inset);
  return inset ? '' : balloons(p);
}

function decor(design: CardDesign, p: CardPalette, gender: CardGender): string {
  if (gender === 'female') {
    return `${girlBalloonsAndFlowers(p, design)}\n${layoutDecor(design, p, true)}`;
  }
  if (gender === 'male') {
    return `${guyMoneyAndCars(p, design)}\n${layoutDecor(design, p, true)}`;
  }
  return layoutDecor(design, p, false);
}

const PHOTO_SIZE = 140;
const PHOTO_X = 380;
const PHOTO_Y = 118;

function punchCircle(img: InstanceType<typeof Image>): void {
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

async function decodePortrait(bytes: Uint8Array): Promise<InstanceType<typeof Image> | null> {
  const img = await decodePhoto(bytes);
  if (!img) {
    console.warn('birthday card photo decode failed');
    return null;
  }
  try {
    const sized = coverSquare(img, PHOTO_SIZE);
    const cropCircle = (
      sized as { cropCircle?: (feather?: boolean, padding?: number) => InstanceType<typeof Image> }
    ).cropCircle;
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

export async function buildBirthdayCardPng(opts: {
  name: string;
  age: number | null;
  photoUrl?: string | null;
  photoBytes?: Uint8Array | null;
  gender?: string | null;
  designSeed?: string;
}): Promise<Uint8Array> {
  const gender: CardGender = normalizeCardGender(opts.gender);
  const p = CARD_PALETTES[gender];
  const design = pickCardDesign(opts.designSeed || opts.name);
  const printable = cardPrintableName(opts.name);
  const name = escapeXml(truncate(printable, 28));
  const ageLine = escapeXml(
    opts.age != null ? `Bugun ${opts.age} yosh` : 'Oila sizni nishonlaydi',
  );
  const nameFont = "Georgia, 'Times New Roman', serif";

  // ImageScript's SVG rasterizer ignores <image href="data:...">, so we
  // decode JPEG/PNG bytes and composite a circular portrait after renderSVG.
  let portrait: InstanceType<typeof Image> | null = null;
  const bytes = opts.photoBytes ?? (await fetchPhotoBytes(opts.photoUrl));
  if (bytes) portrait = await decodePortrait(bytes);

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
  const sparkDots =
    gender === 'unspecified'
      ? `
  <circle cx="300" cy="455" r="7" fill="${p.confetti[1]}" opacity="0.85"/>
  <circle cx="450" cy="448" r="9" fill="${p.confetti[0]}" opacity="0.9"/>
  <circle cx="600" cy="455" r="7" fill="${p.confetti[2]}" opacity="0.85"/>`
      : '';

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="900" height="600" viewBox="0 0 900 600">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${p.bgA}"/>
      <stop offset="55%" stop-color="${p.bgB}"/>
      <stop offset="100%" stop-color="${p.bgC}"/>
    </linearGradient>
    <linearGradient id="card" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${p.cardA}"/>
      <stop offset="100%" stop-color="${p.cardB}"/>
    </linearGradient>
  </defs>
  <rect width="900" height="600" fill="url(#bg)"/>
  <circle cx="90" cy="80" r="10" fill="${p.confetti[2]}" opacity="0.55"/>
  <circle cx="820" cy="110" r="14" fill="${p.confetti[0]}" opacity="0.5"/>
  <circle cx="100" cy="520" r="12" fill="${p.confetti[3]}" opacity="0.45"/>
  <circle cx="800" cy="500" r="16" fill="${p.confetti[2]}" opacity="0.4"/>
  <rect x="56" y="52" width="788" height="496" rx="40" fill="url(#card)"/>
  <rect x="56" y="52" width="788" height="18" rx="6" fill="${p.accent}"/>
  ${decor(design, p, gender)}
  ${photoBlock}
  <text x="450" y="${nameY - 42}" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="32" fill="${p.muted}">Tug‘ilgan kuningiz muborak</text>
  <text x="450" y="${nameY}" text-anchor="middle" font-family="${nameFont}" font-size="44" font-weight="700" fill="${p.ink}">${name}</text>
  <text x="450" y="${ageY}" text-anchor="middle" font-family="system-ui, sans-serif" font-size="26" fill="${p.accent}">${ageLine}</text>
  ${sparkDots}
  <text x="450" y="505" text-anchor="middle" font-family="system-ui, sans-serif" font-size="18" fill="${p.muted}">Oq-Ariq OILASI · muhabbat bilan</text>
  <text x="450" y="532" text-anchor="middle" font-family="system-ui, sans-serif" font-size="16" fill="${p.accent}">Kadir · @imkadi</text>
</svg>`;

  const raster = await Image.renderSVG(svg, 1, Image.SVG_MODE_SCALE);
  if (portrait) {
    try {
      raster.composite(portrait, PHOTO_X, PHOTO_Y);
    } catch (err) {
      console.warn('birthday card photo composite failed', err);
    }
  }
  return await raster.encode();
}
