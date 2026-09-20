import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  ArrowRight,
  CalendarPlus,
  Flower2,
  GitBranch,
  Globe,
  Heart,
  HeartHandshake,
  History,
  MapPinned,
  MoonStar,
  Sparkles,
  TreePine,
  UserRoundPlus,
  Users,
} from 'lucide-react';
import { JoinFamilyModal } from '../components/JoinFamilyModal';
import { BirthdayTodayModal } from '../components/BirthdayTodayModal';
import { TraditionTodayModal } from '../components/TraditionTodayModal';
import { HomeBirthdayCelebration } from '../components/HomeBirthdayCelebration';
import { HomeHeroAtmosphere, HomeSectionRule } from '../components/HomeDecor';
import { PersonSearch } from '../components/PersonSearch';
import { BrandMark } from '../components/BrandLogo';
import { useFamily } from '../context/FamilyContext';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { useToast } from '../context/ToastContext';
import { useLanguage, useT } from '../i18n/useT';
import type { TKey } from '../i18n/translations';
import { computeStats } from '../utils/stats';
import { findFounders, fullName, prettyLabel } from '../utils/family';
import { formatDate, formatMonthDay } from '../utils/dates';
import { getUpcomingCelebrations, windowCelebrations } from '../utils/celebrations';
import { downloadFamilyCalendarIcs } from '../utils/ics';
import { setBirthdayModalOpen } from '../lib/firstRunHold';
import { loadJson, saveJson, STORAGE_KEYS } from '../utils/storage';
import { FAMILY_TIMEZONE, dateKeyInTimeZone, nowInTimeZone } from '../utils/timezone';
import { fetchFamilyTimezone } from '../lib/telegramBot';
import { usePrivacy } from '../hooks/usePrivacy';
import { Avatar } from '../components/Avatar';
import { countMissingBirthDates, fetchFilledThisWeek } from '../lib/datesProgress';
import { getUpcomingBirthdays } from '../utils/birthdays';
import { isLivingPerson } from '../utils/living';
import {
  traditionNotifyKey,
  type CustomTradition,
  type UpcomingTradition,
} from '../utils/traditions';
import { fetchCustomTraditions } from '../lib/traditionsStore';

/** How far ahead the homepage looks for upcoming birthdays & anniversaries. */
const CELEBRATION_WINDOW_DAYS = 30;

