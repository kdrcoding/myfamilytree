import { Flower2, MoonStar, PartyPopper, Sparkles, Users } from 'lucide-react';
import type { UpcomingTradition } from '../utils/traditions';
import { traditionWishKey } from '../utils/traditions';
import { useT } from '../i18n/useT';
import { formatMonthDay } from '../utils/dates';
import { useLanguage } from '../i18n/useT';
import { Modal } from './ui/Modal';
import type { TKey } from '../i18n/translations';

interface TraditionTodayModalProps {
  traditions: UpcomingTradition[];
  onClose: () => void;
}

function TraditionIcon({ kind }: { kind: UpcomingTradition['kind'] }) {
  if (kind === 'navruz') return <Flower2 className="h-7 w-7" aria-hidden />;
  if (kind === 'eid_fitr' || kind === 'eid_adha') return <MoonStar className="h-7 w-7" aria-hidden />;
  if (kind === 'reunion') return <Users className="h-7 w-7" aria-hidden />;
  if (kind === 'new_year') return <Sparkles className="h-7 w-7" aria-hidden />;
  return <PartyPopper className="h-7 w-7" aria-hidden />;
}

/**
 * Once-per-day joyful popup for Navruz, Eid, New Year, or a family reunion.
 * Never names individual people (so deceased relatives are never mentioned).
 */
export function TraditionTodayModal({ traditions, onClose }: TraditionTodayModalProps) {
  const t = useT();
  const language = useLanguage();
  const today = traditions.filter((row) => row.isToday);
  if (today.length === 0) return null;

  const first = today[0]!;
  const title =
    first.customTitle?.trim() ||
    (first.titleKey ? t(first.titleKey as TKey) : t('tradition.reunionFallback'));

  return (
    <Modal onClose={onClose} labelledBy="tradition-today-title" size="sm">
      <div className="relative overflow-hidden text-center">
        <div
          className="pointer-events-none absolute inset-x-0 -top-8 h-28 bg-gradient-to-b from-emerald-100/80 via-amber-50/50 to-transparent dark:from-emerald-950/40 dark:via-amber-950/20"
          aria-hidden
        />
        <div className="relative mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-200 via-amber-100 to-teal-100 text-emerald-900 shadow-md ring-1 ring-emerald-200/60 dark:from-emerald-900/60 dark:via-amber-900/40 dark:to-teal-900/50 dark:text-emerald-100 dark:ring-emerald-800/50">
          <TraditionIcon kind={first.kind} />
        </div>

        <p className="relative mt-4 text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-emerald-800 dark:text-emerald-200">
          {t('tradition.popupKicker')}
        </p>

        <h2
          id="tradition-today-title"
          className="relative mt-2 font-display text-2xl font-semibold tracking-tight text-stone-900 dark:text-stone-100"
        >
          {t(traditionWishKey(first.kind) as TKey, { title })}
        </h2>

        <p className="relative mt-2 text-sm leading-relaxed text-stone-600 dark:text-stone-400">
          {t('tradition.popupBody')}
        </p>

        {today.length > 1 && (
          <ul className="relative mt-4 space-y-1.5 text-left text-sm">
            {today.map((row) => {
              const label =
                row.customTitle?.trim() ||
                (row.titleKey ? t(row.titleKey as TKey) : t('tradition.reunionFallback'));
              return (
                <li
                  key={row.id}
                  className="rounded-xl border border-emerald-900/10 bg-emerald-50/70 px-3 py-2 font-medium text-emerald-950 dark:border-emerald-800/40 dark:bg-emerald-950/40 dark:text-emerald-100"
                >
                  {label}
                  <span className="mt-0.5 block text-xs font-normal text-stone-500 dark:text-stone-400">
                    {formatMonthDay(row.month, row.day, language)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}

        <button type="button" className="btn-primary relative mt-6 min-h-11 w-full" onClick={onClose}>
          {t('tradition.popupDismiss')}
        </button>
      </div>
    </Modal>
  );
}
