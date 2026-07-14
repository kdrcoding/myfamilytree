import { supabase } from './supabase';
import { loadJson, saveJson } from '../utils/storage';

export interface LatLng {
  lat: number;
  lng: number;
}

/** Place label (lowercased) -> coordinates, or null when lookup found nothing. */
export type GeoCache = Record<string, LatLng | null>;

const LOCAL_KEY = 'familytree.geoCache.v1';
const REMOTE_KEY = 'geoCache';

function isGeoCache(value: unknown): value is GeoCache {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  return Object.values(value).every(
    (v) =>
      v === null ||
      (typeof v === 'object' &&
        v !== null &&
        typeof (v as LatLng).lat === 'number' &&
        typeof (v as LatLng).lng === 'number'),
  );
}

/**
 * Cities are geocoded once and remembered — locally for this browser and in
 * the shared app_settings table so the rest of the family never has to
 * geocode the same city again.
 */
export async function loadGeoCache(): Promise<GeoCache> {
  const local = loadJson<GeoCache>(LOCAL_KEY, isGeoCache) ?? {};
  if (!supabase) return local;
  try {
    const { data } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', REMOTE_KEY)
      .maybeSingle();
    const remote = data?.value;
    if (isGeoCache(remote)) return { ...local, ...remote };
  } catch (error) {
    console.error('Failed to load shared geocode cache:', error);
  }
  return local;
}

export async function saveGeoCache(cache: GeoCache): Promise<void> {
  saveJson(LOCAL_KEY, cache);
  if (!supabase) return;
  try {
    await supabase.from('app_settings').upsert({ key: REMOTE_KEY, value: cache });
  } catch (error) {
    console.error('Failed to save shared geocode cache:', error);
  }
}

/**
 * Look a place up in OpenStreetMap's Nominatim. Callers must throttle to
 * about one request per second (Nominatim usage policy) — the map page
 * geocodes sequentially with a delay.
 */
export async function geocodePlace(label: string): Promise<LatLng | null> {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(label)}`;
  const response = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`Nominatim responded ${response.status}`);
  const results = (await response.json()) as Array<{ lat: string; lon: string }>;
  if (!results.length) return null;
  const lat = Number(results[0].lat);
  const lng = Number(results[0].lon);
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
}
