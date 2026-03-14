export function hexToRgba(hex, alpha) {
  if (!hex || typeof hex !== 'string') return `rgba(0,0,0,${alpha ?? 1})`;
  // Expand 4-char shorthand (#RGB → #RRGGBB)
  if (/^#[0-9a-fA-F]{3}$/.test(hex)) {
    hex = '#' + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3];
  }
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return `rgba(0,0,0,${alpha ?? 1})`;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}


/**
 * Draw a small glowing particle at position t (0–1) along the quadratic
 * Bézier that matches the arc drawn by drawArc / drawArcBloomed.
 */
export function drawArcParticle(ctx, x1, y1, x2, y2, color, t) {
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

  // Quadratic Bézier point at t
  const mt = 1 - t;
  const px = mt * mt * x1 + 2 * mt * t * cpx + t * t * x2;
  const py = mt * mt * y1 + 2 * mt * t * cpy + t * t * y2;

  const r = parseInt(color.slice(1, 3), 16);
  const g = parseInt(color.slice(3, 5), 16);
  const b = parseInt(color.slice(5, 7), 16);

  const grad = ctx.createRadialGradient(px, py, 0, px, py, 6);
  grad.addColorStop(0, `rgba(255,255,255,0.95)`);
  grad.addColorStop(0.3, `rgba(${r},${g},${b},0.8)`);
  grad.addColorStop(1, `rgba(${r},${g},${b},0)`);

  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(px, py, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
