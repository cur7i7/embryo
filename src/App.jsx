import React, { useState, useReducer, useMemo, useEffect, useRef, useCallback, createContext } from 'react';
import Map from './components/Map.jsx';
import Timeline from './components/Timeline.jsx';
import GenreFilters from './components/GenreFilters.jsx';
import ConnectionFilters from './components/ConnectionFilters.jsx';
import DetailPanel from './components/DetailPanel.jsx';
import SearchBar from './components/SearchBar.jsx';
import OnboardingOverlay from './components/OnboardingOverlay.jsx';
import GenreLegend from './components/GenreLegend.jsx';
import HoverCard from './components/HoverCard.jsx';
import ComparisonView from './components/ComparisonView.jsx';
import JourneyPicker from './components/JourneyPicker.jsx';
import JourneyPlayer from './components/JourneyPlayer.jsx';
import NearbyArtists from './components/NearbyArtists.jsx';
import { useArtistData } from './hooks/useArtistData.js';
import { useConnectionData } from './hooks/useConnectionData.js';
import { useJourneyData } from './hooks/useJourneyData.js';
import { useViewportArtists } from './hooks/useViewportArtists.js';
import { GENRE_BUCKETS, getGenreBucket } from './utils/genres.js';
import { flyToArtist, flyToWaypoint } from './utils/mapHelpers.js';

