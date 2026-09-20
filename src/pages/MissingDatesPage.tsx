import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CalendarDays, Check, Loader2, Lock, Sparkles, UserRound } from 'lucide-react';
import { BrandLogo } from '../components/BrandLogo';
import { useSettings } from '../context/SettingsContext';
import { useToast } from '../context/ToastContext';
import { useLanguage, useT } from '../i18n/useT';
import { markDatesPass } from '../lib/birthdayPass';
import { isSupabaseConfigured } from '../lib/supabase';
import {
  fetchMissingBirthdays,
  isVisiblePhotoUrl,
  looksLikeDatesLinkToken,
  normalizeDatesLinkToken,
  peekDatesLinkExpiryMs,
  setPublicBirthDate,
  type MissingBirthdayPerson,
} from '../features/birthday/publicApi';
import { prettyLabel } from '../utils/family';
import { isValidDateString } from '../utils/dates';
import { loadJson, saveJson, STORAGE_KEYS } from '../utils/storage';

type PageState = 'loading' | 'locked' | 'bad' | 'expired' | 'failed' | 'empty' | 'list';

function readSavedName(): string {
  return (
    loadJson<string>(STORAGE_KEYS.displayName, (v): v is string => typeof v === 'string')?.trim() ??
    ''
  );
}

