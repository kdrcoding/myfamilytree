/** Default family timezone when Telegram settings cannot be read (anon visitors). */
export const FAMILY_TIMEZONE = 'Asia/Tashkent';

/**
 * A Date whose local Y/M/D/H/M/S match the wall clock in `timeZone`.
 * Birthday helpers that call getFullYear/getMonth/getDate then see that
 * timezone’s calendar day instead of the browser’s.
 */
export function nowInTimeZone(timeZone: string = FAMILY_TIMEZONE, at: Date = new Date()): Date {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(at);
  const num = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value ?? 0);
  return new Date(num('year'), num('month') - 1, num('day'), num('hour'), num('minute'), num('second'));
}

/** Calendar date YYYY-MM-DD in the given timezone. */
export function dateKeyInTimeZone(timeZone: string = FAMILY_TIMEZONE, at: Date = new Date()): string {
  const local = nowInTimeZone(timeZone, at);
  const y = local.getFullYear();
  const m = String(local.getMonth() + 1).padStart(2, '0');
  const d = String(local.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
