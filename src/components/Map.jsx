import React, { useState, useCallback, useMemo } from 'react';
import { Map as MapGL } from 'react-map-gl/maplibre';
import ArtistCount from './ArtistCount.jsx';
import CanvasOverlay from './CanvasOverlay.jsx';
import { useIsPointerFine } from '../hooks/useIsPointerFine.js';

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
  connectionsByArtist,
  activeConnectionTypes,
  rangeStart,
  rangeEnd,
  hoveredArtist,
  selectedArtist,
  onHover,
  onHoverPosition,
  onSelect,
  isPlaying = false,
  initialCenter = [10, 48],
  initialZoom = 2,
}) {
  const [mapLoaded, setMapLoaded] = useState(false);
  const isFinePointer = useIsPointerFine();

  const handleMapLoad = useCallback(() => {
    setMapLoaded(true);
  }, []);

  const visibleCount = useMemo(() => (artists || []).length, [artists]);

  return (
    <div role="application" aria-label="Interactive world map showing artists from 1400 to 2025. Use search or timeline to explore." style={{ width: '100vw', minHeight: '100vh', height: '100dvh', backgroundColor: '#FAF3EB', position: 'relative' }}>
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
      />
      {mapLoaded && (
        <CanvasOverlay
          mapRef={mapRef}
          artists={artists}
          connectionCounts={connectionCounts}
          connectionsByArtist={connectionsByArtist}
          activeConnectionTypes={activeConnectionTypes}
          hoveredArtist={hoveredArtist}
          selectedArtist={selectedArtist}
          onHover={onHover}
          onHoverPosition={onHoverPosition}
          onSelect={onSelect}
          isFinePointer={isFinePointer}
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
