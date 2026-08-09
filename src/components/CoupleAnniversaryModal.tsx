import { Heart, HeartCrack } from 'lucide-react';
import type { FamilyPerson } from '../types/family';
import { useLanguage, useT } from '../i18n/useT';
import { formatDate, formatMonthDay } from '../utils/dates';
import { fullName, isDivorced, marriageDateOf } from '../utils/family';
import { getCoupleAnniversary } from '../utils/anniversaries';
import { Avatar } from './Avatar';
import { Modal } from './ui/Modal';

interface CoupleAnniversaryModalProps {
  a: FamilyPerson;
  b: FamilyPerson;
  onClose: () => void;
  onOpenPerson: (id: string) => void;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/**
 * Shown when someone taps the wedding rings between two people on the tree.
 * Makes marriage date + anniversary easy to understand at a glance.
 */
export function CoupleAnniversaryModal({ a, b, onClose, onOpenPerson }: CoupleAnniversaryModalProps) {
  const t = useT();
  const language = useLanguage();
  const marriedOn = marriageDateOf(a, b);
  const divorced = isDivorced(a, b);
  const anniversary = getCoupleAnniversary(a, b);

  const whenLabel =
    anniversary == null
      ? null
      : anniversary.isToday
        ? t('home.bdayToday')
        : anniversary.daysUntil === 1
          ? t('home.bdayTomorrow')
          : t('home.bdayInDays', { n: anniversary.daysUntil });

  const nextDateLabel = anniversary
    ? formatDate(
        `${anniversary.occurrenceYear}-${pad2(anniversary.month)}-${pad2(anniversary.day)}`,
        language,
      )
    : null;

  const yearsLabel =
    anniversary?.years == null
      ? null
      : anniversary.years === 1
        ? anniversary.isToday
          ? t('home.annivYearOneToday')
          : t('home.annivYearOne')
        : anniversary.isToday
          ? t('home.annivYearsToday', { n: anniversary.years })
          : t('home.annivYears', { n: anniversary.years });

  return (
    <Modal onClose={onClose} labelledBy="couple-title" size="sm">
      <div className="flex flex-col items-center text-center">
        <span
          className={`flex h-12 w-12 items-center justify-center rounded-2xl ${
            divorced
              ? 'bg-stone-100 text-stone-500 dark:bg-stone-800 dark:text-stone-400'
              : 'bg-rose-100 text-rose-600 dark:bg-rose-950/50 dark:text-rose-300'
          }`}
        >
          {divorced ? (
            <HeartCrack className="h-6 w-6" aria-hidden />
          ) : (
            <Heart className="h-6 w-6" aria-hidden />
          )}
        </span>
        <h2 id="couple-title" className="mt-3 text-lg font-bold text-stone-900 dark:text-stone-50">
          {t('couple.title')}
        </h2>
        <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">{t('couple.subtitle')}</p>
        {divorced && (
          <p className="mt-1 text-sm font-medium text-stone-500 dark:text-stone-400">
            {t('couple.divorced')}
          </p>
        )}
      </div>

      <div className="mt-5 flex items-center justify-center gap-3">
        <button
          type="button"
          className="flex min-w-0 flex-1 flex-col items-center gap-1.5 rounded-xl p-2 transition-colors hover:bg-stone-50 dark:hover:bg-stone-800/60"
          onClick={() => {
            onClose();
            onOpenPerson(a.id);
          }}
        >
          <Avatar person={a} size="lg" />
          <span className="line-clamp-2 text-sm font-semibold text-stone-800 dark:text-stone-100">
            {fullName(a)}
          </span>
        </button>
        <span
          aria-hidden
          className={`relative inline-flex h-4 w-8 shrink-0 items-center justify-center ${
            divorced ? 'opacity-50' : ''
          }`}
        >
          <span className="absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2 rounded bg-rose-400 dark:bg-rose-500" />
          <span className="relative z-[1] flex -space-x-1">
            <span className="inline-block h-3 w-3 rounded-full border-2 border-rose-500 bg-transparent dark:border-rose-400" />
            <span className="inline-block h-3 w-3 rounded-full border-2 border-rose-500 bg-transparent dark:border-rose-400" />
          </span>
        </span>
        <button
          type="button"
          className="flex min-w-0 flex-1 flex-col items-center gap-1.5 rounded-xl p-2 transition-colors hover:bg-stone-50 dark:hover:bg-stone-800/60"
          onClick={() => {
            onClose();
            onOpenPerson(b.id);
          }}
        >
          <Avatar person={b} size="lg" />
          <span className="line-clamp-2 text-sm font-semibold text-stone-800 dark:text-stone-100">
            {fullName(b)}
          </span>
        </button>
      </div>

      <dl className="mt-5 space-y-3 rounded-2xl bg-stone-50 p-4 text-left dark:bg-stone-800/50">
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-stone-500 dark:text-stone-400">
            {t('couple.marriedOn')}
          </dt>
          <dd className="mt-0.5 text-base font-semibold text-stone-900 dark:text-stone-100">
            {marriedOn ? formatDate(marriedOn, language) : t('couple.noDate')}
          </dd>
          {marriedOn && !divorced && anniversary && (
            <dd className="mt-0.5 text-sm text-stone-500 dark:text-stone-400">
              {t('couple.weddingDay', {
                day: formatMonthDay(anniversary.month, anniversary.day, language),
              })}
            </dd>
          )}
          {marriedOn && !divorced && !anniversary && (
            <dd className="mt-0.5 text-sm text-stone-500 dark:text-stone-400">
              {t('couple.weddingDayKnown')}
            </dd>
          )}
        </div>
        {anniversary && !divorced && (
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-stone-500 dark:text-stone-400">
              {t('couple.nextAnniversary')}
            </dt>
            <dd className="mt-0.5 text-base font-semibold text-stone-900 dark:text-stone-100">
              {whenLabel}
              {nextDateLabel && (
                <span className="mt-0.5 block text-sm font-medium text-stone-600 dark:text-stone-300">
                  {nextDateLabel}
                </span>
              )}
              {yearsLabel && (
                <span className="mt-1 block text-sm font-semibold text-rose-700 dark:text-rose-300">
                  {yearsLabel}
                </span>
              )}
            </dd>
          </div>
        )}
        {!marriedOn && (
          <p className="text-sm text-stone-500 dark:text-stone-400">{t('couple.addDateHint')}</p>
        )}
      </dl>

      <button type="button" className="btn-secondary mt-5 w-full !min-h-11" onClick={onClose}>
        {t('common.close')}
      </button>
    </Modal>
  );
}
