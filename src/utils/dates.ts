/** Parse a partial ISO date ("YYYY", "YYYY-MM" or "YYYY-MM-DD") into year/month/day parts. */
export function parseDateParts(
  value?: string,
): { year: number; month: number; day: number } | null {
  if (!value) return null;
  const match = /^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?$/.exec(value.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = match[2] ? Number(match[2]) : 1;
  const day = match[3] ? Number(match[3]) : 1;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { year, month, day };
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
  return age >= 0 && age < 130 ? age : null;
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
