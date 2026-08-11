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

export type TelegramPersonLink = {
  person_id: string;
  telegram_user_id: number;
  chat_id: number;
  display_name: string | null;
  linked_at: string;
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

export async function fetchTelegramLinks(): Promise<TelegramPersonLink[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from('telegram_person_links').select('*');
  if (error) throw error;
  return (data ?? []) as TelegramPersonLink[];
}

function randomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Create a deep-link token so a relative can /start and link their Telegram. */
export async function createPersonLinkToken(personId: string): Promise<{ token: string; url: string | null }> {
  if (!supabase) throw new Error('Supabase not configured');
  const token = randomToken();
  const { error } = await supabase.from('telegram_link_tokens').insert({
    token,
    person_id: personId,
  });
  if (error) throw error;
  const settings = await fetchTelegramSettings();
  const bot = settings?.bot_username?.replace(/^@/, '');
  const url = bot ? `https://t.me/${bot}?start=link_${token}` : null;
  return { token, url };
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
