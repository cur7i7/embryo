import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import Map from './components/Map.jsx';
import Timeline from './components/Timeline.jsx';
import GenreFilters from './components/GenreFilters.jsx';
import ConnectionFilters from './components/ConnectionFilters.jsx';
import { useArtistData } from './hooks/useArtistData.js';
import { useConnectionData } from './hooks/useConnectionData.js';
import { GENRE_BUCKETS, getGenreBucket } from './utils/genres.js';

const DEFAULT_RANGE = [1400, 2025];
const PLAY_INTERVAL_MS = 2000;
const PLAY_STEP = 10; // 1 decade per tick

const ALL_CONNECTION_TYPES = new Set(['teacher', 'influence', 'peer', 'collaboration']);

export default function App() {
  const { artists: allArtists, loading: artistsLoading } = useArtistData();
  const { connections, connectionCounts, loading: connectionsLoading } = useConnectionData();

  const [rangeStart, setRangeStart] = useState(DEFAULT_RANGE[0]);
  const [rangeEnd, setRangeEnd] = useState(DEFAULT_RANGE[1]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeGenres, setActiveGenres] = useState(new Set(Object.keys(GENRE_BUCKETS)));
  const [activeConnectionTypes, setActiveConnectionTypes] = useState(new Set(ALL_CONNECTION_TYPES));

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

  const handleToggleGenre = useCallback((bucketName) => {
    setActiveGenres(prev => {
      const next = new Set(prev);
      if (next.has(bucketName)) {
        next.delete(bucketName);
        if (next.size === 0) return prev; // don't allow empty
      } else {
        next.add(bucketName);
      }
      return next;
    });
  }, []);

  const handleSelectAllGenres = useCallback(() => {
    setActiveGenres(new Set(Object.keys(GENRE_BUCKETS)));
  }, []);

  const handleToggleConnectionType = useCallback((type) => {
    setActiveConnectionTypes(prev => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
        if (next.size === 0) return prev; // don't allow empty
      } else {
        next.add(type);
      }
      return next;
    });
  }, []);

  const handleSelectAllConnectionTypes = useCallback(() => {
    setActiveConnectionTypes(new Set(ALL_CONNECTION_TYPES));
  }, []);

  // Filter artists by active range and genre.
  // Rule: artist is visible when active_start <= rangeEnd AND active_end >= rangeStart
  const filteredArtists = useMemo(() => {
    if (!allArtists.length) return [];
    return allArtists.filter((a) => {
      const start = a.active_start ?? a.birth_year;
      const end = a.active_end ?? a.death_year ?? start;
      if (start == null) return false;
      const inRange = start <= rangeEnd && end >= rangeStart;
      if (!inRange) return false;
      const { bucket } = getGenreBucket(a.genres);
      return activeGenres.has(bucket);
    });
  }, [allArtists, rangeStart, rangeEnd, activeGenres]);

  // Compute per-type connection counts for filter button labels
  const connectionTypeCounts = useMemo(() => {
    const counts = { teacher: 0, influence: 0, peer: 0, collaboration: 0 };
    for (const conn of connections) {
      if (counts[conn.type] !== undefined) {
        counts[conn.type]++;
      }
    }
    return counts;
  }, [connections]);

  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden' }}>
      <Map
        artists={filteredArtists}
        connectionCounts={connectionCounts}
        connections={connections}
        activeConnectionTypes={activeConnectionTypes}
        rangeStart={rangeStart}
        rangeEnd={rangeEnd}
      />

      <GenreFilters
        activeGenres={activeGenres}
        onToggleGenre={handleToggleGenre}
        onSelectAll={handleSelectAllGenres}
      />

      <ConnectionFilters
        activeConnectionTypes={activeConnectionTypes}
        onToggleType={handleToggleConnectionType}
        onSelectAll={handleSelectAllConnectionTypes}
        typeCounts={connectionTypeCounts}
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
