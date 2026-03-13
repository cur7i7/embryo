import React, { useCallback, useEffect, useRef, useState } from 'react';
import { getGenreBucket } from '../utils/genres.js';
import { hexToRgba } from '../utils/rendering.js';
import { flyToArtist } from '../utils/mapHelpers.js';

const PANEL_WIDTH = 'clamp(320px, 30vw, 420px)';

function ConfidenceBar({ confidence }) {
  return (
    <div
      style={{
        height: 3,
        borderRadius: 2,
        backgroundColor: 'rgba(224, 216, 204, 0.6)',
        overflow: 'hidden',
        marginTop: 4,
      }}
      role="meter"
      aria-valuenow={Math.round(confidence * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`Confidence: ${Math.round(confidence * 100)}%`}
    >
      <div
        style={{
          height: '100%',
          width: `${Math.round(confidence * 100)}%`,
          backgroundColor: '#E9ADBE',
          borderRadius: 2,
        }}
      />
    </div>
  );
}

function GenreDot({ color, size = 8 }) {
  return (
    <span
      style={{
        display: 'inline-block',
        width: size,
        height: size,
        borderRadius: '50%',
        backgroundColor: color,
        flexShrink: 0,
      }}
      aria-hidden="true"
    />
  );
}

function ConnectionTypeLabel({ type }) {
  const styles = {
    teacher: { bg: '#F3DFD5', color: '#3E3530', label: 'Teacher' },
    influence: { bg: '#F3DBC6', color: '#3E3530', label: 'Influence' },
    peer: { bg: '#F8F1E0', color: '#3E3530', label: 'Peer' },
    collaboration: { bg: '#EECACA', color: '#3E3530', label: 'Collab' },
  };
  const s = styles[type] || { bg: '#F3DFD5', color: '#5A5048', label: type };
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 600,
        padding: '2px 6px',
        borderRadius: 4,
        backgroundColor: s.bg,
        color: s.color,
        letterSpacing: '0.03em',
        textTransform: 'uppercase',
        whiteSpace: 'nowrap',
      }}
    >
      {s.label}
    </span>
  );
}

function PipelineBadge({ pipeline }) {
  const isCurated = pipeline === 'curated';
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 500,
        padding: '1px 5px',
        borderRadius: 3,
        backgroundColor: isCurated ? '#F8F1E0' : '#F3DFD5',
        color: isCurated ? '#5A5048' : '#5A5048',
        border: `1px solid ${isCurated ? '#EEC1A2' : '#EECACA'}`,
        whiteSpace: 'nowrap',
      }}
    >
      {isCurated ? 'curated' : 'inferred'}
    </span>
  );
}

