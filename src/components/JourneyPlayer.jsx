import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';

const BAR_STYLE = {
  position: 'fixed',
  top: 'env(safe-area-inset-top, 0px)',
  left: '50%',
  transform: 'translateX(-50%)',
  zIndex: 35,
  width: 'clamp(320px, 60vw, 560px)',
  maxWidth: 'calc(100vw - 24px)',
  backgroundColor: 'rgba(250, 243, 235, 0.95)',
  backdropFilter: 'blur(10px)',
  borderRadius: '0 0 16px 16px',
  boxShadow: '0 4px 20px rgba(62, 53, 48, 0.15)',
  fontFamily: '"DM Sans", sans-serif',
  padding: '12px 16px 14px',
  border: '1px solid rgba(224, 216, 204, 0.7)',
  borderTop: 'none',
};

const BTN_STYLE = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  padding: '4px 8px',
  fontSize: 16,
  color: '#5A5048',
  borderRadius: 8,
  minWidth: 44,
  minHeight: 44,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontFamily: 'inherit',
};

export default function JourneyPlayer({
  journey,
  allArtists,
  onNavigate,
  onSelectArtist,
  onExit,
  isMobile,
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const timerRef = useRef(null);
  const waypoints = journey?.waypoints || [];
  const wp = waypoints[currentIndex];

  const artist = useMemo(() => {
    if (!wp || !allArtists) return null;
    return allArtists.find(a => a.id === wp.artistId) || null;
  }, [wp, allArtists]);

  const artistName = artist?.name || '';

  const goTo = useCallback((idx) => {
    if (idx < 0 || idx >= waypoints.length) return;
    setCurrentIndex(idx);
    onNavigate?.(waypoints[idx], idx);
  }, [waypoints, onNavigate]);

  // Auto-advance timer
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!isPlaying || !wp) return;
    timerRef.current = setTimeout(() => {
      if (currentIndex < waypoints.length - 1) {
        goTo(currentIndex + 1);
      } else {
        setIsPlaying(false);
      }
    }, (wp.pauseSeconds || 6) * 1000);
    return () => clearTimeout(timerRef.current);
  }, [currentIndex, isPlaying, wp, waypoints.length, goTo]);

  // Navigate to first waypoint on mount
  useEffect(() => {
    if (waypoints.length > 0) {
      onNavigate?.(waypoints[0], 0);
    }
    // Reset state for new journey
    setCurrentIndex(0);
    setIsPlaying(true);
  }, [journey?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!journey || waypoints.length === 0) return null;

  return (
    <div style={BAR_STYLE} role="region" aria-label={`Journey: ${journey.title}`}>
      {/* Title row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.8px', color: '#6B5F55' }}>
          {journey.title}
        </div>
        <button onClick={onExit} style={{ ...BTN_STYLE, fontSize: 13, padding: '2px 8px' }} aria-label="Exit journey">
          ✕
        </button>
      </div>

      {/* Narration */}
      <div style={{ fontSize: 14, color: '#3E3530', lineHeight: 1.5, marginBottom: 10, minHeight: 42 }}>
        <button
          onClick={() => artist && onSelectArtist?.(artist)}
          style={{
            background: 'none', border: 'none', cursor: artist ? 'pointer' : 'default',
            padding: 0, fontWeight: 600, color: '#D83E7F', fontSize: 14, fontFamily: 'inherit',
          }}
          aria-label={artist ? `View details for ${artistName}` : undefined}
        >
          {artistName}
        </button>
        {wp?.narration ? ` — ${wp.narration}` : ''}
      </div>

      {/* Progress dots */}
      <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginBottom: 10 }}>
        {waypoints.map((_, i) => (
          <button
            key={i}
            onClick={() => { goTo(i); setIsPlaying(false); }}
            aria-label={`Go to stop ${i + 1}`}
            style={{
              width: i === currentIndex ? 16 : 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: i === currentIndex ? '#D83E7F' : i < currentIndex ? '#C4B8AE' : '#E0D8CC',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
              transition: 'width 0.2s ease, background-color 0.2s ease',
            }}
          />
        ))}
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 4 }}>
        <button
          onClick={() => { goTo(currentIndex - 1); setIsPlaying(false); }}
          disabled={currentIndex === 0}
          style={{ ...BTN_STYLE, opacity: currentIndex === 0 ? 0.3 : 1 }}
          aria-label="Previous stop"
        >
          ◂
        </button>
        <button
          onClick={() => setIsPlaying(p => !p)}
          style={BTN_STYLE}
          aria-label={isPlaying ? 'Pause journey' : 'Resume journey'}
        >
          {isPlaying ? '⏸' : '▶'}
        </button>
        <button
          onClick={() => { goTo(currentIndex + 1); setIsPlaying(false); }}
          disabled={currentIndex === waypoints.length - 1}
          style={{ ...BTN_STYLE, opacity: currentIndex === waypoints.length - 1 ? 0.3 : 1 }}
          aria-label="Next stop"
        >
          ▸
        </button>
      </div>

      {/* Step counter */}
      <div style={{ textAlign: 'center', fontSize: 12, color: '#6B5F55', marginTop: 6 }}>
        {currentIndex + 1} of {waypoints.length}
      </div>
    </div>
  );
}
