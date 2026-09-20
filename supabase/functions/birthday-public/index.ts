/**
 * Public birthday celebration payload — no password / JWT.
 * Live on the birthday (family timezone). The next calendar day is a
 * “yesterday” page. After that the link expires so profiles stay private.
 *
 * Also serves:
 * - `?mode=missing&k=<token>` — living relatives without a full birth date
 *   (requires a signed Telegram link token, valid ~7 days)
 * - POST `?mode=set-birth` — update only birth_date with a valid dates link token
 * - POST `?mode=cheer` — web “Men tabriklayman” with a display name
 */
import {
  ageTurning,
  birthdayPagePhase,
  corsHeaders,
  createServiceClient,
  displayName,
  jsonResponse,
  localParts,
  monthDay,
  shiftLocalDate,
  telegramApi,
  DEFAULT_FAMILY_TIMEZONE,
  type FamilyMemberRow,
} from '../_shared/telegram.ts';
import { verifyDatesLinkToken } from '../_shared/datesLink.ts';
import { cardDesignSeed, normalizeCardGender, pickCardDesign } from '../_shared/cardTheme.ts';
import {
  birthdayPageWish,
  birthdayYesterdayWish,
  cheerAlreadyText,
  cheerAnnounceWebText,
} from '../_shared/wishes.ts';
import { whoIsThisUzbek } from '../_shared/whoIsThis.ts';

type MemberRow = {
  id: string;
  first_name: string;
  last_name: string;
  nickname: string | null;
  gender: string | null;
  birth_date: string | null;
  death_date: string | null;
  is_deceased: boolean;
  photo: string | null;
};

type ServiceDb = ReturnType<typeof createServiceClient>;

function toFamilyRow(person: MemberRow): FamilyMemberRow {
  return {
    id: person.id,
    first_name: person.first_name,
    last_name: person.last_name,
    nickname: person.nickname,
    gender: (person.gender as FamilyMemberRow['gender']) ?? undefined,
    birth_date: person.birth_date,
    death_date: person.death_date,
    is_deceased: person.is_deceased,
    photo: person.photo,
  };
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function cleanCheerName(raw: string): string | null {
  const name = raw.replace(/\s+/g, ' ').trim().slice(0, 40);
  if (name.length < 2) return null;
  return name;
}

async function listMissingBirthdays(db: ServiceDb): Promise<Response> {
  const members = await db.rest<MemberRow[]>('family_members', {
    query: {
      select: 'id,first_name,last_name,nickname,gender,birth_date,death_date,is_deceased,photo',
      order: 'first_name.asc',
    },
  });

  const missing = members.filter((m) => !m.is_deceased && !m.death_date && !monthDay(m.birth_date));
  if (missing.length === 0) {
    return jsonResponse({ ok: true, count: 0, people: [] });
  }

  let rels: { kind: string; person_a: string; person_b: string }[] = [];
  try {
    rels = await db.rest('family_relationships', {
      query: { select: 'kind,person_a,person_b' },
    });
  } catch (err) {
    console.warn('missing whoLine: relationships unavailable', err);
  }

  const allRows = members.map(toFamilyRow);
  const people = [];
  for (const person of missing) {
    const row = toFamilyRow(person);
    const whoLine = whoIsThisUzbek(row, allRows, rels);
    const photoUrl = person.photo ? await db.signPhoto(person.photo) : null;
    people.push({
      id: person.id,
      name: displayName(person),
      gender: normalizeCardGender(person.gender),
      whoLine,
      photoUrl,
    });
  }

  return jsonResponse({ ok: true, count: people.length, people });
}

async function setBirthDateWithLink(
  db: ServiceDb,
  body: Record<string, unknown>,
): Promise<Response> {
  const token = typeof body.k === 'string' ? body.k : typeof body.token === 'string' ? body.token : '';
  if (!(await verifyDatesLinkToken(token))) {
    return jsonResponse({ ok: false, error: 'unauthorized' }, 401);
  }
  const personId = typeof body.personId === 'string' ? body.personId.trim() : '';
  const birthDate = typeof body.birthDate === 'string' ? body.birthDate.trim() : '';
  if (!personId || personId.length > 80) {
    return jsonResponse({ ok: false, error: 'personId required' }, 400);
  }
  if (!monthDay(birthDate)) {
    return jsonResponse({ ok: false, error: 'invalid_birth_date' }, 400);
  }

  const people = await db.rest<MemberRow[]>('family_members', {
    query: {
      select: 'id,first_name,last_name,nickname,gender,birth_date,death_date,is_deceased,photo',
      id: `eq.${personId}`,
    },
  });
  const person = people[0];
  if (!person || person.is_deceased || person.death_date) {
    return jsonResponse({ ok: false, error: 'not_found' }, 404);
  }
  // Only fill missing month/day — do not overwrite known full birthdays.
  if (monthDay(person.birth_date)) {
    return jsonResponse({ ok: false, error: 'already_has_date' }, 409);
  }

  await db.rest('family_members', {
    method: 'PATCH',
    query: { id: `eq.${personId}` },
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ birth_date: birthDate }),
  });

  return jsonResponse({ ok: true, personId, birthDate });
}

