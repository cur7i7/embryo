import React, { useEffect, useMemo, useRef, useState } from 'react';
import { getGenreBucket } from '../utils/genres.js';

function getPeriod(artist) {
  if (!artist) return { start: null, end: null };
  const start = artist.active_start ?? artist.birth_year ?? null;
  const end = artist.active_end ?? artist.death_year ?? 2025;
  return { start, end };
}

function getConnectionStats(artist, connectionsByArtist) {
  const stats = { total: 0, teacher: 0, influence: 0, peer: 0, collaboration: 0 };
  if (!artist) return stats;
  const list = connectionsByArtist.get(artist.id) || [];
  stats.total = list.length;
  for (const conn of list) {
    if (stats[conn.type] !== undefined) stats[conn.type] += 1;
  }
  return stats;
}

function getConnectedIds(artist, connectionsByArtist) {
  if (!artist) return new Set();
  const list = connectionsByArtist.get(artist.id) || [];
  const out = new Set();
  for (const conn of list) {
    const otherId = conn.source_id === artist.id ? conn.target_id : conn.source_id;
    if (otherId && otherId !== artist.id) out.add(otherId);
  }
  return out;
}

function normalizeGenreSet(artist) {
  const set = new Set();
  for (const g of artist?.genres || []) set.add(String(g).trim().toLowerCase());
  return set;
}

