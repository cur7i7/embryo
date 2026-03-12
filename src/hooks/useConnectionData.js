import { useState, useEffect } from 'react';

export function useConnectionData() {
  const [connections, setConnections] = useState([]);
  const [connectionsByArtist, setConnectionsByArtist] = useState(new Map());
  const [connectionCounts, setConnectionCounts] = useState(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/data/connections_final.json')
      .then((res) => res.json())
      .then((data) => {
        // Filter out rivalry connections
        const filtered = data.filter((c) => c.type !== 'rivalry');

        // Build connectionsByArtist: each artist maps to all connections they appear in
        const byArtist = new Map();
        for (const conn of filtered) {
          const { source_name, target_name } = conn;

          if (!byArtist.has(source_name)) byArtist.set(source_name, []);
          byArtist.get(source_name).push(conn);

          if (!byArtist.has(target_name)) byArtist.set(target_name, []);
          byArtist.get(target_name).push(conn);
        }

        // Build connectionCounts from byArtist
        const counts = new Map();
        for (const [name, conns] of byArtist) {
          counts.set(name, conns.length);
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
        console.error('Failed to load connection data:', err);
        setLoading(false);
      });
  }, []);

  return { connections, connectionsByArtist, connectionCounts, loading };
}
