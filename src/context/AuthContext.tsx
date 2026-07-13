import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { ACCESS, hashPassword } from '../config/access';
import type { Role } from '../config/access';
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<Role>('viewer');
  const [ready, setReady] = useState(false);

  // Re-validate the remembered credential; changing a password in access.ts
  // signs everyone with the old password out automatically.
  useEffect(() => {
    const stored = loadJson<string>(AUTH_KEY, (v): v is string => typeof v === 'string');
    if (stored) {
      const restored = roleForHash(stored);
      if (restored === 'viewer') removeKey(AUTH_KEY);
      setRole(restored);
    }
    setReady(true);
  }, []);

  const signIn = useCallback(async (password: string): Promise<Role | null> => {
    const hash = await hashPassword(password);
    const found = roleForHash(hash);
    if (found === 'viewer') return null;
    saveJson(AUTH_KEY, hash);
    setRole(found);
    return found;
  }, []);

  const signOut = useCallback(() => {
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
