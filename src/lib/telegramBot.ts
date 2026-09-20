import { supabase } from './supabase';

export type TelegramSettings = {
  id: number;
  group_chat_id: string | null;
  bot_username: string | null;
  timezone: string;
  send_hour: number;
  enabled: boolean;
  updated_at?: string;
  last_run_at?: string | null;
  last_ok_at?: string | null;
  last_run_ok?: boolean | null;
  last_run_error?: string | null;
  last_health_alert_at?: string | null;
};

export type TelegramBotRun = {
  id: number;
  started_at: string;
  finished_at: string | null;
  ok: boolean;
  trigger: string;
  summary: Record<string, unknown>;
  error: string | null;
};

/** Common family timezones for the send-at-local-hour picker. */
export const TELEGRAM_TIMEZONES: { value: string; label: string }[] = [
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'Asia/Tashkent', label: 'Uzbekistan (Tashkent)' },
  { value: 'Asia/Almaty', label: 'Kazakhstan (Almaty)' },
  { value: 'Europe/Moscow', label: 'Moscow' },
  { value: 'Europe/Istanbul', label: 'Istanbul' },
  { value: 'UTC', label: 'UTC' },
];

export async function fetchTelegramSettings(): Promise<TelegramSettings | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.from('telegram_settings').select('*').eq('id', 1).maybeSingle();
  if (error) throw error;
  return data as TelegramSettings | null;
}

/** Timezone only — safe for the family/anon client (no bot chat ids). */
export async function fetchFamilyTimezone(): Promise<string | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.from('family_clock').select('timezone').maybeSingle();
  if (error || !data || typeof (data as { timezone?: unknown }).timezone !== 'string') {
    return null;
  }
  return (data as { timezone: string }).timezone;
}

export async function updateTelegramSettings(
  patch: Partial<{
    enabled: boolean;
    timezone: string;
    send_hour: number;
    bot_username: string | null;
    group_chat_id: string | null;
  }>,
): Promise<TelegramSettings> {
  if (!supabase) throw new Error('Supabase not configured');
  const { data, error } = await supabase
    .from('telegram_settings')
    .update(patch)
    .eq('id', 1)
    .select('*')
    .single();
  if (error) throw error;
  return data as TelegramSettings;
}

export async function runBirthdayTest(testPersonId?: string): Promise<{
  ok: boolean;
  count?: number;
  error?: string;
  skipped?: string;
  results?: { personId: string; group: boolean; error?: string; skipped?: string }[];
}> {
  if (!supabase) throw new Error('Supabase not configured');
  const { data, error } = await supabase.functions.invoke('birthday-telegram', {
    body: { force: true, testPersonId: testPersonId || undefined, skipDedupe: true },
  });
  if (error) throw error;
  return data as {
    ok: boolean;
    count?: number;
    error?: string;
    skipped?: string;
    results?: { personId: string; group: boolean; error?: string; skipped?: string }[];
  };
}

/** Owner: mint a fresh signed /dates?k= link (valid ~7 days). */
export async function mintDatesFillLink(): Promise<{
  ok: boolean;
  url?: string;
  expiresAt?: number;
  error?: string;
}> {
  if (!supabase) throw new Error('Supabase not configured');
  const { data, error } = await supabase.functions.invoke('birthday-telegram', {
    body: { action: 'mintDatesLink' },
  });
  if (error) throw error;
  return data as { ok: boolean; url?: string; expiresAt?: number; error?: string };
}

/** Owner: post a missing-dates reminder to the group with a fresh signed link. */
export async function sendMissingDatesNow(): Promise<{
  ok: boolean;
  sent?: boolean;
  count?: number;
  url?: string;
  skipped?: string;
  error?: string;
}> {
  if (!supabase) throw new Error('Supabase not configured');
  const { data, error } = await supabase.functions.invoke('birthday-telegram', {
    body: { action: 'sendMissingDates' },
  });
  if (error) throw error;
  return data as {
    ok: boolean;
    sent?: boolean;
    count?: number;
    url?: string;
    skipped?: string;
    error?: string;
  };
}

export function botOpenUrl(botUsername: string | null | undefined): string | null {
  const bot = botUsername?.replace(/^@/, '');
  return bot ? `https://t.me/${bot}` : null;
}

/** Owner-only via RLS — recent cron / test runs for the Settings health log. */
export async function fetchTelegramBotRuns(limit = 12): Promise<TelegramBotRun[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('telegram_bot_runs')
    .select('id,started_at,finished_at,ok,trigger,summary,error')
    .order('started_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as TelegramBotRun[];
}
