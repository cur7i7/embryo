import React, { useRef, useLayoutEffect, useState } from 'react';
import { getGenreBucket } from '../utils/genres.js';

const OFFSET_X = 16;
const OFFSET_Y = 8;

export default function HoverCard({ artist, position, connectionCount, isMobile }) {
  const cardRef = useRef(null);
  const [adjustedPos, setAdjustedPos] = useState(null);

  useLayoutEffect(() => {
    if (!artist || !position || !cardRef.current) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAdjustedPos(null);
      return;
    }

    const rect = cardRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let x = position.x + OFFSET_X;
    let y = position.y + OFFSET_Y;

    // Flip to left side if too close to right edge
    if (x + rect.width + 8 > vw) {
      x = position.x - rect.width - OFFSET_X;
    }

    // Flip above if too close to bottom
    if (y + rect.height + 8 > vh) {
      y = position.y - rect.height - OFFSET_Y;
    }

    // Clamp to viewport
    x = Math.max(4, Math.min(x, vw - rect.width - 4));
    y = Math.max(4, Math.min(y, vh - rect.height - 4));

    setAdjustedPos({ x, y });
  }, [artist, position]);

  // Don't render on mobile/touch devices
  if (isMobile) return null;
  if (!artist || !position) return null;

  const { bucket, color } = getGenreBucket(artist.genres);

  const birthYear = artist.birth_year;
  const deathYear = artist.death_year;
  let lifespan = '';
  if (birthYear) {
    lifespan = deathYear ? `${birthYear}–${deathYear}` : `${birthYear}–`;
  }

  const connCount = connectionCount ?? 0;

  // Use adjusted position if available, otherwise use raw position (first frame)
  const posX = adjustedPos ? adjustedPos.x : position.x + OFFSET_X;
  const posY = adjustedPos ? adjustedPos.y : position.y + OFFSET_Y;

  return (
    <div
      ref={cardRef}
      role="tooltip"
      style={{
        position: 'fixed',
        left: posX,
        top: posY,
        zIndex: 40,
        pointerEvents: 'none',
        backgroundColor: 'rgba(250, 243, 235, 0.98)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderRadius: 12,
        border: '1px solid rgba(224, 216, 204, 0.7)',
        boxShadow: '0 4px 20px rgba(90, 80, 72, 0.15)',
        padding: '10px 14px',
        fontFamily: '"DM Sans", sans-serif',
        maxWidth: 240,
        whiteSpace: 'nowrap',
      }}
    >
      {/* Artist name */}
      <div style={{
        fontSize: 13,
        fontWeight: 700,
        color: '#3E3530',
        lineHeight: 1.3,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      }}>
        {artist.name}
      </div>

      {/* Genre bucket + colored dot */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 5,
        marginTop: 3,
        fontSize: 12,
        color: '#7A6E65',
        lineHeight: 1.3,
      }}>
        <span style={{
          width: 7,
          height: 7,
          borderRadius: '50%',
          backgroundColor: color,
          flexShrink: 0,
        }} />
        {bucket}
      </div>

      {/* Lifespan + connections on one line */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        marginTop: 3,
        fontSize: 11,
        color: '#6B5F55',
        lineHeight: 1.3,
      }}>
        {lifespan && <span>{lifespan}</span>}
        {connCount > 0 && (
          <span>{connCount} connection{connCount !== 1 ? 's' : ''}</span>
        )}
      </div>
    </div>
  );
}
