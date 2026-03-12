import { useState, useEffect } from 'react';

export function useArtistData() {
  const [artists, setArtists] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/data/artists_final.json')
      .then((res) => res.json())
      .then((data) => {
        const validCount = data.filter(
          (a) => a.birth_lat != null && a.birth_lng != null
        ).length;
        console.log(`${validCount} artists with valid coordinates`);
        setArtists(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load artist data:', err);
        setLoading(false);
      });
  }, []);

  return { artists, loading };
}
