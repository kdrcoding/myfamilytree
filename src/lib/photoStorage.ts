import { supabase } from './supabase';
import { loadJson, saveJson, STORAGE_KEYS } from '../utils/storage';

/**
 * Member photos live in the private `family-photos` Storage bucket; the
 * `photo` column stores just the object path (e.g. "people/abc-x1.jpg").
 * Older records may still hold a base64 data-URL — both forms render, and
 * the owner can migrate old rows from Settings.
 *
 * The bucket is private, so images are fetched through signed URLs. URLs are
 * cached in localStorage until shortly before they expire, which keeps the
 * exact same URL across visits within a day — so the browser's HTTP cache
 * works and photos aren't re-downloaded every load.
 */
const BUCKET = 'family-photos';
const SIGN_TTL_SECONDS = 26 * 60 * 60;
const REFRESH_MARGIN_MS = 2 * 60 * 60 * 1000;

/** True when the photo value is a Storage object path (not data:/http). */
export function isStoragePhoto(photo?: string): photo is string {
  return Boolean(photo && !photo.startsWith('data:') && !/^https?:/i.test(photo));
}

type UrlCache = Record<string, { url: string; exp: number }>;

function isUrlCache(value: unknown): value is UrlCache {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Resolve Storage paths to displayable signed URLs, reusing cached ones.
 * Unresolvable paths are simply absent from the result (initials fallback).
 */
export async function resolvePhotoUrls(paths: string[]): Promise<Record<string, string>> {
  const client = supabase;
  const unique = [...new Set(paths.filter(isStoragePhoto))];
  if (!client || unique.length === 0) return {};

  const cache = loadJson<UrlCache>(STORAGE_KEYS.photoUrls, isUrlCache) ?? {};
  const now = Date.now();
  const result: Record<string, string> = {};
  const missing: string[] = [];
  for (const path of unique) {
    const hit = cache[path];
    if (hit && typeof hit.url === 'string' && hit.exp - now > REFRESH_MARGIN_MS) {
      result[path] = hit.url;
    } else {
      missing.push(path);
    }
  }

  if (missing.length > 0) {
    const { data, error } = await client.storage
      .from(BUCKET)
      .createSignedUrls(missing, SIGN_TTL_SECONDS);
    if (error) {
      // Bucket not created yet (upgrade SQL not run) or offline — the
      // initials fallback covers it.
      console.error('Could not sign photo URLs:', error);
    } else {
      for (const item of data ?? []) {
        if (item.path && item.signedUrl && !item.error) {
          result[item.path] = item.signedUrl;
          cache[item.path] = { url: item.signedUrl, exp: now + SIGN_TTL_SECONDS * 1000 };
        }
      }
      // Drop expired entries so the cache doesn't grow forever.
      for (const [path, entry] of Object.entries(cache)) {
        if (entry.exp < now) delete cache[path];
      }
      saveJson(STORAGE_KEYS.photoUrls, cache);
    }
  }
  return result;
}

/** Upload a photo (data-URL) for a person; returns the Storage path. */
export async function uploadPhoto(personId: string, dataUrl: string): Promise<string> {
  const client = supabase;
  if (!client) throw new Error('Supabase is not configured');
  const blob = await (await fetch(dataUrl)).blob();
  const token = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  const path = `people/${personId}-${token}.jpg`;
  const { error } = await client.storage.from(BUCKET).upload(path, blob, {
    contentType: blob.type || 'image/jpeg',
  });
  if (error) throw error;
  return path;
}

/** Best-effort removal of a replaced/deleted photo object. */
export function deletePhoto(path: string | undefined): void {
  if (!supabase || !isStoragePhoto(path)) return;
  void supabase.storage
    .from(BUCKET)
    .remove([path])
    .then(({ error }) => {
      if (error) console.error('Could not delete the old photo object:', error);
    });
}
