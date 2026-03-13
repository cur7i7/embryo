import React, { useState, useReducer, useMemo, useEffect, useRef, useCallback } from 'react';
import Map from './components/Map.jsx';
import Timeline from './components/Timeline.jsx';
import GenreFilters from './components/GenreFilters.jsx';
import ConnectionFilters from './components/ConnectionFilters.jsx';
import DetailPanel from './components/DetailPanel.jsx';
import SearchBar from './components/SearchBar.jsx';
import { useArtistData } from './hooks/useArtistData.js';
import { useConnectionData } from './hooks/useConnectionData.js';
import { GENRE_BUCKETS, getGenreBucket } from './utils/genres.js';

const DEFAULT_RANGE = [1400, 2025];
const PLAY_INTERVAL_MS = 2000;
const PLAY_STEP = 10; // 1 decade per tick

const ALL_CONNECTION_TYPES = new Set(['teacher', 'influence', 'peer', 'collaboration']);

function timelineReducer(state, action) {
  switch (action.type) {
    case 'SET_RANGE':
      return { ...state, rangeStart: action.start, rangeEnd: action.end };
    case 'PLAY_TICK': {
      const w = state.rangeEnd - state.rangeStart;
      const nextStart = state.rangeStart + PLAY_STEP;
      const nextEnd = nextStart + w;
      if (nextEnd >= 2025) {
        return { rangeStart: 2025 - w, rangeEnd: 2025, isPlaying: false };
      }
      return { ...state, rangeStart: nextStart, rangeEnd: nextEnd };
    }
    case 'TOGGLE_PLAY':
      return { ...state, isPlaying: !state.isPlaying };
    default:
      return state;
  }
}

function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < breakpoint);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < breakpoint);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, [breakpoint]);
  return isMobile;
}

