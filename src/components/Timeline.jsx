import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';

const MIN_YEAR = 1400;
const MAX_YEAR = 2025;
const DECADE = 10;
const YEAR_LABELS_FULL = [1400, 1500, 1600, 1700, 1800, 1900, 2000, 2025];
const YEAR_LABELS_NARROW = [1400, 1600, 1800, 2025];

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

export default function Timeline({ artists, rangeStart, rangeEnd, onRangeChange, isPlaying, onPlayPause, isMobile }) {
  const containerRef = useRef(null);
  const dragging = useRef(null); // 'left' | 'right' | null
  const didDrag = useRef(false);
  const rafPending = useRef(false);
  const pendingRange = useRef(null);

  // Viewport-aware year labels: fewer on narrow screens to prevent overlap
  const [windowWidth, setWindowWidth] = useState(() => window.innerWidth);
  useEffect(() => {
    const handler = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  const yearLabels = windowWidth < 500 ? YEAR_LABELS_NARROW : YEAR_LABELS_FULL;

  // YS: Editable year input state
  const [editingStart, setEditingStart] = useState(false);
  const [editingEnd, setEditingEnd] = useState(false);
  const [startInput, setStartInput] = useState('');
  const [endInput, setEndInput] = useState('');

  // A4: Debounced live region text
  const [liveText, setLiveText] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => {
      setLiveText(`Showing years ${rangeStart} to ${rangeEnd}`);
    }, 500);
    return () => clearTimeout(timer);
  }, [rangeStart, rangeEnd]);

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

  const handlePointerMove = useCallback((e) => {
    if (!dragging.current || !containerRef.current) return;
    didDrag.current = true;
    e.preventDefault();
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const year = xToYear(x, rect.width);
    const SNAP = 10; // snap to decade

    let next = null;
    if (dragging.current === 'left') {
      const snapped = Math.round(year / SNAP) * SNAP;
      const newStart = Math.max(MIN_YEAR, Math.min(snapped, rangeEnd - SNAP));
      if (newStart !== rangeStart) next = [newStart, rangeEnd];
    } else {
      const snapped = Math.round(year / SNAP) * SNAP;
      const newEnd = Math.min(MAX_YEAR, Math.max(snapped, rangeStart + SNAP));
      if (newEnd !== rangeEnd) next = [rangeStart, newEnd];
    }

    if (!next) return;
    pendingRange.current = next;
    if (!rafPending.current) {
      rafPending.current = true;
      requestAnimationFrame(() => {
        if (pendingRange.current) {
          onRangeChange(pendingRange.current[0], pendingRange.current[1]);
          pendingRange.current = null;
        }
        rafPending.current = false;
      });
    }
  }, [dragging, rangeStart, rangeEnd, onRangeChange, xToYear]);

  const handlePointerUp = useCallback(() => {
    dragging.current = null;
  }, []);

  const handlePointerDown = useCallback((e, handle) => {
    e.preventDefault();
    e.stopPropagation();
    dragging.current = handle;
    didDrag.current = false;
    e.currentTarget.setPointerCapture(e.pointerId);
    const onMove = (ev) => handlePointerMove(ev);
    const onUp = (ev) => {
      handlePointerUp(ev);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }, [handlePointerMove, handlePointerUp]);

  const handleClick = useCallback((e) => {
    if (didDrag.current) { didDrag.current = false; return; }
    if (dragging.current || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const clickedYear = xToYear(x, rect.width);
    const fullRange = MAX_YEAR - MIN_YEAR;
    const currentWidth = rangeEnd - rangeStart;

    let newStart, newEnd;
    if (currentWidth >= fullRange) {
      // Full range is selected — zoom into a ~100-year window centered on clicked decade
      const ZOOM_WIDTH = 100;
      const center = Math.round(clickedYear / DECADE) * DECADE;
      newStart = center - ZOOM_WIDTH / 2;
      newEnd = center + ZOOM_WIDTH / 2;
    } else {
      // Narrow range — slide to center on clicked year
      const halfWidth = Math.floor(currentWidth / 2);
      newStart = Math.round((clickedYear - halfWidth) / DECADE) * DECADE;
      newEnd = newStart + currentWidth;
    }
    // Clamp to bounds
    if (newStart < MIN_YEAR) { const desiredWidth = newEnd - newStart; newStart = MIN_YEAR; newEnd = MIN_YEAR + desiredWidth; }
    if (newEnd > MAX_YEAR) { newEnd = MAX_YEAR; newStart = Math.max(MIN_YEAR, newEnd - (currentWidth >= fullRange ? 100 : currentWidth)); }
    onRangeChange(newStart, newEnd);
  }, [rangeStart, rangeEnd, onRangeChange, xToYear]);

  const padLeft = 40;
  const padRight = 40;

  const leftPercent = yearToPercent(rangeStart);
  const rightPercent = yearToPercent(rangeEnd);

  return (
    <div
      id="timeline-controls"
      style={{
        position: 'fixed',
        bottom: `calc(0px + env(safe-area-inset-bottom))`,
        left: 0,
        right: 0,
        height: 'clamp(56px, 8vw, 68px)',
        backgroundColor: 'rgba(250, 243, 235, 0.92)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        borderTop: '1px solid rgba(224, 216, 204, 0.6)',
        zIndex: 20,
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        paddingLeft: '12px',
        paddingRight: '12px',
        boxSizing: 'border-box',
        boxShadow: '0 -1px 8px rgba(90, 80, 72, 0.06)',
        userSelect: 'none',
      }}
    >
      {/* Play/Pause Button */}
      <button
        onClick={onPlayPause}
        aria-label={isPlaying ? 'Pause playback' : 'Play timeline'}
        aria-pressed={isPlaying}
        style={{
          width: 44,
          height: 44,
          borderRadius: '10px',
          border: 'none',
          backgroundColor: isPlaying ? '#D83E7F' : 'rgba(196,50,107,0.1)',
          color: isPlaying ? '#FAF3EB' : '#C4326B',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          transition: 'background-color 0.15s, color 0.15s',
          outline: 'none',
          fontFamily: '"DM Sans", sans-serif',
        }}
        onFocus={(e) => { if (e.currentTarget.matches(':focus-visible')) e.currentTarget.style.boxShadow = '0 0 0 3px rgba(196,50,107,0.4)'; }}
        onBlur={(e) => { e.currentTarget.style.boxShadow = 'none'; }}
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
        role="group"
        aria-label="Timeline year range"
        style={{
          flex: 1,
          height: isMobile ? '54px' : '64px',
          position: 'relative',
          cursor: 'pointer',
        }}
        title={rangeEnd - rangeStart >= 2025 - 1400 ? "Click to zoom into a century" : "Click to center the range here"}
        onClick={handleClick}
      >
        {/* Histogram bars */}
        <div
          style={{
            position: 'absolute',
            left: padLeft,
            right: padRight,
            top: 0,
            bottom: isMobile ? 12 : 14,
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
                aria-hidden="true"
                style={{
                  flex: 1,
                  height: `${Math.max(2, heightPct)}%`,
                  background: 'linear-gradient(to top, #D83E7F, #FFBA52)',
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
            left: `calc(${padLeft}px + (100% - ${padLeft + padRight}px) * ${leftPercent / 100})`,
            width: `calc((100% - ${padLeft + padRight}px) * ${(rightPercent - leftPercent) / 100})`,
            top: 0,
            bottom: isMobile ? 12 : 14,
            background: 'linear-gradient(to right, rgba(216,62,127,0.08), rgba(212,41,94,0.08))',
            border: '1px solid rgba(216,62,127,0.2)',
            borderRadius: '2px',
            pointerEvents: 'none',
          }}
        />

        {/* Left handle */}
        <div
          role="slider"
          aria-label="Range start year"
          aria-orientation="horizontal"
          aria-valuemin={MIN_YEAR}
          aria-valuemax={MAX_YEAR}
          aria-valuenow={rangeStart}
          aria-valuetext={`Year ${rangeStart}`}
          tabIndex={0}
          onPointerDown={(e) => handlePointerDown(e, 'left')}
          onFocus={(e) => { if (e.currentTarget.matches(':focus-visible')) { e.currentTarget.style.outline = '2px solid #D83E7F'; e.currentTarget.style.outlineOffset = '2px'; } }}
          onBlur={(e) => { e.currentTarget.style.outline = 'none'; }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowLeft') onRangeChange(Math.max(MIN_YEAR, rangeStart - 10), rangeEnd);
            if (e.key === 'ArrowRight') onRangeChange(Math.min(rangeEnd - 10, rangeStart + 10), rangeEnd);
            if (e.key === 'Home') onRangeChange(MIN_YEAR, rangeEnd);
            if (e.key === 'End') onRangeChange(Math.min(rangeEnd - 10, MAX_YEAR - 10), rangeEnd);
            if (e.key === 'PageUp') onRangeChange(Math.max(MIN_YEAR, rangeStart - 50), rangeEnd);
            if (e.key === 'PageDown') onRangeChange(Math.min(rangeEnd - 10, rangeStart + 50), rangeEnd);
          }}
          style={{
            position: 'absolute',
            left: `calc(${padLeft}px + (100% - ${padLeft + padRight}px) * ${leftPercent / 100} - 22px)`,
            top: 0,
            bottom: isMobile ? 12 : 14,
            width: '44px',
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
              backgroundColor: '#D83E7F',
              borderRadius: '2px',
              boxShadow: '0 0 8px rgba(216, 62, 127, 0.6)',
            }}
          />
        </div>

        {/* Right handle */}
        <div
          role="slider"
          aria-label="Range end year"
          aria-orientation="horizontal"
          aria-valuemin={MIN_YEAR}
          aria-valuemax={MAX_YEAR}
          aria-valuenow={rangeEnd}
          aria-valuetext={`Year ${rangeEnd}`}
          tabIndex={0}
          onPointerDown={(e) => handlePointerDown(e, 'right')}
          onFocus={(e) => { if (e.currentTarget.matches(':focus-visible')) { e.currentTarget.style.outline = '2px solid #D83E7F'; e.currentTarget.style.outlineOffset = '2px'; } }}
          onBlur={(e) => { e.currentTarget.style.outline = 'none'; }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowLeft') onRangeChange(rangeStart, Math.max(rangeStart + 10, rangeEnd - 10));
            if (e.key === 'ArrowRight') onRangeChange(rangeStart, Math.min(MAX_YEAR, rangeEnd + 10));
            if (e.key === 'Home') onRangeChange(rangeStart, Math.max(rangeStart + 10, MIN_YEAR + 10));
            if (e.key === 'End') onRangeChange(rangeStart, MAX_YEAR);
            if (e.key === 'PageUp') onRangeChange(rangeStart, Math.max(rangeStart + 10, rangeEnd - 50));
            if (e.key === 'PageDown') onRangeChange(rangeStart, Math.min(MAX_YEAR, rangeEnd + 50));
          }}
          style={{
            position: 'absolute',
            left: `calc(${padLeft}px + (100% - ${padLeft + padRight}px) * ${rightPercent / 100} - 22px)`,
            top: 0,
            bottom: isMobile ? 12 : 14,
            width: '44px',
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
              backgroundColor: '#D4295E',
              borderRadius: '2px',
              boxShadow: '0 0 8px rgba(212, 41, 94, 0.6)',
            }}
          />
        </div>

        {/* Year labels (static reference marks) */}
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
          {yearLabels.map((year) => {
            const pct = yearToPercent(year);
            // Hide static label when it overlaps with the editable range endpoint labels
            const nearStart = Math.abs(year - rangeStart) < 15;
            const nearEnd = Math.abs(year - rangeEnd) < 15;
            if (nearStart || nearEnd) return null;
            return (
              <span
                key={year}
                style={{
                  position: 'absolute',
                  left: `${pct}%`,
                  transform: 'translateX(-50%)',
                  fontSize: '11px',
                  fontFamily: '"DM Sans", sans-serif',
                  fontWeight: 500,
                  color: '#6B5F55',
                  letterSpacing: '0.02em',
                  whiteSpace: 'nowrap',
                }}
              >
                {year}
              </span>
            );
          })}
        </div>

        {/* Editable start year display */}
        {editingStart ? (
          <input
            type="number"
            min={MIN_YEAR}
            max={rangeEnd - 10}
            step={10}
            value={startInput}
            onChange={(e) => setStartInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                const val = Math.max(MIN_YEAR, Math.min(rangeEnd - 10, Math.round(parseInt(startInput) / 10) * 10));
                if (!isNaN(val)) onRangeChange(val, rangeEnd);
                setEditingStart(false);
              }
              if (e.key === 'Escape') setEditingStart(false);
            }}
            onBlur={() => {
              const val = Math.max(MIN_YEAR, Math.min(rangeEnd - 10, Math.round(parseInt(startInput) / 10) * 10));
              if (!isNaN(val)) onRangeChange(val, rangeEnd);
              setEditingStart(false);
            }}
            autoFocus
            aria-label="Set start year"
            style={{
              position: 'absolute', left: `calc(${padLeft}px + (100% - ${padLeft + padRight}px) * ${leftPercent / 100} - 30px)`,
              bottom: 16, width: 56, height: 24, minHeight: 44, padding: '0 4px',
              fontSize: 12, fontFamily: '"DM Sans", sans-serif', fontWeight: 600,
              color: '#C4326B', backgroundColor: 'rgba(250,243,235,0.95)',
              border: '1px solid #C4326B', borderRadius: 4, textAlign: 'center', outline: 'none',
              zIndex: 10,
            }}
          />
        ) : (
          <button
            onClick={() => { setStartInput(String(rangeStart)); setEditingStart(true); }}
            aria-label={`Start year: ${rangeStart}. Click to edit`}
            style={{
              position: 'absolute', left: `calc(${padLeft}px + (100% - ${padLeft + padRight}px) * ${leftPercent / 100} - 20px)`,
              bottom: 16, background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 12, fontFamily: '"DM Sans", sans-serif', fontWeight: 600,
              color: '#C4326B', padding: '2px 4px', minHeight: 44, display: 'flex', alignItems: 'center',
              outline: 'none',
            }}
            onFocus={(e) => { if (e.currentTarget.matches(':focus-visible')) e.currentTarget.style.boxShadow = '0 0 0 2px rgba(196,50,107,0.4)'; }}
            onBlur={(e) => { e.currentTarget.style.boxShadow = 'none'; }}
          >
            {rangeStart}
          </button>
        )}

        {/* Editable end year display */}
        {editingEnd ? (
          <input
            type="number"
            min={rangeStart + 10}
            max={MAX_YEAR}
            step={10}
            value={endInput}
            onChange={(e) => setEndInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                const val = Math.min(MAX_YEAR, Math.max(rangeStart + 10, Math.round(parseInt(endInput) / 10) * 10));
                if (!isNaN(val)) onRangeChange(rangeStart, val);
                setEditingEnd(false);
              }
              if (e.key === 'Escape') setEditingEnd(false);
            }}
            onBlur={() => {
              const val = Math.min(MAX_YEAR, Math.max(rangeStart + 10, Math.round(parseInt(endInput) / 10) * 10));
              if (!isNaN(val)) onRangeChange(rangeStart, val);
              setEditingEnd(false);
            }}
            autoFocus
            aria-label="Set end year"
            style={{
              position: 'absolute', left: `calc(${padLeft}px + (100% - ${padLeft + padRight}px) * ${rightPercent / 100} - 30px)`,
              bottom: 16, width: 56, height: 24, minHeight: 44, padding: '0 4px',
              fontSize: 12, fontFamily: '"DM Sans", sans-serif', fontWeight: 600,
              color: '#C4326B', backgroundColor: 'rgba(250,243,235,0.95)',
              border: '1px solid #C4326B', borderRadius: 4, textAlign: 'center', outline: 'none',
              zIndex: 10,
            }}
          />
        ) : (
          <button
            onClick={() => { setEndInput(String(rangeEnd)); setEditingEnd(true); }}
            aria-label={`End year: ${rangeEnd}. Click to edit`}
            style={{
              position: 'absolute', left: `calc(${padLeft}px + (100% - ${padLeft + padRight}px) * ${rightPercent / 100} - 20px)`,
              bottom: 16, background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 12, fontFamily: '"DM Sans", sans-serif', fontWeight: 600,
              color: '#C4326B', padding: '2px 4px', minHeight: 44, display: 'flex', alignItems: 'center',
              outline: 'none',
            }}
            onFocus={(e) => { if (e.currentTarget.matches(':focus-visible')) e.currentTarget.style.boxShadow = '0 0 0 2px rgba(196,50,107,0.4)'; }}
            onBlur={(e) => { e.currentTarget.style.boxShadow = 'none'; }}
          >
            {rangeEnd}
          </button>
        )}
      </div>

      {/* A4: Visually-hidden live region for screen readers */}
      <div role="status" aria-live="polite" style={{position:'absolute',width:1,height:1,overflow:'hidden',clip:'rect(0,0,0,0)',whiteSpace:'nowrap'}}>
        {liveText}
      </div>
    </div>
  );
}
