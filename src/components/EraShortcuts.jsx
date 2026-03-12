import React from 'react';

const ERAS = [
  { label: 'Baroque', start: 1600, end: 1750 },
  { label: 'Classical', start: 1750, end: 1820 },
  { label: 'Romantic', start: 1820, end: 1910 },
  { label: 'Jazz Age', start: 1920, end: 1950 },
  { label: 'Rock Era', start: 1950, end: 1980 },
  { label: 'All', start: 1400, end: 2025 },
];

export default function EraShortcuts({ rangeStart, rangeEnd, onRangeChange }) {
  return (
    <div
      style={{
        position: 'fixed',
        bottom: '88px', // just above the timeline (80px) + 8px gap
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 20,
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '6px 10px',
        backgroundColor: 'rgba(250, 243, 235, 0.90)',
        backdropFilter: 'blur(6px)',
        borderRadius: '24px',
        border: '1px solid rgba(224, 216, 204, 0.7)',
        boxShadow: '0 2px 10px rgba(90, 80, 72, 0.10)',
      }}
    >
      {ERAS.map(({ label, start, end }) => {
        const isActive = start === rangeStart && end === rangeEnd;
        return (
          <button
            key={label}
            onClick={() => onRangeChange(start, end)}
            aria-pressed={isActive}
            style={{
              fontFamily: '"DM Sans", sans-serif',
              fontSize: '12px',
              fontWeight: isActive ? 600 : 400,
              lineHeight: 1,
              color: isActive ? '#FAF3EB' : '#5A5048',
              backgroundColor: isActive ? '#C2185B' : 'transparent',
              border: isActive ? '1px solid #C2185B' : '1px solid rgba(90,80,72,0.25)',
              borderRadius: '14px',
              padding: '5px 12px',
              cursor: 'pointer',
              transition: 'background-color 0.15s, color 0.15s, border-color 0.15s',
              outline: 'none',
              whiteSpace: 'nowrap',
            }}
            onMouseEnter={(e) => {
              if (!isActive) {
                e.currentTarget.style.backgroundColor = 'rgba(194,24,91,0.08)';
                e.currentTarget.style.borderColor = 'rgba(194,24,91,0.4)';
                e.currentTarget.style.color = '#C2185B';
              }
            }}
            onMouseLeave={(e) => {
              if (!isActive) {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.borderColor = 'rgba(90,80,72,0.25)';
                e.currentTarget.style.color = '#5A5048';
              }
            }}
            onFocus={(e) => e.currentTarget.style.boxShadow = '0 0 0 3px rgba(194,24,91,0.25)'}
            onBlur={(e) => e.currentTarget.style.boxShadow = 'none'}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
