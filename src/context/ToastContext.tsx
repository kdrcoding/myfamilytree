import { createContext, useCallback, useContext, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { CheckCircle2, Info, XCircle, X } from 'lucide-react';
import { useT } from '../i18n/useT';

type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: number;
  type: ToastType;
  message: string;
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const ICONS: Record<ToastType, typeof Info> = {
  success: CheckCircle2,
  error: XCircle,
  info: Info,
};

const STYLES: Record<ToastType, string> = {
  success: 'border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-200',
  error: 'border-red-300 dark:border-red-700 text-red-800 dark:text-red-200',
  info: 'border-sky-300 dark:border-sky-700 text-sky-800 dark:text-sky-200',
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);
  const t = useT();

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (message: string, type: ToastType = 'success') => {
      const id = nextId.current++;
      setToasts((current) => [...current.slice(-2), { id, type, message }]);
      window.setTimeout(() => dismiss(id), 4000);
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {/* Each toast is its own role="status" live region — no aria-live here,
          nested live regions double-announce on some screen readers. */}
      <div className="pointer-events-none fixed bottom-4 left-1/2 z-[80] flex w-full max-w-sm -translate-x-1/2 flex-col gap-2 px-4 sm:left-auto sm:right-4 sm:translate-x-0">
        {toasts.map((item) => {
          const Icon = ICONS[item.type];
          return (
            <div
              key={item.id}
              role="status"
              className={`animate-toast-in pointer-events-auto flex items-start gap-2 rounded-xl border bg-white/95 p-3 text-sm shadow-lg backdrop-blur dark:bg-stone-900/95 ${STYLES[item.type]}`}
            >
              <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <span className="flex-1">{item.message}</span>
              <button
                type="button"
                onClick={() => dismiss(item.id)}
                className="rounded p-0.5 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200"
                aria-label={t('toast.dismiss')}
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
}
