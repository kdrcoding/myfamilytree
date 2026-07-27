import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { Bell, Cake, ImagePlus, Mic, UserPlus, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useFamily } from '../context/FamilyContext';
import { useSettings } from '../context/SettingsContext';
import { useT } from '../i18n/useT';
import {
  collectFamilyNotices,
  maybePushBrowserNotices,
  type FamilyNotice,
  type FamilyNoticeKind,
} from '../utils/notifications';

function kindIcon(kind: FamilyNoticeKind) {
  switch (kind) {
    case 'birthday':
      return Cake;
    case 'join':
      return UserPlus;
    case 'audio':
      return Mic;
    default:
      return ImagePlus;
  }
}

/**
 * Compact in-app notification bell. Mobile uses a full-width sheet under the
 * header so nothing is clipped; Telegram/email share links are intentionally
 * omitted to keep the panel simple.
 */
export function NotificationsBell() {
  const t = useT();
  const navigate = useNavigate();
  const { people } = useFamily();
  const { canDelete } = useAuth();
  const { settings } = useSettings();
  const [open, setOpen] = useState(false);
  const [notices, setNotices] = useState<FamilyNotice[]>([]);
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const labels = useMemo(
    () => ({
      birthdayTomorrow: (name: string) => t('notify.bdayTomorrow', { name }),
      birthdayToday: (name: string) => t('notify.bdayToday', { name }),
      joinPending: (n: number) => t('notify.joinPending', { n }),
      joinPendingBody: t('notify.joinPendingBody'),
      memoryRecent: (title: string) => t('notify.memoryRecent', { title }),
      audioRecent: (title: string) => t('notify.audioRecent', { title }),
    }),
    [t],
  );

  useEffect(() => {
    let cancelled = false;
    void collectFamilyNotices(people, labels, { isOwner: canDelete }).then((items) => {
      if (cancelled) return;
      setNotices(items);
      maybePushBrowserNotices(items, Boolean(settings.browserNotify));
    });
    return () => {
      cancelled = true;
    };
  }, [people, labels, canDelete, settings.browserNotify]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (btnRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
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

  const openNotice = (notice: FamilyNotice) => {
    setOpen(false);
    if (notice.href) navigate(notice.href);
  };

  const panel = open
    ? createPortal(
        <div
          ref={panelRef}
          role="dialog"
          aria-label={t('notify.title')}
          className="fixed inset-x-2 top-[4.25rem] z-[60] max-h-[min(70dvh,24rem)] overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-xl sm:inset-x-auto sm:right-3 sm:w-80 lg:right-6 dark:border-stone-700 dark:bg-stone-900"
        >
          <div className="flex items-center justify-between gap-2 border-b border-stone-100 px-3 py-2 dark:border-stone-800">
            <p className="text-sm font-bold text-stone-800 dark:text-stone-100">
              {t('notify.title')}
              {notices.length > 0 ? (
                <span className="ml-1.5 text-xs font-semibold text-stone-400">
                  {notices.length}
                </span>
              ) : null}
            </p>
            <button
              type="button"
              className="icon-btn !h-8 !w-8"
              onClick={() => setOpen(false)}
              aria-label={t('common.close')}
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>

          {notices.length === 0 ? (
            <p className="px-3 py-4 text-sm text-stone-500 dark:text-stone-400">{t('notify.empty')}</p>
          ) : (
            <ul className="max-h-[min(60dvh,20rem)] overflow-y-auto overscroll-contain py-1">
              {notices.map((notice) => {
                const Icon = kindIcon(notice.kind);
                const showBody = notice.body && notice.body !== notice.title;
                return (
                  <li key={notice.id}>
                    <button
                      type="button"
                      className="flex w-full items-start gap-2.5 px-3 py-2.5 text-left hover:bg-stone-50 active:bg-stone-100 dark:hover:bg-stone-800/80 dark:active:bg-stone-800"
                      onClick={() => openNotice(notice)}
                    >
                      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                        <Icon className="h-3.5 w-3.5" aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-stone-800 dark:text-stone-100">
                          {notice.title}
                        </span>
                        {showBody && (
                          <span className="mt-0.5 block truncate text-xs text-stone-500 dark:text-stone-400">
                            {notice.body}
                          </span>
                        )}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>,
        document.body,
      )
    : null;

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className="icon-btn !min-h-11 !min-w-11 relative"
        aria-label={t('notify.bell')}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <Bell className="h-5 w-5" aria-hidden />
        {notices.length > 0 && (
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-emerald-500" aria-hidden />
        )}
      </button>
      {panel}
    </>
  );
}
