import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowRight, CalendarPlus, UserRoundPlus } from 'lucide-react';
import { JoinFamilyModal } from '../components/JoinFamilyModal';
import { PersonSearch } from '../components/PersonSearch';
import { BrandMark } from '../components/BrandLogo';
import { useFamily } from '../context/FamilyContext';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { useToast } from '../context/ToastContext';
import { useLanguage, useT } from '../i18n/useT';
import { computeStats } from '../utils/stats';
import { findFounders, fullName } from '../utils/family';
import { formatDate, formatMonthDay } from '../utils/dates';
import { getUpcomingBirthdays } from '../utils/birthdays';
import { getUpcomingAnniversaries } from '../utils/anniversaries';
import { downloadFamilyCalendarIcs } from '../utils/ics';
import { loadJson, saveJson, STORAGE_KEYS } from '../utils/storage';
import { usePrivacy } from '../hooks/usePrivacy';
import { Avatar } from '../components/Avatar';

/** How far ahead the homepage looks for upcoming birthdays. */
const BIRTHDAY_WINDOW_DAYS = 30;

export function HomePage() {
  const { people } = useFamily();
  const { settings } = useSettings();
  const privacy = usePrivacy();
  const { toast } = useToast();
  const t = useT();
  const language = useLanguage();
  const [joinOpen, setJoinOpen] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const { role } = useAuth();
  const easy = role !== 'owner' && Boolean(settings.easyMode);
  const stats = useMemo(() => computeStats(people), [people]);
  const founders = useMemo(() => findFounders(people).slice(0, 2), [people]);

  const showBirthDates = privacy.showBirthDate();
  const upcoming = useMemo(
    () => (showBirthDates ? getUpcomingBirthdays(people) : []),
    [people, showBirthDates],
  );
  const birthdays = useMemo(() => {
    const soon = upcoming.filter((b) => b.daysUntil <= BIRTHDAY_WINDOW_DAYS);
    return soon.length > 0 ? soon : upcoming.slice(0, 3);
  }, [upcoming]);

  const upcomingAnniversaries = useMemo(() => getUpcomingAnniversaries(people), [people]);
  const anniversaries = useMemo(() => {
    const soon = upcomingAnniversaries.filter((a) => a.daysUntil <= BIRTHDAY_WINDOW_DAYS);
    return soon.length > 0 ? soon : upcomingAnniversaries.slice(0, 2);
  }, [upcomingAnniversaries]);

  useEffect(() => {
    const todays = upcoming.filter((b) => b.isToday);
    if (todays.length === 0) return;
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

  useEffect(() => {
    if (searchParams.get('invite') === '1' || searchParams.get('join') === '1') {
      setJoinOpen(true);
      const next = new URLSearchParams(searchParams);
      next.delete('invite');
      next.delete('join');
      setSearchParams(next, { replace: true });
      toast(t('invite.openedToast'), 'info');
    }
  }, [searchParams, setSearchParams, toast, t]);

  const whenLabel = (isToday: boolean, daysUntil: number) =>
    isToday
      ? t('home.bdayToday')
      : daysUntil === 1
        ? t('home.bdayTomorrow')
        : t('home.bdayInDays', { n: daysUntil });

  return (
    <div className="home-page pb-14">
      {/* Full-bleed heritage hero — brand first, one composition */}
      <section className="home-hero overflow-hidden text-stone-50" aria-labelledby="home-brand">
        <div className="home-hero__atmosphere" aria-hidden>
          <svg className="home-hero__pedigree" viewBox="0 0 420 420" fill="none">
            <path
              d="M210 48v72M210 120L96 210M210 120l114 90M96 210v78M324 210v78M96 288L48 360M96 288l48 72M324 288l-48 72M324 288l48 72"
              stroke="currentColor"
              strokeWidth="1.25"
              strokeLinecap="round"
            />
            <circle cx="210" cy="42" r="14" fill="currentColor" opacity="0.55" />
            <circle cx="96" cy="210" r="11" fill="currentColor" opacity="0.4" />
            <circle cx="324" cy="210" r="11" fill="currentColor" opacity="0.4" />
            <circle cx="48" cy="360" r="9" fill="currentColor" opacity="0.28" />
            <circle cx="144" cy="360" r="9" fill="currentColor" opacity="0.28" />
            <circle cx="276" cy="360" r="9" fill="currentColor" opacity="0.28" />
            <circle cx="372" cy="360" r="9" fill="currentColor" opacity="0.28" />
          </svg>
        </div>

        <div className="relative mx-auto max-w-3xl px-5 pb-14 pt-10 sm:px-8 sm:pb-18 sm:pt-14">
          <div className="home-hero__mark">
            <BrandMark size="lg" title={t('site.title')} className="!h-[4.5rem] !w-[4.5rem] !rounded-[1.25rem] shadow-lg ring-1 ring-white/10" />
          </div>

          <p className="home-hero__kicker mt-6 text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-emerald-200/80 sm:text-xs">
            {t('home.kicker')}
          </p>

          <h1
            id="home-brand"
            className="home-hero__title mt-3 font-display text-[2.15rem] font-semibold leading-[1.1] tracking-tight text-white sm:text-5xl"
          >
            {t('site.title')}
          </h1>

          <p className="home-hero__intro mt-4 max-w-xl text-base leading-relaxed text-stone-200/90 sm:text-lg">
            {easy ? t('home.introEasy') : t('home.intro')}
          </p>

          <div className="home-hero__search relative z-20 mt-8 max-w-lg">
            <p className="mb-2 text-sm font-medium text-emerald-100/80">{t('home.searchTitle')}</p>
            <PersonSearch large placeholder={t('home.searchPlaceholder')} />
          </div>

          <div className="home-hero__actions mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link
              to="/tree"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-white px-6 py-3 text-base font-semibold text-emerald-950 shadow-lg shadow-emerald-950/20 transition-all hover:bg-emerald-50 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-emerald-950 active:translate-y-0"
            >
              {t('home.explore')}
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
            <button
              type="button"
              onClick={() => setJoinOpen(true)}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-white/25 bg-white/5 px-6 py-3 text-base font-semibold text-white shadow-sm backdrop-blur-sm transition-all hover:bg-white/10 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-emerald-950 active:translate-y-0"
            >
              <UserRoundPlus className="h-4 w-4" aria-hidden />
              {t('home.addSelf')}
            </button>
          </div>
        </div>
      </section>

      <div className="mx-auto w-full max-w-3xl px-5 sm:px-8 -mt-6 relative z-10">
        {/* Upcoming birthdays — calm list, not party badges */}
        {birthdays.length > 0 && (
          <section className="home-section mt-8 sm:mt-10" aria-labelledby="home-birthdays">
            <div className="home-section-card overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200/80 px-5 py-4 dark:border-stone-700/80">
                <h2 id="home-birthdays" className="font-display text-lg font-semibold tracking-tight text-stone-900 dark:text-stone-50 sm:text-xl">
                  {t('home.birthdaysTitle')}
                </h2>
                {showBirthDates && !easy && (
                  <button
                    type="button"
                    className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-emerald-700 transition-colors hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/40"
                    onClick={() => {
                      downloadFamilyCalendarIcs(people, {
                        language,
                        calendarName: t('site.title'),
                      });
                      toast(t('home.calendarDownloaded'), 'info');
                    }}
                  >
                    <CalendarPlus className="h-3.5 w-3.5" aria-hidden />
                    {t('home.downloadCalendar')}
                  </button>
                )}
              </div>
              <ul className="divide-y divide-stone-100 px-2 py-2 sm:px-3 dark:divide-stone-800">
                {birthdays.map((b) => {
                  const showAge = b.turningAge !== null && privacy.showAge(b.person);
                  return (
                    <li key={b.person.id}>
                      <Link
                        to={`/tree?person=${encodeURIComponent(b.person.id)}`}
                        className="home-list-item"
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
                          className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums ${
                            b.isToday
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300'
                              : 'bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-400'
                          }`}
                        >
                          {whenLabel(b.isToday, b.daysUntil)}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          </section>
        )}

        {/* Quiet stats strip — not four flashy cards */}
        {!easy && (
          <section
            aria-label={t('home.summaryLabel')}
            className="home-section mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4"
          >
            {[
              { icon: '👥', label: t('home.statMembers'), value: stats.total },
              { icon: '🌿', label: t('home.statGenerations'), value: stats.generations },
              { icon: '❤️', label: t('home.statLiving'), value: stats.living },
              { icon: '🌍', label: t('home.statCountries'), value: stats.countries.length },
            ].map((item) => (
              <div key={item.label} className="home-stat-card">
                <span className="text-lg" aria-hidden>{item.icon}</span>
                <p className="mt-1.5 font-display text-2xl font-bold tabular-nums tracking-tight text-stone-900 dark:text-stone-50">
                  {item.value}
                </p>
                <p className="mt-0.5 text-xs font-medium uppercase tracking-wide text-stone-500 dark:text-stone-400">
                  {item.label}
                </p>
              </div>
            ))}
          </section>
        )}

        {/* Anniversaries */}
        {!easy && anniversaries.length > 0 && (
          <section className="home-section mt-8" aria-labelledby="home-anniv">
            <div className="home-section-card overflow-hidden">
              <h2
                id="home-anniv"
                className="border-b border-stone-200/80 px-5 py-4 font-display text-lg font-semibold tracking-tight text-stone-900 dark:border-stone-700/80 dark:text-stone-50 sm:text-xl"
              >
                {t('home.annivTitle')}
              </h2>
              <ul className="divide-y divide-stone-100 px-2 py-2 sm:px-3 dark:divide-stone-800">
                {anniversaries.map((a) => (
                  <li key={`${a.a.id}-${a.b.id}`} className="home-list-item !cursor-default">
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
                            {a.years === 1
                              ? a.isToday
                                ? t('home.annivYearOneToday')
                                : t('home.annivYearOne')
                              : a.isToday
                                ? t('home.annivYearsToday', { n: a.years })
                                : t('home.annivYears', { n: a.years })}
                          </>
                        )}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums ${
                        a.isToday
                          ? 'bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-300'
                          : 'bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-400'
                      }`}
                    >
                      {whenLabel(a.isToday, a.daysUntil)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}

        {/* Founders */}
        {!easy && founders.length > 0 && (
          <section className="home-section mt-8" aria-labelledby="home-founders">
            <div className="home-section-card overflow-hidden">
              <h2
                id="home-founders"
                className="border-b border-stone-200/80 px-5 py-4 font-display text-lg font-semibold tracking-tight text-stone-900 dark:border-stone-700/80 dark:text-stone-50 sm:text-xl"
              >
                {t('home.foundersTitle')}
              </h2>
              <ul className="divide-y divide-stone-100 px-2 py-2 sm:px-3 dark:divide-stone-800">
                {founders.map((person) => (
                  <li key={person.id}>
                    <Link
                      to={`/tree?person=${encodeURIComponent(person.id)}`}
                      className="home-list-item group !gap-4"
                    >
                      <Avatar person={person} size="lg" />
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-stone-900 dark:text-stone-100">
                          {fullName(person)}
                        </p>
                        {privacy.showBirthDate() && person.birthDate && (
                          <p className="mt-0.5 text-sm text-stone-500 dark:text-stone-400">
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
                      <ArrowRight className="h-4 w-4 shrink-0 text-stone-300 transition-transform group-hover:translate-x-0.5 dark:text-stone-600" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}

        {!easy && (
          <p className="home-section mt-10 rounded-xl border border-stone-200/60 bg-stone-50/70 px-5 py-4 text-sm leading-relaxed text-stone-500 dark:border-stone-700/60 dark:bg-stone-900/50 dark:text-stone-400">
            <span className="font-medium text-stone-700 dark:text-stone-300">
              {t('home.privacyStrong')}
            </span>{' '}
            {t('home.privacyBefore')}
            <Link
              to="/settings"
              className="font-medium text-emerald-800 underline-offset-2 hover:underline dark:text-emerald-400"
            >
              {t('home.settingsLink')}
            </Link>
            {t('home.privacyAfter')}
          </p>
        )}
      </div>

      {joinOpen && <JoinFamilyModal onClose={() => setJoinOpen(false)} />}
    </div>
  );
}
