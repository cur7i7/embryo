import { GENRE_BUCKETS } from './genres.js';

export const GENRE_COLORS = Object.values(GENRE_BUCKETS).map((b) => b.color);

export function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}


export function drawOrb(ctx, x, y, radius, genreColor, peachColor = '#EEC1A2') {
  // 1. Primary gradient — genre color dissolving to transparent
  const primary = ctx.createRadialGradient(x, y, 0, x, y, radius);
  primary.addColorStop(0, genreColor + '47');   // ~28% opacity
  primary.addColorStop(0.4, genreColor + '2B'); // ~17% opacity
  primary.addColorStop(0.7, genreColor + '0F'); // ~6% opacity
  primary.addColorStop(1, genreColor + '00');    // transparent
  ctx.fillStyle = primary;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();

  // 2. Secondary warm bleed — offset down-right, warm peach
  const offsetX = radius * 0.3;
  const offsetY = radius * 0.3;
  const bleedRadius = radius * 0.7;
  const bleed = ctx.createRadialGradient(
    x + offsetX, y + offsetY, 0,
    x + offsetX, y + offsetY, bleedRadius
  );
  bleed.addColorStop(0, peachColor + '20'); // ~12% opacity
  bleed.addColorStop(0.5, peachColor + '10');
  bleed.addColorStop(1, peachColor + '00');
  ctx.fillStyle = bleed;
  ctx.beginPath();
  ctx.arc(x + offsetX, y + offsetY, bleedRadius, 0, Math.PI * 2);
  ctx.fill();

  // 3. Core dot — white center to genre color
  const coreR = 4;
  const core = ctx.createRadialGradient(x - 1, y - 1, 0, x, y, coreR);
  core.addColorStop(0, '#FFFFFFEE');
  core.addColorStop(0.4, genreColor + 'EE');
  core.addColorStop(1, genreColor + 'AA');
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.arc(x, y, coreR, 0, Math.PI * 2);
  ctx.fill();
}

export function createGrainTexture(width = 512, height = 512) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  const imgData = ctx.createImageData(width, height);
  for (let i = 0; i < imgData.data.length; i += 4) {
    const v = Math.random() * 40;
    imgData.data[i] = v;
    imgData.data[i + 1] = v;
    imgData.data[i + 2] = v;
    imgData.data[i + 3] = 18; // very subtle
  }
  ctx.putImageData(imgData, 0, 0);
  return canvas;
}

export function preRenderOrbTexture(genreColor, size = 200) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2;
  drawOrb(ctx, cx, cy, r, genreColor);
  return canvas;
}

/**
 * Draw an individual artist node: outlined circle + name + years.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x - screen x
 * @param {number} y - screen y
 * @param {number} radius - base radius (16 default)
 * @param {string} genreColor - hex color for the genre
 * @param {string} name - artist name
 * @param {string} years - formatted year string e.g. "1756–1791" or "1985–"
 * @param {'default'|'active'|'connected'|'dimmed'} state
 * @param {number} alpha - overall opacity (0–1), used for cross-fade
 */
export function drawArtistNode(ctx, x, y, radius, genreColor, name, years, state = 'default', alpha = 1, showLabel = true, labelOffsetY = 0) {
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha = alpha;

  const scale = state === 'active' ? 1.2 : 1;
  const r = radius * scale;
  const strokeWidth = state === 'active' ? 3 : 2;

  // Dimmed state: reduce opacity
  if (state === 'dimmed') {
    ctx.globalAlpha = alpha * 0.4;
  }

  // Circle fill: genre color at 10% opacity
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = hexToRgba(genreColor, 0.1);
  ctx.fill();

  // Circle stroke
  ctx.lineWidth = strokeWidth;
  ctx.strokeStyle = genreColor;
  ctx.stroke();

  if (showLabel) {
    // Truncate name > 20 chars
    const displayName = name.length > 20 ? name.slice(0, 19) + '\u2026' : name;

    // Measure text for background pill
    ctx.font = '600 12px "DM Sans", sans-serif';
    const nameW = ctx.measureText(displayName).width;
    let totalH = 14; // name line height
    let maxW = nameW;
    let yearsW = 0;
    if (years) {
      ctx.font = '400 10px "DM Sans", sans-serif';
      yearsW = ctx.measureText(years).width;
      maxW = Math.max(nameW, yearsW);
      totalH += 4 + 12; // gap + years line height
    }

    // Background pill behind labels
    const padH = 6;
    const padV = 3;
    const pillX = x - maxW / 2 - padH;
    const pillY = y + r + 2 + labelOffsetY - padV;
    const pillW = maxW + padH * 2;
    const pillH = totalH + padV * 2 + 4; // +4 for top offset from circle
    const br = 4;

    ctx.fillStyle = 'rgba(250, 243, 235, 0.82)';
    ctx.beginPath();
    ctx.moveTo(pillX + br, pillY);
    ctx.lineTo(pillX + pillW - br, pillY);
    ctx.quadraticCurveTo(pillX + pillW, pillY, pillX + pillW, pillY + br);
    ctx.lineTo(pillX + pillW, pillY + pillH - br);
    ctx.quadraticCurveTo(pillX + pillW, pillY + pillH, pillX + pillW - br, pillY + pillH);
    ctx.lineTo(pillX + br, pillY + pillH);
    ctx.quadraticCurveTo(pillX, pillY + pillH, pillX, pillY + pillH - br);
    ctx.lineTo(pillX, pillY + br);
    ctx.quadraticCurveTo(pillX, pillY, pillX + br, pillY);
    ctx.closePath();
    ctx.fill();

    // Name label below circle
    ctx.font = '600 12px "DM Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#3E3530';
    ctx.fillText(displayName, x, y + r + 6 + labelOffsetY);

    // Years below name
    if (years) {
      ctx.font = '400 10px "DM Sans", sans-serif';
      ctx.fillStyle = '#6B5F55';
      ctx.fillText(years, x, y + r + 22 + labelOffsetY);
    }
  }

  ctx.restore();
}

/**
 * Draw a city-group boundary circle with label and artist count.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x - screen x
 * @param {number} y - screen y
 * @param {string} city - city name
 * @param {number} count - number of artists
 * @param {number} radius - boundary circle radius
 * @param {number} alpha - overall opacity (0–1), used for cross-fade
 */
export function drawCityGroup(ctx, x, y, city, count, radius, alpha = 1) {
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha = alpha;

  // Dashed boundary circle
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.setLineDash([4, 4]);
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(62,53,48,0.25)';
  ctx.stroke();
  ctx.setLineDash([]);

  // City name centered above the boundary circle (skip if city is null/empty)
  if (city) {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    const labelY = y - radius - 6;

    // Measure city name width to position count after it
    ctx.font = '600 13px "DM Sans", sans-serif';
    const cityWidth = ctx.measureText(city).width;
    ctx.font = '400 11px "DM Sans", sans-serif';
    const countStr = ` (${count})`;
    const countWidth = ctx.measureText(countStr).width;
    const totalWidth = cityWidth + countWidth;

    // Draw city name (bold)
    ctx.font = '600 13px "DM Sans", sans-serif';
    ctx.fillStyle = '#3E3530';
    ctx.fillText(city, x - totalWidth / 2 + cityWidth / 2, labelY);

    // Draw count (lighter)
    ctx.font = '400 11px "DM Sans", sans-serif';
    ctx.fillStyle = '#6B5F55';
    ctx.fillText(countStr, x - totalWidth / 2 + cityWidth + countWidth / 2, labelY);
  }

  ctx.restore();
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
