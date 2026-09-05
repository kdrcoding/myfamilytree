import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { ACCESS, AUTH_EMAILS, OWNER_DEFAULT_NAME, hashPassword } from '../config/access';
import type { Role } from '../config/access';
import { supabase } from '../lib/supabase';
import { loadJson, saveJson, removeKey, STORAGE_KEYS } from '../utils/storage';

const AUTH_KEY = STORAGE_KEYS.auth;

interface AuthContextValue {
  role: Role;
  /** True while the stored credential is being re-checked on startup. */
  ready: boolean;
  canEdit: boolean;
  canDelete: boolean;
  signIn: (password: string) => Promise<Role | null>;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function roleForHash(hash: string): Role {
  if (hash === ACCESS.ownerHash) return 'owner';
  if (hash === ACCESS.editorHash) return 'editor';
  return 'viewer';
}

function roleForEmail(email: string | undefined): Role {
  if (email === AUTH_EMAILS.owner) return 'owner';
  if (email === AUTH_EMAILS.editor) return 'editor';
  return 'viewer';
}

function applyOwnerName() {
  saveJson(STORAGE_KEYS.displayName, OWNER_DEFAULT_NAME);
}

/** Restore a family editor's name from Auth metadata when this browser has none yet. */
function applyEditorNameFromUser(user?: { user_metadata?: Record<string, unknown> } | null) {
  const existing =
    loadJson<string>(STORAGE_KEYS.displayName, (v): v is string => typeof v === 'string')?.trim() ??
    '';
  if (existing.length >= 2) return;
  const meta = user?.user_metadata?.display_name;
  if (typeof meta === 'string' && meta.trim().length >= 2) {
    saveJson(STORAGE_KEYS.displayName, meta.trim());
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<Role>('viewer');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const boot = async () => {
      // Prefer a live Supabase session (real JWT + RLS). Legacy hash is only
      // a UI hint when Supabase Auth is unavailable.
      if (supabase) {
        const { data } = await supabase.auth.getSession();
        if (cancelled) return;
        const fromSession = roleForEmail(data.session?.user.email);
        if (fromSession !== 'viewer') {
          if (fromSession === 'owner') applyOwnerName();
          else applyEditorNameFromUser(data.session?.user);
          setRole(fromSession);
          setReady(true);
          return;
        }
      }

      const stored = loadJson<string>(AUTH_KEY, (v): v is string => typeof v === 'string');
      if (stored && !supabase) {
        const restored = roleForHash(stored);
        if (restored === 'viewer') removeKey(AUTH_KEY);
        else {
          if (restored === 'owner') applyOwnerName();
          setRole(restored);
        }
      } else if (stored && supabase) {
        // Stale hash without a JWT — do not elevate UI privileges.
        removeKey(AUTH_KEY);
      }

      if (!cancelled) setReady(true);
    };

    void boot();

    if (!supabase) {
      return () => {
        cancelled = true;
      };
    }

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      const fromSession = roleForEmail(session?.user.email);
      if (fromSession !== 'viewer') {
        if (fromSession === 'owner') applyOwnerName();
        else applyEditorNameFromUser(session?.user);
        setRole(fromSession);
      } else if (event === 'SIGNED_OUT') {
        setRole('viewer');
      }
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (password: string): Promise<Role | null> => {
    const hash = await hashPassword(password);
    const hinted = roleForHash(hash);

    if (supabase) {
      // Hash picks owner vs family so we only hit Auth once (wrong password
      // fails immediately; right password does not try the other account).
      if (hinted === 'viewer') return null;
      const email = hinted === 'owner' ? AUTH_EMAILS.owner : AUTH_EMAILS.editor;
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error || !data.session) return null;
      const found = roleForEmail(data.session.user.email);
      if (found === 'viewer') return null;
      if (found === 'owner') applyOwnerName();
      else applyEditorNameFromUser(data.session.user);
      removeKey(AUTH_KEY);
      setRole(found);
      return found;
    }

    if (hinted === 'viewer') return null;
    saveJson(AUTH_KEY, hash);
    if (hinted === 'owner') applyOwnerName();
    setRole(hinted);
    return hinted;
  }, []);

  const signOut = useCallback(() => {
    if (supabase) void supabase.auth.signOut();
    removeKey(AUTH_KEY);
    removeKey(STORAGE_KEYS.displayName);
    removeKey(STORAGE_KEYS.skipOwnerAuto);
    setRole('viewer');
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      role,
      ready,
      canEdit: role === 'editor' || role === 'owner',
      canDelete: role === 'owner',
      signIn,
      signOut,
    }),
    [role, ready, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