export function HomePage() {
  const { people } = useFamily();
  const { settings } = useSettings();
  const privacy = usePrivacy();
  const { toast } = useToast();
  const t = useT();
  const language = useLanguage();
  const [joinOpen, setJoinOpen] = useState(false);
  const [bdayPopupOpen, setBdayPopupOpen] = useState(false);
  const [traditionPopupOpen, setTraditionPopupOpen] = useState(false);
  const [customTraditions, setCustomTraditions] = useState<CustomTradition[]>([]);
  const [searchParams, setSearchParams] = useSearchParams();
  const { role } = useAuth();
  const easy = role !== 'owner' && Boolean(settings.easyMode);
  const stats = useMemo(() => computeStats(people), [people]);
  const founders = useMemo(() => findFounders(people).slice(0, 2), [people]);
  const [familyTz, setFamilyTz] = useState(FAMILY_TIMEZONE);
  const [clockTick, setClockTick] = useState(0);
  const [filledWeek, setFilledWeek] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void fetchFamilyTimezone()
      .then((tz) => {
        if (!cancelled && tz) setFamilyTz(tz);
      })
      .catch(() => {
        /* keep Asia/Tashkent */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const tick = () => setClockTick((n) => n + 1);
    const timer = window.setInterval(tick, 60_000);
    const onVis = () => {
      if (document.visibilityState === 'visible') tick();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);

  const familyNow = useMemo(() => nowInTimeZone(familyTz), [familyTz, clockTick]);

  useEffect(() => {
    let cancelled = false;
    void fetchCustomTraditions().then((list) => {
      if (!cancelled) setCustomTraditions(list);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const showBirthDates = privacy.showBirthDate();
  const upcomingCelebrations = useMemo(
    () =>
      getUpcomingCelebrations(people, {
        includeBirthdays: showBirthDates,
        now: familyNow,
        customTraditions,
      }),
    [people, showBirthDates, familyNow, customTraditions],
  );
  const celebrations = useMemo(
    () => windowCelebrations(upcomingCelebrations, CELEBRATION_WINDOW_DAYS),
    [upcomingCelebrations],
  );
  const todaysBirthdays = useMemo(
    () =>
      upcomingCelebrations
        .filter((c) => c.isToday && c.kind === 'birthday')
        .map((c) => (c.kind === 'birthday' ? c.birthday : null))
        .filter((b): b is NonNullable<typeof b> => Boolean(b)),
    [upcomingCelebrations],
  );
  const todaysTraditions = useMemo(
    () =>
      upcomingCelebrations
        .filter((c) => c.isToday && c.kind === 'tradition')
        .map((c) => (c.kind === 'tradition' ? c.tradition : null))
        .filter((row): row is UpcomingTradition => Boolean(row)),
    [upcomingCelebrations],
  );
  const celebratingToday = todaysBirthdays.length > 0 || todaysTraditions.length > 0;

  const nextThreeBirthdays = useMemo(() => {
    if (!showBirthDates) return [];
    return getUpcomingBirthdays(people, familyNow).slice(0, 3);
  }, [people, showBirthDates, familyNow]);

  const missingDatesCount = useMemo(() => countMissingBirthDates(people), [people]);

  useEffect(() => {
    let cancelled = false;
    void fetchFilledThisWeek().then((n) => {
      if (!cancelled) setFilledWeek(n);
    });
    return () => {
      cancelled = true;
    };
  }, [people]);

  useEffect(() => {
    if (todaysBirthdays.length === 0) return;
    const todayKey = dateKeyInTimeZone(familyTz);
    const last = loadJson<string>(
      STORAGE_KEYS.birthdayNotified,
      (v): v is string => typeof v === 'string',
    );
    if (last === todayKey) return;
    saveJson(STORAGE_KEYS.birthdayNotified, todayKey);
    setBirthdayModalOpen(true);
    setBdayPopupOpen(true);
    return () => setBirthdayModalOpen(false);
  }, [todaysBirthdays, familyTz]);

  useEffect(() => {
    if (todaysTraditions.length === 0) return;
    // Let the birthday popup go first when both land on the same day.
    if (bdayPopupOpen) return;
    const notifyKey = todaysTraditions.map(traditionNotifyKey).sort().join('|');
    const last = loadJson<string>(
      STORAGE_KEYS.traditionNotified,
      (v): v is string => typeof v === 'string',
    );
    if (last === notifyKey) return;
    saveJson(STORAGE_KEYS.traditionNotified, notifyKey);
    setTraditionPopupOpen(true);
  }, [todaysTraditions, bdayPopupOpen]);

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

  const faces = useMemo(() => {
    const living = people.filter(isLivingPerson);
    const withPhoto = living.filter((p) => Boolean(p.photo));
    const rest = living.filter((p) => !p.photo);
    return [...withPhoto, ...rest].slice(0, 14);
  }, [people]);
  const moreFaces = Math.max(0, people.filter(isLivingPerson).length - faces.length);

  const traditionHeroTitle = useMemo(() => {
    const first = todaysTraditions[0];
    if (!first) return null;
    const title =
      first.customTitle?.trim() ||
      (first.titleKey ? t(first.titleKey as TKey) : t('tradition.reunionFallback'));
    if (first.kind === 'navruz') return t('tradition.wishNavruz', { title });
    if (first.kind === 'eid_fitr') return t('tradition.wishEidFitr', { title });
    if (first.kind === 'eid_adha') return t('tradition.wishEidAdha', { title });
    if (first.kind === 'new_year') return t('tradition.wishNewYear', { title });
    return t('tradition.wishReunion', { title });
  }, [todaysTraditions, t]);

  const paths = [
    { to: '/tree', title: t('nav.tree'), hint: t('home.pathTreeHint'), kind: 'tree' as const, Icon: TreePine },
    { to: '/members', title: t('nav.members'), hint: t('home.pathMembersHint'), kind: 'members' as const, Icon: Users },
    { to: '/map', title: t('nav.map'), hint: t('home.pathMapHint'), kind: 'map' as const, Icon: MapPinned },
    { to: '/timeline', title: t('nav.timeline'), hint: t('home.pathTimelineHint'), kind: 'timeline' as const, Icon: History },
    { to: '/related', title: t('home.related'), hint: t('home.pathRelatedHint'), kind: 'related' as const, Icon: HeartHandshake },
  ].filter((p) => !easy || p.to !== '/map');

  return (
    <div className="home-page">
      <section
        className={`home-hero overflow-hidden text-stone-50 ${celebratingToday ? 'home-hero--celebrate' : ''}`}
        aria-labelledby="home-brand"
      >
        <HomeHeroAtmosphere />

        <div className="relative mx-auto max-w-3xl px-5 pb-16 pt-10 sm:px-8 sm:pb-20 sm:pt-14">
          <div className="home-hero__mark">
            <BrandMark size="lg" title={t('site.title')} className="!h-[4.5rem] !w-[4.5rem] !rounded-[1.25rem] shadow-lg ring-1 ring-white/10" />
          </div>

          <p className="home-hero__kicker mt-6 text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-emerald-200/80 sm:text-xs">
            {celebratingToday
              ? todaysBirthdays.length > 0
                ? t('home.bdayPopupKicker')
                : t('tradition.popupKicker')
              : t('home.kicker')}
          </p>

          <h1
            id="home-brand"
            className="home-hero__title mt-3 font-display text-[2.15rem] font-semibold leading-[1.1] tracking-tight text-white sm:text-5xl"
          >
            {t('site.title')}
          </h1>
          <HomeSectionRule />

          <p className="home-hero__intro mt-5 max-w-xl text-base leading-relaxed text-stone-200/90 sm:text-lg">
            {todaysBirthdays.length === 1
              ? t('home.bdayPopupTitleOne', { name: fullName(todaysBirthdays[0]!.person) })
              : todaysBirthdays.length > 1
                ? t('home.bdayPopupTitleMany', { n: todaysBirthdays.length })
                : traditionHeroTitle
                  ? traditionHeroTitle
                  : easy
                    ? t('home.introEasy')
                    : t('home.intro')}
          </p>

          <div className="home-hero__search home-hero__jewel relative z-20 mt-8 max-w-lg">
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

          {faces.length > 0 && (
            <div className="home-hero__faces mt-10">
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-100/70">
                {t('home.facesTitle')}
              </p>
              <div className="home-faces">
                {faces.map((person, i) => (
                  <Link
                    key={person.id}
                    to={`/tree?person=${encodeURIComponent(person.id)}`}
                    className="home-face"
                    style={{ zIndex: faces.length - i }}
                    title={fullName(person)}
                  >
                    <Avatar person={person} size="sm" eager={i < 6} />
                  </Link>
                ))}
                {moreFaces > 0 && (
                  <span className="home-face home-face--more" title={t('home.facesMore', { n: moreFaces })}>
                    +{moreFaces}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </section>

      <div className="mx-auto w-full max-w-3xl px-5 sm:px-8 -mt-8 relative z-10">
        {todaysBirthdays.length > 0 && <HomeBirthdayCelebration birthdays={todaysBirthdays} />}

        {nextThreeBirthdays.length > 0 && (
          <section className="home-section mt-8 sm:mt-10" aria-labelledby="home-whos-next">
            <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
              <div>
                <h2
                  id="home-whos-next"
                  className="font-display text-lg font-semibold tracking-tight text-stone-900 dark:text-stone-50 sm:text-xl"
                >
                  {t('home.whosNextTitle')}
                </h2>
                <p className="mt-0.5 text-xs text-stone-500 dark:text-stone-400">{t('home.whosNextIntro')}</p>
              </div>
            </div>
            <ul className="flex gap-3 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {nextThreeBirthdays.map((b) => {
                const showAge = b.turningAge !== null && privacy.showAge(b.person);
                return (
                  <li key={b.person.id} className="min-w-[9.5rem] flex-1">
                    <Link
                      to={`/tree?person=${encodeURIComponent(b.person.id)}`}
                      className="flex h-full flex-col items-center gap-2 rounded-2xl border border-stone-200/80 bg-white/80 px-3 py-4 text-center shadow-sm backdrop-blur-sm transition hover:-translate-y-0.5 hover:border-emerald-300 dark:border-stone-700 dark:bg-stone-900/70 dark:hover:border-emerald-700"
                    >
                      <Avatar person={b.person} size="lg" eager />
                      <p className="w-full truncate font-display text-sm font-semibold text-stone-900 dark:text-stone-100">
                        {fullName(b.person)}
                      </p>
                      <p className="text-xs text-stone-500 dark:text-stone-400">
                        {whenLabel(b.isToday, b.daysUntil)}
                        {` · ${formatMonthDay(b.month, b.day, language)}`}
                      </p>
                      {showAge && (
                        <p className="text-[0.7rem] font-medium text-emerald-900 dark:text-emerald-200">
                          {b.isToday
                            ? t('home.bdayTurnsToday', { age: b.turningAge! })
                            : t('home.bdayTurns', { age: b.turningAge! })}
                        </p>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {(missingDatesCount > 0 || filledWeek > 0) && !easy && (
          <section className="home-section mt-4" aria-label={t('home.datesProgressLabel')}>
            <Link
              to="/members?missing=1"
              className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-amber-200/90 bg-amber-50/80 px-4 py-3 text-sm text-amber-950 transition hover:border-amber-300 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100 dark:hover:border-amber-700"
            >
              <span className="font-medium">
                {missingDatesCount > 0
                  ? t('home.datesProgress', { left: missingDatesCount, filled: filledWeek })
                  : t('home.datesProgressDone', { filled: filledWeek })}
              </span>
              <span className="text-xs font-semibold underline-offset-2 hover:underline">
                {t('home.datesProgressCta')}
              </span>
            </Link>
          </section>
        )}

        <section className="home-section mt-10 sm:mt-12" aria-labelledby="home-paths">
          <div className="mb-4 text-center">
            <h2
              id="home-paths"
              className="font-display text-xl font-semibold tracking-tight text-stone-900 dark:text-stone-50 sm:text-2xl"
            >
              {t('home.pathsTitle')}
            </h2>
            <HomeSectionRule />
            <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-stone-500 dark:text-stone-400">
              {t('home.pathsIntro')}
            </p>
          </div>
          <div className="home-paths aurora-stagger">
            {paths.map(({ to, title, hint, kind, Icon }) => (
              <Link key={to} to={to} className={`home-path home-path--${kind}`}>
                <span className="home-path__icon">
                  <Icon className="h-5 w-5" aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className="block font-display text-base font-semibold">{title}</span>
                  <span className="mt-0.5 block text-xs leading-relaxed opacity-80">{hint}</span>
                </span>
                <ArrowRight className="home-path__arrow h-4 w-4 shrink-0" aria-hidden />
              </Link>
            ))}
          </div>
        </section>

        {celebrations.length > 0 && (
          <section className="home-section mt-8 sm:mt-10" aria-labelledby="home-celebrations">
            <div className="home-section-card overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200/80 px-5 py-4 dark:border-stone-700/80">
                <h2
                  id="home-celebrations"
                  className="font-display text-lg font-semibold tracking-tight text-stone-900 dark:text-stone-50 sm:text-xl"
                >
                  {t('home.celebrationsTitle')}
                </h2>
                {showBirthDates && !easy && (
                  <button
                    type="button"
                    className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-emerald-900 transition-colors hover:bg-emerald-50 dark:text-emerald-200 dark:hover:bg-emerald-950/40"
                    onClick={() => {
                      downloadFamilyCalendarIcs(people, {
                        language,
                        calendarName: t('site.title'),
                        customTraditions,
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
                {celebrations.map((c) => {
                  if (c.kind === 'birthday') {
                    const b = c.birthday;
                    const showAge = b.turningAge !== null && privacy.showAge(b.person);
                    return (
                      <li key={c.key}>
                        <Link
                          to={`/tree?person=${encodeURIComponent(b.person.id)}`}
                          className="home-list-item"
                        >
                          <Avatar person={b.person} size="md" eager />
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-display font-semibold text-stone-900 dark:text-stone-100">
                              {fullName(b.person)}
                            </p>
                            <p className="text-sm text-stone-500 dark:text-stone-400">
                              {t('home.celebrationBirthday')}
                              {' · '}
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
                                ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/50 dark:text-emerald-200'
                                : 'bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-400'
                            }`}
                          >
                            {whenLabel(b.isToday, b.daysUntil)}
                          </span>
                        </Link>
                      </li>
                    );
                  }

                  if (c.kind === 'tradition') {
                    const row = c.tradition;
                    const label =
                      row.customTitle?.trim() ||
                      (row.titleKey ? t(row.titleKey as TKey) : t('tradition.reunionFallback'));
                    const Icon =
                      row.kind === 'navruz'
                        ? Flower2
                        : row.kind === 'eid_fitr' || row.kind === 'eid_adha'
                          ? MoonStar
                          : row.kind === 'reunion'
                            ? Users
                            : Sparkles;
                    return (
                      <li key={c.key}>
                        <div className="home-list-item pointer-events-none">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-900 dark:bg-emerald-900/50 dark:text-emerald-200">
                            <Icon className="h-5 w-5" aria-hidden />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-display font-semibold text-stone-900 dark:text-stone-100">
                              {label}
                            </p>
                            <p className="text-sm text-stone-500 dark:text-stone-400">
                              {t('home.celebrationTradition')}
                              {' · '}
                              {formatMonthDay(row.month, row.day, language)}
                            </p>
                          </div>
                          <span
                            className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums ${
                              row.isToday
                                ? 'bg-amber-100 text-amber-900 dark:bg-amber-900/50 dark:text-amber-200'
                                : 'bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-400'
                            }`}
                          >
                            {whenLabel(row.isToday, row.daysUntil)}
                          </span>
                        </div>
                      </li>
                    );
                  }

                  const a = c.anniversary;
                  const yearsLabel =
                    a.years === null
                      ? null
                      : a.years === 1
                        ? a.isToday
                          ? t('home.annivYearOneToday')
                          : t('home.annivYearOne')
                        : a.isToday
                          ? t('home.annivYearsToday', { n: a.years })
                          : t('home.annivYears', { n: a.years });
                  return (
                    <li key={c.key}>
                      <Link
                        to={`/tree?person=${encodeURIComponent(a.a.id)}`}
                        className="home-list-item"
                      >
                        <div className="flex -space-x-2">
                          <Avatar person={a.a} size="md" />
                          <Avatar person={a.b} size="md" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-display font-semibold text-stone-900 dark:text-stone-100">
                            {fullName(a.a)} & {fullName(a.b)}
                          </p>
                          <p className="text-sm text-stone-500 dark:text-stone-400">
                            {t('home.celebrationAnniversary')}
                            {' · '}
                            {formatMonthDay(a.month, a.day, language)}
                            {yearsLabel && (
                              <>
                                {' · '}
                                {yearsLabel}
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
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          </section>
        )}

        {!easy && (
          <section
            aria-label={t('home.summaryLabel')}
            className="home-section aurora-stagger mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4"
          >
            {[
              { Icon: Users, label: t('home.statMembers'), value: stats.total, tint: 'members' },
              { Icon: GitBranch, label: t('home.statGenerations'), value: stats.generations, tint: 'gens' },
              { Icon: Heart, label: t('home.statLiving'), value: stats.living, tint: 'living' },
              { Icon: Globe, label: t('home.statCountries'), value: stats.countries.length, tint: 'places' },
            ].map((item) => (
              <div key={item.label} className={`home-stat-card home-stat-card--${item.tint}`}>
                <item.Icon className="home-stat-card__icon h-5 w-5" aria-hidden />
                <p className="mt-2 font-display text-2xl font-bold tabular-nums tracking-tight text-stone-900 dark:text-stone-50">
                  {item.value}
                </p>
                <p className="mt-0.5 text-xs font-medium uppercase tracking-wide text-stone-500 dark:text-stone-400">
                  {item.label}
                </p>
              </div>
            ))}
          </section>
        )}

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
                      <Avatar person={person} size="lg" eager />
                      <div className="min-w-0 flex-1">
                        <p className="font-display font-semibold text-stone-900 dark:text-stone-100">
                          {fullName(person)}
                        </p>
                        {privacy.showBirthDate() && person.birthDate && (
                          <p className="mt-0.5 text-sm text-stone-500 dark:text-stone-400">
                            {t('home.born', { date: formatDate(person.birthDate, language) })}
                            {person.country
                              ? ` · ${privacy.showCity() && person.city ? prettyLabel(person.city) + ', ' : ''}${person.country}`
                              : ''}
                          </p>
                        )}
                        {privacy.showOccupation() && person.occupation && (
                          <p className="text-sm text-stone-500 dark:text-stone-400">
                            {prettyLabel(person.occupation)}
                          </p>
                        )}
                      </div>
                      <ArrowRight
                        className="h-4 w-4 shrink-0 text-stone-300 transition-transform group-hover:translate-x-0.5 dark:text-stone-600"
                        aria-hidden
                      />
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
              className="font-medium text-emerald-900 underline-offset-2 hover:underline dark:text-emerald-200"
            >
              {t('home.settingsLink')}
            </Link>
            {t('home.privacyAfter')}
          </p>
        )}
      </div>

      {joinOpen && <JoinFamilyModal onClose={() => setJoinOpen(false)} />}
      {bdayPopupOpen && todaysBirthdays.length > 0 && (
        <BirthdayTodayModal
          birthdays={todaysBirthdays}
          onClose={() => {
            setBdayPopupOpen(false);
            setBirthdayModalOpen(false);
          }}
        />
      )}
      {traditionPopupOpen && todaysTraditions.length > 0 && !bdayPopupOpen && (
        <TraditionTodayModal
          traditions={todaysTraditions}
          onClose={() => setTraditionPopupOpen(false)}
        />
      )}
    </div>
  );
}