// Fix #3: Context to provide total artist count to ArtistCount without modifying Map.jsx
export const TotalArtistCountContext = createContext(0);

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
  // E: If 'year' key exists, expand to start=year, end=year
  if (params.year) {
    params.start = params.year;
    params.end = params.year;
    params._yearMode = true;
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

function toSlug(artist) {
  if (!artist || !artist.name) return artist?.id ?? '';
  const base = artist.name
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')   // strip diacritics
    .replace(/[^a-z0-9]+/g, '-')                         // non-alphanum → hyphen
    .replace(/^-+|-+$/g, '');                             // trim leading/trailing hyphens
  // Append ID with ~ separator so it's unambiguous to parse back
  return base ? `${base}~${artist.id}` : String(artist.id);
}

function fromSlug(slug) {
  if (!slug) return null;
  // New format: name~artist_XXXX
  if (slug.includes('~')) return slug.split('~').pop();
  // Backwards compat: raw artist ID (artist_0775) or old format
  if (slug.startsWith('artist_')) return slug;
  return slug;
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
      return { ...state, isPlaying: !state.isPlaying, playSpeed: action.speed || state.playSpeed || 1 };
    default:
      return state;
  }
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------
// Fix #56: Raised base breakpoint from 768→900 so tablets in portrait (768px)
// get the desktop layout.
// Fix #24: 1024px landscape touch devices (iPad landscape) now get desktop layout.
// Only portrait touch devices ≤1024px get mobile.
function useIsMobile(breakpoint = 900) {
  const check = () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const isTouch = navigator.maxTouchPoints > 0;
    // Landscape touch at 1024px+ → desktop
    if (isTouch && w >= 1024 && w > h) return false;
    return w <= breakpoint || (w <= 1024 && isTouch);
  };
  const [isMobile, setIsMobile] = useState(check);
  useEffect(() => {
    const handler = () => setIsMobile(check());
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, [breakpoint]);
  return isMobile;
}

// Fix #4/#5: Detect constrained landscape viewports (phone landscape)
function useIsLandscapeConstrained() {
  const check = () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    return w > h && h <= 500;
  };
  const [value, setValue] = useState(check);
  useEffect(() => {
    const handler = () => setValue(check());
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  return value;
}

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------
const _initialHash = parseHash();

export default function App() {
  const isMobile = useIsMobile();
  const isLandscapeConstrained = useIsLandscapeConstrained();
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
  const [hoverPosition, setHoverPosition] = useState(null);
  const [selectedArtist, setSelectedArtist] = useState(null);
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [comparisonPair, setComparisonPair] = useState([]);
  const [isCompareArmed, setIsCompareArmed] = useState(false);
  const [isComparisonOpen, setIsComparisonOpen] = useState(false);

  // Journey state
  const { manifest: journeyManifest, loading: journeysLoading, loadJourney } = useJourneyData();
  const [showJourneyPicker, setShowJourneyPicker] = useState(false);
  const [activeJourney, setActiveJourney] = useState(null);

  const mapRef = useRef(null);
  const hashUpdateTimer = useRef(null);
  const suppressHashSync = useRef(false);
  const filterPanelRef = useRef(null);
  const [filterPanelHeight, setFilterPanelHeight] = useState(168);

  // Fix #57: Track whether connections warning has been dismissed
  const [connectionsWarningDismissed, setConnectionsWarningDismissed] = useState(false);

  // Fix #1: Onboarding overlay for first-time users
  const [showOnboarding, setShowOnboarding] = useState(() => {
    try { return !localStorage.getItem('embryo-onboarded'); } catch { return false; }
  });

  // Fix #11, #16, #31: Toast notification state
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);
  const showToast = useCallback((message) => {
    clearTimeout(toastTimer.current);
    setToast(message);
    toastTimer.current = setTimeout(() => setToast(null), 2500);
  }, []);

  // Progressive loading messages (Fix #34)
  const [loadingMessage, setLoadingMessage] = useState('');
  useEffect(() => {
    if (!artistsLoading && !connectionsLoading) return;
    const t1 = setTimeout(() => setLoadingMessage('Loading artist data…'), 3000);
    const t2 = setTimeout(() => setLoadingMessage('Almost there — preparing the map…'), 8000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [artistsLoading, connectionsLoading]);

  // ---- Hash → state: restore artist selection after data loads ----
  const pendingArtistId = useRef(fromSlug(_initialHash.artist) || null);
  useEffect(() => {
    if (!pendingArtistId.current || !allArtists.length) return;
    const artist = allArtists.find(a => a.id === pendingArtistId.current);
    if (artist) {
      setSelectedArtist(artist);
      // Fly to artist after map is ready
      const z = Number(_initialHash.z) || 6;
      const doFlyTo = () => flyToArtist(mapRef, artist, { zoom: z });
      const map = mapRef.current?.getMap?.();
      if (map?.loaded?.()) {
        doFlyTo();
      } else if (map) {
        map.on('load', doFlyTo);
        return () => map.off('load', doFlyTo);
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
        return () => map.off('load', jumpToPos);
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
      // E: When start === end (year mode), write year=X instead of start=X&end=X
      if (timeline.rangeStart === timeline.rangeEnd) {
        obj.year = timeline.rangeStart;
      } else {
        if (timeline.rangeStart !== DEFAULT_RANGE[0]) obj.start = timeline.rangeStart;
        if (timeline.rangeEnd !== DEFAULT_RANGE[1]) obj.end = timeline.rangeEnd;
      }
      if (selectedArtist) obj.artist = toSlug(selectedArtist);
      const hash = buildHash(obj);
      if (window.location.hash !== hash) {
        const method = selectedArtist ? 'pushState' : 'replaceState';
        window.history[method](null, '', hash || window.location.pathname);
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
      if (h.start || h.end || h.year) {
        dispatch({ type: 'SET_RANGE', start: Number(h.start) || DEFAULT_RANGE[0], end: Number(h.end) || DEFAULT_RANGE[1] });
      } else {
        dispatch({ type: 'SET_RANGE', start: DEFAULT_RANGE[0], end: DEFAULT_RANGE[1] });
      }
      if (h.artist && allArtists.length) {
        const artistId = fromSlug(h.artist);
        const a = allArtists.find(x => x.id === artistId);
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
    const interval = PLAY_INTERVAL_MS / (timeline.playSpeed || 1);
    const id = setInterval(() => dispatch({ type: 'PLAY_TICK' }), interval);
    return () => clearInterval(id);
  }, [timeline.isPlaying, timeline.playSpeed]);

  const handlePlayPause = useCallback((speed) => dispatch({ type: 'TOGGLE_PLAY', speed }), []);

  // Fix #16: Feedback when trying to deselect the last filter
  const handleToggleGenre = useCallback((bucketName) => {
    setActiveGenres(prev => {
      const next = new Set(prev);
      if (next.has(bucketName)) {
        next.delete(bucketName);
        if (next.size === 0) {
          showToast('At least one genre filter must be active');
          return prev;
        }
      } else {
        next.add(bucketName);
      }
      return next;
    });
  }, [showToast]);

  const handleSelectAllGenres = useCallback(() => {
    setActiveGenres(new Set(ALL_GENRE_KEYS));
  }, []);

  // Fix #16: Feedback when trying to deselect the last connection type
  const handleToggleConnectionType = useCallback((type) => {
    setActiveConnectionTypes(prev => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
        if (next.size === 0) {
          showToast('At least one connection type must be active');
          return prev;
        }
      } else {
        next.add(type);
      }
      return next;
    });
  }, [showToast]);

  const handleSelectAllConnectionTypes = useCallback(() => {
    setActiveConnectionTypes(new Set(ALL_CONNECTION_TYPES));
  }, []);

  const handleHover = useCallback((artist) => {
    setHoveredArtist(artist);
  }, []);

  const hoverPosRafRef = useRef(null);
  const handleHoverPosition = useCallback((pos) => {
    if (hoverPosRafRef.current) cancelAnimationFrame(hoverPosRafRef.current);
    hoverPosRafRef.current = requestAnimationFrame(() => {
      setHoverPosition(pos);
      hoverPosRafRef.current = null;
    });
  }, []);

  // Cleanup pending rAF on unmount
  useEffect(() => {
    return () => {
      if (hoverPosRafRef.current) cancelAnimationFrame(hoverPosRafRef.current);
    };
  }, []);

  // Select artist — auto-expand filters if the artist is outside current view
  const handleSelect = useCallback((artist) => {
    setSelectedArtist(artist);
    if (!artist) return;

    if (isCompareArmed && comparisonPair.length === 1) {
      const primary = comparisonPair[0];
      if (primary?.id === artist.id) {
        showToast('Select a different artist to compare');
      } else if (primary) {
        setComparisonPair([primary, artist]);
        setIsCompareArmed(false);
        setIsComparisonOpen(true);
        showToast(`Comparing ${primary.name} and ${artist.name}`);
      }
    }

    // Auto-expand timeline is handled via a separate effect that reads reducer state.

    // Auto-expand genre filter
    // Fix #31: Show indicator on mobile when genre filter is auto-added
    const { bucket } = getGenreBucket(artist.genres);
    setActiveGenres(prev => {
      if (prev.has(bucket)) return prev;
      const next = new Set(prev);
      next.add(bucket);
      showToast(`Added "${bucket}" genre filter`);
      return next;
    });

    // Fly to artist
    flyToArtist(mapRef, artist);
  }, [comparisonPair, isCompareArmed, showToast]);

  const handleStartCompare = useCallback((artist) => {
    if (!artist) return;
    setComparisonPair([artist]);
    setIsCompareArmed(true);
    setIsComparisonOpen(false);
    showToast(`"${artist.name}" locked. Select another artist to compare.`);
  }, [showToast]);

  const handleCloseComparison = useCallback(() => {
    setIsComparisonOpen(false);
    setIsCompareArmed(false);
  }, []);

  const handleSelectFromComparison = useCallback((artist) => {
    setIsComparisonOpen(false);
    setIsCompareArmed(false);
    setComparisonPair([]);
    handleSelect(artist);
  }, [handleSelect]);

  const handleSuggestionSubmitted = useCallback((artist) => {
    if (!artist) return;
    showToast(`Suggestion opened for ${artist.name}`);
  }, [showToast]);

  // Journey handlers
  const handleStartJourney = useCallback(async (journeyId) => {
    const journey = await loadJourney(journeyId);
    setActiveJourney(journey);
    setShowJourneyPicker(false);
    setSelectedArtist(null);
  }, [loadJourney]);

  const handleJourneyNavigate = useCallback((waypoint) => {
    if (!waypoint) return;
    const artist = allArtists.find(a => a.id === waypoint.artistId);
    if (artist) {
      flyToWaypoint(mapRef, artist.birth_lng, artist.birth_lat, waypoint.zoom || 10, 0.6);
    }
  }, [allArtists]);

  const handleJourneySelectArtist = useCallback((artist) => {
    handleSelect(artist);
  }, [handleSelect]);

  const handleExitJourney = useCallback(() => {
    setActiveJourney(null);
  }, []);

  // Auto-expand timeline when artist is first selected but outside range.
  // Only triggers on selectedArtist change — NOT on range changes, so user's
  // manual year/range adjustments are not overridden.
  // Fix #11: Show a toast explaining the auto-expand.
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
      const name = selectedArtist.name || 'this artist';
      showToast(`Timeline expanded to show ${name}'s active period`);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedArtist]);

  const handleCloseDetail = useCallback(() => {
    setSelectedArtist(null);
  }, []);

  // Pre-process artists with cached start/end years and genre buckets (O(n) once on data load)
  const preprocessedArtists = useMemo(() => {
    if (!allArtists.length) return [];
    return allArtists.map((a) => ({
      artist: a,
      start: a.active_start ?? a.birth_year,
      end: a.active_end ?? a.death_year ?? 2025,
      bucket: getGenreBucket(a.genres).bucket,
    }));
  }, [allArtists]);

  const filteredArtists = useMemo(() => {
    if (!preprocessedArtists.length) return [];
    const result = [];
    for (const entry of preprocessedArtists) {
      if (entry.start == null) continue;
      if (entry.start > timeline.rangeEnd || entry.end < timeline.rangeStart) continue;
      if (!activeGenres.has(entry.bucket)) continue;
      result.push(entry.artist);
    }
    return result;
  }, [preprocessedArtists, timeline.rangeStart, timeline.rangeEnd, activeGenres]);

  // Clear selected artist when they're filtered out of view
  useEffect(() => {
    if (!selectedArtist) return;
    const stillVisible = filteredArtists.some(a => a.id === selectedArtist.id);
    if (!stillVisible) {
      setSelectedArtist(null);
    }
  }, [filteredArtists, selectedArtist]);

  // Nearby artists (only active at zoom >= 7)
  const { viewportArtists, isActive: nearbyActive } = useViewportArtists(
    mapRef, filteredArtists, connectionCounts
  );

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

  // ---- Measure filter panel height for toggle button positioning (Fix #54) ----
  useEffect(() => {
    const el = filterPanelRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        setFilterPanelHeight(entry.contentRect.height);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [filtersExpanded]);

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

  // ---- Loading state ---- (Fix #57: only artists loading is fatal)
  if (artistsLoading) {
    return (
      <div role="status" aria-live="polite" style={{ width: '100vw', minHeight: '100vh', height: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FAF3EB', fontFamily: '"DM Sans", sans-serif' }}>
        <style>{`
          @keyframes embryo-pulse { 0%,100% { opacity: .4; } 50% { opacity: 1; } }
          @keyframes embryo-bar { 0% { width: 0%; } 100% { width: 100%; } }
        `}</style>
        <div style={{ textAlign: 'center', color: '#5A5048' }}>
          <img src="/embryo-logo.svg" alt="" style={{ width: 64, height: 64, marginBottom: 8 }} />
          <div style={{ fontSize: 20, fontWeight: 600, marginBottom: 6, letterSpacing: '0.04em', color: '#3E3530' }}>
            EMBRYO
          </div>
          <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 16, animation: 'embryo-pulse 1.8s ease-in-out infinite' }}>
            Loading artists…
          </div>
          <div style={{ width: 180, height: 3, borderRadius: 2, backgroundColor: 'rgba(90,80,72,0.12)', overflow: 'hidden' }}>
            <div style={{ height: '100%', borderRadius: 2, backgroundColor: '#C4326B', animation: 'embryo-bar 2.5s ease-in-out infinite' }} />
          </div>
          <div style={{ fontSize: 12, color: '#7A6E65', marginTop: 10 }}>
            Preparing the map…
          </div>
          {loadingMessage && (
            <div style={{ fontSize: 12, color: '#7A6E65', marginTop: 8, maxWidth: 220 }}>
              {loadingMessage}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Fix #57: Only artists error is fatal — connections error is non-fatal
  if (artistsError) {
    return (
      <div role="alert" style={{ width: '100vw', minHeight: '100vh', height: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FAF3EB', fontFamily: '"DM Sans", sans-serif' }}>
        <div style={{ textAlign: 'center', color: '#5A5048' }}>
          <div style={{ fontSize: 18, fontWeight: 500, marginBottom: 8 }}>Failed to load data</div>
          <div style={{ fontSize: 13, color: '#7A6E65' }}>{artistsError}</div>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: 16,
              padding: '10px 24px',
              fontSize: 14,
              fontFamily: '"DM Sans", sans-serif',
              fontWeight: 600,
              color: '#3E3530',
              backgroundColor: 'rgba(250, 243, 235, 0.95)',
              border: '1px solid rgba(168, 144, 128, 0.4)',
              borderRadius: 20,
              cursor: 'pointer',
              minHeight: 44,
            }}
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  const totalArtistCount = allArtists.length;

  return (
    <TotalArtistCountContext.Provider value={totalArtistCount}>
    <main style={{ width: '100vw', minHeight: '100vh', height: '100dvh', overflow: 'hidden' }}>
      <h1 style={{
        position: 'absolute',
        width: 1,
        height: 1,
        overflow: 'hidden',
        clip: 'rect(0,0,0,0)',
        whiteSpace: 'nowrap',
      }}>
        EMBRYO — Interactive Artist Map
      </h1>
      {/* Fix #57: Non-fatal warning banner when connections fail to load */}
      {connectionsError && !connectionsWarningDismissed && (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: 'fixed',
            top: 12,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 50,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 16px',
            fontSize: 13,
            fontFamily: '"DM Sans", sans-serif',
            fontWeight: 500,
            color: '#5A4030',
            backgroundColor: 'rgba(255, 243, 220, 0.95)',
            backdropFilter: 'blur(6px)',
            border: '1px solid rgba(200, 160, 100, 0.4)',
            borderRadius: 12,
            boxShadow: '0 2px 12px rgba(90, 80, 72, 0.12)',
            maxWidth: 'calc(100vw - 32px)',
          }}
        >
          <span>Connection data unavailable — showing artists only</span>
          <button
            onClick={() => setConnectionsWarningDismissed(true)}
            onFocus={(e) => { if (e.target.matches(':focus-visible')) e.target.style.boxShadow = '0 0 0 2px #B8336A'; }}
            onBlur={(e) => { e.target.style.boxShadow = 'none'; }}
            aria-label="Dismiss warning"
            style={{
              background: 'none',
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
              fontSize: 16,
              color: '#8A7050',
              padding: '2px 4px',
              minWidth: 44,
              minHeight: 44,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            ✕
          </button>
        </div>
      )}

      <Map
        mapRef={mapRef}
        artists={filteredArtists}
        connectionCounts={connectionsError ? new Map() : connectionCounts}
        connections={connectionsError ? [] : connections}
        connectionsByArtist={connectionsError ? new Map() : connectionsByArtist}
        activeConnectionTypes={activeConnectionTypes}
        rangeStart={timeline.rangeStart}
        rangeEnd={timeline.rangeEnd}
        hoveredArtist={hoveredArtist}
        selectedArtist={selectedArtist}
        onHover={handleHover}
        onHoverPosition={handleHoverPosition}
        onSelect={handleSelect}
        isPlaying={timeline.isPlaying}
        initialCenter={DEFAULT_CENTER}
        initialZoom={DEFAULT_ZOOM}
      />

      <HoverCard
        artist={hoveredArtist}
        position={hoverPosition}
        connectionCount={hoveredArtist ? (connectionCounts?.get?.(hoveredArtist.id) ?? 0) : 0}
        isMobile={isMobile}
      />

      <SearchBar
        artists={filteredArtists}
        allArtists={allArtists}
        onSelect={handleSelect}
        isMobile={isMobile}
        artistCount={allArtists.length}
        connectionCounts={connectionCounts}
      />

      {/* Reset view button — only visible when filters are non-default */}
      {/* Fix #9: Moved below ArtistCount to avoid overlap on notched devices */}
      {/* Fix #34: Added safe-area-inset-left for landscape notch */}
      {!isDefault && (
        <button
          onClick={handleReset}
          aria-label="Reset view to defaults"
          style={{
            position: 'fixed',
            top: 'calc(100px + env(safe-area-inset-top))',
            left: 'calc(16px + env(safe-area-inset-left))',
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

      <GenreLegend isMobile={isMobile} />

      {/* Journey button */}
      {journeyManifest.length > 0 && !activeJourney && (
        <button
          onClick={() => setShowJourneyPicker(true)}
          style={{
            position: 'fixed',
            top: 'calc(58px + env(safe-area-inset-top))',
            right: 'calc(16px + env(safe-area-inset-right))',
            zIndex: 15,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 14px',
            fontSize: 13,
            fontWeight: 600,
            fontFamily: '"DM Sans", sans-serif',
            color: '#5A5048',
            backgroundColor: 'rgba(250, 243, 235, 0.92)',
            backdropFilter: 'blur(6px)',
            border: '1px solid rgba(224, 216, 204, 0.7)',
            borderRadius: 20,
            boxShadow: '0 2px 10px rgba(90, 80, 72, 0.10)',
            cursor: 'pointer',
            minHeight: 44,
          }}
          aria-label="Open musical journeys"
        >
          Journeys
        </button>
      )}

      {/* Nearby artists panel — only at zoom >= 7 */}
      {nearbyActive && !activeJourney && !selectedArtist && (
        <NearbyArtists
          artists={viewportArtists}
          connectionCounts={connectionCounts}
          onSelect={handleSelect}
          isMobile={isMobile}
        />
      )}

      {/* Mobile: collapsible filters toggle */}
      {/* Fix #4/#5: Hide in constrained landscape to save vertical space */}
      {isMobile && !isLandscapeConstrained && (
        <button
          onClick={() => setFiltersExpanded(prev => !prev)}
          aria-expanded={filtersExpanded}
          style={{
            position: 'fixed',
            bottom: filtersExpanded ? `calc(${filterPanelHeight}px + env(safe-area-inset-bottom))` : `calc(56px + env(safe-area-inset-bottom))`,
            left: 12,
            zIndex: 18,
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            padding: '6px 12px',
            fontSize: 12,
            fontWeight: 600,
            fontFamily: '"DM Sans", sans-serif',
            color: filtersExpanded ? '#C4326B' : '#5A5048',
            backgroundColor: 'rgba(250, 243, 235, 0.92)',
            backdropFilter: 'blur(6px)',
            border: '1px solid rgba(224, 216, 204, 0.7)',
            borderRadius: 16,
            boxShadow: '0 2px 8px rgba(90, 80, 72, 0.10)',
            cursor: 'pointer',
            minHeight: 44,
            transition: 'bottom 0.2s ease, color 0.15s ease',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true">
            <rect x="1" y="2" width="12" height="1.5" rx="0.75" />
            <rect x="3" y="6" width="8" height="1.5" rx="0.75" />
            <rect x="5" y="10" width="4" height="1.5" rx="0.75" />
          </svg>
          Filters
          {filtersExpanded ? ' ▾' : ' ▸'}
        </button>
      )}

      {/* Filters — always visible on desktop, collapsible on mobile */}
      {/* Fix #4/#5: Hide filters entirely in constrained landscape */}
      {(!isMobile || filtersExpanded) && !isLandscapeConstrained && (
        <div id="filter-panels" ref={filterPanelRef} style={{
          maxHeight: 'clamp(120px, 25vh, 200px)',
          overflowY: 'auto',
        }}>
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
        </div>
      )}

      <Timeline
        artists={allArtists}
        rangeStart={timeline.rangeStart}
        rangeEnd={timeline.rangeEnd}
        onRangeChange={handleRangeChange}
        isPlaying={timeline.isPlaying}
        onPlayPause={handlePlayPause}
        isMobile={isMobile}
        initialMode={_initialHash._yearMode ? 'year' : 'range'}
      />

      <DetailPanel
        artist={selectedArtist}
        connections={selectedArtistConnections}
        allArtists={allArtists}
        onSelect={handleSelect}
        onClose={handleCloseDetail}
        onCompare={handleStartCompare}
        onSuggestionSubmitted={handleSuggestionSubmitted}
        isCompareArmed={isCompareArmed}
        comparePrimaryArtistId={comparisonPair[0]?.id ?? null}
        isMobile={isMobile}
      />

      <ComparisonView
        isOpen={isComparisonOpen && comparisonPair.length === 2}
        artists={comparisonPair}
        allArtists={allArtists}
        connectionsByArtist={connectionsByArtist}
        onClose={handleCloseComparison}
        onSelectArtist={handleSelectFromComparison}
        isMobile={isMobile}
      />

      {/* Fix #36: Empty state when filters yield 0 artists */}
      {!artistsLoading && allArtists.length > 0 && filteredArtists.length === 0 && (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 10,
            textAlign: 'center',
            fontFamily: '"DM Sans", sans-serif',
            backgroundColor: 'rgba(250, 243, 235, 0.95)',
            backdropFilter: 'blur(6px)',
            borderRadius: 16,
            padding: '20px 28px',
            border: '1px solid rgba(224, 216, 204, 0.7)',
            boxShadow: '0 4px 20px rgba(90, 80, 72, 0.12)',
            maxWidth: 'calc(100vw - 48px)',
          }}
        >
          <div style={{ fontSize: 15, fontWeight: 600, color: '#3E3530', marginBottom: 6 }}>
            No artists match current filters
          </div>
          <div style={{ fontSize: 13, color: '#7A6E65' }}>
            Try adjusting your genre selection or timeline range.
          </div>
        </div>
      )}

      {/* Fix #11, #16, #31: Toast notification */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: 'fixed',
            bottom: isMobile ? 'calc(80px + env(safe-area-inset-bottom))' : 80,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 50,
            fontFamily: '"DM Sans", sans-serif',
            fontSize: 13,
            fontWeight: 500,
            color: '#3E3530',
            backgroundColor: 'rgba(250, 243, 235, 0.95)',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(224, 216, 204, 0.7)',
            borderRadius: 12,
            padding: '8px 16px',
            boxShadow: '0 4px 16px rgba(90, 80, 72, 0.15)',
            whiteSpace: 'nowrap',
            maxWidth: 'calc(100vw - 32px)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            animation: 'embryo-toast-in 0.2s ease-out',
            pointerEvents: 'none',
          }}
        >
          {toast}
        </div>
      )}
      <style>{`
        @keyframes embryo-toast-in {
          from { opacity: 0; transform: translateX(-50%) translateY(8px); }
          to { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
      `}</style>

      {/* Journey Picker */}
      {showJourneyPicker && (
        <JourneyPicker
          journeys={journeyManifest}
          loading={journeysLoading}
          onSelect={handleStartJourney}
          onClose={() => setShowJourneyPicker(false)}
        />
      )}

      {/* Journey Player */}
      {activeJourney && (
        <JourneyPlayer
          journey={activeJourney}
          allArtists={allArtists}
          onNavigate={handleJourneyNavigate}
          onSelectArtist={handleJourneySelectArtist}
          onExit={handleExitJourney}
          isMobile={isMobile}
        />
      )}

      {/* Fix #1: Onboarding overlay for first-time users */}
      {showOnboarding && (
        <OnboardingOverlay onComplete={() => setShowOnboarding(false)} />
      )}
    </main>
    </TotalArtistCountContext.Provider>
  );
}
