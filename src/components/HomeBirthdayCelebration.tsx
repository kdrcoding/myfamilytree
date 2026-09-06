import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, PartyPopper } from 'lucide-react';
import { BirthdayWebCard } from './BirthdayWebCard';
import { usePhotoUrl } from '../context/PhotoUrlsContext';
import { useFamily } from '../context/FamilyContext';
import { useLanguage, useT } from '../i18n/useT';
import { isVisiblePhotoUrl, fetchPublicBirthday, celebrationDesign, type PublicBirthday } from '../features/birthday/publicApi';
import { birthdayPalette, normalizeCardGender } from '../features/birthday/themes';
import type { UpcomingBirthday } from '../utils/birthdays';
import { fullName } from '../utils/family';
import { describeWho } from '../utils/whoIsThis';
import { isStoragePhoto } from '../lib/photoStorage';
import type { FamilyPerson } from '../types/family';

function localCelebration(
  birthday: UpcomingBirthday,
  photoUrl: string | null,
  wish: string,
  whoLine: string | null,
): PublicBirthday {
  const person = birthday.person;
  const year = new Date().getFullYear();
  return {
    ok: true,
    when: 'today',
    design: celebrationDesign(person.id, year),
    year,
    person: {
      id: person.id,
      name: fullName(person),
      gender: normalizeCardGender(person.gender),
      age: birthday.turningAge,
      photoUrl,
      birthMonthDay: `${String(birthday.month).padStart(2, '0')}-${String(birthday.day).padStart(2, '0')}`,
      wish,
      whoLine,
    },
    cheers: [],
  };
}

function OneCelebration({
  birthday,
  fetched,
  people,
}: {
  birthday: UpcomingBirthday;
  fetched: PublicBirthday | undefined;
  people: FamilyPerson[];
}) {
  const t = useT();
  const language = useLanguage();
  const signed = usePhotoUrl(birthday.person.photo);
  const inline =
    birthday.person.photo && !isStoragePhoto(birthday.person.photo) && isVisiblePhotoUrl(birthday.person.photo)
      ? birthday.person.photo
      : null;
  const fallbackPhoto = signed || inline;
  const whoLine = describeWho(birthday.person, people, language) || fetched?.person?.whoLine || null;
  const local = localCelebration(birthday, fallbackPhoto, t('bday.wish'), whoLine);
  const data = fetched?.ok && fetched.person ? fetched : local;
  const person = {
    ...data.person!,
    photoUrl: data.person?.photoUrl || fallbackPhoto,
    whoLine,
  };
  const design = data.design ?? local.design!;
  const accent = birthdayPalette(normalizeCardGender(person.gender)).accent;

  return (
    <BirthdayWebCard
      person={person}
      when={data.when === 'yesterday' ? 'yesterday' : 'today'}
      design={design}
      cheers={data.cheers ?? []}
      compact
      footer={
        <Link
          to={`/bday/${encodeURIComponent(person.id)}`}
          className="relative z-10 mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-semibold text-white shadow-md"
          style={{ background: accent }}
        >
          <PartyPopper className="h-4 w-4" aria-hidden />
          {t('home.openCelebration')}
        </Link>
      }
    />
  );
}

/**
 * Today’s birthday(s) on Home — the same web celebration as /bday/:id,
 * compact, with a link to the full page. Not the Telegram PNG card.
 */
export function HomeBirthdayCelebration({ birthdays }: { birthdays: UpcomingBirthday[] }) {
  const t = useT();
  const { people } = useFamily();
  const [active, setActive] = useState(0);
  const [fetched, setFetched] = useState<Record<string, PublicBirthday>>({});

  const ids = useMemo(() => birthdays.map((b) => b.person.id).join('|'), [birthdays]);

  useEffect(() => {
    setActive(0);
  }, [ids]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const entries = await Promise.all(
        birthdays.map(async (b) => {
          try {
            const data = await fetchPublicBirthday(b.person.id);
            return [b.person.id, data] as const;
          } catch {
            return [b.person.id, { ok: false, error: 'failed' } as PublicBirthday] as const;
          }
        }),
      );
      if (cancelled) return;
      setFetched(Object.fromEntries(entries));
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [ids, birthdays]);

  if (birthdays.length === 0) return null;

  const index = Math.min(active, birthdays.length - 1);
  const current = birthdays[index]!;
  const multi = birthdays.length > 1;

  return (
    <section className="home-section mt-8 sm:mt-10" aria-labelledby="home-today-bday">
      <div className="mb-3 flex items-end justify-between gap-3 px-1">
        <h2
          id="home-today-bday"
          className="font-display text-lg font-semibold tracking-tight text-emerald-950 dark:text-emerald-50 sm:text-xl"
        >
          {t('home.todaySpotlightTitle')}
        </h2>
        {multi && (
          <p className="text-xs font-medium text-emerald-800/80 dark:text-emerald-200/80">
            {t('home.todayBirthdayCount', { n: birthdays.length })}
          </p>
        )}
      </div>

      <OneCelebration birthday={current} fetched={fetched[current.person.id]} people={people} />

      {multi && (
        <div className="mt-3 flex items-center justify-center gap-2">
          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-emerald-900/15 bg-white text-emerald-900 shadow-sm disabled:opacity-40 dark:border-emerald-700/40 dark:bg-stone-900 dark:text-emerald-100"
            onClick={() => setActive((i) => (i - 1 + birthdays.length) % birthdays.length)}
            aria-label={t('home.prevBirthday')}
          >
            <ChevronLeft className="h-5 w-5" aria-hidden />
          </button>
          <div className="flex gap-1.5" role="tablist" aria-label={t('home.todaySpotlightTitle')}>
            {birthdays.map((b, i) => (
              <button
                key={b.person.id}
                type="button"
                role="tab"
                aria-selected={i === index}
                className={`h-2.5 rounded-full transition-all ${
                  i === index ? 'w-6 bg-emerald-700 dark:bg-emerald-400' : 'w-2.5 bg-emerald-300 dark:bg-emerald-800'
                }`}
                onClick={() => setActive(i)}
                aria-label={fullName(b.person)}
              />
            ))}
          </div>
          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-emerald-900/15 bg-white text-emerald-900 shadow-sm dark:border-emerald-700/40 dark:bg-stone-900 dark:text-emerald-100"
            onClick={() => setActive((i) => (i + 1) % birthdays.length)}
            aria-label={t('home.nextBirthday')}
          >
            <ChevronRight className="h-5 w-5" aria-hidden />
          </button>
        </div>
      )}
    </section>
  );
}
