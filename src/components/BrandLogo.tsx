import type { ReactNode } from 'react';
import { useId } from 'react';
import { useT } from '../i18n/useT';

type MarkSize = 'sm' | 'md' | 'lg';

const SIZES: Record<MarkSize, string> = {
  sm: 'h-8 w-8',
  md: 'h-9 w-9',
  lg: 'h-16 w-16',
};

/**
 * Custom Oq-Ariq mark: a soft pedigree tree (people as dots, branches as lines).
 * Replaces the generic Lucide icon-in-a-green-box look.
 */
export function BrandMark({
  size = 'md',
  className = '',
  title,
}: {
  size?: MarkSize;
  className?: string;
  title?: string;
}) {
  const uid = useId().replace(/:/g, '');
  const bgId = `oa-bg-${uid}`;
  const leafId = `oa-leaf-${uid}`;

  return (
    <span
      className={`inline-flex shrink-0 overflow-hidden rounded-2xl shadow-sm ring-1 ring-emerald-900/10 dark:ring-white/10 ${SIZES[size]} ${className}`}
      title={title}
      aria-hidden={title ? undefined : true}
    >
      <svg viewBox="0 0 64 64" className="h-full w-full" role="img" aria-label={title}>
        <defs>
          <linearGradient id={bgId} x1="12" y1="4" x2="52" y2="60" gradientUnits="userSpaceOnUse">
            <stop stopColor="#047857" />
            <stop offset="1" stopColor="#0f766e" />
          </linearGradient>
          <linearGradient id={leafId} x1="20" y1="10" x2="44" y2="54" gradientUnits="userSpaceOnUse">
            <stop stopColor="#ecfdf5" />
            <stop offset="1" stopColor="#a7f3d0" />
          </linearGradient>
        </defs>
        <rect width="64" height="64" rx="16" fill={`url(#${bgId})`} />
        <circle cx="32" cy="28" r="22" fill="#064e3b" opacity="0.25" />
        <path
          d="M32 18v14M32 32L18 44M32 32l14 12"
          fill="none"
          stroke={`url(#${leafId})`}
          strokeWidth="2.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="32" cy="16" r="5.5" fill="#ecfdf5" />
        <circle cx="18" cy="46" r="5" fill="#d1fae5" />
        <circle cx="46" cy="46" r="5" fill="#d1fae5" />
        <circle cx="32" cy="34" r="3.25" fill="#6ee7b7" opacity="0.95" />
      </svg>
    </span>
  );
}

/** Header / lock-screen lockup: mark + optional wordmark. */
export function BrandLogo({
  size = 'md',
  wordmark = true,
  className = '',
}: {
  size?: MarkSize;
  wordmark?: boolean;
  className?: string;
}) {
  const t = useT();
  const title = t('site.title');

  return (
    <span className={`inline-flex min-w-0 items-center gap-2.5 ${className}`}>
      <BrandMark size={size} title={title} />
      {wordmark && (
        <span className="min-w-0 truncate text-base font-bold tracking-tight text-stone-900 sm:text-lg dark:text-stone-50">
          {title}
        </span>
      )}
    </span>
  );
}

/** Large lock-screen / empty-state hero mark with caption slot. */
export function BrandHero({ children }: { children?: ReactNode }) {
  const t = useT();
  return (
    <div className="flex flex-col items-center text-center">
      <BrandMark size="lg" title={t('site.title')} className="!h-20 !w-20 !rounded-[1.35rem] shadow-md" />
      {children}
    </div>
  );
}
