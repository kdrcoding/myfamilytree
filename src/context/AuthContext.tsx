import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { ACCESS, AUTH_EMAILS, OWNER_DEFAULT_NAME, hashPassword } from '../config/access';
import type { Role } from '../config/access';
import {
  clearSoftUnlock,
  hasSoftUnlockGrant,
  readSoftUnlockKind,
  resolveSoftUnlockKind,
  setSoftUnlockKind,
  type SoftUnlockKind,
} from '../lib/birthdayPass';
import { supabase } from '../lib/supabase';
import { loadJson, saveJson, removeKey, STORAGE_KEYS } from '../utils/storage';

const AUTH_KEY = STORAGE_KEYS.auth;

export type FamilyEnterResult =
  | { ok: true; role: Role }
  | { ok: false; reason: 'name' | 'password' | 'use_owner' };

/** What the current session may change on person records. */
export type EditScope = 'full' | 'birthDate' | 'none';

interface AuthContextValue {
  role: Role;
  /** True while the stored credential is being re-checked on startup. */
  ready: boolean;
  /**
   * Can open edit UI. Soft birthday unlock is view-only; soft dates unlock
   * may edit birth dates only (see editScope).
   */
  canEdit: boolean;
  editScope: EditScope;
  softUnlock: SoftUnlockKind | null;
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
  if (email === AUTH_EMAILS.editor) return 'editor';
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

function deriveEditAccess(
  role: Role,
  soft: SoftUnlockKind | null,
): { canEdit: boolean; editScope: EditScope } {
  if (role === 'owner') return { canEdit: true, editScope: 'full' };
  if (role !== 'editor') return { canEdit: false, editScope: 'none' };
  if (isFamilyAuthed()) return { canEdit: true, editScope: 'full' };
  if (soft === 'dates') return { canEdit: true, editScope: 'birthDate' };
  // Soft birthday unlock: browse the tree, no writes.
  return { canEdit: false, editScope: 'none' };
}

function initialAuthState(): { role: Role; ready: boolean; softUnlock: SoftUnlockKind | null } {
  const stored = loadJson<string>(AUTH_KEY, (v): v is string => typeof v === 'string');
  if (stored && !supabase && roleForHash(stored) === 'owner') {
    applyOwnerName();
    return { role: 'owner', ready: true, softUnlock: null };
  }
  // With Supabase, family editors need a live family@ JWT — do not unlock from
  // stale localStorage alone (AppLockGate would skip the password screen).
  if (restorePasswordEditor()) {
    if (!supabase) return { role: 'editor', ready: true, softUnlock: null };
    return { role: 'viewer', ready: false, softUnlock: null };
  }
  if (hasSoftUnlockGrant() && readDisplayName().length >= 2) {
    return { role: 'viewer', ready: false, softUnlock: readSoftUnlockKind() };
  }
  if (hasOwnerSessionHint()) return { role: 'viewer', ready: false, softUnlock: null };
  return { role: 'viewer', ready: true, softUnlock: null };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [boot] = useState(initialAuthState);
  const [role, setRole] = useState<Role>(boot.role);
  const [ready, setReady] = useState(boot.ready);
  const [softUnlock, setSoftUnlock] = useState<SoftUnlockKind | null>(boot.softUnlock);

  useEffect(() => {
    let cancelled = false;

    const adoptOwner = () => {
      applyOwnerName();
      removeKey(AUTH_KEY);
      clearSoftUnlock();
      setSoftUnlock(null);
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
          setSoftUnlock(null);
          setRole('owner');
          setReady(true);
          return;
        }
      } else if (stored && supabase && roleForHash(stored) === 'owner') {
        removeKey(AUTH_KEY);
      }

      if (supabase) {
        const { data } = await supabase.auth.getSession();
        if (cancelled) return;
        const sessionRole = roleForEmail(data.session?.user.email);
        if (sessionRole === 'owner') {
          adoptOwner();
          return;
        }
        if (sessionRole === 'editor') {
          const name = readDisplayName();
          persistFamilyAuth(name.length >= 2 ? name : 'Family');
          clearSoftUnlock();
          setSoftUnlock(null);
          setRole('editor');
          setReady(true);
          return;
        }
      }

      // Local family flag without a family JWT can no longer do full edits
      // (anon is birth_date-only). Force a fresh password login.
      if (restorePasswordEditor()) {
        if (supabase) {
          removeKey(STORAGE_KEYS.familyAuthed);
          removeKey(AUTH_KEY);
        } else {
          setSoftUnlock(null);
          setSoftUnlockKind(null);
          setRole('editor');
          setReady(true);
          return;
        }
      }

      const name = readDisplayName();
      if (hasSoftUnlockGrant() && name.length >= 2) {
        const kind = await resolveSoftUnlockKind();
        if (cancelled) return;
        if (kind) {
          setSoftUnlockKind(kind);
          setSoftUnlock(kind);
          setRole('editor');
          setReady(true);
          dropLeftoverOwnerJwt();
          return;
        }
        setSoftUnlock(null);
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
      const sessionRole = roleForEmail(session?.user.email);

      if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        if (sessionRole === 'owner') {
          if (restorePasswordEditor()) {
            dropLeftoverOwnerJwt();
            return;
          }
          adoptOwner();
          return;
        }
        if (sessionRole === 'editor') {
          const name = readDisplayName();
          persistFamilyAuth(name.length >= 2 ? name : 'Family');
          clearSoftUnlock();
          setSoftUnlock(null);
          setRole('editor');
          return;
        }
        return;
      }

      if (event === 'SIGNED_OUT') {
        if (hasSoftUnlockGrant() && readDisplayName().length >= 2) {
          setRole((current) => (current === 'owner' ? 'editor' : current));
          return;
        }
        setRole((current) =>
          current === 'owner' || current === 'editor' ? 'viewer' : current,
        );
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
      const kind = await resolveSoftUnlockKind();
      if (cancelled) return;
      if (!kind) {
        setSoftUnlock(null);
        setRole('viewer');
        return;
      }
      setSoftUnlockKind(kind);
      setSoftUnlock(kind);
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
      setSoftUnlock(null);
      setRole('owner');
      return 'owner';
    }

    saveJson(AUTH_KEY, hash);
    applyOwnerName();
    clearSoftUnlock();
    setSoftUnlock(null);
    setRole('owner');
    return 'owner';
  }, []);

