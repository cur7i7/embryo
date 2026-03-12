import React, { useMemo } from 'react';
import { Map as MapGL, Source, Layer } from 'react-map-gl/maplibre';
import { useArtistData } from '../hooks/useArtistData.js';
import { getGenreBucket } from '../utils/genres.js';
import GenreLegend from './GenreLegend.jsx';

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
        'raster-opacity': 0.3,
      },
    },
  ],
};

const circleLayerStyle = {
  id: 'artist-dots',
  type: 'circle',
  source: 'artists',
  paint: {
    'circle-radius': 3,
    'circle-color': ['get', 'color'],
    'circle-opacity': 0.8,
  },
};

export default function Map() {
  const { artists, loading } = useArtistData();

  const geojson = useMemo(() => {
    const features = artists
      .filter((a) => a.birth_lat != null && a.birth_lng != null)
      .map((a) => {
        const { color } = getGenreBucket(a.genres);
        return {
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [a.birth_lng, a.birth_lat],
          },
          properties: {
            id: a.id,
            name: a.name,
            color,
          },
        };
      });

    return {
      type: 'FeatureCollection',
      features,
    };
  }, [artists]);

  return (
    <div style={{ width: '100vw', height: '100vh', backgroundColor: '#FAF3EB', position: 'relative' }}>
      <MapGL
        initialViewState={{
          longitude: 10,
          latitude: 30,
          zoom: 2,
        }}
        style={{ width: '100%', height: '100%' }}
        mapStyle={mapStyle}
      >
        {!loading && geojson.features.length > 0 && (
          <Source id="artists" type="geojson" data={geojson}>
            <Layer {...circleLayerStyle} />
          </Source>
        )}
      </MapGL>
      <GenreLegend />
    </div>
  );
}
