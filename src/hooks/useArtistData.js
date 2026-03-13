import { useState, useEffect } from 'react';

export function useArtistData() {
  const [artists, setArtists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch('/data/artists_final.json', { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        const normalized = data.map((artist) => {
          const lat = Number(artist.birth_lat);
          const lng = Number(artist.birth_lng);
          const validLat =
            artist.birth_lat != null &&
            !isNaN(lat) &&
            lat >= -90 &&
            lat <= 90;
          const validLng =
            artist.birth_lng != null &&
            !isNaN(lng) &&
            lng >= -180 &&
            lng <= 180;
          // Also reject (0, 0) — "null island" in Gulf of Guinea, always bad data
          if (validLat && validLng && !(lat === 0 && lng === 0)) {
            return { ...artist, birth_lat: lat, birth_lng: lng, _hasCoords: true };
          }
          return { ...artist, birth_lat: null, birth_lng: null, _hasCoords: false };
        });
        const validCount = normalized.filter((a) => a._hasCoords).length;
        const invalidCount = normalized.length - validCount;
        console.log(
          `Artists loaded: ${normalized.length} total, ${validCount} with valid coordinates, ${invalidCount} without`
        );
        setArtists(normalized);
        setLoading(false);
      })
      .catch((err) => {
        if (err.name === 'AbortError') return;
        console.error('Failed to load artist data:', err);
        setError(err.message);
        setLoading(false);
      });
    return () => controller.abort();
  }, []);

  return { artists, loading, error };
}
