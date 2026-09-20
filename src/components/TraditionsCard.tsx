import { useEffect, useMemo, useState } from 'react';
import { Flower2, Loader2, MoonStar, Plus, Sparkles, Trash2, Users } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useLanguage, useT } from '../i18n/useT';
import type { TKey } from '../i18n/translations';
import { fetchCustomTraditions, saveCustomTraditions } from '../lib/traditionsStore';
import { formatMonthDay } from '../utils/dates';
import {
  getUpcomingTraditions,
  type CustomTradition,
} from '../utils/traditions';

/**
 * Owner settings: built-in joyful holidays + custom family reunions.
 * Never tied to individual people (deceased are never named).
 */
export function TraditionsCard() {
  const t = useT();
  const language = useLanguage();
  const { canDelete } = useAuth();
  const { toast } = useToast();
  const [list, setList] = useState<CustomTradition[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');

  useEffect(() => {
    let cancelled = false;
    void fetchCustomTraditions()
      .then((rows) => {
        if (!cancelled) setList(rows);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const upcoming = useMemo(() => getUpcomingTraditions(list), [list]);

  const persist = async (next: CustomTradition[]) => {
    setBusy(true);
    try {
      await saveCustomTraditions(next);
      setList(next);
      toast(t('tradition.saved'), 'success');
    } catch (error) {
      console.error(error);
      toast(t('tradition.saveFailed'), 'error');
    } finally {
      setBusy(false);
    }
  };

  const addReunion = async () => {
    const cleanTitle = title.trim().slice(0, 80);
    if (!cleanTitle || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      toast(t('tradition.invalid'), 'error');
      return;
    }
    const next = [
      ...list,
      { id: crypto.randomUUID(), title: cleanTitle, date },
    ].slice(0, 40);
    await persist(next);
    setTitle('');
    setDate('');
  };

  const remove = async (id: string) => {
    await persist(list.filter((row) => row.id !== id));
  };

  return (
    <section className="card mt-4 space-y-3 p-4">
      <div>
        <h2 className="font-display text-lg font-semibold tracking-tight text-stone-900 dark:text-stone-50">
          {t('tradition.settingsTitle')}
        </h2>
        <p className="mt-1 text-sm leading-relaxed text-stone-600 dark:text-stone-400">
          {t('tradition.settingsIntro')}
        </p>
      </div>

      {loading ? (
        <p className="flex items-center gap-2 text-sm text-stone-500">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          {t('db.loading')}
        </p>
      ) : (
        <ul className="divide-y divide-stone-100 rounded-xl border border-stone-200/80 dark:divide-stone-800 dark:border-stone-700/80">
          {upcoming.slice(0, 8).map((row) => {
            const label =
              row.customTitle?.trim() ||
              (row.titleKey ? t(row.titleKey as TKey) : t('tradition.reunionFallback'));
            const Icon =
              row.kind === 'navruz'
                ? Flower2
                : row.kind === 'eid_fitr' || row.kind === 'eid_adha'
                  ? MoonStar
                  : row.kind === 'reunion'
                    ? Users
                    : Sparkles;
            const customId = row.kind === 'reunion' ? row.id.replace(/^reunion-/, '') : '';
            return (
              <li key={row.id} className="flex items-center gap-3 px-3 py-2.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200">
                  <Icon className="h-4 w-4" aria-hidden />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-stone-900 dark:text-stone-100">
                    {label}
                  </p>
                  <p className="text-xs text-stone-500 dark:text-stone-400">
                    {formatMonthDay(row.month, row.day, language)}
                    {row.kind === 'reunion' ? ` · ${row.year}` : ''}
                    {row.isToday ? ` · ${t('home.bdayToday')}` : ''}
                  </p>
                </div>
                {canDelete && row.kind === 'reunion' && customId && (
                  <button
                    type="button"
                    className="btn-secondary !min-h-9 !px-2 text-rose-700 dark:text-rose-300"
                    disabled={busy}
                    aria-label={t('tradition.remove')}
                    onClick={() => void remove(customId)}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {canDelete && (
        <div className="space-y-2 rounded-xl border border-dashed border-emerald-300/70 bg-emerald-50/40 p-3 dark:border-emerald-800/60 dark:bg-emerald-950/20">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-900 dark:text-emerald-200">
            {t('tradition.addReunion')}
          </p>
          <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
            <input
              type="text"
              className="input"
              maxLength={80}
              placeholder={t('tradition.titlePlaceholder')}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <input
              type="date"
              className="input"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
            <button
              type="button"
              className="btn-primary !min-h-10"
              disabled={busy}
              onClick={() => void addReunion()}
            >
              <Plus className="h-4 w-4" aria-hidden />
              {t('tradition.add')}
            </button>
          </div>
          <p className="text-xs text-stone-500 dark:text-stone-400">{t('tradition.addHint')}</p>
        </div>
      )}
    </section>
  );
}
