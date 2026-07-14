import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { ACCESS, AUTH_EMAILS, hashPassword } from '../config/access';
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<Role>('viewer');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Restore the remembered credential: a legacy hash always restores
    // (harmless when the database is locked down — data access still needs
    // a real session), and a Supabase session upgrades/overrides it.
    const stored = loadJson<string>(AUTH_KEY, (v): v is string => typeof v === 'string');
    if (stored) {
      const restored = roleForHash(stored);
      if (restored === 'viewer') removeKey(AUTH_KEY);
      else setRole(restored);
    }
    if (!supabase) {
      setReady(true);
      return;
    }
    void supabase.auth.getSession().then(({ data }) => {
      const fromSession = roleForEmail(data.session?.user.email);
      if (fromSession !== 'viewer') setRole(fromSession);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      const fromSession = roleForEmail(session?.user.email);
      if (fromSession !== 'viewer') {
        setRole(fromSession);
      } else if (event === 'SIGNED_OUT') {
        // Sign-out in another tab (or a dead session) locks this tab too,
        // unless a legacy hash credential is still valid.
        const hash = loadJson<string>(AUTH_KEY, (v): v is string => typeof v === 'string');
        setRole(hash ? roleForHash(hash) : 'viewer');
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const signIn = useCallback(async (password: string): Promise<Role | null> => {
    if (supabase) {
      // Real authentication first: one shared password per role, so try the
      // owner account, then the family account (sign-ups are disabled).
      for (const email of [AUTH_EMAILS.owner, AUTH_EMAILS.editor]) {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (!error && data.session) {
          const found = roleForEmail(data.session.user.email);
          if (found !== 'viewer') {
            setRole(found);
            return found;
          }
        }
      }
      // The auth accounts may not exist yet (one-time dashboard setup not
      // done). Fall back to the built-in hash check so the site keeps
      // working until then; real auth takes over once the accounts exist.
    }
    const hash = await hashPassword(password);
    const found = roleForHash(hash);
    if (found === 'viewer') return null;
    saveJson(AUTH_KEY, hash);
    setRole(found);
    return found;
  }, []);

  const signOut = useCallback(() => {
    if (supabase) void supabase.auth.signOut();
    removeKey(AUTH_KEY);
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
