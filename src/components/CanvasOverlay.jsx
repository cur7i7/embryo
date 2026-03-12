import React, { useRef, useEffect, useCallback } from 'react';
import Supercluster from 'supercluster';
import { GENRE_BUCKETS, getGenreBucket } from '../utils/genres.js';
import {
  GENRE_COLORS,
  preRenderOrbTexture,
  createGrainTexture,
  drawArc,
  drawArcParticle,
  hexToRgba,
} from '../utils/rendering.js';

// Build a stable mapping from genre bucket color -> pre-rendered texture index
const BUCKET_COLORS = Object.values(GENRE_BUCKETS).map((b) => b.color);

// --- 6.4 Supercluster threshold ---
const CLUSTER_THRESHOLD = 500;

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

  // --- 6.4 Supercluster index ref ---
  const scIndexRef = useRef(null);
  const scArtistsRef = useRef(null); // the array used to build the last index

  // Initialize textures once on mount
  useEffect(() => {
    orbTexturesRef.current = GENRE_COLORS.map((color) =>
      preRenderOrbTexture(color, 200)
    );
    grainTextureRef.current = createGrainTexture(512, 512);
  }, []);

  // -------------------------------------------------------------------
  // Core render function
  // -------------------------------------------------------------------
  const render = useCallback((ts) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const map = mapRef.current?.getMap?.();
    if (!map) return;

    const orbTextures = orbTexturesRef.current;
    const grainTexture = grainTextureRef.current;
    if (!orbTextures || !grainTexture) return;

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
    const currentNames = new Set(validArtists.map((a) => a.name));

    // Mark targets
    for (const artist of validArtists) {
      if (!opacityMap.has(artist.name)) {
        opacityMap.set(artist.name, { opacity: 0, target: 1 });
      } else {
        opacityMap.get(artist.name).target = 1;
      }
    }
    for (const [name, entry] of opacityMap) {
      if (!currentNames.has(name)) {
        entry.target = 0;
      }
    }

    // Lerp and clean up
    let hasActiveTransitions = false;
    for (const [name, entry] of opacityMap) {
      if (entry.opacity !== entry.target) {
        const dir = entry.target > entry.opacity ? 1 : -1;
        entry.opacity = Math.max(0, Math.min(1, entry.opacity + dir * fadeStep));
        if (Math.abs(entry.opacity - entry.target) < 0.01) {
          entry.opacity = entry.target;
        }
        if (entry.opacity !== entry.target) hasActiveTransitions = true;
      }
      if (entry.opacity === 0 && entry.target === 0) {
        opacityMap.delete(name);
      }
    }

    // Determine if pulse needs continuous rAF
    const hasPulseArtists = validArtists.length > 0;
    needsAnimRef.current = hasActiveTransitions || hasPulseArtists;

    // Determine active interaction target
    const activeArtist = hoveredArtist || selectedArtist;

    // --- 6.5 Only draw arcs when something is active ---
    // Build name -> screen position map
    const posMap = new Map();
    for (const artist of validArtists) {
      const point = map.project([artist.birth_lng, artist.birth_lat]);
      posMap.set(artist.name, point);
    }
    posMapRef.current = posMap;

    // Build name -> artist map for genre color lookup
    const artistMap = new Map();
    for (const artist of validArtists) {
      artistMap.set(artist.name, artist);
    }

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

    // --- 6.3 Connection particles for selected artist ---
    if (selectedArtist && selectedArcs.length > 0) {
      const t0 = (performance.now() / 3000) % 1;
      for (let i = 0; i < selectedArcs.length; i++) {
        const arc = selectedArcs[i];
        const t = (t0 + i * (1 / selectedArcs.length)) % 1;
        drawArcParticle(ctx, arc.srcPos.x, arc.srcPos.y, arc.tgtPos.x, arc.tgtPos.y, arc.srcColor, t);
      }
    }

    // --- 6.4 Supercluster: cluster when > CLUSTER_THRESHOLD artists ---
    if (validArtists.length > CLUSTER_THRESHOLD) {
      // Rebuild index only when artist set changes
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

      const index = scIndexRef.current;
      const bounds = map.getBounds();
      const zoom = Math.floor(map.getZoom());
      const clusters = index.getClusters(
        [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()],
        zoom
      );

      // --- Orb phase (clustered) ---
      ctx.globalCompositeOperation = 'screen';

      for (const cluster of clusters) {
        const [lng, lat] = cluster.geometry.coordinates;
        const point = map.project([lng, lat]);
        const { x, y } = point;

        // Skip off-screen
        const maxRadius = 120;
        if (x < -maxRadius || x > cssWidth + maxRadius || y < -maxRadius || y > cssHeight + maxRadius) continue;

        if (cluster.properties.cluster) {
          // Draw cluster orb — larger, with count
          const count = cluster.properties.point_count;
          const clusterRadius = Math.min(40 + Math.log2(count) * 12, 100);

          // Use first orb texture scaled up
          const orbTexture = orbTextures[0];
          ctx.globalAlpha = 0.85;
          ctx.drawImage(orbTexture, x - clusterRadius, y - clusterRadius, clusterRadius * 2, clusterRadius * 2);
          ctx.globalAlpha = 1.0;

          // Count label
          ctx.globalCompositeOperation = 'source-over';
          ctx.font = `600 ${Math.min(14, 8 + Math.log2(count) | 0)}px "DM Sans", sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = 'rgba(0,0,0,0.5)';
          ctx.fillText(count.toString(), x + 1, y + 1);
          ctx.fillStyle = '#FAF3EB';
          ctx.fillText(count.toString(), x, y);
          ctx.textBaseline = 'alphabetic';
          ctx.globalCompositeOperation = 'screen';
        } else {
          // Single point — draw normally
          const name = cluster.properties.name;
          const artistData = artistMap.get(name);
          if (!artistData) continue;

          const opacity = opacityMap.get(name)?.opacity ?? 1;
          if (opacity <= 0) continue;

          const connCount = (connectionCounts && connectionCounts.get(name)) || 0;
          // 6.5: Reduce radius when >200 visible
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

          // 6.2 Pulse (only when not active/hovered)
          let radius = isActive ? baseRadius * 1.5 : baseRadius;
          if (!isActive && !isConnected && !hasActiveTransitions) {
            const hash = name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
            const phase = ((performance.now() / 3000) + hash * 0.1) % 1;
            const pulseFactor = 1 + 0.05 * Math.sin(phase * Math.PI * 2);
            radius *= pulseFactor;
          }

          const baseAlpha = isPassive ? 0.4 : 1.0;
          ctx.globalAlpha = baseAlpha * opacity;

          ctx.drawImage(orbTexture, x - radius, y - radius, radius * 2, radius * 2);
        }
      }

      ctx.globalAlpha = 1.0;
    } else {
      // --- Orb phase (unclustered, <= CLUSTER_THRESHOLD artists) ---
      // Invalidate stale cluster index
      scArtistsRef.current = null;
      scIndexRef.current = null;

      ctx.globalCompositeOperation = 'screen';

      for (const artist of validArtists) {
        const point = posMap.get(artist.name);
        if (!point) continue;

        const opacity = opacityMap.get(artist.name)?.opacity ?? 1;
        if (opacity <= 0) continue;

        // Skip artists far off-screen
        const maxRadius = 120;
        if (
          point.x < -maxRadius ||
          point.x > cssWidth + maxRadius ||
          point.y < -maxRadius ||
          point.y > cssHeight + maxRadius
        ) {
          continue;
        }

        const connCount = (connectionCounts && connectionCounts.get(artist.name)) || 0;
        // 6.5: Reduce radius when >200 visible
        const scaleFactor = validArtists.length > 200 ? 0.5 : 1;
        const baseRadius = (40 + Math.min(connCount * 3, 60)) * scaleFactor;

        const isActive = activeArtist && artist.name === activeArtist.name;
        const isConnected = connectedNames.has(artist.name);
        const isPassive = activeArtist && !isActive && !isConnected;

        // 6.2 Pulse (only when not active/hovered)
        let radius = isActive ? baseRadius * 1.5 : baseRadius;
        if (!isActive && !isConnected && !hasActiveTransitions) {
          const hash = artist.name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
          const phase = ((performance.now() / 3000) + hash * 0.1) % 1;
          const pulseFactor = 1 + 0.05 * Math.sin(phase * Math.PI * 2);
          radius *= pulseFactor;
        }

        const { color: genreColor } = getGenreBucket(artist.genres);
        const textureIndex = BUCKET_COLORS.indexOf(genreColor);
        const orbTexture =
          textureIndex >= 0 && textureIndex < orbTextures.length
            ? orbTextures[textureIndex]
            : orbTextures[orbTextures.length - 1];

        const baseAlpha = isPassive ? 0.4 : 1.0;
        ctx.globalAlpha = baseAlpha * opacity;

        ctx.drawImage(
          orbTexture,
          point.x - radius,
          point.y - radius,
          radius * 2,
          radius * 2
        );
      }

      ctx.globalAlpha = 1.0;
    }

    // --- Label phase ---
    ctx.globalCompositeOperation = 'source-over';

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
        const pillY = pos.y - radius - 52;
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
        ctx.fillText(label, pos.x, pos.y - radius - 26);

        ctx.font = '400 11px "DM Sans", sans-serif';
        ctx.fillStyle = '#7A6E65';
        ctx.fillText(sublabel, pos.x, pos.y - radius - 12);
      }
    }

    // --- Grain phase ---
    ctx.globalCompositeOperation = 'source-over';

    const gw = grainTextureRef.current.width;
    const gh = grainTextureRef.current.height;
    for (let gx = 0; gx < cssWidth; gx += gw) {
      for (let gy = 0; gy < cssHeight; gy += gh) {
        ctx.drawImage(grainTextureRef.current, gx, gy);
      }
    }

    ctx.restore();
  }, [artists, connectionCounts, connections, activeConnectionTypes, hoveredArtist, selectedArtist, mapRef]);

  // -------------------------------------------------------------------
  // rAF loop management — runs when transitions or pulse is active
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

  // Kick off rAF whenever artists changes (potential fade transition starts)
  // or whenever hoveredArtist/selectedArtist changes (particles need animation)
  useEffect(() => {
    needsAnimRef.current = true;
    startRaf();
  }, [artists, hoveredArtist, selectedArtist, startRaf]);

  // Attach map event listeners — fire a single render on map events
  useEffect(() => {
    const map = mapRef.current?.getMap?.();
    if (!map) return;

    const onMapEvent = () => {
      needsAnimRef.current = true;
      startRaf();
    };

    const events = ['move', 'zoom', 'resize'];
    events.forEach((evt) => map.on(evt, onMapEvent));

    // Initial draw
    needsAnimRef.current = true;
    startRaf();

    return () => {
      events.forEach((evt) => map.off(evt, onMapEvent));
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [render, mapRef, startRaf]);

  // -------------------------------------------------------------------
  // Hit testing: mousemove, mouseleave, click
  // -------------------------------------------------------------------

  // Helper: find nearest artist in posMap within given hit radius
  // Returns { artist, dist } or null
  const hitTest = useCallback((mx, my) => {
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

    const HIT_RADIUS = 20;
    if (nearestDist <= HIT_RADIUS && nearest) {
      const validArtists = (artists || []).filter(
        (a) => a.birth_lat != null && a.birth_lng != null
      );
      const artist = validArtists.find((a) => a.name === nearest);
      if (artist) return { artist, dist: nearestDist };
    }
    return null;
  }, [artists]);

  // Handle cluster clicks when clustering is active
  const handleClusterClick = useCallback((mx, my) => {
    const map = mapRef.current?.getMap?.();
    const index = scIndexRef.current;
    if (!map || !index) return false;

    const validArtists = (artists || []).filter(
      (a) => a.birth_lat != null && a.birth_lng != null
    );
    if (validArtists.length <= CLUSTER_THRESHOLD) return false;

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
  }, [artists, mapRef]);

  const handleMouseMove = useCallback((e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    const hit = hitTest(mx, my);
    if (hit) {
      onHover?.(hit.artist);
      canvas.style.cursor = 'pointer';
    } else {
      onHover?.(null);
      canvas.style.cursor = 'default';
    }
  }, [hitTest, onHover]);

  const handleMouseLeave = useCallback(() => {
    onHover?.(null);
    if (canvasRef.current) {
      canvasRef.current.style.cursor = 'default';
    }
  }, [onHover]);

  const handleClick = useCallback((e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    // Try cluster click first
    if (handleClusterClick(mx, my)) return;

    const hit = hitTest(mx, my);
    if (hit) {
      onSelect?.(hit.artist);
    } else {
      onSelect?.(null);
    }
  }, [hitTest, handleClusterClick, onSelect]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        pointerEvents: 'auto',
        zIndex: 1,
        cursor: 'default',
      }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
      aria-label="Interactive musician visualization map"
      role="img"
    />
  );
}

// -------------------------------------------------------------------
// Bloomed arc for hover/selection state
// -------------------------------------------------------------------
function drawArcBloomed(ctx, x1, y1, x2, y2, color1, color2, type, confidence) {
  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2;
  const dist = Math.hypot(x2 - x1, y2 - y1);
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
