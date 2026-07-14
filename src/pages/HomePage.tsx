import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Cake, Gem, Heart, Network, PartyPopper, ShieldCheck, UserRoundPlus, Users } from 'lucide-react';
import { JoinFamilyModal } from '../components/JoinFamilyModal';
import { useFamily } from '../context/FamilyContext';
import { useToast } from '../context/ToastContext';
import { useLanguage, useT } from '../i18n/useT';
import { computeStats } from '../utils/stats';
import { findFounders, fullName } from '../utils/family';
import { formatDate, formatMonthDay } from '../utils/dates';
import { getUpcomingBirthdays } from '../utils/birthdays';
import { getUpcomingAnniversaries } from '../utils/anniversaries';
import { loadJson, saveJson, STORAGE_KEYS } from '../utils/storage';
import { usePrivacy } from '../hooks/usePrivacy';
import { Avatar } from '../components/Avatar';

/** How far ahead the homepage looks for upcoming birthdays. */
const BIRTHDAY_WINDOW_DAYS = 30;

export function HomePage() {
  const { people } = useFamily();
  const privacy = usePrivacy();
  const { toast } = useToast();
  const t = useT();
  const language = useLanguage();
  const [joinOpen, setJoinOpen] = useState(false);
  const stats = useMemo(() => computeStats(people), [people]);
  const founders = useMemo(() => findFounders(people).slice(0, 2), [people]);

  // Birth dates are gated by privacy, so hide birthdays entirely when they are.
  const showBirthDates = privacy.showBirthDate();
  const upcoming = useMemo(
    () => (showBirthDates ? getUpcomingBirthdays(people) : []),
    [people, showBirthDates],
  );
  // Show everyone whose birthday is within the next month. In a quiet stretch
  // with none coming up soon, still show the next few so the card is never
  // empty — it always tells you who's up next and how far away it is.
  const birthdays = useMemo(() => {
    const soon = upcoming.filter((b) => b.daysUntil <= BIRTHDAY_WINDOW_DAYS);
    return soon.length > 0 ? soon : upcoming.slice(0, 3);
  }, [upcoming]);

  // Wedding anniversaries follow the same window/fallback rule as birthdays.
  const upcomingAnniversaries = useMemo(() => getUpcomingAnniversaries(people), [people]);
  const anniversaries = useMemo(() => {
    const soon = upcomingAnniversaries.filter((a) => a.daysUntil <= BIRTHDAY_WINDOW_DAYS);
    return soon.length > 0 ? soon : upcomingAnniversaries.slice(0, 2);
  }, [upcomingAnniversaries]);

  // Notify once per day when someone has a birthday today. The stored date
  // guards against re-toasting on every re-visit to the homepage.
  useEffect(() => {
    const todays = upcoming.filter((b) => b.isToday);
    if (todays.length === 0) return;
    // Local calendar date — `isToday` is computed in local time, so the
    // once-per-day key must be too (toISOString flips to UTC at 05:00 in UZ).
    const now = new Date();
    const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const last = loadJson<string>(
      STORAGE_KEYS.birthdayNotified,
      (v): v is string => typeof v === 'string',
    );
    if (last === todayKey) return;
    saveJson(STORAGE_KEYS.birthdayNotified, todayKey);
    toast(
      todays.length === 1
        ? t('home.bdayToastOne', { name: fullName(todays[0].person) })
        : t('home.bdayToastMany', { names: todays.map((b) => fullName(b.person)).join(', ') }),
      'info',
    );
  }, [upcoming, toast, t]);

  return (
    <div className="mx-auto w-full max-w-7xl px-4 sm:px-6">
      {/* Hero */}
      <section className="relative mt-6 overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-800 via-emerald-900 to-stone-900 px-6 py-16 text-emerald-50 shadow-xl sm:px-12 sm:py-20">
        <Network
          className="pointer-events-none absolute -right-10 -top-10 h-64 w-64 rotate-12 text-emerald-700/30"
          aria-hidden
        />
        <p className="text-sm font-semibold uppercase tracking-widest text-emerald-300">
          {t('home.kicker')}
        </p>
        <h1 className="mt-3 max-w-2xl text-4xl font-extrabold tracking-tight sm:text-5xl">
          {t('home.title')}
        </h1>
        <p className="mt-4 max-w-2xl text-emerald-100/90">
          {t('home.intro', { countries: Math.max(stats.countries.length, 1) })}
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            to="/tree"
            className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 font-semibold text-emerald-900 shadow transition-transform hover:scale-[1.02] focus-visible:ring-2 focus-visible:ring-white"
          >
            {t('home.explore')}
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
          <Link
            to="/members"
            className="inline-flex items-center gap-2 rounded-xl border border-emerald-400/40 px-5 py-3 font-semibold text-emerald-50 transition-colors hover:bg-emerald-800/60 focus-visible:ring-2 focus-visible:ring-white"
          >
            <Users className="h-4 w-4" aria-hidden />
            {t('home.browse')}
          </Link>
          <button
            type="button"
            onClick={() => setJoinOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl border border-emerald-400/40 px-5 py-3 font-semibold text-emerald-50 transition-colors hover:bg-emerald-800/60 focus-visible:ring-2 focus-visible:ring-white"
          >
            <UserRoundPlus className="h-4 w-4" aria-hidden />
            {t('home.addSelf')}
          </button>
        </div>
      </section>

      {/* Summary stats */}
      <section aria-label="Family summary" className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: t('home.statMembers'), value: stats.total },
          { label: t('home.statGenerations'), value: stats.generations },
          { label: t('home.statLiving'), value: stats.living },
          { label: t('home.statCountries'), value: stats.countries.length },
        ].map((item) => (
          <div key={item.label} className="card p-5 text-center">
            <p className="text-3xl font-extrabold text-emerald-700 dark:text-emerald-400">
              {item.value}
            </p>
            <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">{item.label}</p>
          </div>
        ))}
      </section>

      {/* Upcoming birthdays */}
      {birthdays.length > 0 && (
        <section className="card mt-8 p-6">
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <Cake className="h-5 w-5 text-rose-500" aria-hidden />
            {t('home.birthdaysTitle')}
          </h2>
          <ul className="mt-4 space-y-2">
            {birthdays.map((b) => {
              const when = b.isToday
                ? t('home.bdayToday')
                : b.daysUntil === 1
                  ? t('home.bdayTomorrow')
                  : t('home.bdayInDays', { n: b.daysUntil });
              const showAge = b.turningAge !== null && privacy.showAge(b.person);
              return (
                <li
                  key={b.person.id}
                  className={`flex items-center gap-3 rounded-2xl p-3 ${
                    b.isToday
                      ? 'bg-rose-50 ring-1 ring-rose-200 dark:bg-rose-950/40 dark:ring-rose-900'
                      : 'bg-stone-50 dark:bg-stone-800/60'
                  }`}
                >
                  <Avatar person={b.person} size="md" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-stone-900 dark:text-stone-100">
                      {fullName(b.person)}
                    </p>
                    <p className="text-sm text-stone-500 dark:text-stone-400">
                      {formatMonthDay(b.month, b.day, language)}
                      {showAge && (
                        <>
                          {' · '}
                          {b.isToday
                            ? t('home.bdayTurnsToday', { age: b.turningAge! })
                            : t('home.bdayTurns', { age: b.turningAge! })}
                        </>
                      )}
                    </p>
                  </div>
                  <span
                    className={`flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
                      b.isToday
                        ? 'bg-rose-500 text-white'
                        : 'bg-stone-200 text-stone-600 dark:bg-stone-700 dark:text-stone-300'
                    }`}
                  >
                    {b.isToday && <PartyPopper className="h-3.5 w-3.5" aria-hidden />}
                    {when}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Upcoming wedding anniversaries */}
      {anniversaries.length > 0 && (
        <section className="card mt-8 p-6">
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <Gem className="h-5 w-5 text-amber-500" aria-hidden />
            {t('home.annivTitle')}
          </h2>
          <ul className="mt-4 space-y-2">
            {anniversaries.map((a) => {
              const when = a.isToday
                ? t('home.bdayToday')
                : a.daysUntil === 1
                  ? t('home.bdayTomorrow')
                  : t('home.bdayInDays', { n: a.daysUntil });
              return (
                <li
                  key={`${a.a.id}-${a.b.id}`}
                  className={`flex items-center gap-3 rounded-2xl p-3 ${
                    a.isToday
                      ? 'bg-amber-50 ring-1 ring-amber-200 dark:bg-amber-950/40 dark:ring-amber-900'
                      : 'bg-stone-50 dark:bg-stone-800/60'
                  }`}
                >
                  <div className="flex -space-x-2">
                    <Avatar person={a.a} size="md" />
                    <Avatar person={a.b} size="md" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-stone-900 dark:text-stone-100">
                      {fullName(a.a)} & {fullName(a.b)}
                    </p>
                    <p className="text-sm text-stone-500 dark:text-stone-400">
                      {formatMonthDay(a.month, a.day, language)}
                      {a.years !== null && (
                        <>
                          {' · '}
                          {a.isToday
                            ? t('home.annivYearsToday', { n: a.years })
                            : t('home.annivYears', { n: a.years })}
                        </>
                      )}
                    </p>
                  </div>
                  <span
                    className={`flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
                      a.isToday
                        ? 'bg-amber-500 text-white'
                        : 'bg-stone-200 text-stone-600 dark:bg-stone-700 dark:text-stone-300'
                    }`}
                  >
                    {a.isToday && <PartyPopper className="h-3.5 w-3.5" aria-hidden />}
                    {when}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Founding couple */}
      {founders.length > 0 && (
        <section className="card mt-8 p-6">
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <Heart className="h-5 w-5 text-rose-500" aria-hidden />
            {t('home.foundersTitle')}
          </h2>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {founders.map((person) => (
              <div
                key={person.id}
                className="flex items-center gap-4 rounded-2xl bg-stone-50 p-4 dark:bg-stone-800/60"
              >
                <Avatar person={person} size="lg" />
                <div className="min-w-0">
                  <p className="font-semibold text-stone-900 dark:text-stone-100">
                    {fullName(person)}
                  </p>
                  {privacy.showBirthDate() && person.birthDate && (
                    <p className="text-sm text-stone-500 dark:text-stone-400">
                      {t('home.born', { date: formatDate(person.birthDate, language) })}
                      {person.country
                        ? ` · ${privacy.showCity() && person.city ? person.city + ', ' : ''}${person.country}`
                        : ''}
                    </p>
                  )}
                  {privacy.showOccupation() && person.occupation && (
                    <p className="text-sm text-stone-500 dark:text-stone-400">
                      {person.occupation}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Privacy notice */}
      <section className="mb-10 mt-8 flex items-start gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
        <p>
          <strong>{t('home.privacyStrong')}</strong> {t('home.privacyBefore')}
          <Link to="/settings" className="underline">
            {t('home.settingsLink')}
          </Link>
          {t('home.privacyAfter')}
        </p>
      </section>

      {joinOpen && <JoinFamilyModal onClose={() => setJoinOpen(false)} />}
    </div>
  );
}
