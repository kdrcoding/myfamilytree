import { createContext, useCallback, useContext, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Modal } from '../components/ui/Modal';

interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback<ConfirmFn>((opts) => {
    setOptions(opts);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const close = useCallback((value: boolean) => {
    resolver.current?.(value);
    resolver.current = null;
    setOptions(null);
  }, []);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {options && (
        <Modal onClose={() => close(false)} labelledBy="confirm-title" size="sm">
          <div className="flex items-start gap-3">
            {options.danger && (
              <span className="rounded-full bg-red-100 p-2 text-red-600 dark:bg-red-900/40 dark:text-red-300">
                <AlertTriangle className="h-5 w-5" aria-hidden />
              </span>
            )}
            <div className="min-w-0 flex-1">
              <h2
                id="confirm-title"
                className="text-lg font-semibold text-stone-900 dark:text-stone-100"
              >
                {options.title}
              </h2>
              <p className="mt-1 text-sm text-stone-600 dark:text-stone-300">{options.message}</p>
            </div>
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={() => close(false)}>
              {options.cancelLabel ?? 'Cancel'}
            </button>
            <button
              type="button"
              className={options.danger ? 'btn-danger' : 'btn-primary'}
              onClick={() => close(true)}
              autoFocus
            >
              {options.confirmLabel ?? 'Confirm'}
            </button>
          </div>
        </Modal>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used inside ConfirmProvider');
  return ctx;
}
