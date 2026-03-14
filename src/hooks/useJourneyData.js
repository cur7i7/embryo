import { useState, useEffect, useCallback, useRef } from 'react';

export function useJourneyData() {
  const [manifest, setManifest] = useState([]);
  const [loading, setLoading] = useState(true);
  const journeyCache = useRef(new Map());

  useEffect(() => {
    const controller = new AbortController();
    fetch('/data/journeys/index.json', { signal: controller.signal })
      .then(r => r.json())
      .then(data => { setManifest(data); setLoading(false); })
      .catch(err => {
        if (err.name !== 'AbortError') setLoading(false);
      });
    return () => controller.abort();
  }, []);

  const loadJourney = useCallback(async (journeyId) => {
    if (journeyCache.current.has(journeyId)) {
      return journeyCache.current.get(journeyId);
    }
    const res = await fetch(`/data/journeys/${journeyId}.json`);
    if (!res.ok) throw new Error(`Failed to load journey ${journeyId} (${res.status})`);
    const data = await res.json();
    journeyCache.current.set(journeyId, data);
    return data;
  }, []);

  return { manifest, loading, loadJourney };
}
