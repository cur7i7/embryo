import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import Map from './components/Map.jsx';
import Timeline from './components/Timeline.jsx';
import EraShortcuts from './components/EraShortcuts.jsx';
import { useArtistData } from './hooks/useArtistData.js';
import { useConnectionData } from './hooks/useConnectionData.js';

const DEFAULT_RANGE = [1400, 2025];
const PLAY_INTERVAL_MS = 2000;
const PLAY_STEP = 10; // 1 decade per tick

export default function App() {
  const { artists: allArtists, loading: artistsLoading } = useArtistData();
  const { connectionCounts, loading: connectionsLoading } = useConnectionData();

  const [rangeStart, setRangeStart] = useState(DEFAULT_RANGE[0]);
  const [rangeEnd, setRangeEnd] = useState(DEFAULT_RANGE[1]);
  const [isPlaying, setIsPlaying] = useState(false);

  const windowWidth = useRef(rangeEnd - rangeStart);

  const handleRangeChange = useCallback((start, end) => {
    setRangeStart(start);
    setRangeEnd(end);
    windowWidth.current = end - start;
  }, []);

  // Playback: advance window by 1 decade every 2 seconds, keeping window width constant
  useEffect(() => {
    if (!isPlaying) return;

    const id = setInterval(() => {
      setRangeStart((prevStart) => {
        const w = windowWidth.current;
        const nextStart = prevStart + PLAY_STEP;
        const nextEnd = nextStart + w;

        if (nextEnd >= 2025) {
          // Stop at the end
          setRangeEnd(2025);
          setIsPlaying(false);
          return 2025 - w;
        }

        setRangeEnd(nextEnd);
        return nextStart;
      });
    }, PLAY_INTERVAL_MS);

    return () => clearInterval(id);
  }, [isPlaying]);

  // Keep windowWidth in sync when user drags (not during playback)
  useEffect(() => {
    if (!isPlaying) {
      windowWidth.current = rangeEnd - rangeStart;
    }
  }, [rangeStart, rangeEnd, isPlaying]);

  const handlePlayPause = useCallback(() => {
    setIsPlaying((prev) => !prev);
  }, []);

  // Filter artists by active range.
  // Rule: artist is visible when active_start <= rangeEnd AND active_end >= rangeStart
  const filteredArtists = useMemo(() => {
    if (!allArtists.length) return [];
    return allArtists.filter((a) => {
      const start = a.active_start ?? a.birth_year;
      const end = a.active_end ?? a.death_year ?? start;
      if (start == null) return false;
      return start <= rangeEnd && end >= rangeStart;
    });
  }, [allArtists, rangeStart, rangeEnd]);

  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden' }}>
      <Map
        artists={filteredArtists}
        connectionCounts={connectionCounts}
        rangeStart={rangeStart}
        rangeEnd={rangeEnd}
      />

      <EraShortcuts
        rangeStart={rangeStart}
        rangeEnd={rangeEnd}
        onRangeChange={handleRangeChange}
      />

      <Timeline
        artists={allArtists}
        rangeStart={rangeStart}
        rangeEnd={rangeEnd}
        onRangeChange={handleRangeChange}
        isPlaying={isPlaying}
        onPlayPause={handlePlayPause}
      />
    </div>
  );
}
