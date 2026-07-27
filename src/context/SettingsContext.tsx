import { createContext, useContext, useEffect, useMemo } from 'react';
import type { ReactNode } from 'react';
import type { AppLanguage, AppSettings, PrivacySettings, Theme } from '../types/family';
import { DEFAULT_PRIVACY, normalizeLanguage } from '../types/family';
import { usePersistentState } from '../hooks/usePersistentState';
import { STORAGE_KEYS } from '../utils/storage';

interface SettingsContextValue {
  settings: AppSettings;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  setLanguage: (language: AppLanguage) => void;
  setPrivacy: (patch: Partial<PrivacySettings>) => void;
  setEasyMode: (easyMode: boolean) => void;
  setBrowserNotify: (enabled: boolean) => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

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
    { theme: 'dark', language: 'uz', privacy: DEFAULT_PRIVACY, easyMode: true, browserNotify: false },
    isSettings,
  );

  const language = normalizeLanguage(settings.language);
  const easyMode = Boolean(settings.easyMode);
  const browserNotify = Boolean(settings.browserNotify);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', settings.theme === 'dark');
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

  useEffect(() => {
    document.documentElement.classList.toggle('easy', easyMode);
  }, [easyMode]);

  const value = useMemo<SettingsContextValue>(
    () => ({
      settings: {
        ...settings,
        language,
        easyMode,
        browserNotify,
        privacy: { ...DEFAULT_PRIVACY, ...settings.privacy },
      },
      setTheme: (theme) => setSettings((s) => ({ ...s, theme })),
      toggleTheme: () =>
        setSettings((s) => ({ ...s, theme: s.theme === 'dark' ? 'light' : 'dark' })),
      setLanguage: (nextLanguage) => setSettings((s) => ({ ...s, language: nextLanguage })),
      setPrivacy: (patch) =>
        setSettings((s) => ({ ...s, privacy: { ...DEFAULT_PRIVACY, ...s.privacy, ...patch } })),
      setEasyMode: (next) => setSettings((s) => ({ ...s, easyMode: next })),
      setBrowserNotify: (next) => setSettings((s) => ({ ...s, browserNotify: next })),
    }),
    [settings, language, easyMode, browserNotify, setSettings],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used inside SettingsProvider');
  return ctx;
}
