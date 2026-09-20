import type { FamilyPerson } from '../types/family';
import { fullName } from './family';
import { getUpcomingBirthdays } from './birthdays';
import { getUpcomingAnniversaries } from './anniversaries';
import { getUpcomingTraditions, type CustomTradition } from './traditions';
import { livingPeopleOnly } from './living';

/** Escape text for iCalendar text values. */
function esc(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
}

/** Fold long lines per RFC 5545 (§3.1). */
function fold(line: string): string {
  const max = 75;
  if (line.length <= max) return line;
  const parts: string[] = [];
  let rest = line;
  parts.push(rest.slice(0, max));
  rest = rest.slice(max);
  while (rest.length > 0) {
    parts.push(' ' + rest.slice(0, max - 1));
    rest = rest.slice(max - 1);
  }
  return parts.join('\r\n');
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function dateStamp(year: number, month: number, day: number): string {
  return `${year}${pad(month)}${pad(day)}`;
}

function uid(seed: string): string {
  return `${seed}@oqariq.family`;
}

/**
 * Yearly recurring calendar of living birthdays + wedding anniversaries,
 * plus one-off / yearly family traditions (no person names on holidays).
 */
export function buildFamilyCalendarIcs(
  people: FamilyPerson[],
  options: {
    calendarName?: string;
    language?: 'en' | 'uz' | 'ru';
    customTraditions?: CustomTradition[];
  } = {},
): string {
  const calendarName = options.calendarName ?? 'Oq-Ariq family';
  const living = livingPeopleOnly(people);
  const now = new Date();
  const stamp = `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`;

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Oq-Ariq OILASI//Family Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${esc(calendarName)}`,
  ];

  for (const b of getUpcomingBirthdays(living, now)) {
    const name = fullName(b.person);
    const summary =
      options.language === 'uz'
        ? `${name} — tug‘ilgan kun`
        : options.language === 'ru'
          ? `${name} — день рождения`
          : `${name} — birthday`;
    const occurrence = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    occurrence.setDate(occurrence.getDate() + b.daysUntil);

    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${uid(`bday-${b.person.id}`)}`);
    lines.push(`DTSTAMP:${stamp}`);
    lines.push(
      `DTSTART;VALUE=DATE:${dateStamp(occurrence.getFullYear(), occurrence.getMonth() + 1, occurrence.getDate())}`,
    );
    lines.push('RRULE:FREQ=YEARLY');
    lines.push(`SUMMARY:${esc(summary)}`);
    lines.push('TRANSP:TRANSPARENT');
    lines.push('END:VEVENT');
  }

  for (const a of getUpcomingAnniversaries(living, now)) {
    const names = `${fullName(a.a)} & ${fullName(a.b)}`;
    const summary =
      options.language === 'uz'
        ? `${names} — to‘y yilligi`
        : options.language === 'ru'
          ? `${names} — годовщина свадьбы`
          : `${names} — anniversary`;
    const occurrence = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    occurrence.setDate(occurrence.getDate() + a.daysUntil);

    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${uid(`anniv-${[a.a.id, a.b.id].sort().join('-')}`)}`);
    lines.push(`DTSTAMP:${stamp}`);
    lines.push(
      `DTSTART;VALUE=DATE:${dateStamp(occurrence.getFullYear(), occurrence.getMonth() + 1, occurrence.getDate())}`,
    );
    lines.push('RRULE:FREQ=YEARLY');
    lines.push(`SUMMARY:${esc(summary)}`);
    lines.push('TRANSP:TRANSPARENT');
    lines.push('END:VEVENT');
  }

  for (const row of getUpcomingTraditions(options.customTraditions ?? [], now)) {
    const label =
      row.customTitle?.trim() ||
      (row.kind === 'navruz'
        ? options.language === 'uz'
          ? 'Navro‘z'
          : options.language === 'ru'
            ? 'Навруз'
            : 'Navruz'
        : row.kind === 'eid_fitr'
          ? options.language === 'uz'
            ? 'Hayit (Ramazon)'
            : options.language === 'ru'
              ? 'Ураза-байрам'
              : 'Eid al-Fitr'
          : row.kind === 'eid_adha'
            ? options.language === 'uz'
              ? 'Qurbon hayiti'
              : options.language === 'ru'
                ? 'Курбан-байрам'
                : 'Eid al-Adha'
            : row.kind === 'new_year'
              ? options.language === 'uz'
                ? 'Yangi yil'
                : options.language === 'ru'
                  ? 'Новый год'
                  : 'New Year'
              : options.language === 'uz'
                ? 'Oila uchrashuvi'
                : options.language === 'ru'
                  ? 'Семейная встреча'
                  : 'Family reunion');
    const occurrence = new Date(row.year, row.month - 1, row.day);
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${uid(`trad-${row.id}`)}`);
    lines.push(`DTSTAMP:${stamp}`);
    lines.push(
      `DTSTART;VALUE=DATE:${dateStamp(occurrence.getFullYear(), occurrence.getMonth() + 1, occurrence.getDate())}`,
    );
    if (row.kind !== 'reunion') {
      lines.push('RRULE:FREQ=YEARLY');
    }
    lines.push(`SUMMARY:${esc(label)}`);
    lines.push('TRANSP:TRANSPARENT');
    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}

/** Trigger a browser download of the calendar file. */
export function downloadFamilyCalendarIcs(
  people: FamilyPerson[],
  options: {
    calendarName?: string;
    language?: 'en' | 'uz' | 'ru';
    filename?: string;
    customTraditions?: CustomTradition[];
  } = {},
): void {
  const ics = buildFamilyCalendarIcs(people, options);
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = options.filename ?? 'oq-ariq-family-calendar.ics';
  a.click();
  URL.revokeObjectURL(url);
}
