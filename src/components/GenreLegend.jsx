import React from 'react';
import { GENRE_BUCKETS } from '../utils/genres.js';

export default function GenreLegend() {
  return (
    <div
      style={{
        position: 'absolute',
        bottom: '24px',
        left: '24px',
        backgroundColor: 'rgba(250, 243, 235, 0.88)',
        backdropFilter: 'blur(6px)',
        borderRadius: '12px',
        padding: '14px 18px',
        border: '1px solid rgba(224, 216, 204, 0.7)',
        fontFamily: '"DM Sans", sans-serif',
        zIndex: 10,
        boxShadow: '0 2px 12px rgba(90, 80, 72, 0.12)',
        minWidth: '140px',
      }}
    >
      <p
        style={{
          margin: '0 0 10px 0',
          fontSize: '11px',
          fontWeight: 600,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: '#5A5048',
        }}
      >
        Genre
      </p>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {Object.entries(GENRE_BUCKETS).map(([name, { color }]) => (
          <li key={name} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: color,
                flexShrink: 0,
              }}
            />
            <span style={{ fontSize: '12px', color: '#1A1512', fontWeight: 400 }}>
              {name}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