export default function App() {
  const isMobile = useIsMobile();
  const { artists: allArtists, loading: artistsLoading, error: artistsError } = useArtistData();
  const { connections, connectionsByArtist, connectionCounts, loading: connectionsLoading, error: connectionsError } = useConnectionData();

  const [timeline, dispatch] = useReducer(timelineReducer, {
    rangeStart: DEFAULT_RANGE[0],
    rangeEnd: DEFAULT_RANGE[1],
    isPlaying: false,
  });

  const [activeGenres, setActiveGenres] = useState(new Set(Object.keys(GENRE_BUCKETS)));
  const [activeConnectionTypes, setActiveConnectionTypes] = useState(new Set(ALL_CONNECTION_TYPES));

  // Hover and selection state
  const [hoveredArtist, setHoveredArtist] = useState(null);
  const [selectedArtist, setSelectedArtist] = useState(null);

  // mapRef lifted to App level so SearchBar and DetailPanel can use flyTo
  const mapRef = useRef(null);

  const handleRangeChange = useCallback((start, end) => dispatch({ type: 'SET_RANGE', start, end }), []);

  // Playback: advance window by 1 decade every 2 seconds, keeping window width constant
  useEffect(() => {
    if (!timeline.isPlaying) return;
    const id = setInterval(() => dispatch({ type: 'PLAY_TICK' }), PLAY_INTERVAL_MS);
    return () => clearInterval(id);
  }, [timeline.isPlaying]);

  const handlePlayPause = useCallback(() => dispatch({ type: 'TOGGLE_PLAY' }), []);

  const handleToggleGenre = useCallback((bucketName) => {
    setActiveGenres(prev => {
      const next = new Set(prev);
      if (next.has(bucketName)) {
        next.delete(bucketName);
        if (next.size === 0) return prev; // don't allow empty — keep last genre selected
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

  const handleHover = useCallback((artist) => {
    setHoveredArtist(artist);
  }, []);

  const handleSelect = useCallback((artist) => {
    setSelectedArtist(artist);
    if (artist && mapRef.current && artist.birth_lng != null && artist.birth_lat != null) {
      try {
        mapRef.current.getMap().flyTo({
          center: [artist.birth_lng, artist.birth_lat],
          zoom: Math.max(mapRef.current?.getMap?.()?.getZoom?.() || 6, 6),
        });
      } catch (_) {
        // map not ready
      }
    }
  }, []);

  const handleCloseDetail = useCallback(() => {
    setSelectedArtist(null);
  }, []);

  // Filter artists by active range and genre.
  // Rule: artist is visible when active_start <= rangeEnd AND active_end >= rangeStart
  const filteredArtists = useMemo(() => {
    if (!allArtists.length) return [];
    return allArtists.filter((a) => {
      const start = a.active_start ?? a.birth_year;
      const end = a.active_end ?? a.death_year ?? 2025;
      if (start == null) return false;
      const inRange = start <= timeline.rangeEnd && end >= timeline.rangeStart;
      if (!inRange) return false;
      const { bucket } = getGenreBucket(a.genres);
      return activeGenres.has(bucket);
    });
  }, [allArtists, timeline.rangeStart, timeline.rangeEnd, activeGenres]);

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

  // Connections for selected artist
  const selectedArtistConnections = useMemo(() => {
    if (!selectedArtist) return [];
    return connectionsByArtist.get(selectedArtist.name) || [];
  }, [selectedArtist, connectionsByArtist]);

  if (artistsLoading || connectionsLoading) {
    return (
      <div role="status" aria-live="polite" style={{ width: '100vw', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FAF3EB', fontFamily: '"DM Sans", sans-serif' }}>
        <div style={{ textAlign: 'center', color: '#5A5048' }}>
          <div style={{ fontSize: 18, fontWeight: 500, marginBottom: 8 }}>Loading musicians…</div>
          <div style={{ fontSize: 13, color: '#6B5F55' }}>Preparing 31,069 artists</div>
        </div>
      </div>
    );
  }

  if (artistsError || connectionsError) {
    return (
      <div role="alert" style={{ width: '100vw', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FAF3EB', fontFamily: '"DM Sans", sans-serif' }}>
        <div style={{ textAlign: 'center', color: '#5A5048' }}>
          <div style={{ fontSize: 18, fontWeight: 500, marginBottom: 8 }}>Failed to load data</div>
          <div style={{ fontSize: 13, color: '#9A8E85' }}>{artistsError || connectionsError}</div>
        </div>
      </div>
    );
  }

  return (
    <main style={{ width: '100vw', height: '100vh', overflow: 'hidden' }}>
      <Map
        mapRef={mapRef}
        artists={filteredArtists}
        connectionCounts={connectionCounts}
        connections={connections}
        activeConnectionTypes={activeConnectionTypes}
        rangeStart={timeline.rangeStart}
        rangeEnd={timeline.rangeEnd}
        hoveredArtist={hoveredArtist}
        selectedArtist={selectedArtist}
        onHover={handleHover}
        onSelect={handleSelect}
      />

      <SearchBar
        artists={allArtists}
        onSelect={handleSelect}
        mapRef={mapRef}
        isMobile={isMobile}
        rangeStart={timeline.rangeStart}
        rangeEnd={timeline.rangeEnd}
      />

      <GenreFilters
        activeGenres={activeGenres}
        onToggleGenre={handleToggleGenre}
        onSelectAll={handleSelectAllGenres}
        isMobile={isMobile}
      />

      <ConnectionFilters
        activeConnectionTypes={activeConnectionTypes}
        onToggleType={handleToggleConnectionType}
        onSelectAll={handleSelectAllConnectionTypes}
        typeCounts={connectionTypeCounts}
        isMobile={isMobile}
      />

      <Timeline
        artists={allArtists}
        rangeStart={timeline.rangeStart}
        rangeEnd={timeline.rangeEnd}
        onRangeChange={handleRangeChange}
        isPlaying={timeline.isPlaying}
        onPlayPause={handlePlayPause}
        isMobile={isMobile}
      />

      <DetailPanel
        artist={selectedArtist}
        connections={selectedArtistConnections}
        allArtists={allArtists}
        onSelect={handleSelect}
        onClose={handleCloseDetail}
        mapRef={mapRef}
        isMobile={isMobile}
      />
    </main>
  );
}
