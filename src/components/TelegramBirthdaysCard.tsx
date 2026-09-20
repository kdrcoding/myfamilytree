import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Activity, Copy, ExternalLink, Eye, Link2, Send, MessageCircle } from 'lucide-react';
import { useFamily } from '../context/FamilyContext';
import { useToast } from '../context/ToastContext';
import { useLanguage, useT } from '../i18n/useT';
import { fullName } from '../utils/family';
import { getUpcomingBirthdays } from '../utils/birthdays';
import { formatMonthDay } from '../utils/dates';
import { isLivingPerson } from '../utils/living';
import { fetchFilledThisWeek } from '../lib/datesProgress';
import { hasFullBirthDate } from '../features/birthday/publicApi';
import { ToggleSwitch } from './ui/ToggleSwitch';
import {
  TELEGRAM_TIMEZONES,
  botOpenUrl,
  fetchTelegramBotRuns,
  fetchTelegramSettings,
  mintDatesFillLink,
  previewUpcomingReminder,
  runBirthdayTest,
  sendMissingDatesNow,
  sendUpcomingReminderNow,
  updateTelegramSettings,
  type TelegramBotRun,
  type TelegramSettings,
} from '../lib/telegramBot';

function hoursSince(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return null;
  return Math.max(0, (Date.now() - t) / 3_600_000);
}

