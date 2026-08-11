/**
 * Birthday card PNG via SVG → ImageScript raster (no custom font files).
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

export async function buildBirthdayCardPng(opts: {
  name: string;
  age: number | null;
  photoUrl?: string | null;
}): Promise<Uint8Array> {
  const name = escapeXml(truncate(opts.name, 32));
  const ageLine = escapeXml(
    opts.age != null ? `Turning ${opts.age} today` : 'Wishing you a wonderful day',
  );

  let photoHref = '';
  if (opts.photoUrl && /^https?:/i.test(opts.photoUrl)) {
    // Embed as external image in SVG — ImageScript may or may not fetch it;
    // we also try to inline below.
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
          <circle cx="450" cy="200" r="72" />
        </clipPath>
      </defs>
      <circle cx="450" cy="200" r="78" fill="#059669" />
      <image href="${photoHref}" x="378" y="128" width="144" height="144" clip-path="url(#avatar)" preserveAspectRatio="xMidYMid slice" />
    `
    : `<circle cx="450" cy="190" r="56" fill="#047857" />`;

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="900" height="600" viewBox="0 0 900 600">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#064e3b"/>
      <stop offset="100%" stop-color="#0f766e"/>
    </linearGradient>
  </defs>
  <rect width="900" height="600" fill="url(#bg)"/>
  <rect x="48" y="48" width="804" height="504" rx="36" fill="#faf8f3"/>
  <rect x="48" y="48" width="804" height="14" rx="4" fill="#059669"/>
  ${photoBlock}
  <text x="450" y="${photoHref ? 330 : 300}" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="52" fill="#064e3b">Happy Birthday</text>
  <text x="450" y="${photoHref ? 400 : 370}" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="40" font-weight="700" fill="#1c1917">${name}</text>
  <text x="450" y="${photoHref ? 455 : 425}" text-anchor="middle" font-family="system-ui, sans-serif" font-size="28" fill="#047857">${ageLine}</text>
  <text x="450" y="520" text-anchor="middle" font-family="system-ui, sans-serif" font-size="22" fill="#64748b">Oq-Ariq OILASI</text>
</svg>`;

  // Large base64 photos can blow spread args — use chunked btoa already done.
  // ImageScript renderSVG: (svg, size, mode) — size scale factor.
  const raster = Image.renderSVG(svg, 1, Image.SVG_MODE_SCALE);
  return await raster.encode();
}
