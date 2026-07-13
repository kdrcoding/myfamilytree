import { useEffect, useRef, useState } from 'react';
import { loadJson, saveJson } from '../utils/storage';

/**
 * Like useState, but hydrated from and persisted to LocalStorage.
 * Corrupted stored values are ignored in favor of the default.
 *
 * Writes from OTHER tabs of the same app are adopted into local state, so a
 * save in this tab can never silently overwrite an edit made in another tab.
 * `onSaveError` fires when LocalStorage rejects a write (full or blocked),
 * since the app would otherwise keep working in memory and lose the data on
 * the next reload without any warning.
 */
export function usePersistentState<T>(
  key: string,
  defaultValue: T,
  validate?: (value: unknown) => value is T,
  onSaveError?: () => void,
): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [state, setState] = useState<T>(() => loadJson<T>(key, validate) ?? defaultValue);
  const first = useRef(true);
  // Latest callbacks, so effects below never re-run because a caller passed
  // a fresh arrow function on this render.
  const validateRef = useRef(validate);
  const onSaveErrorRef = useRef(onSaveError);
  useEffect(() => {
    validateRef.current = validate;
    onSaveErrorRef.current = onSaveError;
  });

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (!saveJson(key, state)) onSaveErrorRef.current?.();
  }, [key, state]);

  useEffect(() => {
    // The `storage` event only fires in other tabs, never in the one that
    // wrote, so this cannot loop.
    const onStorage = (event: StorageEvent) => {
      if (event.key !== key || event.newValue === null) return;
      const next = loadJson<T>(key, validateRef.current);
      if (next !== null) setState(next);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [key]);

  return [state, setState];
}
