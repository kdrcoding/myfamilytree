import { useEffect, useRef, useState } from 'react';
import { loadJson, saveJson } from '../utils/storage';

/**
 * Like useState, but hydrated from and persisted to LocalStorage.
 * Corrupted stored values are ignored in favor of the default.
 */
export function usePersistentState<T>(
  key: string,
  defaultValue: T,
  validate?: (value: unknown) => value is T,
): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [state, setState] = useState<T>(() => loadJson<T>(key, validate) ?? defaultValue);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    saveJson(key, state);
  }, [key, state]);

  return [state, setState];
}
