import { useEffect, useState } from 'react';
import { useLanguage, useT } from '../i18n/useT';

const MONTH_NAMES: Record<'en' | 'uz' | 'ru', string[]> = {
  en: [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ],
  uz: [
    'Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun',
    'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr',
  ],
  ru: [
    'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
    'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
  ],
};

/** Split a stored date string ("YYYY", "YYYY-MM", "YYYY-MM-DD") into parts. */
function parseDateValue(value: string): { y: string; m: string; d: string } {
  const match = /^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?$/.exec((value || '').trim());
  return { y: match?.[1] ?? '', m: match?.[2] ?? '', d: match?.[3] ?? '' };
}

/** Rebuild the stored string, keeping only the precision the user supplied. */
function composeDateValue(y: string, m: string, d: string): string {
  if (!/^\d{4}$/.test(y)) return '';
  if (!m) return y;
  if (!d) return `${y}-${m}`;
  return `${y}-${m}-${d}`;
}

function daysInMonth(y: string, m: string): number {
  const year = Number(y);
  const month = Number(m);
  if (!year || !month) return 31;
  return new Date(year, month, 0).getDate();
}

/**
 * Friendly date entry: year required, month/day optional. Emits
 * "YYYY" / "YYYY-MM" / "YYYY-MM-DD".
 */
export function DateField({
  label,
  value,
  onChange,
  error,
  disabled,
  hint,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  disabled?: boolean;
  /** Override the default form.dateHint under the fields. */
  hint?: string;
}) {
  const t = useT();
  const language = useLanguage();
  const [parts, setParts] = useState(() => parseDateValue(value));

  useEffect(() => {
    setParts((prev) =>
      composeDateValue(prev.y, prev.m, prev.d) === value ? prev : parseDateValue(value),
    );
  }, [value]);

  const emit = (next: { y: string; m: string; d: string }) => {
    setParts(next);
    onChange(composeDateValue(next.y, next.m, next.d));
  };

  const yearReady = /^\d{4}$/.test(parts.y);

  return (
    <div className={disabled ? 'opacity-60' : ''}>
      <span className="mb-1 block text-sm font-medium text-stone-700 dark:text-stone-300">
        {label}
      </span>
      <div className="flex gap-2">
        <input
          type="text"
          inputMode="numeric"
          maxLength={4}
          className="input w-20 shrink-0"
          placeholder={t('form.year')}
          aria-label={t('form.year')}
          value={parts.y}
          disabled={disabled}
          onChange={(e) => {
            const y = e.target.value.replace(/\D/g, '').slice(0, 4);
            if (!y) {
              emit({ y: '', m: '', d: '' });
              return;
            }
            const d = parts.d && Number(parts.d) <= daysInMonth(y, parts.m) ? parts.d : '';
            emit({ ...parts, y, d });
          }}
        />
        <select
          className="input flex-1"
          aria-label={t('form.month')}
          value={parts.m}
          disabled={disabled || !yearReady}
          onChange={(e) => {
            const m = e.target.value;
            const d = m && parts.d && Number(parts.d) <= daysInMonth(parts.y, m) ? parts.d : '';
            emit({ ...parts, m, d });
          }}
        >
          <option value="">{t('form.month')}</option>
          {MONTH_NAMES[language]?.map((name, i) => (
            <option key={name} value={String(i + 1).padStart(2, '0')}>
              {name}
            </option>
          ))}
        </select>
        <select
          className="input w-20 shrink-0"
          aria-label={t('form.day')}
          value={parts.d}
          disabled={disabled || !parts.m}
          onChange={(e) => emit({ ...parts, d: e.target.value })}
        >
          <option value="">{t('form.day')}</option>
          {Array.from({ length: daysInMonth(parts.y, parts.m) }, (_, i) =>
            String(i + 1).padStart(2, '0'),
          ).map((d) => (
            <option key={d} value={d}>
              {Number(d)}
            </option>
          ))}
        </select>
      </div>
      <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">
        {hint ?? t('form.dateHint')}
      </p>
      {error && (
        <span role="alert" className="mt-1 block text-xs text-red-600 dark:text-red-400">
          {error}
        </span>
      )}
    </div>
  );
}
