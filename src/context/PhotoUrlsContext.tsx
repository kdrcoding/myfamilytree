import { createContext, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useFamily } from './FamilyContext';
import { isStoragePhoto, resolvePhotoUrls } from '../lib/photoStorage';

/**
 * Resolves Storage-hosted photos to signed URLs in batched requests.
 * Member avatars are signed whenever the family list changes; memory photos
 * (and any other late paths) are signed on demand via ensurePhotoUrls.
 */
const PhotoUrlsContext = createContext<{
  urls: Record<string, string>;
  ensurePhotoUrls: (paths: string[]) => void;
}>({ urls: {}, ensurePhotoUrls: () => undefined });

export function PhotoUrlsProvider({ children }: { children: ReactNode }) {
  const { people } = useFamily();
  const [urls, setUrls] = useState<Record<string, string>>({});
  const pendingRef = useRef<Set<string>>(new Set());
  const urlsRef = useRef(urls);
  urlsRef.current = urls;

  const mergeResolved = (resolved: Record<string, string>) => {
    if (Object.keys(resolved).length === 0) return;
    setUrls((prev) => ({ ...prev, ...resolved }));
  };

  const ensurePhotoUrls = (paths: string[]) => {
    const missing = paths.filter(
      (p) => isStoragePhoto(p) && !urlsRef.current[p] && !pendingRef.current.has(p),
    );
    if (missing.length === 0) return;
    for (const p of missing) pendingRef.current.add(p);
    void resolvePhotoUrls(missing).then((resolved) => {
      for (const p of missing) pendingRef.current.delete(p);
      mergeResolved(resolved);
    });
  };

  useEffect(() => {
    const paths = people.map((p) => p.photo).filter(isStoragePhoto);
    if (paths.length === 0) return;
    let cancelled = false;
    void resolvePhotoUrls(paths).then((resolved) => {
      if (cancelled) return;
      mergeResolved(resolved);
    });
    return () => {
      cancelled = true;
    };
  }, [people]);

  return (
    <PhotoUrlsContext.Provider value={{ urls, ensurePhotoUrls }}>{children}</PhotoUrlsContext.Provider>
  );
}

/**
 * Displayable URL for a photo value: data-URLs and full URLs pass through;
 * Storage paths resolve through the signed-URL map (null until ready).
 */
export function usePhotoUrl(photo?: string): string | null {
  const { urls, ensurePhotoUrls } = useContext(PhotoUrlsContext);
  useEffect(() => {
    if (photo && isStoragePhoto(photo) && !urls[photo]) {
      ensurePhotoUrls([photo]);
    }
  }, [photo, urls, ensurePhotoUrls]);

  if (!photo) return null;
  if (!isStoragePhoto(photo)) return photo;
  return urls[photo] ?? null;
}
