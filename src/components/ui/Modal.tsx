import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface ModalProps {
  onClose: () => void;
  children: ReactNode;
  labelledBy: string;
  size?: 'sm' | 'md' | 'lg';
}

const SIZES = {
  sm: 'max-w-md',
  md: 'max-w-xl',
  lg: 'max-w-3xl',
};

// Open modals, bottom-most first. Escape and the body scroll lock belong to
// the top of the stack — a confirm dialog over a details modal must not close
// or unlock the one beneath it.
const modalStack: HTMLElement[] = [];

const FOCUSABLE =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

/** Accessible modal dialog: closes on Escape / backdrop click, traps focus. */
export function Modal({ onClose, children, labelledBy, size = 'md' }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    if (panel) modalStack.push(panel);
    (panel?.querySelector<HTMLElement>(FOCUSABLE) ?? panel)?.focus();

    const onKey = (event: KeyboardEvent) => {
      if (!panel || modalStack[modalStack.length - 1] !== panel) return;
      if (event.key === 'Escape') {
        onClose();
        return;
      }
      if (event.key === 'Tab') {
        // Keep Tab / Shift+Tab cycling inside the dialog.
        const focusable = [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
          (el) => !el.hasAttribute('disabled') && el.offsetParent !== null,
        );
        if (focusable.length === 0) {
          event.preventDefault();
          panel.focus();
          return;
        }
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        const active = document.activeElement;
        if (event.shiftKey && (active === first || !panel.contains(active))) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && (active === last || !panel.contains(active))) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      if (panel) {
        const i = modalStack.indexOf(panel);
        if (i !== -1) modalStack.splice(i, 1);
      }
      if (modalStack.length === 0) document.body.style.overflow = '';
      previous?.focus();
    };
  }, [onClose]);

  return createPortal(
    <div
      className="animate-fade-in fixed inset-0 z-[70] flex items-end justify-center bg-stone-900/50 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
        className={`max-h-[92vh] w-full ${SIZES[size]} animate-modal-in overflow-y-auto overscroll-contain rounded-t-2xl bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-stone-900 shadow-2xl outline-none sm:rounded-2xl sm:pb-5 dark:bg-stone-900 dark:text-stone-100 dark:ring-1 dark:ring-stone-700`}
      >
        {/* Bottom-sheet affordance on phones. */}
        <div className="mx-auto -mt-1 mb-3 h-1.5 w-10 rounded-full bg-stone-200 sm:hidden dark:bg-stone-700" aria-hidden />
        {children}
      </div>
    </div>,
    document.body,
  );
}
