import React, { useState, useCallback } from 'react';
import { GENRE_BUCKETS } from '../utils/genres.js';

// All genres use filled circles — Swiss modernist aesthetic
const GENRE_SHAPE = '\u25CF';

const BUCKET_NAMES = Object.keys(GENRE_BUCKETS);

const STORAGE_KEY = 'embryo-genre-legend-collapsed';

function getInitialCollapsed() {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

function GenreLegend({ isMobile = false }) {
  const [collapsed, setCollapsed] = useState(getInitialCollapsed);

  const toggleCollapsed = useCallback(() => {
    setCollapsed(prev => {
      const next = !prev;
      try { localStorage.setItem(STORAGE_KEY, String(next)); } catch { /* noop */ }
      return next;
    });
  }, []);

  return (
    <div
      style={{
        position: 'fixed',
        top: 'calc(140px + env(safe-area-inset-top))',
        left: 'calc(16px + env(safe-area-inset-left))',
        zIndex: 15,
        fontFamily: '"DM Sans", sans-serif',
        pointerEvents: 'auto',
      }}
    >
      <div
        style={{
          backgroundColor: 'rgba(250, 243, 235, 0.95)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          borderRadius: 12,
          border: '1px solid rgba(224, 216, 204, 0.5)',
          boxShadow: '0 1px 8px rgba(90, 80, 72, 0.08)',
          overflow: 'hidden',
          transition: 'width 0.2s ease, height 0.2s ease',
        }}
      >
        {/* Toggle button */}
        <button
          onClick={toggleCollapsed}
          aria-expanded={!collapsed}
          aria-label={collapsed ? 'Show genre legend' : 'Hide genre legend'}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            width: '100%',
            padding: isMobile ? '8px 10px' : '6px 10px',
            minHeight: 44,
            minWidth: 44,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontFamily: '"DM Sans", sans-serif',
            fontSize: isMobile ? 12 : 11,
            fontWeight: 600,
            color: '#5A5048',
            letterSpacing: '0.02em',
            textAlign: 'left',
          }}
          onFocus={(e) => {
            if (e.currentTarget.matches(':focus-visible'))
              e.currentTarget.style.boxShadow = '0 0 0 2px rgba(90,80,72,0.4)';
          }}
          onBlur={(e) => {
            e.currentTarget.style.boxShadow = 'none';
          }}
        >
          {collapsed ? (
            <>
              {/* Collapsed: show small color dots as preview */}
              <span aria-hidden="true" style={{ display: 'flex', gap: 2 }}>
                {BUCKET_NAMES.slice(0, 4).map((name) => (
                  <span
                    key={name}
                    style={{
                      display: 'inline-block',
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      backgroundColor: GENRE_BUCKETS[name].color,
                    }}
                  />
                ))}
              </span>
              <span>Legend</span>
              <span aria-hidden="true" style={{ fontSize: 9, marginLeft: 'auto' }}>{'\u25B8'}</span>
            </>
          ) : (
            <>
              <svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 8v8M8 12h8" />
              </svg>
              <span>Genre Legend</span>
              <span aria-hidden="true" style={{ fontSize: 9, marginLeft: 'auto' }}>{'\u25BE'}</span>
            </>
          )}
        </button>

        {/* Expanded list */}
        {!collapsed && (
          <ul
            role="list"
            aria-label="Genre color and shape legend"
            style={{
              margin: 0,
              padding: isMobile ? '0 10px 8px' : '0 10px 6px',
              listStyle: 'none',
              display: 'flex',
              flexDirection: 'column',
              gap: isMobile ? 4 : 2,
            }}
          >
            {BUCKET_NAMES.map((name) => {
              const { color } = GENRE_BUCKETS[name];
              const shape = GENRE_SHAPE;

              return (
                <li
                  key={name}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: isMobile ? 12 : 11,
                    fontWeight: 500,
                    color: '#3E3530',
                    lineHeight: 1.3,
                    padding: '1px 0',
                  }}
                >
                  <span
                    aria-hidden="true"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: isMobile ? 32 : 28,
                      height: isMobile ? 32 : 28,
                      fontSize: isMobile ? 24 : 20,
                      lineHeight: 1,
                      color: color,
                      flexShrink: 0,
                      textAlign: 'center',
                      userSelect: 'none',
                    }}
                  >
                    {shape}
                  </span>
                  <span>{name}</span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

export default React.memo(GenreLegend);
