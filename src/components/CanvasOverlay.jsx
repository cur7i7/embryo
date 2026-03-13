import React, { useRef, useEffect, useCallback, useState } from 'react';
import Supercluster from 'supercluster';
import { GENRE_BUCKETS, getGenreBucket } from '../utils/genres.js';
import {
  GENRE_COLORS,
  preRenderOrbTexture,
  createGrainTexture,
  drawArc,
  drawArcParticle,
  drawArtistNode,
  drawCityGroup,
  hexToRgba,
} from '../utils/rendering.js';
import { buildCityGroups } from '../utils/cityGrouping.js';

// Build a stable mapping from genre bucket color -> pre-rendered texture index
const BUCKET_COLORS = Object.values(GENRE_BUCKETS).map((b) => b.color);

// Zoom-based rendering mode thresholds
const ZOOM_CITY = 8;
const ZOOM_INDIVIDUAL = 12;

export default function CanvasOverlay({
  mapRef,
  artists,
  connectionCounts,
  connections,
  activeConnectionTypes,
  hoveredArtist,
  selectedArtist,
  onHover,
  onSelect,
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

  // artistMap ref (rebuilt when artists change)
  const artistMapRef = useRef(new Map());

  // Focused artist index for keyboard navigation
  const focusedArtistIndexRef = useRef(-1);

  // Supercluster index ref
  const scIndexRef = useRef(null);
  const scArtistsRef = useRef(null); // the array used to build the last index

  // City groups ref (rebuilt when artists change)
  const cityGroupsRef = useRef(new Map());
  const cityPosMapRef = useRef(new Map()); // projected city positions for hit testing

  // Current render mode for hit testing
  const renderModeRef = useRef('cluster');
  const [renderModeState, setRenderModeState] = useState('cluster');

  // Display offsets for co-located artists
  const displayOffsetsRef = useRef(new Map());

  // Store latest props in refs to avoid render/startRaf recreation
  const artistsRef = useRef(artists);
  const connectionCountsRef = useRef(connectionCounts);
  const connectionsRef = useRef(connections);
  const activeConnectionTypesRef = useRef(activeConnectionTypes);
  const hoveredArtistRef = useRef(hoveredArtist);
  const selectedArtistRef = useRef(selectedArtist);
  const onHoverRef = useRef(onHover);
  const onSelectRef = useRef(onSelect);

  // Cached valid artists and lookup maps (rebuilt only when artists change)
  const validArtistsRef = useRef([]);
  // Pre-sorted by connection count (descending) — avoids O(n log n) per frame
  const presortedArtistsRef = useRef([]);
  const artistByIdRef = useRef(new Map());

  // Per-artist metadata cache: Map<id, { genreBucket, genreColor, pulseHash }>
  const artistMetaRef = useRef(new Map());

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
    if (!canvas) return;

    const map = mapRef.current?.getMap?.();
    if (!map) return;

    const orbTextures = orbTexturesRef.current;
    const grainTexture = grainTextureRef.current;
    if (!orbTextures || !grainTexture) return;

    // Read latest props from refs
    const connectionCounts = connectionCountsRef.current;
    const connections = connectionsRef.current;
    const activeConnectionTypes = activeConnectionTypesRef.current;
    const hoveredArtist = hoveredArtistRef.current;
    const selectedArtist = selectedArtistRef.current;

    const container = map.getContainer();
    const dpr = window.devicePixelRatio || 1;
    const cssWidth = container.clientWidth;
    const cssHeight = container.clientHeight;

    // Resize canvas if needed (physical pixels for crispness)
    if (
      canvas.width !== cssWidth * dpr ||
      canvas.height !== cssHeight * dpr
    ) {
      canvas.width = cssWidth * dpr;
      canvas.height = cssHeight * dpr;
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
    const FADE_DURATION = 400; // ms for full 0->1 or 1->0 transition
    const fadeStep = dt / FADE_DURATION;

    const opacityMap = opacityMapRef.current;
    const currentIds = new Set(validArtists.map((a) => a.id));

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

    // Only keep rAF running for actual animations; when reduced motion is on
    // and there are no opacity transitions, a static selection doesn't need rAF
    needsAnimRef.current = hasActiveTransitions ||
      (reducedMotion
        ? false
        : (!!hoveredArtistRef.current || !!selectedArtistRef.current));

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

    // Build a fresh posMap every frame — only project artists within viewport bounds
    const posMap = new Map();
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
        const zoomScale = Math.max(1, (16 - currentZoomForPos) * 3);
        lng += o.dlng * zoomScale;
        lat += o.dlat * zoomScale;
      }
      const point = map.project([lng, lat]);
      posMap.set(artist.id, point);
    }
    posMapRef.current = posMap;

    // Build set of ids connected to hovered/selected artist
    const connectedIds = new Set();
    if (activeArtist && connections && connections.length > 0) {
      for (const conn of connections) {
        if (conn.source_id === activeArtist.id) {
          connectedIds.add(conn.target_id);
        }
        if (conn.target_id === activeArtist.id) {
          connectedIds.add(conn.source_id);
        }
      }
    }

    // --- Arc phase --- (only when hovered/selected)
    ctx.globalCompositeOperation = 'source-over';

    // Track selected arcs for particle drawing
    const selectedArcs = [];

    if (
      activeArtist &&
      connections && connections.length > 0 &&
      activeConnectionTypes && activeConnectionTypes.size > 0
    ) {
      for (const conn of connections) {
        const { source_id, target_id, type, confidence } = conn;
        const srcArtist = artistByIdRef.current.get(source_id);
        const tgtArtist = artistByIdRef.current.get(target_id);
        if (!srcArtist || !tgtArtist) continue;
        const srcPos = posMap.get(srcArtist.id);
        const tgtPos = posMap.get(tgtArtist.id);
        if (!srcPos || !tgtPos) continue;
        if (!activeConnectionTypes.has(type)) continue;

        // Arc viewport culling: skip arcs where BOTH endpoints are outside canvas
        const arcPad = 100;
        const srcOutside = srcPos.x < -arcPad || srcPos.x > cssWidth + arcPad ||
                           srcPos.y < -arcPad || srcPos.y > cssHeight + arcPad;
        const tgtOutside = tgtPos.x < -arcPad || tgtPos.x > cssWidth + arcPad ||
                           tgtPos.y < -arcPad || tgtPos.y > cssHeight + arcPad;
        if (srcOutside && tgtOutside) continue;

        const srcMeta = artistMeta.get(srcArtist.id);
        const tgtMeta = artistMeta.get(tgtArtist.id);
        const srcColor = srcMeta?.genreColor ?? getGenreBucket(srcArtist?.genres).color;
        const tgtColor = tgtMeta?.genreColor ?? getGenreBucket(tgtArtist?.genres).color;

        const isConnected =
          conn.source_id === activeArtist.id || conn.target_id === activeArtist.id;

        if (isConnected) {
          drawArcBloomed(ctx, srcPos.x, srcPos.y, tgtPos.x, tgtPos.y, srcColor, tgtColor, type, confidence ?? 0.5);
          // Collect for particle rendering
          if (selectedArtist) {
            selectedArcs.push({ srcPos, tgtPos, srcColor });
          }
        } else {
          const dimmed = !!activeArtist;
          drawArc(ctx, srcPos.x, srcPos.y, tgtPos.x, tgtPos.y, srcColor, tgtColor, type, confidence ?? 0.5, dimmed);
        }
      }
    }

    // Connection particles for selected artist (skip when reduced motion)
    if (selectedArtist && selectedArcs.length > 0 && !reducedMotion) {
      const t0 = (performance.now() / 3000) % 1;
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
      // Cluster <-> City cross-fade around ZOOM_CITY (7.5-8.5)
      if (currentZoom < ZOOM_CITY - 0.5) {
        clusterAlpha = 1;
      } else if (currentZoom < ZOOM_CITY + 0.5) {
        const t = (currentZoom - (ZOOM_CITY - 0.5));  // 0->1
        clusterAlpha = 1 - t;
        cityAlpha = t;
      } else if (currentZoom < ZOOM_INDIVIDUAL - 0.5) {
        cityAlpha = 1;
      } else if (currentZoom < ZOOM_INDIVIDUAL + 0.5) {
        // City <-> Individual cross-fade around ZOOM_INDIVIDUAL (11.5-12.5)
        const t = (currentZoom - (ZOOM_INDIVIDUAL - 0.5));  // 0->1
        cityAlpha = 1 - t;
        individualAlpha = t;
      } else {
        individualAlpha = 1;
      }
    }

    ctx.globalCompositeOperation = 'source-over';

    // --- Cluster mode rendering ---
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
            const clusterRadius = Math.min(40 + Math.log2(count) * 12, 100);

            const orbTexture = orbTextures[Math.abs(cluster.id) % orbTextures.length];
            ctx.globalAlpha = 0.85 * clusterAlpha;
            ctx.drawImage(orbTexture, x - clusterRadius, y - clusterRadius, clusterRadius * 2, clusterRadius * 2);
            ctx.globalAlpha = clusterAlpha;

            ctx.save();
            const countStr = count.toString();
            const isSmall = count < 5;
            const fontSize = isSmall ? 10 : Math.min(14, (8 + Math.log2(count)) | 0);

            // Background circle for count label
            const textRadius = isSmall ? 10 : Math.max(14, fontSize * 1.2 + 4);
            ctx.beginPath();
            ctx.arc(x, y, textRadius, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(62, 53, 48, 0.75)';
            ctx.fill();
            ctx.strokeStyle = 'rgba(250, 243, 235, 0.3)';
            ctx.lineWidth = 1;
            ctx.stroke();

            // White text on dark circle
            ctx.font = `700 ${fontSize}px "DM Sans", sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = '#FAF3EB';
            ctx.fillText(countStr, x, y);
            ctx.restore();
          } else {
            const artistId = cluster.properties.artistId;
            const artistData = artistById.get(artistId);
            if (!artistData) continue;

            const opacity = opacityMap.get(artistId)?.opacity ?? 1;
            if (opacity <= 0) continue;

            const connCount = (connectionCounts && connectionCounts.get(artistData.id)) || 0;
            const scaleFactor = validArtists.length > 200 ? 0.5 : 1;
            const baseRadius = (40 + Math.min(connCount * 3, 60)) * scaleFactor;

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

            let radius = isActive ? baseRadius * 1.5 : baseRadius;
            if (!isActive && !isConnected && !hasActiveTransitions) {
              let pulseFactor = 1;
              if (!reducedMotion) {
                const hash = meta?.pulseHash ?? 0;
                const phase = ((performance.now() / 3000) + hash * 0.1) % 1;
                pulseFactor = 1 + 0.05 * Math.sin(phase * Math.PI * 2);
              }
              radius *= pulseFactor;
            }

            const baseAlpha = isPassive ? 0.4 : 1.0;
            ctx.globalAlpha = baseAlpha * opacity * clusterAlpha;
            ctx.drawImage(orbTexture, x - radius, y - radius, radius * 2, radius * 2);
          }
        }
      }
      ctx.globalAlpha = 1.0;
    }

    // --- City mode rendering ---
    const cityPosMap = new Map();
    if (cityAlpha > 0) {
      const cityGroups = cityGroupsRef.current;

      // Sort city groups by artist count (largest first) for label collision priority
      const sortedCityEntries = [...cityGroups.entries()].sort(
        (a, b) => b[1].artists.length - a[1].artists.length
      );
      const cityOccupiedRects = [];

      for (const [key, group] of sortedCityEntries) {
        const point = map.project([group.lng, group.lat]);
        const { x, y } = point;

        const cityRadius = Math.max(30, Math.sqrt(group.artists.length) * 12);
        // Viewport cull
        if (x < -cityRadius || x > cssWidth + cityRadius || y < -cityRadius || y > cssHeight + cityRadius) continue;

        cityPosMap.set(key, { x, y, radius: cityRadius, group });

        // Collision detection for city labels — include count text in width
        let showLabel = true;
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

        const overlaps = (r1, r2) =>
          r1.x < r2.x + r2.w && r1.x + r1.w > r2.x && r1.y < r2.y + r2.h && r1.y + r1.h > r2.y;

        for (const occ of cityOccupiedRects) {
          if (overlaps(labelRect, occ)) {
            showLabel = false;
            break;
          }
        }
        if (showLabel) {
          cityOccupiedRects.push(labelRect);
        }

        drawCityGroup(ctx, x, y, showLabel ? group.city : null, group.artists.length, cityRadius, cityAlpha);
      }
    }
    cityPosMapRef.current = cityPosMap;

    // --- Individual mode rendering ---
    if (individualAlpha > 0) {
      // Use pre-sorted array (by connection count) and partition active/connected to front.
      // This avoids an O(n log n) sort every frame for 30K artists.
      const preSorted = presortedArtistsRef.current;
      const activeArr = [];
      const connArr = [];
      const restArr = [];
      for (const a of preSorted) {
        if (activeArtist && a.id === activeArtist.id) activeArr.push(a);
        else if (connectedIds.has(a.id)) connArr.push(a);
        else restArr.push(a);
      }
      const sortedArtists = activeArr.concat(connArr, restArr);

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

        const r = 16 * (state === 'active' ? 1.2 : 1);

        // Always show labels for hovered/active/connected; collision-check the rest
        const isImportant = isActive || isConnected;
        let showLabel = true;

        if (!isImportant) {
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
          const overlaps = (r1, r2) =>
            r1.x < r2.x + r2.w && r1.x + r1.w > r2.x && r1.y < r2.y + r2.h && r1.y + r1.h > r2.y;

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
          }
        } else {
          // Important artists always get labels — register their rects to block others
          const displayName = artist.name.length > 20 ? artist.name.slice(0, 19) + '\u2026' : artist.name;
          ctx.font = '600 12px "DM Sans", sans-serif';
          const nameW = ctx.measureText(displayName).width;
          ctx.font = '400 10px "DM Sans", sans-serif';
          const yearsW = years ? ctx.measureText(years).width : 0;

          occupiedRects.push({ x: point.x - nameW / 2 - 4, y: point.y + r + 2, w: nameW + 8, h: 16 });
          if (years && yearsW > 0) {
            occupiedRects.push({ x: point.x - yearsW / 2 - 4, y: point.y + r + 18, w: yearsW + 8, h: 14 });
          }
        }

        drawArtistNode(ctx, point.x, point.y, 16, genreColor, artist.name, years, state, opacity * individualAlpha, showLabel);
      }
    }

    ctx.globalAlpha = 1.0;

    // --- Label phase --- explicitly reset composite and alpha
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1.0;

    if (activeArtist) {
      const pos = posMapRef.current?.get(activeArtist.id);
      if (pos) {
        const connCount = (connectionCounts && connectionCounts.get(activeArtist.id)) || 0;
        const baseRadius = 40 + Math.min(connCount * 3, 60);
        const radius = baseRadius * 1.5;

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
        const pillH = 40;
        const pillX = pos.x - maxW / 2 - pillPad;
        // Flip pill below if too close to top of viewport
        let pillY = pos.y - radius - 52;
        if (pos.y - radius - 52 < 10) {
          pillY = pos.y + radius + 12;
        }
        const pillW = maxW + pillPad * 2;

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
        ctx.fillText(label, pos.x, pillY + 10);

        ctx.font = '400 11px "DM Sans", sans-serif';
        ctx.fillStyle = '#7A6E65';
        ctx.fillText(sublabel, pos.x, pillY + 26);
      }
    }

    // --- Grain phase — pre-composite full-viewport grain canvas at device pixel resolution ---
    ctx.globalCompositeOperation = 'source-over';

    if (grainSizeRef.current.w !== cssWidth || grainSizeRef.current.h !== cssHeight) {
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
  }, [mapRef]);

  // -------------------------------------------------------------------
  // rAF loop management — runs when transitions or interaction is active
  // -------------------------------------------------------------------
  const startRaf = useCallback(() => {
    if (rafRef.current != null) return; // already running

    const loop = (ts) => {
      render(ts);
      if (needsAnimRef.current) {
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
  // -------------------------------------------------------------------
  useEffect(() => {
    artistsRef.current = artists;

    // Cache valid artists (those with coordinates)
    const valid = (artists || []).filter(a => a.birth_lat != null && a.birth_lng != null);
    validArtistsRef.current = valid;

    // Build O(1) lookup maps
    const newArtistMap = new Map();
    const byId = new Map();
    for (const artist of valid) {
      newArtistMap.set(artist.id, artist);
      byId.set(artist.id, artist);
    }
    artistMapRef.current = newArtistMap;
    artistByIdRef.current = byId;

    // Pre-sort valid artists by connection count (descending) once, not per frame.
    // Active/connected priority is applied at render time via a cheap partition.
    const cc = connectionCountsRef.current;
    const sorted = [...valid].sort((a, b) => {
      const aCount = (cc && cc.get(a.id)) || 0;
      const bCount = (cc && cc.get(b.id)) || 0;
      return bCount - aCount;
    });
    presortedArtistsRef.current = sorted;

    // Rebuild city groups
    cityGroupsRef.current = buildCityGroups(valid);

    // Rebuild Supercluster index
    const index = new Supercluster({ radius: 60, maxZoom: 16 });
    index.load(
      valid.map((a) => ({
        type: 'Feature',
        properties: { artistId: a.id, name: a.name, genres: a.genres },
        geometry: { type: 'Point', coordinates: [a.birth_lng, a.birth_lat] },
      }))
    );
    scIndexRef.current = index;
    scArtistsRef.current = artists;

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

    // Build display offsets for co-located artists
    const coordGroups = new Map();
    for (const artist of valid) {
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
          const radius = 0.0008 * Math.ceil(i / 6);
          newOffsets.set(group[i].id, { dlat: Math.sin(angle) * radius, dlng: Math.cos(angle) * radius });
        }
      }
    }
    displayOffsetsRef.current = newOffsets;

    // Trigger re-render
    needsAnimRef.current = true;
    startRaf();
  }, [artists, startRaf]);

  // -------------------------------------------------------------------
  // Effect B: Sync volatile props to refs (no expensive rebuilds)
  // -------------------------------------------------------------------
  useEffect(() => {
    connectionCountsRef.current = connectionCounts;
    connectionsRef.current = connections;
    activeConnectionTypesRef.current = activeConnectionTypes;
    hoveredArtistRef.current = hoveredArtist;
    selectedArtistRef.current = selectedArtist;
    onHoverRef.current = onHover;
    onSelectRef.current = onSelect;

    // Trigger re-render for prop changes
    needsAnimRef.current = true;
    startRaf();
  }, [connectionCounts, connections, activeConnectionTypes, hoveredArtist, selectedArtist, onHover, onSelect, startRaf]);

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

    // Hit radius depends on render mode
    let hitRadius;
    if (mode === 'individual') {
      // 22px radius = 44px touch target per WCAG
      hitRadius = 22;
    } else {
      // Cluster/city mode: dynamic hit radius based on orb size
      const artist = artistByIdRef.current.get(nearestId);
      const connCount = (connectionCountsRef.current?.get(artist?.id)) || 0;
      const scaleFactor = validArtistsRef.current.length > 200 ? 0.5 : 1;
      const baseRadius = (40 + Math.min(connCount * 3, 60)) * scaleFactor;
      hitRadius = Math.max(20, baseRadius * 0.4);
    }

    if (nearestDist <= hitRadius && nearestId != null) {
      const artist = artistByIdRef.current.get(nearestId);
      if (artist) return { artist, dist: nearestDist };
    }
    return null;
  }, []);

  // Handle cluster clicks when in cluster mode
  const handleClusterClick = useCallback((mx, my) => {
    const map = mapRef.current?.getMap?.();
    const index = scIndexRef.current;
    if (!map || !index) return false;

    if (renderModeRef.current !== 'cluster') return false;

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
      const clusterRadius = Math.min(40 + Math.log2(count) * 12, 100);
      if (Math.sqrt(dx * dx + dy * dy) <= clusterRadius) {
        try {
          const expansionZoom = index.getClusterExpansionZoom(cluster.id);
          map.flyTo({ center: cluster.geometry.coordinates, zoom: expansionZoom });
        } catch { /* cluster expansion may fail at max zoom */ }
        return true;
      }
    }
    return false;
  }, [mapRef]);

  // Handle city group clicks when in city mode -> fly to zoom 13
  const handleCityClick = useCallback((mx, my) => {
    const map = mapRef.current?.getMap?.();
    if (!map) return false;

    if (renderModeRef.current !== 'city') return false;

    const cityPosMap = cityPosMapRef.current;
    if (!cityPosMap || cityPosMap.size === 0) return false;

    for (const [, { x, y, radius, group }] of cityPosMap) {
      const dx = x - mx;
      const dy = y - my;
      if (Math.sqrt(dx * dx + dy * dy) <= Math.max(radius, 22)) {
        map.flyTo({ center: [group.lng, group.lat], zoom: 13 });
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
      const mx = e.point.x;
      const my = e.point.y;

      // In city mode, check city group hover for pointer cursor
      if (renderModeRef.current === 'city') {
        const cityPosMap = cityPosMapRef.current;
        if (cityPosMap && cityPosMap.size > 0) {
          for (const [, { x, y, radius }] of cityPosMap) {
            const dx = x - mx;
            const dy = y - my;
            if (Math.sqrt(dx * dx + dy * dy) <= Math.max(radius, 22)) {
              onHoverRef.current?.(null);
              map.getCanvas().style.cursor = 'pointer';
              return;
            }
          }
        }
      }

      // In cluster mode, skip individual artist hit testing
      if (renderModeRef.current === 'cluster') {
        onHoverRef.current?.(null);
        map.getCanvas().style.cursor = '';
        return;
      }

      const hit = hitTest(mx, my);
      if (hit) {
        onHoverRef.current?.(hit.artist);
        map.getCanvas().style.cursor = 'pointer';
      } else {
        onHoverRef.current?.(null);
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

    const handleMapMouseLeave = () => {
      onHoverRef.current?.(null);
      map.getCanvas().style.cursor = '';
    };

    const onMapEvent = () => {
      needsAnimRef.current = true;
      startRaf();
    };

    const events = ['move', 'zoom', 'resize'];
    events.forEach((evt) => map.on(evt, onMapEvent));
    map.on('mousemove', handleMapMouseMove);
    map.on('click', handleMapClick);
    map.on('mouseout', handleMapMouseLeave);

    // Initial draw
    needsAnimRef.current = true;
    startRaf();

    return () => {
      events.forEach((evt) => map.off(evt, onMapEvent));
      map.off('mousemove', handleMapMouseMove);
      map.off('click', handleMapClick);
      map.off('mouseout', handleMapMouseLeave);
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [mapRef, startRaf, hitTest, handleClusterClick, handleCityClick]);

  // Keyboard handler for canvas — arrow keys to cycle visible artists, Enter/Space to select
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      const hovered = hoveredArtistRef.current;
      if (hovered) {
        e.preventDefault();
        onSelectRef.current?.(hovered);
      }
      return;
    }

    // ArrowLeft/ArrowRight to cycle through artists visible in the viewport
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      const posMap = posMapRef.current;
      if (!posMap || posMap.size === 0) return;

      // Filter to only artists whose projected positions are on screen
      const canvas = canvasRef.current;
      const cw = canvas ? canvas.clientWidth : window.innerWidth;
      const ch = canvas ? canvas.clientHeight : window.innerHeight;

      const visibleIds = [];
      for (const [id, pos] of posMap) {
        if (pos.x >= 0 && pos.x <= cw && pos.y >= 0 && pos.y <= ch) {
          visibleIds.push(id);
        }
      }
      if (visibleIds.length === 0) return;

      let idx = focusedArtistIndexRef.current;
      if (e.key === 'ArrowRight') {
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
  }, [startRaf]);

  // ARIA live region text for hovered/selected artist + zoom mode
  const modeLabel = renderModeState === 'cluster' ? 'Cluster view' : renderModeState === 'city' ? 'City view' : 'Individual view';
  const liveText = hoveredArtist
    ? `${hoveredArtist.name}, ${hoveredArtist.birth_year || 'unknown year'}${hoveredArtist.birth_city ? ', ' + hoveredArtist.birth_city : ''}`
    : selectedArtist
      ? `Selected: ${selectedArtist.name}`
      : modeLabel;

  return (
    <>
      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          pointerEvents: 'none',
          zIndex: 1,
          cursor: 'default',
        }}
        aria-hidden="true"
      />
      {/* Keyboard-accessible overlay with visible focus indicator */}
      <div
        tabIndex={0}
        onKeyDown={handleKeyDown}
        role="application"
        aria-label="Musician map navigation. Use arrow keys to browse artists, Enter to select."
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
          e.currentTarget.style.boxShadow = 'inset 0 0 0 3px rgba(216,62,127,0.5)';
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
        {liveText}
      </div>
    </>
  );
}

// -------------------------------------------------------------------
// Bloomed arc for hover/selection state
// -------------------------------------------------------------------
function drawArcBloomed(ctx, x1, y1, x2, y2, color1, color2, type) {
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

  const gradient = ctx.createLinearGradient(x1, y1, x2, y2);
  gradient.addColorStop(0, hexToRgba(color1, 0.35));
  gradient.addColorStop(1, hexToRgba(color2, 0.35));
  ctx.strokeStyle = gradient;

  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.quadraticCurveTo(cpx, cpy, x2, y2);
  ctx.stroke();
  ctx.restore();
}
