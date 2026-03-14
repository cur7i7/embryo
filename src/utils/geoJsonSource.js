import { getGenreBucket, GENRE_BUCKETS } from './genres.js';

const BUCKET_KEYS = Object.keys(GENRE_BUCKETS);

/**
 * Split artists into per-genre-bucket FeatureCollections.
 * Applies global jitter BEFORE splitting so artists from different
 * buckets at the same coordinates also get unique positions.
 */
export function artistsByGenreBucket(artists) {
  // 1. Build all features first, grouped by original coordinate for jitter
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

  // 2. Apply jitter globally across all buckets
  for (const group of coordGroups.values()) {
    if (group.length < 2) continue;
    const radius = 0.003;
    for (let i = 0; i < group.length; i++) {
      const angle = (2 * Math.PI * i) / group.length;
      const [lng, lat] = group[i].geometry.coordinates;
      group[i].geometry.coordinates = [
        lng + radius * Math.cos(angle),
        lat + radius * Math.sin(angle),
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

