import React, { useCallback, useEffect } from 'react';
import { getGenreBucket } from '../utils/genres.js';

const PANEL_WIDTH = 320;

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
          backgroundColor: '#A89080',
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
    teacher: { bg: '#F3E8FF', color: '#7C3AED', label: 'Teacher' },
    influence: { bg: '#FEF3C7', color: '#D97706', label: 'Influence' },
    peer: { bg: '#D1FAE5', color: '#059669', label: 'Peer' },
    collaboration: { bg: '#DBEAFE', color: '#2563EB', label: 'Collab' },
  };
  const s = styles[type] || { bg: '#F3F4F6', color: '#6B7280', label: type };
  return (
    <span
      style={{
        fontSize: 10,
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
        fontSize: 9,
        fontWeight: 500,
        padding: '1px 5px',
        borderRadius: 3,
        backgroundColor: isCurated ? '#ECFDF5' : '#F9FAFB',
        color: isCurated ? '#065F46' : '#9CA3AF',
        border: `1px solid ${isCurated ? '#A7F3D0' : '#E5E7EB'}`,
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

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  const handleConnectedArtistClick = useCallback((connArtist) => {
    if (!connArtist) return;
    onSelect?.(connArtist);
    if (mapRef?.current && connArtist.birth_lng != null && connArtist.birth_lat != null) {
      try {
        mapRef.current.getMap().flyTo({
          center: [connArtist.birth_lng, connArtist.birth_lat],
          zoom: 6,
        });
      } catch (_) {}
    }
  }, [onSelect, mapRef]);

  // Build a fast lookup for allArtists
  const artistMap = React.useMemo(() => {
    const m = new Map();
    for (const a of (allArtists || [])) {
      m.set(a.name, a);
    }
    return m;
  }, [allArtists]);

  const { bucket, color } = artist ? getGenreBucket(artist.genres) : { bucket: 'Other', color: '#F9A825' };

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

  // Panel style changes based on mobile
  const panelStyle = isMobile
    ? {
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        width: '100%',
        height: '60vh',
        backgroundColor: 'rgba(250, 243, 235, 0.98)',
        backdropFilter: 'blur(12px)',
        borderTop: '1px solid rgba(224, 216, 204, 0.8)',
        boxShadow: '0 -4px 24px rgba(90, 80, 72, 0.12)',
        zIndex: 30,
        overflowY: 'auto',
        transform: isOpen ? 'translateY(0)' : 'translateY(100%)',
        transition: 'transform 0.3s ease',
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
        transition: 'transform 0.3s ease',
        padding: '24px',
        fontFamily: '"DM Sans", sans-serif',
      };

  return (
    <aside
      style={panelStyle}
      role="complementary"
      aria-label={artist ? `Details for ${artist.name}` : 'Artist details'}
      aria-hidden={!isOpen}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        aria-label="Close detail panel"
        style={{
          position: 'absolute',
          top: 16,
          right: 16,
          width: 32,
          height: 32,
          border: 'none',
          borderRadius: '50%',
          backgroundColor: 'rgba(122, 110, 101, 0.12)',
          color: '#7A6E65',
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
      >
        ×
      </button>

      {artist && (
        <>
          {/* Genre gradient placeholder */}
          <div
            style={{
              width: '100%',
              height: 120,
              borderRadius: 12,
              background: `linear-gradient(135deg, ${color}33 0%, ${color}66 50%, ${color}22 100%)`,
              border: `1px solid ${color}44`,
              marginBottom: 16,
              marginTop: 4,
              display: 'flex',
              alignItems: 'flex-end',
              padding: '10px 12px',
            }}
            aria-hidden="true"
          >
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {(artist.genres || []).slice(0, 3).map((g, i) => (
                <span
                  key={i}
                  style={{
                    fontSize: 11,
                    padding: '2px 8px',
                    borderRadius: 20,
                    backgroundColor: `${color}33`,
                    color: color,
                    border: `1px solid ${color}66`,
                    fontWeight: 500,
                  }}
                >
                  {g}
                </span>
              ))}
            </div>
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
              color: '#7A6E65',
              marginBottom: 8,
              flexWrap: 'wrap',
            }}
          >
            <GenreDot color={color} />
            <span>{bucket}</span>
            {location && (
              <>
                <span style={{ color: '#C4B8AE' }}>·</span>
                <span>{location}</span>
              </>
            )}
          </div>

          {/* Lifespan */}
          {lifespan && (
            <div
              style={{
                fontSize: 13,
                color: '#9A8E85',
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
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: '#A89080',
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
                      border: `1px solid ${color}55`,
                      color: '#5A4F47',
                      backgroundColor: `${color}0D`,
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
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: '#A89080',
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
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: '#A89080',
                  marginBottom: 10,
                }}
              >
                Connections ({connections.length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {connections.map((conn, i) => {
                  const connectedName =
                    conn.source_name === artist.name ? conn.target_name : conn.source_name;
                  const connectedArtist = artistMap.get(connectedName);
                  const { color: connColor } = connectedArtist
                    ? getGenreBucket(connectedArtist.genres)
                    : { color: '#F9A825' };

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
                            padding: 0,
                            fontFamily: '"DM Sans", sans-serif',
                            fontSize: 13,
                            fontWeight: 600,
                            color: connectedArtist ? '#3E3530' : '#9A8E85',
                            cursor: connectedArtist ? 'pointer' : 'default',
                            textDecoration: connectedArtist ? 'underline' : 'none',
                            textDecorationColor: `${connColor}66`,
                            textUnderlineOffset: 2,
                          }}
                          disabled={!connectedArtist}
                          aria-label={`View ${connectedName}`}
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
                            color: '#7A6E65',
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
                  gap: 6,
                  fontSize: 13,
                  color: '#7A6E65',
                  textDecoration: 'none',
                  padding: '8px 12px',
                  borderRadius: 8,
                  border: '1px solid rgba(224, 216, 204, 0.6)',
                  backgroundColor: 'rgba(255, 255, 255, 0.4)',
                  transition: 'background-color 0.15s ease',
                }}
                onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.7)'; }}
                onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.4)'; }}
                aria-label={`Wikipedia article for ${artist.name} (opens in new tab)`}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                  <polyline points="15 3 21 3 21 9" />
                  <line x1="10" y1="14" x2="21" y2="3" />
                </svg>
                Wikipedia
              </a>
            </>
          )}
        </>
      )}
    </aside>
  );
}
