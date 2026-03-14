import { getGenreBucket, GENRE_BUCKETS } from './genres.js';

const BUCKET_KEYS = Object.keys(GENRE_BUCKETS);

export function artistsToGeoJSON(artists) {
  const features = [];
  for (const a of artists) {
    if (!a.birth_lng || !a.birth_lat) continue;
    const bucket = getGenreBucket(a.genres);
    features.push({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [a.birth_lng, a.birth_lat],
      },
      properties: {
        artistId: a.id,
        name: a.name,
        genre: bucket.bucket,       // NOTE: getGenreBucket returns { bucket: string, color: string }
        genreColor: bucket.color,
        birthYear: a.birth_year ?? null,
        deathYear: a.death_year ?? null,
      },
    });
  }
  return { type: 'FeatureCollection', features };
}

export const clusterProperties = Object.fromEntries(
  BUCKET_KEYS.map((key) => [
    key,
    ['+', ['case', ['==', ['get', 'genre'], key], 1, 0]],
  ])
);

export function buildDominantGenreColorExpression() {
  const pairs = BUCKET_KEYS.map((key) => ({
    key,
    color: GENRE_BUCKETS[key].color,
  }));

  const conditions = [];
  for (const { key, color } of pairs) {
    const isMax = ['all',
      ...pairs
        .filter((p) => p.key !== key)
        .map((p) => ['>=', ['get', key], ['get', p.key]]),
    ];
    conditions.push(isMax, color);
  }

  return ['case', ...conditions, '#FFCB78'];
}

export const individualColorExpression = [
  'match',
  ['get', 'genre'],
  ...BUCKET_KEYS.flatMap((key) => [key, GENRE_BUCKETS[key].color]),
  '#FFCB78',
];
