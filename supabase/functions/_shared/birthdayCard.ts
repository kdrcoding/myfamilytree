/**
 * Cute birthday card PNG via SVG → ImageScript raster.
 */
import { Image } from 'https://deno.land/x/imagescript@1.3.0/mod.ts';

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

function ordinalAge(age: number): string {
  const v = age % 100;
  if (v >= 11 && v <= 13) return `${age}th`;
  switch (age % 10) {
    case 1:
      return `${age}st`;
    case 2:
      return `${age}nd`;
    case 3:
      return `${age}rd`;
    default:
      return `${age}th`;
  }
}

export async function buildBirthdayCardPng(opts: {
  name: string;
  age: number | null;
  photoUrl?: string | null;
}): Promise<Uint8Array> {
  const name = escapeXml(truncate(opts.name, 28));
  const ageLine = escapeXml(
    opts.age != null ? `Turning ${opts.age} · Happy ${ordinalAge(opts.age)}!` : 'Wishing you a wonderful day',
  );

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
      <circle cx="450" cy="188" r="78" fill="#34d399" opacity="0.45"/>
      <circle cx="450" cy="188" r="74" fill="#059669"/>
      <image href="${photoHref}" x="380" y="118" width="140" height="140" clip-path="url(#avatar)" preserveAspectRatio="xMidYMid slice" />
    `
    : `
      <circle cx="450" cy="175" r="62" fill="#047857"/>
      <circle cx="450" cy="175" r="48" fill="#10b981" opacity="0.35"/>
      <rect x="430" y="155" width="40" height="36" rx="8" fill="#fef3c7"/>
      <rect x="436" y="145" width="8" height="14" rx="2" fill="#f472b6"/>
      <rect x="448" y="142" width="8" height="16" rx="2" fill="#34d399"/>
      <rect x="460" y="145" width="8" height="14" rx="2" fill="#fbbf24"/>
    `;

  const nameY = photoHref ? 310 : 290;
  const ageY = photoHref ? 368 : 348;

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="900" height="600" viewBox="0 0 900 600">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#064e3b"/>
      <stop offset="55%" stop-color="#0f766e"/>
      <stop offset="100%" stop-color="#115e59"/>
    </linearGradient>
    <linearGradient id="card" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#fffbeb"/>
      <stop offset="100%" stop-color="#f0fdf4"/>
    </linearGradient>
  </defs>
  <rect width="900" height="600" fill="url(#bg)"/>
  <!-- soft dots -->
  <circle cx="90" cy="80" r="10" fill="#fde68a" opacity="0.55"/>
  <circle cx="820" cy="110" r="14" fill="#a7f3d0" opacity="0.5"/>
  <circle cx="100" cy="520" r="12" fill="#fbcfe8" opacity="0.45"/>
  <circle cx="800" cy="500" r="16" fill="#fde68a" opacity="0.4"/>
  <!-- card -->
  <rect x="56" y="52" width="788" height="496" rx="40" fill="url(#card)"/>
  <rect x="56" y="52" width="788" height="18" rx="6" fill="#059669"/>
  <!-- balloons -->
  <g transform="translate(110,120)">
    <ellipse cx="0" cy="0" rx="22" ry="28" fill="#34d399"/>
    <line x1="0" y1="28" x2="4" y2="70" stroke="#64748b" stroke-width="2"/>
  </g>
  <g transform="translate(170,95)">
    <ellipse cx="0" cy="0" rx="18" ry="24" fill="#f472b6"/>
    <line x1="0" y1="24" x2="-3" y2="62" stroke="#64748b" stroke-width="2"/>
  </g>
  <g transform="translate(760,115)">
    <ellipse cx="0" cy="0" rx="22" ry="28" fill="#fbbf24"/>
    <line x1="0" y1="28" x2="-4" y2="70" stroke="#64748b" stroke-width="2"/>
  </g>
  <g transform="translate(800,90)">
    <ellipse cx="0" cy="0" rx="16" ry="22" fill="#6ee7b7"/>
    <line x1="0" y1="22" x2="2" y2="58" stroke="#64748b" stroke-width="2"/>
  </g>
  ${photoBlock}
  <text x="450" y="${nameY - 42}" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="36" fill="#047857">Happy Birthday</text>
  <text x="450" y="${nameY}" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="44" font-weight="700" fill="#134e4a">${name}</text>
  <text x="450" y="${ageY}" text-anchor="middle" font-family="system-ui, sans-serif" font-size="26" fill="#059669">${ageLine}</text>
  <!-- little hearts -->
  <circle cx="300" cy="455" r="7" fill="#fb7185" opacity="0.85"/>
  <circle cx="450" cy="448" r="9" fill="#34d399" opacity="0.9"/>
  <circle cx="600" cy="455" r="7" fill="#fbbf24" opacity="0.85"/>
  <text x="450" y="520" text-anchor="middle" font-family="system-ui, sans-serif" font-size="20" fill="#64748b">Oq-Ariq OILASI · with love</text>
</svg>`;

  const raster = Image.renderSVG(svg, 1, Image.SVG_MODE_SCALE);
  return await raster.encode();
}
