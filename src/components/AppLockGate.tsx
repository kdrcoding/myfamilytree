import { useState } from 'react';
import type { ReactNode } from 'react';
import { Languages, Loader2, LockKeyhole, TreePine } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { useT } from '../i18n/useT';

/**
 * The whole site sits behind a password: without the family or owner
 * password nothing is shown and no family data is loaded. Mount this ABOVE
 * FamilyProvider so the Supabase fetch only happens after unlocking.
 */
export function AppLockGate({ children }: { children: ReactNode }) {
  const { role, ready, signIn } = useAuth();
  const { settings, setLanguage } = useSettings();
  const t = useT();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (ready && role !== 'viewer') return <>{children}</>;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!password) {
      setError(t('gate.enter'));
      return;
    }
    setBusy(true);
    try {
      const found = await signIn(password);
      if (!found) setError(t('gate.wrong'));
    } catch (err) {
      console.error('Sign-in failed:', err);
      setError(t('gate.wrong'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-stone-50 px-4 py-10 text-stone-900 dark:bg-stone-950 dark:text-stone-100">
      {!ready ? (
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" aria-hidden />
      ) : (
        <div className="card w-full max-w-sm p-6 sm:p-8">
          <div className="flex flex-col items-center text-center">
            <span className="rounded-2xl bg-emerald-700 p-3 text-emerald-50">
              <TreePine className="h-8 w-8" aria-hidden />
            </span>
            <h1 className="mt-4 text-xl font-bold tracking-tight">{t('site.title')}</h1>
            <p className="mt-1 flex items-center gap-1.5 text-sm font-medium text-stone-600 dark:text-stone-300">
              <LockKeyhole className="h-4 w-4" aria-hidden />
              {t('gate.title')}
            </p>
            <p className="mt-2 text-sm text-stone-500 dark:text-stone-400">{t('gate.intro')}</p>
          </div>

          <form onSubmit={submit} className="mt-6">
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
              />
              {error && (
                <span role="alert" className="mt-1 block text-xs text-red-600 dark:text-red-400">
                  {error}
                </span>
              )}
            </label>
            <button type="submit" className="btn-primary mt-4 w-full" disabled={busy}>
              {busy ? t('gate.checking') : t('gate.btn')}
            </button>
          </form>
        </div>
      )}

      <button
        type="button"
        onClick={() => setLanguage(settings.language === 'uz' ? 'en' : 'uz')}
        className="icon-btn !w-auto mt-4 gap-1 px-2 text-xs font-bold"
        title={settings.language === 'uz' ? 'Switch to English' : "O'zbekchaga o'tish"}
      >
        <Languages className="h-4 w-4" aria-hidden />
        {settings.language === 'uz' ? 'EN' : 'UZ'}
      </button>
    </div>
  );
}
