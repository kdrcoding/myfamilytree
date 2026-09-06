import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { ACCESS, AUTH_EMAILS, OWNER_DEFAULT_NAME, hashPassword } from '../config/access';
import type { Role } from '../config/access';
import {
  birthdayPassStillValid,
  clearBirthdayPass,
  readBirthdayPass,
} from '../lib/birthdayPass';
import { supabase } from '../lib/supabase';
import { loadJson, saveJson, removeKey, STORAGE_KEYS } from '../utils/storage';

const AUTH_KEY = STORAGE_KEYS.auth;

export type FamilyEnterResult =
  | { ok: true; role: Role }
  | { ok: false; reason: 'name' | 'password' };

interface AuthContextValue {
  role: Role;
  /** True while the stored credential is being re-checked on startup. */
  ready: boolean;
  canEdit: boolean;
  canDelete: boolean;
  signIn: (password: string) => Promise<Role | null>;
  /** Name + family (or owner) password. Used on the main site. */
  enterAsFamily: (name: string, password: string) => Promise<FamilyEnterResult>;
  /** Name-only. Allowed only while a live birthday page grant is still valid. */
  enterWithName: (name: string) => Promise<boolean>;
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
  removeKey(STORAGE_KEYS.familyAuthed);
}

function readDisplayName(): string {
  return (
    loadJson<string>(STORAGE_KEYS.displayName, (v): v is string => typeof v === 'string')?.trim() ??
    ''
  );
}

function isFamilyAuthed(): boolean {
  const stored = loadJson<string>(
    STORAGE_KEYS.familyAuthed,
    (v): v is string => typeof v === 'string',
  );
  return stored === ACCESS.editorHash;
}

function markFamilyAuthed() {
  saveJson(STORAGE_KEYS.familyAuthed, ACCESS.editorHash);
}

function restorePasswordEditor(): boolean {
  const name = readDisplayName();
  return isFamilyAuthed() && name.length >= 2;
}

function hasOwnerSessionHint(): boolean {
  try {
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (key && key.startsWith('sb-') && key.includes('-auth-token')) return true;
    }
  } catch {
    /* private mode */
  }
  return false;
}

function initialAuthState(): { role: Role; ready: boolean } {
  const stored = loadJson<string>(AUTH_KEY, (v): v is string => typeof v === 'string');
  if (stored && !supabase && roleForHash(stored) === 'owner') {
    applyOwnerName();
    return { role: 'owner', ready: true };
  }
  if (restorePasswordEditor()) return { role: 'editor', ready: true };
  if (readBirthdayPass() && readDisplayName().length >= 2) {
    return { role: 'viewer', ready: false };
  }
  if (hasOwnerSessionHint()) return { role: 'viewer', ready: false };
  return { role: 'viewer', ready: true };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [boot] = useState(initialAuthState);
  const [role, setRole] = useState<Role>(boot.role);
  const [ready, setReady] = useState(boot.ready);

  useEffect(() => {
    let cancelled = false;

    const bootAuth = async () => {
      const stored = loadJson<string>(AUTH_KEY, (v): v is string => typeof v === 'string');
      if (stored && !supabase) {
        const restored = roleForHash(stored);
        if (restored === 'viewer' || restored === 'editor') {
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

      if (restorePasswordEditor()) {
        setRole('editor');
        setReady(true);
        if (supabase) {
          const { data } = await supabase.auth.getSession();
          if (cancelled) return;
          if (roleForEmail(data.session?.user.email) === 'owner') {
            await supabase.auth.signOut();
            if (cancelled) return;
            setRole('editor');
          }
        }
        return;
      }

      const name = readDisplayName();
      if (readBirthdayPass() && name.length >= 2) {
        const stillOpen = await birthdayPassStillValid({ keepOnNetworkError: false });
        if (cancelled) return;
        if (stillOpen) {
          setRole('editor');
          setReady(true);
          if (supabase) void supabase.auth.signOut();
          return;
        }
      }

      if (!cancelled) setReady(true);
    };

    void bootAuth();

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
        if (restorePasswordEditor()) {
          setRole('editor');
          return;
        }
        // Do not drop a family/birthday session just because we cleared an
        // leftover owner JWT.
        setRole((current) => (current === 'owner' ? 'viewer' : current));
      }
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (role !== 'editor' || isFamilyAuthed()) return;

    let cancelled = false;
    const recheck = async () => {
      const ok = await birthdayPassStillValid({ keepOnNetworkError: true });
      if (cancelled) return;
      if (!ok) setRole('viewer');
    };

    const timer = window.setInterval(() => void recheck(), 60_000);
    const onVis = () => {
      if (document.visibilityState === 'visible') void recheck();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [role]);

  const signIn = useCallback(async (password: string): Promise<Role | null> => {
    const hash = await hashPassword(password);
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
      clearBirthdayPass();
      setRole('owner');
      return 'owner';
    }

    saveJson(AUTH_KEY, hash);
    applyOwnerName();
    clearBirthdayPass();
    setRole('owner');
    return 'owner';
  }, []);

  const enterAsFamily = useCallback(
    async (name: string, password: string): Promise<FamilyEnterResult> => {
      const trimmed = name.trim().slice(0, 40);
      if (trimmed.length < 2) return { ok: false, reason: 'name' };
      if (!password) return { ok: false, reason: 'password' };

      const hash = await hashPassword(password);
      if (hash === ACCESS.ownerHash) {
        const role = await signIn(password);
        return role ? { ok: true, role } : { ok: false, reason: 'password' };
      }
      if (hash !== ACCESS.editorHash) return { ok: false, reason: 'password' };

      saveJson(STORAGE_KEYS.displayName, trimmed);
      saveJson(STORAGE_KEYS.namedDevice, true);
      markFamilyAuthed();
      clearBirthdayPass();
      if (supabase) void supabase.auth.signOut();
      setRole('editor');
      return { ok: true, role: 'editor' };
    },
    [signIn],
  );

  const enterWithName = useCallback(async (name: string): Promise<boolean> => {
    const trimmed = name.trim().slice(0, 40);
    if (trimmed.length < 2) return false;
    const stillOpen = await birthdayPassStillValid({ keepOnNetworkError: false });
    if (!stillOpen) return false;
    saveJson(STORAGE_KEYS.displayName, trimmed);
    saveJson(STORAGE_KEYS.namedDevice, true);
    removeKey(STORAGE_KEYS.familyAuthed);
    setRole('editor');
    if (supabase) void supabase.auth.signOut();
    return true;
  }, []);

  const signOut = useCallback(() => {
    if (supabase) void supabase.auth.signOut();
    removeKey(AUTH_KEY);
    removeKey(STORAGE_KEYS.displayName);
    removeKey(STORAGE_KEYS.namedDevice);
    removeKey(STORAGE_KEYS.familyAuthed);
    removeKey(STORAGE_KEYS.skipOwnerAuto);
    clearBirthdayPass();
    setRole('viewer');
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      role,
      ready,
      canEdit: role === 'editor' || role === 'owner',
      canDelete: role === 'owner',
      signIn,
      enterAsFamily,
      enterWithName,
      signOut,
    }),
    [role, ready, signIn, enterAsFamily, enterWithName, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