async function loadCheers(
  db: ServiceDb,
  personId: string,
  year: number,
): Promise<{ name: string; username: string | null }[]> {
  try {
    const rows = await db.rest<{ display_name: string; username: string | null }[]>(
      'telegram_birthday_cheers',
      {
        query: {
          select: 'display_name,username,created_at',
          person_id: `eq.${personId}`,
          year: `eq.${year}`,
          order: 'created_at.asc',
        },
      },
    );
    return rows.map((c) => ({ name: c.display_name, username: c.username }));
  } catch (err) {
    console.warn('cheers unavailable', err);
    return [];
  }
}

async function postWebCheer(db: ServiceDb, body: Record<string, unknown>): Promise<Response> {
  const personId = typeof body.personId === 'string' ? body.personId.trim() : '';
  const name = typeof body.name === 'string' ? cleanCheerName(body.name) : null;
  if (!personId || personId.length > 80) {
    return jsonResponse({ ok: false, error: 'personId required' }, 400);
  }
  if (!name) {
    return jsonResponse({ ok: false, error: 'name_required' }, 400);
  }

  const people = await db.rest<MemberRow[]>('family_members', {
    query: {
      select: 'id,first_name,last_name,nickname,gender,birth_date,death_date,is_deceased,photo',
      id: `eq.${personId}`,
    },
  });
  const person = people[0];
  if (!person || person.is_deceased || person.death_date) {
    return jsonResponse({ ok: false, error: 'not_found' }, 404);
  }

  const settings = await db.rest<{ timezone: string; group_chat_id: string | null }[]>(
    'telegram_settings',
    { query: { select: 'timezone,group_chat_id', id: 'eq.1' } },
  );
  const tz = settings[0]?.timezone || DEFAULT_FAMILY_TIMEZONE;
  const local = localParts(tz);
  const md = monthDay(person.birth_date);
  if (!md) return jsonResponse({ ok: false, error: 'expired' }, 404);
  const phase = birthdayPagePhase(md, local);
  if (phase === 'none') return jsonResponse({ ok: false, error: 'expired' }, 404);

  const occurrence = phase === 'yesterday' ? shiftLocalDate(local, -1) : local;
  const year = occurrence.year;
  const honoree = displayName(person);

  const existing = await db.rest<{ id: number }[]>('telegram_birthday_cheers', {
    query: {
      select: 'id',
      person_id: `eq.${personId}`,
      year: `eq.${year}`,
      source: 'eq.web',
      display_name: `ilike.${name}`,
      limit: '1',
    },
  });
  if (Array.isArray(existing) && existing.length > 0) {
    const cheers = await loadCheers(db, personId, year);
    return jsonResponse({
      ok: true,
      already: true,
      message: cheerAlreadyText(),
      cheers,
      year,
    });
  }

  // Soft cap — unique names only; still stop spam floods on one birthday page.
  const WEB_CHEER_CAP = 40;
  try {
    const webCount = await db.rest<{ id: number }[]>('telegram_birthday_cheers', {
      query: {
        select: 'id',
        person_id: `eq.${personId}`,
        year: `eq.${year}`,
        source: 'eq.web',
      },
    });
    if (Array.isArray(webCount) && webCount.length >= WEB_CHEER_CAP) {
      const cheers = await loadCheers(db, personId, year);
      return jsonResponse({ ok: false, error: 'cheer_limit', cheers, year }, 429);
    }
  } catch (err) {
    console.warn('web cheer count failed', err);
  }

  try {
    await db.rest('telegram_birthday_cheers', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        person_id: personId,
        year,
        telegram_user_id: null,
        display_name: name,
        username: null,
        source: 'web',
      }),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // Unique race (23505 / 409) → already cheered; anything else is a real failure.
    if (/\b409\b|23505|unique/i.test(msg)) {
      console.warn('web cheer unique race', err);
      const cheers = await loadCheers(db, personId, year);
      return jsonResponse({
        ok: true,
        already: true,
        message: cheerAlreadyText(),
        cheers,
        year,
      });
    }
    console.error('web cheer insert failed', err);
    return jsonResponse({ ok: false, error: 'failed' }, 500);
  }

  const groupChatId = settings[0]?.group_chat_id;
  if (groupChatId) {
    try {
      await telegramApi('sendMessage', {
        chat_id: groupChatId,
        text: cheerAnnounceWebText(escapeHtml(name), escapeHtml(honoree)),
        parse_mode: 'HTML',
      });
    } catch (err) {
      console.warn('web cheer announce failed', err);
    }
  }

  const cheers = await loadCheers(db, personId, year);
  return jsonResponse({ ok: true, already: false, cheers, year });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const db = createServiceClient();

    if (url.searchParams.get('mode') === 'missing') {
      const token = url.searchParams.get('k') || url.searchParams.get('token') || '';
      if (!(await verifyDatesLinkToken(token))) {
        return jsonResponse({ ok: false, error: 'unauthorized' }, 401);
      }
      return await listMissingBirthdays(db);
    }

    if (url.searchParams.get('mode') === 'cheer' && req.method === 'POST') {
      const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
      return await postWebCheer(db, body);
    }

    if (url.searchParams.get('mode') === 'set-birth' && req.method === 'POST') {
      const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
      return await setBirthDateWithLink(db, body);
    }

    let personId = url.searchParams.get('personId') || '';
    if (!personId && req.method === 'POST') {
      const body = await req.json().catch(() => ({}));
      personId = typeof body.personId === 'string' ? body.personId : '';
    }
    personId = personId.trim();
    if (!personId || personId.length > 80) {
      return jsonResponse({ ok: false, error: 'personId required' }, 400);
    }

    const people = await db.rest<MemberRow[]>('family_members', {
      query: {
        select: 'id,first_name,last_name,nickname,gender,birth_date,death_date,is_deceased,photo',
        id: `eq.${personId}`,
      },
    });
    const person = people[0];
    if (!person || person.is_deceased || person.death_date) {
      return jsonResponse({ ok: false, error: 'not_found' }, 404);
    }

    const settings = await db.rest<{ timezone: string }[]>('telegram_settings', {
      query: { select: 'timezone', id: 'eq.1' },
    });
    const tz = settings[0]?.timezone || DEFAULT_FAMILY_TIMEZONE;
    const local = localParts(tz);
    const md = monthDay(person.birth_date);
    if (!md) {
      return jsonResponse({ ok: false, error: 'expired' }, 404);
    }

    const phase = birthdayPagePhase(md, local);
    if (phase === 'none') {
      return jsonResponse({ ok: false, error: 'expired' }, 404);
    }

    const occurrence = phase === 'yesterday' ? shiftLocalDate(local, -1) : local;
    const age = ageTurning(md, occurrence.year);
    const name = displayName(person);
    const gender = normalizeCardGender(person.gender);
    const design = pickCardDesign(cardDesignSeed(person.id, occurrence.year));
    const photoUrl = person.photo ? await db.signPhoto(person.photo) : null;
    const wish =
      phase === 'yesterday' ? birthdayYesterdayWish(name, age) : birthdayPageWish(name, age, 'uz');

    let whoLine: string | null = null;
    try {
      const rels = await db.rest<{ kind: string; person_a: string; person_b: string }[]>(
        'family_relationships',
        {
          query: {
            select: 'kind,person_a,person_b',
            or: `(person_a.eq.${personId},person_b.eq.${personId})`,
          },
        },
      );
      const relatedIds = [...new Set([personId, ...rels.flatMap((r) => [r.person_a, r.person_b])])];
      const related = await db.rest<FamilyMemberRow[]>('family_members', {
        query: {
          select: 'id,first_name,last_name,nickname,gender,birth_date,death_date,is_deceased,photo',
          id: `in.(${relatedIds.join(',')})`,
        },
      });
      whoLine = whoIsThisUzbek(toFamilyRow(person), related, rels);
    } catch (err) {
      console.warn('whoLine unavailable', err);
    }

    const cheers = await loadCheers(db, personId, occurrence.year);

    return jsonResponse({
      ok: true,
      when: phase,
      design,
      year: occurrence.year,
      person: {
        id: person.id,
        name,
        gender,
        age,
        photoUrl,
        birthMonthDay: `${String(md.month).padStart(2, '0')}-${String(md.day).padStart(2, '0')}`,
        wish,
        whoLine,
      },
      cheers,
    });
  } catch (error) {
    console.error(error);
    return jsonResponse(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      500,
    );
  }
});
