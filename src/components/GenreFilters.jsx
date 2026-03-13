import React from 'react';
import { GENRE_BUCKETS } from '../utils/genres.js';

const BUCKET_NAMES = Object.keys(GENRE_BUCKETS);

export default function GenreFilters({ activeGenres, onToggleGenre, onSelectAll, isMobile = false }) {
  const allActive = activeGenres.size === BUCKET_NAMES.length;

  return (
    <>
    <div
      id="genre-filters"
      role="group"
      aria-label="Filter by genre"
      style={{
        position: 'fixed',
        bottom: isMobile ? '132px' : '88px',
        left: isMobile ? '0' : '16px',
        right: isMobile ? '0' : 'auto',
        zIndex: 20,
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        padding: isMobile ? '4px 12px' : '4px 6px',
        backgroundColor: 'rgba(250, 243, 235, 0.88)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        borderRadius: isMobile ? '0' : '12px',
        border: '1px solid rgba(224, 216, 204, 0.5)',
        boxShadow: '0 1px 8px rgba(90, 80, 72, 0.08)',
        overflowX: isMobile ? 'auto' : 'visible',
        WebkitOverflowScrolling: 'touch',
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
      }}
    >
      {/* All button */}
      <button
        onClick={onSelectAll}
        aria-pressed={allActive}
        style={{
          fontFamily: '"DM Sans", sans-serif',
          fontSize: '11px',
          fontWeight: 600,
          lineHeight: 1,
          letterSpacing: '0.02em',
          color: allActive ? '#FAF3EB' : '#5A5048',
          backgroundColor: allActive ? '#5A5048' : 'transparent',
          border: allActive ? '1px solid #5A5048' : '1px solid rgba(90,80,72,0.2)',
          borderRadius: '8px',
          padding: '5px 10px',
          minHeight: '32px',
          cursor: 'pointer',
          transition: 'all 0.15s ease',
          outline: 'none',
          whiteSpace: 'nowrap',
          display: 'flex',
          alignItems: 'center',
        }}
        onMouseEnter={(e) => {
          if (!allActive) {
            e.currentTarget.style.backgroundColor = 'rgba(90,80,72,0.06)';
            e.currentTarget.style.borderColor = 'rgba(90,80,72,0.35)';
          }
        }}
        onMouseLeave={(e) => {
          if (!allActive) {
            e.currentTarget.style.backgroundColor = 'transparent';
            e.currentTarget.style.borderColor = 'rgba(90,80,72,0.2)';
          }
        }}
        onFocus={(e) => { e.currentTarget.style.boxShadow = '0 0 0 2px rgba(90,80,72,0.3)'; }}
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
              fontSize: '11px',
              fontWeight: isActive ? 600 : 500,
              lineHeight: 1,
              letterSpacing: '0.01em',
              color: isActive ? color : '#6B5F55',
              backgroundColor: isActive ? `${color}12` : 'transparent',
              border: isActive ? `1.5px solid ${color}` : '1px solid rgba(90,80,72,0.15)',
              borderRadius: '8px',
              padding: '5px 9px',
              minHeight: '32px',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              outline: 'none',
              whiteSpace: 'nowrap',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
            onMouseEnter={(e) => {
              if (!isActive) {
                e.currentTarget.style.backgroundColor = `${color}0A`;
                e.currentTarget.style.borderColor = `${color}66`;
                e.currentTarget.style.color = color;
              }
            }}
            onMouseLeave={(e) => {
              if (!isActive) {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.borderColor = 'rgba(90,80,72,0.15)';
                e.currentTarget.style.color = '#6B5F55';
              }
            }}
            onFocus={(e) => { e.currentTarget.style.boxShadow = `0 0 0 2px ${color}40`; }}
            onBlur={(e) => { e.currentTarget.style.boxShadow = 'none'; }}
          >
            <span
              aria-hidden="true"
              style={{
                display: 'inline-block',
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                backgroundColor: color,
                flexShrink: 0,
              }}
            />
            {bucketName}
          </button>
        );
      })}
    </div>
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'absolute',
        width: 1,
        height: 1,
        overflow: 'hidden',
        clip: 'rect(0,0,0,0)',
        whiteSpace: 'nowrap',
      }}
    >
      {allActive ? 'All genres selected' : `${activeGenres.size} of ${BUCKET_NAMES.length} genres selected`}
    </div>
    </>
  );
}
