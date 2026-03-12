import { GENRE_BUCKETS } from './genres.js';

export const GENRE_COLORS = Object.values(GENRE_BUCKETS).map((b) => b.color);

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
