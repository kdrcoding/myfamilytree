import type { FamilyPerson } from '../types/family';

export type WhoLang = 'uz' | 'en' | 'ru';

function shortName(person: FamilyPerson): string {
  return prettyPersonName(person.nickname?.trim() || person.firstName);
}

function prettyPersonName(value: string): string {
  return value.replace(/[A-Z]{2,}[a-z]*/g, (chunk) => {
    const upper = chunk.match(/^[A-Z]+/)?.[0] ?? chunk;
    const rest = chunk.slice(upper.length);
    return upper[0] + upper.slice(1).toLowerCase() + rest;
  });
}

function joinNames(names: string[], lang: WhoLang): string {
  if (names.length === 0) return '';
  if (names.length === 1) return names[0]!;
  const rest = names.slice(0, -1).join(', ');
  const last = names[names.length - 1]!;
  if (lang === 'en') return `${rest} and ${last}`;
  if (lang === 'ru') return `${rest} и ${last}`;
  return `${rest} va ${last}`;
}

/**
 * One short line so relatives know who the birthday person is in the family.
 * Prefers parents, then spouse, then children.
 */
export function describeWho(
  person: FamilyPerson,
  people: FamilyPerson[],
  lang: WhoLang = 'uz',
): string | null {
  const byId = new Map(people.map((p) => [p.id, p]));
  const named = (ids: string[]) =>
    ids.map((id) => byId.get(id)).filter((p): p is FamilyPerson => Boolean(p)).map(shortName);

  const parents = named(person.parentIds);
  if (parents.length > 0) {
    const of = joinNames(parents, lang);
    if (lang === 'en') {
      const role = person.gender === 'female' ? 'daughter' : person.gender === 'male' ? 'son' : 'child';
      return `${role} of ${of}`;
    }
    if (lang === 'ru') {
      const role = person.gender === 'female' ? 'дочь' : person.gender === 'male' ? 'сын' : 'ребёнок';
      return `${role} ${of}`;
    }
    const role = person.gender === 'female' ? 'qizi' : person.gender === 'male' ? 'o‘g‘li' : 'farzandi';
    return `${of}ning ${role}`;
  }

  const spouses = named(person.spouseIds.filter((id) => !(person.divorcedIds ?? []).includes(id)));
  if (spouses.length > 0) {
    const of = joinNames(spouses, lang);
    if (lang === 'en') {
      const role = person.gender === 'female' ? 'wife' : person.gender === 'male' ? 'husband' : 'spouse';
      return `${role} of ${of}`;
    }
    if (lang === 'ru') {
      const role = person.gender === 'female' ? 'жена' : person.gender === 'male' ? 'муж' : 'супруг(а)';
      return `${role} ${of}`;
    }
    const role = person.gender === 'female' ? 'xotini' : person.gender === 'male' ? 'eri' : 'turmush o‘rtog‘i';
    return `${of}ning ${role}`;
  }

  const children = named(person.childIds).slice(0, 3);
  if (children.length > 0) {
    const of = joinNames(children, lang);
    if (lang === 'en') {
      const role = person.gender === 'female' ? 'mother' : person.gender === 'male' ? 'father' : 'parent';
      return `${role} of ${of}`;
    }
    if (lang === 'ru') {
      const role = person.gender === 'female' ? 'мама' : person.gender === 'male' ? 'папа' : 'родитель';
      return `${role} ${of}`;
    }
    const role = person.gender === 'female' ? 'onasi' : person.gender === 'male' ? 'otasi' : 'ota-onasi';
    return `${of}ning ${role}`;
  }

  return null;
}
