import React from 'react';

export default function ArtistCount({ count, rangeStart, rangeEnd }) {
  const label =
    rangeStart === 1400 && rangeEnd === 2025
      ? 'All years'
      : `${rangeStart}\u2013${rangeEnd}`;

  return (
    <div
      style={{
        position: 'absolute',
        top: '16px',
        left: '16px',
        zIndex: 10,
        backgroundColor: 'rgba(250, 243, 235, 0.88)',
        backdropFilter: 'blur(6px)',
        borderRadius: '20px',
        padding: '7px 14px',
        border: '1px solid rgba(224, 216, 204, 0.7)',
        boxShadow: '0 2px 10px rgba(90, 80, 72, 0.10)',
        fontFamily: '"DM Sans", sans-serif',
        fontSize: '13px',
        fontWeight: 500,
        color: '#1A1512',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        pointerEvents: 'none',
        userSelect: 'none',
      }}
    >
      <span style={{ fontWeight: 600, color: '#C2185B' }}>
        {count.toLocaleString()}
      </span>
      <span style={{ color: '#5A5048' }}>
        artists
      </span>
      <span
        style={{
          width: '1px',
          height: '12px',
          backgroundColor: 'rgba(90,80,72,0.3)',
          display: 'inline-block',
        }}
      />
      <span style={{ color: '#5A5048', fontSize: '12px' }}>
        {label}
      </span>
    </div>
  );
}
