import React, { useRef, useEffect, useCallback, useState, useMemo } from 'react';
import Supercluster from 'supercluster';
import { GENRE_BUCKETS, getGenreBucket } from '../utils/genres.js';
import {
  GENRE_COLORS,
  preRenderOrbTexture,
  createGrainTexture,
  drawArcParticle,
  drawArtistNode,
  drawCityGroup,
  hexToRgba,
} from '../utils/rendering.js';
import { buildCityGroups } from '../utils/cityGrouping.js';
import { buildHeatmapGrid } from '../utils/heatmap.js';

// Build a stable mapping from genre bucket color -> pre-rendered texture index
const BUCKET_COLORS = Object.values(GENRE_BUCKETS).map((b) => b.color);

// Zoom-based rendering mode thresholds
const ZOOM_CITY = 5;
const ZOOM_INDIVIDUAL = 9;

// Animation & rendering constants
const FADE_DURATION = 400;             // ms for opacity 0→1 or 1→0 transition
const CLUSTER_RADIUS_BASE = 20;        // cluster orb base radius (px)
const CLUSTER_RADIUS_MAX = 55;         // cluster orb max radius (px)
const ARTIST_RADIUS = 14;              // individual artist node radius (px)
const ARTIST_ACTIVE_SCALE = 1.5;       // scale for active artist in individual mode
const CLUSTER_ACTIVE_SCALE = 1.5;      // scale for active artist in cluster mode
const ANIMATION_CYCLE_MS = 3000;       // particle / pulse animation cycle period (ms)
const HIT_TEST_MIN_RADIUS = 22;        // minimum hit-test radius (44px touch target / 2)
const SUPERCLUSTER_RADIUS = 60;        // Supercluster clustering radius
const ARC_VIEWPORT_PAD = 100;          // arc viewport culling padding (px)
const COLOCATION_OFFSET_RADIUS = 0.0008; // co-location spiral offset (degrees)
const HEATMAP_FADE_IN_START = 4;
const HEATMAP_FULL_START = 5;
const HEATMAP_FADE_OUT_START = 6;
const HEATMAP_FADE_OUT_END = 7;

