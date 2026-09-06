import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { OWNER_DEFAULT_NAME } from '../config/access';
import { useAuth } from '../context/AuthContext';
import { useT } from '../i18n/useT';
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

function isNamedFamilyUser(): boolean {
  return (
    readSavedName().length >= 2 &&
    loadJson<boolean>(STORAGE_KEYS.namedDevice, (v): v is boolean => typeof v === 'boolean') === true
  );
}

/**
 * Site gate: visitors enter their name (no family password). Owner tools
 * stay behind the collapsed owner password on this screen or in Settings.
 */
export function AppLockGate({ children }: { children: ReactNode }) {
  const { role, ready, signIn, enterWithName } = useAuth();
  const t = useT();
  const { settings } = useSettings();
  const [searchParams] = useSearchParams();
  const fromBirthday = searchParams.get('from') === 'bday';
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [nameDraft, setNameDraft] = useState(readSavedName);
  const [nameError, setNameError] = useState('');
  const [ownerOpen, setOwnerOpen] = useState(false);

  const unlocked = ready && role !== 'viewer' && (!fromBirthday || isNamedFamilyUser());

  useEffect(() => {
    if (!ready) return;
    if (role === 'owner') {
      saveJson(STORAGE_KEYS.displayName, OWNER_DEFAULT_NAME);
    }
  }, [ready, role]);

  useEffect(() => {
    if (!fromBirthday) return;
    const root = document.documentElement;
    root.classList.remove('dark');
    return () => {
      root.classList.toggle('dark', settings.theme === 'dark');
    };
  }, [fromBirthday, settings.theme]);

  if (unlocked) return <>{children}</>;

  const submitName = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = nameDraft.trim().slice(0, 40);
    if (trimmed.length < 2) {
      setNameError(t('gate.nameRequired'));
      return;
    }
    enterWithName(trimmed);
  };

  const submitOwner = async (event: React.FormEvent) => {
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
      }
    } catch (err) {
      console.error('Sign-in failed:', err);
      setError(t('gate.wrong'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`flex min-h-dvh flex-col items-center justify-center px-4 pb-[max(2.5rem,env(safe-area-inset-bottom))] pt-[max(2.5rem,env(safe-area-inset-top))] text-stone-900 dark:bg-stone-950 dark:text-stone-100 ${fromBirthday ? 'bg-gradient-to-b from-emerald-100 via-emerald-50 to-stone-50' : 'app-shell'}`}>
      {!ready ? (
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" aria-hidden />
      ) : (
        <div className="w-full max-w-sm rounded-3xl border border-emerald-200/70 bg-white/90 p-6 shadow-[0_18px_50px_-28px_rgb(6_78_59_/_0.45)] animate-modal-in sm:p-8 dark:border-stone-700 dark:bg-stone-900/90">
          <div className="flex justify-end">
            <LanguageMenuButton />
          </div>
          <BrandHero>
            {fromBirthday && (
              <p className="mt-4 inline-flex items-center rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200">
                🎂 {t('bday.kicker')}
              </p>
            )}
            <h1 className="mt-4 font-display text-xl font-semibold tracking-tight text-stone-900 dark:text-stone-50">
              {t('gate.welcomeTitle')}
            </h1>
            <p className="mt-2 text-sm text-stone-500 dark:text-stone-400">
              {fromBirthday ? t('gate.introFromBday') : t('gate.intro')}
            </p>
          </BrandHero>

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
            <p className="text-xs leading-relaxed text-stone-500 dark:text-stone-400">
              {t('gate.remember')}
            </p>
            <button type="submit" className="btn-primary w-full min-h-12 text-base">
              {t('gate.welcomeBtn')}
            </button>
          </form>

          <details
            className="mt-6 rounded-2xl border border-stone-200/80 bg-stone-50/80 px-3 py-2 dark:border-stone-700 dark:bg-stone-800/50"
            open={ownerOpen}
            onToggle={(e) => setOwnerOpen((e.currentTarget as HTMLDetailsElement).open)}
          >
            <summary className="cursor-pointer list-none py-1.5 text-sm font-medium text-stone-600 dark:text-stone-300 [&::-webkit-details-marker]:hidden">
              {t('gate.ownerToggle')}
            </summary>
            <p className="mt-1 text-xs leading-relaxed text-stone-500 dark:text-stone-400">
              {t('gate.ownerIntro')}
            </p>
            <form onSubmit={submitOwner} className="mt-3 space-y-3">
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-stone-700 dark:text-stone-300">
                  {t('gate.ownerPassword')}
                </span>
                <span className="relative block">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="owner-password"
                    className={`input min-h-11 pr-12 text-base ${
                      error ? 'border-red-500 focus:border-red-500 focus:ring-red-500/30' : ''
                    }`}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setError('');
                    }}
                    autoComplete="current-password"
                    aria-invalid={Boolean(error)}
                    aria-describedby={error ? 'gate-owner-error' : undefined}
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
                    id="gate-owner-error"
                    role="alert"
                    className="mt-2 block rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
                  >
                    {error}
                  </span>
                )}
              </label>
              <button type="submit" className="btn-secondary w-full min-h-11 text-sm" disabled={busy}>
                {busy ? t('gate.checking') : t('gate.ownerBtn')}
              </button>
            </form>
          </details>
        </div>
      )}
    </div>
  );
}
