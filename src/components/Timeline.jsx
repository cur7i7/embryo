import React, { useMemo, useRef, useCallback, useEffect } from 'react';

const MIN_YEAR = 1400;
const MAX_YEAR = 2025;
const DECADE = 10;
const YEAR_LABELS = [1400, 1500, 1600, 1700, 1800, 1900, 2000, 2025];

function buildBins(artists) {
  const bins = {};
  for (let y = MIN_YEAR; y < MAX_YEAR; y += DECADE) {
    bins[y] = 0;
  }
  for (const a of artists) {
    if (a.birth_year == null) continue;
    const decade = Math.floor(a.birth_year / DECADE) * DECADE;
    if (decade >= MIN_YEAR && decade < MAX_YEAR) {
      bins[decade] = (bins[decade] || 0) + 1;
    }
  }
  return bins;
}

export default function Timeline({ artists, rangeStart, rangeEnd, onRangeChange, isPlaying, onPlayPause }) {
  const containerRef = useRef(null);
  const dragging = useRef(null); // 'left' | 'right' | null

  const bins = useMemo(() => buildBins(artists), [artists]);

  const decades = useMemo(() => {
    const result = [];
    for (let y = MIN_YEAR; y < MAX_YEAR; y += DECADE) {
      result.push(y);
    }
    return result;
  }, []);

  const maxCount = useMemo(() => Math.max(1, ...Object.values(bins)), [bins]);

  // Convert a pixel x-offset within the container to a year
  const xToYear = useCallback((x, containerWidth) => {
    const padLeft = 40;
    const padRight = 40;
    const usableWidth = containerWidth - padLeft - padRight;
    const fraction = (x - padLeft) / usableWidth;
    const year = MIN_YEAR + fraction * (MAX_YEAR - MIN_YEAR);
    return Math.round(Math.max(MIN_YEAR, Math.min(MAX_YEAR, year)));
  }, []);

  const yearToPercent = useCallback((year) => {
    return ((year - MIN_YEAR) / (MAX_YEAR - MIN_YEAR)) * 100;
  }, []);

  const handlePointerDown = useCallback((e, handle) => {
    e.preventDefault();
    e.stopPropagation();
    dragging.current = handle;
    e.currentTarget.setPointerCapture(e.pointerId);
  }, []);

  const handlePointerMove = useCallback((e) => {
    if (!dragging.current || !containerRef.current) return;
    e.preventDefault();
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const year = xToYear(x, rect.width);
    const SNAP = 10; // snap to decade

    if (dragging.current === 'left') {
      const snapped = Math.round(year / SNAP) * SNAP;
      const newStart = Math.max(MIN_YEAR, Math.min(snapped, rangeEnd - SNAP));
      if (newStart !== rangeStart) onRangeChange(newStart, rangeEnd);
    } else {
      const snapped = Math.round(year / SNAP) * SNAP;
      const newEnd = Math.min(MAX_YEAR, Math.max(snapped, rangeStart + SNAP));
      if (newEnd !== rangeEnd) onRangeChange(rangeStart, newEnd);
    }
  }, [dragging, rangeStart, rangeEnd, onRangeChange, xToYear]);

  const handlePointerUp = useCallback((e) => {
    dragging.current = null;
  }, []);

  const handleClick = useCallback((e) => {
    if (dragging.current || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const clickedYear = xToYear(x, rect.width);
    const halfWidth = Math.floor((rangeEnd - rangeStart) / 2);
    let newStart = Math.round((clickedYear - halfWidth) / 10) * 10;
    let newEnd = newStart + (rangeEnd - rangeStart);
    // Clamp to bounds
    if (newStart < 1400) { newStart = 1400; newEnd = newStart + (rangeEnd - rangeStart); }
    if (newEnd > 2025) { newEnd = 2025; newStart = newEnd - (rangeEnd - rangeStart); }
    onRangeChange(newStart, newEnd);
  }, [rangeStart, rangeEnd, onRangeChange, xToYear]);

  const padLeft = 40;
  const padRight = 40;

  const leftPercent = yearToPercent(rangeStart);
  const rightPercent = yearToPercent(rangeEnd);

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height: '80px',
        backgroundColor: 'rgba(250, 243, 235, 0.95)',
        backdropFilter: 'blur(8px)',
        borderTop: '1px solid rgba(224, 216, 204, 0.8)',
        zIndex: 20,
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        paddingLeft: '16px',
        paddingRight: '16px',
        boxSizing: 'border-box',
        boxShadow: '0 -2px 16px rgba(90, 80, 72, 0.10)',
        userSelect: 'none',
      }}
    >
      {/* Play/Pause Button */}
      <button
        onClick={onPlayPause}
        aria-label={isPlaying ? 'Pause playback' : 'Play timeline'}
        style={{
          width: '40px',
          height: '40px',
          borderRadius: '50%',
          border: '2px solid #C2185B',
          backgroundColor: isPlaying ? '#C2185B' : 'transparent',
          color: isPlaying ? '#FAF3EB' : '#C2185B',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          transition: 'background-color 0.15s, color 0.15s',
          outline: 'none',
          fontFamily: '"DM Sans", sans-serif',
        }}
        onFocus={(e) => e.currentTarget.style.boxShadow = '0 0 0 3px rgba(194,24,91,0.3)'}
        onBlur={(e) => e.currentTarget.style.boxShadow = 'none'}
      >
        {isPlaying ? (
          // Pause icon
          <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
            <rect x="2" y="2" width="4" height="10" rx="1" />
            <rect x="8" y="2" width="4" height="10" rx="1" />
          </svg>
        ) : (
          // Play icon
          <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
            <polygon points="3,2 12,7 3,12" />
          </svg>
        )}
      </button>

      {/* Timeline area */}
      <div
        ref={containerRef}
        style={{
          flex: 1,
          height: '64px',
          position: 'relative',
          cursor: 'default',
        }}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onClick={handleClick}
      >
        {/* Histogram bars */}
        <div
          style={{
            position: 'absolute',
            left: padLeft,
            right: padRight,
            top: 0,
            bottom: 18,
            display: 'flex',
            alignItems: 'flex-end',
            gap: '1px',
          }}
        >
          {decades.map((decade) => {
            const count = bins[decade] || 0;
            const heightPct = (count / maxCount) * 100;
            const inRange = decade >= rangeStart && decade < rangeEnd;
            return (
              <div
                key={decade}
                title={`${decade}s: ${count} artists`}
                style={{
                  flex: 1,
                  height: `${Math.max(2, heightPct)}%`,
                  background: 'linear-gradient(to top, #C2185B, #FF8F00)',
                  opacity: inRange ? 0.65 : 0.25,
                  borderRadius: '2px 2px 0 0',
                  transition: 'opacity 0.15s',
                }}
              />
            );
          })}
        </div>

        {/* Selected range overlay */}
        <div
          style={{
            position: 'absolute',
            left: `calc(${padLeft}px + ${leftPercent}% * (100% - ${padLeft + padRight}px) / 100)`,
            width: `calc(${rightPercent - leftPercent}% * (100% - ${padLeft + padRight}px) / 100)`,
            top: 0,
            bottom: 18,
            background: 'linear-gradient(to right, rgba(194,24,91,0.08), rgba(156,39,176,0.08))',
            border: '1px solid rgba(194,24,91,0.2)',
            borderRadius: '2px',
            pointerEvents: 'none',
          }}
        />

        {/* Left handle */}
        <div
          role="slider"
          aria-label="Range start year"
          aria-valuemin={MIN_YEAR}
          aria-valuemax={MAX_YEAR}
          aria-valuenow={rangeStart}
          tabIndex={0}
          onPointerDown={(e) => handlePointerDown(e, 'left')}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onKeyDown={(e) => {
            if (e.key === 'ArrowLeft') onRangeChange(Math.max(MIN_YEAR, rangeStart - 10), rangeEnd);
            if (e.key === 'ArrowRight') onRangeChange(Math.min(rangeEnd - 10, rangeStart + 10), rangeEnd);
          }}
          style={{
            position: 'absolute',
            left: `calc(${padLeft}px + ${leftPercent}% * (100% - ${padLeft + padRight}px) / 100 - 8px)`,
            top: 0,
            bottom: 18,
            width: '16px',
            cursor: 'ew-resize',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 5,
          }}
        >
          <div
            style={{
              width: '4px',
              height: '100%',
              backgroundColor: '#C2185B',
              borderRadius: '2px',
              boxShadow: '0 0 8px rgba(194, 24, 91, 0.6)',
            }}
          />
        </div>

        {/* Right handle */}
        <div
          role="slider"
          aria-label="Range end year"
          aria-valuemin={MIN_YEAR}
          aria-valuemax={MAX_YEAR}
          aria-valuenow={rangeEnd}
          tabIndex={0}
          onPointerDown={(e) => handlePointerDown(e, 'right')}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onKeyDown={(e) => {
            if (e.key === 'ArrowLeft') onRangeChange(rangeStart, Math.max(rangeStart + 10, rangeEnd - 10));
            if (e.key === 'ArrowRight') onRangeChange(rangeStart, Math.min(MAX_YEAR, rangeEnd + 10));
          }}
          style={{
            position: 'absolute',
            left: `calc(${padLeft}px + ${rightPercent}% * (100% - ${padLeft + padRight}px) / 100 - 8px)`,
            top: 0,
            bottom: 18,
            width: '16px',
            cursor: 'ew-resize',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 5,
          }}
        >
          <div
            style={{
              width: '4px',
              height: '100%',
              backgroundColor: '#9C27B0',
              borderRadius: '2px',
              boxShadow: '0 0 8px rgba(156, 39, 176, 0.6)',
            }}
          />
        </div>

        {/* Year labels */}
        <div
          style={{
            position: 'absolute',
            left: padLeft,
            right: padRight,
            bottom: 0,
            height: '16px',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          {YEAR_LABELS.map((year) => {
            const pct = yearToPercent(year);
            return (
              <span
                key={year}
                style={{
                  position: 'absolute',
                  left: `${pct}%`,
                  transform: 'translateX(-50%)',
                  fontSize: '9px',
                  fontFamily: '"DM Sans", sans-serif',
                  fontWeight: 500,
                  color: '#A89B8E',
                  letterSpacing: '0.02em',
                  whiteSpace: 'nowrap',
                }}
              >
                {year}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}
