import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { MoreVertical } from 'lucide-react';
import { useT } from '../i18n/useT';

export interface OverflowMenuItem {
  id: string;
  label: string;
  icon?: ReactNode;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
}

/**
 * Compact ⋮ menu for secondary actions — keeps the main screen simple for elders.
 */
export function OverflowMenu({
  items,
  align = 'right',
  label,
}: {
  items: OverflowMenuItem[];
  align?: 'left' | 'right';
  label?: string;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const visible = items.filter(Boolean);

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

  if (visible.length === 0) return null;

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        className="icon-btn !min-h-10 !min-w-10"
        aria-label={label ?? t('nav.more')}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
      >
        <MoreVertical className="h-5 w-5" aria-hidden />
      </button>
      {open && (
        <ul
          role="menu"
          className={`absolute z-50 mt-1 min-w-[12rem] overflow-hidden rounded-2xl border border-stone-200 bg-white py-1 shadow-xl dark:border-stone-700 dark:bg-stone-900 ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
        >
          {visible.map((item) => (
            <li key={item.id} role="none">
              <button
                type="button"
                role="menuitem"
                disabled={item.disabled}
                className={`flex w-full items-center gap-2.5 px-3.5 py-3 text-left text-sm font-semibold disabled:opacity-40 ${
                  item.danger
                    ? 'text-rose-700 hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-950/40'
                    : 'text-stone-800 hover:bg-stone-100 dark:text-stone-100 dark:hover:bg-stone-800'
                }`}
                onClick={() => {
                  setOpen(false);
                  item.onClick();
                }}
              >
                {item.icon}
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
