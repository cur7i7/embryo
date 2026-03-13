import React from 'react';
import { GENRE_BUCKETS } from '../utils/genres.js';

const BUCKET_NAMES = Object.keys(GENRE_BUCKETS);

/**
 * Non-color genre shape mapping for WCAG 2.2 AA redundant encoding.
 * Each genre gets a distinct Unicode symbol so users who cannot perceive
 * color differences can still distinguish genres by shape.
 *
 * Classical  → ● (U+25CF) filled circle   — traditional, foundational
 * Jazz/Blues → ◆ (U+25C6) filled diamond  — creative, angular
 * Rock       → ▲ (U+25B2) filled triangle — aggressive, pointed
 * Electronic → ■ (U+25A0) filled square   — digital, grid-like
 * Hip-hop    → ★ (U+2605) filled star     — expressive, bold
 * Pop/Soul   → ♥ (U+2665) filled heart    — emotional, warm
 * Other      → ✦ (U+2726) four-pointed star — miscellaneous
 */
const GENRE_SHAPES = {
  'Classical':  '●',
  'Jazz/Blues': '◆',
  'Rock':       '▲',
  'Electronic': '■',
  'Hip-hop':    '★',
  'Pop/Soul':   '♥',
  'Other':      '✦',
};

export default function GenreFilters({ activeGenres, onToggleGenre, onSelectAll, isMobile = false }) {
  const allActive = activeGenres.size === BUCKET_NAMES.length;

  return (
    <>
    <div style={{
      position: 'fixed',
      bottom: isMobile ? `calc(168px + env(safe-area-inset-bottom))` : `calc(128px + env(safe-area-inset-bottom))`,
      left: isMobile ? '0' : '16px',
      right: isMobile ? '0' : 'auto',
      zIndex: 20,
    }}>
    <div
      id="genre-filters"
      role="group"
      aria-label="Filter by genre"
      style={{
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
        scrollbarWidth: 'thin',
      }}
    >
      {/* All button */}
      <button
        onClick={onSelectAll}
        aria-pressed={allActive}
        style={{
          fontFamily: '"DM Sans", sans-serif',
          fontSize: 'clamp(11px, 1.5vw, 13px)',
          fontWeight: 600,
          lineHeight: 1,
          letterSpacing: '0.02em',
          color: allActive ? '#FAF3EB' : '#5A5048',
          backgroundColor: allActive ? '#5A5048' : 'transparent',
          border: allActive ? '1px solid #5A5048' : '1px solid rgba(90,80,72,0.2)',
          borderRadius: '8px',
          padding: isMobile ? '6px 12px' : '5px 10px',
          minHeight: '44px',
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
        onFocus={(e) => { if (e.currentTarget.matches(':focus-visible')) e.currentTarget.style.boxShadow = '0 0 0 2px rgba(90,80,72,0.4)'; }}
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
              fontSize: 'clamp(11px, 1.5vw, 13px)',
              fontWeight: isActive ? 600 : 500,
              lineHeight: 1,
              letterSpacing: '0.01em',
              color: isActive ? '#3E3530' : '#6B5F55',
              backgroundColor: isActive ? `${color}12` : 'transparent',
              border: isActive ? `1.5px solid ${color}` : '1px solid rgba(90,80,72,0.15)',
              borderLeft: isActive ? `3px solid ${color}` : undefined,
              borderRadius: '8px',
              padding: isMobile ? '6px 11px' : '5px 9px',
              minHeight: '44px',
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
                e.currentTarget.style.color = '#3E3530';
              }
            }}
            onMouseLeave={(e) => {
              if (!isActive) {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.borderColor = 'rgba(90,80,72,0.15)';
                e.currentTarget.style.color = '#6B5F55';
              }
            }}
            onFocus={(e) => { if (e.currentTarget.matches(':focus-visible')) e.currentTarget.style.boxShadow = `0 0 0 2px ${color}66`; }}
            onBlur={(e) => { e.currentTarget.style.boxShadow = 'none'; }}
          >
            <span
              aria-hidden="true"
              style={{
                display: 'inline-block',
                width: '8px',
                height: '8px',
                fontSize: '8px',
                lineHeight: '8px',
                color: '#5A5048',
                flexShrink: 0,
                textAlign: 'center',
                userSelect: 'none',
              }}
            >
              {GENRE_SHAPES[bucketName] ?? '●'}
            </span>
            {bucketName}
          </button>
        );
      })}
    </div>
    {isMobile && (
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          bottom: 0,
          width: 24,
          background: 'linear-gradient(to right, rgba(250,243,235,0), rgba(250,243,235,0.88))',
          pointerEvents: 'none',
          borderRadius: '0 0 0 0',
        }}
      />
    )}
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
