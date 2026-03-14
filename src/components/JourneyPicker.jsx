import React, { useEffect, useRef } from 'react';

const OVERLAY_STYLE = {
  position: 'fixed',
  inset: 0,
  zIndex: 40,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: 'rgba(62, 53, 48, 0.5)',
  backdropFilter: 'blur(4px)',
  fontFamily: '"DM Sans", sans-serif',
};

const PANEL_STYLE = {
  backgroundColor: '#FAF3EB',
  borderRadius: 16,
  padding: 24,
  maxWidth: 480,
  width: 'calc(100vw - 32px)',
  maxHeight: 'calc(100dvh - 64px)',
  overflowY: 'auto',
  boxShadow: '0 8px 32px rgba(62, 53, 48, 0.2)',
};

const CARD_STYLE = {
  padding: '14px 16px',
  borderRadius: 12,
  border: '1px solid rgba(224, 216, 204, 0.7)',
  cursor: 'pointer',
  transition: 'background-color 0.15s ease, border-color 0.15s ease',
  marginBottom: 8,
};

export default function JourneyPicker({ journeys, loading, onSelect, onClose }) {
  const modalRef = useRef(null);

  useEffect(() => {
    if (loading) return;
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
  }, [loading, onClose]);

  if (loading) return null;

  return (
    <div style={OVERLAY_STYLE} onClick={onClose} role="dialog" aria-label="Choose a journey">
      <div ref={modalRef} style={PANEL_STYLE} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: '#3E3530', margin: 0 }}>
            Musical Journeys
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              background: 'none', border: 'none', cursor: 'pointer', padding: 8,
              fontSize: 18, color: '#7A6E65', lineHeight: 1, minWidth: 44, minHeight: 44,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            ✕
          </button>
        </div>
        <p style={{ fontSize: 13, color: '#7A6E65', marginBottom: 16 }}>
          Guided tours through music history. Each journey flies you between connected artists with narration.
        </p>
        {journeys.map(j => (
          <button
            key={j.id}
            onClick={() => onSelect(j.id)}
            style={{
              ...CARD_STYLE,
              display: 'block',
              width: '100%',
              textAlign: 'left',
              background: 'none',
              fontFamily: 'inherit',
            }}
            onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(224, 216, 204, 0.3)'; }}
            onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <div style={{
                width: 10, height: 10, borderRadius: '50%',
                backgroundColor: j.coverColor || '#D83E7F', flexShrink: 0,
              }} />
              <span style={{ fontSize: 15, fontWeight: 600, color: '#3E3530' }}>
                {j.title}
              </span>
            </div>
            <div style={{ fontSize: 13, color: '#7A6E65', marginLeft: 18 }}>
              {j.description}
            </div>
            <div style={{ fontSize: 12, color: '#6B5F55', marginLeft: 18, marginTop: 4 }}>
              {j.waypointCount} stops · ~{j.estimatedMinutes} min
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
