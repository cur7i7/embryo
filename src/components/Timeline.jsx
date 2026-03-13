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

export default function Timeline({ artists, rangeStart, rangeEnd, onRangeChange, isPlaying, onPlayPause, isMobile, initialMode }) {
  const containerRef = useRef(null);
  const dragging = useRef(null); // 'left' | 'right' | 'year' | null
  const didDrag = useRef(false);
  const rafPending = useRef(false);
  const pendingRange = useRef(null);

  // B: Mode state — 'range' (two handles) or 'year' (single handle)
  const [mode, setMode] = useState(initialMode || 'range');

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
  const [editingYear, setEditingYear] = useState(false);
  const [startInput, setStartInput] = useState('');
  const [endInput, setEndInput] = useState('');
  const [yearInput, setYearInput] = useState('');

  // A4: Debounced live region text
  const [liveText, setLiveText] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => {
      if (mode === 'year') {
        setLiveText(`Showing year ${rangeEnd}`);
      } else {
        setLiveText(`Showing years ${rangeStart} to ${rangeEnd}`);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [rangeStart, rangeEnd, mode]);

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
    if (dragging.current === 'year') {
      // Year mode: single handle moves both start and end
      const snapped = Math.round(year / SNAP) * SNAP;
      const clamped = Math.max(MIN_YEAR, Math.min(MAX_YEAR, snapped));
      if (clamped !== rangeEnd) next = [clamped, clamped];
    } else if (dragging.current === 'left') {
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

    if (mode === 'year') {
      // In year mode, click sets the year directly
      const snapped = Math.round(clickedYear / DECADE) * DECADE;
      const clamped = Math.max(MIN_YEAR, Math.min(MAX_YEAR, snapped));
      onRangeChange(clamped, clamped);
      return;
    }

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
  }, [rangeStart, rangeEnd, onRangeChange, xToYear, mode]);

  // B: Toggle between range and year mode
  const handleModeToggle = useCallback(() => {
    if (mode === 'range') {
      // Switch to year mode: collapse to rangeEnd
      setMode('year');
      onRangeChange(rangeEnd, rangeEnd);
    } else {
      // Switch to range mode: expand to [1400, selectedYear]
      setMode('range');
      onRangeChange(MIN_YEAR, rangeEnd);
    }
  }, [mode, rangeEnd, onRangeChange]);

  const padLeft = 40;
  const padRight = 40;

  const isYearMode = mode === 'year';
  const selectedYear = rangeEnd;
  const leftPercent = yearToPercent(rangeStart);
  const rightPercent = yearToPercent(rangeEnd);
  // In year mode, fill from start (1400) to the selected year
  const fillLeftPercent = isYearMode ? 0 : leftPercent;
  const fillRightPercent = rightPercent;

  return (
    <div
      id="timeline-controls"
      style={{
        position: 'fixed',
        bottom: `calc(0px + env(safe-area-inset-bottom))`,
        left: 0,
        right: 0,
        height: 'clamp(44px, 6vw, 52px)',
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
      {/* Play/Pause Button — 36px visible, 44px hit area */}
      <button
        onClick={onPlayPause}
        aria-label={isPlaying ? 'Pause playback' : 'Play timeline'}
        aria-pressed={isPlaying}
        style={{
          width: 44,
          height: 44,
          padding: '4px',
          borderRadius: '10px',
          border: 'none',
          backgroundColor: 'transparent',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          outline: 'none',
        }}
        onFocus={(e) => { if (e.currentTarget.matches(':focus-visible')) e.currentTarget.style.boxShadow = '0 0 0 3px rgba(196,50,107,0.4)'; }}
        onBlur={(e) => { e.currentTarget.style.boxShadow = 'none'; }}
      >
        <span style={{
          width: 36,
          height: 36,
          borderRadius: '8px',
          backgroundColor: isPlaying ? '#D83E7F' : 'rgba(196,50,107,0.1)',
          color: isPlaying ? '#FAF3EB' : '#C4326B',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'background-color 0.15s, color 0.15s',
          fontFamily: '"DM Sans", sans-serif',
        }}>
          {isPlaying ? (
            <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
              <rect x="2" y="2" width="4" height="10" rx="1" />
              <rect x="8" y="2" width="4" height="10" rx="1" />
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
              <polygon points="3,2 12,7 3,12" />
            </svg>
          )}
        </span>
      </button>

      {/* Mode toggle — segmented control */}
      <div
        role="radiogroup"
        aria-label="Timeline mode"
        style={{
          display: 'flex',
          borderRadius: 8,
          border: '1px solid rgba(150, 140, 130, 0.3)',
          overflow: 'hidden',
          flexShrink: 0,
          height: 36,
        }}
      >
        <button
          role="radio"
          aria-checked={isYearMode}
          aria-label="Single year mode"
          onClick={() => { if (!isYearMode) handleModeToggle(); }}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4,
            padding: '0 10px',
            minWidth: 44,
            minHeight: 44,
            border: 'none',
            cursor: 'pointer',
            fontFamily: '"DM Sans", sans-serif',
            fontSize: 11,
            fontWeight: 600,
            backgroundColor: isYearMode ? 'rgba(196,50,107,0.12)' : 'transparent',
            color: isYearMode ? '#C4326B' : '#6B5F55',
            transition: 'background-color 0.15s, color 0.15s',
            outline: 'none',
          }}
          onFocus={(e) => { if (e.currentTarget.matches(':focus-visible')) e.currentTarget.style.boxShadow = '0 0 0 3px rgba(196,50,107,0.4)'; }}
          onBlur={(e) => { e.currentTarget.style.boxShadow = 'none'; }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true">
            <circle cx="7" cy="3" r="2.5" />
            <rect x="6" y="5" width="2" height="7" rx="1" />
          </svg>
          Year
        </button>
        <div style={{ width: 1, backgroundColor: 'rgba(150, 140, 130, 0.3)' }} />
        <button
          role="radio"
          aria-checked={!isYearMode}
          aria-label="Year range mode"
          onClick={() => { if (isYearMode) handleModeToggle(); }}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4,
            padding: '0 10px',
            minWidth: 44,
            minHeight: 44,
            border: 'none',
            cursor: 'pointer',
            fontFamily: '"DM Sans", sans-serif',
            fontSize: 11,
            fontWeight: 600,
            backgroundColor: !isYearMode ? 'rgba(196,50,107,0.12)' : 'transparent',
            color: !isYearMode ? '#C4326B' : '#6B5F55',
            transition: 'background-color 0.15s, color 0.15s',
            outline: 'none',
          }}
          onFocus={(e) => { if (e.currentTarget.matches(':focus-visible')) e.currentTarget.style.boxShadow = '0 0 0 3px rgba(196,50,107,0.4)'; }}
          onBlur={(e) => { e.currentTarget.style.boxShadow = 'none'; }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true">
            <rect x="2" y="2" width="2" height="10" rx="1" />
            <rect x="10" y="2" width="2" height="10" rx="1" />
            <rect x="5" y="6" width="4" height="2" rx="0.5" />
          </svg>
          Range
        </button>
      </div>

      {/* Timeline area */}
      <div
        ref={containerRef}
        role="group"
        aria-label={isYearMode ? 'Timeline year selector' : 'Timeline year range'}
        style={{
          flex: 1,
          height: isMobile ? '42px' : '48px',
          position: 'relative',
          cursor: 'pointer',
        }}
        title={isYearMode ? 'Click to select a year' : (rangeEnd - rangeStart >= 2025 - 1400 ? 'Click to zoom into a century' : 'Click to center the range here')}
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
            const inRange = isYearMode
              ? decade <= selectedYear
              : (decade >= rangeStart && decade < rangeEnd);
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

        {/* Selected range / year overlay */}
        <div
          style={{
            position: 'absolute',
            left: `calc(${padLeft}px + (100% - ${padLeft + padRight}px) * ${fillLeftPercent / 100})`,
            width: `calc((100% - ${padLeft + padRight}px) * ${(fillRightPercent - fillLeftPercent) / 100})`,
            top: 0,
            bottom: isMobile ? 12 : 14,
            background: 'linear-gradient(to right, rgba(216,62,127,0.08), rgba(212,41,94,0.08))',
            border: '1px solid rgba(216,62,127,0.2)',
            borderRadius: '2px',
            pointerEvents: 'none',
          }}
        />

        {/* Left handle — only in range mode */}
        {!isYearMode && (
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
        )}

        {/* Right handle (range mode) / Year handle (year mode) */}
        <div
          role="slider"
          aria-label={isYearMode ? 'Selected year' : 'Range end year'}
          aria-orientation="horizontal"
          aria-valuemin={MIN_YEAR}
          aria-valuemax={MAX_YEAR}
          aria-valuenow={isYearMode ? selectedYear : rangeEnd}
          aria-valuetext={isYearMode ? `Year ${selectedYear}` : `Year ${rangeEnd}`}
          tabIndex={0}
          onPointerDown={(e) => handlePointerDown(e, isYearMode ? 'year' : 'right')}
          onFocus={(e) => { if (e.currentTarget.matches(':focus-visible')) { e.currentTarget.style.outline = '2px solid #D83E7F'; e.currentTarget.style.outlineOffset = '2px'; } }}
          onBlur={(e) => { e.currentTarget.style.outline = 'none'; }}
          onKeyDown={(e) => {
            if (isYearMode) {
              if (e.key === 'ArrowLeft') onRangeChange(Math.max(MIN_YEAR, selectedYear - 10), Math.max(MIN_YEAR, selectedYear - 10));
              if (e.key === 'ArrowRight') onRangeChange(Math.min(MAX_YEAR, selectedYear + 10), Math.min(MAX_YEAR, selectedYear + 10));
              if (e.key === 'Home') onRangeChange(MIN_YEAR, MIN_YEAR);
              if (e.key === 'End') onRangeChange(MAX_YEAR, MAX_YEAR);
              if (e.key === 'PageUp') onRangeChange(Math.max(MIN_YEAR, selectedYear - 50), Math.max(MIN_YEAR, selectedYear - 50));
              if (e.key === 'PageDown') onRangeChange(Math.min(MAX_YEAR, selectedYear + 50), Math.min(MAX_YEAR, selectedYear + 50));
            } else {
              if (e.key === 'ArrowLeft') onRangeChange(rangeStart, Math.max(rangeStart + 10, rangeEnd - 10));
              if (e.key === 'ArrowRight') onRangeChange(rangeStart, Math.min(MAX_YEAR, rangeEnd + 10));
              if (e.key === 'Home') onRangeChange(rangeStart, Math.max(rangeStart + 10, MIN_YEAR + 10));
              if (e.key === 'End') onRangeChange(rangeStart, MAX_YEAR);
              if (e.key === 'PageUp') onRangeChange(rangeStart, Math.max(rangeStart + 10, rangeEnd - 50));
              if (e.key === 'PageDown') onRangeChange(rangeStart, Math.min(MAX_YEAR, rangeEnd + 50));
            }
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
              width: isYearMode ? 12 : 4,
              height: isYearMode ? 12 : '100%',
              backgroundColor: '#D4295E',
              borderRadius: isYearMode ? '50%' : '2px',
              boxShadow: isYearMode ? '0 0 12px rgba(212, 41, 94, 0.7)' : '0 0 8px rgba(212, 41, 94, 0.6)',
            }}
          />
        </div>

        {/* C: Year mode — prominent year label centered above handle */}
        {isYearMode && (
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              left: `calc(${padLeft}px + (100% - ${padLeft + padRight}px) * ${rightPercent / 100})`,
              bottom: isMobile ? 14 : 16,
              transform: 'translateX(-50%)',
              fontSize: 16,
              fontFamily: '"Instrument Serif", serif',
              fontWeight: 400,
              color: '#C4326B',
              whiteSpace: 'nowrap',
              pointerEvents: 'none',
            }}
          >
            {selectedYear}
          </div>
        )}

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
            if (isYearMode) {
              if (Math.abs(year - selectedYear) < 15) return null;
            } else {
              const nearStart = Math.abs(year - rangeStart) < 15;
              const nearEnd = Math.abs(year - rangeEnd) < 15;
              if (nearStart || nearEnd) return null;
            }
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

        {/* Year mode: single editable year input */}
        {isYearMode && (
          editingYear ? (
            <input
              type="number"
              min={MIN_YEAR}
              max={MAX_YEAR}
              step={10}
              value={yearInput}
              onChange={(e) => setYearInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const val = Math.max(MIN_YEAR, Math.min(MAX_YEAR, Math.round(parseInt(yearInput) / 10) * 10));
                  if (!isNaN(val)) onRangeChange(val, val);
                  setEditingYear(false);
                }
                if (e.key === 'Escape') setEditingYear(false);
              }}
              onBlur={() => {
                const val = Math.max(MIN_YEAR, Math.min(MAX_YEAR, Math.round(parseInt(yearInput) / 10) * 10));
                if (!isNaN(val)) onRangeChange(val, val);
                setEditingYear(false);
              }}
              autoFocus
              aria-label="Set year"
              style={{
                position: 'absolute', left: `calc(${padLeft}px + (100% - ${padLeft + padRight}px) * ${rightPercent / 100} - 30px)`,
                bottom: 16, width: 56, height: 24, minHeight: 44, padding: '0 4px',
                fontSize: 12, fontFamily: '"DM Sans", sans-serif', fontWeight: 600,
                color: '#C4326B', backgroundColor: 'rgba(250,243,235,0.95)',
                border: '1px solid #C4326B', borderRadius: 4, textAlign: 'center', outline: 'none',
                zIndex: 10,
              }}
            />
          ) : null
        )}

        {/* Range mode: Editable start year display */}
        {!isYearMode && (
          editingStart ? (
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
          )
        )}

        {/* Range mode: Editable end year display */}
        {!isYearMode && (
          editingEnd ? (
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
          )
        )}
      </div>

      {/* A4: Visually-hidden live region for screen readers */}
      <div role="status" aria-live="polite" style={{position:'absolute',width:1,height:1,overflow:'hidden',clip:'rect(0,0,0,0)',whiteSpace:'nowrap'}}>
        {liveText}
      </div>
    </div>
  );
}
