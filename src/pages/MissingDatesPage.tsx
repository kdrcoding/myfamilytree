import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CalendarDays, Loader2, Lock, Sparkles, UserRoundPen } from 'lucide-react';
import { BrandLogo } from '../components/BrandLogo';
import { useSettings } from '../context/SettingsContext';
import { useT } from '../i18n/useT';
import { markDatesPass } from '../lib/birthdayPass';
import { isSupabaseConfigured } from '../lib/supabase';
import {
  fetchMissingBirthdays,
  isVisiblePhotoUrl,
  type MissingBirthdayPerson,
} from '../features/birthday/publicApi';
import { prettyLabel } from '../utils/family';

type PageState = 'loading' | 'locked' | 'expired' | 'failed' | 'empty' | 'list';

/**
 * Fill missing birth dates via a signed Telegram link (`/dates?k=…`).
 * Bare `/dates` is locked. Valid links last ~7 days; filling still asks for a name.
 */
export function MissingDatesPage() {
  const t = useT();
  const { settings, setLanguage } = useSettings();
  const [searchParams] = useSearchParams();
  const linkToken = (searchParams.get('k') || searchParams.get('token') || '').trim();
  const [people, setPeople] = useState<MissingBirthdayPerson[]>([]);
  const [state, setState] = useState<PageState>(linkToken ? 'loading' : 'locked');
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('dark');
    return () => {
      root.classList.toggle('dark', settings.theme === 'dark');
    };
  }, [settings.theme]);

  useEffect(() => {
    if (!linkToken) {
      setState('locked');
      setPeople([]);
      return;
    }

    let cancelled = false;
    const load = async () => {
      setState('loading');
      try {
        if (!isSupabaseConfigured) {
          if (!cancelled) {
            setState('failed');
            setPeople([]);
          }
          return;
        }
        const next = await fetchMissingBirthdays(linkToken);
        if (cancelled) return;
        if (!next.ok) {
          setPeople([]);
          setState(next.error === 'unauthorized' ? 'expired' : 'failed');
          return;
        }
        const list = next.people ?? [];
        setPeople(list);
        if (list.length > 0) {
          markDatesPass(linkToken);
          setState('list');
        } else {
          setState('empty');
        }
      } catch (error) {
        console.error(error);
        if (!cancelled) {
          setState('failed');
          setPeople([]);
        }
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [linkToken, retryKey]);

  useEffect(() => {
    const previous = document.title;
    document.title = t('dates.title');
    return () => {
      document.title = previous || 'Oq-Ariq OILASI';
    };
  }, [t]);

  const fillHref = `/members?missing=1&from=dates`;
  const keepPass = () => {
    if (linkToken && people.length > 0) markDatesPass(linkToken);
  };

  return (
    <div className="relative min-h-dvh overflow-hidden bg-gradient-to-b from-amber-50 via-rose-50/40 to-emerald-50/60">
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <span className="absolute left-[8%] top-[16%] text-4xl opacity-40">📅</span>
        <span className="absolute right-[10%] top-[22%] text-3xl opacity-35">🎂</span>
        <span className="absolute left-[12%] bottom-[18%] text-3xl opacity-30">✨</span>
      </div>

      <div className="relative z-10 mx-auto flex min-h-dvh max-w-lg flex-col px-5 pb-10 pt-8 sm:pt-12">
        <div className="flex w-full items-start justify-between gap-3">
          <BrandLogo size="md" className="max-w-[14rem]" />
          <select
            className="rounded-lg border border-amber-200/80 bg-white/85 px-2 py-1.5 text-xs font-medium text-amber-950 shadow-sm backdrop-blur"
            value={settings.language}
            onChange={(e) => setLanguage(e.target.value as typeof settings.language)}
            aria-label={t('nav.language')}
          >
            <option value="uz">UZ</option>
            <option value="en">EN</option>
            <option value="ru">RU</option>
          </select>
        </div>

        <header className="mt-8 text-center">
          <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-800/80">
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
            {t('dates.kicker')}
          </p>
          <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight text-amber-950">
            {t('dates.title')}
          </h1>
          <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-stone-600">
            {t('dates.intro')}
          </p>
        </header>

        {state === 'loading' && (
          <div className="mt-20 flex flex-1 flex-col items-center justify-center gap-3 text-amber-900">
            <Loader2 className="h-8 w-8 animate-spin" aria-hidden />
            <p className="text-sm font-medium">{t('dates.loading')}</p>
          </div>
        )}

        {(state === 'locked' || state === 'expired') && (
          <div className="mt-16 rounded-3xl border border-white/70 bg-white/90 p-8 text-center shadow-lg shadow-amber-900/5 backdrop-blur">
            <Lock className="mx-auto h-10 w-10 text-amber-700" aria-hidden />
            <h2 className="mt-4 font-display text-xl font-semibold text-amber-950">
              {state === 'locked' ? t('dates.lockedTitle') : t('dates.expiredTitle')}
            </h2>
            <p className="mt-2 text-sm text-stone-600">
              {state === 'locked' ? t('dates.lockedBody') : t('dates.expiredBody')}
            </p>
            <Link to="/" className="btn-primary mt-5 inline-flex min-h-11 items-center justify-center">
              {t('dates.openHome')}
            </Link>
          </div>
        )}

        {state === 'failed' && (
          <div className="mt-16 rounded-3xl border border-white/70 bg-white/90 p-8 text-center shadow-lg shadow-amber-900/5 backdrop-blur">
            <CalendarDays className="mx-auto h-10 w-10 text-amber-600" aria-hidden />
            <h2 className="mt-4 font-display text-xl font-semibold text-amber-950">{t('dates.failedTitle')}</h2>
            <p className="mt-2 text-sm text-stone-600">{t('dates.failedBody')}</p>
            <button
              type="button"
              className="btn-primary mt-5 inline-flex min-h-11 items-center justify-center"
              onClick={() => setRetryKey((n) => n + 1)}
            >
              {t('dates.retry')}
            </button>
          </div>
        )}

        {state === 'empty' && (
          <div className="mt-16 rounded-3xl border border-white/70 bg-white/90 p-8 text-center shadow-lg shadow-emerald-900/5 backdrop-blur">
            <p className="text-4xl" aria-hidden>
              🎉
            </p>
            <h2 className="mt-4 font-display text-xl font-semibold text-emerald-950">{t('dates.emptyTitle')}</h2>
            <p className="mt-2 text-sm text-stone-600">{t('dates.emptyBody')}</p>
            <Link
              to="/"
              className="btn-primary mt-6 inline-flex min-h-11 w-full items-center justify-center"
            >
              {t('dates.openHome')}
            </Link>
          </div>
        )}

        {state === 'list' && (
          <>
            <p className="mt-8 text-center text-sm font-medium text-amber-900/90">
              {t('dates.count', { n: people.length })}
            </p>

            <ul className="mt-4 space-y-2">
              {people.map((person) => {
                const name = prettyLabel(person.name);
                const photo =
                  isVisiblePhotoUrl(person.photoUrl) && person.photoUrl ? person.photoUrl : null;
                return (
                  <li key={person.id}>
                    <Link
                      to={`/members?missing=1&from=dates&edit=${encodeURIComponent(person.id)}`}
                      onClick={keepPass}
                      className="flex items-center gap-3 rounded-2xl border border-amber-900/10 bg-white/90 px-3 py-2.5 shadow-sm transition hover:bg-amber-50/80"
                    >
                      {photo ? (
                        <img
                          src={photo}
                          alt=""
                          referrerPolicy="no-referrer"
                          className="h-11 w-11 rounded-full object-cover ring-2 ring-white"
                        />
                      ) : (
                        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-rose-400 text-sm font-bold text-white ring-2 ring-white">
                          {name.slice(0, 1).toUpperCase()}
                        </span>
                      )}
                      <div className="min-w-0 flex-1 text-left">
                        <p className="truncate font-semibold text-stone-900">{name}</p>
                        {person.whoLine && (
                          <p className="truncate text-xs text-stone-500">{prettyLabel(person.whoLine)}</p>
                        )}
                      </div>
                      <UserRoundPen className="h-4 w-4 shrink-0 text-amber-700" aria-hidden />
                    </Link>
                  </li>
                );
              })}
            </ul>

            <Link
              to={fillHref}
              onClick={keepPass}
              className="mt-6 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-amber-700 px-4 py-3 text-base font-semibold text-white shadow-md shadow-amber-900/20"
            >
              <CalendarDays className="h-5 w-5" aria-hidden />
              {t('dates.fillAll')}
            </Link>
            <p className="mt-3 text-center text-xs leading-relaxed text-stone-500">{t('dates.fillHint')}</p>
          </>
        )}

        <p className="mt-auto pt-10 text-center text-xs text-stone-500">{t('dates.footer')}</p>
      </div>
    </div>
  );
}
