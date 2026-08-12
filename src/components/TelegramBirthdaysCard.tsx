import { useEffect, useState } from 'react';
import { ExternalLink, Send, MessageCircle } from 'lucide-react';
import { useFamily } from '../context/FamilyContext';
import { useToast } from '../context/ToastContext';
import { useT } from '../i18n/useT';
import { fullName } from '../utils/family';
import { ToggleSwitch } from './ui/ToggleSwitch';
import {
  TELEGRAM_TIMEZONES,
  botOpenUrl,
  fetchTelegramSettings,
  runBirthdayTest,
  updateTelegramSettings,
  type TelegramSettings,
} from '../lib/telegramBot';

/**
 * Owner-only: wire the Telegram birthday bot (group posts only).
 */
export function TelegramBirthdaysCard() {
  const t = useT();
  const { toast } = useToast();
  const { people } = useFamily();
  const [settings, setSettings] = useState<TelegramSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [testPersonId, setTestPersonId] = useState('');
  const [unavailable, setUnavailable] = useState(false);

  const refresh = async () => {
    setLoading(true);
    try {
      const s = await fetchTelegramSettings();
      setSettings(s);
      setUnavailable(!s);
      if (s && !testPersonId && people[0]) setTestPersonId(people[0].id);
    } catch (error) {
      console.error(error);
      setUnavailable(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const living = people
    .filter((p) => !p.isDeceased && !p.deathDate)
    .slice()
    .sort((a, b) => fullName(a).localeCompare(fullName(b)));

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
                  else if ((result.count ?? 0) === 0) toast(t('telegram.testSkipped', { reason: 'no_match' }), 'info');
                  else toast(t('telegram.testOk', { n: result.count ?? 0 }), 'success');
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
        </div>
      </div>
    </section>
  );
}
