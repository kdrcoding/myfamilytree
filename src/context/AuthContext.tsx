import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { ACCESS, AUTH_EMAILS, OWNER_DEFAULT_NAME, hashPassword } from '../config/access';
import type { Role } from '../config/access';
import {
  clearSoftUnlock,
  hasSoftUnlockGrant,
  softUnlockStillValid,
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
  /** Name-only. Allowed while a live birthday or missing-dates page grant is valid. */
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
  const fromJson = loadJson<string>(
    STORAGE_KEYS.displayName,
    (v): v is string => typeof v === 'string',
  );
  if (fromJson?.trim()) return fromJson.trim();
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.displayName);
    if (!raw) return '';
    const trimmed = raw.trim().replace(/^["']|["']$/g, '');
    if (trimmed.length >= 2 && !trimmed.startsWith('{') && !trimmed.startsWith('[')) {
      return trimmed;
    }
  } catch {
    /* private mode */
  }
  return '';
}

function isFamilyAuthed(): boolean {
  const stored = loadJson<string>(
    STORAGE_KEYS.familyAuthed,
    (v): v is string => typeof v === 'string',
  );
  if (stored === ACCESS.editorHash) return true;
  const legacy = loadJson<string>(AUTH_KEY, (v): v is string => typeof v === 'string');
  return legacy === ACCESS.editorHash;
}

function persistFamilyAuth(name: string) {
  saveJson(STORAGE_KEYS.displayName, name);
  saveJson(STORAGE_KEYS.namedDevice, true);
  saveJson(STORAGE_KEYS.familyAuthed, ACCESS.editorHash);
  saveJson(AUTH_KEY, ACCESS.editorHash);
  if (!isFamilyAuthed()) {
    removeKey(STORAGE_KEYS.familyCache);
    removeKey(STORAGE_KEYS.photoUrls);
    saveJson(STORAGE_KEYS.displayName, name);
    saveJson(STORAGE_KEYS.familyAuthed, ACCESS.editorHash);
    saveJson(AUTH_KEY, ACCESS.editorHash);
  }
}

function restorePasswordEditor(): boolean {
  const name = readDisplayName();
  if (name.length < 2 || !isFamilyAuthed()) return false;
  if (
    loadJson<string>(STORAGE_KEYS.familyAuthed, (v): v is string => typeof v === 'string') !==
    ACCESS.editorHash
  ) {
    saveJson(STORAGE_KEYS.familyAuthed, ACCESS.editorHash);
  }
  return true;
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
  if (hasSoftUnlockGrant() && readDisplayName().length >= 2) {
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

    const adoptOwner = () => {
      applyOwnerName();
      removeKey(AUTH_KEY);
      setRole('owner');
      setReady(true);
    };

    const dropLeftoverOwnerJwt = () => {
      if (supabase) void supabase.auth.signOut();
    };

    const bootAuth = async () => {
      const stored = loadJson<string>(AUTH_KEY, (v): v is string => typeof v === 'string');
      if (stored && !supabase) {
        const restored = roleForHash(stored);
        if (restored === 'viewer' || restored === 'editor') {
          if (restored !== 'editor') removeKey(AUTH_KEY);
        } else {
          applyOwnerName();
          setRole('owner');
          setReady(true);
          return;
        }
      } else if (stored && supabase && roleForHash(stored) === 'owner') {
        // Owner identity is the Supabase JWT, not this leftover hash.
        removeKey(AUTH_KEY);
      }

      if (restorePasswordEditor()) {
        setRole('editor');
        setReady(true);
        if (supabase) {
          const { data } = await supabase.auth.getSession();
          if (cancelled) return;
          if (roleForEmail(data.session?.user.email) === 'owner') {
            dropLeftoverOwnerJwt();
            if (cancelled) return;
            setRole('editor');
          }
        }
        return;
      }

      const name = readDisplayName();
      if (hasSoftUnlockGrant() && name.length >= 2) {
        const stillOpen = await softUnlockStillValid({ keepOnNetworkError: true });
        if (cancelled) return;
        if (stillOpen) {
          setRole('editor');
          setReady(true);
          dropLeftoverOwnerJwt();
          return;
        }
      }

      if (supabase) {
        const { data } = await supabase.auth.getSession();
        if (cancelled) return;
        if (roleForEmail(data.session?.user.email) === 'owner') {
          adoptOwner();
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
      const ownerSession = roleForEmail(session?.user.email) === 'owner';

      if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        if (!ownerSession) return;
        // A remembered family login wins over a leftover owner JWT.
        if (restorePasswordEditor()) {
          dropLeftoverOwnerJwt();
          return;
        }
        adoptOwner();
        return;
      }

      if (event === 'SIGNED_OUT') {
        if (restorePasswordEditor()) {
          setRole('editor');
          return;
        }
        if (hasSoftUnlockGrant() && readDisplayName().length >= 2) {
          setRole((current) => (current === 'owner' ? 'editor' : current));
          return;
        }
        // Do not drop a family/birthday session just because we cleared a
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
      const ok = await softUnlockStillValid({ keepOnNetworkError: true });
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
      clearSoftUnlock();
      setRole('owner');
      return 'owner';
    }

    saveJson(AUTH_KEY, hash);
    applyOwnerName();
    clearSoftUnlock();
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
        const nextRole = await signIn(password);
        return nextRole ? { ok: true, role: nextRole } : { ok: false, reason: 'password' };
      }
      if (hash !== ACCESS.editorHash) return { ok: false, reason: 'password' };

      persistFamilyAuth(trimmed);
      clearSoftUnlock();
      if (supabase) void supabase.auth.signOut();
      setRole('editor');
      return { ok: true, role: 'editor' };
    },
    [signIn],
  );

  const enterWithName = useCallback(async (name: string): Promise<boolean> => {
    const trimmed = name.trim().slice(0, 40);
    if (trimmed.length < 2) return false;
    const stillOpen = await softUnlockStillValid({ keepOnNetworkError: false });
    if (!stillOpen) return false;
    saveJson(STORAGE_KEYS.displayName, trimmed);
    saveJson(STORAGE_KEYS.namedDevice, true);
    removeKey(STORAGE_KEYS.familyAuthed);
    removeKey(AUTH_KEY);
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
    clearSoftUnlock();
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
