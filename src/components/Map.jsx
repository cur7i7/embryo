import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { Map as MapGL } from 'react-map-gl/maplibre';
import { Source, Layer } from 'react-map-gl/maplibre';
import ArtistCount from './ArtistCount.jsx';
import ArcOverlay from './ArcOverlay.jsx';
import { artistsByGenreBucket } from '../utils/geoJsonSource.js';
import { GENRE_BUCKETS, getTextColorForBg } from '../utils/genres.js';

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
        'raster-saturation': -0.35,
        'raster-brightness-min': 0.55,
        'raster-brightness-max': 1,
        'raster-opacity': 0.75,
      },
    },
  ],
};

// Layer factories — one set per genre bucket source
function makeClusterCircleLayer(sourceId, color) {
  return {
    id: `${sourceId}-clusters`,
    type: 'circle',
    source: sourceId,
    filter: ['has', 'point_count'],
    paint: {
      'circle-color': color,
      'circle-radius': [
        'interpolate', ['linear'], ['zoom'],
        0, ['step', ['get', 'point_count'], 3, 10, 4, 50, 5, 200, 7],
        5, ['step', ['get', 'point_count'], 5, 10, 7, 50, 9, 200, 12],
        10, ['step', ['get', 'point_count'], 10, 10, 13, 50, 17, 200, 22],
      ],
      'circle-opacity': 0.75,
      'circle-stroke-width': 1.5,
      'circle-stroke-color': color,
      'circle-stroke-opacity': 0.9,
    },
  };
}

function makeClusterCountLayer(sourceId, textColor = '#FFFFFF') {
  return {
    id: `${sourceId}-cluster-count`,
    type: 'symbol',
    source: sourceId,
    filter: ['has', 'point_count'],
    minzoom: 5,
    layout: {
      'text-field': '{point_count_abbreviated}',
      'text-font': ['Noto Sans Regular'],
      'text-size': [
        'interpolate', ['linear'], ['zoom'],
        5, ['step', ['get', 'point_count'], 8, 50, 9, 500, 10],
        10, ['step', ['get', 'point_count'], 10, 50, 12, 500, 14],
      ],
      'text-allow-overlap': true,
    },
    paint: {
      'text-color': textColor,
      'text-halo-color': textColor === '#1A1512' ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.4)',
      'text-halo-width': 1.5,
    },
  };
}

function makeUnclusteredPointLayer(sourceId, color) {
  return {
    id: `${sourceId}-point`,
    type: 'circle',
    source: sourceId,
    filter: ['!', ['has', 'point_count']],
    paint: {
      'circle-color': color,
      'circle-radius': [
        'interpolate', ['linear'], ['zoom'],
        0, 1.5,
        5, 3,
        10, 7,
        14, 12,
      ],
      'circle-opacity': 0.75,
      'circle-stroke-width': 1,
      'circle-stroke-color': color,
      'circle-stroke-opacity': 0.9,
    },
  };
}

function makeUnclusteredLabelLayer(sourceId) {
  return {
    id: `${sourceId}-label`,
    type: 'symbol',
    source: sourceId,
    filter: ['!', ['has', 'point_count']],
    minzoom: 10,
    layout: {
      'text-field': ['get', 'name'],
      'text-font': ['Noto Sans Regular'],
      'text-size': 11,
      'text-offset': [0, 1.5],
      'text-anchor': 'top',
      'text-max-width': 10,
      'text-optional': true,
    },
    paint: {
      'text-color': '#3E3530',
      'text-halo-color': 'rgba(250, 243, 235, 0.85)',
      'text-halo-width': 1.5,
    },
  };
}

function makeSelectedArtistLayer(sourceId, color) {
  return {
    id: `${sourceId}-selected`,
    type: 'circle',
    source: sourceId,
    filter: ['==', ['get', 'artistId'], ''],
    paint: {
      'circle-color': color,
      'circle-radius': [
        'interpolate', ['linear'], ['zoom'],
        0, 4,
        5, 7,
        10, 12,
      ],
      'circle-opacity': 0.9,
      'circle-stroke-width': 3,
      'circle-stroke-color': '#FAF3EB',
      'circle-stroke-opacity': 1,
    },
  };
}

const BUCKET_KEYS = Object.keys(GENRE_BUCKETS);

