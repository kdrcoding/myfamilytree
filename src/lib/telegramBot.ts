import { supabase } from './supabase';

export type TelegramSettings = {
  id: number;
  group_chat_id: string | null;
  bot_username: string | null;
  timezone: string;
  send_hour: number;
  enabled: boolean;
  updated_at?: string;
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
}> {
  if (!supabase) throw new Error('Supabase not configured');
  const { data, error } = await supabase.functions.invoke('birthday-telegram', {
    body: { force: true, testPersonId: testPersonId || undefined, skipDedupe: true },
  });
  if (error) throw error;
  return data as { ok: boolean; count?: number; error?: string; skipped?: string };
}

export function botOpenUrl(botUsername: string | null | undefined): string | null {
  const bot = botUsername?.replace(/^@/, '');
  return bot ? `https://t.me/${bot}` : null;
}
