import React, { useRef, useEffect, useCallback } from 'react';
import { GENRE_BUCKETS, getGenreBucket } from '../utils/genres.js';
import {
  GENRE_COLORS,
  preRenderOrbTexture,
  createGrainTexture,
  drawArc,
  hexToRgba,
} from '../utils/rendering.js';

// Build a stable mapping from genre bucket color -> pre-rendered texture index
const BUCKET_COLORS = Object.values(GENRE_BUCKETS).map((b) => b.color);

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

  // Initialize textures once on mount
  useEffect(() => {
    orbTexturesRef.current = GENRE_COLORS.map((color) =>
      preRenderOrbTexture(color, 200)
    );
    grainTextureRef.current = createGrainTexture(512, 512);
  }, []);

  const render = useCallback(() => {
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

    // Scale all drawing operations by dpr for crisp output
    ctx.save();
    ctx.scale(dpr, dpr);

    const validArtists = (artists || []).filter(
      (a) => a.birth_lat != null && a.birth_lng != null
    );

    // Determine active interaction target
    const activeArtist = hoveredArtist || selectedArtist;

    // Build name -> screen position map for O(1) lookup
    const posMap = new Map();
    for (const artist of validArtists) {
      const point = map.project([artist.birth_lng, artist.birth_lat]);
      posMap.set(artist.name, point);
    }
    // Store in ref for mousemove handler
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

    // --- Arc phase ---
    ctx.globalCompositeOperation = 'source-over';

    if (connections && connections.length > 0 && activeConnectionTypes && activeConnectionTypes.size > 0) {
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
          activeArtist &&
          (conn.source_name === activeArtist.name || conn.target_name === activeArtist.name);

        if (isConnected) {
          // Bloom: higher opacity and wider line
          drawArcBloomed(ctx, srcPos.x, srcPos.y, tgtPos.x, tgtPos.y, srcColor, tgtColor, type, confidence ?? 0.5);
        } else {
          // Default rendering (dim slightly if something is hovered)
          const dimmed = !!activeArtist;
          drawArc(ctx, srcPos.x, srcPos.y, tgtPos.x, tgtPos.y, srcColor, tgtColor, type, confidence ?? 0.5, dimmed);
        }
      }
    }

    // --- Orb phase ---
    ctx.globalCompositeOperation = 'screen';

    for (const artist of validArtists) {
      const point = posMap.get(artist.name);
      if (!point) continue;

      // Skip artists that are far off-screen (generous margin equal to max radius)
      const maxRadius = 100; // 40 + 60
      if (
        point.x < -maxRadius ||
        point.x > cssWidth + maxRadius ||
        point.y < -maxRadius ||
        point.y > cssHeight + maxRadius
      ) {
        continue;
      }

      const connCount = (connectionCounts && connectionCounts.get(artist.name)) || 0;
      const baseRadius = 40 + Math.min(connCount * 3, 60);

      // Visual state
      const isActive = activeArtist && artist.name === activeArtist.name;
      const isConnected = connectedNames.has(artist.name);
      const isPassive = activeArtist && !isActive && !isConnected;

      const radius = isActive ? baseRadius * 1.5 : baseRadius;

      const { color: genreColor } = getGenreBucket(artist.genres);
      const textureIndex = BUCKET_COLORS.indexOf(genreColor);
      const orbTexture =
        textureIndex >= 0 && textureIndex < orbTextures.length
          ? orbTextures[textureIndex]
          : orbTextures[orbTextures.length - 1];

      if (isPassive) {
        ctx.globalAlpha = 0.4;
      } else {
        ctx.globalAlpha = 1.0;
      }

      ctx.drawImage(
        orbTexture,
        point.x - radius,
        point.y - radius,
        radius * 2,
        radius * 2
      );
    }

    ctx.globalAlpha = 1.0;

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

        // Background pill for readability
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

        // Genre color accent line at top of pill
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

  // Attach map event listeners and trigger renders
  useEffect(() => {
    const map = mapRef.current?.getMap?.();
    if (!map) return;

    const events = ['move', 'zoom', 'resize'];
    events.forEach((evt) => map.on(evt, render));

    // Initial draw
    render();

    return () => {
      events.forEach((evt) => map.off(evt, render));
    };
  }, [render, mapRef]);

  // Re-render when artists or connection counts change
  useEffect(() => {
    render();
  }, [render]);

  // Mousemove handler for hit testing
  const handleMouseMove = useCallback((e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    const posMap = posMapRef.current;
    if (!posMap || posMap.size === 0) {
      onHover?.(null);
      canvas.style.cursor = 'default';
      return;
    }

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

    // Hit radius: use effective radius for active artist
    const HIT_RADIUS = 20;
    if (nearestDist <= HIT_RADIUS && nearest) {
      const validArtists = (artists || []).filter(
        (a) => a.birth_lat != null && a.birth_lng != null
      );
      const artist = validArtists.find((a) => a.name === nearest);
      if (artist) {
        onHover?.(artist);
        canvas.style.cursor = 'pointer';
        return;
      }
    }

    onHover?.(null);
    canvas.style.cursor = 'default';
  }, [artists, onHover]);

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

    const posMap = posMapRef.current;
    if (!posMap || posMap.size === 0) {
      onSelect?.(null);
      return;
    }

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
      if (artist) {
        onSelect?.(artist);
        return;
      }
    }

    onSelect?.(null);
  }, [artists, onSelect]);

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

// Bloomed arc for hover/selection state
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