export default function Map({
  mapRef,
  artists,
  connectionsByArtist,
  activeConnectionTypes,
  rangeStart,
  rangeEnd,
  selectedArtist,
  onHover,
  onHoverPosition,
  onSelect,
  isPlaying = false,
  initialCenter = [10, 48],
  initialZoom = 2,
}) {
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapError, setMapError] = useState(null);
  const [cursor, setCursor] = useState('auto');

  const handleMapLoad = useCallback(() => {
    setMapLoaded(true);
  }, []);

  const handleMapError = useCallback((e) => {
    setMapError(e?.error?.message || 'Map failed to load');
  }, []);

  const visibleCount = useMemo(() => (artists || []).length, [artists]);

  const artistById = useMemo(() => {
    const lookup = new window.Map();
    for (const a of (artists || [])) lookup.set(a.id, a);
    return lookup;
  }, [artists]);

  const onClick = useCallback(
    async (event) => {
      const features = event.features || [];
      if (features.length === 0) return;

      // With multiple genre sources, pick the feature closest to the click.
      // Priority: label layers > point layers > cluster layers.
      // Labels carry the artist's name so clicking one should select that artist.
      const clickLng = event.lngLat.lng;
      const clickLat = event.lngLat.lat;
      const distTo = (f) => {
        const [lng, lat] = f.geometry.coordinates;
        return (lng - clickLng) ** 2 + (lat - clickLat) ** 2;
      };

      const labels = features.filter((f) => !f.properties.cluster && f.layer?.id?.endsWith('-label'));
      const points = features.filter((f) => !f.properties.cluster && !f.layer?.id?.endsWith('-label'));
      const clusters = features.filter((f) => f.properties.cluster);

      const pickClosest = (arr) => arr.reduce((a, b) => distTo(a) < distTo(b) ? a : b);

      let feature;
      if (labels.length > 0) {
        feature = pickClosest(labels);
      } else if (points.length > 0) {
        feature = pickClosest(points);
      } else if (clusters.length > 0) {
        feature = pickClosest(clusters);
      } else {
        return;
      }

      // Cluster click → zoom in
      if (feature.properties.cluster) {
        const map = mapRef.current?.getMap();
        if (!map) return;
        const source = map.getSource(feature.source);
        if (!source) return;
        const zoom = await source.getClusterExpansionZoom(feature.properties.cluster_id);
        map.easeTo({
          center: feature.geometry.coordinates,
          zoom: Math.min(zoom, 18),
          duration: 500,
        });
        return;
      }

      // Individual artist click → select
      const artist = artistById.get(feature.properties.artistId);
      if (artist) {
        onSelect(artist);
      }
    },
    [artistById, onSelect, mapRef]
  );

  const onMouseMove = useCallback(
    (event) => {
      const features = event.features || [];
      if (features.length === 0) {
        onHover(null);
        setCursor('auto');
        return;
      }

      // Prefer points over clusters, pick closest to cursor
      const points = features.filter((f) => !f.properties.cluster);
      const feature = points.length > 0 ? points[0] : features[0];

      if (feature.properties.cluster) {
        setCursor('pointer');
        onHover(null);
        return;
      }

      const artist = artistById.get(feature.properties.artistId);
      if (artist) {
        onHover(artist);
        onHoverPosition({ x: event.point.x, y: event.point.y });
        setCursor('pointer');
      }
    },
    [artistById, onHover, onHoverPosition]
  );

  const onMouseLeave = useCallback(() => {
    onHover(null);
    setCursor('auto');
  }, [onHover]);

  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!map) return;

    for (const key of BUCKET_KEYS) {
      const layerId = `genre-${key}-selected`;
      if (!map.getLayer(layerId)) continue;
      if (selectedArtist) {
        map.setFilter(layerId, ['==', ['get', 'artistId'], selectedArtist.id]);
      } else {
        map.setFilter(layerId, ['==', ['get', 'artistId'], '']);
      }
    }
  }, [selectedArtist, mapRef]);

  const genreBuckets = useMemo(
    () => artistsByGenreBucket(artists || []),
    [artists]
  );

  const interactiveLayerIds = useMemo(
    () => BUCKET_KEYS.flatMap((key) => [`genre-${key}-clusters`, `genre-${key}-point`, `genre-${key}-label`]),
    []
  );

  return (
    <div role="application" aria-label="Interactive world map showing artists from 1400 to 2025. Use search or timeline to explore." style={{ width: '100vw', minHeight: '100vh', height: '100dvh', backgroundColor: '#FAF3EB', position: 'relative' }}>
      <a
        href="#timeline-controls"
        onClick={(e) => {
          e.preventDefault();
          (document.querySelector('[role="slider"]') || document.getElementById('timeline-controls'))?.focus();
        }}
        style={{
          position: 'absolute',
          left: '-9999px',
          top: 'auto',
          width: '1px',
          height: '1px',
          overflow: 'hidden',
          zIndex: 100,
        }}
        onFocus={(e) => {
          e.currentTarget.style.left = '16px';
          e.currentTarget.style.top = '16px';
          e.currentTarget.style.width = 'auto';
          e.currentTarget.style.height = 'auto';
          e.currentTarget.style.padding = '8px 16px';
          e.currentTarget.style.backgroundColor = '#FAF3EB';
          e.currentTarget.style.border = '2px solid #C4366F';
          e.currentTarget.style.borderRadius = '8px';
          e.currentTarget.style.color = '#3E3530';
          e.currentTarget.style.fontFamily = '"DM Sans", sans-serif';
          e.currentTarget.style.fontSize = '14px';
          e.currentTarget.style.textDecoration = 'none';
        }}
        onBlur={(e) => {
          e.currentTarget.style.left = '-9999px';
          e.currentTarget.style.width = '1px';
          e.currentTarget.style.height = '1px';
        }}
      >
        Skip to timeline controls
      </a>
      <a
        href="#search-input"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById('search-input')?.focus();
        }}
        style={{
          position: 'absolute',
          left: '-9999px',
          top: 'auto',
          width: '1px',
          height: '1px',
          overflow: 'hidden',
          zIndex: 100,
        }}
        onFocus={(e) => {
          e.currentTarget.style.left = '16px';
          e.currentTarget.style.top = '16px';
          e.currentTarget.style.width = 'auto';
          e.currentTarget.style.height = 'auto';
          e.currentTarget.style.padding = '8px 16px';
          e.currentTarget.style.backgroundColor = '#FAF3EB';
          e.currentTarget.style.border = '2px solid #C4366F';
          e.currentTarget.style.borderRadius = '8px';
          e.currentTarget.style.color = '#3E3530';
          e.currentTarget.style.fontFamily = '"DM Sans", sans-serif';
          e.currentTarget.style.fontSize = '14px';
          e.currentTarget.style.textDecoration = 'none';
        }}
        onBlur={(e) => {
          e.currentTarget.style.left = '-9999px';
          e.currentTarget.style.width = '1px';
          e.currentTarget.style.height = '1px';
        }}
      >
        Skip to search
      </a>
      <a
        href="#genre-filters"
        onClick={(e) => {
          e.preventDefault();
          // Try the genre filter group first; fall back to the mobile Filters toggle button
          const target = document.querySelector('[role="group"][aria-label="Filter by genre"] button')
            || document.querySelector('[aria-expanded][aria-label*="ilter"], button[aria-expanded]')
            || document.getElementById('genre-filters');
          target?.focus();
        }}
        style={{
          position: 'absolute',
          left: '-9999px',
          top: 'auto',
          width: '1px',
          height: '1px',
          overflow: 'hidden',
          zIndex: 100,
        }}
        onFocus={(e) => {
          e.currentTarget.style.left = '16px';
          e.currentTarget.style.top = '16px';
          e.currentTarget.style.width = 'auto';
          e.currentTarget.style.height = 'auto';
          e.currentTarget.style.padding = '8px 16px';
          e.currentTarget.style.backgroundColor = '#FAF3EB';
          e.currentTarget.style.border = '2px solid #C4366F';
          e.currentTarget.style.borderRadius = '8px';
          e.currentTarget.style.color = '#3E3530';
          e.currentTarget.style.fontFamily = '"DM Sans", sans-serif';
          e.currentTarget.style.fontSize = '14px';
          e.currentTarget.style.textDecoration = 'none';
        }}
        onBlur={(e) => {
          e.currentTarget.style.left = '-9999px';
          e.currentTarget.style.width = '1px';
          e.currentTarget.style.height = '1px';
        }}
      >
        Skip to genre filters
      </a>
      {mapError && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 5, fontFamily: '"DM Sans", sans-serif', color: '#3E3530', textAlign: 'center', padding: 32 }}>
          <div>
            <p style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Map could not load</p>
            <p style={{ fontSize: 14, color: '#6B5F55' }}>Your browser may not support WebGL. Try a different browser or enable hardware acceleration.</p>
          </div>
        </div>
      )}
      <MapGL
        ref={mapRef}
        initialViewState={{
          longitude: initialCenter[0],
          latitude: initialCenter[1],
          zoom: initialZoom,
        }}
        style={{ width: '100%', height: '100%' }}
        mapStyle={mapStyle}
        onLoad={handleMapLoad}
        onError={handleMapError}
        interactiveLayerIds={interactiveLayerIds}
        onClick={onClick}
        onMouseMove={onMouseMove}
        onMouseLeave={onMouseLeave}
        cursor={cursor}
      >
        {mapLoaded && genreBuckets.map(({ key, color, geojson }) => {
          if (geojson.features.length === 0) return null;
          const srcId = `genre-${key}`;
          const textColor = getTextColorForBg(color);
          return (
            <Source
              key={srcId}
              id={srcId}
              type="geojson"
              data={geojson}
              cluster={true}
              clusterRadius={55}
              clusterMaxZoom={14}
            >
              <Layer {...makeClusterCircleLayer(srcId, color)} />
              <Layer {...makeClusterCountLayer(srcId, textColor)} />
              <Layer {...makeUnclusteredPointLayer(srcId, color)} />
              <Layer {...makeUnclusteredLabelLayer(srcId)} />
              <Layer {...makeSelectedArtistLayer(srcId, color)} />
            </Source>
          );
        })}
      </MapGL>
      {mapLoaded && selectedArtist && (
        <ArcOverlay
          mapRef={mapRef}
          selectedArtist={selectedArtist}
          connectionsByArtist={connectionsByArtist}
          activeConnectionTypes={activeConnectionTypes}
          artists={artists}
        />
      )}
      <ArtistCount
        count={visibleCount}
        rangeStart={rangeStart}
        rangeEnd={rangeEnd}
        isPlaying={isPlaying}
      />
      {/* Zoom controls for accessibility — users without scroll/trackpad/pinch (Issue #13) */}
      <div
        role="group"
        aria-label="Map zoom controls"
        style={{
          position: 'absolute',
          bottom: 'calc(clamp(44px, 6vw, 52px) + 16px + env(safe-area-inset-bottom, 0px))',
          right: 12,
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          zIndex: 10,
        }}
      >
        <button
          type="button"
          aria-label="Zoom in"
          onClick={() => {
            const map = mapRef.current?.getMap?.();
            if (map) map.zoomIn({ duration: 300 });
          }}
          style={{
            width: 44,
            height: 44,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#FAF3EB',
            color: '#2C2420',
            border: '1px solid rgba(44, 36, 32, 0.15)',
            borderRadius: '10px 10px 2px 2px',
            cursor: 'pointer',
            fontFamily: '"DM Sans", sans-serif',
            fontSize: 22,
            fontWeight: 600,
            lineHeight: 1,
            padding: 0,
            boxShadow: '0 2px 6px rgba(44, 36, 32, 0.12)',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#F0E8DE'; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#FAF3EB'; }}
          onFocus={(e) => { e.currentTarget.style.outline = '2px solid #C4366F'; e.currentTarget.style.outlineOffset = '2px'; }}
          onBlur={(e) => { e.currentTarget.style.outline = 'none'; }}
        >
          +
        </button>
        <button
          type="button"
          aria-label="Zoom out"
          onClick={() => {
            const map = mapRef.current?.getMap?.();
            if (map) map.zoomOut({ duration: 300 });
          }}
          style={{
            width: 44,
            height: 44,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#FAF3EB',
            color: '#2C2420',
            border: '1px solid rgba(44, 36, 32, 0.15)',
            borderRadius: '2px 2px 2px 2px',
            cursor: 'pointer',
            fontFamily: '"DM Sans", sans-serif',
            fontSize: 22,
            fontWeight: 600,
            lineHeight: 1,
            padding: 0,
            boxShadow: '0 2px 6px rgba(44, 36, 32, 0.12)',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#F0E8DE'; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#FAF3EB'; }}
          onFocus={(e) => { e.currentTarget.style.outline = '2px solid #C4366F'; e.currentTarget.style.outlineOffset = '2px'; }}
          onBlur={(e) => { e.currentTarget.style.outline = 'none'; }}
        >
          &minus;
        </button>
        <button
          type="button"
          aria-label="Zoom to fit all artists"
          onClick={() => {
            const map = mapRef.current?.getMap?.();
            if (map) map.flyTo({ center: [10, 48], zoom: 2, duration: 1500 });
          }}
          style={{
            width: 44,
            height: 44,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#FAF3EB',
            color: '#2C2420',
            border: '1px solid rgba(44, 36, 32, 0.15)',
            borderRadius: '2px 2px 10px 10px',
            cursor: 'pointer',
            fontFamily: '"DM Sans", sans-serif',
            fontSize: 18,
            fontWeight: 600,
            lineHeight: 1,
            padding: 0,
            boxShadow: '0 2px 6px rgba(44, 36, 32, 0.12)',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#F0E8DE'; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#FAF3EB'; }}
          onFocus={(e) => { e.currentTarget.style.outline = '2px solid #C4366F'; e.currentTarget.style.outlineOffset = '2px'; }}
          onBlur={(e) => { e.currentTarget.style.outline = 'none'; }}
        >
          {/* Home icon as inline SVG for clarity */}
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true" style={{ display: 'block' }}>
            <path d="M10 2.5L2.5 9H5V16H8.5V12H11.5V16H15V9H17.5L10 2.5Z" fill="currentColor" />
          </svg>
        </button>
      </div>
    </div>
  );
}
