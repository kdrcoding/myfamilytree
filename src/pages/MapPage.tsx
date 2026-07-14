import { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Loader2, MapPin } from 'lucide-react';
import type { FamilyPerson } from '../types/family';
import { useFamily } from '../context/FamilyContext';
import { usePrivacy } from '../hooks/usePrivacy';
import { useT } from '../i18n/useT';
import { fullName } from '../utils/family';
import { normalizeCountry } from '../utils/countries';
import { geocodePlace, loadGeoCache, saveGeoCache } from '../lib/geocode';
import type { GeoCache } from '../lib/geocode';

interface Place {
  key: string;
  label: string;
  people: FamilyPerson[];
}

/** Nominatim asks for at most ~1 request/second. */
const GEOCODE_DELAY_MS = 1100;

export function MapPage() {
  const { people } = useFamily();
  const privacy = usePrivacy();
  const t = useT();
  const mapEl = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);
  const [cache, setCache] = useState<GeoCache | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  // Fit the viewport to the markers once — later cache updates and language
  // switches must not yank the map away from where the user panned.
  const fittedRef = useRef(false);

  const showCity = privacy.showCity();
  const places = useMemo(() => {
    const byKey = new Map<string, Place>();
    for (const person of people) {
      // With cities hidden by privacy mode, group people by country only.
      // Normalize the country so spelling variants geocode to one marker.
      const city = showCity ? person.city?.trim() : undefined;
      const country = normalizeCountry(person.country);
      const label = [city, country].filter(Boolean).join(', ');
      if (!label) continue;
      const key = label.toLowerCase();
      const place = byKey.get(key) ?? { key, label, people: [] };
      place.people.push(person);
      byKey.set(key, place);
    }
    return [...byKey.values()].sort((a, b) => b.people.length - a.people.length);
  }, [people, showCity]);

  // Load the shared cache once, then geocode whatever is still unknown,
  // one place per second (Nominatim's usage policy).
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const loaded = await loadGeoCache();
      if (cancelled) return;
      setCache(loaded);

      const missing = places.filter((p) => !(p.key in loaded));
      if (missing.length === 0) return;
      setProgress({ done: 0, total: missing.length });
      const updated: GeoCache = { ...loaded };
      for (let i = 0; i < missing.length; i++) {
        try {
          updated[missing[i].key] = await geocodePlace(missing[i].label);
        } catch (error) {
          console.error(`Geocoding "${missing[i].label}" failed:`, error);
          break; // network trouble — try again on the next visit
        }
        if (cancelled) {
          // Keep what was already found so it isn't re-requested next visit.
          void saveGeoCache(updated);
          return;
        }
        setCache({ ...updated });
        setProgress({ done: i + 1, total: missing.length });
        if (i < missing.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, GEOCODE_DELAY_MS));
          if (cancelled) {
            void saveGeoCache(updated);
            return;
          }
        }
      }
      setProgress(null);
      void saveGeoCache(updated);
    })();
    return () => {
      cancelled = true;
    };
  }, [places]);

  // Create the Leaflet map when its container exists (the container is only
  // rendered once there is at least one place to show).
  const hasPlaces = places.length > 0;
  useEffect(() => {
    if (!hasPlaces || !mapEl.current || mapRef.current) return;
    const map = L.map(mapEl.current, { center: [41.3, 64.6], zoom: 5, scrollWheelZoom: true });
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      className: 'map-tiles',
      maxZoom: 18,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);
    markersRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      markersRef.current = null;
      fittedRef.current = false;
    };
  }, [hasPlaces]);

  // (Re)draw one marker per located place.
  useEffect(() => {
    const map = mapRef.current;
    const layer = markersRef.current;
    if (!map || !layer || !cache) return;
    layer.clearLayers();
    const bounds: L.LatLngTuple[] = [];
    for (const place of places) {
      const coords = cache[place.key];
      if (!coords) continue;
      bounds.push([coords.lat, coords.lng]);
      const marker = L.circleMarker([coords.lat, coords.lng], {
        radius: Math.min(10 + place.people.length * 2, 26),
        color: '#047857',
        weight: 2,
        fillColor: '#10b981',
        fillOpacity: 0.55,
      });
      const names = place.people
        .slice(0, 12)
        .map((p) => `<li>${escapeHtml(fullName(p))}</li>`)
        .join('');
      const more =
        place.people.length > 12 ? `<li>… +${place.people.length - 12}</li>` : '';
      marker.bindPopup(
        `<strong>${escapeHtml(place.label)}</strong><br>` +
          `${escapeHtml(t('map.count', { n: place.people.length }))}` +
          `<ul style="margin:6px 0 0 16px;padding:0">${names}${more}</ul>`,
      );
      marker.addTo(layer);
    }
    if (bounds.length > 0 && !fittedRef.current) {
      map.fitBounds(L.latLngBounds(bounds), { padding: [40, 40], maxZoom: 10 });
      fittedRef.current = true;
    }
  }, [cache, places, t]);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <MapPin className="h-6 w-6 text-emerald-600" aria-hidden /> {t('map.title')}
          </h1>
          <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">{t('map.intro')}</p>
        </div>
        {progress && (
          <p className="flex items-center gap-2 text-sm text-stone-500 dark:text-stone-400">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            {t('map.locating', { done: progress.done, total: progress.total })}
          </p>
        )}
      </div>

      {places.length === 0 ? (
        <div className="card mt-6 p-10 text-center text-sm text-stone-500 dark:text-stone-400">
          {t('map.empty')}
        </div>
      ) : (
        <div
          ref={mapEl}
          className="card mt-4 min-h-[420px] flex-1 overflow-hidden"
          style={{ height: 'calc(100dvh - 16rem)' }}
          aria-label={t('map.title')}
        />
      )}
    </div>
  );
}

function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}