  const enterAsFamily = useCallback(
    async (name: string, password: string): Promise<FamilyEnterResult> => {
      const trimmed = name.trim().slice(0, 40);
      if (trimmed.length < 2) return { ok: false, reason: 'name' };
      if (!password) return { ok: false, reason: 'password' };

      const hash = await hashPassword(password);
      // Owner password must never unlock via the family form — use owner login.
      if (hash === ACCESS.ownerHash) return { ok: false, reason: 'use_owner' };
      if (hash !== ACCESS.editorHash) return { ok: false, reason: 'password' };

      // Full family edits require the family@ JWT (anon is birth_date-only).
      if (supabase) {
        const base = import.meta.env.VITE_SUPABASE_URL as string | undefined;
        const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
        if (!base || !anon) return { ok: false, reason: 'password' };

        const sessionRes = await fetch(`${base}/functions/v1/family-session`, {
          method: 'POST',
          headers: {
            apikey: anon,
            Authorization: `Bearer ${anon}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ password }),
        });
        const sessionJson = (await sessionRes.json().catch(() => ({}))) as {
          ok?: boolean;
          token_hash?: string;
          error?: string;
        };
        if (!sessionRes.ok || !sessionJson.ok || !sessionJson.token_hash) {
          console.error('family-session failed', sessionJson);
          return { ok: false, reason: 'password' };
        }
        const { error } = await supabase.auth.verifyOtp({
          token_hash: sessionJson.token_hash,
          type: 'email',
        });
        if (error) {
          console.error('family verifyOtp failed', error);
          return { ok: false, reason: 'password' };
        }
      }

      persistFamilyAuth(trimmed);
      clearSoftUnlock();
      setSoftUnlock(null);
      setRole('editor');
      return { ok: true, role: 'editor' };
    },
    [],
  );

  const enterWithName = useCallback(async (name: string): Promise<boolean> => {
    const trimmed = name.trim().slice(0, 40);
    if (trimmed.length < 2) return false;
    const kind = await resolveSoftUnlockKind();
    if (!kind) return false;
    saveJson(STORAGE_KEYS.displayName, trimmed);
    saveJson(STORAGE_KEYS.namedDevice, true);
    removeKey(STORAGE_KEYS.familyAuthed);
    removeKey(AUTH_KEY);
    setSoftUnlockKind(kind);
    setSoftUnlock(kind);
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
    setSoftUnlock(null);
    setRole('viewer');
  }, []);

  const { canEdit, editScope } = deriveEditAccess(role, softUnlock);

  const value = useMemo<AuthContextValue>(
    () => ({
      role,
      ready,
      canEdit,
      editScope,
      softUnlock,
      canDelete: role === 'owner',
      signIn,
      enterAsFamily,
      enterWithName,
      signOut,
    }),
    [role, ready, canEdit, editScope, softUnlock, signIn, enterAsFamily, enterWithName, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
