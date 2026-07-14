import type { AppLanguage } from '../types/family';

/**
 * Country picker + normalization.
 *
 * The database stores ONE canonical spelling per country: the English name
 * ("Uzbekistan"). That keeps filtering/statistics/map grouping consistent and
 * feeds the geocoder directly. The UI shows names in the app language via the
 * browser's built-in Intl country names, and `normalizeCountry` recognises
 * English, Russian and Uzbek spellings of the same country so previously
 * typed values can be repaired.
 */

/** Shown first in the picker — where this family actually lives. */
export const PRIORITY_COUNTRY_CODES = [
  'UZ', 'RU', 'KZ', 'KG', 'TJ', 'TM', 'TR', 'US', 'KR', 'AE', 'SA', 'DE', 'GB',
];

/** ISO 3166-1 alpha-2 codes offered in the picker. */
export const COUNTRY_CODES = [
  'AF', 'AL', 'AM', 'AR', 'AT', 'AU', 'AZ', 'BA', 'BD', 'BE', 'BG', 'BH', 'BR',
  'BY', 'CA', 'CH', 'CL', 'CN', 'CO', 'CY', 'CZ', 'DE', 'DK', 'DZ', 'EE', 'EG',
  'ES', 'FI', 'FR', 'GB', 'GE', 'GR', 'HR', 'HU', 'ID', 'IE', 'IL', 'IN', 'IQ',
  'IR', 'IS', 'IT', 'JO', 'JP', 'KE', 'KG', 'KR', 'KW', 'KZ', 'LB', 'LT', 'LU',
  'LV', 'LY', 'MA', 'MD', 'ME', 'MK', 'MN', 'MT', 'MX', 'MY', 'NL', 'NO', 'NZ',
  'OM', 'PE', 'PH', 'PK', 'PL', 'PT', 'QA', 'RO', 'RS', 'RU', 'SA', 'SE', 'SG',
  'SI', 'SK', 'SY', 'TH', 'TJ', 'TM', 'TN', 'TR', 'UA', 'US', 'UZ', 'VN', 'ZA',
];

function makeDisplayNames(locale: string): Intl.DisplayNames | null {
  try {
    return new Intl.DisplayNames([locale], { type: 'region' });
  } catch {
    return null;
  }
}

const NAMES_EN = makeDisplayNames('en');
const NAMES_RU = makeDisplayNames('ru');
const NAMES_UZ = makeDisplayNames('uz');

/** Canonical stored value for a code — the English country name. */
export function countryNameEn(code: string): string {
  return NAMES_EN?.of(code) ?? code;
}

function localizedName(code: string, language: AppLanguage): string {
  const names = language === 'uz' ? NAMES_UZ : NAMES_EN;
  return names?.of(code) ?? countryNameEn(code);
}

/** Lowercase + unify the many apostrophe characters Uzbek names use. */
function matchKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[’ʻʼ`´'ʹ]/g, "'")
    .replace(/\s+/g, ' ');
}

/**
 * Extra spellings Intl doesn't produce but people actually type. The Uzbek
 * names are ALSO listed manually so normalization never depends on the
 * browser shipping the uz locale (many don't and silently fall back to
 * English).
 */
const MANUAL_ALIASES: Record<string, string> = {
  usa: 'US',
  'u.s.a.': 'US',
  america: 'US',
  amerika: 'US',
  aqsh: 'US',
  uk: 'GB',
  england: 'GB',
  angliya: 'GB',
  'buyuk britaniya': 'GB',
  korea: 'KR',
  koreya: 'KR',
  'janubiy koreya': 'KR',
  'south korea': 'KR',
  uae: 'AE',
  emirates: 'AE',
  'birlashgan arab amirliklari': 'AE',
  "o'zbekiston": 'UZ',
  uzbekiston: 'UZ',
  turkiya: 'TR',
  rossiya: 'RU',
  "qozog'iston": 'KZ',
  qozogiston: 'KZ',
  "qirg'iziston": 'KG',
  qirgiziston: 'KG',
  tojikiston: 'TJ',
  turkmaniston: 'TM',
  germaniya: 'DE',
  fransiya: 'FR',
  ispaniya: 'ES',
  italiya: 'IT',
  xitoy: 'CN',
  yaponiya: 'JP',
  hindiston: 'IN',
  'saudiya arabistoni': 'SA',
  misr: 'EG',
  ukraina: 'UA',
  belarus: 'BY',
  ozarbayjon: 'AZ',
  gruziya: 'GE',
  armaniston: 'AM',
};

let lookup: Map<string, string> | null = null;

/** matchKey(name in en/ru/uz) -> ISO code, built once on first use. */
function nameLookup(): Map<string, string> {
  if (lookup) return lookup;
  lookup = new Map<string, string>();
  for (const code of COUNTRY_CODES) {
    for (const names of [NAMES_EN, NAMES_RU, NAMES_UZ]) {
      const name = names?.of(code);
      if (name && name !== code) lookup.set(matchKey(name), code);
    }
    lookup.set(matchKey(code), code); // "UZ" itself
  }
  for (const [alias, code] of Object.entries(MANUAL_ALIASES)) {
    lookup.set(matchKey(alias), code);
  }
  return lookup;
}

/**
 * Map any recognised spelling (English, Russian, Uzbek, common aliases) to
 * the canonical English name. Unrecognised values return unchanged (trimmed)
 * so nothing typed is ever lost.
 */
export function normalizeCountry(raw: string | undefined): string | undefined {
  const trimmed = raw?.trim();
  if (!trimmed) return undefined;
  const code = nameLookup().get(matchKey(trimmed));
  return code ? countryNameEn(code) : trimmed;
}

export interface CountryOption {
  /** Canonical stored value (English name). */
  value: string;
  /** Name in the app language. */
  label: string;
}

/** Picker options: the family's common countries first, then all, A→Z. */
export function countryOptions(language: AppLanguage): {
  priority: CountryOption[];
  rest: CountryOption[];
} {
  const toOption = (code: string): CountryOption => ({
    value: countryNameEn(code),
    label: localizedName(code, language),
  });
  const priority = PRIORITY_COUNTRY_CODES.map(toOption);
  const prioritySet = new Set(PRIORITY_COUNTRY_CODES);
  const rest = COUNTRY_CODES.filter((c) => !prioritySet.has(c))
    .map(toOption)
    .sort((a, b) => a.label.localeCompare(b.label));
  return { priority, rest };
}

/**
 * Display label for a stored country value: canonical English names are
 * shown in the app language; anything unrecognised is shown as stored.
 */
export function countryLabel(stored: string | undefined, language: AppLanguage): string {
  if (!stored) return '';
  const code = nameLookup().get(matchKey(stored));
  return code ? localizedName(code, language) : stored;
}

/**
 * The distinct countries in a set of people, merged across spelling/case/
 * language variants (each returned as its canonical stored value). Used for
 * filter dropdowns and grouping so variants never appear as separate entries
 * even when the stored data hasn't been cleaned up yet.
 */
export function distinctCountries(
  people: { country?: string }[],
): string[] {
  const seen = new Set<string>();
  for (const p of people) {
    const canonical = normalizeCountry(p.country);
    if (canonical) seen.add(canonical);
  }
  return [...seen];
}

/** True when two country values are the same country (any spelling/case). */
export function sameCountry(a: string | undefined, b: string | undefined): boolean {
  return normalizeCountry(a) === normalizeCountry(b);
}
