import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** False when the env vars are missing — the app then shows setup help. */
export const isSupabaseConfigured = Boolean(url && anonKey);

/**
 * Shared Supabase client (null when unconfigured). The anon key is public by
 * design — name-only visitors use it without a password. RLS allows anon to
 * read/write family editor data; owner JWT is still required for deletes
 * and owner tools. Sessions persist in localStorage for the owner account.
 * Real secrets (service role key) are never used here.
 */
export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url!, anonKey!, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  : null;
