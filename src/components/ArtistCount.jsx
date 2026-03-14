import React, { useState, useEffect, useContext } from 'react';
import { useIsPointerFine } from '../hooks/useIsPointerFine.js';
import { TotalArtistCountContext } from '../contexts/TotalArtistCountContext.js';

// Fix #3: Shows "{filtered} of {total} artists" when filters are active,
// or just "{total} artists" when showing all.
function ArtistCount({ count, rangeStart, rangeEnd, isPlaying = false }) {
  const isPointerFine = useIsPointerFine();
  const totalCount = useContext(TotalArtistCountContext);

  const isFiltered = totalCount > 0 && count !== totalCount;

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

  const countText = isFiltered
    ? `${count.toLocaleString()} of ${totalCount.toLocaleString()}`
    : count.toLocaleString();

  return (
    <>
    <div
      style={{
        position: 'absolute',
        top: 'calc(66px + env(safe-area-inset-top))',
        left: 'calc(16px + env(safe-area-inset-left))',
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
        {countText}
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
