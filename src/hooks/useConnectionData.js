import { useState, useEffect } from 'react';

export function useConnectionData() {
  const [connections, setConnections] = useState([]);
  const [connectionsByArtist, setConnectionsByArtist] = useState(new Map());
  const [connectionCounts, setConnectionCounts] = useState(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch('/data/connections_final.json', { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        // Filter out rivalry connections
        const filtered = data.filter((c) => c.type !== 'rivalry');

        // Build connectionsByArtist keyed by artist ID for uniqueness
        const byArtist = new Map();
        for (const conn of filtered) {
          const { source_id, target_id } = conn;

          if (!byArtist.has(source_id)) byArtist.set(source_id, []);
          byArtist.get(source_id).push(conn);

          if (!byArtist.has(target_id)) byArtist.set(target_id, []);
          byArtist.get(target_id).push(conn);
        }

        // Build connectionCounts keyed by both ID and name for backward
        // compatibility (CanvasOverlay looks up counts by artist name).
        const counts = new Map();
        for (const [id, conns] of byArtist) {
          counts.set(id, conns.length);
        }
        for (const conn of filtered) {
          const { source_id, source_name, target_id, target_name } = conn;
          if (source_name && !counts.has(source_name)) {
            counts.set(source_name, counts.get(source_id) || 0);
          }
          if (target_name && !counts.has(target_name)) {
            counts.set(target_name, counts.get(target_id) || 0);
          }
        }

        console.log(
          `Loaded ${filtered.length} connections (${data.length - filtered.length} rivalries filtered). ` +
          `${byArtist.size} artists indexed.`
        );

        setConnections(filtered);
        setConnectionsByArtist(byArtist);
        setConnectionCounts(counts);
        setLoading(false);
      })
      .catch((err) => {
        if (err.name === 'AbortError') return;
        console.error('Failed to load connection data:', err);
        setError(err.message);
        setLoading(false);
      });
    return () => controller.abort();
  }, []);

  return { connections, connectionsByArtist, connectionCounts, loading, error };
}
