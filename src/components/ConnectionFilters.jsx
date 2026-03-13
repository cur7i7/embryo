import React from 'react';

const CONNECTION_TYPES = [
  { key: 'teacher', label: 'Teacher' },
  { key: 'influence', label: 'Influence' },
  { key: 'peer', label: 'Peer' },
  { key: 'collaboration', label: 'Collab' },
];

const ACCENT = '#5A5048';

export default function ConnectionFilters({ activeConnectionTypes, onToggleType, onSelectAll, typeCounts, isMobile = false }) {
  const allActive = activeConnectionTypes.size === CONNECTION_TYPES.length;

  return (
    <div style={{
      position: 'fixed',
      bottom: isMobile ? `calc(108px + env(safe-area-inset-bottom))` : `calc(72px + env(safe-area-inset-bottom))`,
      left: isMobile ? '0' : '16px',
      right: isMobile ? '0' : 'auto',
      zIndex: 20,
    }}>
    <div
      role="group"
      aria-label="Filter connections by type"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '3px',
        padding: isMobile ? '3px 12px' : '3px 6px',
        backgroundColor: 'rgba(250, 243, 235, 0.88)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        borderRadius: isMobile ? '0' : '10px',
        border: '1px solid rgba(224, 216, 204, 0.5)',
        boxShadow: '0 1px 6px rgba(90, 80, 72, 0.06)',
        overflowX: isMobile ? 'auto' : 'visible',
        WebkitOverflowScrolling: 'touch',
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
      }}
    >
      {/* All button */}
      <button
        onClick={onSelectAll}
        aria-pressed={allActive}
        title="Show all connection types"
        style={{
          fontFamily: '"DM Sans", sans-serif',
          fontSize: 'clamp(10px, 1.4vw, 12px)',
          fontWeight: 600,
          lineHeight: 1,
          letterSpacing: '0.03em',
          textTransform: 'uppercase',
          color: allActive ? '#FAF3EB' : '#6B5F55',
          backgroundColor: allActive ? ACCENT : 'transparent',
          border: allActive ? `1px solid ${ACCENT}` : '1px solid rgba(90,80,72,0.15)',
          borderRadius: '6px',
          padding: isMobile ? '6px 10px' : '4px 8px',
          minHeight: 'clamp(26px, 5vw, 44px)',
          cursor: 'pointer',
          transition: 'all 0.15s ease',
          outline: 'none',
          whiteSpace: 'nowrap',
          display: 'flex',
          alignItems: 'center',
        }}
        onMouseEnter={(e) => {
          if (!allActive) {
            e.currentTarget.style.backgroundColor = 'rgba(90,80,72,0.06)';
            e.currentTarget.style.borderColor = 'rgba(90,80,72,0.3)';
          }
        }}
        onMouseLeave={(e) => {
          if (!allActive) {
            e.currentTarget.style.backgroundColor = 'transparent';
            e.currentTarget.style.borderColor = 'rgba(90,80,72,0.15)';
          }
        }}
        onFocus={(e) => { if (e.currentTarget.matches(':focus-visible')) e.currentTarget.style.boxShadow = '0 0 0 2px rgba(90,80,72,0.4)'; }}
        onBlur={(e) => { e.currentTarget.style.boxShadow = 'none'; }}
      >
        All
      </button>

      {/* Type buttons */}
      {CONNECTION_TYPES.map(({ key, label }) => {
        const isActive = activeConnectionTypes.has(key);
        const count = typeCounts?.[key] ?? 0;

        return (
          <button
            key={key}
            onClick={() => onToggleType(key)}
            aria-pressed={isActive}
            title={`${label} connections (${count.toLocaleString()})`}
            style={{
              fontFamily: '"DM Sans", sans-serif',
              fontSize: 'clamp(10px, 1.4vw, 12px)',
              fontWeight: isActive ? 600 : 400,
              lineHeight: 1,
              letterSpacing: '0.02em',
              color: isActive ? ACCENT : '#5A5048',
              backgroundColor: isActive ? 'rgba(90,80,72,0.08)' : 'transparent',
              border: isActive ? `1.5px solid ${ACCENT}` : '1px solid rgba(90,80,72,0.12)',
              borderRadius: '6px',
              padding: isMobile ? '6px 9px' : '4px 7px',
              minHeight: 'clamp(26px, 5vw, 44px)',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              outline: 'none',
              whiteSpace: 'nowrap',
              display: 'flex',
              alignItems: 'center',
              gap: '3px',
            }}
            onMouseEnter={(e) => {
              if (!isActive) {
                e.currentTarget.style.backgroundColor = 'rgba(90,80,72,0.05)';
                e.currentTarget.style.borderColor = 'rgba(90,80,72,0.3)';
                e.currentTarget.style.color = ACCENT;
              }
            }}
            onMouseLeave={(e) => {
              if (!isActive) {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.borderColor = 'rgba(90,80,72,0.12)';
                e.currentTarget.style.color = '#5A5048';
              }
            }}
            onFocus={(e) => { if (e.currentTarget.matches(':focus-visible')) e.currentTarget.style.boxShadow = '0 0 0 2px rgba(90,80,72,0.4)'; }}
            onBlur={(e) => { e.currentTarget.style.boxShadow = 'none'; }}
          >
            {label}
            {count > 0 && (
              <span
                aria-hidden="true"
                style={{
                  fontSize: 'clamp(9px, 1.2vw, 11px)',
                  fontWeight: 400,
                  color: '#5A5048',
                }}
              >
                {count >= 1000 ? `${(count / 1000).toFixed(1)}k` : count}
              </span>
            )}
          </button>
        );
      })}
    </div>
    {isMobile && (
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          bottom: 0,
          width: 24,
          background: 'linear-gradient(to right, rgba(250,243,235,0), rgba(250,243,235,0.88))',
          pointerEvents: 'none',
        }}
      />
    )}
    </div>
  );
}