export default function DetailPanel({
  artist,
  connections,
  allArtists,
  onSelect,
  onClose,
  mapRef,
  isMobile = false,
}) {
  const isOpen = !!artist;
  const closeButtonRef = useRef(null);
  const previousFocusRef = useRef(null);
  const [history, setHistory] = useState([]);
  const artistKey = artist?.id;
  const [imageError, setImageError] = useState(false);
  const [prevArtistKey, setPrevArtistKey] = useState(artistKey);
  if (prevArtistKey !== artistKey) {
    setPrevArtistKey(artistKey);
    setImageError(false);
  }
  // A12: prefers-reduced-motion
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(
    () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
  );
  useEffect(() => {
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handler = (e) => setPrefersReducedMotion(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);
  const prevArtistRef = useRef(null);

  // Focus close button on panel open
  useEffect(() => {
    if (isOpen && closeButtonRef.current) {
      previousFocusRef.current = document.activeElement;
      closeButtonRef.current.focus();
    }
  }, [isOpen]);

  // Track navigation history
  useEffect(() => {
    if (artist && prevArtistRef.current && prevArtistRef.current.id !== artist.id) {
      setHistory(prev => [...prev.slice(-9), prevArtistRef.current]);
    }
    prevArtistRef.current = artist;
  }, [artist]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e) => {
      if (e.key === 'Escape') {
        previousFocusRef.current?.focus();
        onClose?.();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  const handleTrapKeyDown = useCallback((e) => {
    if (e.key !== 'Tab' || !isOpen) return;
    const focusable = e.currentTarget.querySelectorAll('button, a, input, [tabindex]:not([tabindex="-1"])');
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }, [isOpen]);

  const handleConnectedArtistClick = useCallback((connArtist) => {
    if (!connArtist) return;
    onSelect?.(connArtist);
    flyToArtist(mapRef, connArtist, { zoom: 6 });
  }, [onSelect, mapRef]);

  // Build a fast lookup for allArtists
  const artistMap = React.useMemo(() => {
    const m = new Map();
    for (const a of (allArtists || [])) {
      m.set(a.id, a);
    }
    return m;
  }, [allArtists]);

  const { bucket, color } = artist ? getGenreBucket(artist.genres) : { bucket: 'Other', color: '#E8A99B' };

  const lifespan = artist
    ? artist.birth_year
      ? artist.death_year
        ? `${artist.birth_year} – ${artist.death_year}`
        : `Born ${artist.birth_year}`
      : null
    : null;

  const location = artist
    ? [artist.birth_city, artist.birth_country].filter(Boolean).join(', ')
    : '';

  // Detect dvh support for mobile landscape fix
  const supportsDvh = React.useMemo(() => {
    try { return CSS.supports('height', '1dvh'); } catch { return false; }
  }, []);

  // Panel style changes based on mobile
  const panelStyle = isMobile
    ? {
        position: 'fixed',
        bottom: `calc(80px + env(safe-area-inset-bottom))`,
        left: 0,
        right: 0,
        width: '100%',
        height: supportsDvh
          ? 'clamp(200px, calc(60dvh - 80px), 70dvh)'
          : 'clamp(200px, calc(60vh - 80px), 70vh)',
        backgroundColor: 'rgba(250, 243, 235, 0.98)',
        backdropFilter: 'blur(12px)',
        borderTop: '1px solid rgba(224, 216, 204, 0.8)',
        boxShadow: '0 -4px 24px rgba(90, 80, 72, 0.12)',
        zIndex: 30,
        overflowY: 'auto',
        transform: isOpen ? 'translateY(0)' : 'translateY(100%)',
        transition: prefersReducedMotion ? 'none' : 'transform 0.3s ease',
        transitionProperty: prefersReducedMotion ? 'none' : 'transform, visibility',
        transitionDelay: prefersReducedMotion ? '0s' : (isOpen ? '0s' : '0s, 0.3s'),
        visibility: isOpen ? 'visible' : 'hidden',
        pointerEvents: isOpen ? 'auto' : 'none',
        padding: '24px',
        fontFamily: '"DM Sans", sans-serif',
        borderRadius: '16px 16px 0 0',
      }
    : {
        position: 'fixed',
        top: 0,
        right: 0,
        width: PANEL_WIDTH,
        height: '100vh',
        backgroundColor: 'rgba(250, 243, 235, 0.96)',
        backdropFilter: 'blur(12px)',
        borderLeft: '1px solid rgba(224, 216, 204, 0.8)',
        boxShadow: '-4px 0 24px rgba(90, 80, 72, 0.12)',
        zIndex: 30,
        overflowY: 'auto',
        transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
        transition: prefersReducedMotion ? 'none' : 'transform 0.3s ease',
        transitionProperty: prefersReducedMotion ? 'none' : 'transform, visibility',
        transitionDelay: prefersReducedMotion ? '0s' : (isOpen ? '0s' : '0s, 0.3s'),
        visibility: isOpen ? 'visible' : 'hidden',
        pointerEvents: isOpen ? 'auto' : 'none',
        padding: '24px',
        fontFamily: '"DM Sans", sans-serif',
      };

  return (
    <aside
      style={panelStyle}
      role="complementary"
      aria-label={artist ? `Details for ${artist.name}` : 'Artist details'}
      aria-hidden={!isOpen}
      ref={(el) => { if (el) { isOpen ? el.removeAttribute('inert') : el.setAttribute('inert', ''); } }}
      onKeyDown={handleTrapKeyDown}
    >
      {/* Back button */}
      {history.length > 0 && (
        <button
          onClick={() => {
            const prev = history[history.length - 1];
            setHistory(h => h.slice(0, -1));
            onSelect?.(prev);
          }}
          aria-label="Go back to previous artist"
          style={{
            position: 'absolute',
            top: 16,
            right: 64,
            width: 44,
            height: 44,
            border: 'none',
            borderRadius: '50%',
            backgroundColor: 'rgba(122, 110, 101, 0.12)',
            color: '#5A5048',
            fontSize: 18,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          ←
        </button>
      )}

      {/* Close button */}
      <button
        ref={closeButtonRef}
        onClick={() => { previousFocusRef.current?.focus(); onClose?.(); }}
        aria-label="Close detail panel"
        style={{
          position: 'absolute',
          top: 12,
          right: 12,
          width: 44,
          height: 44,
          border: 'none',
          borderRadius: '50%',
          backgroundColor: 'rgba(122, 110, 101, 0.12)',
          color: '#5A5048',
          fontSize: 18,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'background-color 0.15s ease',
          flexShrink: 0,
        }}
        onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(122, 110, 101, 0.22)'; }}
        onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'rgba(122, 110, 101, 0.12)'; }}
        onFocus={e => { e.currentTarget.style.boxShadow = '0 0 0 3px rgba(122, 110, 101, 0.4)'; }}
        onBlur={e => { e.currentTarget.style.boxShadow = 'none'; }}
      >
        ×
      </button>

      {artist && (
        <>
          {/* Artist image or genre gradient fallback */}
          <div
            style={{
              width: '100%',
              borderRadius: 12,
              marginBottom: 16,
              marginTop: 4,
              overflow: 'hidden',
              position: 'relative',
              ...(artist.image_url && !imageError
                ? { display: 'flex', justifyContent: 'center', backgroundColor: hexToRgba(color, 0.08) }
                : {
                    height: 120,
                    background: `linear-gradient(135deg, ${hexToRgba(color, 0.2)} 0%, ${hexToRgba(color, 0.4)} 50%, ${hexToRgba(color, 0.13)} 100%)`,
                    border: `1px solid ${hexToRgba(color, 0.27)}`,
                    display: 'flex',
                    alignItems: 'flex-end',
                    padding: '10px 12px',
                  }),
            }}
            aria-hidden={!(artist.image_url && !imageError)}
          >
            {artist.image_url && !imageError ? (
              <img
                src={artist.image_url}
                alt={`Portrait of ${artist.name}`}
                loading="lazy"
                onError={() => setImageError(true)}
                style={{
                  display: 'block',
                  maxHeight: 260,
                  width: '100%',
                  objectFit: 'cover',
                  objectPosition: 'center 20%',
                  borderRadius: 12,
                }}
              />
            ) : (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {(artist.genres || []).slice(0, 3).map((g, i) => (
                  <span
                    key={i}
                    style={{
                      fontSize: 11,
                      padding: '2px 8px',
                      borderRadius: 20,
                      backgroundColor: 'rgba(250, 243, 235, 0.85)',
                      color: '#3E3530',
                      fontWeight: 500,
                    }}
                  >
                    {g}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Name */}
          <h2
            style={{
              fontFamily: '"Instrument Serif", serif',
              fontSize: 22,
              fontWeight: 400,
              color: '#3E3530',
              margin: '0 0 6px 0',
              lineHeight: 1.2,
              paddingRight: 36,
            }}
          >
            {artist.name}
          </h2>

          {/* Genre + location */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 13,
              color: '#6B5F55',
              marginBottom: 8,
              flexWrap: 'wrap',
            }}
          >
            <GenreDot color={color} />
            <span>{bucket}</span>
            {location && (
              <>
                <span style={{ color: '#5A5048' }} aria-hidden="true">·</span>
                <span>{location}</span>
              </>
            )}
          </div>

          {/* Lifespan */}
          {lifespan && (
            <div
              style={{
                fontSize: 13,
                color: '#6B5F55',
                marginBottom: 14,
              }}
            >
              {lifespan}
            </div>
          )}

          <hr style={{ border: 'none', borderTop: '1px solid rgba(224, 216, 204, 0.7)', margin: '0 0 14px 0' }} />

          {/* Occupations */}
          {artist.occupations && artist.occupations.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: '#6B5F55',
                  marginBottom: 8,
                }}
              >
                Occupations
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {artist.occupations.map((occ, i) => (
                  <span
                    key={i}
                    style={{
                      fontSize: 12,
                      padding: '3px 10px',
                      borderRadius: 20,
                      border: `1px solid ${hexToRgba(color, 0.33)}`,
                      color: '#5A4F47',
                      backgroundColor: hexToRgba(color, 0.05),
                    }}
                  >
                    {occ}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Education */}
          {artist.education && artist.education.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: '#6B5F55',
                  marginBottom: 8,
                }}
              >
                Education
              </div>
              <ul
                style={{
                  margin: 0,
                  padding: '0 0 0 16px',
                  fontSize: 12,
                  color: '#5A4F47',
                  lineHeight: 1.7,
                }}
              >
                {artist.education.map((edu, i) => (
                  <li key={i}>{edu}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Connections */}
          {connections && connections.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <hr style={{ border: 'none', borderTop: '1px solid rgba(224, 216, 204, 0.7)', margin: '0 0 14px 0' }} />
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: '#6B5F55',
                  marginBottom: 10,
                }}
              >
                Connections ({connections.length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {connections.map((conn, i) => {
                  const connectedId =
                    conn.source_id === artist.id ? conn.target_id : conn.source_id;
                  const connectedName =
                    conn.source_id === artist.id ? conn.target_name : conn.source_name;
                  const connectedArtist = artistMap.get(connectedId);
                  const { color: connColor } = connectedArtist
                    ? getGenreBucket(connectedArtist.genres)
                    : { color: '#E8A99B' };

                  return (
                    <div
                      key={i}
                      style={{
                        backgroundColor: 'rgba(255, 255, 255, 0.5)',
                        borderRadius: 8,
                        padding: '10px 12px',
                        border: '1px solid rgba(224, 216, 204, 0.5)',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          marginBottom: 4,
                          flexWrap: 'wrap',
                        }}
                      >
                        <GenreDot color={connColor} size={7} />
                        <button
                          onClick={() => handleConnectedArtistClick(connectedArtist)}
                          style={{
                            background: 'none',
                            border: 'none',
                            padding: '4px 0',
                            minHeight: 44,
                            fontFamily: '"DM Sans", sans-serif',
                            fontSize: 13,
                            fontWeight: 600,
                            color: connectedArtist ? '#3E3530' : '#5A5048',
                            cursor: connectedArtist ? 'pointer' : 'default',
                            textDecoration: connectedArtist ? 'underline' : 'none',
                            textDecorationColor: hexToRgba(connColor, 0.4),
                            textUnderlineOffset: 2,
                          }}
                          disabled={!connectedArtist}
                          aria-label={`View ${connectedName}`}
                          onFocus={e => { e.currentTarget.style.outline = '2px solid #5A5048'; e.currentTarget.style.outlineOffset = '2px'; }}
                          onBlur={e => { e.currentTarget.style.outline = 'none'; }}
                        >
                          {connectedName}
                        </button>
                        <ConnectionTypeLabel type={conn.type} />
                        {conn.source_pipeline && (
                          <PipelineBadge pipeline={conn.source_pipeline} />
                        )}
                      </div>
                      {conn.evidence && (
                        <p
                          style={{
                            margin: '4px 0 4px 0',
                            fontSize: 11,
                            fontStyle: 'italic',
                            color: '#5A4F47',
                            lineHeight: 1.5,
                          }}
                        >
                          {conn.evidence}
                        </p>
                      )}
                      {conn.confidence != null && (
                        <ConfidenceBar confidence={conn.confidence} />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Wikipedia link */}
          {artist.wikipedia_url && (
            <>
              <hr style={{ border: 'none', borderTop: '1px solid rgba(224, 216, 204, 0.7)', margin: '0 0 14px 0' }} />
              <a
                href={artist.wikipedia_url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  fontSize: 14,
                  fontWeight: 600,
                  color: '#3E3530',
                  textDecoration: 'none',
                  padding: '10px 16px',
                  borderRadius: 8,
                  border: '1px solid rgba(224, 216, 204, 0.8)',
                  backgroundColor: 'rgba(255, 255, 255, 0.6)',
                  transition: 'background-color 0.15s ease, box-shadow 0.15s ease',
                  minHeight: 44,
                }}
                onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.85)'; e.currentTarget.style.boxShadow = '0 1px 4px rgba(90, 80, 72, 0.1)'; }}
                onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.6)'; e.currentTarget.style.boxShadow = 'none'; }}
                onFocus={e => { e.currentTarget.style.outline = '2px solid #5A5048'; e.currentTarget.style.outlineOffset = '2px'; }}
                onBlur={e => { e.currentTarget.style.outline = 'none'; }}
                aria-label={`Wikipedia article for ${artist.name} (opens in new tab)`}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M12.09 13.119c-.14 1.064-.496 2.4-1.063 3.783-.57 1.383-1.237 2.586-1.998 3.557-.762.97-1.478 1.456-2.14 1.456-.486 0-.9-.222-1.238-.669-.34-.446-.508-.959-.508-1.54 0-.376.06-.763.178-1.157l3.486-10.203c.108-.32.162-.62.162-.9 0-.533-.168-.933-.505-1.2-.337-.27-.91-.4-1.72-.4v-.64h5.962v.64c-.924 0-1.555.14-1.892.427-.337.285-.505.735-.505 1.35 0 .243.04.5.118.765l2.072 6.865 2.453-7.063c.087-.255.13-.5.13-.735 0-.588-.2-1.02-.6-1.296-.4-.275-.99-.413-1.77-.413v-.64h4.634v.64c-.67 0-1.2.22-1.593.66-.393.44-.73 1.12-1.012 2.04L12.09 13.12z" />
                </svg>
                Read on Wikipedia
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" style={{ opacity: 0.6 }}>
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                  <polyline points="15 3 21 3 21 9" />
                  <line x1="10" y1="14" x2="21" y2="3" />
                </svg>
              </a>
            </>
          )}
        </>
      )}
    </aside>
  );
}
