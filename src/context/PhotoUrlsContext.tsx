import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useFamily } from './FamilyContext';
import { isStoragePhoto, resolvePhotoUrls } from '../lib/photoStorage';

/**
 * Resolves every Storage-hosted member photo to a signed URL in ONE batched
 * request per data change, instead of one request per avatar. Data-URL and
 * http photos pass through untouched.
 */
const PhotoUrlsContext = createContext<Record<string, string>>({});

export function PhotoUrlsProvider({ children }: { children: ReactNode }) {
  const { people } = useFamily();
  const [urls, setUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    const paths = people.map((p) => p.photo).filter(isStoragePhoto);
    if (paths.length === 0) return;
    let cancelled = false;
    void resolvePhotoUrls(paths).then((resolved) => {
      if (cancelled || Object.keys(resolved).length === 0) return;
      setUrls((prev) => ({ ...prev, ...resolved }));
    });
    return () => {
      cancelled = true;
    };
  }, [people]);

  return <PhotoUrlsContext.Provider value={urls}>{children}</PhotoUrlsContext.Provider>;
}

/**
 * Displayable URL for a person's photo value: data-URLs and full URLs are
 * returned as-is, Storage paths resolve through the signed-URL map (null
 * until resolved — callers fall back to the initials avatar).
 */
export function usePhotoUrl(photo?: string): string | null {
  const urls = useContext(PhotoUrlsContext);
  if (!photo) return null;
  if (!isStoragePhoto(photo)) return photo;
  return urls[photo] ?? null;
}
