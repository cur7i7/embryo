import React, { useRef, useState, useCallback } from 'react';
import { Map as MapGL } from 'react-map-gl/maplibre';
import ArtistCount from './ArtistCount.jsx';
import CanvasOverlay from './CanvasOverlay.jsx';

const mapStyle = {
  version: 8,
  sources: {
    osm: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '© OpenStreetMap',
    },
  },
  layers: [
    {
      id: 'osm-tiles',
      type: 'raster',
      source: 'osm',
      paint: {
        'raster-saturation': -1,
        'raster-brightness-min': 0.85,
        'raster-brightness-max': 1,
        'raster-opacity': 0.45,
      },
    },
  ],
};

export default function Map({ artists, connectionCounts, connections, activeConnectionTypes, rangeStart, rangeEnd }) {
  const mapRef = useRef(null);
  const [mapLoaded, setMapLoaded] = useState(false);

  const handleMapLoad = useCallback(() => {
    setMapLoaded(true);
  }, []);

  const visibleCount = (artists || []).filter(
    (a) => a.birth_lat != null && a.birth_lng != null
  ).length;

  return (
    <div style={{ width: '100vw', height: '100vh', backgroundColor: '#FAF3EB', position: 'relative' }}>
      <MapGL
        ref={mapRef}
        initialViewState={{
          longitude: 10,
          latitude: 30,
          zoom: 2,
        }}
        style={{ width: '100%', height: '100%' }}
        mapStyle={mapStyle}
        onLoad={handleMapLoad}
      />
      {mapLoaded && (
        <CanvasOverlay
          mapRef={mapRef}
          artists={artists}
          connectionCounts={connectionCounts}
          connections={connections}
          activeConnectionTypes={activeConnectionTypes}
        />
      )}
      <ArtistCount
        count={visibleCount}
        rangeStart={rangeStart}
        rangeEnd={rangeEnd}
      />
    </div>
  );
}
