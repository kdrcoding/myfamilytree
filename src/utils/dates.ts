/** Parse a partial ISO date ("YYYY", "YYYY-MM" or "YYYY-MM-DD") into year/month/day parts. */
export function parseDateParts(
  value?: string,
): { year: number; month: number; day: number; hasMonth: boolean; hasDay: boolean } | null {
  if (!value) return null;
  const match = /^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?$/.exec(value.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = match[2] ? Number(match[2]) : 1;
  const day = match[3] ? Number(match[3]) : 1;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  // Reject impossible calendar days (Feb 30, Apr 31, leap years) — the Date
  // constructor would silently roll them into the next month otherwise.
  if (match[3] && new Date(year, month - 1, day).getDate() !== day) return null;
  return { year, month, day, hasMonth: Boolean(match[2]), hasDay: Boolean(match[3]) };
}

/**
 * True only when partial date `a` is DEFINITELY before partial date `b`,
 * comparing at the coarsest precision the two share. "1985" vs "1985-06" is
 * NOT definitely before — the year-only date could be any day of 1985.
 */
export function isDefinitelyBefore(a?: string, b?: string): boolean {
  const pa = parseDateParts(a);
  const pb = parseDateParts(b);
  if (!pa || !pb) return false;
  if (pa.year !== pb.year) return pa.year < pb.year;
  if (!pa.hasMonth || !pb.hasMonth) return false;
  if (pa.month !== pb.month) return pa.month < pb.month;
  if (!pa.hasDay || !pb.hasDay) return false;
  return pa.day < pb.day;
}

export function isValidDateString(value: string): boolean {
  return parseDateParts(value) !== null;
}

export function toDate(value?: string): Date | null {
  const parts = parseDateParts(value);
  if (!parts) return null;
  return new Date(parts.year, parts.month - 1, parts.day);
}

export function birthYear(birthDate?: string): number | null {
  return parseDateParts(birthDate)?.year ?? null;
}

/** Age today for living people, or age at death for deceased people. */
export function calculateAge(birthDate?: string, deathDate?: string): number | null {
  const born = toDate(birthDate);
  if (!born) return null;
  const until = toDate(deathDate) ?? new Date();
  let age = until.getFullYear() - born.getFullYear();
  const beforeBirthday =
    until.getMonth() < born.getMonth() ||
    (until.getMonth() === born.getMonth() && until.getDate() < born.getDate());
  if (beforeBirthday) age -= 1;
  // Reject only clearly-impossible values; documented long lives reach ~122.
  return age >= 0 && age <= 150 ? age : null;
}

export function isMinor(birthDate?: string, deathDate?: string): boolean {
  if (deathDate) return false;
  const age = calculateAge(birthDate);
  return age !== null && age < 18;
}

const MONTHS: Record<'en' | 'uz', string[]> = {
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  uz: ['yan', 'fev', 'mar', 'apr', 'may', 'iyn', 'iyl', 'avg', 'sen', 'okt', 'noy', 'dek'],
};

/** Human readable date, showing only the precision that was entered. */
export function formatDate(value?: string, language: 'en' | 'uz' = 'en'): string {
  if (!value) return '';
  const match = /^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?$/.exec(value.trim());
  if (!match) return value;
  const [, year, month, day] = match;
  const months = MONTHS[language];
  if (month && day) return `${Number(day)} ${months[Number(month) - 1]} ${year}`;
  if (month) return `${months[Number(month) - 1]} ${year}`;
  return year;
}

/** "3 Aug" / "3 avg" — a day + month with no year, for birthdays. */
export function formatMonthDay(month: number, day: number, language: 'en' | 'uz' = 'en'): string {
  const months = MONTHS[language];
  if (month < 1 || month > 12) return '';
  return `${day} ${months[month - 1]}`;
}

/** "1928 – 2009", "b. 1976" etc. for compact display. */
export function lifespan(
  birthDate?: string,
  deathDate?: string,
  deceased?: boolean,
  bornPrefix = 'b.',
): string {
  const born = birthYear(birthDate);
  const died = birthYear(deathDate);
  if (born && died) return `${born} – ${died}`;
  if (born && deceased) return `${born} – ?`;
  if (born) return `${bornPrefix} ${born}`;
  if (died) return `† ${died}`;
  return '';
}
