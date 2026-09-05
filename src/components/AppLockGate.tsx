import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Eye, EyeOff, Loader2, LockKeyhole, Smile } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { OWNER_DEFAULT_NAME } from '../config/access';
import { useAuth } from '../context/AuthContext';
import { useT } from '../i18n/useT';
import { supabase } from '../lib/supabase';
import { loadJson, saveJson, STORAGE_KEYS } from '../utils/storage';
import { BrandHero } from './BrandLogo';
import { LanguageMenuButton } from './LanguageSelect';
import { useSettings } from '../context/SettingsContext';

function readSavedName(): string {
  return (
    loadJson<string>(STORAGE_KEYS.displayName, (v): v is string => typeof v === 'string')?.trim() ??
    ''
  );
}

/**
 * Site gate: password to enter. Owner (Kadir) skips the name step.
 * Returning sessions restore automatically via Supabase (no re-prompt
 * until Sign out) — the owner password is never stored in the app bundle.
 */
export function AppLockGate({ children }: { children: ReactNode }) {
  const { role, ready, signIn } = useAuth();
  const t = useT();
  const { settings } = useSettings();
  const [searchParams] = useSearchParams();
  const fromBirthday = searchParams.get('from') === 'bday';
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [savedName, setSavedName] = useState(readSavedName);
  const [nameDraft, setNameDraft] = useState(savedName);
  const [nameError, setNameError] = useState('');
  const [awaitingName, setAwaitingName] = useState(false);

  const unlocked = ready && role !== 'viewer';
  const liveName = (savedName.length >= 2 ? savedName : readSavedName()).trim();
  const needsName = unlocked && role !== 'owner' && (awaitingName || liveName.length < 2);

  useEffect(() => {
    if (!ready) return;
    if (role === 'owner') {
      saveJson(STORAGE_KEYS.displayName, OWNER_DEFAULT_NAME);
      setSavedName(OWNER_DEFAULT_NAME);
      setAwaitingName(false);
      return;
    }
    if (role === 'viewer') return;
    const existing = readSavedName();
    if (existing.length >= 2) {
      setSavedName(existing);
      setNameDraft(existing);
      setAwaitingName(false);
      return;
    }
    setAwaitingName(true);
    setSavedName('');
    setNameDraft('');
  }, [ready, role]);

  useEffect(() => {
    if (!fromBirthday) return;
    const root = document.documentElement;
    root.classList.remove('dark');
    return () => {
      root.classList.toggle('dark', settings.theme === 'dark');
    };
  }, [fromBirthday, settings.theme]);

  if (unlocked && !needsName) return <>{children}</>;

  const submitPassword = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!password) {
      setError(t('gate.enter'));
      return;
    }
    setBusy(true);
    setError('');
    try {
      const found = await signIn(password);
      if (!found) {
        setError(t('gate.wrong'));
      } else if (found === 'owner') {
        setAwaitingName(false);
      } else {
        const existing = readSavedName();
        if (existing.length >= 2) {
          setSavedName(existing);
          setAwaitingName(false);
        } else {
          setNameDraft(existing);
          setNameError('');
          setAwaitingName(true);
        }
      }
    } catch (err) {
      console.error('Sign-in failed:', err);
      setError(t('gate.wrong'));
    } finally {
      setBusy(false);
    }
  };

  const submitName = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = nameDraft.trim().slice(0, 40);
    if (trimmed.length < 2) {
      setNameError(t('gate.nameRequired'));
      return;
    }
    saveJson(STORAGE_KEYS.displayName, trimmed);
    if (supabase) {
      void supabase.auth.updateUser({ data: { display_name: trimmed } });
    }
    setSavedName(trimmed);
    setAwaitingName(false);
  };

  return (
    <div className={`flex min-h-dvh flex-col items-center justify-center px-4 pb-[max(2.5rem,env(safe-area-inset-bottom))] pt-[max(2.5rem,env(safe-area-inset-top))] text-stone-900 dark:bg-stone-950 dark:text-stone-100 ${fromBirthday ? 'bg-gradient-to-b from-emerald-100 via-emerald-50 to-stone-50' : 'bg-stone-50'}`}>
      {!ready ? (
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" aria-hidden />
      ) : needsName ? (
        <div className="w-full max-w-sm rounded-3xl border border-emerald-200/70 bg-white/90 p-6 shadow-sm sm:p-8 dark:border-stone-700 dark:bg-stone-900/90">
          <div className="flex justify-end">
            <LanguageMenuButton />
          </div>
          <div className="flex flex-col items-center text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
              <Smile className="h-6 w-6" aria-hidden />
            </span>
            <h1 className="mt-4 text-xl font-bold tracking-tight text-stone-900 dark:text-stone-50">
              {t('gate.welcomeTitle')}
            </h1>
            <p className="mt-2 text-sm text-stone-500 dark:text-stone-400">{t('gate.welcomeIntro')}</p>
          </div>

          <form onSubmit={submitName} className="mt-6 space-y-4">
            <label className="block text-left">
              <span className="mb-1 block text-sm font-medium text-stone-700 dark:text-stone-300">
                {t('gate.yourName')}
              </span>
              <input
                type="text"
                className="input min-h-12 text-base sm:text-base"
                value={nameDraft}
                onChange={(e) => {
                  setNameDraft(e.target.value);
                  setNameError('');
                }}
                autoComplete="given-name"
                maxLength={40}
                autoFocus
                required
                minLength={2}
                placeholder={t('gate.namePlaceholder')}
              />
              <span className="mt-1.5 block text-xs leading-relaxed text-stone-400 dark:text-stone-500">
                {t('gate.nameHint')}
              </span>
              {nameError && (
                <span role="alert" className="mt-2 block rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
                  {nameError}
                </span>
              )}
            </label>
            <button type="submit" className="btn-primary w-full min-h-12 text-base">
              {t('gate.welcomeBtn')}
            </button>
          </form>
        </div>
      ) : (
        <div className="card w-full max-w-sm p-6 sm:p-8">
          <div className="flex justify-end">
            <LanguageMenuButton />
          </div>
          <BrandHero>
            {fromBirthday && (
              <p className="mt-4 inline-flex items-center rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200">
                🎂 {t('bday.kicker')}
              </p>
            )}
            <h1 className="mt-4 text-xl font-bold tracking-tight">{t('site.title')}</h1>
            <p className="mt-1 flex items-center gap-1.5 text-sm font-medium text-stone-600 dark:text-stone-300">
              <LockKeyhole className="h-4 w-4" aria-hidden />
              {t('gate.title')}
            </p>
            <p className="mt-2 text-sm text-stone-500 dark:text-stone-400">
              {fromBirthday ? t('gate.introFromBday') : t('gate.intro')}
            </p>
          </BrandHero>

          <form onSubmit={submitPassword} className="mt-6 space-y-4">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-stone-700 dark:text-stone-300">
                {t('gate.password')}
              </span>
              <span className="relative block">
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  className={`input min-h-12 pr-12 text-base sm:text-base ${
                    error
                      ? 'border-red-500 focus:border-red-500 focus:ring-red-500/30'
                      : ''
                  }`}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError('');
                  }}
                  autoComplete="current-password"
                  autoFocus
                  required
                  aria-invalid={Boolean(error)}
                  aria-describedby={error ? 'gate-password-error' : 'gate-remember'}
                />
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-stone-500 hover:bg-stone-100 hover:text-stone-800 dark:hover:bg-stone-800 dark:hover:text-stone-100"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? t('gate.hidePassword') : t('gate.showPassword')}
                  title={showPassword ? t('gate.hidePassword') : t('gate.showPassword')}
                >
                  {showPassword ? <EyeOff className="h-5 w-5" aria-hidden /> : <Eye className="h-5 w-5" aria-hidden />}
                </button>
              </span>
              {error && (
                <span
                  id="gate-password-error"
                  role="alert"
                  className="mt-2 block rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
                >
                  {error}
                </span>
              )}
            </label>
            <p id="gate-remember" className="text-xs leading-relaxed text-stone-500 dark:text-stone-400">
              {t('gate.remember')}
            </p>
            <button type="submit" className="btn-primary w-full min-h-12 text-base" disabled={busy}>
              {busy ? t('gate.checking') : t('gate.btn')}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
