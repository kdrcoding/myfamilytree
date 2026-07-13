import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** False when the env vars are missing — the app then shows setup help. */
export const isSupabaseConfigured = Boolean(url && anonKey);

/**
 * Shared Supabase client (null when unconfigured). The anon key is public by
 * design — row access is controlled by the RLS policies in
 * supabase/migrations. Real secrets (service role key) are never used here.
 */
export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url!, anonKey!, { auth: { persistSession: false } })
  : null;
