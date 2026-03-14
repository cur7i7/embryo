import { getGenreBucket, GENRE_BUCKETS } from './genres.js';

const BUCKET_KEYS = Object.keys(GENRE_BUCKETS);

/**
 * Deterministic hash for an artist ID → [0, 1) float.
 * Uses a simple FNV-1a-inspired hash for speed and stability.
 */
function hashId(id) {
  let h = 0x811c9dc5;
  const s = String(id);
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return ((h >>> 0) % 10000) / 10000;
}

/**
 * Split artists into per-genre-bucket FeatureCollections.
 * Applies deterministic jitter per artistId BEFORE splitting so artists
 * from different buckets at the same coordinates get unique, stable positions.
 */
export function artistsByGenreBucket(artists) {
  // 1. Build all features, grouped by original coordinate for jitter
  const coordGroups = new Map();
  const allFeatures = [];
  for (const a of (artists || [])) {
    if (a.birth_lng == null || a.birth_lat == null) continue;
    const bucket = getGenreBucket(a.genres);
    const coordKey = `${a.birth_lng},${a.birth_lat}`;
    const feature = {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [a.birth_lng, a.birth_lat] },
      properties: {
        artistId: a.id,
        name: a.name,
        genre: bucket.bucket,
        genreColor: bucket.color,
        birthYear: a.birth_year ?? null,
        deathYear: a.death_year ?? null,
      },
    };
    allFeatures.push(feature);
    if (!coordGroups.has(coordKey)) coordGroups.set(coordKey, []);
    coordGroups.get(coordKey).push(feature);
  }

  // 2. Apply deterministic jitter globally across all buckets.
  //    Radius scales with group size so dense cities (200+ artists) spread
  //    further instead of forming a visible ring.
  for (const group of coordGroups.values()) {
    if (group.length < 2) continue;
    // Base radius 0.004° (~440m), grows logarithmically for large groups
    const radius = 0.004 + 0.003 * Math.log2(group.length);
    for (const feature of group) {
      const id = feature.properties.artistId;
      // Deterministic angle and radius offset from the artist's own ID
      const h1 = hashId(id);
      const h2 = hashId(id + '_r');
      const angle = h1 * 2 * Math.PI;
      // Vary radius between 30% and 100% of max to avoid center clustering
      const r = radius * (0.3 + 0.7 * h2);
      const [lng, lat] = feature.geometry.coordinates;
      feature.geometry.coordinates = [
        lng + r * Math.cos(angle),
        lat + r * Math.sin(angle),
      ];
    }
  }

  // 3. Split into buckets
  const bucketMap = {};
  for (const key of BUCKET_KEYS) {
    bucketMap[key] = [];
  }
  for (const f of allFeatures) {
    bucketMap[f.properties.genre].push(f);
  }
  return BUCKET_KEYS.map((key) => ({
    key,
    color: GENRE_BUCKETS[key].color,
    geojson: { type: 'FeatureCollection', features: bucketMap[key] },
  }));
}

