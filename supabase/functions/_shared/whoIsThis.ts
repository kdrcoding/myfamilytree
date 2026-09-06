import { prettyPersonName, type FamilyMemberRow } from './telegram.ts';

type RelRow = { kind: string; person_a: string; person_b: string };

function shortName(m: FamilyMemberRow): string {
  return prettyPersonName(m.nickname?.trim() || m.first_name);
}

function joinUz(names: string[]): string {
  if (names.length === 0) return '';
  if (names.length === 1) return names[0]!;
  return `${names.slice(0, -1).join(', ')} va ${names[names.length - 1]}`;
}

/** Uzbek one-liner for the Telegram card / public page. */
export function whoIsThisUzbek(
  person: FamilyMemberRow,
  members: FamilyMemberRow[],
  rels: RelRow[],
): string | null {
  const byId = new Map(members.map((m) => [m.id, m]));
  const names = (ids: string[]) =>
    ids.map((id) => byId.get(id)).filter((m): m is FamilyMemberRow => Boolean(m)).map(shortName);

  const parentIds = rels
    .filter((r) => r.kind === 'parent-child' && r.person_b === person.id)
    .map((r) => r.person_a);
  const parents = names(parentIds);
  if (parents.length > 0) {
    const role = person.gender === 'female' ? 'qizi' : person.gender === 'male' ? 'o‘g‘li' : 'farzandi';
    return `${joinUz(parents)}ning ${role}`;
  }

  const spouseIds = rels
    .filter((r) => r.kind === 'spouse' && (r.person_a === person.id || r.person_b === person.id))
    .map((r) => (r.person_a === person.id ? r.person_b : r.person_a));
  const spouses = names(spouseIds);
  if (spouses.length > 0) {
    const role = person.gender === 'female' ? 'xotini' : person.gender === 'male' ? 'eri' : 'turmush o‘rtog‘i';
    return `${joinUz(spouses)}ning ${role}`;
  }

  const childIds = rels
    .filter((r) => r.kind === 'parent-child' && r.person_a === person.id)
    .map((r) => r.person_b);
  const children = names(childIds).slice(0, 3);
  if (children.length > 0) {
    const role = person.gender === 'female' ? 'onasi' : person.gender === 'male' ? 'otasi' : 'ota-onasi';
    return `${joinUz(children)}ning ${role}`;
  }

  return null;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function missingDatesNotice(names: string[], pageUrl: string): string {
  const shown = names.slice(0, 12);
  const extra =
    names.length > shown.length ? `\n…va yana ${names.length - shown.length} kishi` : '';
  const list = shown.map((n) => `• ${escapeHtml(n)}`).join('\n');
  return [
    '📋 <b>Oila eslatmasi</b> — har dushanba',
    '',
    `${names.length} ta tirik a’zoda tug‘ilgan kun (oy va kun) yo‘q. Bot ularni nishonlay olmaydi.`,
    '',
    list + extra,
    '',
    `Saytda to‘ldiring: ${escapeHtml(pageUrl)}`,
  ].join('\n');
}
