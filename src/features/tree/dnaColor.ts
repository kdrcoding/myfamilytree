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
 * - As generations go down, hue shifts and saturation/lightness fade
 *   so the tree shows a natural progression like inherited DNA.
 */
export function dnaPaletteForParents(
  parentIds: string[],
  index: PersonIndex,
  generation = 0,
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
  // Each generation shifts hue +12° so the colour walks down the branch
  const genShift = generation * 12;
  const hue = (baseHue + coupleOffset + genShift + 360) % 360;

  // Fade saturation/lightness slightly each generation → visual depth
  const sat = Math.max(58, 72 - generation * 3);
  const light = Math.max(32, 42 - generation * 2);
  const darkLight = Math.max(24, 32 - generation * 1.5);
  const trunkLight = Math.max(30, 38 - generation * 2);

  return {
    a: hsl(hue, sat, light),
    b: hsl((hue + 18) % 360, Math.max(50, 65 - generation * 3), darkLight),
    trunk: hsl(hue, Math.max(42, 55 - generation * 3), trunkLight),
  };
}