function formatRunTime(iso: string, language: string): string {
  try {
    return new Date(iso).toLocaleString(language === 'uz' ? 'uz-UZ' : language === 'ru' ? 'ru-RU' : 'en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

/**
 * Owner-only: wire the Telegram birthday bot (group posts only).
 */
export function TelegramBirthdaysCard() {
  const t = useT();
  const language = useLanguage();
  const { toast } = useToast();
  const { people } = useFamily();
  const [settings, setSettings] = useState<TelegramSettings | null>(null);
  const [runs, setRuns] = useState<TelegramBotRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [testPersonId, setTestPersonId] = useState('');
  const [unavailable, setUnavailable] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewText, setPreviewText] = useState('');
  const [previewCaption, setPreviewCaption] = useState<string | null>(null);
  const [filledWeek, setFilledWeek] = useState(0);

  const refresh = async () => {
    setLoading(true);
    try {
      const [s, log] = await Promise.all([
        fetchTelegramSettings(),
        fetchTelegramBotRuns(12).catch(() => [] as TelegramBotRun[]),
      ]);
      setSettings(s);
      setRuns(log);
      setUnavailable(!s);
    } catch (error) {
      console.error(error);
      setUnavailable(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  useEffect(() => {
    let cancelled = false;
    void fetchFilledThisWeek().then((n) => {
      if (!cancelled) setFilledWeek(n);
    });
    return () => {
      cancelled = true;
    };
  }, [people]);

  const patch = async (partial: Parameters<typeof updateTelegramSettings>[0]) => {
    setBusy(true);
    try {
      const next = await updateTelegramSettings(partial);
      setSettings(next);
      toast(t('telegram.saved'), 'success');
    } catch (error) {
      console.error(error);
      toast(t('telegram.saveFailed'), 'error');
    } finally {
      setBusy(false);
    }
  };

  const living = useMemo(
    () =>
      people
        .filter(isLivingPerson)
        .slice()
        .sort((a, b) => fullName(a).localeCompare(fullName(b))),
    [people],
  );

  useEffect(() => {
    if (living.length === 0) {
      if (testPersonId) setTestPersonId('');
      return;
    }
    if (!living.some((p) => p.id === testPersonId)) {
      setTestPersonId(living[0]!.id);
    }
  }, [living, testPersonId]);

  const readyCount = living.filter((p) => hasFullBirthDate(p.birthDate)).length;
  const missingCount = Math.max(0, living.length - readyCount);
  const upcomingWeek = useMemo(
    () => getUpcomingBirthdays(people).filter((b) => b.daysUntil <= 7),
    [people],
  );
  const staleHours = hoursSince(settings?.last_ok_at);
  const healthWarn = staleHours != null && staleHours >= 26;

  if (loading) {
    return (
      <section className="card mt-3 p-4">
        <p className="text-sm text-stone-400">{t('db.loading')}</p>
      </section>
    );
  }

  if (unavailable || !settings) {
    return (
      <section className="card mt-3 p-4">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <MessageCircle className="h-4 w-4 text-emerald-600" aria-hidden /> {t('telegram.title')}
        </h2>
        <p className="mt-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
          {t('telegram.setupNeeded')}
        </p>
      </section>
    );
  }

  const openBot = botOpenUrl(settings.bot_username);

  return (
    <section className="card mt-3 p-4">
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        <MessageCircle className="h-4 w-4 text-emerald-600" aria-hidden /> {t('telegram.title')}
      </h2>
      <p className="mt-0.5 text-xs text-stone-500 dark:text-stone-400">{t('telegram.intro')}</p>

      <div className="mt-3 rounded-xl border border-emerald-200/80 bg-emerald-50/70 p-3 text-sm dark:border-emerald-900 dark:bg-emerald-950/40">
        <p className="font-semibold text-emerald-900 dark:text-emerald-200">{t('telegram.coverageTitle')}</p>
        <p className="mt-1 text-xs leading-relaxed text-stone-600 dark:text-stone-400">
          {t('telegram.coverage', { ready: readyCount, living: living.length })}
        </p>
        {missingCount > 0 ? (
          <p className="mt-1.5 text-xs leading-relaxed text-amber-800 dark:text-amber-200">
            {t('telegram.coverageMissing', { n: missingCount })}
            {filledWeek > 0 ? ` · ${t('telegram.filledThisWeek', { n: filledWeek })}` : ''}
          </p>
        ) : (
          <p className="mt-1.5 text-xs text-emerald-900 dark:text-emerald-200">
            {t('telegram.coverageOk')}
            {filledWeek > 0 ? ` · ${t('telegram.filledThisWeek', { n: filledWeek })}` : ''}
          </p>
        )}
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
          {missingCount > 0 && (
            <Link
              to="/members?missing=1"
              className="inline-flex text-xs font-semibold text-amber-800 underline dark:text-amber-200"
            >
              {t('telegram.openMissingDates')}
            </Link>
          )}
          <Link
            to={missingCount > 0 ? '/members?missing=1' : '/members'}
            className="inline-flex text-xs font-semibold text-emerald-900 underline dark:text-emerald-200"
          >
            {t('telegram.openMembers')}
          </Link>
        </div>
      </div>

      <div className="mt-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">
          {t('telegram.nextTitle')}
        </p>
        {upcomingWeek.length === 0 ? (
          <p className="mt-1.5 text-xs text-stone-500 dark:text-stone-400">{t('telegram.nextEmpty')}</p>
        ) : (
          <ul className="mt-1.5 space-y-1 text-sm">
            {upcomingWeek.map((b) => (
              <li key={b.person.id} className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-medium">{fullName(b.person)}</span>
                <span className="text-xs text-stone-500 dark:text-stone-400">
                  {b.isToday
                    ? t('telegram.nextToday')
                    : b.daysUntil === 1
                      ? t('telegram.nextTomorrow')
                      : t('telegram.nextInDays', { n: b.daysUntil })}
                  {` · ${formatMonthDay(b.month, b.day, language)}`}
                  {b.turningAge != null ? ` · ${t('telegram.nextTurns', { age: b.turningAge })}` : ''}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div
        className={`mt-3 rounded-xl border p-3 text-sm ${
          healthWarn
            ? 'border-rose-300 bg-rose-50/80 dark:border-rose-800 dark:bg-rose-950/40'
            : 'border-stone-200 bg-stone-50/80 dark:border-stone-700 dark:bg-stone-900/40'
        }`}
      >
        <p className="flex items-center gap-2 font-semibold">
          <Activity className="h-4 w-4" aria-hidden />
          {t('telegram.healthTitle')}
        </p>
        <p className="mt-1 text-xs leading-relaxed text-stone-600 dark:text-stone-400">
          {settings.last_ok_at
            ? t('telegram.healthLastOk', {
                when: formatRunTime(settings.last_ok_at, language),
                hours: staleHours != null ? Math.floor(staleHours) : '—',
              })
            : t('telegram.healthNever')}
        </p>
        {settings.last_run_ok === false && settings.last_run_error && (
          <p className="mt-1 text-xs text-rose-700 dark:text-rose-300">
            {t('telegram.healthLastError', { error: settings.last_run_error })}
          </p>
        )}
        {healthWarn && (
          <p className="mt-1.5 text-xs font-medium text-rose-800 dark:text-rose-200">
            {t('telegram.healthStale')}
          </p>
        )}
        {runs.length > 0 ? (
          <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto text-xs">
            {runs.map((run) => (
              <li
                key={run.id}
                className="flex flex-wrap items-baseline justify-between gap-2 border-t border-stone-200/80 pt-1 dark:border-stone-700"
              >
                <span className={run.ok ? 'text-emerald-800 dark:text-emerald-200' : 'text-rose-700 dark:text-rose-300'}>
                  {run.ok ? t('telegram.healthOk') : t('telegram.healthFail')}
                  {' · '}
                  {run.trigger}
                </span>
                <span className="text-stone-500">{formatRunTime(run.started_at, language)}</span>
                {run.error && (
                  <span className="w-full truncate text-rose-600 dark:text-rose-300" title={run.error}>
                    {run.error}
                  </span>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-xs text-stone-500">{t('telegram.healthEmpty')}</p>
        )}
      </div>

      <div className="mt-3 space-y-3">
        <ToggleSwitch
          label={t('telegram.enabled')}
          description={t('telegram.enabledDesc')}
          checked={settings.enabled}
          disabled={busy}
          onChange={(enabled) => void patch({ enabled })}
        />

        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-stone-500">
            {t('telegram.botUsername')}
          </span>
          <input
            className="input"
            placeholder="forusbirthdaybot"
            defaultValue={settings.bot_username ?? ''}
            disabled={busy}
            onBlur={(e) => {
              const v = e.target.value.trim().replace(/^@/, '');
              if (v !== (settings.bot_username ?? '')) void patch({ bot_username: v || null });
            }}
          />
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-stone-500">
              {t('telegram.timezone')}
            </span>
            <select
              className="input"
              value={settings.timezone}
              disabled={busy}
              onChange={(e) => void patch({ timezone: e.target.value })}
            >
              {TELEGRAM_TIMEZONES.map((z) => (
                <option key={z.value} value={z.value}>
                  {z.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-stone-500">
              {t('telegram.sendHour')}
            </span>
            <select
              className="input"
              value={settings.send_hour}
              disabled={busy}
              onChange={(e) => void patch({ send_hour: Number(e.target.value) })}
            >
              {Array.from({ length: 24 }, (_, h) => (
                <option key={h} value={h}>
                  {String(h).padStart(2, '0')}:00
                </option>
              ))}
            </select>
          </label>
        </div>

        <p className="text-xs text-stone-500 dark:text-stone-400">
          {settings.group_chat_id
            ? t('telegram.groupLinked', { id: settings.group_chat_id })
            : t('telegram.groupMissing')}
        </p>
        {settings.group_chat_id && (
          <button
            type="button"
            className="btn-secondary !min-h-9 text-xs"
            disabled={busy}
            onClick={() => void patch({ group_chat_id: null })}
          >
            {t('telegram.groupClear')}
          </button>
        )}

        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-stone-500">
            {t('telegram.testPerson')}
          </span>
          <select
            className="input"
            value={testPersonId}
            disabled={busy}
            onChange={(e) => setTestPersonId(e.target.value)}
          >
            {living.map((p) => (
              <option key={p.id} value={p.id}>
                {fullName(p)}
              </option>
            ))}
          </select>
        </label>

        <div className="flex flex-wrap gap-2">
          {openBot && (
            <a
              className="btn-secondary !min-h-10"
              href={openBot}
              target="_blank"
              rel="noreferrer"
            >
              <ExternalLink className="h-4 w-4" aria-hidden /> {t('telegram.openBot')}
            </a>
          )}
          <button
            type="button"
            className="btn-secondary !min-h-10"
            disabled={busy || !settings.group_chat_id || !testPersonId}
            onClick={() => {
              void (async () => {
                setBusy(true);
                try {
                  const result = await runBirthdayTest(testPersonId);
                  if (!result.ok) toast(result.error || t('telegram.testFailed'), 'error');
                  else if (result.skipped) toast(t('telegram.testSkipped', { reason: result.skipped }), 'info');
                  else {
                    const sendError = result.results?.find((row) => row.error)?.error;
                    if (sendError) toast(sendError, 'error');
                    else if ((result.count ?? 0) === 0) {
                      toast(t('telegram.testSkipped', { reason: 'no_match' }), 'info');
                    } else toast(t('telegram.testOk', { n: result.count ?? 0 }), 'success');
                  }
                  await refresh();
                } catch (error) {
                  console.error(error);
                  toast(t('telegram.testFailed'), 'error');
                } finally {
                  setBusy(false);
                }
              })();
            }}
          >
            <Send className="h-4 w-4" aria-hidden /> {t('telegram.testSend')}
          </button>
          <button
            type="button"
            className="btn-secondary !min-h-10"
            disabled={busy}
            onClick={() => {
              void (async () => {
                setBusy(true);
                try {
                  const result = await mintDatesFillLink();
                  if (!result.ok || !result.url) {
                    toast(result.error || t('telegram.datesLinkFailed'), 'error');
                    return;
                  }
                  await navigator.clipboard.writeText(result.url);
                  toast(t('telegram.datesLinkCopied'), 'success');
                } catch (error) {
                  console.error(error);
                  toast(t('telegram.datesLinkFailed'), 'error');
                } finally {
                  setBusy(false);
                }
              })();
            }}
          >
            <Copy className="h-4 w-4" aria-hidden /> {t('telegram.copyDatesLink')}
          </button>
          <button
            type="button"
            className="btn-secondary !min-h-10"
            disabled={busy || !settings.group_chat_id || missingCount === 0}
            onClick={() => {
              void (async () => {
                setBusy(true);
                try {
                  const result = await sendMissingDatesNow();
                  if (!result.ok && !result.sent) {
                    toast(
                      result.error ||
                        (result.skipped
                          ? t('telegram.testSkipped', { reason: result.skipped })
                          : t('telegram.sendDatesFailed')),
                      'error',
                    );
                  } else {
                    toast(t('telegram.sendDatesOk', { n: result.count ?? 0 }), 'success');
                  }
                  await refresh();
                } catch (error) {
                  console.error(error);
                  toast(t('telegram.sendDatesFailed'), 'error');
                } finally {
                  setBusy(false);
                }
              })();
            }}
          >
            <Link2 className="h-4 w-4" aria-hidden /> {t('telegram.sendDatesNow')}
          </button>
          <button
            type="button"
            className="btn-secondary !min-h-10"
            disabled={busy}
            onClick={() => {
              void (async () => {
                setBusy(true);
                try {
                  const result = await previewUpcomingReminder();
                  if (!result.ok || !result.text) {
                    toast(result.error || t('telegram.previewFailed'), 'error');
                    return;
                  }
                  setPreviewText(result.text);
                  setPreviewCaption(result.caption ?? null);
                  setPreviewOpen(true);
                } catch (error) {
                  console.error(error);
                  toast(t('telegram.previewFailed'), 'error');
                } finally {
                  setBusy(false);
                }
              })();
            }}
          >
            <Eye className="h-4 w-4" aria-hidden /> {t('telegram.previewReminder')}
          </button>
          <button
            type="button"
            className="btn-secondary !min-h-10"
            disabled={busy || !settings.group_chat_id}
            onClick={() => {
              void (async () => {
                setBusy(true);
                try {
                  const result = await sendUpcomingReminderNow();
                  if (!result.ok && !result.sent) {
                    toast(
                      result.error ||
                        (result.skipped
                          ? t('telegram.testSkipped', { reason: result.skipped })
                          : t('telegram.sendUpcomingFailed')),
                      'error',
                    );
                  } else {
                    toast(
                      t('telegram.sendUpcomingOk', {
                        n: result.count ?? 0,
                        photo: result.photoSent ? t('telegram.sendUpcomingPhotoYes') : t('telegram.sendUpcomingPhotoNo'),
                      }),
                      'success',
                    );
                  }
                  await refresh();
                } catch (error) {
                  console.error(error);
                  toast(t('telegram.sendUpcomingFailed'), 'error');
                } finally {
                  setBusy(false);
                }
              })();
            }}
          >
            <Send className="h-4 w-4" aria-hidden /> {t('telegram.sendUpcomingNow')}
          </button>
        </div>
        <p className="text-xs leading-relaxed text-stone-500 dark:text-stone-400">
          {t('telegram.datesLinkHint')}
        </p>
      </div>

      {previewOpen && (
        <div
          className="fixed inset-0 z-[80] flex items-end justify-center bg-stone-950/50 p-3 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="tg-preview-title"
          onClick={() => setPreviewOpen(false)}
        >
          <div
            className="max-h-[85dvh] w-full max-w-lg overflow-y-auto rounded-2xl border border-stone-200 bg-white p-4 shadow-xl dark:border-stone-700 dark:bg-stone-900"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="tg-preview-title" className="text-sm font-semibold">
              {t('telegram.previewTitle')}
            </h3>
            <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">{t('telegram.previewIntro')}</p>
            {previewCaption && (
              <div className="mt-3">
                <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-stone-500">
                  {t('telegram.previewCaption')}
                </p>
                <pre className="mt-1 whitespace-pre-wrap rounded-xl border border-stone-200 bg-stone-50 p-3 text-xs leading-relaxed text-stone-800 dark:border-stone-700 dark:bg-stone-950 dark:text-stone-200">
                  {previewCaption}
                </pre>
              </div>
            )}
            <div className="mt-3">
              <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-stone-500">
                {t('telegram.previewList')}
              </p>
              <pre className="mt-1 whitespace-pre-wrap rounded-xl border border-stone-200 bg-stone-50 p-3 text-xs leading-relaxed text-stone-800 dark:border-stone-700 dark:bg-stone-950 dark:text-stone-200">
                {previewText.replace(/<\/?b>/g, '')}
              </pre>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" className="btn-secondary !min-h-10" onClick={() => setPreviewOpen(false)}>
                {t('telegram.previewClose')}
              </button>
              <button
                type="button"
                className="btn-primary !min-h-10"
                disabled={busy || !settings.group_chat_id}
                onClick={() => {
                  void (async () => {
                    setBusy(true);
                    try {
                      const result = await sendUpcomingReminderNow();
                      if (!result.ok && !result.sent) {
                        toast(
                          result.error ||
                            (result.skipped
                              ? t('telegram.testSkipped', { reason: result.skipped })
                              : t('telegram.sendUpcomingFailed')),
                          'error',
                        );
                      } else {
                        toast(
                          t('telegram.sendUpcomingOk', {
                            n: result.count ?? 0,
                            photo: result.photoSent
                              ? t('telegram.sendUpcomingPhotoYes')
                              : t('telegram.sendUpcomingPhotoNo'),
                          }),
                          'success',
                        );
                        setPreviewOpen(false);
                      }
                      await refresh();
                    } catch (error) {
                      console.error(error);
                      toast(t('telegram.sendUpcomingFailed'), 'error');
                    } finally {
                      setBusy(false);
                    }
                  })();
                }}
              >
                <Send className="h-4 w-4" aria-hidden /> {t('telegram.sendUpcomingNow')}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
