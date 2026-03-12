import { GENRE_BUCKETS } from './genres.js';

export const GENRE_COLORS = Object.values(GENRE_BUCKETS).map((b) => b.color);

export function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export function drawArc(ctx, x1, y1, x2, y2, color1, color2, type, confidence, dimmed = false) {
  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2;
  const dist = Math.hypot(x2 - x1, y2 - y1);
  const bulge = dist * 0.25; // control point offset for curvature
  // Perpendicular offset for the control point
  const dx = x2 - x1;
  const dy = y2 - y1;
  const nx = -dy / dist;
  const ny = dx / dist;
  const cpx = midX + nx * bulge;
  const cpy = midY + ny * bulge;

  // Opacity based on confidence; reduce when dimmed (something else is active)
  let alpha = 0.06;
  if (confidence > 0.8) alpha = 0.08;
  if (confidence < 0.5) alpha = 0.04;
  if (dimmed) alpha *= 0.4;

  ctx.save();
  ctx.lineWidth = 0.8;

  // Dash pattern by type
  if (type === 'teacher') {
    ctx.setLineDash([4, 4]);
  } else if (type === 'peer' || type === 'collaboration') {
    ctx.setLineDash([8, 4]);
  } else {
    ctx.setLineDash([]);
  }

  // Gradient from source to target genre color
  const gradient = ctx.createLinearGradient(x1, y1, x2, y2);
  gradient.addColorStop(0, hexToRgba(color1, alpha));
  gradient.addColorStop(1, hexToRgba(color2, alpha));
  ctx.strokeStyle = gradient;

  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.quadraticCurveTo(cpx, cpy, x2, y2);
  ctx.stroke();
  ctx.restore();
}

export function drawOrb(ctx, x, y, radius, genreColor, peachColor = '#FFAB91') {
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
