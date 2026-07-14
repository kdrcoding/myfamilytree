import { User, UserRound, CircleUser } from 'lucide-react';
import type { FamilyPerson } from '../types/family';
import { fullName, initials } from '../utils/family';
import { usePhotoUrl } from '../context/PhotoUrlsContext';
import { usePrivacy } from '../hooks/usePrivacy';
import { useT } from '../i18n/useT';

interface AvatarProps {
  person: FamilyPerson;
  size?: 'sm' | 'md' | 'lg';
}

const SIZES = {
  sm: 'h-10 w-10 text-xs',
  md: 'h-14 w-14 text-sm',
  lg: 'h-24 w-24 text-xl',
};

const GENDER_STYLES = {
  male: 'bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-300',
  female: 'bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300',
  unspecified: 'bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300',
};

const GENDER_ICONS = {
  male: User,
  female: UserRound,
  unspecified: CircleUser,
};

/**
 * Shows the person's photo when available (and allowed by privacy settings),
 * otherwise a gender-tinted initials avatar with a default icon.
 */
export function Avatar({ person, size = 'md' }: AvatarProps) {
  const { showPhoto } = usePrivacy();
  const t = useT();
  const Icon = GENDER_ICONS[person.gender];
  // Storage-hosted photos resolve to a signed URL (null until resolved —
  // the initials avatar shows meanwhile); data-URLs pass straight through.
  const photoUrl = usePhotoUrl(person.photo);

  if (photoUrl && showPhoto()) {
    return (
      <img
        src={photoUrl}
        alt={t('avatar.photoOf', { name: fullName(person) })}
        className={`${SIZES[size]} shrink-0 rounded-full object-cover ring-2 ring-white shadow dark:ring-stone-700 ${
          person.isDeceased ? 'grayscale' : ''
        }`}
      />
    );
  }

  return (
    <span
      aria-hidden
      className={`${SIZES[size]} ${GENDER_STYLES[person.gender]} flex shrink-0 flex-col items-center justify-center rounded-full font-semibold ring-2 ring-white shadow dark:ring-stone-700 ${
        person.isDeceased ? 'opacity-75 saturate-50' : ''
      }`}
    >
      {size === 'lg' && <Icon className="mb-0.5 h-7 w-7" />}
      {initials(person)}
    </span>
  );
}
