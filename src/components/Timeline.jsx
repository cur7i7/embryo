import React, { useState, useMemo, useRef, useCallback, useEffect, useLayoutEffect, memo } from 'react';
import { useIsPointerFine } from '../hooks/useIsPointerFine';

const MIN_YEAR = 1400;
const PLAY_SPEEDS = [1, 0.5, 2]; // 1x, 0.5x, 2x — cycle order
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

function Timeline({ artists, rangeStart, rangeEnd, onRangeChange, isPlaying, onPlayPause, isMobile, initialMode }) {
  const isPointerFine = useIsPointerFine();
  const containerRef = useRef(null);
  const dragging = useRef(null); // 'left' | 'right' | 'year' | null
  const didDrag = useRef(false);
  const rafPending = useRef(false);
  const pendingRange = useRef(null);
  const rangeStartRef = useRef(rangeStart);
  const rangeEndRef = useRef(rangeEnd);
  const handlePointerMoveRef = useRef(null);
  const radioYearRef = useRef(null);
  const radioRangeRef = useRef(null);

  // Fix: Track container width in state to avoid reading ref during render.
  // mode is included in the dependency array so the observer re-initializes
  // when the user switches modes (year/range), because containerRef.current is
  // only populated while the range-mode subtree is mounted.
  const [containerWidth, setContainerWidth] = useState(300);
  const [mode, setMode] = useState(initialMode || 'range');
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setContainerWidth(el.offsetWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [mode]);

  // Fix #19: Track which handle is actively being dragged for z-index priority
  const [activeHandle, setActiveHandle] = useState(null);

  // Fix #47: Play speed state (exposed via shift+click on play button)
  const [playSpeedIndex, setPlaySpeedIndex] = useState(0);
  const playSpeed = PLAY_SPEEDS[playSpeedIndex];

  // Keep refs in sync with latest prop values
  useEffect(() => {
    rangeStartRef.current = rangeStart;
    rangeEndRef.current = rangeEnd;
  }, [rangeStart, rangeEnd]);

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

  // Fix #47: Clamped-feedback state for year-mode input
  const [clampedFeedback, setClampedFeedback] = useState(null);
  const clampedFeedbackTimerRef = useRef(null);

  // Year mode: always-visible input value
  const [yearInputValue, setYearInputValue] = useState(String(rangeEnd));

  // Fix #10: Auto-switch to Range mode when rangeStart ≠ rangeEnd externally
  // (e.g. auto-expand effect in App.jsx sets a range for selected artist).
  // setState call is intentional — this is a controlled reset on prop change.
  useEffect(() => {
    if (mode === 'year' && rangeStart !== rangeEnd) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMode('range');
    }
  }, [rangeStart, rangeEnd, mode]);

  // Sync yearInputValue when rangeEnd changes externally (play button, URL, etc.).
  // setState call is intentional — keeps the input display in sync with prop.
  useEffect(() => {
    if (mode === 'year') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setYearInputValue(String(rangeEnd));
    }
  }, [rangeEnd, mode]);

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

  // Fix #7: Responsive padding — clamp(20px, 5vw, 40px) per side
  const responsivePad = useMemo(() => {
    const vw5 = windowWidth * 0.05;
    return Math.max(20, Math.min(40, vw5));
  }, [windowWidth]);

  // Convert a pixel x-offset within the container to a year
  const xToYear = useCallback((x, containerWidth) => {
    const usableWidth = containerWidth - responsivePad * 2;
    const fraction = (x - responsivePad) / usableWidth;
    const year = MIN_YEAR + fraction * (MAX_YEAR - MIN_YEAR);
    return Math.round(Math.max(MIN_YEAR, Math.min(MAX_YEAR, year)));
  }, [responsivePad]);

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

    // Always read latest values from refs to avoid stale closure issues
    const currentRangeStart = rangeStartRef.current;
    const currentRangeEnd = rangeEndRef.current;

    let next = null;
    if (dragging.current === 'year') {
      // Year mode: single handle moves both start and end
      const snapped = Math.round(year / SNAP) * SNAP;
      const clamped = Math.max(MIN_YEAR, Math.min(MAX_YEAR, snapped));
      if (clamped !== currentRangeEnd) next = [clamped, clamped];
    } else if (dragging.current === 'left') {
      const snapped = Math.round(year / SNAP) * SNAP;
      const newStart = Math.max(MIN_YEAR, Math.min(snapped, currentRangeEnd - SNAP));
      if (newStart !== currentRangeStart) next = [newStart, currentRangeEnd];
    } else {
      const snapped = Math.round(year / SNAP) * SNAP;
      const newEnd = Math.min(MAX_YEAR, Math.max(snapped, currentRangeStart + SNAP));
      if (newEnd !== currentRangeEnd) next = [currentRangeStart, newEnd];
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
  }, [dragging, onRangeChange, xToYear]);

  // Keep the ref in sync so handlePointerDown always calls the latest version
  useEffect(() => {
    handlePointerMoveRef.current = handlePointerMove;
  });

  const handlePointerUp = useCallback(() => {
    dragging.current = null;
    setActiveHandle(null); // Fix #19: clear active handle
  }, []);

  const handlePointerDown = useCallback((e, handle) => {
    e.preventDefault();
    e.stopPropagation();
    dragging.current = handle;
    didDrag.current = false;
    setActiveHandle(handle); // Fix #19: track active handle for z-index
    // setPointerCapture routes all future pointermove/pointerup events to this
    // element even when the pointer leaves it, making window listeners redundant.
    e.currentTarget.setPointerCapture(e.pointerId);
  }, []);

  // Fix #37: Double-click on track resets range to full extent
  const handleDoubleClick = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    onRangeChange(MIN_YEAR, MAX_YEAR);
  }, [onRangeChange]);

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
      setYearInputValue(String(rangeEnd));
      onRangeChange(rangeEnd, rangeEnd);
    } else {
      // Switch to range mode: expand to [1400, selectedYear]
      setMode('range');
      onRangeChange(MIN_YEAR, rangeEnd);
    }
  }, [mode, rangeEnd, onRangeChange]);

  // Fix #7: Use responsive padding instead of hardcoded 40px
  const padLeft = responsivePad;
  const padRight = responsivePad;

  const isYearMode = mode === 'year';
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
      {/* Play/Pause Button — 36px visible, 44px hit area. Fix #47: Shift+click cycles speed */}
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <button
          onClick={(e) => {
            if (e.shiftKey) {
              // Fix #47: Shift+click cycles play speed
              setPlaySpeedIndex((prev) => (prev + 1) % PLAY_SPEEDS.length);
            } else {
              onPlayPause(playSpeed);
            }
          }}
          aria-label={isPlaying ? `Pause playback (${playSpeed}x speed)` : `Play timeline (${playSpeed}x speed). Shift+click to change speed`}
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
          }}
        >
          <span style={{
            width: 36,
            height: 36,
            borderRadius: '8px',
            backgroundColor: isPlaying ? '#C4366F' : 'rgba(196,50,107,0.1)',
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
        {/* Fix #47: Speed indicator badge */}
        {playSpeed !== 1 && (
          <span
            aria-hidden="true"
            style={{
              position: 'absolute',
              top: 2,
              right: 0,
              fontSize: 9,
              fontFamily: '"DM Sans", sans-serif',
              fontWeight: 700,
              color: '#FAF3EB',
              backgroundColor: '#B8336A',
              borderRadius: 4,
              padding: '1px 3px',
              lineHeight: 1,
              pointerEvents: 'none',
            }}
          >
            {playSpeed}x
          </span>
        )}
      </div>

      {/* Mode toggle — segmented control */}
      <div
        role="radiogroup"
        aria-label="Timeline mode"
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
            e.preventDefault();
            if (!isYearMode) { handleModeToggle(); radioYearRef.current?.focus(); }
          } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
            e.preventDefault();
            if (isYearMode) { handleModeToggle(); radioRangeRef.current?.focus(); }
          }
        }}
        style={{
          display: 'flex',
          borderRadius: 8,
          border: '1px solid rgba(150, 140, 130, 0.3)',
          overflow: 'hidden',
          flexShrink: 0,
        }}
      >
        <button
          ref={radioYearRef}
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
            height: 44, // Fix #14: 44px on all devices
            border: 'none',
            cursor: 'pointer',
            fontFamily: '"DM Sans", sans-serif',
            fontSize: 12, // Fix #28: was 11px, below project minimum
            fontWeight: 600,
            backgroundColor: isYearMode ? 'rgba(196,50,107,0.12)' : 'transparent',
            color: isYearMode ? '#C4326B' : '#6B5F55',
            transition: 'background-color 0.15s, color 0.15s',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true">
            <circle cx="7" cy="3" r="2.5" />
            <rect x="6" y="5" width="2" height="7" rx="1" />
          </svg>
          Year
        </button>
        <div style={{ width: 1, backgroundColor: 'rgba(150, 140, 130, 0.3)' }} />
        <button
          ref={radioRangeRef}
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
            height: 44, // Fix #14: 44px on all devices
            border: 'none',
            cursor: 'pointer',
            fontFamily: '"DM Sans", sans-serif',
            fontSize: 12, // Fix #28: was 11px, below project minimum
            fontWeight: 600,
            backgroundColor: !isYearMode ? 'rgba(196,50,107,0.12)' : 'transparent',
            color: !isYearMode ? '#C4326B' : '#6B5F55',
            transition: 'background-color 0.15s, color 0.15s',
          }}
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
        role="group"
        aria-label={isYearMode ? 'Timeline year selector' : 'Timeline year range'}
        style={{
          flex: 1,
          height: isMobile ? '42px' : '48px',
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
        }}
      >
        {/* Year mode: prominent text input */}
        {isYearMode && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            flexShrink: 0,
          }}>
            <label
              htmlFor="year-input"
              style={{
                fontSize: 13,
                fontFamily: '"DM Sans", sans-serif',
                fontWeight: 500,
                color: '#6B5F55',
              }}
            >
              Show year
            </label>
            <input
              id="year-input"
              type="number"
              min={MIN_YEAR}
              max={MAX_YEAR}
              step={10}
              value={yearInputValue}
              onChange={(e) => setYearInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const val = parseInt(yearInputValue, 10);
                  if (isNaN(val)) {
                    // Fix #25: revert to previous valid value on NaN
                    setYearInputValue(String(rangeEnd));
                  } else {
                    const clamped = Math.max(MIN_YEAR, Math.min(MAX_YEAR, Math.round(val / 10) * 10));
                    onRangeChange(clamped, clamped);
                    setYearInputValue(String(clamped));
                    // Fix #47: show feedback if value was clamped
                    if (clamped !== val) {
                      clearTimeout(clampedFeedbackTimerRef.current);
                      setClampedFeedback(clamped);
                      clampedFeedbackTimerRef.current = setTimeout(() => setClampedFeedback(null), 2000);
                    }
                  }
                }
              }}
              onBlur={() => {
                const val = parseInt(yearInputValue, 10);
                if (isNaN(val)) {
                  // Fix #25: revert to previous valid value on NaN
                  setYearInputValue(String(rangeEnd));
                } else {
                  const clamped = Math.max(MIN_YEAR, Math.min(MAX_YEAR, Math.round(val / 10) * 10));
                  onRangeChange(clamped, clamped);
                  setYearInputValue(String(clamped));
                  // Fix #47: show feedback if value was clamped
                  if (clamped !== val) {
                    clearTimeout(clampedFeedbackTimerRef.current);
                    setClampedFeedback(clamped);
                    clampedFeedbackTimerRef.current = setTimeout(() => setClampedFeedback(null), 2000);
                  }
                }
              }}
              aria-label="Select year to display"
              aria-invalid={clampedFeedback != null ? 'true' : undefined}
              style={{
                width: 72,
                height: isPointerFine ? 32 : 44,
                minHeight: 44,
                padding: '0 6px',
                fontSize: 14,
                fontFamily: '"DM Sans", sans-serif',
                fontWeight: 600,
                color: '#C4326B',
                backgroundColor: 'transparent',
                border: 'none',
                borderBottom: clampedFeedback != null ? '2px solid #C0392B' : '1px dashed rgba(196,50,107,0.4)',
                borderRadius: 0,
                textAlign: 'center',
                boxSizing: 'border-box',
                transition: 'border-color 0.2s',
              }}
            />
            <span style={{
              fontSize: 12,
              fontFamily: '"DM Sans", sans-serif',
              color: '#6B5F55',
            }}>
              {MIN_YEAR}–{MAX_YEAR}
            </span>
            {/* Fix #47: screen-reader announcement when year is clamped */}
            <span
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
              {clampedFeedback != null ? `Year adjusted to ${clampedFeedback}` : ''}
            </span>
          </div>
        )}

        {/* Range mode: histogram slider */}
        {!isYearMode && (
          <div
            ref={containerRef}
            style={{
              flex: 1,
              height: '100%',
              position: 'relative',
              cursor: 'pointer',
            }}
            title={rangeEnd - rangeStart >= 2025 - 1400 ? 'Click to zoom into a century. Double-click to show all years.' : 'Click to center the range here. Double-click to show all years.'}
            onClick={handleClick}
            onDoubleClick={handleDoubleClick}
          >
            {/* Histogram bars — Fix #6: increased bottom to 20/22px so bars don't overlap year labels */}
            <div
              style={{
                position: 'absolute',
                left: padLeft,
                right: padRight,
                top: 0,
                bottom: isMobile ? 20 : 22,
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
                      background: 'linear-gradient(to top, #C4366F, #FFBA52)',
                      opacity: inRange ? 0.65 : 0.25,
                      borderRadius: '2px 2px 0 0',
                      transition: 'opacity 0.15s',
                    }}
                  />
                );
              })}
            </div>

            {/* Selected range overlay — Fix #6: match histogram bottom */}
            <div
              style={{
                position: 'absolute',
                left: `calc(${padLeft}px + (100% - ${padLeft + padRight}px) * ${fillLeftPercent / 100})`,
                width: `calc((100% - ${padLeft + padRight}px) * ${(fillRightPercent - fillLeftPercent) / 100})`,
                top: 0,
                bottom: isMobile ? 20 : 22,
                background: 'linear-gradient(to right, rgba(216,62,127,0.08), rgba(212,41,94,0.08))',
                border: '1px solid rgba(216,62,127,0.2)',
                borderRadius: '2px',
                pointerEvents: 'none',
              }}
            />

            {/* Left handle — Fix #19: active z-index, Fix #30: 44px min on touch */}
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
              onPointerMove={(e) => handlePointerMoveRef.current(e)}
              onPointerUp={handlePointerUp}
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
                bottom: isPointerFine ? (isMobile ? 20 : 22) : 0, // Fix #30: full height on touch for 44px target
                minHeight: 44,
                width: '44px',
                cursor: 'ew-resize',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: activeHandle === 'left' ? 8 : 5, // Fix #19: dragged handle on top
              }}
            >
              <div
                style={{
                  width: '4px',
                  height: '100%',
                  backgroundColor: '#C4366F',
                  borderRadius: '2px',
                  boxShadow: '0 0 3px rgba(216, 62, 127, 0.4)',
                }}
              />
            </div>

            {/* Right handle — Fix #19: active z-index, Fix #30: 44px min on touch */}
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
              onPointerMove={(e) => handlePointerMoveRef.current(e)}
              onPointerUp={handlePointerUp}
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
                bottom: isPointerFine ? (isMobile ? 20 : 22) : 0, // Fix #30: full height on touch
                minHeight: 44,
                width: '44px',
                cursor: 'ew-resize',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: activeHandle === 'right' ? 8 : 5, // Fix #19: dragged handle on top
              }}
            >
              <div
                style={{
                  width: 4,
                  height: '100%',
                  backgroundColor: '#D4295E',
                  borderRadius: 2,
                  boxShadow: '0 0 3px rgba(212, 41, 94, 0.4)',
                }}
              />
            </div>

            {/* Year labels (static reference marks) — Fix #6: increased gap from bars */}
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
                // Fix #38: Use pixel distance instead of year distance for consistent behavior
                const usableWidth = containerWidth - padLeft - padRight;
                const pxPerYear = usableWidth / (MAX_YEAR - MIN_YEAR);
                const MIN_PX_GAP = 40; // minimum pixel distance before hiding label
                const pxFromStart = Math.abs(year - rangeStart) * pxPerYear;
                const pxFromEnd = Math.abs(year - rangeEnd) * pxPerYear;
                if (pxFromStart < MIN_PX_GAP || pxFromEnd < MIN_PX_GAP) return null;
                return (
                  <span
                    key={year}
                    style={{
                      position: 'absolute',
                      left: `${pct}%`,
                      transform: 'translateX(-50%)',
                      fontSize: '12px',
                      fontFamily: '"DM Sans", sans-serif',
                      fontWeight: 500,
                      color: '#4A3F37',
                      letterSpacing: '0.02em',
                      whiteSpace: 'nowrap',
                      textShadow: '0 0 4px rgba(250, 243, 235, 0.9)',
                    }}
                  >
                    {year}
                  </span>
                );
              })}
            </div>

            {/* Range mode: Editable start year display — Fix #20: positioning, Fix #39: remove dead height */}
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
                    const parsed = parseInt(startInput, 10);
                    if (!isNaN(parsed)) {
                      const val = Math.max(MIN_YEAR, Math.min(rangeEnd - 10, Math.round(parsed / 10) * 10));
                      onRangeChange(val, rangeEnd);
                    }
                    setEditingStart(false);
                  }
                  if (e.key === 'Escape') setEditingStart(false);
                }}
                onBlur={() => {
                  const parsed = parseInt(startInput, 10);
                  if (!isNaN(parsed)) {
                    const val = Math.max(MIN_YEAR, Math.min(rangeEnd - 10, Math.round(parsed / 10) * 10));
                    onRangeChange(val, rangeEnd);
                  }
                  setEditingStart(false);
                }}
                autoFocus
                aria-label="Set start year"
                style={{
                  position: 'absolute', left: `calc(${padLeft}px + (100% - ${padLeft + padRight}px) * ${leftPercent / 100} + 10px)`,
                  bottom: 0, width: 56, minHeight: 44, padding: '0 4px',
                  fontSize: 12, fontFamily: '"DM Sans", sans-serif', fontWeight: 600,
                  color: '#C4326B', backgroundColor: 'rgba(250,243,235,0.95)',
                  border: '1px solid #C4326B', borderRadius: 4, textAlign: 'center',
                  zIndex: 10, boxSizing: 'border-box',
                }}
              />
            ) : (
              <button
                onClick={() => { setStartInput(String(rangeStart)); setEditingStart(true); }}
                aria-label={`Start year: ${rangeStart}. Click to edit`}
                style={{
                  position: 'absolute', left: `calc(${padLeft}px + (100% - ${padLeft + padRight}px) * ${leftPercent / 100} + 10px)`,
                  bottom: 0, background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: 12, fontFamily: '"DM Sans", sans-serif', fontWeight: 600,
                  color: '#C4326B', padding: '2px 4px', minHeight: 44, minWidth: 44, display: 'flex', alignItems: 'center',
                  borderBottom: '1px dashed rgba(196,50,107,0.4)',
                }}
              >
                {rangeStart}
              </button>
            )}

            {/* Range mode: Editable end year display — Fix #20: positioning, Fix #39: remove dead height */}
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
                    const parsed = parseInt(endInput, 10);
                    if (!isNaN(parsed)) {
                      const val = Math.min(MAX_YEAR, Math.max(rangeStart + 10, Math.round(parsed / 10) * 10));
                      onRangeChange(rangeStart, val);
                    }
                    setEditingEnd(false);
                  }
                  if (e.key === 'Escape') setEditingEnd(false);
                }}
                onBlur={() => {
                  const parsed = parseInt(endInput, 10);
                  if (!isNaN(parsed)) {
                    const val = Math.min(MAX_YEAR, Math.max(rangeStart + 10, Math.round(parsed / 10) * 10));
                    onRangeChange(rangeStart, val);
                  }
                  setEditingEnd(false);
                }}
                autoFocus
                aria-label="Set end year"
                style={{
                  position: 'absolute', left: `calc(${padLeft}px + (100% - ${padLeft + padRight}px) * ${rightPercent / 100} - 66px)`,
                  bottom: 0, width: 56, minHeight: 44, padding: '0 4px',
                  fontSize: 12, fontFamily: '"DM Sans", sans-serif', fontWeight: 600,
                  color: '#C4326B', backgroundColor: 'rgba(250,243,235,0.95)',
                  border: '1px solid #C4326B', borderRadius: 4, textAlign: 'center',
                  zIndex: 10, boxSizing: 'border-box',
                }}
              />
            ) : (
              <button
                onClick={() => { setEndInput(String(rangeEnd)); setEditingEnd(true); }}
                aria-label={`End year: ${rangeEnd}. Click to edit`}
                style={{
                  position: 'absolute', left: `calc(${padLeft}px + (100% - ${padLeft + padRight}px) * ${rightPercent / 100} - 50px)`,
                  bottom: 0, background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: 12, fontFamily: '"DM Sans", sans-serif', fontWeight: 600,
                  color: '#C4326B', padding: '2px 4px', minHeight: 44, minWidth: 44, display: 'flex', alignItems: 'center',
                  borderBottom: '1px dashed rgba(196,50,107,0.4)',
                }}
              >
                {rangeEnd}
              </button>
            )}
          </div>
        )}
      </div>

      {/* A4: Visually-hidden live region for screen readers */}
      <div role="status" aria-live="polite" style={{position:'absolute',width:1,height:1,overflow:'hidden',clip:'rect(0,0,0,0)',whiteSpace:'nowrap'}}>
        {liveText}
      </div>
    </div>
  );
}

export default memo(Timeline);
