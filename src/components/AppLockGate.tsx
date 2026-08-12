import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Languages, Loader2, LockKeyhole, Smile } from 'lucide-react';
import { OWNER_ROOT } from '../config/access';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { useT } from '../i18n/useT';
import { languageCodeLabel, nextLanguage } from '../types/family';
import { loadJson, saveJson, STORAGE_KEYS } from '../utils/storage';
import { BrandHero } from './BrandLogo';

function readSavedName(): string {
  return (
    loadJson<string>(STORAGE_KEYS.displayName, (v): v is string => typeof v === 'string')?.trim() ??
    ''
  );
}

/**
 * Site gate: family members enter the member password + name.
 * Owner/root (Kadir) auto-enters via AuthProvider — no password or name prompt.
 */
export function AppLockGate({ children }: { children: ReactNode }) {
  const { role, ready, signIn } = useAuth();
  const { settings, setLanguage } = useSettings();
  const t = useT();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [savedName, setSavedName] = useState(readSavedName);
  const [nameDraft, setNameDraft] = useState(savedName);
  const [nameError, setNameError] = useState('');
  // True right after a family-password unlock this visit — forces the name step.
  const [awaitingName, setAwaitingName] = useState(false);

  const unlocked = ready && role !== 'viewer';
  // Owner always uses Kadir — never block on the name form.
  const needsName =
    unlocked && role !== 'owner' && (awaitingName || savedName.length < 2);

  useEffect(() => {
    if (!ready) return;
    if (role === 'owner') {
      saveJson(STORAGE_KEYS.displayName, OWNER_ROOT.name);
      setSavedName(OWNER_ROOT.name);
      setAwaitingName(false);
      return;
    }
    if (role === 'viewer') return;
    if (readSavedName().length < 2) {
      setAwaitingName(true);
      setSavedName('');
      setNameDraft('');
    }
  }, [ready, role]);

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
        setNameDraft(existing);
        setNameError('');
        setAwaitingName(true);
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
    setSavedName(trimmed);
    setAwaitingName(false);
  };

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-stone-50 px-4 pb-[max(2.5rem,env(safe-area-inset-bottom))] pt-[max(2.5rem,env(safe-area-inset-top))] text-stone-900 dark:bg-stone-950 dark:text-stone-100">
      {!ready ? (
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" aria-hidden />
      ) : needsName ? (
        <div className="w-full max-w-sm rounded-3xl border border-emerald-200/70 bg-white/90 p-6 shadow-sm sm:p-8 dark:border-stone-700 dark:bg-stone-900/90">
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
                className="input"
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
                <span role="alert" className="mt-1 block text-xs text-red-600 dark:text-red-400">
                  {nameError}
                </span>
              )}
            </label>
            <button type="submit" className="btn-primary w-full">
              {t('gate.welcomeBtn')}
            </button>
          </form>
        </div>
      ) : (
        <div className="card w-full max-w-sm p-6 sm:p-8">
          <BrandHero>
            <h1 className="mt-4 text-xl font-bold tracking-tight">{t('site.title')}</h1>
            <p className="mt-1 flex items-center gap-1.5 text-sm font-medium text-stone-600 dark:text-stone-300">
              <LockKeyhole className="h-4 w-4" aria-hidden />
              {t('gate.title')}
            </p>
            <p className="mt-2 text-sm text-stone-500 dark:text-stone-400">{t('gate.intro')}</p>
          </BrandHero>

          <form onSubmit={submitPassword} className="mt-6 space-y-4">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-stone-700 dark:text-stone-300">
                {t('gate.password')}
              </span>
              <input
                type="password"
                className="input"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError('');
                }}
                autoComplete="current-password"
                autoFocus
                required
              />
              {error && (
                <span role="alert" className="mt-1 block text-xs text-red-600 dark:text-red-400">
                  {error}
                </span>
              )}
            </label>
            <button type="submit" className="btn-primary w-full" disabled={busy}>
              {busy ? t('gate.checking') : t('gate.btn')}
            </button>
          </form>
        </div>
      )}

      <button
        type="button"
        onClick={() => setLanguage(nextLanguage(settings.language))}
        className="icon-btn !w-auto mt-4 gap-1 px-2 text-xs font-bold"
        title={t('nav.langCycle')}
        aria-label={t('nav.langCycle')}
      >
        <Languages className="h-4 w-4" aria-hidden />
        {languageCodeLabel(settings.language)}
      </button>
    </div>
  );
}
