import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Mail, Send } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useFamily } from '../context/FamilyContext';
import { useSettings } from '../context/SettingsContext';
import { useT } from '../i18n/useT';
import {
  collectFamilyNotices,
  maybePushBrowserNotices,
  mailtoDigest,
  telegramShareUrl,
  type FamilyNotice,
} from '../utils/notifications';

/**
 * In-app notification bell: birthdays (today/tomorrow), join requests,
 * recent photos & audio stories. Optional browser + Telegram/email share.
 */
export function NotificationsBell() {
  const t = useT();
  const navigate = useNavigate();
  const { people } = useFamily();
  const { canDelete } = useAuth();
  const { settings } = useSettings();
  const [open, setOpen] = useState(false);
  const [notices, setNotices] = useState<FamilyNotice[]>([]);
  const rootRef = useRef<HTMLDivElement>(null);

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
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const digestText = notices.map((n) => `• ${n.title}`).join('\n') || t('notify.empty');

  return (
    <div className="relative" ref={rootRef}>
      <button
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

      {open && (
        <div
          className="absolute right-0 z-50 mt-2 w-[min(100vw-2rem,22rem)] rounded-2xl border border-stone-200 bg-white p-3 shadow-xl dark:border-stone-700 dark:bg-stone-900"
          role="dialog"
          aria-label={t('notify.title')}
        >
          <p className="px-1 text-sm font-bold text-stone-800 dark:text-stone-100">{t('notify.title')}</p>
          {notices.length === 0 ? (
            <p className="mt-2 px-1 text-sm text-stone-500 dark:text-stone-400">{t('notify.empty')}</p>
          ) : (
            <ul className="mt-2 max-h-72 space-y-1 overflow-y-auto">
              {notices.map((notice) => (
                <li key={notice.id}>
                  <button
                    type="button"
                    className="w-full rounded-xl px-3 py-2.5 text-left hover:bg-stone-100 dark:hover:bg-stone-800"
                    onClick={() => {
                      setOpen(false);
                      if (notice.href) navigate(notice.href);
                    }}
                  >
                    <span className="block text-sm font-semibold text-stone-800 dark:text-stone-100">
                      {notice.title}
                    </span>
                    <span className="mt-0.5 block text-xs text-stone-500 dark:text-stone-400">
                      {notice.body}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-3 flex flex-wrap gap-2 border-t border-stone-200 pt-3 dark:border-stone-700">
            <a
              className="btn-secondary !py-1.5 !text-xs"
              href={telegramShareUrl(`${t('notify.digestTitle')}\n${digestText}`)}
              target="_blank"
              rel="noreferrer"
            >
              <Send className="h-3.5 w-3.5" aria-hidden />
              {t('notify.telegram')}
            </a>
            <a
              className="btn-secondary !py-1.5 !text-xs"
              href={mailtoDigest(t('notify.digestTitle'), digestText)}
            >
              <Mail className="h-3.5 w-3.5" aria-hidden />
              {t('notify.email')}
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
