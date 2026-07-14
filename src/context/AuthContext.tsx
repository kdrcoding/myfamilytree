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
    if (supabase) {
      // Real authentication: the role comes from the signed-in Supabase
      // account. Sessions persist and refresh automatically; signing out
      // (or the account password changing) locks the site again.
      removeKey(AUTH_KEY); // clean up the legacy hash credential
      void supabase.auth.getSession().then(({ data }) => {
        setRole(roleForEmail(data.session?.user.email));
        setReady(true);
      });
      const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
        setRole(roleForEmail(session?.user.email));
      });
      return () => sub.subscription.unsubscribe();
    }

    // No Supabase configured (local demo mode): fall back to the hash check.
    const stored = loadJson<string>(AUTH_KEY, (v): v is string => typeof v === 'string');
    if (stored) {
      const restored = roleForHash(stored);
      if (restored === 'viewer') removeKey(AUTH_KEY);
      setRole(restored);
    }
    setReady(true);
  }, []);

  const signIn = useCallback(async (password: string): Promise<Role | null> => {
    if (supabase) {
      // One shared password per role: try the owner account first, then the
      // family account. Only these two accounts exist (sign-ups disabled).
      for (const email of [AUTH_EMAILS.owner, AUTH_EMAILS.editor]) {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (!error && data.session) {
          const found = roleForEmail(data.session.user.email);
          setRole(found);
          return found === 'viewer' ? null : found;
        }
      }
      return null;
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
