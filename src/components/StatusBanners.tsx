import { useEffect, useState } from 'react';
import { RefreshCw, WifiOff } from 'lucide-react';
import { SW_UPDATE_EVENT } from '../lib/swUpdate';
import { useT } from '../i18n/useT';

/**
 * Connection + “new version” notices. Both stay out of the way of the
 * bottom tabs on phones.
 */
export function StatusBanners() {
  const t = useT();
  const [offline, setOffline] = useState(() => typeof navigator !== 'undefined' && !navigator.onLine);
  const [updateReady, setUpdateReady] = useState(false);

  useEffect(() => {
    const goOnline = () => setOffline(false);
    const goOffline = () => setOffline(true);
    const onUpdate = () => setUpdateReady(true);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    window.addEventListener(SW_UPDATE_EVENT, onUpdate);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
      window.removeEventListener(SW_UPDATE_EVENT, onUpdate);
    };
  }, []);

  if (!offline && !updateReady) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-[calc(3.5rem+var(--safe-top))] z-[60] flex flex-col items-center gap-2 px-3 sm:top-[calc(4rem+var(--safe-top))]">
      {offline && (
        <p
          role="status"
          className="pointer-events-auto max-w-lg rounded-2xl border border-amber-300/80 bg-amber-50 px-3 py-2 text-center text-sm font-medium text-amber-950 shadow-lg dark:border-amber-800 dark:bg-amber-950/90 dark:text-amber-100"
        >
          <WifiOff className="mr-1.5 inline h-4 w-4 align-text-bottom" aria-hidden />
          {t('status.offline')}
        </p>
      )}
      {updateReady && (
        <p
          role="status"
          className="pointer-events-auto flex max-w-lg items-center gap-2 rounded-2xl border border-emerald-300/80 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-950 shadow-lg dark:border-emerald-800 dark:bg-emerald-950/90 dark:text-emerald-100"
        >
          <span className="flex-1">{t('status.update')}</span>
          <button
            type="button"
            className="inline-flex min-h-9 items-center gap-1 rounded-xl bg-emerald-700 px-3 text-white hover:bg-emerald-800"
            onClick={() => window.__familytreeApplyUpdate?.()}
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden />
            {t('status.updateBtn')}
          </button>
        </p>
      )}
    </div>
  );
}
