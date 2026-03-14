import { useRef, useEffect, useCallback } from 'react';
import { hexToRgba } from '../utils/rendering.js';

export default function ArcOverlay({
  mapRef,
  selectedArtist,
  connectionsByArtist,
  activeConnectionTypes,
  artists,
}) {
  const canvasRef = useRef(null);
  const rafRef = useRef(null);

  // Build artist position lookup
  const artistById = useRef(new Map());
  useEffect(() => {
    const m = new Map();
    for (const a of artists) m.set(a.id, a);
    artistById.current = m;
  }, [artists]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const map = mapRef.current?.getMap();
    if (!canvas || !map || !selectedArtist) {
      if (canvas) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
      return;
    }

    const dpr = window.devicePixelRatio || 1;
    const { width, height } = map.getCanvas().getBoundingClientRect();
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const conns = connectionsByArtist?.get(selectedArtist.id);
    if (!conns) return;

    const srcPt = map.project([selectedArtist.birth_lng, selectedArtist.birth_lat]);

    for (const conn of conns) {
      if (!activeConnectionTypes.has(conn.type)) continue;
      const targetId = conn.source_id === selectedArtist.id ? conn.target_id : conn.source_id;
      const target = artistById.current.get(targetId);
      if (!target || target.birth_lng == null || target.birth_lat == null) continue;

      const tgtPt = map.project([target.birth_lng, target.birth_lat]);
      const x1 = srcPt.x, y1 = srcPt.y, x2 = tgtPt.x, y2 = tgtPt.y;

      // Quadratic Bézier arc
      const midX = (x1 + x2) / 2;
      const midY = (y1 + y2) / 2;
      const dist = Math.hypot(x2 - x1, y2 - y1);
      if (dist < 1) continue;

      const bulge = dist * 0.2;
      const nx = -(y2 - y1) / dist;
      const ny = (x2 - x1) / dist;
      const cpx = midX + nx * bulge;
      const cpy = midY + ny * bulge;

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.quadraticCurveTo(cpx, cpy, x2, y2);

      // Style by connection type
      const alpha = 0.25 + (conn.confidence ?? 0.5) * 0.25;
      ctx.strokeStyle = hexToRgba('#3E3530', alpha);
      ctx.lineWidth = 1.5;
      if (conn.type === 'influence') ctx.setLineDash([4, 4]);
      else if (conn.type === 'peer' || conn.type === 'collaboration') ctx.setLineDash([8, 4]);
      else ctx.setLineDash([]);

      ctx.stroke();
      ctx.setLineDash([]);
    }
  }, [mapRef, selectedArtist, connectionsByArtist, activeConnectionTypes]);

  // Redraw on map move
  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!map) return;

    const redraw = () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(draw);
    };

    map.on('move', redraw);
    map.on('zoom', redraw);
    redraw();

    return () => {
      map.off('move', redraw);
      map.off('zoom', redraw);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [mapRef, draw]);

  // Redraw when selection changes
  useEffect(() => { draw(); }, [draw]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        pointerEvents: 'none',
        zIndex: 2,
      }}
    />
  );
}
