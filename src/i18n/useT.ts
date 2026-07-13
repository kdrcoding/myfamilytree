import { useCallback } from 'react';
import { useSettings } from '../context/SettingsContext';
import { translate } from './translations';
import type { Language, TKey } from './translations';

/** Translation hook: `const t = useT(); t('nav.home')`. */
export function useT() {
  const { settings } = useSettings();
  const language = settings.language;
  return useCallback(
    (key: TKey, params?: Record<string, string | number>) => translate(language, key, params),
    [language],
  );
}

export function useLanguage(): Language {
  const { settings } = useSettings();
  return settings.language;
}
