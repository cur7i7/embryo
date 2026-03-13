import React, { useState, useCallback } from 'react';
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
        'raster-saturation': -0.35,
        'raster-brightness-min': 0.55,
        'raster-brightness-max': 1,
        'raster-opacity': 0.75,
      },
    },
  ],
};

export default function Map({
  mapRef,
  artists,
  connectionCounts,
  connections,
  activeConnectionTypes,
  rangeStart,
  rangeEnd,
  hoveredArtist,
  selectedArtist,
  onHover,
  onSelect,
  isPlaying = false,
}) {
  const [mapLoaded, setMapLoaded] = useState(false);

  const handleMapLoad = useCallback(() => {
    setMapLoaded(true);
  }, []);

  const visibleCount = (artists || []).filter(
    (a) => a.birth_lat != null && a.birth_lng != null
  ).length;

  return (
    <div role="application" aria-label="Interactive world map showing musicians from 1400 to 2025. Use search or timeline to explore." style={{ width: '100vw', minHeight: '100vh', height: '100dvh', backgroundColor: '#FAF3EB', position: 'relative' }}>
      <a
        href="#timeline-controls"
        onClick={(e) => {
          e.preventDefault();
          document.querySelector('[role="slider"]')?.focus();
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
          e.currentTarget.style.border = '2px solid #D83E7F';
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
          document.querySelector('input[type="search"]')?.focus();
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
          e.currentTarget.style.border = '2px solid #D83E7F';
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
          document.querySelector('[role="group"][aria-label="Filter by genre"] button')?.focus();
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
          e.currentTarget.style.border = '2px solid #D83E7F';
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
          hoveredArtist={hoveredArtist}
          selectedArtist={selectedArtist}
          onHover={onHover}
          onSelect={onSelect}
        />
      )}
      <ArtistCount
        count={visibleCount}
        rangeStart={rangeStart}
        rangeEnd={rangeEnd}
        isPlaying={isPlaying}
      />
    </div>
  );
}
