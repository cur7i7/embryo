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
        const validCount = data.filter(
          (a) => a.birth_lat != null && a.birth_lng != null
        ).length;
        console.log(`${validCount} artists with valid coordinates`);
        setArtists(data);
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
