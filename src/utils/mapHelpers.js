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
    const { zoom: _zoom, ...restOpts } = opts;
    map.flyTo({
      center: [artist.birth_lng, artist.birth_lat],
      zoom: opts.zoom != null ? opts.zoom : Math.max(currentZoom, 10),
      ...restOpts,
    });
  } catch (err) {
    if (import.meta.env.DEV) console.warn('flyTo failed:', err);
  }
}

/**
 * Fly to a specific waypoint with controlled speed for journey playback.
 * Returns a Promise that resolves when the fly animation completes.
 */
export function flyToWaypoint(mapRef, lng, lat, zoom = 10, speed = 0.8) {
  return new Promise((resolve) => {
    if (!mapRef?.current) { resolve(); return; }
    try {
      const map = mapRef.current.getMap();
      const onMoveEnd = () => {
        map.off('moveend', onMoveEnd);
        resolve();
      };
      map.on('moveend', onMoveEnd);
      map.flyTo({ center: [lng, lat], zoom, speed, essential: true });
      setTimeout(() => { map.off('moveend', onMoveEnd); resolve(); }, 8000);
    } catch (err) {
      if (import.meta.env.DEV) console.warn('flyToWaypoint failed:', err);
      resolve();
    }
  });
}
