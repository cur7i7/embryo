/**
 * Fly the map to an artist's birth location.
 *
 * @param {React.RefObject} mapRef – react-map-gl ref
 * @param {object} artist – artist object with birth_lng / birth_lat
 * @param {object} [opts] – extra options forwarded to map.flyTo(); `zoom`
 *   defaults to the greater of the current zoom and 6.
 */
export function flyToArtist(mapRef, artist, opts = {}) {
  if (!mapRef?.current || artist?.birth_lng == null || artist?.birth_lat == null) return;
  try {
    const map = mapRef.current.getMap();
    const currentZoom = map.getZoom();
    map.flyTo({
      center: [artist.birth_lng, artist.birth_lat],
      zoom: opts.zoom ?? Math.max(currentZoom, 6),
      ...opts,
    });
  } catch (err) {
    if (import.meta.env.DEV) console.warn('flyTo failed:', err);
  }
}
