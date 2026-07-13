import { CircleHelp, Flower2, Mars, Venus } from 'lucide-react';
import type { FamilyPerson, Gender } from '../types/family';
import { useT } from '../i18n/useT';

const GENDER_META: Record<Gender, { icon: typeof Mars; className: string }> = {
  male: {
    icon: Mars,
    className:
      'border-sky-300 bg-sky-50 text-sky-800 dark:border-sky-800 dark:bg-sky-950/60 dark:text-sky-300',
  },
  female: {
    icon: Venus,
    className:
      'border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950/60 dark:text-rose-300',
  },
  unspecified: {
    icon: CircleHelp,
    className:
      'border-violet-300 bg-violet-50 text-violet-800 dark:border-violet-800 dark:bg-violet-950/60 dark:text-violet-300',
  },
};

const GENDER_KEY = {
  male: 'badge.male',
  female: 'badge.female',
  unspecified: 'badge.unspecified',
} as const;

export function GenderBadge({ gender, compact }: { gender: Gender; compact?: boolean }) {
  const t = useT();
  const meta = GENDER_META[gender];
  const Icon = meta.icon;
  const label = t(GENDER_KEY[gender]);
  return (
    <span className={`badge ${meta.className}`} title={label}>
      <Icon className="h-3 w-3" aria-hidden />
      {!compact && label}
      {compact && <span className="sr-only">{label}</span>}
    </span>
  );
}

export function DeceasedBadge({ person, compact }: { person: FamilyPerson; compact?: boolean }) {
  const t = useT();
  if (!person.isDeceased) return null;
  return (
    <span
      className="badge border-stone-300 bg-stone-100 text-stone-700 dark:border-stone-600 dark:bg-stone-800 dark:text-stone-300"
      title={t('badge.deceased')}
    >
      <Flower2 className="h-3 w-3" aria-hidden />
      {!compact && t('badge.deceased')}
      {compact && <span className="sr-only">{t('badge.deceased')}</span>}
    </span>
  );
}

export function GenerationBadge({ generation }: { generation: number }) {
  const t = useT();
  return (
    <span className="badge border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
      {t('badge.gen', { n: generation })}
    </span>
  );
}
