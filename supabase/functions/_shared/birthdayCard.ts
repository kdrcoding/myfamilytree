/**
 * Colorful birthday card PNG — 5 layouts, gender palettes (pink/red girls, blue boys).
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

function cakeDecor(p: CardPalette): string {
  return `
    <rect x="80" y="430" width="90" height="54" rx="10" fill="${p.accent}"/>
    <rect x="88" y="410" width="74" height="28" rx="8" fill="${p.accentSoft}"/>
    <rect x="108" y="392" width="8" height="22" rx="2" fill="#fde68a"/>
    <rect x="128" y="388" width="8" height="26" rx="2" fill="#fda4af"/>
    <rect x="148" y="392" width="8" height="22" rx="2" fill="#fde68a"/>
    <rect x="730" y="430" width="90" height="54" rx="10" fill="${p.accent}"/>
    <rect x="738" y="410" width="74" height="28" rx="8" fill="${p.accentSoft}"/>
    <circle cx="120" cy="120" r="14" fill="${p.confetti[2]}"/>
    <circle cx="780" cy="108" r="16" fill="${p.confetti[0]}"/>
  `;
}

function starsDecor(p: CardPalette): string {
  return `
    <polygon points="110,90 118,112 142,112 122,126 130,148 110,134 90,148 98,126 78,112 102,112" fill="${p.confetti[2]}"/>
    <polygon points="780,86 786,104 806,104 790,116 796,134 780,124 764,134 770,116 754,104 774,104" fill="${p.confetti[0]}"/>
    <polygon points="820,160 824,172 838,172 828,180 832,192 820,184 808,192 812,180 802,172 816,172" fill="${p.confetti[3]}"/>
    <circle cx="96" cy="200" r="6" fill="${p.confetti[1]}"/>
    <circle cx="800" cy="240" r="7" fill="${p.confetti[2]}"/>
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

function ribbonsDecor(p: CardPalette): string {
  return `
    <rect x="88" y="100" width="54" height="54" rx="8" fill="${p.accent}"/>
    <rect x="108" y="96" width="14" height="62" fill="${p.confetti[2]}"/>
    <rect x="84" y="120" width="62" height="14" fill="${p.confetti[2]}"/>
    <rect x="758" y="96" width="54" height="54" rx="8" fill="${p.accentSoft}"/>
    <rect x="778" y="92" width="14" height="62" fill="${p.confetti[2]}"/>
    <rect x="754" y="116" width="62" height="14" fill="${p.confetti[2]}"/>
    <path d="M70 500 Q 200 430 450 500 T 830 500" fill="none" stroke="${p.accentSoft}" stroke-width="8"/>
  `;
}

function decor(design: CardDesign, p: CardPalette): string {
  if (design === 'cake') return cakeDecor(p);
  if (design === 'stars') return starsDecor(p);
  if (design === 'garden') return gardenDecor(p);
  if (design === 'ribbons') return ribbonsDecor(p);
  return balloons(p);
}

export async function buildBirthdayCardPng(opts: {
  name: string;
  age: number | null;
  photoUrl?: string | null;
  gender?: string | null;
  designSeed?: string;
}): Promise<Uint8Array> {
  const gender: CardGender = normalizeCardGender(opts.gender);
  const p = CARD_PALETTES[gender];
  const design = pickCardDesign(opts.designSeed || opts.name);
  const name = escapeXml(truncate(opts.name, 28));
  const ageLine = escapeXml(
    opts.age != null ? `Bugun ${opts.age} yosh` : 'Oila sizni nishonlaydi',
  );
  const nameFont = /[\u0400-\u04FF]/.test(opts.name)
    ? "system-ui, 'Segoe UI', sans-serif"
    : "Georgia, 'Times New Roman', serif";

  let photoHref = '';
  if (opts.photoUrl && /^https?:/i.test(opts.photoUrl)) {
    try {
      const res = await fetch(opts.photoUrl);
      if (res.ok) {
        const buf = new Uint8Array(await res.arrayBuffer());
        let binary = '';
        const chunk = 0x8000;
        for (let i = 0; i < buf.length; i += chunk) {
          binary += String.fromCharCode(...buf.subarray(i, i + chunk));
        }
        const b64 = btoa(binary);
        const ct = res.headers.get('content-type') || 'image/jpeg';
        photoHref = `data:${ct};base64,${b64}`;
      }
    } catch {
      photoHref = '';
    }
  }

  const photoBlock = photoHref
    ? `
      <defs>
        <clipPath id="avatar">
          <circle cx="450" cy="188" r="70" />
        </clipPath>
      </defs>
      <circle cx="450" cy="188" r="78" fill="${p.accentSoft}" opacity="0.45"/>
      <circle cx="450" cy="188" r="74" fill="${p.accent}"/>
      <image href="${photoHref}" x="380" y="118" width="140" height="140" clip-path="url(#avatar)" preserveAspectRatio="xMidYMid slice" />
    `
    : `
      <circle cx="450" cy="175" r="62" fill="${p.accent}"/>
      <circle cx="450" cy="175" r="48" fill="${p.accentSoft}" opacity="0.4"/>
      <rect x="430" y="155" width="40" height="36" rx="8" fill="#fef3c7"/>
      <rect x="436" y="145" width="8" height="14" rx="2" fill="${p.confetti[1]}"/>
      <rect x="448" y="142" width="8" height="16" rx="2" fill="${p.confetti[0]}"/>
      <rect x="460" y="145" width="8" height="14" rx="2" fill="${p.confetti[2]}"/>
    `;

  const nameY = photoHref ? 310 : 290;
  const ageY = photoHref ? 368 : 348;

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
  ${decor(design, p)}
  ${photoBlock}
  <text x="450" y="${nameY - 42}" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="32" fill="${p.muted}">Tug‘ilgan kuningiz muborak</text>
  <text x="450" y="${nameY}" text-anchor="middle" font-family="${nameFont}" font-size="44" font-weight="700" fill="${p.ink}">${name}</text>
  <text x="450" y="${ageY}" text-anchor="middle" font-family="system-ui, sans-serif" font-size="26" fill="${p.accent}">${ageLine}</text>
  <circle cx="300" cy="455" r="7" fill="${p.confetti[1]}" opacity="0.85"/>
  <circle cx="450" cy="448" r="9" fill="${p.confetti[0]}" opacity="0.9"/>
  <circle cx="600" cy="455" r="7" fill="${p.confetti[2]}" opacity="0.85"/>
  <text x="450" y="520" text-anchor="middle" font-family="system-ui, sans-serif" font-size="20" fill="${p.muted}">Oq-Ariq OILASI · muhabbat bilan</text>
</svg>`;

  const raster = Image.renderSVG(svg, 1, Image.SVG_MODE_SCALE);
  return await raster.encode();
}
