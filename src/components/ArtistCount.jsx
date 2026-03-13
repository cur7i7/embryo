import React, { useState, useEffect } from 'react';
import { useIsPointerFine } from '../hooks/useIsPointerFine.js';

function ArtistCount({ count, rangeStart, rangeEnd, isPlaying = false }) {
  const isPointerFine = useIsPointerFine();
  const label =
    rangeStart === 1400 && rangeEnd === 2025
      ? 'All years'
      : rangeStart === rangeEnd
        ? `${rangeStart}`
        : `${rangeStart}\u2013${rangeEnd}`;

  const [announced, setAnnounced] = useState({ count, label });
  useEffect(() => {
    const t = setTimeout(() => setAnnounced({ count, label }), 600);
    return () => clearTimeout(t);
  }, [count, label]);

  return (
    <>
    <div
      style={{
        position: 'absolute',
        top: 'calc(56px + env(safe-area-inset-top))',
        left: '16px',
        zIndex: 10,
        backgroundColor: 'rgba(250, 243, 235, 0.88)',
        backdropFilter: 'blur(6px)',
        borderRadius: '20px',
        padding: isPointerFine ? '4px 10px' : '7px 14px',
        border: '1px solid rgba(224, 216, 204, 0.7)',
        boxShadow: '0 2px 10px rgba(90, 80, 72, 0.10)',
        fontFamily: '"DM Sans", sans-serif',
        fontSize: isPointerFine ? '11px' : '13px',
        fontWeight: 500,
        color: '#1A1512',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        pointerEvents: 'auto',
        cursor: 'default',
        userSelect: 'none',
      }}
    >
      <span style={{ fontWeight: 600, color: '#C4326B' }}>
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
    <div role="status" aria-live="polite" style={{position:'absolute',width:1,height:1,overflow:'hidden',clip:'rect(0,0,0,0)',whiteSpace:'nowrap'}}>
      {isPlaying ? '' : `${announced.count.toLocaleString()} artists, ${announced.label}`}
    </div>
    </>
  );
}

export default React.memo(ArtistCount);
