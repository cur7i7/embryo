import React, { useState, useCallback } from 'react';
import { GENRE_BUCKETS } from '../utils/genres.js';
import { useIsPointerFine } from '../hooks/useIsPointerFine.js';

const BUCKET_NAMES = Object.keys(GENRE_BUCKETS);

const CONNECTION_TYPES = [
  { key: 'teacher', label: 'Teacher' },
  { key: 'influence', label: 'Influence' },
  { key: 'peer', label: 'Peer' },
  { key: 'collaboration', label: 'Collab' },
];

const STORAGE_KEY = 'embryo-filter-panel-collapsed';

function getInitialCollapsed() {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

const ROW_STYLE = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  width: '100%',
  padding: '2px 0',
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  fontFamily: '"DM Sans", sans-serif',
  fontSize: 12,
  fontWeight: 500,
  color: '#3E3530',
  lineHeight: 1.3,
  textAlign: 'left',
  outline: '2px solid transparent',
  borderRadius: 4,
  transition: 'opacity 0.15s ease',
};

function FilterPanel({
  activeGenres,
  onToggleGenre,
  onSelectAllGenres,
  activeConnectionTypes,
  onToggleConnectionType,
  onSelectAllConnectionTypes,
  typeCounts,
  isMobile = false,
}) {
  const [collapsed, setCollapsed] = useState(() => isMobile || getInitialCollapsed());
  const isPointerFine = useIsPointerFine();
  const [announcement, setAnnouncement] = useState('');

  const allGenresActive = activeGenres.size === BUCKET_NAMES.length;
  const allConnectionsActive = activeConnectionTypes.size === CONNECTION_TYPES.length;

  const toggleCollapsed = useCallback(() => {
    setCollapsed(prev => {
      const next = !prev;
      try { localStorage.setItem(STORAGE_KEY, String(next)); } catch { /* noop */ }
      return next;
    });
  }, []);

  const handleToggleGenre = (name) => {
    onToggleGenre(name);
    const isCurrentlyActive = activeGenres.has(name);
    setAnnouncement(`${name} ${isCurrentlyActive ? 'removed' : 'added'}`);
  };

  const handleSelectAllGenres = () => {
    onSelectAllGenres();
    setAnnouncement('All genres selected');
  };

  const handleToggleConnectionType = (key) => {
    onToggleConnectionType(key);
    const label = CONNECTION_TYPES.find(t => t.key === key)?.label ?? key;
    const isCurrentlyActive = activeConnectionTypes.has(key);
    setAnnouncement(`${label} connections ${isCurrentlyActive ? 'removed' : 'added'}`);
  };

  const handleSelectAllConnections = () => {
    onSelectAllConnectionTypes();
    setAnnouncement('All connection types selected');
  };

  const sectionHeadingStyle = {
    fontSize: 11,
    fontWeight: 600,
    color: '#6B5E56',
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    margin: 0,
    padding: '4px 0 2px',
  };

  return (
    <>
    <div
      style={{
        position: 'fixed',
        top: 'calc(140px + env(safe-area-inset-top))',
        left: 'calc(16px + env(safe-area-inset-left))',
        zIndex: 15,
        fontFamily: '"DM Sans", sans-serif',
        pointerEvents: 'auto',
      }}
    >
      <div
        style={{
          backgroundColor: 'rgba(250, 243, 235, 0.95)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          borderRadius: 12,
          border: '1px solid rgba(224, 216, 204, 0.5)',
          boxShadow: '0 1px 8px rgba(90, 80, 72, 0.08)',
          overflow: 'hidden',
          transition: 'width 0.2s ease, height 0.2s ease',
        }}
      >
        {/* Toggle button */}
        <button
          onClick={toggleCollapsed}
          aria-expanded={!collapsed}
          aria-label={collapsed ? 'Show filters' : 'Hide filters'}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            width: '100%',
            padding: isMobile ? '8px 10px' : '6px 10px',
            minHeight: 44,
            minWidth: 44,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontFamily: '"DM Sans", sans-serif',
            fontSize: 12,
            fontWeight: 600,
            color: '#5A5048',
            letterSpacing: '0.02em',
            textAlign: 'left',
          }}
          onFocus={(e) => {
            if (e.currentTarget.matches(':focus-visible'))
              e.currentTarget.style.boxShadow = '0 0 0 2px rgba(90,80,72,0.4)';
          }}
          onBlur={(e) => {
            e.currentTarget.style.boxShadow = 'none';
          }}
        >
          {collapsed ? (
            <>
              <span aria-hidden="true" style={{ display: 'flex', gap: 2 }}>
                {BUCKET_NAMES.slice(0, 4).map((name) => (
                  <span
                    key={name}
                    style={{
                      display: 'inline-block',
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      backgroundColor: GENRE_BUCKETS[name].color,
                    }}
                  />
                ))}
              </span>
              <span>Filters</span>
              <span aria-hidden="true" style={{ fontSize: 9, marginLeft: 'auto' }}>{'\u25B8'}</span>
            </>
          ) : (
            <>
              <svg aria-hidden="true" width="12" height="12" viewBox="0 0 14 14" fill="currentColor">
                <rect x="1" y="2" width="12" height="1.5" rx="0.75" />
                <rect x="3" y="6" width="8" height="1.5" rx="0.75" />
                <rect x="5" y="10" width="4" height="1.5" rx="0.75" />
              </svg>
              <span>Filters</span>
              <span aria-hidden="true" style={{ fontSize: 9, marginLeft: 'auto' }}>{'\u25BE'}</span>
            </>
          )}
        </button>

        {/* Expanded content */}
        {!collapsed && (
          <div style={{ padding: isMobile ? '0 10px 10px' : '0 10px 8px' }}>
            {/* Genre section */}
            <div role="group" aria-label="Filter by genre">
              <div style={sectionHeadingStyle}>Genre</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? 2 : 0 }}>
                <button
                  onClick={handleSelectAllGenres}
                  aria-pressed={allGenresActive}
                  style={{
                    ...ROW_STYLE,
                    fontWeight: 600,
                    fontSize: 11,
                    color: allGenresActive ? '#3E3530' : '#8A7F77',
                    minHeight: isPointerFine ? 28 : 44,
                  }}
                >
                  <span aria-hidden="true" style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: isMobile ? 24 : 20,
                    height: isMobile ? 24 : 20,
                    flexShrink: 0,
                  }}>
                    {allGenresActive ? '✓' : '○'}
                  </span>
                  All genres
                </button>
                {BUCKET_NAMES.map((name) => {
                  const { color } = GENRE_BUCKETS[name];
                  const isActive = activeGenres.has(name);
                  return (
                    <button
                      key={name}
                      onClick={() => handleToggleGenre(name)}
                      aria-pressed={isActive}
                      style={{
                        ...ROW_STYLE,
                        opacity: isActive ? 1 : 0.45,
                        fontWeight: isActive ? 500 : 400,
                        minHeight: isPointerFine ? 28 : 44,
                      }}
                    >
                      <span
                        aria-hidden="true"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: isMobile ? 24 : 20,
                          height: isMobile ? 24 : 20,
                          fontSize: isMobile ? 16 : 14,
                          lineHeight: 1,
                          color: color,
                          flexShrink: 0,
                          textAlign: 'center',
                          userSelect: 'none',
                        }}
                      >
                        ●
                      </span>
                      <span>{name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Divider */}
            <div style={{
              height: 1,
              backgroundColor: 'rgba(90,80,72,0.1)',
              margin: '6px 0',
            }} />

            {/* Connections section */}
            <div role="group" aria-label="Filter connections by type">
              <div style={sectionHeadingStyle}>Connections</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? 2 : 0 }}>
                <button
                  onClick={handleSelectAllConnections}
                  aria-pressed={allConnectionsActive}
                  style={{
                    ...ROW_STYLE,
                    fontWeight: 600,
                    fontSize: 11,
                    color: allConnectionsActive ? '#3E3530' : '#8A7F77',
                    minHeight: isPointerFine ? 28 : 44,
                  }}
                >
                  <span aria-hidden="true" style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: isMobile ? 24 : 20,
                    height: isMobile ? 24 : 20,
                    flexShrink: 0,
                  }}>
                    {allConnectionsActive ? '✓' : '○'}
                  </span>
                  All connections
                </button>
                {CONNECTION_TYPES.map(({ key, label }) => {
                  const isActive = activeConnectionTypes.has(key);
                  const count = typeCounts?.[key] ?? 0;
                  return (
                    <button
                      key={key}
                      onClick={() => handleToggleConnectionType(key)}
                      aria-pressed={isActive}
                      title={`${label} connections (${count.toLocaleString()})`}
                      style={{
                        ...ROW_STYLE,
                        opacity: isActive ? 1 : 0.45,
                        fontWeight: isActive ? 500 : 400,
                        minHeight: isPointerFine ? 28 : 44,
                      }}
                    >
                      <span
                        aria-hidden="true"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: isMobile ? 24 : 20,
                          height: isMobile ? 24 : 20,
                          fontSize: isMobile ? 16 : 14,
                          lineHeight: 1,
                          color: isActive ? '#5A5048' : '#AEA49A',
                          flexShrink: 0,
                          textAlign: 'center',
                          userSelect: 'none',
                        }}
                      >
                        ●
                      </span>
                      <span>{label}</span>
                      {count > 0 && (
                        <span style={{ fontSize: 10, fontWeight: 400, color: '#8A7F77', marginLeft: 'auto' }}>
                          {count >= 1000 ? `${(count / 1000).toFixed(1)}k` : count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>

    {/* Screen reader announcements */}
    <div
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
      {announcement}
    </div>
    </>
  );
}

export default React.memo(FilterPanel);
