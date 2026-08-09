import { ChevronDown, Languages } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { useSettings } from '../context/SettingsContext';
import { useT } from '../i18n/useT';
import {
  APP_LANGUAGES,
  languageCodeLabel,
  languageDisplayName,
  type AppLanguage,
} from '../types/family';

/** Compact native select for Settings (and forms). */
export function LanguageSelect({ className = '' }: { className?: string }) {
  const { settings, setLanguage } = useSettings();
  const t = useT();
  const id = useId();

  return (
    <div className={`relative min-w-0 ${className}`}>
      <label htmlFor={id} className="sr-only">
        {t('settings.language')}
      </label>
      <Languages
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-600"
        aria-hidden
      />
      <select
        id={id}
        className="input w-full appearance-none !py-2.5 !pl-10 !pr-10"
        value={settings.language}
        onChange={(e) => setLanguage(e.target.value as AppLanguage)}
      >
        {APP_LANGUAGES.map((code) => (
          <option key={code} value={code}>
            {languageDisplayName(code)}
          </option>
        ))}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400"
        aria-hidden
      />
    </div>
  );
}

/** Header control: tap to open a short language menu (not a cycle). */
export function LanguageMenuButton() {
  const { settings, setLanguage } = useSettings();
  const t = useT();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent | TouchEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('touchstart', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('touchstart', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        className="icon-btn !min-h-10 !min-w-10 !gap-0.5 text-xs font-bold"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
        title={t('settings.language')}
        aria-label={t('settings.language')}
      >
        <Languages className="h-4 w-4" aria-hidden />
        <span className="tabular-nums">{languageCodeLabel(settings.language)}</span>
        <ChevronDown className="h-3 w-3 opacity-70" aria-hidden />
      </button>
      {open && (
        <ul
          role="listbox"
          aria-label={t('settings.language')}
          className="absolute right-0 z-50 mt-1 min-w-[10.5rem] overflow-hidden rounded-xl border border-stone-200 bg-white py-1 shadow-xl dark:border-stone-700 dark:bg-stone-900"
        >
          {APP_LANGUAGES.map((code) => {
            const active = settings.language === code;
            return (
              <li key={code} role="option" aria-selected={active}>
                <button
                  type="button"
                  className={`flex w-full items-center justify-between gap-3 px-3.5 py-2.5 text-left text-sm font-semibold ${
                    active
                      ? 'bg-emerald-50 text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200'
                      : 'text-stone-800 hover:bg-stone-100 dark:text-stone-100 dark:hover:bg-stone-800'
                  }`}
                  onClick={() => {
                    setLanguage(code);
                    setOpen(false);
                  }}
                >
                  <span>{languageDisplayName(code)}</span>
                  <span className="text-xs font-bold tabular-nums text-stone-400">
                    {languageCodeLabel(code)}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
