import type { PersonIndex } from '../../utils/family';

/** Stable string hash → unsigned 32-bit. */
function hashString(value: string): number {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function hsl(h: number, s: number, l: number): string {
  return `hsl(${Math.round(h)} ${s}% ${l}%)`;
}

export interface DnaPalette {
  /** Primary flowing strand */
  a: string;
  /** Secondary strand (slightly darker / shifted) */
  b: string;
  /** Quiet trunk + arrowhead */
  trunk: string;
}

/**
 * DNA colours for one parent→child link.
 *
 * - Same couple (brothers/sisters) → identical palette
 * - Cousins share grandparents → similar hue band, small offset per dad/mom couple
 * - Unrelated branches → different base hues
 */
export function dnaPaletteForParents(
  parentIds: string[],
  index: PersonIndex,
): DnaPalette {
  const sorted = [...parentIds].filter(Boolean).sort();
  const coupleKey = sorted.join('|') || 'unknown';

  // Family band: shared grandparents when known, else the senior parent id.
  const grandKeys = sorted
    .flatMap((id) => index.get(id)?.parentIds ?? [])
    .filter(Boolean)
    .sort();
  const familyKey =
    grandKeys.length > 0 ? grandKeys.slice(0, 2).join('|') : sorted[0] ?? coupleKey;

  const baseHue = hashString(familyKey) % 360;
  // Cousins: same baseHue, different couple → ± up to 28° so they stay related-looking
  const coupleOffset = (hashString(coupleKey) % 57) - 28;
  const hue = (baseHue + coupleOffset + 360) % 360;

  // Keep strands vivid but readable on light and dark canvases
  return {
    a: hsl(hue, 72, 42),
    b: hsl((hue + 18) % 360, 65, 32),
    trunk: hsl(hue, 55, 38),
  };
}
