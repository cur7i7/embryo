/**
 * Groups artists by birth city for the "city mode" rendering layer.
 *
 * @param {Object[]} artists - Array of artist objects
 * @returns {Map<string, {city: string, country: string, lat: number, lng: number, artists: Object[]}>}
 *   Map keyed by "city|roundedLat|roundedLng", filtered to groups with 2+ artists
 */
export function buildCityGroups(artists) {
  if (!Array.isArray(artists) || artists.length === 0) {
    return new Map();
  }

  // Internal accumulator map: key -> { city, country, latSum, lngSum, artists[] }
  const accumulator = new Map();

  for (const artist of artists) {
    const city = artist.birth_city;
    const lat = artist.birth_lat;
    const lng = artist.birth_lng;

    // Skip artists missing city or valid coordinates
    if (!city || typeof city !== 'string' || city.trim() === '') continue;
    if (lat == null || lng == null) continue;

    const numLat = Number(lat);
    const numLng = Number(lng);
    if (!isFinite(numLat) || !isFinite(numLng)) continue;

    const key =
      city.toLowerCase().trim() +
      '|' +
      numLat.toFixed(1) +
      '|' +
      numLng.toFixed(1);

    if (accumulator.has(key)) {
      const g = accumulator.get(key);
      g.latSum += numLat;
      g.lngSum += numLng;
      g.artists.push(artist);
    } else {
      accumulator.set(key, {
        city: city.trim(),
        country: artist.birth_country ?? null,
        latSum: numLat,
        lngSum: numLng,
        artists: [artist],
      });
    }
  }

  // Build the output map: compute centroids, sort artists, drop solo groups
  const result = new Map();

  for (const [key, group] of accumulator) {
    if (group.artists.length < 2) continue;

    const count = group.artists.length;

    group.artists.sort((a, b) => {
      const nameA = a.name ?? '';
      const nameB = b.name ?? '';
      return nameA.localeCompare(nameB);
    });

    result.set(key, {
      city: group.city,
      country: group.country,
      lat: group.latSum / count,
      lng: group.lngSum / count,
      artists: group.artists,
    });
  }

  return result;
}
