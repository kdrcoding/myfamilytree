import { useEffect, useMemo, useState } from 'react';
import { Download, Share, Smartphone, X } from 'lucide-react';
import { useT } from '../i18n/useT';
import { loadJson, saveJson, STORAGE_KEYS } from '../utils/storage';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

function isStandaloneDisplay(): boolean {
  if (typeof window === 'undefined') return true;
  const mq = window.matchMedia?.('(display-mode: standalone)')?.matches;
  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return Boolean(mq || iosStandalone);
}

function isIosSafari(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  const iOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const webkit = /WebKit/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
  return iOS && webkit;
}

/**
 * One-time tip so elders can pin the family site to their phone home screen.
 * Hidden in installed/standalone mode and after dismiss.
 */
export function InstallAppTip() {
  const t = useT();
  const [dismissed, setDismissed] = useState(
    () =>
      loadJson<boolean>(STORAGE_KEYS.installTipDismissed, (v): v is boolean => typeof v === 'boolean') ===
      true,
  );
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [standalone, setStandalone] = useState(isStandaloneDisplay);
  const ios = useMemo(() => isIosSafari(), []);

  useEffect(() => {
    const onChange = () => setStandalone(isStandaloneDisplay());
    const mq = window.matchMedia?.('(display-mode: standalone)');
    mq?.addEventListener?.('change', onChange);
    const onBip = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', onBip);
    return () => {
      mq?.removeEventListener?.('change', onChange);
      window.removeEventListener('beforeinstallprompt', onBip);
    };
  }, []);

  if (dismissed || standalone) return null;
  // Only show when we can guide install (Android prompt or iOS Share steps).
  if (!deferred && !ios) return null;

  const dismiss = () => {
    saveJson(STORAGE_KEYS.installTipDismissed, true);
    setDismissed(true);
  };

  const install = async () => {
    if (!deferred) return;
    try {
      await deferred.prompt();
      await deferred.userChoice;
    } catch (err) {
      console.warn('install prompt failed', err);
    } finally {
      setDeferred(null);
      dismiss();
    }
  };

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(4.25rem+var(--safe-bottom))] z-[55] flex justify-center px-3 sm:bottom-6">
      <div
        role="status"
        className="pointer-events-auto flex max-w-lg items-start gap-3 rounded-2xl border border-emerald-300/80 bg-emerald-50/95 px-3 py-3 text-sm text-emerald-950 shadow-lg backdrop-blur-sm dark:border-emerald-800 dark:bg-emerald-950/95 dark:text-emerald-100"
      >
        <Smartphone className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700 dark:text-emerald-300" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{t('install.title')}</p>
          <p className="mt-0.5 text-xs leading-relaxed opacity-90">
            {ios ? t('install.bodyIos') : t('install.body')}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {deferred && (
              <button
                type="button"
                className="inline-flex min-h-9 items-center gap-1.5 rounded-xl bg-emerald-700 px-3 text-xs font-semibold text-white hover:bg-emerald-800"
                onClick={() => void install()}
              >
                <Download className="h-3.5 w-3.5" aria-hidden />
                {t('install.btn')}
              </button>
            )}
            {ios && (
              <span className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-emerald-700/30 px-3 text-xs font-medium">
                <Share className="h-3.5 w-3.5" aria-hidden />
                {t('install.iosHint')}
              </span>
            )}
            <button
              type="button"
              className="inline-flex min-h-9 items-center rounded-xl px-2 text-xs font-medium underline-offset-2 hover:underline"
              onClick={dismiss}
            >
              {t('install.dismiss')}
            </button>
          </div>
        </div>
        <button
          type="button"
          className="shrink-0 rounded-lg p-1 hover:bg-emerald-200/60 dark:hover:bg-emerald-900/60"
          aria-label={t('install.dismiss')}
          onClick={dismiss}
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </div>
  );
}
