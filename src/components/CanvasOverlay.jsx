import React, { useRef, useEffect, useCallback } from 'react';
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

// --- Zoom-based rendering mode thresholds ---
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

  // --- 6.1 Opacity fade map: Map<string, {opacity, target}> ---
  const opacityMapRef = useRef(new Map());

  // rAF handle ref so we can cancel and avoid duplicates
  const rafRef = useRef(null);
  // Timestamp of last rAF callback for delta-time lerp
  const lastRafTsRef = useRef(null);

  // Track whether an animation loop should be running
  const needsAnimRef = useRef(false);

  // --- A10: prefers-reduced-motion ---
  const prefersReducedMotionRef = useRef(false);
  useEffect(() => {
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
    prefersReducedMotionRef.current = mql.matches;
    const handler = (e) => { prefersReducedMotionRef.current = e.matches; };
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  // --- P01: Pre-composited grain canvas ---
  const grainFullRef = useRef(null);
  const grainSizeRef = useRef({ w: 0, h: 0 });

  // --- P05: artistMap ref (rebuilt when artists change) ---
  const artistMapRef = useRef(new Map());

  // --- A05: focused artist index for keyboard navigation ---
  const focusedArtistIndexRef = useRef(-1);

  // --- 6.4 Supercluster index ref ---
  const scIndexRef = useRef(null);
  const scArtistsRef = useRef(null); // the array used to build the last index

  // --- City groups ref (rebuilt when artists change) ---
  const cityGroupsRef = useRef(new Map());
  const cityPosMapRef = useRef(new Map()); // projected city positions for hit testing

  // --- Current render mode for hit testing (Task 6 will use) ---
  const renderModeRef = useRef('cluster');

  // --- V3: Display offsets for co-located artists ---
  const displayOffsetsRef = useRef(new Map());

  // --- B4: Store latest props in refs to avoid render/startRaf recreation ---
  const artistsRef = useRef(artists);
  const connectionCountsRef = useRef(connectionCounts);
  const connectionsRef = useRef(connections);
  const activeConnectionTypesRef = useRef(activeConnectionTypes);
  const hoveredArtistRef = useRef(hoveredArtist);
  const selectedArtistRef = useRef(selectedArtist);
  const onHoverRef = useRef(onHover);
  const onSelectRef = useRef(onSelect);

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

    // Read latest props from refs (B4)
    const artists = artistsRef.current;
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

    const validArtists = (artists || []).filter(
      (a) => a.birth_lat != null && a.birth_lng != null
    );

    // --- 6.1 Update opacity map ---
    const now = ts ?? performance.now();
    const dt = lastRafTsRef.current != null ? now - lastRafTsRef.current : 16;
    lastRafTsRef.current = now;
    const FADE_DURATION = 400; // ms for full 0->1 or 1->0 transition
    const fadeStep = dt / FADE_DURATION;

    const opacityMap = opacityMapRef.current;
    // B06: composite key to avoid name collisions
    const opacityKey = (a) => a.name + '|' + (a.birth_year || '');
    const currentKeys = new Set(validArtists.map((a) => opacityKey(a)));

    // Mark targets
    for (const artist of validArtists) {
      const key = opacityKey(artist);
      if (!opacityMap.has(key)) {
        opacityMap.set(key, { opacity: 0, target: 1 });
      } else {
        opacityMap.get(key).target = 1;
      }
    }
    for (const [key, entry] of opacityMap) {
      if (!currentKeys.has(key)) {
        entry.target = 0;
      }
    }

    // Lerp and clean up
    const reducedMotion = prefersReducedMotionRef.current;
    let hasActiveTransitions = false;
    for (const [key, entry] of opacityMap) {
      if (entry.opacity !== entry.target) {
        if (reducedMotion) {
          // A10: instant opacity when reduced motion is active
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
        opacityMap.delete(key);
      }
    }

    // B4: Prune stale opacity entries to prevent memory growth
    if (opacityMap.size > validArtists.length * 2) {
      for (const [key, entry] of opacityMap) {
        if (entry.opacity === 0 && entry.target === 0) opacityMap.delete(key);
      }
    }

    // P01: Only keep rAF running for active transitions or interaction states
    needsAnimRef.current = hasActiveTransitions || !!hoveredArtistRef.current || !!selectedArtistRef.current;

    // Determine active interaction target
    const activeArtist = hoveredArtist || selectedArtist;

    // Always build a fresh posMap every frame — eliminates projection cache race condition
    const posMap = new Map();
    const currentZoomForPos = map.getZoom();
    const offsets = displayOffsetsRef.current;
    for (const artist of validArtists) {
      let lng = artist.birth_lng;
      let lat = artist.birth_lat;
      // V3: Apply spiral offsets in individual mode to spread co-located artists
      if (currentZoomForPos >= ZOOM_INDIVIDUAL && offsets.has(artist.name)) {
        const o = offsets.get(artist.name);
        lng += o.dlng;
        lat += o.dlat;
      }
      const point = map.project([lng, lat]);
      posMap.set(artist.name, point);
    }
    posMapRef.current = posMap;

    // P05: Use artistMap from ref (rebuilt when artists change)
    const artistMap = artistMapRef.current;

    // Build set of names connected to hovered/selected artist
    const connectedNames = new Set();
    if (activeArtist && connections && connections.length > 0) {
      for (const conn of connections) {
        if (conn.source_name === activeArtist.name) connectedNames.add(conn.target_name);
        if (conn.target_name === activeArtist.name) connectedNames.add(conn.source_name);
      }
    }

    // --- Arc phase --- (6.5: only when hovered/selected)
    ctx.globalCompositeOperation = 'source-over';

    // Track selected arcs for particle drawing
    const selectedArcs = [];

    if (
      activeArtist &&
      connections && connections.length > 0 &&
      activeConnectionTypes && activeConnectionTypes.size > 0
    ) {
      const visibleNames = new Set(posMap.keys());

      for (const conn of connections) {
        const { source_name, target_name, type, confidence } = conn;
        if (!visibleNames.has(source_name) || !visibleNames.has(target_name)) continue;
        if (!activeConnectionTypes.has(type)) continue;

        const srcPos = posMap.get(source_name);
        const tgtPos = posMap.get(target_name);

        const srcArtist = artistMap.get(source_name);
        const tgtArtist = artistMap.get(target_name);
        const { color: srcColor } = getGenreBucket(srcArtist?.genres);
        const { color: tgtColor } = getGenreBucket(tgtArtist?.genres);

        const isConnected =
          conn.source_name === activeArtist.name || conn.target_name === activeArtist.name;

        if (isConnected) {
          drawArcBloomed(ctx, srcPos.x, srcPos.y, tgtPos.x, tgtPos.y, srcColor, tgtColor, type, confidence ?? 0.5);
          // Collect for particle rendering (6.3)
          if (selectedArtist) {
            selectedArcs.push({ srcPos, tgtPos, srcColor });
          }
        } else {
          const dimmed = !!activeArtist;
          drawArc(ctx, srcPos.x, srcPos.y, tgtPos.x, tgtPos.y, srcColor, tgtColor, type, confidence ?? 0.5, dimmed);
        }
      }
    }

    // --- 6.3 Connection particles for selected artist (A10: skip when reduced motion) ---
    if (selectedArtist && selectedArcs.length > 0 && !reducedMotion) {
      const t0 = (performance.now() / 3000) % 1;
      for (let i = 0; i < selectedArcs.length; i++) {
        const arc = selectedArcs[i];
        const t = (t0 + i * (1 / selectedArcs.length)) % 1;
        drawArcParticle(ctx, arc.srcPos.x, arc.srcPos.y, arc.tgtPos.x, arc.tgtPos.y, arc.srcColor, t);
      }
    }

    // --- Three-tier zoom rendering ---
    // B02: Rebuild Supercluster index only when artist array reference changes
    if (scArtistsRef.current !== artists) {
      const index = new Supercluster({ radius: 60, maxZoom: 16 });
      index.load(
        validArtists.map((a) => ({
          type: 'Feature',
          properties: { name: a.name, genres: a.genres },
          geometry: { type: 'Point', coordinates: [a.birth_lng, a.birth_lat] },
        }))
      );
      scIndexRef.current = index;
      scArtistsRef.current = artists;
    }

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

    // Cross-fade alphas (±0.5 zoom units around boundaries)
    // reducedMotion: snap immediately, no cross-fade
    let clusterAlpha = 0;
    let cityAlpha = 0;
    let individualAlpha = 0;

    if (reducedMotion) {
      // Snap — no blending
      if (renderMode === 'cluster') clusterAlpha = 1;
      else if (renderMode === 'city') cityAlpha = 1;
      else individualAlpha = 1;
    } else {
      // Cluster ↔ City cross-fade around ZOOM_CITY (7.5–8.5)
      if (currentZoom < ZOOM_CITY - 0.5) {
        clusterAlpha = 1;
      } else if (currentZoom < ZOOM_CITY + 0.5) {
        const t = (currentZoom - (ZOOM_CITY - 0.5));  // 0→1
        clusterAlpha = 1 - t;
        cityAlpha = t;
      } else if (currentZoom < ZOOM_INDIVIDUAL - 0.5) {
        cityAlpha = 1;
      } else if (currentZoom < ZOOM_INDIVIDUAL + 0.5) {
        // City ↔ Individual cross-fade around ZOOM_INDIVIDUAL (11.5–12.5)
        const t = (currentZoom - (ZOOM_INDIVIDUAL - 0.5));  // 0→1
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
            ctx.font = `600 ${Math.min(14, (8 + Math.log2(count)) | 0)}px "DM Sans", sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = 'rgba(250, 243, 235, 0.8)';
            ctx.fillText(count.toString(), x + 1, y + 1);
            ctx.fillStyle = '#3E3530';
            ctx.fillText(count.toString(), x, y);
            ctx.restore();
          } else {
            const name = cluster.properties.name;
            const artistData = artistMap.get(name);
            if (!artistData) continue;

            const artistOpacityKey = name + '|' + (artistData.birth_year || '');
            const opacity = opacityMap.get(artistOpacityKey)?.opacity ?? 1;
            if (opacity <= 0) continue;

            const connCount = (connectionCounts && connectionCounts.get(name)) || 0;
            const scaleFactor = validArtists.length > 200 ? 0.5 : 1;
            const baseRadius = (40 + Math.min(connCount * 3, 60)) * scaleFactor;

            const isActive = activeArtist && name === activeArtist.name;
            const isConnected = connectedNames.has(name);
            const isPassive = activeArtist && !isActive && !isConnected;

            const { color: genreColor } = getGenreBucket(artistData.genres);
            const textureIndex = BUCKET_COLORS.indexOf(genreColor);
            const orbTexture =
              textureIndex >= 0 && textureIndex < orbTextures.length
                ? orbTextures[textureIndex]
                : orbTextures[orbTextures.length - 1];

            let radius = isActive ? baseRadius * 1.5 : baseRadius;
            if (!isActive && !isConnected && !hasActiveTransitions) {
              let pulseFactor = 1;
              if (!reducedMotion) {
                const hash = name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
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
      for (const [key, group] of cityGroups) {
        const point = map.project([group.lng, group.lat]);
        const { x, y } = point;

        const cityRadius = Math.max(30, Math.sqrt(group.artists.length) * 12);
        // Viewport cull
        if (x < -cityRadius || x > cssWidth + cityRadius || y < -cityRadius || y > cssHeight + cityRadius) continue;

        cityPosMap.set(key, { x, y, radius: cityRadius, group });
        drawCityGroup(ctx, x, y, group.city, group.artists.length, cityRadius, cityAlpha);
      }
    }
    cityPosMapRef.current = cityPosMap;

    // --- Individual mode rendering ---
    if (individualAlpha > 0) {
      // V1: Sort artists for label priority — active first, connected second, then by connection count
      const sortedArtists = [...validArtists].sort((a, b) => {
        const aActive = activeArtist && a.name === activeArtist.name ? 1 : 0;
        const bActive = activeArtist && b.name === activeArtist.name ? 1 : 0;
        if (aActive !== bActive) return bActive - aActive;
        const aConn = connectedNames.has(a.name) ? 1 : 0;
        const bConn = connectedNames.has(b.name) ? 1 : 0;
        if (aConn !== bConn) return bConn - aConn;
        const aCount = (connectionCounts && connectionCounts.get(a.name)) || 0;
        const bCount = (connectionCounts && connectionCounts.get(b.name)) || 0;
        return bCount - aCount;
      });

      // V1: Label collision detection — occupied rects for AABB test
      const occupiedRects = [];

      for (const artist of sortedArtists) {
        const point = posMap.get(artist.name);
        if (!point) continue;

        // Viewport cull
        const margin = 60;
        if (point.x < -margin || point.x > cssWidth + margin || point.y < -margin || point.y > cssHeight + margin) continue;

        const artistOpacityKey = artist.name + '|' + (artist.birth_year || '');
        const opacity = opacityMap.get(artistOpacityKey)?.opacity ?? 1;
        if (opacity <= 0) continue;

        const { color: genreColor } = getGenreBucket(artist.genres);

        const isActive = activeArtist && artist.name === activeArtist.name;
        const isConnected = connectedNames.has(artist.name);
        const isPassive = activeArtist && !isActive && !isConnected;

        let state = 'default';
        if (isActive) state = 'active';
        else if (activeArtist && isConnected) state = 'connected';
        else if (isPassive) state = 'dimmed';

        // Format years: "1756–1791" or "1985–" (en-dash)
        let years = '';
        if (artist.birth_year) {
          years = artist.death_year
            ? `${artist.birth_year}\u2013${artist.death_year}`
            : `${artist.birth_year}\u2013`;
        }

        const r = 16 * (state === 'active' ? 1.2 : 1);

        // V1: Always show labels for hovered/active/connected; collision-check the rest
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

    // --- Label phase --- B2: explicitly reset composite and alpha
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1.0;

    if (activeArtist) {
      const pos = posMapRef.current?.get(activeArtist.name);
      if (pos) {
        const connCount = (connectionCounts && connectionCounts.get(activeArtist.name)) || 0;
        const baseRadius = 40 + Math.min(connCount * 3, 60);
        const radius = baseRadius * 1.5;

        const { bucket, color } = getGenreBucket(activeArtist.genres);
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
        // V2: Flip pill below if too close to top of viewport
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

    // --- P01: Grain phase — pre-composite full-viewport grain canvas ---
    ctx.globalCompositeOperation = 'source-over';

    if (grainSizeRef.current.w !== cssWidth || grainSizeRef.current.h !== cssHeight) {
      const grainFull = document.createElement('canvas');
      grainFull.width = cssWidth;
      grainFull.height = cssHeight;
      const gCtx = grainFull.getContext('2d');
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
      ctx.drawImage(grainFullRef.current, 0, 0);
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

  // --- B4: Sync props into refs and trigger re-render ---
  useEffect(() => {
    artistsRef.current = artists;
    connectionCountsRef.current = connectionCounts;
    connectionsRef.current = connections;
    activeConnectionTypesRef.current = activeConnectionTypes;
    hoveredArtistRef.current = hoveredArtist;
    selectedArtistRef.current = selectedArtist;
    onHoverRef.current = onHover;
    onSelectRef.current = onSelect;

    // P05: Rebuild artistMap when artists change
    const newArtistMap = new Map();
    const valid = (artists || []).filter(a => a.birth_lat != null && a.birth_lng != null);
    for (const artist of valid) {
      newArtistMap.set(artist.name, artist);
    }
    artistMapRef.current = newArtistMap;

    // Rebuild city groups when artists change
    cityGroupsRef.current = buildCityGroups(valid);

    // B6: Reset focused artist index when artists change
    focusedArtistIndexRef.current = -1;

    // V3: Build display offsets for co-located artists
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
          newOffsets.set(group[i].name, { dlat: 0, dlng: 0 });
        } else {
          const angle = i * (2 * Math.PI / count);
          const radius = 0.0008 * Math.ceil(i / 6);
          newOffsets.set(group[i].name, { dlat: Math.sin(angle) * radius, dlng: Math.cos(angle) * radius });
        }
      }
    }
    displayOffsetsRef.current = newOffsets;

    // Trigger re-render when props change
    needsAnimRef.current = true;
    startRaf();
  }, [artists, connectionCounts, connections, activeConnectionTypes, hoveredArtist, selectedArtist, startRaf]);

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

      // B3: In cluster mode, skip individual artist hit testing
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
  }, [mapRef, startRaf]);

  // -------------------------------------------------------------------
  // Hit testing: mousemove, mouseleave, click
  // -------------------------------------------------------------------

  // Helper: find nearest artist in posMap within hit radius
  // Returns { artist, dist } or null
  // B8: reads from artistsRef to avoid stale closure
  const hitTest = useCallback((mx, my) => {
    const mode = renderModeRef.current;
    const posMap = posMapRef.current;
    if (!posMap || posMap.size === 0) return null;

    let nearest = null;
    let nearestDist = Infinity;

    for (const [name, pos] of posMap) {
      const dx = pos.x - mx;
      const dy = pos.y - my;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = name;
      }
    }

    // Hit radius depends on render mode
    let hitRadius;
    if (mode === 'individual') {
      // 22px radius = 44px touch target per WCAG
      hitRadius = 22;
    } else {
      // Cluster/city mode: dynamic hit radius based on orb size
      const connCount = (connectionCountsRef.current?.get(nearest)) || 0;
      const scaleFactor = (artistsRef.current || []).filter(a => a.birth_lat != null).length > 200 ? 0.5 : 1;
      const baseRadius = (40 + Math.min(connCount * 3, 60)) * scaleFactor;
      hitRadius = Math.max(20, baseRadius * 0.4);
    }

    if (nearestDist <= hitRadius && nearest) {
      const validArtists = (artistsRef.current || []).filter(
        (a) => a.birth_lat != null && a.birth_lng != null
      );
      const artist = validArtists.find((a) => a.name === nearest);
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
        } catch (_) {}
        return true;
      }
    }
    return false;
  }, [mapRef]);

  // Handle city group clicks when in city mode → fly to zoom 13
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

  // A09/A05: keyboard handler for canvas — arrow keys to cycle artists, Enter/Space to select
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      const hovered = hoveredArtistRef.current;
      if (hovered) {
        e.preventDefault();
        onSelectRef.current?.(hovered);
      }
      return;
    }

    // A05: ArrowLeft/ArrowRight to cycle through visible artists
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      const posMap = posMapRef.current;
      if (!posMap || posMap.size === 0) return;
      const names = Array.from(posMap.keys());
      if (names.length === 0) return;

      let idx = focusedArtistIndexRef.current;
      if (e.key === 'ArrowRight') {
        idx = idx < 0 ? 0 : (idx + 1) % names.length;
      } else {
        idx = idx < 0 ? names.length - 1 : (idx - 1 + names.length) % names.length;
      }
      focusedArtistIndexRef.current = idx;

      const artistName = names[idx];
      const validArtists = (artistsRef.current || []).filter(
        (a) => a.birth_lat != null && a.birth_lng != null
      );
      const artist = validArtists.find((a) => a.name === artistName);
      if (artist) {
        onHoverRef.current?.(artist);
        // Trigger re-render to show hover state
        needsAnimRef.current = true;
        startRaf();
      }
    }
  }, [startRaf]);

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
        aria-label="Interactive musician visualization map"
        role="img"
      />
      <div
        tabIndex={0}
        onKeyDown={handleKeyDown}
        aria-label="Interactive musician visualization map. Use arrow keys to navigate artists, Enter to select."
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: 1,
          height: 1,
          opacity: 0,
          pointerEvents: 'auto',
        }}
      />
    </>
  );
}

// -------------------------------------------------------------------
// Bloomed arc for hover/selection state
// -------------------------------------------------------------------
function drawArcBloomed(ctx, x1, y1, x2, y2, color1, color2, type, confidence) {
  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2;
  const dist = Math.hypot(x2 - x1, y2 - y1);
  // B3: guard against division by zero
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