// AABB overlap helper — hoisted to module scope to avoid per-frame closure allocation
function overlaps(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

// Cluster tooltip helpers (Issue #35) — lightweight DOM tooltip for cluster hover
let _clusterTooltipEl = null;
function showClusterTooltip(mx, my, count, canvas) {
  if (!_clusterTooltipEl) {
    _clusterTooltipEl = document.createElement('div');
    _clusterTooltipEl.setAttribute('role', 'tooltip');
    Object.assign(_clusterTooltipEl.style, {
      position: 'absolute',
      pointerEvents: 'none',
      zIndex: '10',
      padding: '4px 10px',
      borderRadius: '6px',
      backgroundColor: 'rgba(44, 36, 32, 0.9)',
      color: '#FAF3EB',
      fontFamily: '"DM Sans", sans-serif',
      fontSize: '12px',
      fontWeight: '500',
      whiteSpace: 'nowrap',
      transform: 'translate(-50%, -100%)',
      marginTop: '-10px',
    });
    document.body.appendChild(_clusterTooltipEl);
  }
  const artistLabel = count === 1 ? 'artist' : 'artists';
  _clusterTooltipEl.textContent = `${count.toLocaleString()} ${artistLabel}`;
  // Position relative to viewport using canvas offset
  const rect = canvas?.getBoundingClientRect?.() || { left: 0, top: 0 };
  _clusterTooltipEl.style.left = (rect.left + mx) + 'px';
  _clusterTooltipEl.style.top = (rect.top + my - 8) + 'px';
  _clusterTooltipEl.style.display = 'block';
}
function hideClusterTooltip() {
  if (_clusterTooltipEl) {
    _clusterTooltipEl.style.display = 'none';
  }
}

export default function CanvasOverlay({
  mapRef,
  artists,
  connectionCounts,
  connectionsByArtist,
  activeConnectionTypes,
  hoveredArtist,
  selectedArtist,
  onHover,
  onHoverPosition,
  onSelect,
  isFinePointer = true,
}) {
  const canvasRef = useRef(null);

  // Pre-rendered textures — created once, never recreated
  const orbTexturesRef = useRef(null);
  const grainTextureRef = useRef(null);

  // posMap stored in ref so mousemove handler can access without stale closure
  const posMapRef = useRef(new Map());

  // Opacity fade map: Map<id, {opacity, target}>
  const opacityMapRef = useRef(new Map());

  // rAF handle ref so we can cancel and avoid duplicates
  const rafRef = useRef(null);
  // Timestamp of last rAF callback for delta-time lerp
  const lastRafTsRef = useRef(null);

  // Track whether an animation loop should be running
  const needsAnimRef = useRef(false);

  // Track whether the map is currently moving (pan/zoom/resize)
  const mapMovingRef = useRef(false);

  // Frame counter for periodic opacityMap cleanup
  const frameCountRef = useRef(0);

  // Prefers-reduced-motion
  const prefersReducedMotionRef = useRef(false);
  useEffect(() => {
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
    prefersReducedMotionRef.current = mql.matches;
    const handler = (e) => { prefersReducedMotionRef.current = e.matches; };
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  // Pre-composited grain canvas
  const grainFullRef = useRef(null);
  const grainSizeRef = useRef({ w: 0, h: 0 });

  // Focused artist index for keyboard navigation
  const focusedArtistIndexRef = useRef(-1);

  // Last input type for DPR-scaled hit radius
  const lastInputTypeRef = useRef('mouse');

  // Derived hit-test radius scaled by pointer type (coarse = 1.5x for touch targets)
  const hitRadius = HIT_TEST_MIN_RADIUS * (isFinePointer ? 1 : 1.5);
  const hitRadiusRef = useRef(hitRadius);
  useEffect(() => { hitRadiusRef.current = hitRadius; }, [hitRadius]);

  // Supercluster index ref
  const scIndexRef = useRef(null);

  // City groups ref (rebuilt when artists change)
  const cityGroupsRef = useRef(new Map());
  const heatmapCellsRef = useRef([]);
  const cityPosMapRef = useRef(new Map()); // projected city positions for hit testing
  const hoveredCityKeyRef = useRef(null);  // currently hovered city key for highlight
  const clusterColorCacheRef = useRef(new Map()); // cluster.id → texture index cache
  const clusterLabelCacheRef = useRef(new Map()); // cluster.id → sorted leaves cache

  // Current render mode for hit testing
  const renderModeRef = useRef('cluster');
  const [renderModeState, setRenderModeState] = useState('cluster');

  // Keyboard navigation announcement for cluster/city modes
  const [keyboardAnnouncement, setKeyboardAnnouncement] = useState('');

  // Display offsets for co-located artists
  const displayOffsetsRef = useRef(new Map());

  // Cached per-frame allocations (P1, P2, P3)
  const currentIdsRef = useRef(new Set());
  const posMapFrameRef = useRef(new Map());
  const sortedCityGroupsRef = useRef([]);

  // Individual alpha ref for hit-test guard (S2)
  const individualAlphaRef = useRef(0);

  // Store latest props in refs to avoid render/startRaf recreation
  const artistsRef = useRef(artists);
  const connectionCountsRef = useRef(connectionCounts);
  const connectionsByArtistRef = useRef(connectionsByArtist);
  const activeConnectionTypesRef = useRef(activeConnectionTypes);
  const hoveredArtistRef = useRef(hoveredArtist);
  const selectedArtistRef = useRef(selectedArtist);
  const onHoverRef = useRef(onHover);
  const onHoverPositionRef = useRef(onHoverPosition);
  const onSelectRef = useRef(onSelect);

  // Cached valid artists and lookup maps (rebuilt only when artists change)
  const validArtistsRef = useRef([]);
  // Pre-sorted by connection count (descending) — avoids O(n log n) per frame
  const presortedArtistsRef = useRef([]);
  const artistByIdRef = useRef(new Map());

  // Per-artist metadata cache: Map<id, { genreBucket, genreColor, pulseHash }>
  const artistMetaRef = useRef(new Map());

  // Track which connectionCounts was used for the last presorted array
  const lastSortedCountsRef = useRef(null);

  // Monotonic filter version to avoid redundant Supercluster/cityGroup rebuilds
  const filterVersionRef = useRef(0);
  const prevArtistsRef = useRef(null);

  // Debounce timer for the expensive Supercluster/cityGroup rebuild in Effect A (Issue #3)
  const spatialRebuildTimerRef = useRef(null);

  // Initialize textures once on mount
  useEffect(() => {
    orbTexturesRef.current = GENRE_COLORS.map((color) =>
      preRenderOrbTexture(color, 200)
    );
    grainTextureRef.current = createGrainTexture(512, 512);
  }, []);

  // -------------------------------------------------------------------
  // Core render function — depends only on mapRef (stable)
  // -------------------------------------------------------------------
  const render = useCallback((ts) => {
    const canvas = canvasRef.current;
    if (!canvas) return false;

    const map = mapRef.current?.getMap?.();
    if (!map) return false;

    const orbTextures = orbTexturesRef.current;
    const grainTexture = grainTextureRef.current;
    if (!orbTextures || !grainTexture) return false;

    // Read latest props from refs
    const connectionCounts = connectionCountsRef.current;
    const connectionsByArtist = connectionsByArtistRef.current;
    const activeConnectionTypes = activeConnectionTypesRef.current;
    const hoveredArtist = hoveredArtistRef.current;
    const selectedArtist = selectedArtistRef.current;

    const container = map.getContainer();
    const dpr = window.devicePixelRatio || 1;
    const cssWidth = container.clientWidth;
    const cssHeight = container.clientHeight;

    // Resize canvas if needed (physical pixels for crispness)
    // Round to avoid resize thrash on fractional DPR (1.25, 1.5, etc.)
    const physW = Math.round(cssWidth * dpr);
    const physH = Math.round(cssHeight * dpr);
    if (canvas.width !== physW || canvas.height !== physH) {
      canvas.width = physW;
      canvas.height = physH;
      canvas.style.width = cssWidth + 'px';
      canvas.style.height = cssHeight + 'px';
    }

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.scale(dpr, dpr);

    // Use cached valid artists from ref
    const validArtists = validArtistsRef.current;
    const artistMeta = artistMetaRef.current;
    const artistById = artistByIdRef.current;

    // Update opacity map
    const now = ts ?? performance.now();
    const dt = lastRafTsRef.current != null ? now - lastRafTsRef.current : 16;
    lastRafTsRef.current = now;
    const fadeStep = dt / FADE_DURATION;

    const opacityMap = opacityMapRef.current;
    const currentIds = currentIdsRef.current;

    // Mark targets
    for (const artist of validArtists) {
      if (!opacityMap.has(artist.id)) {
        opacityMap.set(artist.id, { opacity: 0, target: 1 });
      } else {
        opacityMap.get(artist.id).target = 1;
      }
    }
    for (const [id, entry] of opacityMap) {
      if (!currentIds.has(id)) {
        entry.target = 0;
      }
    }

    // Lerp and clean up
    const reducedMotion = prefersReducedMotionRef.current;
    let hasActiveTransitions = false;
    for (const [id, entry] of opacityMap) {
      if (entry.opacity !== entry.target) {
        if (reducedMotion) {
          // Instant opacity when reduced motion is active
          entry.opacity = entry.target;
        } else {
          const dir = entry.target > entry.opacity ? 1 : -1;
          entry.opacity = Math.max(0, Math.min(1, entry.opacity + dir * fadeStep));
          if (Math.abs(entry.opacity - entry.target) < 0.01) {
            entry.opacity = entry.target;
          }
        }
        if (entry.opacity !== entry.target) hasActiveTransitions = true;
      }
      if (entry.opacity === 0 && entry.target === 0) {
        opacityMap.delete(id);
      }
    }

    // Prune stale opacity entries to prevent memory growth
    if (opacityMap.size > validArtists.length * 2) {
      for (const [id, entry] of opacityMap) {
        if (entry.opacity === 0 && entry.target === 0) opacityMap.delete(id);
      }
    }

    // Aggressive sweep every 60 frames: remove entries not in current valid set
    frameCountRef.current += 1;
    if (frameCountRef.current % 60 === 0) {
      for (const id of opacityMap.keys()) {
        if (!currentIds.has(id)) {
          opacityMap.delete(id);
        }
      }
    }

    // Clear the map-moving flag after this frame; onMapEvent will re-set it if
    // another move event fires before the next rAF callback.
    const wasMapMoving = mapMovingRef.current;
    mapMovingRef.current = false;

    // Determine active interaction target
    const activeArtist = hoveredArtist || selectedArtist;

    // Viewport bounds for pre-culling (with ~10% padding)
    const mapBounds = map.getBounds();
    const sw = mapBounds.getSouthWest();
    const ne = mapBounds.getNorthEast();
    const latRange = ne.lat - sw.lat;
    const lngRange = ne.lng - sw.lng;
    const padLat = latRange * 0.1;
    const padLng = lngRange * 0.1;
    const cullSouth = sw.lat - padLat;
    const cullNorth = ne.lat + padLat;
    const cullWest = sw.lng - padLng;
    const cullEast = ne.lng + padLng;

    // Reuse posMap ref every frame — only project artists within viewport bounds (P2)
    posMapFrameRef.current.clear();
    const posMap = posMapFrameRef.current;
    const currentZoomForPos = map.getZoom();
    const offsets = displayOffsetsRef.current;
    for (const artist of validArtists) {
      // Pre-cull by geographic bounds before calling map.project()
      if (artist.birth_lat < cullSouth || artist.birth_lat > cullNorth ||
          artist.birth_lng < cullWest || artist.birth_lng > cullEast) {
        continue;
      }

      let lng = artist.birth_lng;
      let lat = artist.birth_lat;
      // Apply spiral offsets in individual mode to spread co-located artists
      // Scale offset with zoom so artists visually separate at any zoom level
      if (currentZoomForPos >= ZOOM_INDIVIDUAL && offsets.has(artist.id)) {
        const o = offsets.get(artist.id);
        const zoomScale = Math.max(0.5, (16 - currentZoomForPos) * 3);
        lng += o.dlng * zoomScale;
        lat += o.dlat * zoomScale;
      }
      const point = map.project([lng, lat]);
      posMap.set(artist.id, point);
    }
    // Ensure the selected/hovered artist is always in posMap (even if off-screen)
    // so their pill and arcs render correctly after flyTo or when panning away.
    if (activeArtist && activeArtist.birth_lng != null && activeArtist.birth_lat != null && !posMap.has(activeArtist.id)) {
      let lng = activeArtist.birth_lng;
      let lat = activeArtist.birth_lat;
      if (currentZoomForPos >= ZOOM_INDIVIDUAL && offsets.has(activeArtist.id)) {
        const o = offsets.get(activeArtist.id);
        const zoomScale = Math.max(0.5, (16 - currentZoomForPos) * 3);
        lng += o.dlng * zoomScale;
        lat += o.dlat * zoomScale;
      }
      posMap.set(activeArtist.id, map.project([lng, lat]));
    }

    // Snapshot the completed frame's positions into posMapRef so hit-testing
    // always sees the last *complete* frame, even while posMapFrameRef is being
    // cleared and rebuilt for the next frame (Issue #7).
    posMapRef.current = new Map(posMap);

    // --- Genre heatmap phase (mid zoom) ---
    // Draw behind cluster/city/individual layers using a cached density grid.
    let heatmapAlpha = 0;
    if (currentZoomForPos >= HEATMAP_FADE_IN_START && currentZoomForPos < HEATMAP_FADE_OUT_END) {
      if (currentZoomForPos < HEATMAP_FULL_START) {
        heatmapAlpha = (currentZoomForPos - HEATMAP_FADE_IN_START) / (HEATMAP_FULL_START - HEATMAP_FADE_IN_START);
      } else if (currentZoomForPos < HEATMAP_FADE_OUT_START) {
        heatmapAlpha = 1;
      } else {
        heatmapAlpha = 1 - ((currentZoomForPos - HEATMAP_FADE_OUT_START) / (HEATMAP_FADE_OUT_END - HEATMAP_FADE_OUT_START));
      }
    }
    if (heatmapAlpha > 0.01) {
      const heatmapCells = heatmapCellsRef.current;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (const cell of heatmapCells) {
        const pt = map.project([cell.lng, cell.lat]);
        const intensity = Math.max(0.2, Math.min(1, cell.normalizedIntensity || 0));
        const radius = 26 + Math.sqrt(cell.count) * 9;
        const outerRadius = radius * (1.2 + intensity * 1.5);
        if (
          pt.x < -outerRadius || pt.x > cssWidth + outerRadius ||
          pt.y < -outerRadius || pt.y > cssHeight + outerRadius
        ) {
          continue;
        }

        const grad = ctx.createRadialGradient(pt.x, pt.y, 0, pt.x, pt.y, outerRadius);
        grad.addColorStop(0, hexToRgba(cell.dominantColor, 0.26 * heatmapAlpha * intensity));
        grad.addColorStop(0.55, hexToRgba(cell.dominantColor, 0.14 * heatmapAlpha * intensity));
        grad.addColorStop(1, hexToRgba(cell.dominantColor, 0));
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, outerRadius, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // Build set of ids connected to hovered/selected artist using indexed lookup
    const connectedIds = new Set();
    const activeArtistConns = activeArtist && connectionsByArtist
      ? (connectionsByArtist.get(activeArtist.id) || [])
      : [];
    for (const conn of activeArtistConns) {
      if (conn.source_id === activeArtist.id) {
        connectedIds.add(conn.target_id);
      } else {
        connectedIds.add(conn.source_id);
      }
    }

    // --- Arc phase --- (only when hovered/selected)
    // Hard-reset canvas state to prevent leakage from prior operations
    ctx.globalAlpha = 1.0;
    ctx.globalCompositeOperation = 'source-over';
    ctx.setLineDash([]);

    // Track selected arcs for particle drawing
    const selectedArcs = [];

    // Cluster label density: count visible clusters for budget calculation
    const clusterLabelOccupied = [];
    let clusterLabelsShown = 0;
    let clusterLabelBudget = 0; // computed below after first pass

    if (
      activeArtist &&
      activeArtistConns.length > 0 &&
      activeConnectionTypes && activeConnectionTypes.size > 0
    ) {
      // Helper: project an artist into posMap if missing (off-screen connected artists)
      const projectIfMissing = (artist) => {
        if (posMap.has(artist.id)) return posMap.get(artist.id);
        if (artist.birth_lng == null || artist.birth_lat == null) return null;
        let lng = artist.birth_lng;
        let lat = artist.birth_lat;
        if (currentZoomForPos >= ZOOM_INDIVIDUAL && offsets.has(artist.id)) {
          const o = offsets.get(artist.id);
          const zoomScale = Math.max(0.5, (16 - currentZoomForPos) * 3);
          lng += o.dlng * zoomScale;
          lat += o.dlat * zoomScale;
        }
        const pos = map.project([lng, lat]);
        posMap.set(artist.id, pos);
        return pos;
      };

      // Sort by confidence descending and limit to top 15 to avoid starburst
      const MAX_VISIBLE_ARCS = 15;
      const sortedConns = [...activeArtistConns]
        .filter(c => activeConnectionTypes.has(c.type))
        .sort((a, b) => (b.confidence ?? 0.5) - (a.confidence ?? 0.5))
        .slice(0, MAX_VISIBLE_ARCS);

      for (const conn of sortedConns) {
        const { source_id, target_id, type, confidence } = conn;

        const srcArtist = artistByIdRef.current.get(source_id);
        const tgtArtist = artistByIdRef.current.get(target_id);
        if (!srcArtist || !tgtArtist) continue;
        const srcPos = projectIfMissing(srcArtist);
        const tgtPos = projectIfMissing(tgtArtist);
        if (!srcPos || !tgtPos) continue;

        // Arc viewport culling: skip arcs where BOTH endpoints are outside canvas
        const srcOutside = srcPos.x < -ARC_VIEWPORT_PAD || srcPos.x > cssWidth + ARC_VIEWPORT_PAD ||
                           srcPos.y < -ARC_VIEWPORT_PAD || srcPos.y > cssHeight + ARC_VIEWPORT_PAD;
        const tgtOutside = tgtPos.x < -ARC_VIEWPORT_PAD || tgtPos.x > cssWidth + ARC_VIEWPORT_PAD ||
                           tgtPos.y < -ARC_VIEWPORT_PAD || tgtPos.y > cssHeight + ARC_VIEWPORT_PAD;
        if (srcOutside && tgtOutside) continue;

        const srcMeta = artistMeta.get(srcArtist.id);
        const tgtMeta = artistMeta.get(tgtArtist.id);
        const srcColor = srcMeta?.genreColor ?? getGenreBucket(srcArtist?.genres).color;
        const tgtColor = tgtMeta?.genreColor ?? getGenreBucket(tgtArtist?.genres).color;

        drawArcBloomed(ctx, srcPos.x, srcPos.y, tgtPos.x, tgtPos.y, srcColor, tgtColor, type, confidence ?? 0.5);
        // Collect for particle rendering
        if (selectedArtist) {
          selectedArcs.push({ srcPos, tgtPos, srcColor });
        }
      }
    }

    // Connection particles for selected artist (skip when reduced motion)
    if (selectedArtist && selectedArcs.length > 0 && !reducedMotion) {
      const t0 = (performance.now() / ANIMATION_CYCLE_MS) % 1;
      for (let i = 0; i < selectedArcs.length; i++) {
        const arc = selectedArcs[i];
        const t = (t0 + i * (1 / selectedArcs.length)) % 1;
        drawArcParticle(ctx, arc.srcPos.x, arc.srcPos.y, arc.tgtPos.x, arc.tgtPos.y, arc.srcColor, t);
      }
    }

    // --- Three-tier zoom rendering ---
    const currentZoom = map.getZoom();
    const bounds = map.getBounds();
    const boundsArray = [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()];

    // Determine render mode from zoom
    let renderMode;
    if (currentZoom < ZOOM_CITY) {
      renderMode = 'cluster';
    } else if (currentZoom < ZOOM_INDIVIDUAL) {
      renderMode = 'city';
    } else {
      renderMode = 'individual';
    }
    renderModeRef.current = renderMode;
    if (renderMode !== renderModeRef._prev) {
      renderModeRef._prev = renderMode;
      setRenderModeState(renderMode);
      // Reset keyboard focus index when render mode changes
      focusedArtistIndexRef.current = -1;
    }

    // Cross-fade alphas (+-0.5 zoom units around boundaries)
    // reducedMotion: snap immediately, no cross-fade
    let clusterAlpha = 0;
    let cityAlpha = 0;
    let individualAlpha = 0;

    if (reducedMotion) {
      if (renderMode === 'cluster') clusterAlpha = 1;
      else if (renderMode === 'city') cityAlpha = 1;
      else individualAlpha = 1;
    } else {
      // Cluster <-> City cross-fade around ZOOM_CITY (4.5-5.5)
      if (currentZoom < ZOOM_CITY - 0.5) {
        clusterAlpha = 1;
      } else if (currentZoom < ZOOM_CITY + 0.5) {
        const t = (currentZoom - (ZOOM_CITY - 0.5));  // 0->1
        clusterAlpha = 1 - t;
        cityAlpha = 1 - clusterAlpha;
      } else if (currentZoom < ZOOM_INDIVIDUAL - 0.5) {
        cityAlpha = 1;
      } else if (currentZoom < ZOOM_INDIVIDUAL + 0.5) {
        // City <-> Individual cross-fade around ZOOM_INDIVIDUAL (8.5-9.5)
        const t = (currentZoom - (ZOOM_INDIVIDUAL - 0.5));  // 0->1
        cityAlpha = 1 - t;
        individualAlpha = 1 - cityAlpha;
      } else {
        individualAlpha = 1;
      }
    }

    // Store individualAlpha for hit-test guard (S2)
    individualAlphaRef.current = individualAlpha;

    // Decide whether to keep rAF running after this frame.
    // Only continue when something is visually animating — not for static hover/selection.
    const hasParticlesOrPulses = !reducedMotion && !!selectedArtist && selectedArcs.length > 0;
    const hasPulsingOrbs = !reducedMotion && clusterAlpha > 0 && !activeArtist;
    needsAnimRef.current = hasActiveTransitions || wasMapMoving ||
      hasParticlesOrPulses || hasPulsingOrbs;

    // --- Cluster phase --- hard-reset canvas state
    ctx.globalAlpha = 1.0;
    ctx.globalCompositeOperation = 'source-over';
    ctx.setLineDash([]);

    // --- Cluster mode rendering ---
    // Collect cluster positions/radii for pill collision avoidance
    const clusterPositions = [];

    if (clusterAlpha > 0) {
      const index = scIndexRef.current;
      if (index) {
        const zoom = Math.floor(currentZoom);
        const clusters = index.getClusters(boundsArray, zoom);

        for (const cluster of clusters) {
          const [lng, lat] = cluster.geometry.coordinates;
          const point = map.project([lng, lat]);
          const { x, y } = point;

          const maxRadius = 120;
          if (x < -maxRadius || x > cssWidth + maxRadius || y < -maxRadius || y > cssHeight + maxRadius) continue;

          if (cluster.properties.cluster) {
            const count = cluster.properties.point_count;
            const clusterRadius = Math.min(CLUSTER_RADIUS_BASE + Math.log2(count) * 7, CLUSTER_RADIUS_MAX);

            // Determine dominant genre color by sampling leaves (cached per cluster ID)
            const clusterColorCache = clusterColorCacheRef.current;
            let clusterTextureIdx = clusterColorCache.get(cluster.id);
            if (clusterTextureIdx == null) {
              clusterTextureIdx = Math.abs(cluster.id) % orbTextures.length; // fallback
              const sampleLeaves = index.getLeaves(cluster.id, 8);
              if (sampleLeaves.length > 0) {
                const colorCounts = {};
                for (const leaf of sampleLeaves) {
                  const meta = artistMeta.get(leaf.properties.artistId);
                  const gc = meta?.genreColor ?? getGenreBucket(leaf.properties.genres).color;
                  colorCounts[gc] = (colorCounts[gc] || 0) + 1;
                }
                let bestColor = null;
                let bestCount = 0;
                for (const [c, n] of Object.entries(colorCounts)) {
                  if (n > bestCount) { bestCount = n; bestColor = c; }
                }
                if (bestColor) {
                  const idx = BUCKET_COLORS.indexOf(bestColor);
                  if (idx >= 0) clusterTextureIdx = idx;
                }
              }
              clusterColorCache.set(cluster.id, clusterTextureIdx);
            }
            const orbTexture = orbTextures[clusterTextureIdx];
            ctx.globalAlpha = clusterAlpha;
            ctx.drawImage(orbTexture, x - clusterRadius, y - clusterRadius, clusterRadius * 2, clusterRadius * 2);
            ctx.globalAlpha = clusterAlpha;

            ctx.save();
            const countStr = count.toString();
            const isSmall = count < 5;
            const fontSize = isSmall ? 10 : Math.min(14, (8 + Math.log2(count)) | 0);

            // Count text with shadow + stroke for legibility at all alpha levels
            ctx.font = `600 ${fontSize}px "DM Sans", sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.shadowColor = 'rgba(0,0,0,0.6)';
            ctx.shadowBlur = 5;
            ctx.strokeStyle = 'rgba(0,0,0,0.35)';
            ctx.lineWidth = 2.5;
            ctx.strokeText(countStr, x, y);
            ctx.fillStyle = '#FAF3EB';
            ctx.fillText(countStr, x, y);
            ctx.shadowBlur = 0;

            // Draw top artist names below count — density-aware with collision detection
            // Compute budget on first qualifying cluster (lazy init)
            if (clusterLabelBudget === 0) {
              // Count total visible clusters for budget
              let visibleClusters = 0;
              for (const c of clusters) {
                if (!c.properties.cluster) continue;
                const [cLng, cLat] = c.geometry.coordinates;
                const cPt = map.project([cLng, cLat]);
                if (cPt.x >= -120 && cPt.x <= cssWidth + 120 && cPt.y >= -120 && cPt.y <= cssHeight + 120) visibleClusters++;
              }
              if (visibleClusters <= 10) clusterLabelBudget = 8;
              else if (visibleClusters <= 30) clusterLabelBudget = 5;
              else if (visibleClusters <= 60) clusterLabelBudget = 3;
              else clusterLabelBudget = 0; // too dense, no labels
            }
            if (clusterRadius >= 45 && clusterLabelsShown < clusterLabelBudget) {
              let leaves = clusterLabelCacheRef.current.get(cluster.id);
              if (!leaves) {
                leaves = index.getLeaves(cluster.id, 10);
                leaves.sort((a, b) => {
                  const cA = (connectionCounts && connectionCounts.get(a.properties.artistId)) || 0;
                  const cB = (connectionCounts && connectionCounts.get(b.properties.artistId)) || 0;
                  return cB - cA;
                });
                clusterLabelCacheRef.current.set(cluster.id, leaves);
              }
              if (leaves.length > 0) {
                const topN = count >= 20 ? 3 : 2;
                const topNames = [];
                for (let i = 0; i < Math.min(topN, leaves.length); i++) {
                  const leaf = leaves[i];
                  const a = artistById.get(leaf.properties.artistId);
                  if (a) {
                    const n = a.name.length > 15 ? a.name.slice(0, 14) + '\u2026' : a.name;
                    topNames.push(n);
                  }
                }
                if (topNames.length > 0) {
                  const namesStr = topNames.join(', ');
                  ctx.font = '500 10px "DM Sans", sans-serif';
                  const namesW = ctx.measureText(namesStr).width;
                  // Collision check via AABB
                  const labelRect = { x: x - namesW / 2 - 4, y: y + fontSize / 2 + 1, w: namesW + 8, h: 28 };
                  let blocked = false;
                  for (const occ of clusterLabelOccupied) {
                    if (overlaps(labelRect, occ)) { blocked = true; break; }
                  }
                  if (!blocked) {
                    clusterLabelOccupied.push(labelRect);
                    clusterLabelsShown++;

                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'top';
                    ctx.shadowColor = 'rgba(0,0,0,0.6)';
                    ctx.shadowBlur = 4;
                    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
                    ctx.lineWidth = 2;
                    ctx.strokeText(namesStr, x, y + fontSize / 2 + 3);
                    ctx.fillStyle = 'rgba(250,243,235,0.85)';
                    ctx.fillText(namesStr, x, y + fontSize / 2 + 3);

                    // "+N more" only for large clusters
                    const remaining = count - topNames.length;
                    if (remaining > 5) {
                      const moreStr = `+${remaining} more`;
                      ctx.font = '400 9px "DM Sans", sans-serif';
                      ctx.strokeText(moreStr, x, y + fontSize / 2 + 16);
                      ctx.fillStyle = 'rgba(250,243,235,0.6)';
                      ctx.fillText(moreStr, x, y + fontSize / 2 + 16);
                    }
                    ctx.shadowBlur = 0;
                  }
                }
              }
            }
            ctx.restore();

            // Track cluster position for pill collision
            clusterPositions.push({ x, y, radius: clusterRadius });
          } else {
            const artistId = cluster.properties.artistId;
            const artistData = artistById.get(artistId);
            if (!artistData) continue;

            const opacity = opacityMap.get(artistId)?.opacity ?? 1;
            if (opacity <= 0) continue;

            const connCount = (connectionCounts && connectionCounts.get(artistData.id)) || 0;
            const scaleFactor = validArtists.length > 200 ? 0.5 : 1;
            const baseRadius = (CLUSTER_RADIUS_BASE + Math.min(connCount * 3, 60)) * scaleFactor;

            const isActive = activeArtist && artistData.id === activeArtist.id;
            const isConnected = connectedIds.has(artistId);
            const isPassive = activeArtist && !isActive && !isConnected;

            const meta = artistMeta.get(artistId);
            const genreColor = meta?.genreColor ?? getGenreBucket(artistData.genres).color;
            const textureIndex = BUCKET_COLORS.indexOf(genreColor);
            const orbTexture =
              textureIndex >= 0 && textureIndex < orbTextures.length
                ? orbTextures[textureIndex]
                : orbTextures[orbTextures.length - 1];

            let radius = isActive ? baseRadius * CLUSTER_ACTIVE_SCALE : baseRadius;
            if (!isActive && !isConnected && !hasActiveTransitions) {
              let pulseFactor = 1;
              if (!reducedMotion) {
                const hash = meta?.pulseHash ?? 0;
                const phase = ((performance.now() / ANIMATION_CYCLE_MS) + hash * 0.1) % 1;
                pulseFactor = 1 + 0.05 * Math.sin(phase * Math.PI * 2);
              }
              radius *= pulseFactor;
            }

            const baseAlpha = isPassive ? 0.4 : 1.0;
            ctx.globalAlpha = baseAlpha * opacity * clusterAlpha;
            ctx.drawImage(orbTexture, x - radius, y - radius, radius * 2, radius * 2);

            // Track individual-in-cluster position for pill collision
            clusterPositions.push({ x, y, radius });
          }
        }
      }
      ctx.globalAlpha = 1.0;
    }

    // --- City phase --- hard-reset canvas state
    ctx.globalAlpha = 1.0;
    ctx.globalCompositeOperation = 'source-over';
    ctx.setLineDash([]);

    // --- City mode rendering ---
    // Fix #35: reuse ref-backed Map to avoid per-frame GC allocation
    cityPosMapRef.current.clear();
    const cityPosMap = cityPosMapRef.current;
    if (cityAlpha > 0) {
      // Use pre-sorted city groups from Effect A (P3: avoid per-frame sort)
      const sortedCityEntries = sortedCityGroupsRef.current;

      // Project all city groups once and count visible cities for density budget
      const cityProjections = new Map();
      let citiesInViewport = 0;
      for (const [key, group] of sortedCityEntries) {
        const pt = map.project([group.lng, group.lat]);
        cityProjections.set(key, pt);
        const r = Math.max(30, Math.sqrt(group.artists.length) * 12);
        if (pt.x >= -r && pt.x <= cssWidth + r && pt.y >= -r && pt.y <= cssHeight + r) {
          citiesInViewport++;
        }
      }
      let cityLabelBudget;
      if (citiesInViewport <= 15) cityLabelBudget = Infinity;
      else if (citiesInViewport <= 40) cityLabelBudget = 20;
      else if (citiesInViewport <= 80) cityLabelBudget = 12;
      else cityLabelBudget = 8;
      let cityLabelsShown = 0;

      const cityOccupiedRects = [];

      for (const [key, group] of sortedCityEntries) {
        const point = cityProjections.get(key);
        const { x, y } = point;

        const cityRadius = Math.max(30, Math.sqrt(group.artists.length) * 12);
        // Viewport cull
        if (x < -cityRadius || x > cssWidth + cityRadius || y < -cityRadius || y > cssHeight + cityRadius) continue;

        cityPosMap.set(key, { x, y, radius: cityRadius, group });

        // Collision detection for city labels — include count text in width
        // Also suppress label once density budget is reached
        let showLabel = cityLabelsShown < cityLabelBudget;
        ctx.font = '600 13px "DM Sans", sans-serif';
        const cityNameW = ctx.measureText(group.city).width;
        ctx.font = '400 11px "DM Sans", sans-serif';
        const countStrW = ctx.measureText(` (${group.artists.length})`).width;
        const labelW = cityNameW + countStrW;
        const textHeight = 16;
        const labelRect = {
          x: x - labelW / 2 - 4,
          y: y - cityRadius - 6 - textHeight,
          w: labelW + 8,
          h: textHeight,
        };

        // Only run collision check if budget still allows a label
        if (showLabel) {
          for (const occ of cityOccupiedRects) {
            if (overlaps(labelRect, occ)) {
              showLabel = false;
              break;
            }
          }
        }
        if (showLabel) {
          cityOccupiedRects.push(labelRect);
          cityLabelsShown++;
        }

        // Text backplate for city label readability over map texture
        // Drawn here (before drawCityGroup) so it sits beneath the text layer.
        if (showLabel) {
          ctx.save();
          ctx.globalAlpha = cityAlpha * 0.82;
          ctx.fillStyle = 'rgba(250, 243, 235, 0.8)';
          const bpPad = 3;
          ctx.beginPath();
          ctx.roundRect(
            labelRect.x - bpPad,
            labelRect.y - bpPad,
            labelRect.w + bpPad * 2,
            labelRect.h + bpPad * 2,
            3
          );
          ctx.fill();
          ctx.restore();
        }

        // City hover highlight ring
        if (key === hoveredCityKeyRef.current) {
          ctx.save();
          ctx.globalAlpha = cityAlpha;
          ctx.beginPath();
          ctx.arc(x, y, cityRadius + 3, 0, Math.PI * 2);
          ctx.strokeStyle = 'rgba(250, 243, 235, 0.6)';
          ctx.lineWidth = 2;
          ctx.stroke();
          ctx.restore();
        }

        // Compute dominant genre color for this city group
        const genreCounts = {};
        for (const a of group.artists) {
          const meta = artistMeta.get(a.id);
          const gc = meta?.genreColor ?? getGenreBucket(a.genres).color;
          genreCounts[gc] = (genreCounts[gc] || 0) + 1;
        }
        let dominantColor = null;
        let maxCount = 0;
        for (const [color, cnt] of Object.entries(genreCounts)) {
          if (cnt > maxCount) { maxCount = cnt; dominantColor = color; }
        }

        drawCityGroup(ctx, x, y, showLabel ? group.city : null, group.artists.length, cityRadius, cityAlpha, dominantColor);
      }
    }
    // --- Individual phase --- hard-reset canvas state
    ctx.globalAlpha = 1.0;
    ctx.globalCompositeOperation = 'source-over';
    ctx.setLineDash([]);

    // --- Individual mode rendering ---
    if (individualAlpha > 0) {
      // Only partition artists that are visible in the viewport (posMap already
      // contains only projected positions for artists within geographic bounds).
      const preSorted = presortedArtistsRef.current;
      const activeArr = [];
      const connArr = [];
      const restArr = [];
      for (const a of preSorted) {
        if (!posMap.has(a.id)) continue; // skip off-screen artists
        if (activeArtist && a.id === activeArtist.id) activeArr.push(a);
        else if (connectedIds.has(a.id)) connArr.push(a);
        else restArr.push(a);
      }
      const sortedArtists = restArr.concat(connArr, activeArr);

      // Density-aware label suppression: use sortedArtists length directly
      // since it already contains only viewport-visible artists
      const visibleCount = sortedArtists.length;
      // Determine max labels based on density
      let maxLabels;
      if (visibleCount <= 30) maxLabels = Infinity;
      else if (visibleCount <= 100) maxLabels = 30;
      else if (visibleCount <= 300) maxLabels = 20;
      else maxLabels = 10;
      let labelsShown = 0;

      // Label collision detection — occupied rects for AABB test
      const occupiedRects = [];

      for (const artist of sortedArtists) {
        const point = posMap.get(artist.id);
        if (!point) continue;

        // Viewport cull
        const margin = 60;
        if (point.x < -margin || point.x > cssWidth + margin || point.y < -margin || point.y > cssHeight + margin) continue;

        const opacity = opacityMap.get(artist.id)?.opacity ?? 1;
        if (opacity <= 0) continue;

        const meta = artistMeta.get(artist.id);
        const genreColor = meta?.genreColor ?? getGenreBucket(artist.genres).color;

        const isActive = activeArtist && artist.id === activeArtist.id;
        const isConnected = connectedIds.has(artist.id);
        const isPassive = activeArtist && !isActive && !isConnected;

        let state = 'default';
        if (isActive) state = 'active';
        else if (activeArtist && isConnected) state = 'connected';
        else if (isPassive) state = 'dimmed';

        // Format years: "1756-1791" or "1985-" (en-dash)
        let years = '';
        if (artist.birth_year) {
          years = artist.death_year
            ? `${artist.birth_year}\u2013${artist.death_year}`
            : `${artist.birth_year}\u2013`;
        }

        const connCount = (connectionCounts && connectionCounts.get(artist.id)) || 0;
        const prominenceScale = Math.min(1 + Math.log2(Math.max(connCount, 1)) * 0.08, 1.8);
        const r = ARTIST_RADIUS * (state === 'active' ? ARTIST_ACTIVE_SCALE : prominenceScale);

        // Always show labels for hovered/active/connected; collision-check the rest
        const isProminent = connCount >= 30; // Top ~200 artists globally
        const isImportant = isActive || isConnected || isProminent;
        // Hide canvas label only when artist is being hovered (pill shows near cursor).
        // Keep label visible for selected-but-not-hovered artists so they're findable on map.
        const isBeingHovered = hoveredArtist && artist.id === hoveredArtist.id;
        let showLabel = !isBeingHovered;
        let labelOffset = 0; // vertical offset for collision-adjusted important labels (S1)

        if (!isImportant) {
          // Density-aware suppression: skip labels once cap reached
          if (labelsShown >= maxLabels) {
            showLabel = false;
          } else {
            // Compute label bounding boxes
            const displayName = artist.name.length > 20 ? artist.name.slice(0, 19) + '\u2026' : artist.name;
            ctx.font = '600 12px "DM Sans", sans-serif';
            const nameW = ctx.measureText(displayName).width;
            ctx.font = '400 10px "DM Sans", sans-serif';
            const yearsW = years ? ctx.measureText(years).width : 0;

            const nameRect = { x: point.x - nameW / 2 - 4, y: point.y + r + 2, w: nameW + 8, h: 16 };
            const yearsRect = years
              ? { x: point.x - yearsW / 2 - 4, y: point.y + r + 18, w: yearsW + 8, h: 14 }
              : null;

            // AABB overlap test
            let hasOverlap = false;
            for (const occ of occupiedRects) {
              if (overlaps(nameRect, occ) || (yearsRect && overlaps(yearsRect, occ))) {
                hasOverlap = true;
                break;
              }
            }

            if (hasOverlap) {
              showLabel = false;
            } else {
              occupiedRects.push(nameRect);
              if (yearsRect) occupiedRects.push(yearsRect);
              labelsShown++;
            }
          }
        } else {
          // Important artists: still draw labels, but check collision against each other (S1)
          const displayName = artist.name.length > 20 ? artist.name.slice(0, 19) + '\u2026' : artist.name;
          ctx.font = '600 12px "DM Sans", sans-serif';
          const nameW = ctx.measureText(displayName).width;
          ctx.font = '400 10px "DM Sans", sans-serif';
          const yearsW = years ? ctx.measureText(years).width : 0;

          let nameRect = { x: point.x - nameW / 2 - 4, y: point.y + r + 2, w: nameW + 8, h: 16 };
          let yearsRect = (years && yearsW > 0)
            ? { x: point.x - yearsW / 2 - 4, y: point.y + r + 18, w: yearsW + 8, h: 14 }
            : null;

          // Check collision against existing occupied rects; offset vertically if needed
          let collides = true;
          const maxAttempts = 4;
          for (let attempt = 0; attempt < maxAttempts && collides; attempt++) {
            collides = false;
            for (const occ of occupiedRects) {
              if (overlaps(nameRect, occ) || (yearsRect && overlaps(yearsRect, occ))) {
                collides = true;
                break;
              }
            }
            if (collides) {
              labelOffset += 20; // label height (16) + 4px gap
              nameRect = { x: point.x - nameW / 2 - 4, y: point.y + r + 2 + labelOffset, w: nameW + 8, h: 16 };
              yearsRect = (years && yearsW > 0)
                ? { x: point.x - yearsW / 2 - 4, y: point.y + r + 18 + labelOffset, w: yearsW + 8, h: 14 }
                : null;
            }
          }

          occupiedRects.push(nameRect);
          if (yearsRect) occupiedRects.push(yearsRect);
        }

        // Selected artist: draw pulsing glow ring for clear visual distinction
        const isSelected = selectedArtist && artist.id === selectedArtist.id;
        if (isSelected && !reducedMotion) {
          const pulseT = (performance.now() / 1200) % 1; // 1.2s cycle
          const pulseScale = 1 + 0.3 * Math.sin(pulseT * Math.PI * 2);
          const glowR = r * 1.8 * pulseScale;
          const glowAlpha = 0.25 + 0.15 * Math.sin(pulseT * Math.PI * 2);
          ctx.save();
          ctx.globalAlpha = opacity * individualAlpha * glowAlpha;
          ctx.beginPath();
          ctx.arc(point.x, point.y, glowR, 0, Math.PI * 2);
          ctx.fillStyle = genreColor;
          ctx.fill();
          ctx.restore();

          // Outer ring
          ctx.save();
          ctx.globalAlpha = opacity * individualAlpha * 0.8;
          ctx.beginPath();
          ctx.arc(point.x, point.y, r * 1.6, 0, Math.PI * 2);
          ctx.lineWidth = 2.5;
          ctx.strokeStyle = genreColor;
          ctx.stroke();
          ctx.restore();
        } else if (isSelected && reducedMotion) {
          // Static ring for reduced motion
          ctx.save();
          ctx.globalAlpha = opacity * individualAlpha * 0.35;
          ctx.beginPath();
          ctx.arc(point.x, point.y, r * 1.8, 0, Math.PI * 2);
          ctx.fillStyle = genreColor;
          ctx.fill();
          ctx.restore();

          ctx.save();
          ctx.globalAlpha = opacity * individualAlpha * 0.8;
          ctx.beginPath();
          ctx.arc(point.x, point.y, r * 1.6, 0, Math.PI * 2);
          ctx.lineWidth = 2.5;
          ctx.strokeStyle = genreColor;
          ctx.stroke();
          ctx.restore();
        }

        drawArtistNode(ctx, point.x, point.y, ARTIST_RADIUS, genreColor, artist.name, years, state, opacity * individualAlpha, showLabel, labelOffset);
      }
    }

    // Keep animation running when a selected artist needs pulsing glow
    if (!reducedMotion && selectedArtist && individualAlpha > 0) {
      needsAnimRef.current = true;
    }

    ctx.globalAlpha = 1.0;

    // --- Label phase --- hard-reset canvas state
    ctx.globalAlpha = 1.0;
    ctx.globalCompositeOperation = 'source-over';
    ctx.setLineDash([]);

    if (activeArtist) {
      const pos = posMapRef.current?.get(activeArtist.id);
      if (pos) {
        const connCount = (connectionCounts && connectionCounts.get(activeArtist.id)) || 0;
        const isIndividual = renderModeRef.current === 'individual';
        const baseRadius = isIndividual ? ARTIST_RADIUS : CLUSTER_RADIUS_BASE + Math.min(connCount * 3, 60);
        const radius = baseRadius * (isIndividual ? ARTIST_ACTIVE_SCALE : CLUSTER_ACTIVE_SCALE);

        const meta = artistMeta.get(activeArtist.id);
        const bucket = meta?.genreBucket ?? getGenreBucket(activeArtist.genres).bucket;
        const color = meta?.genreColor ?? getGenreBucket(activeArtist.genres).color;
        const label = activeArtist.name;
        const sublabel = `${bucket} · ${activeArtist.birth_city || 'Unknown'}`;

        ctx.font = '600 14px "DM Sans", sans-serif';
        const labelW = ctx.measureText(label).width;
        ctx.font = '400 11px "DM Sans", sans-serif';
        const sublabelW = ctx.measureText(sublabel).width;
        const maxW = Math.max(labelW, sublabelW);
        const pillPad = 10;
        const pillH = 50;
        const pillW = maxW + pillPad * 2;

        // --- Pill collision avoidance ---
        // AABB overlap check between pill rect and a circle's bounding box
        const pillOverlapsCircle = (px, py, cx, cy, cr) =>
          px < cx + cr && px + pillW > cx - cr && py < cy + cr && py + pillH > cy - cr;

        // Check pill rect against all cluster and city positions
        const pillCollidesAny = (px, py) => {
          for (const cp of clusterPositions) {
            if (pillOverlapsCircle(px, py, cp.x, cp.y, cp.radius)) return true;
          }
          for (const [, cp] of cityPosMap) {
            if (pillOverlapsCircle(px, py, cp.x, cp.y, cp.radius)) return true;
          }
          return false;
        };

        // Try positions: above, below, left, right; fallback to above
        const aboveX = pos.x - maxW / 2 - pillPad;
        const aboveY = pos.y - radius - 52;
        const belowY = pos.y + radius + 12;
        const leftX = pos.x - pillW - radius;
        const leftY = pos.y - pillH / 2;
        const rightX = pos.x + radius + pillPad;
        const rightY = pos.y - pillH / 2;

        let pillX = aboveX;
        let pillY = aboveY;

        if (pillY < 10 || pillCollidesAny(pillX, pillY)) {
          // Try below
          if (!pillCollidesAny(aboveX, belowY) && belowY + pillH < cssHeight - 10) {
            pillX = aboveX;
            pillY = belowY;
          }
          // Try left
          else if (!pillCollidesAny(leftX, leftY) && leftX > 0) {
            pillX = leftX;
            pillY = leftY;
          }
          // Try right
          else if (!pillCollidesAny(rightX, rightY) && rightX + pillW < cssWidth) {
            pillX = rightX;
            pillY = rightY;
          }
          // else keep original above position
          else {
            pillX = aboveX;
            pillY = aboveY < 10 ? belowY : aboveY;
          }
        }

        // Clamp pill horizontally to viewport edges (prevents left/right clipping)
        pillX = Math.max(10, Math.min(pillX, cssWidth - pillW - 10));

        ctx.fillStyle = 'rgba(250, 243, 235, 0.92)';
        ctx.beginPath();
        const pr = 8;
        ctx.moveTo(pillX + pr, pillY);
        ctx.lineTo(pillX + pillW - pr, pillY);
        ctx.quadraticCurveTo(pillX + pillW, pillY, pillX + pillW, pillY + pr);
        ctx.lineTo(pillX + pillW, pillY + pillH - pr);
        ctx.quadraticCurveTo(pillX + pillW, pillY + pillH, pillX + pillW - pr, pillY + pillH);
        ctx.lineTo(pillX + pr, pillY + pillH);
        ctx.quadraticCurveTo(pillX, pillY + pillH, pillX, pillY + pillH - pr);
        ctx.lineTo(pillX, pillY + pr);
        ctx.quadraticCurveTo(pillX, pillY, pillX + pr, pillY);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = color;
        ctx.fillRect(pillX + pr, pillY, pillW - pr * 2, 3);

        ctx.font = '600 14px "DM Sans", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#3E3530';
        ctx.fillText(label, pos.x, pillY + 20);

        ctx.font = '400 11px "DM Sans", sans-serif';
        ctx.fillStyle = '#6B5F55';
        ctx.fillText(sublabel, pos.x, pillY + 36);
      }
    }

    // --- Grain phase --- hard-reset canvas state
    ctx.globalAlpha = 1.0;
    ctx.globalCompositeOperation = 'source-over';
    ctx.setLineDash([]);

    if (grainSizeRef.current.w !== cssWidth || grainSizeRef.current.h !== cssHeight) {
      // Release old grain buffer so GC can collect it before allocating a new one
      grainFullRef.current = null;
      const grainFull = document.createElement('canvas');
      grainFull.width = cssWidth * dpr;
      grainFull.height = cssHeight * dpr;
      const gCtx = grainFull.getContext('2d');
      gCtx.scale(dpr, dpr);
      const gw = grainTextureRef.current.width;
      const gh = grainTextureRef.current.height;
      for (let gx = 0; gx < cssWidth; gx += gw) {
        for (let gy = 0; gy < cssHeight; gy += gh) {
          gCtx.drawImage(grainTextureRef.current, gx, gy);
        }
      }
      grainFullRef.current = grainFull;
      grainSizeRef.current = { w: cssWidth, h: cssHeight };
    }
    if (grainFullRef.current) {
      ctx.drawImage(grainFullRef.current, 0, 0, cssWidth, cssHeight);
    }

    ctx.restore();
    return true;
  }, [mapRef]);

  // -------------------------------------------------------------------
  // rAF loop management — runs when transitions or interaction is active
  // -------------------------------------------------------------------
  const startRaf = useCallback(() => {
    if (rafRef.current != null) return; // already running

    const loop = (ts) => {
      const didRender = render(ts);
      // If render bailed early (missing textures/map), retry next frame.
      // Otherwise, only continue if something is actively animating.
      if (didRender === false || needsAnimRef.current) {
        rafRef.current = requestAnimationFrame(loop);
      } else {
        rafRef.current = null;
        lastRafTsRef.current = null;
      }
    };

    rafRef.current = requestAnimationFrame(loop);
  }, [render]);

  // -------------------------------------------------------------------
  // Effect A: Rebuild derived data structures when artists change
  //
  // Split into two parts to avoid jank during rapid timeline drags (Issue #3):
  //   IMMEDIATE: cheap ref updates + startRaf so the canvas keeps rendering.
  //   DEBOUNCED (150ms): expensive Supercluster load, city group rebuild, and
  //     co-location offset computation. Stale spatial data for ≤150ms is
  //     visually acceptable during a drag gesture.
  // -------------------------------------------------------------------
  useEffect(() => {
    artistsRef.current = artists;

    // --- IMMEDIATE PART ---

    // Cache valid artists (those with coordinates)
    const valid = (artists || []).filter(a => a.birth_lat != null && a.birth_lng != null);
    validArtistsRef.current = valid;

    // Precompute heatmap density grid once per filtered artist set.
    // Mid-zoom rendering reuses this cached structure each frame.
    heatmapCellsRef.current = buildHeatmapGrid(valid, 2.2);

    // Rebuild cached currentIds set (P1: avoid per-frame allocation)
    currentIdsRef.current = new Set(valid.map(a => a.id));

    // Build O(1) lookup map
    const byId = new Map();
    for (const artist of valid) {
      byId.set(artist.id, artist);
    }
    artistByIdRef.current = byId;

    // Increment filter version whenever the artists array reference changes,
    // ensuring spatial index rebuilds even when artists are added/removed in the middle.
    const sigChanged = artists !== prevArtistsRef.current;
    if (sigChanged) {
      filterVersionRef.current += 1;
      prevArtistsRef.current = artists;
    }

    // Pre-sort valid artists by connection count (descending) once, not per frame.
    // Always rebuild — depends on connectionCounts which may change independently.
    const cc = connectionCountsRef.current;
    const sorted = [...valid].sort((a, b) => {
      const aCount = (cc && cc.get(a.id)) || 0;
      const bCount = (cc && cc.get(b.id)) || 0;
      return bCount - aCount;
    });
    presortedArtistsRef.current = sorted;
    lastSortedCountsRef.current = cc;

    // Precompute per-artist metadata (genre bucket, color, pulse hash)
    const newMeta = new Map();
    for (const artist of valid) {
      const { bucket: genreBucket, color: genreColor } = getGenreBucket(artist.genres);
      const pulseHash = artist.name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
      newMeta.set(artist.id, { genreBucket, genreColor, pulseHash });
    }
    artistMetaRef.current = newMeta;

    // Reset focused artist index
    focusedArtistIndexRef.current = -1;

    // Kick off the animation loop immediately with the cheap updates applied.
    needsAnimRef.current = true;
    startRaf();

    // --- DEBOUNCED PART (150ms) ---
    // Supercluster load, city group rebuild, and co-location offset computation
    // are O(n log n) / O(n) and take 50-100ms on large datasets. Defer them so
    // rapid timeline drag frames (~30/s) don't each pay this cost.
    if (spatialRebuildTimerRef.current != null) {
      clearTimeout(spatialRebuildTimerRef.current);
    }

    // Only schedule the expensive rebuild when the filtered set actually changed.
    if (sigChanged) {
      spatialRebuildTimerRef.current = setTimeout(() => {
        spatialRebuildTimerRef.current = null;

        const currentValid = validArtistsRef.current;

        // Rebuild city groups
        cityGroupsRef.current = buildCityGroups(currentValid);

        // Pre-sort city groups by artist count descending (P3: avoid per-frame sort)
        sortedCityGroupsRef.current = [...cityGroupsRef.current.entries()].sort(
          (a, b) => b[1].artists.length - a[1].artists.length
        );

        // Rebuild Supercluster index
        const index = new Supercluster({ radius: SUPERCLUSTER_RADIUS, maxZoom: 20 });
        index.load(
          currentValid.map((a) => ({
            type: 'Feature',
            properties: { artistId: a.id, name: a.name, genres: a.genres },
            geometry: { type: 'Point', coordinates: [a.birth_lng, a.birth_lat] },
          }))
        );
        scIndexRef.current = index;
        clusterColorCacheRef.current = new Map(); // clear stale cluster color cache
        clusterLabelCacheRef.current.clear(); // clear stale cluster label cache

        // Build display offsets for co-located artists
        const coordGroups = new Map();
        for (const artist of currentValid) {
          const key = Math.round(artist.birth_lat * 100) + ',' + Math.round(artist.birth_lng * 100);
          if (!coordGroups.has(key)) coordGroups.set(key, []);
          coordGroups.get(key).push(artist);
        }
        const newOffsets = new Map();
        for (const [, group] of coordGroups) {
          if (group.length < 2) continue;
          const count = group.length;
          for (let i = 0; i < count; i++) {
            if (i === 0) {
              newOffsets.set(group[i].id, { dlat: 0, dlng: 0 });
            } else {
              const angle = i * (2 * Math.PI / count);
              const radius = COLOCATION_OFFSET_RADIUS * Math.ceil(i / 6);
              newOffsets.set(group[i].id, { dlat: Math.sin(angle) * radius, dlng: Math.cos(angle) * radius });
            }
          }
        }
        displayOffsetsRef.current = newOffsets;

        // Trigger a re-render now that the spatial index is fresh.
        needsAnimRef.current = true;
        startRaf();
      }, 150);
    }

    return () => {
      if (spatialRebuildTimerRef.current != null) {
        clearTimeout(spatialRebuildTimerRef.current);
        spatialRebuildTimerRef.current = null;
      }
      // Reset so React strict-mode re-mount detects the change and rebuilds
      prevArtistsRef.current = null;
    };
  }, [artists, startRaf]);

  // -------------------------------------------------------------------
  // Effect B: Sync volatile props to refs (no expensive rebuilds)
  // -------------------------------------------------------------------
  useEffect(() => {
    connectionCountsRef.current = connectionCounts;
    connectionsByArtistRef.current = connectionsByArtist;
    activeConnectionTypesRef.current = activeConnectionTypes;
    hoveredArtistRef.current = hoveredArtist;
    selectedArtistRef.current = selectedArtist;
    onHoverRef.current = onHover;
    onHoverPositionRef.current = onHoverPosition;
    onSelectRef.current = onSelect;

    // Re-sort presorted artists if connectionCounts changed since last sort
    if (connectionCounts !== lastSortedCountsRef.current && validArtistsRef.current.length > 0) {
      const cc = connectionCounts;
      const sorted = [...validArtistsRef.current].sort((a, b) => {
        const aCount = (cc && cc.get(a.id)) || 0;
        const bCount = (cc && cc.get(b.id)) || 0;
        return bCount - aCount;
      });
      presortedArtistsRef.current = sorted;
      lastSortedCountsRef.current = cc;
    }

    // Trigger re-render for prop changes
    needsAnimRef.current = true;
    startRaf();
  // Fix #36: `connections` is not read inside this effect body — removed to avoid spurious re-runs
  }, [connectionCounts, connectionsByArtist, activeConnectionTypes, hoveredArtist, selectedArtist, onHover, onHoverPosition, onSelect, startRaf]);

  // Re-render once when tab becomes visible again (no continuous polling)
  useEffect(() => {
    const handleVisibility = () => {
      if (!document.hidden) {
        needsAnimRef.current = true;
        startRaf();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [startRaf]);

  // -------------------------------------------------------------------
  // Hit testing: mousemove, mouseleave, click
  // -------------------------------------------------------------------

  // Helper: find nearest artist in posMap within hit radius
  // Returns { artist, dist } or null
  const hitTest = useCallback((mx, my) => {
    const mode = renderModeRef.current;
    const posMap = posMapRef.current;
    if (!posMap || posMap.size === 0) return null;

    let nearestId = null;
    let nearestDist = Infinity;

    for (const [id, pos] of posMap) {
      const dx = pos.x - mx;
      const dy = pos.y - my;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearestId = id;
      }
    }

    // Hit radius depends on render mode and pointer type (fine vs coarse).
    // All radii are in CSS px — no DPR scaling needed because mouse events
    // report CSS px and the canvas is DPR-scaled via ctx.scale in the render loop.
    const scaledHitRadius = hitRadiusRef.current;
    let effectiveHitRadius;
    if (mode === 'individual') {
      // hitRadiusRef already accounts for fine/coarse pointer (WCAG 44px touch target)
      effectiveHitRadius = scaledHitRadius;
    } else {
      // Cluster/city mode: dynamic hit radius based on orb size, scaled by pointer type
      const artist = artistByIdRef.current.get(nearestId);
      const connCount = (connectionCountsRef.current?.get(artist?.id)) || 0;
      const scaleFactor = validArtistsRef.current.length > 200 ? 0.5 : 1;
      const inputScale = hitRadiusRef.current / HIT_TEST_MIN_RADIUS;
      const baseRadius = (CLUSTER_RADIUS_BASE + Math.min(connCount * 3, 60)) * scaleFactor;
      effectiveHitRadius = Math.max(20 * inputScale, baseRadius * 0.4);
    }

    if (nearestDist <= effectiveHitRadius && nearestId != null) {
      const artist = artistByIdRef.current.get(nearestId);
      if (artist) return { artist, dist: nearestDist };
    }
    return null;
  }, []);

  // Shared cluster hit-test helper — returns the matched cluster object or null.
  // Both click handlers and hover use identical bounds/getClusters/distance logic,
  // so centralising it here keeps the three callsites DRY.
  const findClusterAtPoint = useCallback((mx, my) => {
    const map = mapRef.current?.getMap?.();
    const index = scIndexRef.current;
    if (!map || !index) return null;

    const bounds = map.getBounds();
    const zoom = Math.floor(map.getZoom());
    const clusters = index.getClusters(
      [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()],
      zoom
    );

    for (const cluster of clusters) {
      if (!cluster.properties.cluster) continue;
      const [lng, lat] = cluster.geometry.coordinates;
      const pt = map.project([lng, lat]);
      const dx = pt.x - mx;
      const dy = pt.y - my;
      const count = cluster.properties.point_count;
      const clusterRadius = Math.min(CLUSTER_RADIUS_BASE + Math.log2(count) * 7, CLUSTER_RADIUS_MAX);
      if (Math.sqrt(dx * dx + dy * dy) <= clusterRadius) {
        return cluster;
      }
    }
    return null;
  }, [mapRef]);

  // Handle cluster clicks when in cluster mode — zoom by 3 levels per click
  // to reduce clicks from 4-6 to 2-3 (Issue #2)
  const handleClusterClick = useCallback((mx, my) => {
    const map = mapRef.current?.getMap?.();
    const index = scIndexRef.current;
    if (!map || !index) return false;

    if (renderModeRef.current !== 'cluster') return false;

    const cluster = findClusterAtPoint(mx, my);
    if (cluster) {
      // Smart zoom: use Supercluster's expansion zoom, capped to prevent disorienting jumps
      const currentZoom = map.getZoom();
      let expansionZoom;
      try {
        expansionZoom = index.getClusterExpansionZoom(cluster.id);
      } catch {
        expansionZoom = currentZoom + 3;
      }
      const targetZoom = Math.min(expansionZoom, currentZoom + 4, 16);
      map.flyTo({ center: cluster.geometry.coordinates, zoom: targetZoom });
      return true;
    }
    return false;
  }, [mapRef, findClusterAtPoint]);

  // Handle double-click on cluster to zoom directly to individual artist level (Issue #2)
  const handleClusterDoubleClick = useCallback((mx, my) => {
    if (renderModeRef.current !== 'cluster') return false;

    const map = mapRef.current?.getMap?.();
    if (!map) return false;

    const cluster = findClusterAtPoint(mx, my);
    if (cluster) {
      // Double-click jumps directly to individual artist level (zoom 9)
      map.flyTo({ center: cluster.geometry.coordinates, zoom: ZOOM_INDIVIDUAL });
      return true;
    }
    return false;
  }, [mapRef, findClusterAtPoint]);

  // Handle city group clicks when in city mode -> adaptive zoom based on artist count (Issue #2, #15)
  const handleCityClick = useCallback((mx, my) => {
    const map = mapRef.current?.getMap?.();
    if (!map) return false;

    if (renderModeRef.current !== 'city') return false;

    const cityPosMap = cityPosMapRef.current;
    if (!cityPosMap || cityPosMap.size === 0) return false;

    for (const [, { x, y, radius, group }] of cityPosMap) {
      const dx = x - mx;
      const dy = y - my;
      if (Math.sqrt(dx * dx + dy * dy) <= Math.max(radius, hitRadiusRef.current)) {
        // Adaptive zoom: large cities need lower zoom to avoid overshoot (Issue #15)
        const artistCount = group.artists.length;
        let targetZoom;
        if (artistCount > 100) targetZoom = 10;
        else if (artistCount > 50) targetZoom = 11;
        else if (artistCount > 20) targetZoom = 12;
        else targetZoom = 13;
        map.flyTo({ center: [group.lng, group.lat], zoom: targetZoom });
        return true;
      }
    }
    return false;
  }, [mapRef]);

  // Attach map event listeners — fire a single render on map events
  useEffect(() => {
    const map = mapRef.current?.getMap?.();
    if (!map) return;

    const handleMapMouseMove = (e) => {
      lastInputTypeRef.current = 'mouse';
      const mx = e.point.x;
      const my = e.point.y;

      // In city mode, check city group hover for pointer cursor + highlight
      if (renderModeRef.current === 'city') {
        hideClusterTooltip();
        const cityPosMap = cityPosMapRef.current;
        let foundCityKey = null;
        if (cityPosMap && cityPosMap.size > 0) {
          for (const [key, { x, y, radius }] of cityPosMap) {
            const dx = x - mx;
            const dy = y - my;
            if (Math.sqrt(dx * dx + dy * dy) <= Math.max(radius, hitRadiusRef.current)) {
              foundCityKey = key;
              break;
            }
          }
        }
        if (foundCityKey !== hoveredCityKeyRef.current) {
          hoveredCityKeyRef.current = foundCityKey;
          needsAnimRef.current = true;
          startRaf();
        }
        if (foundCityKey) {
          onHoverRef.current?.(null);
          onHoverPositionRef.current?.(null);
          map.getCanvas().style.cursor = 'pointer';
          return;
        }
      }

      // City mode fallthrough guard (S2): don't fall through to individual hit-test
      // when individual mode isn't visible (alpha === 0)
      if (renderModeRef.current === 'city' && individualAlphaRef.current === 0) {
        onHoverRef.current?.(null);
        onHoverPositionRef.current?.(null);
        map.getCanvas().style.cursor = '';
        return;
      }

      // In cluster mode, check cluster hover for pointer cursor + tooltip (Issue #35)
      if (renderModeRef.current === 'cluster') {
        const hoveredCluster = findClusterAtPoint(mx, my);
        if (hoveredCluster) {
          map.getCanvas().style.cursor = 'pointer';
          // Show tooltip with cluster count
          showClusterTooltip(mx, my, hoveredCluster.properties.point_count, canvasRef.current);
        } else {
          map.getCanvas().style.cursor = '';
          hideClusterTooltip();
        }
        onHoverRef.current?.(null);
        onHoverPositionRef.current?.(null);
        return;
      }

      hideClusterTooltip();
      const hit = hitTest(mx, my);
      if (hit) {
        onHoverRef.current?.(hit.artist);
        onHoverPositionRef.current?.({ x: e.point.x, y: e.point.y });
        map.getCanvas().style.cursor = 'pointer';
      } else {
        onHoverRef.current?.(null);
        onHoverPositionRef.current?.(null);
        map.getCanvas().style.cursor = '';
      }
    };

    const handleMapClick = (e) => {
      const mx = e.point.x;
      const my = e.point.y;
      if (handleClusterClick(mx, my)) return;
      if (handleCityClick(mx, my)) return;
      if (renderModeRef.current === 'city') return;
      const hit = hitTest(mx, my);
      onSelectRef.current?.(hit ? hit.artist : null);
    };

    // Double-click on cluster to jump directly to individual view (Issue #2)
    const handleMapDblClick = (e) => {
      const mx = e.point.x;
      const my = e.point.y;
      if (handleClusterDoubleClick(mx, my)) {
        e.preventDefault(); // Prevent default map double-click zoom
      }
    };

    const handleMapMouseLeave = () => {
      onHoverRef.current?.(null);
      onHoverPositionRef.current?.(null);
      map.getCanvas().style.cursor = '';
      hideClusterTooltip();
      if (hoveredCityKeyRef.current !== null) {
        hoveredCityKeyRef.current = null;
        needsAnimRef.current = true;
        startRaf();
      }
    };

    const onMapEvent = () => {
      mapMovingRef.current = true;
      needsAnimRef.current = true;
      startRaf();
    };

    const handleMapTouchStart = () => {
      lastInputTypeRef.current = 'touch';
    };

    const events = ['move', 'zoom', 'resize'];
    events.forEach((evt) => map.on(evt, onMapEvent));
    map.on('mousemove', handleMapMouseMove);
    map.on('click', handleMapClick);
    map.on('dblclick', handleMapDblClick);
    map.on('mouseout', handleMapMouseLeave);
    map.on('touchstart', handleMapTouchStart);

    // Initial draw
    needsAnimRef.current = true;
    startRaf();

    return () => {
      events.forEach((evt) => map.off(evt, onMapEvent));
      map.off('mousemove', handleMapMouseMove);
      map.off('click', handleMapClick);
      map.off('dblclick', handleMapDblClick);
      map.off('mouseout', handleMapMouseLeave);
      map.off('touchstart', handleMapTouchStart);
      hideClusterTooltip();
      // Remove global tooltip node from DOM on unmount
      if (_clusterTooltipEl && _clusterTooltipEl.parentNode) {
        _clusterTooltipEl.parentNode.removeChild(_clusterTooltipEl);
        _clusterTooltipEl = null;
      }
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [mapRef, startRaf, hitTest, findClusterAtPoint, handleClusterClick, handleClusterDoubleClick, handleCityClick]);

  // Keyboard handler for canvas — arrow keys to cycle visible artists, Enter/Space to select
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      e.stopPropagation();
      const mode = renderModeRef.current;
      const map = mapRef.current?.getMap?.();

      if (mode === 'cluster') {
        // Expand focused cluster
        const cluster = focusedArtistIndexRef._focusedCluster;
        const index = scIndexRef.current;
        if (cluster && cluster.properties.cluster && index && map) {
          try {
            const expansionZoom = index.getClusterExpansionZoom(cluster.id);
            map.flyTo({ center: cluster.geometry.coordinates, zoom: expansionZoom });
          } catch { /* cluster expansion may fail at max zoom */ }
        }
        return;
      }

      if (mode === 'city') {
        // Fly to focused city with adaptive zoom (Issue #15)
        const focused = focusedArtistIndexRef._focusedCity;
        if (focused && map) {
          const { entry } = focused;
          const artistCount = entry.group.artists.length;
          let targetZoom;
          if (artistCount > 100) targetZoom = 10;
          else if (artistCount > 50) targetZoom = 11;
          else if (artistCount > 20) targetZoom = 12;
          else targetZoom = 13;
          map.flyTo({ center: [entry.group.lng, entry.group.lat], zoom: targetZoom });
        }
        return;
      }

      // Individual mode: select hovered artist
      const hovered = hoveredArtistRef.current;
      if (hovered) {
        onSelectRef.current?.(hovered);
      }
      return;
    }

    // ArrowLeft/ArrowRight/ArrowUp/ArrowDown to cycle through visible candidates based on render mode.
    // ArrowUp/ArrowDown are treated as ArrowLeft/ArrowRight respectively (previous/next) so all
    // four arrow keys are consumed here and do NOT bubble to the MapLibre keyboard handler, which
    // would otherwise pan the map simultaneously. stopPropagation() is called alongside
    // preventDefault() to prevent the event from reaching MapLibre's listener at the map container.
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      e.stopPropagation();

      // Normalize: Up/Left = previous, Down/Right = next
      const isNext = e.key === 'ArrowRight' || e.key === 'ArrowDown';

      const canvas = canvasRef.current;
      const cw = canvas ? canvas.clientWidth : window.innerWidth;
      const ch = canvas ? canvas.clientHeight : window.innerHeight;
      const mode = renderModeRef.current;
      const map = mapRef.current?.getMap?.();

      if (mode === 'cluster') {
        // Cycle through cluster centers visible on screen
        const index = scIndexRef.current;
        if (!map || !index) return;
        const bounds = map.getBounds();
        const zoom = Math.floor(map.getZoom());
        const clusters = index.getClusters(
          [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()],
          zoom
        );
        const visibleClusters = [];
        for (const cluster of clusters) {
          const [lng, lat] = cluster.geometry.coordinates;
          const pt = map.project([lng, lat]);
          if (pt.x >= 0 && pt.x <= cw && pt.y >= 0 && pt.y <= ch) {
            visibleClusters.push({ cluster, pt });
          }
        }
        if (visibleClusters.length === 0) return;

        let idx = focusedArtistIndexRef.current;
        if (isNext) {
          idx = idx < 0 ? 0 : (idx + 1) % visibleClusters.length;
        } else {
          idx = idx < 0 ? visibleClusters.length - 1 : (idx - 1 + visibleClusters.length) % visibleClusters.length;
        }
        focusedArtistIndexRef.current = idx;

        // Announce focused cluster/leaf via ARIA live region
        const { cluster } = visibleClusters[idx];
        const clusterLabel = cluster.properties.cluster
          ? `Cluster of ${cluster.properties.point_count} artists`
          : cluster.properties.name || 'Artist';
        setKeyboardAnnouncement(clusterLabel);
        // Also trigger synthetic hover on leaf nodes for visual feedback
        if (!cluster.properties.cluster) {
          const artist = artistByIdRef.current.get(cluster.properties.artistId);
          if (artist) onHoverRef.current?.(artist);
        } else {
          onHoverRef.current?.(null);
        }
        // Store focused cluster for Enter handling
        focusedArtistIndexRef._focusedCluster = cluster;
        needsAnimRef.current = true;
        startRaf();
        return;
      }

      if (mode === 'city') {
        // Cycle through city group centers visible on screen
        const cityPosMap = cityPosMapRef.current;
        if (!cityPosMap || cityPosMap.size === 0) return;
        const visibleCities = [];
        for (const [key, entry] of cityPosMap) {
          if (entry.x >= 0 && entry.x <= cw && entry.y >= 0 && entry.y <= ch) {
            visibleCities.push({ key, entry });
          }
        }
        if (visibleCities.length === 0) return;

        let idx = focusedArtistIndexRef.current;
        if (isNext) {
          idx = idx < 0 ? 0 : (idx + 1) % visibleCities.length;
        } else {
          idx = idx < 0 ? visibleCities.length - 1 : (idx - 1 + visibleCities.length) % visibleCities.length;
        }
        focusedArtistIndexRef.current = idx;

        // Announce focused city via ARIA live region
        const { entry: cityEntry } = visibleCities[idx];
        setKeyboardAnnouncement(`${cityEntry.group.city}, ${cityEntry.group.artists.length} artists`);
        // Store focused city for Enter handling
        focusedArtistIndexRef._focusedCity = visibleCities[idx];
        needsAnimRef.current = true;
        startRaf();
        return;
      }

      // 'individual' mode: current behavior — cycle through individual artist positions
      const posMap = posMapRef.current;
      if (!posMap || posMap.size === 0) return;

      const visibleIds = [];
      for (const [id, pos] of posMap) {
        if (pos.x >= 0 && pos.x <= cw && pos.y >= 0 && pos.y <= ch) {
          visibleIds.push(id);
        }
      }
      if (visibleIds.length === 0) return;

      let idx = focusedArtistIndexRef.current;
      if (isNext) {
        idx = idx < 0 ? 0 : (idx + 1) % visibleIds.length;
      } else {
        idx = idx < 0 ? visibleIds.length - 1 : (idx - 1 + visibleIds.length) % visibleIds.length;
      }
      focusedArtistIndexRef.current = idx;

      const artistId = visibleIds[idx];
      const artist = artistByIdRef.current.get(artistId);
      if (artist) {
        onHoverRef.current?.(artist);
        // Trigger re-render to show hover state
        needsAnimRef.current = true;
        startRaf();
      }
    }
  }, [startRaf, mapRef]);

  // ARIA live region text for hovered/selected artist + zoom mode.
  // Memoized from props/state to avoid reading refs during render.
  const modeLabel = renderModeState === 'cluster' ? 'Cluster view' : renderModeState === 'city' ? 'City view' : 'Individual view';
  const effectiveLiveText = useMemo(() => {
    // Keyboard announcement takes precedence only when no mouse hover/selection is active
    if (keyboardAnnouncement && !hoveredArtist && !selectedArtist) return keyboardAnnouncement;
    if (hoveredArtist) {
      const genre = hoveredArtist.genres ? getGenreBucket(hoveredArtist.genres).bucket : '';
      const year = hoveredArtist.birth_year || 'unknown year';
      const city = hoveredArtist.birth_city ? ', ' + hoveredArtist.birth_city : '';
      return `${hoveredArtist.name}${genre ? ', ' + genre : ''}, ${year}${city}`;
    }
    if (selectedArtist) {
      const count = connectionCounts?.get(selectedArtist.id) ?? 0;
      return `Selected: ${selectedArtist.name}. ${count} connection${count === 1 ? '' : 's'}.`;
    }
    return modeLabel;
  }, [hoveredArtist, selectedArtist, connectionCounts, modeLabel, keyboardAnnouncement]);

  // Debounced live text: hover announcements are delayed 300ms to avoid flooding
  // screen readers during rapid mouse movement. Mode changes go through immediately.
  const [debouncedLiveText, setDebouncedLiveText] = useState('');
  useEffect(() => {
    if (!hoveredArtist && !keyboardAnnouncement) {
      setDebouncedLiveText(effectiveLiveText); // eslint-disable-line react-hooks/set-state-in-effect
      return;
    }
    const id = setTimeout(() => setDebouncedLiveText(effectiveLiveText), 300);
    return () => clearTimeout(id);
  }, [effectiveLiveText, hoveredArtist, keyboardAnnouncement]);

  return (
    <>
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          pointerEvents: 'none',
          zIndex: 2,
          cursor: 'default',
        }}
      />
      {/* Keyboard-accessible overlay with visible focus indicator */}
      <div
        tabIndex={0}
        onKeyDown={handleKeyDown}
        role="region"
        aria-label="Musician map navigation. Use left/right or up/down arrow keys to browse artists, Enter to select."
        aria-roledescription="musician map"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          outline: 'none',
          pointerEvents: 'none',
        }}
        onFocus={(e) => {
          if (e.currentTarget.matches(':focus-visible')) e.currentTarget.style.boxShadow = 'inset 0 0 0 3px rgba(216,62,127,0.5)';
        }}
        onBlur={(e) => {
          e.currentTarget.style.boxShadow = 'none';
        }}
      />
      {/* Screen reader live region for artist announcements */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        style={{
          position: 'absolute',
          width: 1,
          height: 1,
          overflow: 'hidden',
          clip: 'rect(0,0,0,0)',
          whiteSpace: 'nowrap',
        }}
      >
        {debouncedLiveText}
      </div>
    </>
  );
}

// -------------------------------------------------------------------
// Bloomed arc for hover/selection state
// -------------------------------------------------------------------
function drawArcBloomed(ctx, x1, y1, x2, y2, color1, color2, type, confidence = 0.5) {
  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2;
  const dist = Math.hypot(x2 - x1, y2 - y1);
  if (dist < 1) return;
  const bulge = dist * 0.25;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const nx = -dy / dist;
  const ny = dx / dist;
  const cpx = midX + nx * bulge;
  const cpy = midY + ny * bulge;

  ctx.save();
  ctx.lineWidth = 1.5;

  if (type === 'teacher') {
    ctx.setLineDash([4, 4]);
  } else if (type === 'peer' || type === 'collaboration') {
    ctx.setLineDash([8, 4]);
  } else {
    ctx.setLineDash([]);
  }

  // Confidence modulates opacity: high confidence = more visible
  const arcAlpha = 0.12 + confidence * 0.30; // range 0.12–0.42
  const gradient = ctx.createLinearGradient(x1, y1, x2, y2);
  gradient.addColorStop(0, hexToRgba(color1, arcAlpha));
  gradient.addColorStop(1, hexToRgba(color2, arcAlpha));
  ctx.strokeStyle = gradient;

  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.quadraticCurveTo(cpx, cpy, x2, y2);
  ctx.stroke();
  ctx.restore();
}