function ArtistColumn({ artist, stats, onSelect }) {
  const { color, bucket } = getGenreBucket(artist?.genres);
  const period = getPeriod(artist);
  const location = [artist?.birth_city, artist?.birth_country].filter(Boolean).join(', ');

  return (
    <section
      style={{
        border: '1px solid rgba(224, 216, 204, 0.9)',
        borderRadius: 12,
        backgroundColor: 'rgba(255, 255, 255, 0.62)',
        padding: 14,
        minHeight: 260,
      }}
      aria-label={`Comparison details for ${artist?.name ?? 'artist'}`}
    >
      <h3
        style={{
          margin: 0,
          fontFamily: '"Instrument Serif", serif',
          fontSize: 30,
          lineHeight: 1.1,
          color: '#3E3530',
        }}
      >
        {artist?.name}
      </h3>
      <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span
          aria-hidden="true"
          style={{
            width: 10,
            height: 10,
            borderRadius: '50%',
            backgroundColor: color,
            display: 'inline-block',
          }}
        />
        <span style={{ fontSize: 13, color: '#6B5F55' }}>{bucket}</span>
      </div>

      <div style={{ marginTop: 10, fontSize: 13, color: '#5A4F47', lineHeight: 1.5 }}>
        {period.start != null && (
          <div>
            Active: {period.start}–{period.end}
          </div>
        )}
        {location && <div>Birth: {location}</div>}
      </div>

      <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
        <div style={{ fontSize: 12, color: '#5A5048' }}>Teachers: <strong>{stats.teacher}</strong></div>
        <div style={{ fontSize: 12, color: '#5A5048' }}>Influences: <strong>{stats.influence}</strong></div>
        <div style={{ fontSize: 12, color: '#5A5048' }}>Peers: <strong>{stats.peer}</strong></div>
        <div style={{ fontSize: 12, color: '#5A5048' }}>Collabs: <strong>{stats.collaboration}</strong></div>
      </div>

      {(artist?.genres?.length ?? 0) > 0 && (
        <div style={{ marginTop: 12, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {artist.genres.slice(0, 8).map((genre, idx) => (
            <span
              key={`${genre}-${idx}`}
              style={{
                fontSize: 12,
                color: '#5A4F47',
                backgroundColor: 'rgba(184, 51, 106, 0.08)',
                border: '1px solid rgba(184, 51, 106, 0.22)',
                borderRadius: 999,
                padding: '2px 8px',
              }}
            >
              {genre}
            </span>
          ))}
        </div>
      )}

      <button
        onClick={() => onSelect?.(artist)}
        style={{
          marginTop: 14,
          minHeight: 44,
          borderRadius: 10,
          border: '1px solid rgba(168, 144, 128, 0.45)',
          backgroundColor: 'rgba(250, 243, 235, 0.9)',
          color: '#3E3530',
          fontFamily: '"DM Sans", sans-serif',
          fontWeight: 600,
          fontSize: 13,
          padding: '10px 12px',
          cursor: 'pointer',
        }}
      >
        Focus On Map
      </button>
    </section>
  );
}

function ComparisonView({
  isOpen,
  artists,
  allArtists,
  connectionsByArtist,
  onClose,
  onSelectArtist,
  isMobile = false,
}) {
  const [activeMobileTab, setActiveMobileTab] = useState('left');
  const modalRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    const prev = document.activeElement;
    const modal = modalRef.current;
    if (!modal) return;
    const focusable = modal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    if (focusable.length) focusable[0].focus();
    const onKey = (e) => {
      if (e.key === 'Escape') { onClose?.(); return; }
      if (e.key !== 'Tab' || !focusable.length) return;
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    modal.addEventListener('keydown', onKey);
    return () => { modal.removeEventListener('keydown', onKey); prev?.focus?.(); };
  }, [isOpen, onClose]);

  const [leftArtist, rightArtist] = artists || [];

  const allArtistsById = useMemo(() => {
    const map = new Map();
    for (const artist of allArtists || []) map.set(artist.id, artist);
    return map;
  }, [allArtists]);

  const leftStats = useMemo(
    () => getConnectionStats(leftArtist, connectionsByArtist),
    [leftArtist, connectionsByArtist]
  );
  const rightStats = useMemo(
    () => getConnectionStats(rightArtist, connectionsByArtist),
    [rightArtist, connectionsByArtist]
  );

  const sharedGenres = useMemo(() => {
    const left = normalizeGenreSet(leftArtist);
    const right = normalizeGenreSet(rightArtist);
    const out = [];
    for (const genre of left) if (right.has(genre)) out.push(genre);
    return out.slice(0, 8);
  }, [leftArtist, rightArtist]);

  const overlapYears = useMemo(() => {
    const l = getPeriod(leftArtist);
    const r = getPeriod(rightArtist);
    if (l.start == null || r.start == null) return null;
    const start = Math.max(l.start, r.start);
    const end = Math.min(l.end, r.end);
    if (start > end) return null;
    return { start, end, duration: end - start + 1 };
  }, [leftArtist, rightArtist]);

  const sharedConnectionArtists = useMemo(() => {
    if (!leftArtist || !rightArtist) return [];
    const leftIds = getConnectedIds(leftArtist, connectionsByArtist);
    const rightIds = getConnectedIds(rightArtist, connectionsByArtist);
    const shared = [];
    for (const id of leftIds) {
      if (rightIds.has(id)) {
        const artist = allArtistsById.get(id);
        if (artist) shared.push(artist);
      }
    }
    return shared.slice(0, 12);
  }, [allArtistsById, connectionsByArtist, leftArtist, rightArtist]);

  if (!isOpen || !leftArtist || !rightArtist) return null;

  return (
    <div
      ref={modalRef}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1100,
        backgroundColor: 'rgba(44, 36, 32, 0.55)',
        backdropFilter: 'blur(5px)',
        display: 'flex',
        alignItems: isMobile ? 'stretch' : 'center',
        justifyContent: 'center',
        padding: isMobile ? 0 : 16,
      }}
      role="dialog"
      aria-modal="true"
      aria-label={`Comparison view for ${leftArtist.name} and ${rightArtist.name}`}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 1220,
          maxHeight: isMobile ? '100dvh' : '92dvh',
          borderRadius: isMobile ? 0 : 14,
          border: '1px solid rgba(224, 216, 204, 0.85)',
          backgroundColor: '#FAF3EB',
          boxShadow: '0 20px 60px rgba(44, 36, 32, 0.28)',
          overflow: 'auto',
          padding: isMobile
            ? 'calc(env(safe-area-inset-top) + 12px) 12px calc(env(safe-area-inset-bottom) + 16px)'
            : 18,
          fontFamily: '"DM Sans", sans-serif',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 12 }}>
          <h2
            style={{
              margin: 0,
              fontFamily: '"Instrument Serif", serif',
              fontSize: isMobile ? 28 : 36,
              lineHeight: 1.1,
              color: '#3E3530',
            }}
          >
            Artist Comparison
          </h2>
          <button
            onClick={onClose}
            aria-label="Close comparison view"
            style={{
              minWidth: 44,
              minHeight: 44,
              borderRadius: 999,
              border: '1px solid rgba(168, 144, 128, 0.45)',
              backgroundColor: 'rgba(255, 255, 255, 0.75)',
              color: '#3E3530',
              fontSize: 20,
              cursor: 'pointer',
            }}
          >
            ×
          </button>
        </div>

        <div
          style={{
            border: '1px solid rgba(224, 216, 204, 0.9)',
            borderRadius: 12,
            backgroundColor: 'rgba(255, 255, 255, 0.55)',
            padding: '10px 12px',
            marginBottom: 12,
            display: 'flex',
            flexWrap: 'wrap',
            gap: 8,
            alignItems: 'center',
          }}
        >
          <span style={{ fontSize: 13, color: '#5A4F47' }}>
            Shared genres: <strong>{sharedGenres.length || 0}</strong>
          </span>
          {overlapYears ? (
            <span style={{ fontSize: 13, color: '#5A4F47' }}>
              Timeline overlap: <strong>{overlapYears.start}–{overlapYears.end}</strong> ({overlapYears.duration}y)
            </span>
          ) : (
            <span style={{ fontSize: 13, color: '#5A4F47' }}>No timeline overlap</span>
          )}
          <span style={{ fontSize: 13, color: '#5A4F47' }}>
            Shared direct connections: <strong>{sharedConnectionArtists.length}</strong>
          </span>
        </div>

        {isMobile && (
          <div role="tablist" aria-label="Comparison panels" style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <button
              role="tab"
              aria-selected={activeMobileTab === 'left'}
              onClick={() => setActiveMobileTab('left')}
              style={{
                flex: 1,
                minHeight: 44,
                borderRadius: 10,
                border: '1px solid rgba(168, 144, 128, 0.45)',
                backgroundColor: activeMobileTab === 'left' ? 'rgba(184, 51, 106, 0.16)' : 'rgba(255, 255, 255, 0.8)',
                color: '#3E3530',
                fontSize: 13,
                fontWeight: 600,
                fontFamily: '"DM Sans", sans-serif',
                cursor: 'pointer',
              }}
            >
              {leftArtist.name}
            </button>
            <button
              role="tab"
              aria-selected={activeMobileTab === 'right'}
              onClick={() => setActiveMobileTab('right')}
              style={{
                flex: 1,
                minHeight: 44,
                borderRadius: 10,
                border: '1px solid rgba(168, 144, 128, 0.45)',
                backgroundColor: activeMobileTab === 'right' ? 'rgba(184, 51, 106, 0.16)' : 'rgba(255, 255, 255, 0.8)',
                color: '#3E3530',
                fontSize: 13,
                fontWeight: 600,
                fontFamily: '"DM Sans", sans-serif',
                cursor: 'pointer',
              }}
            >
              {rightArtist.name}
            </button>
          </div>
        )}

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : 'minmax(0, 1fr) minmax(0, 1fr)',
            gap: 12,
          }}
        >
          {(!isMobile || activeMobileTab === 'left') && (
            <ArtistColumn artist={leftArtist} stats={leftStats} onSelect={onSelectArtist} />
          )}
          {(!isMobile || activeMobileTab === 'right') && (
            <ArtistColumn artist={rightArtist} stats={rightStats} onSelect={onSelectArtist} />
          )}
        </div>

        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 700, color: '#6B5F55', marginBottom: 8 }}>
            Shared Connections
          </div>
          {sharedConnectionArtists.length > 0 ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {sharedConnectionArtists.map((artist) => (
                <button
                  key={artist.id}
                  onClick={() => onSelectArtist?.(artist)}
                  style={{
                    minHeight: 44,
                    borderRadius: 999,
                    border: '1px solid rgba(168, 144, 128, 0.45)',
                    backgroundColor: 'rgba(255, 255, 255, 0.8)',
                    color: '#3E3530',
                    fontSize: 12,
                    fontWeight: 600,
                    fontFamily: '"DM Sans", sans-serif',
                    padding: '8px 10px',
                    cursor: 'pointer',
                  }}
                >
                  {artist.name}
                </button>
              ))}
            </div>
          ) : (
            <p style={{ margin: 0, fontSize: 13, color: '#5A4F47', fontStyle: 'italic' }}>
              No shared direct connections found.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default React.memo(ComparisonView);
