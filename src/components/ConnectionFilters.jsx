import React, { useState } from 'react';
import { useIsPointerFine } from '../hooks/useIsPointerFine.js';

const CONNECTION_TYPES = [
  { key: 'teacher', label: 'Teacher' },
  { key: 'influence', label: 'Influence' },
  { key: 'peer', label: 'Peer' },
  { key: 'collaboration', label: 'Collab' },
];

const ACCENT = '#5A5048';

function ConnectionFilters({ activeConnectionTypes, onToggleType, onSelectAll, typeCounts, isMobile = false }) {
  const allActive = activeConnectionTypes.size === CONNECTION_TYPES.length;
  const isPointerFine = useIsPointerFine();
  const [announcement, setAnnouncement] = useState('');

  const handleToggleType = (key) => {
    onToggleType(key);
    const label = CONNECTION_TYPES.find(t => t.key === key)?.label ?? key;
    const isCurrentlyActive = activeConnectionTypes.has(key);
    setAnnouncement(`${label} connections ${isCurrentlyActive ? 'removed' : 'added'}`);
  };

  const handleSelectAll = () => {
    onSelectAll();
    setAnnouncement('All connection types selected');
  };

  return (
    <>
    <div style={{
      position: 'fixed',
      bottom: isMobile ? `calc(clamp(44px, 6vw, 52px) + 56px + env(safe-area-inset-bottom))` : `calc(clamp(44px, 6vw, 52px) + 20px + env(safe-area-inset-bottom))`,
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
        borderRadius: isMobile ? '0' : '12px',
        border: '1px solid rgba(224, 216, 204, 0.5)',
        boxShadow: '0 1px 6px rgba(90, 80, 72, 0.06)',
        overflowX: isMobile ? 'auto' : 'visible',
        WebkitOverflowScrolling: 'touch',
        scrollbarWidth: 'thin',
      }}
    >
      {/* All button */}
      <button
        onClick={handleSelectAll}
        aria-pressed={allActive}
        title="Show all connection types"
        style={{
          fontFamily: '"DM Sans", sans-serif',
          fontSize: isPointerFine ? 12 : 'clamp(11px, 1.4vw, 12px)',
          fontWeight: 600,
          lineHeight: 1.2,
          letterSpacing: '0.03em',
          color: allActive ? '#FAF3EB' : '#6B5F55',
          backgroundColor: allActive ? ACCENT : 'transparent',
          border: allActive ? `1px solid ${ACCENT}` : '1px solid rgba(90,80,72,0.15)',
          borderRadius: isPointerFine ? 999 : '8px',
          padding: isPointerFine ? '3px 8px' : (isMobile ? '6px 10px' : '4px 8px'),
          minHeight: 44,
          cursor: 'pointer',
          transition: 'all 0.15s ease',
          outline: '2px solid transparent',
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
            onClick={() => handleToggleType(key)}
            aria-pressed={isActive}
            title={`${label} connections (${count.toLocaleString()})`}
            style={{
              fontFamily: '"DM Sans", sans-serif',
              fontSize: isPointerFine ? 12 : 'clamp(11px, 1.4vw, 12px)',
              fontWeight: isActive ? 600 : 400,
              lineHeight: 1.2,
              letterSpacing: '0.02em',
              color: isActive ? ACCENT : '#4A3F37',
              backgroundColor: isActive ? 'rgba(90,80,72,0.08)' : 'transparent',
              border: isActive ? `1.5px solid ${ACCENT}` : '1px solid rgba(90,80,72,0.12)',
              borderRadius: isPointerFine ? 999 : '8px',
              padding: isPointerFine ? '3px 8px' : (isMobile ? '6px 9px' : '4px 7px'),
              minHeight: 44,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              outline: '2px solid transparent',
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
                e.currentTarget.style.color = '#4A3F37';
              }
            }}
            onFocus={(e) => { if (e.currentTarget.matches(':focus-visible')) e.currentTarget.style.boxShadow = '0 0 0 2px rgba(90,80,72,0.4)'; }}
            onBlur={(e) => { e.currentTarget.style.boxShadow = 'none'; }}
          >
            {isActive && <span aria-hidden="true" style={{ marginRight: 2, color: ACCENT }}>●</span>}
            {label}
            {count > 0 && (
              <span
                aria-hidden="true"
                style={{
                  fontSize: 'clamp(11px, 1.2vw, 12px)',
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

export default React.memo(ConnectionFilters);
