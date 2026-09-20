import { useMemo } from 'react';
import { Cake, PartyPopper } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { UpcomingBirthday } from '../utils/birthdays';
import { fullName } from '../utils/family';
import { isLivingPerson } from '../utils/living';
import { usePrivacy } from '../hooks/usePrivacy';
import { useT } from '../i18n/useT';
import { Avatar } from './Avatar';
import { Modal } from './ui/Modal';

interface BirthdayTodayModalProps {
  birthdays: UpcomingBirthday[];
  onClose: () => void;
}

/**
 * Once-per-day welcome popup when someone in the family has a birthday today.
 * Living people only — never congratulates or names the deceased.
 */
export function BirthdayTodayModal({ birthdays, onClose }: BirthdayTodayModalProps) {
  const t = useT();
  const privacy = usePrivacy();
  const living = useMemo(
    () => birthdays.filter((b) => isLivingPerson(b.person)),
    [birthdays],
  );
  if (living.length === 0) return null;

  const multi = living.length > 1;
  const first = living[0]!;

  return (
    <Modal onClose={onClose} labelledBy="bday-today-title" size="sm">
      <div className="relative overflow-hidden text-center">
        <div
          className="pointer-events-none absolute inset-x-0 -top-8 h-28 bg-gradient-to-b from-rose-100/80 via-amber-50/50 to-transparent dark:from-rose-950/40 dark:via-amber-950/20"
          aria-hidden
        />
        <div className="relative mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-rose-200 via-amber-100 to-emerald-100 text-rose-800 shadow-md ring-1 ring-rose-200/60 dark:from-rose-900/60 dark:via-amber-900/40 dark:to-emerald-900/50 dark:text-rose-100 dark:ring-rose-800/50">
          <PartyPopper className="h-7 w-7" aria-hidden />
        </div>

        <p className="relative mt-4 text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-rose-700 dark:text-rose-300">
          {t('home.bdayPopupKicker')}
        </p>

        <h2
          id="bday-today-title"
          className="relative mt-2 font-display text-2xl font-semibold tracking-tight text-stone-900 dark:text-stone-50"
        >
          {multi
            ? t('home.bdayPopupTitleMany', { n: living.length })
            : t('home.bdayPopupTitleOne', { name: fullName(first.person) })}
        </h2>

        <p className="relative mt-2 text-sm leading-relaxed text-stone-600 dark:text-stone-400">
          {multi ? t('home.bdayPopupBodyMany') : t('home.bdayPopupBodyOne')}
        </p>

        <ul className="relative mt-5 space-y-2 text-left">
          {living.map((b) => {
            const showAge = b.turningAge !== null && privacy.showAge(b.person);
            return (
              <li key={b.person.id}>
                <Link
                  to={`/bday/${encodeURIComponent(b.person.id)}`}
                  onClick={onClose}
                  className="flex items-center gap-3 rounded-xl border border-rose-900/10 bg-gradient-to-r from-rose-50/80 to-amber-50/60 px-3 py-2.5 transition-colors hover:from-rose-100/80 hover:to-amber-100/70 dark:border-rose-800/40 dark:from-rose-950/40 dark:to-amber-950/20 dark:hover:from-rose-950/60"
                >
                  <Avatar person={b.person} size="md" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-stone-900 dark:text-stone-100">
                      {fullName(b.person)}
                    </p>
                    {showAge && (
                      <p className="text-sm text-rose-800 dark:text-rose-300">
                        {t('home.bdayTurnsToday', { age: b.turningAge! })}
                      </p>
                    )}
                  </div>
                  <Cake className="h-4 w-4 shrink-0 text-rose-700 dark:text-rose-400" aria-hidden />
                </Link>
              </li>
            );
          })}
        </ul>

        <div className="relative mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Link
            to={
              multi
                ? '/#home-today-bday'
                : `/bday/${encodeURIComponent(first.person.id)}`
            }
            onClick={onClose}
            className="btn-primary !min-h-11"
          >
            {multi ? t('home.bdayPopupSeeAll') : t('home.bdayPopupOpen')}
          </Link>
          <button type="button" className="btn-secondary !min-h-11" onClick={onClose}>
            {t('home.bdayPopupDismiss')}
          </button>
        </div>
      </div>
    </Modal>
  );
}
