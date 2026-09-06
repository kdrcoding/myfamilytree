import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GitBranch, Search, TreePine } from 'lucide-react';
import { useT } from '../i18n/useT';
import type { TKey } from '../i18n/translations';
import { isBirthdayModalOpen, subscribeBirthdayModal } from '../lib/firstRunHold';
import { loadJson, saveJson, STORAGE_KEYS } from '../utils/storage';
import { Modal } from './ui/Modal';

const STEPS: {
  icon: typeof Search;
  titleKey: TKey;
  bodyKey: TKey;
  action: '/' | '/tree' | '/related';
}[] = [
  { icon: Search, titleKey: 'tour.step1Title', bodyKey: 'tour.step1Body', action: '/' },
  { icon: TreePine, titleKey: 'tour.step2Title', bodyKey: 'tour.step2Body', action: '/tree' },
  {
    icon: GitBranch,
    titleKey: 'tour.step3Title',
    bodyKey: 'tour.step3Body',
    action: '/related',
  },
];

/**
 * One-time welcome after login: three big steps for Search → Tree → Related.
 * Waits if today's birthday popup is already on screen.
 */
export function WelcomeTour() {
  const t = useT();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    const seen = loadJson<boolean>(
      STORAGE_KEYS.tourSeen,
      (v): v is boolean => typeof v === 'boolean',
    );
    if (seen) return;

    let cancelled = false;
    const tryOpen = () => {
      if (cancelled || isBirthdayModalOpen()) return;
      setOpen(true);
    };

    const unsub = subscribeBirthdayModal(() => {
      if (!isBirthdayModalOpen()) tryOpen();
    });
    const timer = window.setTimeout(tryOpen, 450);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      unsub();
    };
  }, []);

  if (!open) return null;

  const finish = () => {
    saveJson(STORAGE_KEYS.tourSeen, true);
    setOpen(false);
  };

  const current = STEPS[step];
  const Icon = current.icon;
  const isLast = step === STEPS.length - 1;

  return (
    <Modal onClose={finish} labelledBy="tour-title" size="sm">
      <div className="flex items-start justify-between gap-3">
        <span className="rounded-2xl bg-emerald-100 p-3 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300">
          <Icon className="h-8 w-8" aria-hidden />
        </span>
      </div>

      <p className="mt-4 text-sm font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
        {t('tour.progress', { n: step + 1, total: STEPS.length })}
      </p>
      <h2 id="tour-title" className="mt-1 text-2xl font-extrabold text-stone-900 dark:text-stone-50">
        {t(current.titleKey)}
      </h2>
      <p className="mt-2 text-base leading-relaxed text-stone-600 dark:text-stone-300">
        {t(current.bodyKey)}
      </p>

      <div className="mt-6 flex flex-col gap-2 sm:flex-row-reverse">
        <button
          type="button"
          className="btn-primary min-h-12 flex-1 text-base"
          onClick={() => {
            if (isLast) {
              navigate(current.action);
              finish();
            } else {
              navigate(current.action);
              setStep((s) => s + 1);
            }
          }}
        >
          {isLast ? t('tour.done') : t('tour.next')}
        </button>
        <button type="button" className="btn-secondary min-h-12 flex-1 text-base" onClick={finish}>
          {t('tour.skip')}
        </button>
      </div>
    </Modal>
  );
}
