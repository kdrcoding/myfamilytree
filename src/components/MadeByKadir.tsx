import { useEffect, useRef, useState } from 'react';
import { Code2, Instagram, Mail, Send, X } from 'lucide-react';
import { useT } from '../i18n/useT';

const CONTACTS = [
  {
    key: 'instagram',
    href: 'https://www.instagram.com/imkadir',
    label: 'Instagram',
    handle: '@imkadir',
    icon: Instagram,
    iconClass:
      'bg-gradient-to-tr from-amber-400 via-rose-500 to-purple-600 text-white',
  },
  {
    key: 'email',
    href: 'mailto:kadir@kdrcoding.com',
    label: 'Email',
    handle: 'kadir@kdrcoding.com',
    icon: Mail,
    iconClass: 'bg-emerald-600 text-white',
  },
  {
    key: 'telegram',
    href: 'https://telegram.me/imkadi',
    label: 'Telegram',
    handle: '@imkadi',
    icon: Send,
    iconClass: 'bg-sky-500 text-white',
  },
] as const;

/**
 * "App made by Kadir" credit badge. Clicking it pops up the author's
 * contact options (Instagram / email / Telegram). Closes on Escape,
 * outside click, or the X button. `align` keeps the popover on-screen
 * when the badge sits near a viewport edge.
 */
export function MadeByKadir({ align = 'center' }: { align?: 'center' | 'left' }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const t = useT();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const onClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClick);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative inline-flex justify-center">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="dialog"
        className="inline-flex items-center gap-1.5 rounded-full border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-500 shadow-sm transition-colors hover:border-emerald-300 hover:text-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-400 dark:hover:border-emerald-700 dark:hover:text-emerald-300"
      >
        <Code2 className="h-3.5 w-3.5" aria-hidden />
        {t('credit.madeBy')}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label={t('credit.contactTitle')}
          className={`absolute bottom-full z-50 mb-3 w-72 animate-modal-in rounded-2xl border border-stone-200 bg-white p-4 text-left shadow-xl dark:border-stone-700 dark:bg-stone-900 ${
            align === 'center' ? 'left-1/2 -translate-x-1/2' : 'left-0'
          }`}
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-bold text-stone-900 dark:text-stone-100">Kadir</p>
              <p className="mt-0.5 text-xs text-stone-500 dark:text-stone-400">
                {t('credit.contactTitle')}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label={t('credit.close')}
              className="rounded-lg p-1 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:hover:bg-stone-800 dark:hover:text-stone-200"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>

          <ul className="mt-3 space-y-1.5">
            {CONTACTS.map(({ key, href, label, handle, icon: Icon, iconClass }) => (
              <li key={key}>
                <a
                  href={href}
                  target={key === 'email' ? undefined : '_blank'}
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 rounded-xl px-2.5 py-2 transition-colors hover:bg-stone-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:hover:bg-stone-800"
                >
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${iconClass}`}
                  >
                    <Icon className="h-4 w-4" aria-hidden />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-stone-800 dark:text-stone-100">
                      {label}
                    </span>
                    <span className="block truncate text-xs text-stone-500 dark:text-stone-400">
                      {handle}
                    </span>
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
