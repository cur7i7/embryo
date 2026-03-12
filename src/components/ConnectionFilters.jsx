import React from 'react';

const CONNECTION_TYPES = [
  { key: 'teacher', label: 'Teacher' },
  { key: 'influence', label: 'Influence' },
  { key: 'peer', label: 'Peer' },
  { key: 'collaboration', label: 'Collaboration' },
];

// Subtle accent color for active state — warm brown/teal to stay distinct from genre filters
const ACTIVE_BG = '#5A5048';
const ACTIVE_TEXT = '#FAF3EB';
const INACTIVE_TEXT = '#7A6E65';

export default function ConnectionFilters({ activeConnectionTypes, onToggleType, onSelectAll, typeCounts }) {
  const allActive = activeConnectionTypes.size === CONNECTION_TYPES.length;

  return (
    <div
      role="group"
      aria-label="Filter connections by type"
      style={{
        position: 'fixed',
        bottom: '88px',
        left: '16px',
        zIndex: 20,
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        padding: '4px 8px',
        backgroundColor: 'rgba(250, 243, 235, 0.88)',
        backdropFilter: 'blur(6px)',
        borderRadius: '20px',
        border: '1px solid rgba(224, 216, 204, 0.6)',
        boxShadow: '0 1px 6px rgba(90, 80, 72, 0.08)',
      }}
    >
      {/* All button */}
      <button
        onClick={onSelectAll}
        aria-pressed={allActive}
        title="Show all connection types"
        style={{
          fontFamily: '"DM Sans", sans-serif',
          fontSize: '11px',
          fontWeight: allActive ? 600 : 400,
          lineHeight: 1,
          color: allActive ? ACTIVE_TEXT : INACTIVE_TEXT,
          backgroundColor: allActive ? ACTIVE_BG : 'transparent',
          border: allActive ? `1px solid ${ACTIVE_BG}` : '1px solid rgba(90,80,72,0.20)',
          borderRadius: '12px',
          padding: '4px 9px',
          cursor: 'pointer',
          transition: 'background-color 0.15s, color 0.15s, border-color 0.15s',
          outline: 'none',
          whiteSpace: 'nowrap',
        }}
        onMouseEnter={(e) => {
          if (!allActive) {
            e.currentTarget.style.backgroundColor = 'rgba(90,80,72,0.08)';
            e.currentTarget.style.borderColor = 'rgba(90,80,72,0.40)';
            e.currentTarget.style.color = '#5A5048';
          }
        }}
        onMouseLeave={(e) => {
          if (!allActive) {
            e.currentTarget.style.backgroundColor = 'transparent';
            e.currentTarget.style.borderColor = 'rgba(90,80,72,0.20)';
            e.currentTarget.style.color = INACTIVE_TEXT;
          }
        }}
        onFocus={(e) => { e.currentTarget.style.boxShadow = '0 0 0 3px rgba(90,80,72,0.22)'; }}
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
              fontSize: '11px',
              fontWeight: isActive ? 600 : 400,
              lineHeight: 1,
              color: isActive ? ACTIVE_TEXT : INACTIVE_TEXT,
              backgroundColor: isActive ? ACTIVE_BG : 'transparent',
              border: isActive ? `1px solid ${ACTIVE_BG}` : '1px solid rgba(90,80,72,0.20)',
              borderRadius: '12px',
              padding: '4px 9px',
              cursor: 'pointer',
              transition: 'background-color 0.15s, color 0.15s, border-color 0.15s',
              outline: 'none',
              whiteSpace: 'nowrap',
            }}
            onMouseEnter={(e) => {
              if (!isActive) {
                e.currentTarget.style.backgroundColor = 'rgba(90,80,72,0.08)';
                e.currentTarget.style.borderColor = 'rgba(90,80,72,0.40)';
                e.currentTarget.style.color = '#5A5048';
              }
            }}
            onMouseLeave={(e) => {
              if (!isActive) {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.borderColor = 'rgba(90,80,72,0.20)';
                e.currentTarget.style.color = INACTIVE_TEXT;
              }
            }}
            onFocus={(e) => { e.currentTarget.style.boxShadow = '0 0 0 3px rgba(90,80,72,0.22)'; }}
            onBlur={(e) => { e.currentTarget.style.boxShadow = 'none'; }}
          >
            {label}
            {count > 0 && (
              <span
                aria-hidden="true"
                style={{
                  marginLeft: '4px',
                  fontSize: '10px',
                  opacity: isActive ? 0.75 : 0.55,
                  fontWeight: 400,
                }}
              >
                ({count.toLocaleString()})
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
