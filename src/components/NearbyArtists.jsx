import React, { useState } from 'react';
import { getGenreBucket } from '../utils/genres.js';

const PANEL_STYLE = {
  position: 'fixed',
  right: 'calc(8px + env(safe-area-inset-right))',
  bottom: 'calc(64px + env(safe-area-inset-bottom))',
  zIndex: 14,
  fontFamily: '"DM Sans", sans-serif',
  backgroundColor: 'rgba(250, 243, 235, 0.94)',
  backdropFilter: 'blur(8px)',
  border: '1px solid rgba(224, 216, 204, 0.7)',
  borderRadius: 12,
  boxShadow: '0 4px 16px rgba(90, 80, 72, 0.12)',
  width: 'clamp(200px, 22vw, 260px)',
  maxHeight: 'clamp(180px, 35vh, 320px)',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  transition: 'opacity 0.2s ease',
};

const COLLAPSED_STYLE = {
  position: 'fixed',
  right: 'calc(8px + env(safe-area-inset-right))',
  bottom: 'calc(64px + env(safe-area-inset-bottom))',
  zIndex: 14,
  fontFamily: '"DM Sans", sans-serif',
  backgroundColor: 'rgba(250, 243, 235, 0.94)',
  backdropFilter: 'blur(8px)',
  border: '1px solid rgba(224, 216, 204, 0.7)',
  borderRadius: 12,
  boxShadow: '0 4px 16px rgba(90, 80, 72, 0.12)',
};

const ITEM_STYLE = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '6px 12px',
  minHeight: 44,
  cursor: 'pointer',
  border: 'none',
  background: 'none',
  width: '100%',
  textAlign: 'left',
  fontSize: 13,
  fontFamily: 'inherit',
  color: '#3E3530',
  transition: 'background-color 0.1s ease',
};

export default function NearbyArtists({ artists, connectionCounts, onSelect, isMobile }) {
  const [expanded, setExpanded] = useState(true);

  if (!artists || artists.length === 0) return null;

  if (!expanded) {
    return (
      <div style={COLLAPSED_STYLE}>
        <button
          onClick={() => setExpanded(true)}
          style={{
            ...ITEM_STYLE,
            justifyContent: 'center',
            padding: '8px 14px',
            minHeight: 44,
            fontWeight: 600,
            fontSize: 12,
            color: '#5A5048',
          }}
          aria-label="Expand nearby artists list"
        >
          Nearby ({artists.length}) ▸
        </button>
      </div>
    );
  }

  return (
    <div style={isMobile ? { ...PANEL_STYLE, right: 8, left: 8, width: 'auto' } : PANEL_STYLE}>
      {/* Header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '8px 12px', borderBottom: '1px solid rgba(224, 216, 204, 0.5)',
        flexShrink: 0,
      }}>
        <span style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.6px', color: '#6B5F55' }}>
          Nearby · {artists.length}
        </span>
        <button
          onClick={() => setExpanded(false)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, fontSize: 12, color: '#6B5F55', fontFamily: 'inherit', minWidth: 44, minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          aria-label="Collapse nearby artists"
        >
          ◂
        </button>
      </div>

      {/* List */}
      <div style={{ overflowY: 'auto', flex: 1 }}>
        {artists.map(a => {
          const { color } = getGenreBucket(a.genres);
          const connCount = connectionCounts?.get?.(a.id) ?? 0;
          return (
            <button
              key={a.id}
              onClick={() => onSelect?.(a)}
              style={ITEM_STYLE}
              onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(224, 216, 204, 0.3)'; }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
            >
              <div style={{
                width: 8, height: 8, borderRadius: '50%',
                backgroundColor: color, flexShrink: 0,
              }} />
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500 }}>
                {a.name}
              </span>
              {connCount > 0 && (
                <span style={{ fontSize: 12, color: '#6B5F55', flexShrink: 0 }}>
                  {connCount}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
