import { createContext, useContext, useEffect, useMemo } from 'react';
import type { ReactNode } from 'react';
import type { AppLanguage, AppSettings, PrivacySettings, Theme } from '../types/family';
import { DEFAULT_PRIVACY } from '../types/family';
import { usePersistentState } from '../hooks/usePersistentState';
import { STORAGE_KEYS } from '../utils/storage';

interface SettingsContextValue {
  settings: AppSettings;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  setLanguage: (language: AppLanguage) => void;
  setPrivacy: (patch: Partial<PrivacySettings>) => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

function systemTheme(): Theme {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function isSettings(value: unknown): value is AppSettings {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    (v.theme === 'light' || v.theme === 'dark') &&
    typeof v.privacy === 'object' &&
    v.privacy !== null
  );
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = usePersistentState<AppSettings>(
    STORAGE_KEYS.settings,
    // Uzbek is the site's default language; English is the second option.
    { theme: systemTheme(), language: 'uz', privacy: DEFAULT_PRIVACY },
    isSettings,
  );

  // Settings saved by earlier versions have no language field.
  const language: AppLanguage = settings.language === 'en' ? 'en' : 'uz';

  useEffect(() => {
    document.documentElement.classList.toggle('dark', settings.theme === 'dark');
    // Keep the mobile browser's address bar in step with the app theme so a
    // light-theme page doesn't sit under a dark (or mismatched) chrome bar.
    let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'theme-color';
      document.head.appendChild(meta);
    }
    meta.content = settings.theme === 'dark' ? '#0c0a09' : '#ffffff';
  }, [settings.theme]);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const value = useMemo<SettingsContextValue>(
    () => ({
      settings: {
        ...settings,
        language,
        // Merge so privacy flags added in future versions get defaults.
        privacy: { ...DEFAULT_PRIVACY, ...settings.privacy },
      },
      setTheme: (theme) => setSettings((s) => ({ ...s, theme })),
      toggleTheme: () =>
        setSettings((s) => ({ ...s, theme: s.theme === 'dark' ? 'light' : 'dark' })),
      setLanguage: (nextLanguage) => setSettings((s) => ({ ...s, language: nextLanguage })),
      setPrivacy: (patch) =>
        setSettings((s) => ({ ...s, privacy: { ...DEFAULT_PRIVACY, ...s.privacy, ...patch } })),
    }),
    [settings, language, setSettings],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used inside SettingsProvider');
  return ctx;
}
