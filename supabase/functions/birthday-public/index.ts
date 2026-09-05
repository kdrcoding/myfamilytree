/**
 * Public birthday celebration payload — no password / JWT.
 * Live on the birthday (family timezone). The next calendar day is a
 * “yesterday” page. After that the link expires so profiles stay private.
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
} from '../_shared/telegram.ts';
import { cardDesignSeed, normalizeCardGender, pickCardDesign } from '../_shared/cardTheme.ts';
import { birthdayPageWish, birthdayYesterdayWish } from '../_shared/wishes.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    let personId = url.searchParams.get('personId') || '';
    if (!personId && req.method === 'POST') {
      const body = await req.json().catch(() => ({}));
      personId = typeof body.personId === 'string' ? body.personId : '';
    }
    personId = personId.trim();
    if (!personId || personId.length > 80) {
      return jsonResponse({ ok: false, error: 'personId required' }, 400);
    }

    const db = createServiceClient();
    const people = await db.rest<
      {
        id: string;
        first_name: string;
        last_name: string;
        nickname: string | null;
        gender: string | null;
        birth_date: string | null;
        death_date: string | null;
        is_deceased: boolean;
        photo: string | null;
      }[]
    >('family_members', {
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
    const tz = settings[0]?.timezone || 'America/Los_Angeles';
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

    let cheers: { name: string; username: string | null }[] = [];
    try {
      const rows = await db.rest<
        { display_name: string; username: string | null; created_at: string }[]
      >('telegram_birthday_cheers', {
        query: {
          select: 'display_name,username,created_at',
          person_id: `eq.${personId}`,
          year: `eq.${occurrence.year}`,
          order: 'created_at.asc',
        },
      });
      cheers = rows.map((c) => ({
        name: c.display_name,
        username: c.username,
      }));
    } catch (err) {
      console.warn('cheers unavailable', err);
    }

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
