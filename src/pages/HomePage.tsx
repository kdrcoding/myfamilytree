import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  ArrowRight,
  Cake,
  CalendarPlus,
  Gem,
  GitBranch,
  Heart,
  Link2,
  Network,
  PartyPopper,
  ShieldCheck,
  UserRoundPlus,
  Users,
} from 'lucide-react';
import { JoinFamilyModal } from '../components/JoinFamilyModal';
import { PersonSearch } from '../components/PersonSearch';
import { useFamily } from '../context/FamilyContext';
import { useSettings } from '../context/SettingsContext';
import { useToast } from '../context/ToastContext';
import { useLanguage, useT } from '../i18n/useT';
import { computeStats } from '../utils/stats';
import { findFounders, fullName } from '../utils/family';
import { formatDate, formatMonthDay } from '../utils/dates';
import { getUpcomingBirthdays } from '../utils/birthdays';
import { getUpcomingAnniversaries } from '../utils/anniversaries';
import { downloadFamilyCalendarIcs } from '../utils/ics';
import { inviteUrl } from '../utils/notifications';
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
  const easy = Boolean(settings.easyMode);
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

  // Invite link: after unlock, open Add yourself and clear the query.
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

  const copyInvite = async () => {
    const url = inviteUrl();
    try {
      await navigator.clipboard.writeText(url);
      toast(t('invite.copied'), 'success');
    } catch {
      toast(url, 'info');
    }
  };

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-8 sm:px-6">
      {/* Hero — compact on phones so search + buttons + birthdays fit on screen */}
      <section
        className={`relative mt-4 overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-800 via-emerald-900 to-stone-900 text-emerald-50 shadow-xl sm:mt-6 ${
          easy ? 'px-5 py-7 sm:px-10 sm:py-12' : 'px-5 py-8 sm:px-12 sm:py-16'
        }`}
      >
        <Network
          className="pointer-events-none absolute -right-10 -top-10 hidden h-64 w-64 rotate-12 text-emerald-700/30 sm:block"
          aria-hidden
        />
        <p className="text-xs font-semibold uppercase tracking-widest text-emerald-300 sm:text-sm">
          {t('home.kicker')}
        </p>
        <h1
          className={`mt-2 max-w-2xl font-extrabold tracking-tight ${
            easy ? 'text-2xl sm:text-4xl' : 'text-2xl sm:text-5xl'
          }`}
        >
          {t('home.title')}
        </h1>
        <p className="mt-2 hidden max-w-2xl text-emerald-100/90 sm:mt-4 sm:block">
          {easy ? t('home.introEasy') : t('home.intro')}
        </p>
        <p className="mt-2 text-sm text-emerald-100/90 sm:hidden">{t('home.introMobile')}</p>

        {/* Big search — primary way elders find someone */}
        <div className="relative z-20 mt-5 max-w-xl sm:mt-8">
          <p className="mb-2 text-sm font-semibold text-emerald-200">{t('home.searchTitle')}</p>
          <PersonSearch large placeholder={t('home.searchPlaceholder')} />
        </div>

        {/* Full-width stacked actions on phones — hard to miss */}
        <div className="mt-5 flex flex-col gap-2.5 sm:mt-6 sm:flex-row sm:flex-wrap sm:gap-3">
          <Link
            to="/tree"
            className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3.5 text-base font-bold text-emerald-900 shadow transition-transform hover:scale-[1.01] focus-visible:ring-2 focus-visible:ring-white sm:w-auto sm:rounded-xl sm:py-3 sm:text-sm sm:font-semibold"
          >
            {t('home.explore')}
            <ArrowRight className="h-5 w-5" aria-hidden />
          </Link>
          <Link
            to="/related"
            className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border-2 border-emerald-300/50 bg-emerald-800/40 px-5 py-3.5 text-base font-bold text-emerald-50 transition-colors hover:bg-emerald-800/60 focus-visible:ring-2 focus-visible:ring-white sm:w-auto sm:rounded-xl sm:border sm:border-emerald-400/40 sm:bg-transparent sm:py-3 sm:text-sm sm:font-semibold"
          >
            <GitBranch className="h-5 w-5" aria-hidden />
            {t('home.related')}
          </Link>
          <Link
            to="/members"
            className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border-2 border-emerald-300/50 bg-emerald-800/40 px-5 py-3.5 text-base font-bold text-emerald-50 transition-colors hover:bg-emerald-800/60 focus-visible:ring-2 focus-visible:ring-white sm:w-auto sm:rounded-xl sm:border sm:border-emerald-400/40 sm:bg-transparent sm:py-3 sm:text-sm sm:font-semibold"
          >
            <Users className="h-5 w-5" aria-hidden />
            {t('home.browse')}
          </Link>
          <button
            type="button"
            onClick={() => setJoinOpen(true)}
            className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border-2 border-emerald-300/50 bg-emerald-800/40 px-5 py-3.5 text-base font-bold text-emerald-50 transition-colors hover:bg-emerald-800/60 focus-visible:ring-2 focus-visible:ring-white sm:w-auto sm:rounded-xl sm:border sm:border-emerald-400/40 sm:bg-transparent sm:py-3 sm:text-sm sm:font-semibold"
          >
            <UserRoundPlus className="h-5 w-5" aria-hidden />
            {t('home.addSelf')}
          </button>
          <button
            type="button"
            onClick={() => void copyInvite()}
            className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-emerald-300/40 bg-transparent px-5 py-3.5 text-base font-bold text-emerald-100 transition-colors hover:bg-emerald-800/40 focus-visible:ring-2 focus-visible:ring-white sm:w-auto sm:rounded-xl sm:py-3 sm:text-sm sm:font-semibold"
          >
            <Link2 className="h-5 w-5" aria-hidden />
            {t('invite.copyBtn')}
          </button>
        </div>
      </section>

      {/* Birthdays move up — first thing after hero so phones see them without scrolling far */}
      {birthdays.length > 0 && (
        <section className="card mt-5 p-4 sm:mt-8 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 text-lg font-bold">
              <Cake className="h-5 w-5 text-rose-500" aria-hidden />
              {t('home.birthdaysTitle')}
            </h2>
            {showBirthDates && !easy && (
              <button
                type="button"
                className="btn-secondary !px-3 text-sm"
                onClick={() => {
                  downloadFamilyCalendarIcs(people, {
                    language,
                    calendarName: t('site.title'),
                  });
                  toast(t('home.calendarDownloaded'), 'info');
                }}
              >
                <CalendarPlus className="h-4 w-4" aria-hidden />
                {t('home.downloadCalendar')}
              </button>
            )}
          </div>
          <ul className="mt-3 space-y-2 sm:mt-4">
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

      {/* Stats — after birthdays; hidden in Easy Mode */}
      {!easy && (
        <section aria-label={t('home.summaryLabel')} className="mt-5 grid grid-cols-2 gap-3 sm:mt-8 sm:gap-4 lg:grid-cols-4">
          {[
            { label: t('home.statMembers'), value: stats.total },
            { label: t('home.statGenerations'), value: stats.generations },
            { label: t('home.statLiving'), value: stats.living },
            { label: t('home.statCountries'), value: stats.countries.length },
          ].map((item) => (
            <div key={item.label} className="card p-4 text-center sm:p-5">
              <p className="text-2xl font-extrabold text-emerald-700 dark:text-emerald-400 sm:text-3xl">
                {item.value}
              </p>
              <p className="mt-1 text-xs text-stone-500 dark:text-stone-400 sm:text-sm">
                {item.label}
              </p>
            </div>
          ))}
        </section>
      )}

      {/* Anniversaries — skip in Easy Mode */}
      {!easy && anniversaries.length > 0 && (
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

      {/* Founders — skip in Easy Mode */}
      {!easy && founders.length > 0 && (
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

      {!easy && (
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
      )}

      {easy && <div className="mb-10" />}

      {joinOpen && <JoinFamilyModal onClose={() => setJoinOpen(false)} />}
    </div>
  );
}
