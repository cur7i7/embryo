import { getGenreBucket } from './genres.js';

const DEFAULT_CELL_SIZE_DEG = 2.0;

export function buildHeatmapGrid(artists, cellSizeDeg = DEFAULT_CELL_SIZE_DEG) {
  const safeCell = Math.max(0.5, Number(cellSizeDeg) || DEFAULT_CELL_SIZE_DEG);
  const groups = new Map();

  for (const artist of artists || []) {
    const lat = Number(artist.birth_lat);
    const lng = Number(artist.birth_lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

    const latIdx = Math.round(lat / safeCell);
    const lngIdx = Math.round(lng / safeCell);
    const key = `${latIdx},${lngIdx}`;

    let entry = groups.get(key);
    if (!entry) {
      entry = {
        latIdx,
        lngIdx,
        count: 0,
        genreCounts: new Map(),
      };
      groups.set(key, entry);
    }

    entry.count += 1;
    const color = getGenreBucket(artist.genres).color;
    entry.genreCounts.set(color, (entry.genreCounts.get(color) || 0) + 1);
  }

  let maxCount = 1;
  for (const entry of groups.values()) {
    if (entry.count > maxCount) maxCount = entry.count;
  }

  const cells = [];
  for (const entry of groups.values()) {
    let dominantColor = '#B8336A';
    let best = 0;
    for (const [color, n] of entry.genreCounts.entries()) {
      if (n > best) {
        best = n;
        dominantColor = color;
      }
    }

    cells.push({
      lat: entry.latIdx * safeCell,
      lng: entry.lngIdx * safeCell,
      count: entry.count,
      dominantColor,
      normalizedIntensity: entry.count / maxCount,
    });
  }

  // Draw densest cells first for better additive blending.
  cells.sort((a, b) => b.count - a.count);
  return cells;
}

