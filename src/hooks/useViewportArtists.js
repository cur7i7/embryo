import { useState, useEffect, useRef, useCallback } from 'react';

const MIN_ZOOM = 7;
const MAX_RESULTS = 50;
const DEBOUNCE_MS = 300;

export function useViewportArtists(mapRef, artists, connectionCounts) {
  const [viewportArtists, setViewportArtists] = useState([]);
  const [isActive, setIsActive] = useState(false);
  const debounceRef = useRef(null);

  const update = useCallback(() => {
    if (!mapRef?.current) return;
    try {
      const map = mapRef.current.getMap();
      const zoom = map.getZoom();

      if (zoom < MIN_ZOOM) {
        setIsActive(false);
        setViewportArtists([]);
        return;
      }

      setIsActive(true);
      const bounds = map.getBounds();
      const sw = bounds.getSouthWest();
      const ne = bounds.getNorthEast();

      const visible = [];
      for (const a of artists) {
        if (!a._hasCoords) continue;
        if (a.birth_lat >= sw.lat && a.birth_lat <= ne.lat &&
            a.birth_lng >= sw.lng && a.birth_lng <= ne.lng) {
          visible.push(a);
        }
      }

      visible.sort((a, b) => {
        const ca = connectionCounts?.get?.(a.id) ?? 0;
        const cb = connectionCounts?.get?.(b.id) ?? 0;
        return cb - ca;
      });

      setViewportArtists(visible.slice(0, MAX_RESULTS));
    } catch {
      // Silently ignore map errors during transitions
    }
  }, [mapRef, artists, connectionCounts]);

  useEffect(() => {
    if (!mapRef?.current) return;
    const map = mapRef.current.getMap?.();
    if (!map) return;

    const handler = () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(update, DEBOUNCE_MS);
    };

    map.on('moveend', handler);
    map.on('zoomend', handler);
    handler();

    return () => {
      map.off('moveend', handler);
      map.off('zoomend', handler);
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [mapRef, update]);

  return { viewportArtists, isActive };
}