function formatExpiry(ms: number, language: string): string {
  try {
    return new Date(ms).toLocaleString(
      language === 'uz' ? 'uz-UZ' : language === 'ru' ? 'ru-RU' : 'en-US',
      { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' },
    );
  } catch {
    return new Date(ms).toISOString();
  }
}

/**
 * Fill missing birth dates via a signed Telegram link (`/dates?k=…`).
 * Edit right here: name once, then pick a date per person — no detour to Members.
 */
export function MissingDatesPage() {
  const t = useT();
  const language = useLanguage();
  const { toast } = useToast();
  const { settings, setLanguage } = useSettings();
  const [searchParams] = useSearchParams();
  const linkToken = useMemo(
    () =>
      normalizeDatesLinkToken(
        searchParams.get('k') || searchParams.get('token') || '',
      ),
    [searchParams],
  );
  const [people, setPeople] = useState<MissingBirthdayPerson[]>([]);
  const [state, setState] = useState<PageState>(() => {
    if (!linkToken) return 'locked';
    if (!looksLikeDatesLinkToken(linkToken)) return 'bad';
    return 'loading';
  });
  const [retryKey, setRetryKey] = useState(0);
  const [actorName, setActorName] = useState(readSavedName);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftDate, setDraftDate] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);
  const [nameError, setNameError] = useState('');

  const expiresAt = useMemo(() => peekDatesLinkExpiryMs(linkToken), [linkToken]);
  const expiryLabel =
    expiresAt && expiresAt > Date.now() ? formatExpiry(expiresAt, language) : null;

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
    if (!looksLikeDatesLinkToken(linkToken)) {
      setState('bad');
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

  const ensureName = (): string | null => {
    const trimmed = actorName.trim().slice(0, 40);
    if (trimmed.length < 2) {
      setNameError(t('dates.nameRequired'));
      return null;
    }
    setNameError('');
    saveJson(STORAGE_KEYS.displayName, trimmed);
    return trimmed;
  };

  const openEditor = (person: MissingBirthdayPerson) => {
    setEditingId(person.id);
    setDraftDate('');
    setNameError('');
  };

  const saveDate = async (person: MissingBirthdayPerson) => {
    const name = ensureName();
    if (!name) return;
    const date = draftDate.trim();
    if (!isValidDateString(date)) {
      toast(t('dates.dateInvalid'), 'error');
      return;
    }
    setSavingId(person.id);
    try {
      const result = await setPublicBirthDate(person.id, date, linkToken, name);
      if (!result.ok) {
        if (result.error === 'unauthorized') {
          setState('expired');
          toast(t('dates.expiredTitle'), 'error');
        } else {
          toast(t('dates.saveFailed'), 'error');
        }
        return;
      }
      markDatesPass(linkToken);
      setPeople((prev) => {
        const next = prev.filter((p) => p.id !== person.id);
        if (next.length === 0) setState('empty');
        return next;
      });
      setEditingId(null);
      setDraftDate('');
      toast(t('dates.saved', { name: prettyLabel(person.name) }), 'success');
    } catch (error) {
      console.error(error);
      toast(t('dates.saveFailed'), 'error');
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="app-shell relative min-h-dvh overflow-hidden">
      <div className="pointer-events-none absolute inset-0 opacity-40" aria-hidden>
        <span className="absolute left-[8%] top-[16%] text-4xl">📅</span>
        <span className="absolute right-[10%] top-[22%] text-3xl">🎂</span>
        <span className="absolute left-[12%] bottom-[18%] text-3xl">✨</span>
      </div>

      <div className="relative z-10 mx-auto flex min-h-dvh max-w-lg flex-col px-5 pb-10 pt-8 sm:pt-12">
        <div className="flex w-full items-start justify-between gap-3">
          <BrandLogo size="md" className="max-w-[14rem]" />
          <select
            className="input !w-auto !py-1.5 !text-xs"
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
          <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-teal-900/75">
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
            {t('dates.kicker')}
          </p>
          <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight text-teal-950">
            {t('dates.title')}
          </h1>
          <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-stone-700">
            {t('dates.intro')}
          </p>
          {expiryLabel && (state === 'list' || state === 'empty' || state === 'loading') && (
            <p className="mt-3 text-xs font-medium text-teal-900/80">
              {t('dates.validUntil', { when: expiryLabel })}
            </p>
          )}
        </header>

        {state === 'loading' && (
          <div className="mt-20 flex flex-1 flex-col items-center justify-center gap-3 text-teal-900">
            <Loader2 className="h-8 w-8 animate-spin" aria-hidden />
            <p className="text-sm font-medium">{t('dates.loading')}</p>
          </div>
        )}

        {(state === 'locked' || state === 'expired' || state === 'bad') && (
          <div className="home-section-card mt-16 p-8 text-center">
            <Lock className="mx-auto h-10 w-10 text-teal-800" aria-hidden />
            <h2 className="mt-4 font-display text-xl font-semibold text-teal-950">
              {state === 'locked'
                ? t('dates.lockedTitle')
                : state === 'bad'
                  ? t('dates.badLinkTitle')
                  : t('dates.expiredTitle')}
            </h2>
            <p className="mt-2 text-sm text-stone-600">
              {state === 'locked'
                ? t('dates.lockedBody')
                : state === 'bad'
                  ? t('dates.badLinkBody')
                  : t('dates.expiredBody')}
            </p>
            <Link to="/" className="btn-primary mt-5 inline-flex min-h-11 items-center justify-center">
              {t('dates.openHome')}
            </Link>
          </div>
        )}

        {state === 'failed' && (
          <div className="home-section-card mt-16 p-8 text-center">
            <CalendarDays className="mx-auto h-10 w-10 text-teal-700" aria-hidden />
            <h2 className="mt-4 font-display text-xl font-semibold text-teal-950">{t('dates.failedTitle')}</h2>
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
          <div className="home-section-card mt-16 p-8 text-center">
            <p className="text-4xl" aria-hidden>
              🎉
            </p>
            <h2 className="mt-4 font-display text-xl font-semibold text-teal-950">{t('dates.emptyTitle')}</h2>
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
            <div className="home-section-card mt-8 p-4">
              <label className="block text-left text-xs font-semibold uppercase tracking-wide text-teal-900/80">
                {t('dates.yourName')}
              </label>
              <div className="mt-1.5 flex items-center gap-2">
                <UserRound className="h-4 w-4 shrink-0 text-teal-800" aria-hidden />
                <input
                  type="text"
                  className="input min-h-11 flex-1"
                  value={actorName}
                  maxLength={40}
                  autoComplete="name"
                  placeholder={t('dates.yourNamePlaceholder')}
                  onChange={(e) => {
                    setActorName(e.target.value);
                    if (nameError) setNameError('');
                  }}
                />
              </div>
              {nameError ? (
                <p className="mt-1.5 text-left text-xs font-medium text-rose-700">{nameError}</p>
              ) : (
                <p className="mt-1.5 text-left text-xs text-stone-600">{t('dates.yourNameHint')}</p>
              )}
            </div>

            <p className="mt-6 text-center text-sm font-medium text-teal-950/90">
              {t('dates.count', { n: people.length })}
            </p>

            <ul className="mt-3 space-y-2">
              {people.map((person) => {
                const name = prettyLabel(person.name);
                const photo =
                  isVisiblePhotoUrl(person.photoUrl) && person.photoUrl ? person.photoUrl : null;
                const open = editingId === person.id;
                const busy = savingId === person.id;
                return (
                  <li key={person.id}>
                    <div className="rounded-2xl border border-teal-900/15 bg-[rgb(200_222_214/0.88)] shadow-sm backdrop-blur">
                      <button
                        type="button"
                        className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition hover:bg-[rgb(214_230_224/0.55)]"
                        onClick={() => (open ? setEditingId(null) : openEditor(person))}
                        aria-expanded={open}
                      >
                        {photo ? (
                          <img
                            src={photo}
                            alt=""
                            referrerPolicy="no-referrer"
                            className="h-11 w-11 rounded-full object-cover ring-2 ring-white/70"
                          />
                        ) : (
                          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-teal-500 to-teal-700 text-sm font-bold text-white ring-2 ring-white/70">
                            {name.slice(0, 1).toUpperCase()}
                          </span>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-semibold text-stone-900">{name}</p>
                          {person.whoLine && (
                            <p className="truncate text-xs text-stone-600">
                              {prettyLabel(person.whoLine)}
                            </p>
                          )}
                        </div>
                        <CalendarDays className="h-4 w-4 shrink-0 text-teal-800" aria-hidden />
                      </button>

                      {open && (
                        <div className="border-t border-teal-900/10 px-3 pb-3 pt-2">
                          <label className="block text-xs font-semibold text-teal-900/80">
                            {t('dates.birthDateLabel')}
                          </label>
                          <div className="mt-1.5 flex flex-col gap-2 sm:flex-row">
                            <input
                              type="date"
                              className="input min-h-11 flex-1"
                              value={draftDate}
                              max={new Date().toISOString().slice(0, 10)}
                              onChange={(e) => setDraftDate(e.target.value)}
                              autoFocus
                            />
                            <button
                              type="button"
                              className="btn-primary inline-flex min-h-11 items-center justify-center gap-1.5 sm:min-w-[8.5rem]"
                              disabled={busy}
                              onClick={() => void saveDate(person)}
                            >
                              {busy ? (
                                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                              ) : (
                                <Check className="h-4 w-4" aria-hidden />
                              )}
                              {t('dates.saveDate')}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>

            <p className="mt-4 text-center text-xs leading-relaxed text-stone-600">
              {t('dates.fillHint')}
            </p>
          </>
        )}

        <p className="mt-auto pt-10 text-center text-xs text-stone-600">{t('dates.footer')}</p>
      </div>
    </div>
  );
}
