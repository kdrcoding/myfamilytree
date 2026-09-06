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
  /** Name-only entry: editor on this device, no password, no family JWT. */
  enterWithName: (name: string) => boolean;
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
  return 'viewer';
}

function applyOwnerName() {
  saveJson(STORAGE_KEYS.displayName, OWNER_DEFAULT_NAME);
  removeKey(STORAGE_KEYS.namedDevice);
}

function readDisplayName(): string {
  return (
    loadJson<string>(STORAGE_KEYS.displayName, (v): v is string => typeof v === 'string')?.trim() ??
    ''
  );
}

function isNamedDevice(): boolean {
  return loadJson<boolean>(STORAGE_KEYS.namedDevice, (v): v is boolean => typeof v === 'boolean') === true;
}

function restoreNamedEditor(): boolean {
  const name = readDisplayName();
  if (isNamedDevice() && name.length >= 2) return true;
  return false;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<Role>('viewer');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const boot = async () => {
      const stored = loadJson<string>(AUTH_KEY, (v): v is string => typeof v === 'string');
      if (stored && !supabase) {
        const restored = roleForHash(stored);
        if (restored === 'viewer') removeKey(AUTH_KEY);
        else if (restored === 'editor') {
          removeKey(AUTH_KEY);
        } else {
          applyOwnerName();
          setRole('owner');
          setReady(true);
          return;
        }
      } else if (stored && supabase) {
        removeKey(AUTH_KEY);
      }

      // Name-only family users first. Do not auto-enter as owner from a leftover JWT.
      if (restoreNamedEditor()) {
        setRole('editor');
        if (supabase) {
          const { data } = await supabase.auth.getSession();
          if (cancelled) return;
          if (roleForEmail(data.session?.user.email) === 'owner') {
            await supabase.auth.signOut();
            if (cancelled) return;
            setRole('editor');
          }
        }
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
      if (event === 'SIGNED_IN') {
        const fromSession = roleForEmail(session?.user.email);
        if (fromSession === 'owner') {
          applyOwnerName();
          setRole('owner');
        }
        return;
      }
      if (event === 'SIGNED_OUT') {
        setRole(restoreNamedEditor() ? 'editor' : 'viewer');
      }
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (password: string): Promise<Role | null> => {
    const hash = await hashPassword(password);
    // Family members enter with a name, not the shared family password.
    if (hash !== ACCESS.ownerHash) return null;

    if (supabase) {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: AUTH_EMAILS.owner,
        password,
      });
      if (error || !data.session) return null;
      const found = roleForEmail(data.session.user.email);
      if (found !== 'owner') return null;
      applyOwnerName();
      removeKey(AUTH_KEY);
      setRole('owner');
      return 'owner';
    }

    saveJson(AUTH_KEY, hash);
    applyOwnerName();
    setRole('owner');
    return 'owner';
  }, []);

  const enterWithName = useCallback((name: string): boolean => {
    const trimmed = name.trim().slice(0, 40);
    if (trimmed.length < 2) return false;
    saveJson(STORAGE_KEYS.displayName, trimmed);
    saveJson(STORAGE_KEYS.namedDevice, true);
    setRole('editor');
    if (supabase) void supabase.auth.signOut();
    return true;
  }, []);

  const signOut = useCallback(() => {
    if (supabase) void supabase.auth.signOut();
    removeKey(AUTH_KEY);
    removeKey(STORAGE_KEYS.displayName);
    removeKey(STORAGE_KEYS.namedDevice);
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
      enterWithName,
      signOut,
    }),
    [role, ready, signIn, enterWithName, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
