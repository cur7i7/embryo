import React, { useRef, useEffect, useCallback } from 'react';
import { GENRE_BUCKETS, getGenreBucket } from '../utils/genres.js';
import {
  GENRE_COLORS,
  preRenderOrbTexture,
  createGrainTexture,
} from '../utils/rendering.js';

// Build a stable mapping from genre bucket color -> pre-rendered texture index
const BUCKET_COLORS = Object.values(GENRE_BUCKETS).map((b) => b.color);

export default function CanvasOverlay({ mapRef, artists, connectionCounts }) {
  const canvasRef = useRef(null);

  // Pre-rendered textures — created once, never recreated
  const orbTexturesRef = useRef(null);
  const grainTextureRef = useRef(null);

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

    // --- Orb phase ---
    ctx.globalCompositeOperation = 'screen';

    const validArtists = (artists || []).filter(
      (a) => a.birth_lat != null && a.birth_lng != null
    );

    for (const artist of validArtists) {
      const point = map.project([artist.birth_lng, artist.birth_lat]);

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

      const connections = (connectionCounts && connectionCounts.get(artist.name)) || 0;
      const radius = 40 + Math.min(connections * 3, 60);

      const { color: genreColor } = getGenreBucket(artist.genres);
      const textureIndex = BUCKET_COLORS.indexOf(genreColor);
      const orbTexture =
        textureIndex >= 0 && textureIndex < orbTextures.length
          ? orbTextures[textureIndex]
          : orbTextures[orbTextures.length - 1]; // fallback to last (Other)

      ctx.drawImage(
        orbTexture,
        point.x - radius,
        point.y - radius,
        radius * 2,
        radius * 2
      );
    }

    // --- Grain phase ---
    ctx.globalCompositeOperation = 'source-over';

    const gw = grainTexture.width;
    const gh = grainTexture.height;
    for (let gx = 0; gx < cssWidth; gx += gw) {
      for (let gy = 0; gy < cssHeight; gy += gh) {
        ctx.drawImage(grainTexture, gx, gy);
      }
    }

    ctx.restore();
  }, [artists, connectionCounts, mapRef]);

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

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        pointerEvents: 'none',
        zIndex: 1,
      }}
    />
  );
}
