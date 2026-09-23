import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { ArrowLeft, Eye, EyeOff, KeyRound, Loader2, Users } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { OWNER_DEFAULT_NAME } from '../config/access';
import { useAuth } from '../context/AuthContext';
import { useT } from '../i18n/useT';
import { birthdayPassStillValid, hasSoftUnlockGrant, readDatesPass, softUnlockStillValid } from '../lib/birthdayPass';
import { SW_UPDATE_EVENT } from '../lib/swUpdate';
import { rememberActorName, resolveActorName } from '../utils/actorName';
import { BrandHero } from './BrandLogo';
import { LanguageMenuButton } from './LanguageSelect';
import { useSettings } from '../context/SettingsContext';
import { prettyLabel } from '../utils/family';

function readSavedName(): string {
  return resolveActorName();
}

type GateMode = 'family' | 'owner';

/**
 * Site gate: name + family password on the main site.
 * Name-only after a live birthday page or the public missing-dates page in this tab.
 * Owner login is a separate screen — family form never accepts the owner password.
 */
export function AppLockGate({ children }: { children: ReactNode }) {
  const { role, ready, signIn, enterAsFamily, enterWithName } = useAuth();
  const t = useT();
  const { settings } = useSettings();
  const [searchParams] = useSearchParams();
  const claimedFromBday = searchParams.get('from') === 'bday';
  const claimedFromDates = searchParams.get('from') === 'dates';
  const [softAccess, setSoftAccess] = useState<'unknown' | 'yes' | 'no'>(() =>
    hasSoftUnlockGrant() ? 'unknown' : 'no',
  );
  const [softKind, setSoftKind] = useState<'bday' | 'dates' | null>(null);
  const [mode, setMode] = useState<GateMode>('family');
  const [familyPassword, setFamilyPassword] = useState('');
  const [ownerPassword, setOwnerPassword] = useState('');
  const [showFamilyPassword, setShowFamilyPassword] = useState(false);
  const [showOwnerPassword, setShowOwnerPassword] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [nameDraft, setNameDraft] = useState(readSavedName);
  const [nameError, setNameError] = useState('');

  const fromSoftUnlock = softAccess === 'yes';
  const unlocked = ready && role !== 'viewer';

  useEffect(() => {
    if (unlocked) return;
    const onUpdate = () => window.__familytreeApplyUpdate?.();
    window.addEventListener(SW_UPDATE_EVENT, onUpdate);
    return () => window.removeEventListener(SW_UPDATE_EVENT, onUpdate);
  }, [unlocked]);

  useEffect(() => {
    let cancelled = false;
    if (!hasSoftUnlockGrant()) {
      setSoftAccess('no');
      setSoftKind(null);
      return;
    }
    void softUnlockStillValid().then(async (ok) => {
      if (cancelled) return;
      setSoftAccess(ok ? 'yes' : 'no');
      if (!ok) {
        setSoftKind(null);
        return;
      }
      if (readDatesPass()) {
        const bdayOk = await birthdayPassStillValid();
        if (!cancelled) setSoftKind(bdayOk && !claimedFromDates ? 'bday' : 'dates');
      } else {
        if (!cancelled) setSoftKind('bday');
      }
    });
    return () => {
      cancelled = true;
    };
  }, [claimedFromDates]);

  useEffect(() => {
    if (!ready) return;
    if (role === 'owner') {
      rememberActorName(OWNER_DEFAULT_NAME);
    }
  }, [ready, role]);

  // After sign-out / returning to the gate, show the saved name chip again.
  useEffect(() => {
    if (unlocked) return;
    const saved = readSavedName();
    if (saved.length >= 2) setNameDraft(saved);
  }, [unlocked]);

  useEffect(() => {
    if (!fromSoftUnlock) return;
    const root = document.documentElement;
    root.classList.remove('dark');
    return () => {
      root.classList.toggle('dark', settings.theme === 'dark');
    };
  }, [fromSoftUnlock, settings.theme]);

  // Soft unlock from /bday or /dates: reuse the name already on this device.
  useEffect(() => {
    if (!fromSoftUnlock || unlocked || softAccess !== 'yes') return;
    const saved = readSavedName();
    if (saved.length < 2) return;
    let cancelled = false;
    setBusy(true);
    setError('');
    void enterWithName(saved).then((ok) => {
      if (cancelled) return;
      if (!ok) {
        setSoftAccess('no');
        setError(softKind === 'dates' ? t('gate.introDatesEnded') : t('gate.introBdayEnded'));
      }
      setBusy(false);
    });
    return () => {
      cancelled = true;
    };
  }, [fromSoftUnlock, unlocked, softAccess, softKind, enterWithName, t]);

  if (unlocked) return <>{children}</>;

  if (
    !ready ||
    (role === 'viewer' && softAccess === 'unknown') ||
    (fromSoftUnlock && softAccess === 'yes' && readSavedName().length >= 2)
  ) {
    return (
      <div className="flex min-h-dvh items-center justify-center app-shell">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" aria-hidden />
      </div>
    );
  }

  const switchMode = (next: GateMode) => {
    setMode(next);
    setError('');
    setNameError('');
    setFamilyPassword('');
    setOwnerPassword('');
    setShowFamilyPassword(false);
    setShowOwnerPassword(false);
  };

  const submitFamily = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = nameDraft.trim().slice(0, 40);
    if (trimmed.length < 2) {
      setNameError(t('gate.nameRequired'));
      return;
    }

    if (fromSoftUnlock) {
      setBusy(true);
      setError('');
      try {
        const ok = await enterWithName(trimmed);
        if (!ok) {
          setSoftAccess('no');
          setError(softKind === 'dates' ? t('gate.introDatesEnded') : t('gate.introBdayEnded'));
        }
      } finally {
        setBusy(false);
      }
      return;
    }

    if (!familyPassword) {
      setError(t('gate.enter'));
      return;
    }

    setBusy(true);
    setError('');
    try {
      const result = await enterAsFamily(trimmed, familyPassword);
      if (!result.ok) {
        if (result.reason === 'name') setNameError(t('gate.nameRequired'));
        else if (result.reason === 'use_owner') setError(t('gate.useOwnerLogin'));
        else if (result.reason === 'session') setError(t('gate.sessionFailed'));
        else setError(t('gate.wrong'));
      }
    } catch (err) {
      console.error('Sign-in failed:', err);
      setError(t('gate.wrong'));
    } finally {
      setBusy(false);
    }
  };

  const submitOwner = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!ownerPassword) {
      setError(t('gate.enter'));
      return;
    }
    setBusy(true);
    setError('');
    try {
      const found = await signIn(ownerPassword);
      if (!found) {
        setError(t('gate.wrongOwner'));
      }
    } catch (err) {
      console.error('Sign-in failed:', err);
      setError(t('gate.wrongOwner'));
    } finally {
      setBusy(false);
    }
  };

  const intro = fromSoftUnlock
    ? softKind === 'dates' || claimedFromDates
      ? t('gate.introFromDates')
      : t('gate.introFromBday')
    : claimedFromDates
      ? t('gate.introDatesEnded')
      : claimedFromBday
        ? t('gate.introBdayEnded')
        : t('gate.intro');

  const shellClass =
    mode === 'owner'
      ? 'bg-gradient-to-b from-[#061412] via-[#0a1f1c] to-[#123530] text-stone-100'
      : fromSoftUnlock
        ? 'bg-gradient-to-b from-[#6f9589] via-[#8aafa4] to-[#9eb8ae] text-stone-900'
        : 'app-shell text-stone-900 dark:text-stone-100';

  return (
    <div
      className={`flex min-h-dvh flex-col items-center justify-center px-4 pb-[max(2.5rem,env(safe-area-inset-bottom))] pt-[max(2.5rem,env(safe-area-inset-top))] ${shellClass}`}
    >
      <div
        className={`gate-panel w-full max-w-sm rounded-3xl border p-6 sm:p-8 ${
          mode === 'owner' ? 'gate-panel--owner' : ''
        }`}
      >
        <div className="flex items-center justify-between gap-2">
          {mode === 'owner' ? (
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-stone-300 hover:bg-stone-800 hover:text-white"
              onClick={() => switchMode('family')}
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
              {t('gate.backToFamily')}
            </button>
          ) : (
            <span />
          )}
          <LanguageMenuButton />
        </div>

        {mode === 'owner' ? (
          <>
            <div className="mt-4 flex justify-center">
              <span className="rounded-full bg-emerald-900/80 p-3 text-emerald-300 ring-1 ring-emerald-700/60">
                <KeyRound className="h-6 w-6" aria-hidden />
              </span>
            </div>
            <h1 className="mt-4 text-center font-display text-xl font-semibold tracking-tight text-stone-100">
              {t('gate.ownerTitle')}
            </h1>
            <p className="mt-2 text-center text-sm text-stone-400">{t('gate.ownerIntro')}</p>

            <form onSubmit={(e) => void submitOwner(e)} className="mt-6 space-y-4">
              <label className="block text-left">
                <span className="mb-1 block text-sm font-medium text-stone-300">
                  {t('gate.ownerPassword')}
                </span>
                <span className="relative block">
                  <input
                    type={showOwnerPassword ? 'text' : 'password'}
                    name="owner-password"
                    className={`input min-h-12 border-stone-700 bg-stone-950/80 pr-12 text-base text-stone-100 ${
                      error ? 'border-red-500 focus:border-red-500 focus:ring-red-500/30' : ''
                    }`}
                    value={ownerPassword}
                    onChange={(e) => {
                      setOwnerPassword(e.target.value);
                      setError('');
                    }}
                    autoComplete="current-password"
                    autoFocus
                    required
                    aria-invalid={Boolean(error)}
                    aria-describedby={error ? 'gate-owner-error' : undefined}
                  />
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-stone-400 hover:bg-stone-800 hover:text-stone-100"
                    onClick={() => setShowOwnerPassword((v) => !v)}
                    aria-label={showOwnerPassword ? t('gate.hidePassword') : t('gate.showPassword')}
                    title={showOwnerPassword ? t('gate.hidePassword') : t('gate.showPassword')}
                  >
                    {showOwnerPassword ? (
                      <EyeOff className="h-5 w-5" aria-hidden />
                    ) : (
                      <Eye className="h-5 w-5" aria-hidden />
                    )}
                  </button>
                </span>
              </label>

              {error && (
                <span
                  id="gate-owner-error"
                  role="alert"
                  className="block rounded-xl border border-red-800 bg-red-950/50 px-3 py-2 text-sm font-medium text-red-300"
                >
                  {error}
                </span>
              )}

              <button type="submit" className="btn-primary w-full min-h-12 text-base" disabled={busy}>
                {busy ? t('gate.checking') : t('gate.ownerBtn')}
              </button>
            </form>
          </>
        ) : (
          <>
            <BrandHero>
              {fromSoftUnlock && (
            <p className="mt-4 inline-flex items-center rounded-full bg-teal-100 px-3 py-1 text-xs font-semibold text-teal-800 dark:bg-teal-950/60 dark:text-teal-200">
              {softKind === 'dates' ? `📅 ${t('dates.kicker')}` : `🎂 ${t('bday.kicker')}`}
            </p>
              )}
              <h1 className="mt-4 font-display text-xl font-semibold tracking-tight text-stone-900 dark:text-stone-100">
                {t('gate.welcomeTitle')}
              </h1>
              <p className="mt-2 text-sm text-stone-500 dark:text-stone-400">{intro}</p>
            </BrandHero>

            <form onSubmit={(e) => void submitFamily(e)} className="mt-6 space-y-4">
              {nameDraft.trim().length >= 2 ? (
                <div className="rounded-2xl border border-teal-800/15 bg-white/70 px-3 py-3 text-left dark:border-stone-700 dark:bg-stone-900/50">
                  <p className="text-xs font-medium text-stone-600 dark:text-stone-400">
                    {t('gate.nameKnownHint')}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-teal-800/20 bg-white px-3 text-sm font-semibold text-teal-950 shadow-sm dark:border-emerald-700/40 dark:bg-stone-950 dark:text-emerald-100">
                      <Users className="h-4 w-4 text-teal-700 dark:text-emerald-400" aria-hidden />
                      {prettyLabel(nameDraft.trim())}
                    </span>
                    <button
                      type="button"
                      className="text-xs font-medium text-stone-500 underline-offset-2 hover:underline dark:text-stone-400"
                      onClick={() => {
                        setNameDraft('');
                        setNameError('');
                      }}
                    >
                      {t('gate.changeName')}
                    </button>
                  </div>
                  {nameError && (
                    <span
                      role="alert"
                      className="mt-2 block rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
                    >
                      {nameError}
                    </span>
                  )}
                </div>
              ) : (
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
                    <span
                      role="alert"
                      className="mt-2 block rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
                    >
                      {nameError}
                    </span>
                  )}
                </label>
              )}

              {!fromSoftUnlock && (
                <label className="block text-left">
                  <span className="mb-1 block text-sm font-medium text-stone-700 dark:text-stone-300">
                    {t('gate.familyPassword')}
                  </span>
                  <span className="relative block">
                    <input
                      type={showFamilyPassword ? 'text' : 'password'}
                      name="family-password"
                      className={`input min-h-12 pr-12 text-base ${
                        error ? 'border-red-500 focus:border-red-500 focus:ring-red-500/30' : ''
                      }`}
                      value={familyPassword}
                      onChange={(e) => {
                        setFamilyPassword(e.target.value);
                        setError('');
                      }}
                      autoComplete="current-password"
                      autoFocus={nameDraft.trim().length >= 2}
                      required
                      aria-invalid={Boolean(error)}
                      aria-describedby={error ? 'gate-family-error' : undefined}
                    />
                    <button
                      type="button"
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-stone-500 hover:bg-stone-100 hover:text-stone-800 dark:hover:bg-stone-800 dark:hover:text-stone-100"
                      onClick={() => setShowFamilyPassword((v) => !v)}
                      aria-label={showFamilyPassword ? t('gate.hidePassword') : t('gate.showPassword')}
                      title={showFamilyPassword ? t('gate.hidePassword') : t('gate.showPassword')}
                    >
                      {showFamilyPassword ? (
                        <EyeOff className="h-5 w-5" aria-hidden />
                      ) : (
                        <Eye className="h-5 w-5" aria-hidden />
                      )}
                    </button>
                  </span>
                </label>
              )}

              {error && (
                <span
                  id="gate-family-error"
                  role="alert"
                  className="block rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
                >
                  {error}
                </span>
              )}

              <p className="text-xs leading-relaxed text-stone-500 dark:text-stone-400">
                {fromSoftUnlock
                  ? softKind === 'dates'
                    ? t('gate.rememberDates')
                    : t('gate.rememberBday')
                  : t('gate.remember')}
              </p>
              <button type="submit" className="btn-primary w-full min-h-12 text-base" disabled={busy}>
                <Users className="h-4 w-4" aria-hidden />
                {busy
                  ? t('gate.checking')
                  : fromSoftUnlock && nameDraft.trim().length >= 2
                    ? t('gate.continueAs', { name: prettyLabel(nameDraft.trim()) })
                    : t('gate.welcomeBtn')}
              </button>
            </form>

            {!fromSoftUnlock && (
              <div className="mt-6 border-t border-stone-200 pt-4 dark:border-stone-700">
                <button
                  type="button"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-stone-600 hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-stone-800"
                  onClick={() => switchMode('owner')}
                >
                  <KeyRound className="h-4 w-4" aria-hidden />
                  {t('gate.ownerToggle')}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
