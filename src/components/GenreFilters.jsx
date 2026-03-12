import React from 'react';
import { GENRE_BUCKETS } from '../utils/genres.js';

const BUCKET_NAMES = Object.keys(GENRE_BUCKETS);

export default function GenreFilters({ activeGenres, onToggleGenre, onSelectAll }) {
  const allActive = activeGenres.size === BUCKET_NAMES.length;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '88px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 20,
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '6px 10px',
        backgroundColor: 'rgba(250, 243, 235, 0.90)',
        backdropFilter: 'blur(6px)',
        borderRadius: '24px',
        border: '1px solid rgba(224, 216, 204, 0.7)',
        boxShadow: '0 2px 10px rgba(90, 80, 72, 0.10)',
      }}
    >
      {/* All button */}
      <button
        onClick={onSelectAll}
        aria-pressed={allActive}
        style={{
          fontFamily: '"DM Sans", sans-serif',
          fontSize: '12px',
          fontWeight: allActive ? 600 : 400,
          lineHeight: 1,
          color: allActive ? '#FAF3EB' : '#5A5048',
          backgroundColor: allActive ? '#C2185B' : 'transparent',
          border: allActive ? '1px solid #C2185B' : '1px solid rgba(90,80,72,0.25)',
          borderRadius: '14px',
          padding: '5px 12px',
          cursor: 'pointer',
          transition: 'background-color 0.15s, color 0.15s, border-color 0.15s',
          outline: 'none',
          whiteSpace: 'nowrap',
        }}
        onMouseEnter={(e) => {
          if (!allActive) {
            e.currentTarget.style.backgroundColor = 'rgba(194,24,91,0.08)';
            e.currentTarget.style.borderColor = 'rgba(194,24,91,0.4)';
            e.currentTarget.style.color = '#C2185B';
          }
        }}
        onMouseLeave={(e) => {
          if (!allActive) {
            e.currentTarget.style.backgroundColor = 'transparent';
            e.currentTarget.style.borderColor = 'rgba(90,80,72,0.25)';
            e.currentTarget.style.color = '#5A5048';
          }
        }}
        onFocus={(e) => { e.currentTarget.style.boxShadow = '0 0 0 3px rgba(194,24,91,0.25)'; }}
        onBlur={(e) => { e.currentTarget.style.boxShadow = 'none'; }}
      >
        All
      </button>

      {/* Genre buttons */}
      {BUCKET_NAMES.map((bucketName) => {
        const { color } = GENRE_BUCKETS[bucketName];
        const isActive = activeGenres.has(bucketName);

        return (
          <button
            key={bucketName}
            onClick={() => onToggleGenre(bucketName)}
            aria-pressed={isActive}
            style={{
              fontFamily: '"DM Sans", sans-serif',
              fontSize: '12px',
              fontWeight: isActive ? 600 : 400,
              lineHeight: 1,
              color: isActive ? '#FAF3EB' : '#5A5048',
              backgroundColor: isActive ? color : 'transparent',
              border: isActive ? `1px solid ${color}` : '1px solid rgba(90,80,72,0.25)',
              borderRadius: '14px',
              padding: '5px 12px',
              cursor: 'pointer',
              transition: 'background-color 0.15s, color 0.15s, border-color 0.15s',
              outline: 'none',
              whiteSpace: 'nowrap',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
            }}
            onMouseEnter={(e) => {
              if (!isActive) {
                e.currentTarget.style.backgroundColor = `${color}14`;
                e.currentTarget.style.borderColor = `${color}99`;
                e.currentTarget.style.color = color;
              }
            }}
            onMouseLeave={(e) => {
              if (!isActive) {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.borderColor = 'rgba(90,80,72,0.25)';
                e.currentTarget.style.color = '#5A5048';
              }
            }}
            onFocus={(e) => { e.currentTarget.style.boxShadow = `0 0 0 3px ${color}40`; }}
            onBlur={(e) => { e.currentTarget.style.boxShadow = 'none'; }}
          >
            <span
              aria-hidden="true"
              style={{
                display: 'inline-block',
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: isActive ? '#FAF3EB' : color,
                flexShrink: 0,
              }}
            />
            {bucketName}
          </button>
        );
      })}
    </div>
  );
}
