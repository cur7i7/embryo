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
const DEFAULT_CENTER = [10, 48];
const DEFAULT_ZOOM = 2;
const PLAY_INTERVAL_MS = 2000;
const PLAY_STEP = 10;

const ALL_GENRE_KEYS = Object.keys(GENRE_BUCKETS);
const ALL_CONNECTION_TYPES = new Set(['teacher', 'influence', 'peer', 'collaboration']);

// ---------------------------------------------------------------------------
// URL hash helpers
// ---------------------------------------------------------------------------
function parseHash() {
  const hash = window.location.hash.slice(1);
  if (!hash) return {};
  const params = {};
  for (const part of hash.split('&')) {
    const [k, v] = part.split('=');
    if (k && v) params[decodeURIComponent(k)] = decodeURIComponent(v);
  }
  return params;
}

function buildHash(obj) {
  const parts = [];
  for (const [k, v] of Object.entries(obj)) {
    if (v != null && v !== '') parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(v)}`);
  }
  return parts.length ? '#' + parts.join('&') : '';
}

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------
function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < breakpoint);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < breakpoint);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, [breakpoint]);
  return isMobile;
}

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------
const _initialHash = parseHash();

export default function App() {
  const isMobile = useIsMobile();
  const { artists: allArtists, loading: artistsLoading, error: artistsError } = useArtistData();
  const { connections, connectionsByArtist, connectionCounts, loading: connectionsLoading, error: connectionsError } = useConnectionData();

  const [timeline, dispatch] = useReducer(timelineReducer, {
    rangeStart: Number(_initialHash.start) || DEFAULT_RANGE[0],
    rangeEnd: Number(_initialHash.end) || DEFAULT_RANGE[1],
    isPlaying: false,
  });

  const [activeGenres, setActiveGenres] = useState(new Set(ALL_GENRE_KEYS));
  const [activeConnectionTypes, setActiveConnectionTypes] = useState(new Set(ALL_CONNECTION_TYPES));

  const [hoveredArtist, setHoveredArtist] = useState(null);
  const [selectedArtist, setSelectedArtist] = useState(null);

  const mapRef = useRef(null);
  const hashUpdateTimer = useRef(null);
  const suppressHashSync = useRef(false);

  // ---- Hash → state: restore artist selection after data loads ----
  const pendingArtistId = useRef(_initialHash.artist || null);
  useEffect(() => {
    if (!pendingArtistId.current || !allArtists.length) return;
    const artist = allArtists.find(a => a.id === pendingArtistId.current);
    if (artist) {
      setSelectedArtist(artist);
      // Fly to artist after map is ready
      const flyToArtist = () => {
        if (mapRef.current && artist.birth_lng != null && artist.birth_lat != null) {
          try {
            const z = Number(_initialHash.z) || 6;
            mapRef.current.getMap().flyTo({ center: [artist.birth_lng, artist.birth_lat], zoom: z });
          } catch { /* map not ready */ }
        }
      };
      const map = mapRef.current?.getMap?.();
      if (map?.loaded?.()) {
        flyToArtist();
      } else if (map) {
        map.on('load', flyToArtist);
      }
    }
    pendingArtistId.current = null;
  }, [allArtists]);

  // ---- Hash → state: restore map position after mount ----
  useEffect(() => {
    const h = _initialHash;
    if (h.lat && h.lng) {
      const jumpToPos = () => {
        if (mapRef.current) {
          try {
            mapRef.current.getMap().jumpTo({
              center: [Number(h.lng), Number(h.lat)],
              zoom: Number(h.z) || DEFAULT_ZOOM,
            });
          } catch { /* map not ready */ }
        }
      };
      const map = mapRef.current?.getMap?.();
      if (map?.loaded?.()) {
        jumpToPos();
      } else if (map) {
        map.on('load', jumpToPos);
      }
    }
  }, []);

  // ---- State → hash: debounced sync ----
  const syncHashNow = useCallback(() => {
    if (suppressHashSync.current) return;
    clearTimeout(hashUpdateTimer.current);
    hashUpdateTimer.current = setTimeout(() => {
      const map = mapRef.current?.getMap?.();
      const center = map?.getCenter?.();
      const zoom = map?.getZoom?.();
      const obj = {};
      if (center) {
        obj.lat = center.lat.toFixed(2);
        obj.lng = center.lng.toFixed(2);
      }
      if (zoom != null) obj.z = zoom.toFixed(1);
      if (timeline.rangeStart !== DEFAULT_RANGE[0]) obj.start = timeline.rangeStart;
      if (timeline.rangeEnd !== DEFAULT_RANGE[1]) obj.end = timeline.rangeEnd;
      if (selectedArtist) obj.artist = selectedArtist.id;
      const hash = buildHash(obj);
      if (window.location.hash !== hash) {
        window.history.replaceState(null, '', hash || window.location.pathname);
      }
    }, 500);
  }, [timeline.rangeStart, timeline.rangeEnd, selectedArtist]);

  useEffect(() => {
    syncHashNow();
    return () => clearTimeout(hashUpdateTimer.current);
  }, [syncHashNow]);

  // ---- Map moveend → hash sync ----
  useEffect(() => {
    const map = mapRef.current?.getMap?.();
    if (!map) return;
    const onMoveEnd = () => syncHashNow();
    map.on('moveend', onMoveEnd);
    return () => map.off('moveend', onMoveEnd);
  }, [syncHashNow]);

  // ---- Popstate (back/forward) ----
  useEffect(() => {
    const onPop = () => {
      suppressHashSync.current = true;
      const h = parseHash();
      if (h.start || h.end) {
        dispatch({ type: 'SET_RANGE', start: Number(h.start) || DEFAULT_RANGE[0], end: Number(h.end) || DEFAULT_RANGE[1] });
      }
      if (h.artist && allArtists.length) {
        const a = allArtists.find(x => x.id === h.artist);
        if (a) setSelectedArtist(a);
      } else {
        setSelectedArtist(null);
      }
      if (h.lat && h.lng && mapRef.current) {
        try {
          mapRef.current.getMap().jumpTo({
            center: [Number(h.lng), Number(h.lat)],
            zoom: Number(h.z) || DEFAULT_ZOOM,
          });
        } catch { /* map not ready */ }
      }
      setTimeout(() => { suppressHashSync.current = false; }, 600);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [allArtists]);

  const handleRangeChange = useCallback((start, end) => dispatch({ type: 'SET_RANGE', start, end }), []);

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
        if (next.size === 0) return prev;
      } else {
        next.add(bucketName);
      }
      return next;
    });
  }, []);

  const handleSelectAllGenres = useCallback(() => {
    setActiveGenres(new Set(ALL_GENRE_KEYS));
  }, []);

  const handleToggleConnectionType = useCallback((type) => {
    setActiveConnectionTypes(prev => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
        if (next.size === 0) return prev;
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

  // Select artist — auto-expand filters if the artist is outside current view
  const handleSelect = useCallback((artist) => {
    setSelectedArtist(artist);
    if (!artist) return;

    // Auto-expand timeline is handled via a separate effect that reads reducer state.

    // Auto-expand genre filter
    const { bucket } = getGenreBucket(artist.genres);
    setActiveGenres(prev => {
      if (prev.has(bucket)) return prev;
      const next = new Set(prev);
      next.add(bucket);
      return next;
    });

    // Fly to artist
    if (mapRef.current && artist.birth_lng != null && artist.birth_lat != null) {
      try {
        mapRef.current.getMap().flyTo({
          center: [artist.birth_lng, artist.birth_lat],
          zoom: Math.max(mapRef.current?.getMap?.()?.getZoom?.() || 6, 6),
        });
      } catch { /* map not ready */ }
    }
  }, []);

  // Auto-expand timeline when artist is selected but outside range
  useEffect(() => {
    if (!selectedArtist) return;
    const aStart = selectedArtist.active_start ?? selectedArtist.birth_year;
    const aEnd = selectedArtist.active_end ?? selectedArtist.death_year ?? 2025;
    if (aStart == null) return;
    const needExpand = aStart > timeline.rangeEnd || aEnd < timeline.rangeStart;
    if (needExpand) {
      dispatch({
        type: 'SET_RANGE',
        start: Math.max(1400, Math.min(timeline.rangeStart, aStart - 10)),
        end: Math.min(2025, Math.max(timeline.rangeEnd, aEnd + 10)),
      });
    }
  }, [selectedArtist, timeline.rangeStart, timeline.rangeEnd]);

  const handleCloseDetail = useCallback(() => {
    setSelectedArtist(null);
  }, []);

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

  const connectionTypeCounts = useMemo(() => {
    const counts = { teacher: 0, influence: 0, peer: 0, collaboration: 0 };
    for (const conn of connections) {
      if (counts[conn.type] !== undefined) counts[conn.type]++;
    }
    return counts;
  }, [connections]);

  const selectedArtistConnections = useMemo(() => {
    if (!selectedArtist) return [];
    return connectionsByArtist.get(selectedArtist.id) || [];
  }, [selectedArtist, connectionsByArtist]);

  // ---- Reset view: detect non-default state ----
  const isDefault = timeline.rangeStart === DEFAULT_RANGE[0]
    && timeline.rangeEnd === DEFAULT_RANGE[1]
    && activeGenres.size === ALL_GENRE_KEYS.length
    && activeConnectionTypes.size === ALL_CONNECTION_TYPES.size
    && !selectedArtist;

  const handleReset = useCallback(() => {
    dispatch({ type: 'SET_RANGE', start: DEFAULT_RANGE[0], end: DEFAULT_RANGE[1] });
    setActiveGenres(new Set(ALL_GENRE_KEYS));
    setActiveConnectionTypes(new Set(ALL_CONNECTION_TYPES));
    setSelectedArtist(null);
    if (mapRef.current) {
      try {
        mapRef.current.getMap().flyTo({ center: DEFAULT_CENTER, zoom: DEFAULT_ZOOM });
      } catch { /* map not ready */ }
    }
  }, []);

  // ---- Loading state ----
  if (artistsLoading || connectionsLoading) {
    return (
      <div role="status" aria-live="polite" style={{ width: '100vw', minHeight: '100vh', height: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FAF3EB', fontFamily: '"DM Sans", sans-serif' }}>
        <style>{`
          @keyframes embryo-pulse { 0%,100% { opacity: .4; } 50% { opacity: 1; } }
          @keyframes embryo-bar { 0% { width: 0%; } 100% { width: 100%; } }
        `}</style>
        <div style={{ textAlign: 'center', color: '#5A5048' }}>
          <div style={{ fontSize: 20, fontWeight: 600, marginBottom: 6, letterSpacing: '0.04em', color: '#3E3530' }}>
            EMBRYO
          </div>
          <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 16, animation: 'embryo-pulse 1.8s ease-in-out infinite' }}>
            Loading musicians…
          </div>
          <div style={{ width: 180, height: 3, borderRadius: 2, backgroundColor: 'rgba(90,80,72,0.12)', overflow: 'hidden' }}>
            <div style={{ height: '100%', borderRadius: 2, backgroundColor: '#C4326B', animation: 'embryo-bar 2.5s ease-in-out infinite' }} />
          </div>
          <div style={{ fontSize: 12, color: '#7A6E65', marginTop: 10 }}>
            Preparing 31,069 artists
          </div>
        </div>
      </div>
    );
  }

  if (artistsError || connectionsError) {
    return (
      <div role="alert" style={{ width: '100vw', minHeight: '100vh', height: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FAF3EB', fontFamily: '"DM Sans", sans-serif' }}>
        <div style={{ textAlign: 'center', color: '#5A5048' }}>
          <div style={{ fontSize: 18, fontWeight: 500, marginBottom: 8 }}>Failed to load data</div>
          <div style={{ fontSize: 13, color: '#7A6E65' }}>{artistsError || connectionsError}</div>
        </div>
      </div>
    );
  }

  return (
    <main style={{ width: '100vw', minHeight: '100vh', height: '100dvh', overflow: 'hidden' }}>
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
        isPlaying={timeline.isPlaying}
      />

      <SearchBar
        artists={allArtists}
        onSelect={handleSelect}
        mapRef={mapRef}
        isMobile={isMobile}
        rangeStart={timeline.rangeStart}
        rangeEnd={timeline.rangeEnd}
      />

      {/* Reset view button — only visible when filters are non-default */}
      {!isDefault && (
        <button
          onClick={handleReset}
          aria-label="Reset view to defaults"
          style={{
            position: 'fixed',
            top: 100,
            left: 16,
            zIndex: 15,
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            padding: '7px 14px',
            fontSize: 13,
            fontWeight: 500,
            fontFamily: '"DM Sans", sans-serif',
            color: '#5A5048',
            backgroundColor: 'rgba(250, 243, 235, 0.92)',
            backdropFilter: 'blur(6px)',
            border: '1px solid rgba(224, 216, 204, 0.7)',
            borderRadius: 20,
            boxShadow: '0 2px 10px rgba(90, 80, 72, 0.10)',
            cursor: 'pointer',
            minHeight: 44,
            minWidth: 44,
            transition: 'opacity 0.2s ease',
          }}
        >
          <span aria-hidden="true" style={{ fontSize: 15 }}>↺</span>
          Reset
        </button>
      )}

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
