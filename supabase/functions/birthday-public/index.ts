/**
 * Public birthday celebration payload — no password / JWT.
 * Only returns a safe subset for the /bday/:personId page.
 */
import {
  ageTurning,
  corsHeaders,
  createServiceClient,
  displayName,
  jsonResponse,
  localParts,
  monthDay,
} from '../_shared/telegram.ts';

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
    const age = md ? ageTurning(md, local.year) : null;
    const photoUrl = person.photo ? await db.signPhoto(person.photo) : null;

    const cheers = await db.rest<
      { display_name: string; username: string | null; created_at: string }[]
    >('telegram_birthday_cheers', {
      query: {
        select: 'display_name,username,created_at',
        person_id: `eq.${personId}`,
        year: `eq.${local.year}`,
        order: 'created_at.asc',
      },
    });

    return jsonResponse({
      ok: true,
      person: {
        id: person.id,
        name: displayName(person),
        age,
        photoUrl,
        birthMonthDay: md ? `${String(md.month).padStart(2, '0')}-${String(md.day).padStart(2, '0')}` : null,
      },
      year: local.year,
      cheers: cheers.map((c) => ({
        name: c.display_name,
        username: c.username,
      })),
    });
  } catch (error) {
    console.error(error);
    return jsonResponse(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      500,
    );
  }
});
