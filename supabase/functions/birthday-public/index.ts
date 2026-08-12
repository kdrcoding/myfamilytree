/**
 * Public birthday celebration payload — no password / JWT.
 * Only returns a safe subset for the /bday/:personId page, and only around
 * that person's birthday (family timezone), so profiles aren't scrapeable year-round.
 */
import {
  ageTurning,
  corsHeaders,
  createServiceClient,
  displayName,
  isBirthdayToday,
  jsonResponse,
  localParts,
  monthDay,
} from '../_shared/telegram.ts';
import { birthdayPageWish } from '../_shared/wishes.ts';

/** Allow the page the day before / on / day after the birthday (timezone). */
function nearBirthday(
  birth: { month: number; day: number },
  local: { year: number; month: number; day: number },
): boolean {
  if (isBirthdayToday(birth, local)) return true;
  const today = Date.UTC(local.year, local.month - 1, local.day);
  for (const delta of [-1, 1]) {
    const d = new Date(today + delta * 86400000);
    const probe = {
      year: d.getUTCFullYear(),
      month: d.getUTCMonth() + 1,
      day: d.getUTCDate(),
    };
    if (isBirthdayToday(birth, probe)) return true;
  }
  return false;
}

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
        birth_date: string | null;
        death_date: string | null;
        is_deceased: boolean;
        photo: string | null;
      }[]
    >('family_members', {
      query: {
        select: 'id,first_name,last_name,nickname,birth_date,death_date,is_deceased,photo',
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
    if (!md || !nearBirthday(md, local)) {
      return jsonResponse({ ok: false, error: 'not_found' }, 404);
    }

    const age = ageTurning(md, local.year);
    const name = displayName(person);
    const photoUrl = person.photo ? await db.signPhoto(person.photo) : null;

    let cheers: { name: string; username: string | null }[] = [];
    try {
      const rows = await db.rest<
        { display_name: string; username: string | null; created_at: string }[]
      >('telegram_birthday_cheers', {
        query: {
          select: 'display_name,username,created_at',
          person_id: `eq.${personId}`,
          year: `eq.${local.year}`,
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
      person: {
        id: person.id,
        name,
        age,
        photoUrl,
        birthMonthDay: `${String(md.month).padStart(2, '0')}-${String(md.day).padStart(2, '0')}`,
        wish: birthdayPageWish(name, age),
      },
      year: local.year,
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
