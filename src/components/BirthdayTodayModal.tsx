import { Cake, PartyPopper } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { UpcomingBirthday } from '../utils/birthdays';
import { fullName } from '../utils/family';
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
 */
export function BirthdayTodayModal({ birthdays, onClose }: BirthdayTodayModalProps) {
  const t = useT();
  const privacy = usePrivacy();
  if (birthdays.length === 0) return null;

  const multi = birthdays.length > 1;
  const first = birthdays[0]!;

  return (
    <Modal onClose={onClose} labelledBy="bday-today-title" size="sm">
      <div className="text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200">
          <PartyPopper className="h-7 w-7" aria-hidden />
        </div>

        <p className="mt-4 text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-emerald-700 dark:text-emerald-400">
          {t('home.bdayPopupKicker')}
        </p>

        <h2 id="bday-today-title" className="mt-2 font-display text-2xl font-semibold tracking-tight text-stone-900 dark:text-stone-50">
          {multi
            ? t('home.bdayPopupTitleMany', { n: birthdays.length })
            : t('home.bdayPopupTitleOne', { name: fullName(first.person) })}
        </h2>

        <p className="mt-2 text-sm leading-relaxed text-stone-600 dark:text-stone-400">
          {multi ? t('home.bdayPopupBodyMany') : t('home.bdayPopupBodyOne')}
        </p>

        <ul className="mt-5 space-y-2 text-left">
          {birthdays.map((b) => {
            const showAge = b.turningAge !== null && privacy.showAge(b.person);
            return (
              <li key={b.person.id}>
                <Link
                  to={`/tree?person=${encodeURIComponent(b.person.id)}`}
                  onClick={onClose}
                  className="flex items-center gap-3 rounded-xl border border-emerald-900/10 bg-emerald-50/60 px-3 py-2.5 transition-colors hover:bg-emerald-100/70 dark:border-emerald-800/40 dark:bg-emerald-950/30 dark:hover:bg-emerald-950/50"
                >
                  <Avatar person={b.person} size="md" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-stone-900 dark:text-stone-100">
                      {fullName(b.person)}
                    </p>
                    {showAge && (
                      <p className="text-sm text-emerald-800 dark:text-emerald-300">
                        {t('home.bdayTurnsToday', { age: b.turningAge! })}
                      </p>
                    )}
                  </div>
                  <Cake className="h-4 w-4 shrink-0 text-emerald-700 dark:text-emerald-400" aria-hidden />
                </Link>
              </li>
            );
          })}
        </ul>

        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Link
            to={
              multi
                ? '/#home-celebrations'
                : `/tree?person=${encodeURIComponent(first.person.id)}`
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
