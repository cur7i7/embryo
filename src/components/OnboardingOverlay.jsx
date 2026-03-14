import React, { useState, useEffect, useRef, useCallback } from 'react';

const STORAGE_KEY = 'embryo-onboarded';

const STEPS = [
  {
    icon: null, // Special: rendered as the EMBRYO wordmark
    heading: 'EMBRYO',
    body: 'Explore thousands of artists and their connections across centuries.',
  },
  {
    icon: 'map',
    heading: 'Navigate the map',
    body: 'Click clusters to zoom in. Double-click to jump directly to artists.',
  },
  {
    icon: 'search',
    heading: 'Find anyone',
    body: 'Use the search bar (\u2318K or /) to find any artist instantly.',
  },
  {
    icon: 'connections',
    heading: 'Discover connections',
    body: 'Select an artist to see their teachers, students, influences, and collaborators.',
  },
];

/* ------------------------------------------------------------------ */
/*  Small illustrative SVG icons for steps 1-3                        */
/* ------------------------------------------------------------------ */

function MapIcon({ reduced }) {
  const baseStyle = {
    width: 56,
    height: 56,
    display: 'block',
  };
  // Animated "click ripple" circles
  return (
    <svg viewBox="0 0 56 56" style={baseStyle} aria-hidden="true">
      {/* Cluster dots */}
      <circle cx="20" cy="22" r="10" fill="#B8336A" opacity="0.18" />
      <circle cx="20" cy="22" r="5" fill="#B8336A" opacity="0.55" />
      <circle cx="38" cy="30" r="7" fill="#6B5E54" opacity="0.15" />
      <circle cx="38" cy="30" r="3.5" fill="#6B5E54" opacity="0.5" />
      <circle cx="30" cy="42" r="5" fill="#B8336A" opacity="0.12" />
      <circle cx="30" cy="42" r="2.5" fill="#B8336A" opacity="0.45" />
      {/* Click ripple on the main cluster */}
      {!reduced && (
        <>
          <circle cx="20" cy="22" r="5" fill="none" stroke="#B8336A" strokeWidth="1.5" opacity="0">
            <animate attributeName="r" from="5" to="16" dur="2s" repeatCount="indefinite" />
            <animate attributeName="opacity" from="0.6" to="0" dur="2s" repeatCount="indefinite" />
          </circle>
        </>
      )}
      {/* Pointer hand */}
      <text x="10" y="18" fontSize="14" style={{ pointerEvents: 'none' }}>
        {!reduced && (
          <animateTransform attributeName="transform" type="translate" values="0,0;2,2;0,0" dur="2s" repeatCount="indefinite" />
        )}
        {'👆'}
      </text>
    </svg>
  );
}

function SearchIcon({ reduced }) {
  return (
    <svg viewBox="0 0 56 56" style={{ width: 56, height: 56, display: 'block' }} aria-hidden="true">
      {/* Search bar shape */}
      <rect x="6" y="18" width="44" height="20" rx="10" fill="none" stroke="#6B5E54" strokeWidth="1.5" opacity="0.5" />
      {/* Magnifying glass */}
      <circle cx="18" cy="28" r="4" fill="none" stroke="#B8336A" strokeWidth="1.5" />
      <line x1="21" y1="31" x2="24" y2="34" stroke="#B8336A" strokeWidth="1.5" strokeLinecap="round" />
      {/* Typing cursor blink */}
      {!reduced && (
        <line x1="30" y1="23" x2="30" y2="33" stroke="#2C2420" strokeWidth="1.5" strokeLinecap="round" opacity="0.6">
          <animate attributeName="opacity" values="0.6;0;0.6" dur="1.2s" repeatCount="indefinite" />
        </line>
      )}
      {/* Keyboard shortcut hint */}
      <rect x="36" y="23" width="10" height="10" rx="2" fill="rgba(107,94,84,0.1)" stroke="#6B5E54" strokeWidth="0.8" />
      <text x="41" y="31" fontSize="7" fill="#6B5E54" textAnchor="middle" fontFamily="DM Sans, sans-serif" fontWeight="600">/</text>
    </svg>
  );
}

function ConnectionsIcon({ reduced }) {
  return (
    <svg viewBox="0 0 56 56" style={{ width: 56, height: 56, display: 'block' }} aria-hidden="true">
      {/* Central node */}
      <circle cx="28" cy="28" r="5" fill="#B8336A" opacity="0.7" />
      {/* Connected nodes */}
      <circle cx="12" cy="16" r="3" fill="#6B5E54" opacity="0.5" />
      <circle cx="44" cy="18" r="3" fill="#6B5E54" opacity="0.5" />
      <circle cx="14" cy="42" r="3" fill="#6B5E54" opacity="0.5" />
      <circle cx="42" cy="40" r="3" fill="#6B5E54" opacity="0.5" />
      {/* Connection lines */}
      <line x1="28" y1="28" x2="12" y2="16" stroke="#B8336A" strokeWidth="1" opacity="0.3">
        {!reduced && <animate attributeName="opacity" values="0.15;0.5;0.15" dur="2.5s" repeatCount="indefinite" />}
      </line>
      <line x1="28" y1="28" x2="44" y2="18" stroke="#B8336A" strokeWidth="1" opacity="0.3">
        {!reduced && <animate attributeName="opacity" values="0.15;0.5;0.15" dur="2.5s" begin="0.4s" repeatCount="indefinite" />}
      </line>
      <line x1="28" y1="28" x2="14" y2="42" stroke="#B8336A" strokeWidth="1" opacity="0.3">
        {!reduced && <animate attributeName="opacity" values="0.15;0.5;0.15" dur="2.5s" begin="0.8s" repeatCount="indefinite" />}
      </line>
      <line x1="28" y1="28" x2="42" y2="40" stroke="#B8336A" strokeWidth="1" opacity="0.3">
        {!reduced && <animate attributeName="opacity" values="0.15;0.5;0.15" dur="2.5s" begin="1.2s" repeatCount="indefinite" />}
      </line>
      {/* Labels */}
      <text x="8" y="12" fontSize="5" fill="#6B5E54" fontFamily="DM Sans, sans-serif">teacher</text>
      <text x="36" y="13" fontSize="5" fill="#6B5E54" fontFamily="DM Sans, sans-serif">influence</text>
      <text x="8" y="50" fontSize="5" fill="#6B5E54" fontFamily="DM Sans, sans-serif">peer</text>
      <text x="34" y="49" fontSize="5" fill="#6B5E54" fontFamily="DM Sans, sans-serif">collab</text>
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Main component                                                    */
/* ------------------------------------------------------------------ */

export default function OnboardingOverlay({ onComplete }) {
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);

  const overlayRef = useRef(null);
  const nextButtonRef = useRef(null);
  const previousFocusRef = useRef(null);

  // Prefers-reduced-motion
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(
    () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
  );
  useEffect(() => {
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handler = (e) => setPrefersReducedMotion(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  // Check localStorage on mount
  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_KEY)) return;
    } catch { /* localStorage unavailable — show onboarding */ }
    previousFocusRef.current = document.activeElement;
    setVisible(true);
  }, []);

  // Focus management: focus the Next/Start button when step changes
  useEffect(() => {
    if (visible && nextButtonRef.current) {
      nextButtonRef.current.focus();
    }
  }, [step, visible]);

  // Escape to dismiss
  useEffect(() => {
    if (!visible) return;
    const handleKey = (e) => {
      if (e.key === 'Escape') dismiss();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const dismiss = useCallback(() => {
    try { localStorage.setItem(STORAGE_KEY, '1'); } catch { /* noop */ }
    if (prefersReducedMotion) {
      setVisible(false);
      onComplete?.();
      if (previousFocusRef.current && document.contains(previousFocusRef.current)) {
        previousFocusRef.current.focus();
      }
    } else {
      setExiting(true);
      setTimeout(() => {
        setVisible(false);
        setExiting(false);
        onComplete?.();
        if (previousFocusRef.current && document.contains(previousFocusRef.current)) {
          previousFocusRef.current.focus();
        }
      }, 300);
    }
  }, [onComplete, prefersReducedMotion]);

  const goNext = useCallback(() => {
    if (step < STEPS.length - 1) {
      setStep(s => s + 1);
    } else {
      dismiss();
    }
  }, [step, dismiss]);

  const goBack = useCallback(() => {
    if (step > 0) setStep(s => s - 1);
  }, [step]);

  // Focus trap
  const handleTrapKeyDown = useCallback((e) => {
    if (e.key !== 'Tab') return;
    const focusable = e.currentTarget.querySelectorAll(
      'button, a, input, [tabindex]:not([tabindex="-1"])'
    );
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
  }, []);

  if (!visible) return null;

  const isLastStep = step === STEPS.length - 1;
  const isFirstStep = step === 0;
  const current = STEPS[step];
  const transition = prefersReducedMotion ? 'none' : 'opacity 0.3s ease';

  const renderIcon = () => {
    if (current.icon === null) {
      // Welcome step: show the EMBRYO logo
      return (
        <img
          src="/embryo-logo.svg"
          alt=""
          aria-hidden="true"
          style={{
            width: 72,
            height: 72,
            marginBottom: 8,
          }}
        />
      );
    }
    switch (current.icon) {
      case 'map': return <MapIcon reduced={prefersReducedMotion} />;
      case 'search': return <SearchIcon reduced={prefersReducedMotion} />;
      case 'connections': return <ConnectionsIcon reduced={prefersReducedMotion} />;
      default: return null;
    }
  };

  return (
    <div
      ref={overlayRef}
      role="dialog"
      aria-modal="true"
      aria-label="Welcome to EMBRYO"
      onKeyDown={handleTrapKeyDown}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        backgroundColor: 'rgba(44, 36, 32, 0.5)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        opacity: exiting ? 0 : 1,
        transition,
        fontFamily: '"DM Sans", sans-serif',
      }}
    >
      {/* Card */}
      <div
        style={{
          width: '100%',
          maxWidth: 480,
          backgroundColor: '#FAF3EB',
          borderRadius: 12,
          boxShadow: '0 12px 48px rgba(44, 36, 32, 0.25), 0 2px 12px rgba(44, 36, 32, 0.1)',
          padding: '36px 32px 28px',
          position: 'relative',
          opacity: exiting ? 0 : 1,
          transform: exiting ? 'translateY(12px)' : 'translateY(0)',
          transition: prefersReducedMotion ? 'none' : 'opacity 0.3s ease, transform 0.3s ease',
        }}
      >
        {/* Skip link */}
        <button
          onClick={dismiss}
          style={{
            position: 'absolute',
            top: 16,
            right: 16,
            background: 'none',
            border: 'none',
            padding: '4px 8px',
            fontSize: 13,
            fontFamily: '"DM Sans", sans-serif',
            fontWeight: 500,
            color: '#6B5E54',
            cursor: 'pointer',
            minHeight: 44,
            minWidth: 44,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 6,
          }}
          onFocus={e => { e.currentTarget.style.outline = '2px solid #6B5E54'; e.currentTarget.style.outlineOffset = '2px'; }}
          onBlur={e => { e.currentTarget.style.outline = 'none'; }}
          aria-label="Skip onboarding"
        >
          Skip
        </button>

        {/* Icon */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          marginBottom: 16,
        }}>
          {renderIcon()}
        </div>

        {/* Heading */}
        <h2 style={{
          fontFamily: isFirstStep ? '"Instrument Serif", serif' : '"Instrument Serif", serif',
          fontSize: isFirstStep ? 32 : 22,
          fontWeight: 400,
          color: '#2C2420',
          textAlign: 'center',
          margin: '0 0 8px 0',
          lineHeight: 1.2,
          letterSpacing: isFirstStep ? '0.04em' : '0.01em',
        }}>
          {current.heading}
        </h2>

        {/* Body */}
        <p style={{
          fontSize: 15,
          lineHeight: 1.6,
          color: '#6B5E54',
          textAlign: 'center',
          margin: '0 0 28px 0',
          maxWidth: 360,
          marginLeft: 'auto',
          marginRight: 'auto',
        }}>
          {current.body}
        </p>

        {/* Dot indicators */}
        <div
          role="tablist"
          aria-label="Onboarding steps"
          style={{
            display: 'flex',
            justifyContent: 'center',
            gap: 8,
            marginBottom: 24,
          }}
        >
          {STEPS.map((_, i) => (
            <button
              key={i}
              role="tab"
              aria-selected={i === step}
              aria-label={`Step ${i + 1} of ${STEPS.length}`}
              onClick={() => setStep(i)}
              style={{
                width: i === step ? 24 : 8,
                height: 8,
                borderRadius: 4,
                border: 'none',
                padding: '18px 10px',
                cursor: 'pointer',
                backgroundColor: i === step ? '#B8336A' : 'rgba(107, 94, 84, 0.2)',
                backgroundClip: 'content-box',
                transition: prefersReducedMotion ? 'none' : 'width 0.25s ease, background-color 0.25s ease',
                minWidth: 0,
                minHeight: 0,
                boxSizing: 'content-box',
              }}
              onFocus={e => { e.currentTarget.style.outline = '2px solid #B8336A'; e.currentTarget.style.outlineOffset = '2px'; }}
              onBlur={e => { e.currentTarget.style.outline = 'none'; }}
            />
          ))}
        </div>

        {/* Navigation buttons */}
        <div style={{
          display: 'flex',
          gap: 10,
          justifyContent: 'center',
        }}>
          {/* Back button (hidden on first step) */}
          {!isFirstStep && (
            <button
              onClick={goBack}
              aria-label="Previous step"
              style={{
                padding: '10px 20px',
                fontSize: 14,
                fontWeight: 600,
                fontFamily: '"DM Sans", sans-serif',
                color: '#6B5E54',
                backgroundColor: 'transparent',
                border: '1px solid rgba(107, 94, 84, 0.3)',
                borderRadius: 8,
                cursor: 'pointer',
                minHeight: 44,
                minWidth: 44,
                transition: prefersReducedMotion ? 'none' : 'background-color 0.15s ease',
              }}
              onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(107, 94, 84, 0.06)'; }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
              onFocus={e => { e.currentTarget.style.outline = '2px solid #6B5E54'; e.currentTarget.style.outlineOffset = '2px'; }}
              onBlur={e => { e.currentTarget.style.outline = 'none'; }}
            >
              Back
            </button>
          )}

          {/* Next / Start exploring */}
          <button
            ref={nextButtonRef}
            onClick={goNext}
            style={{
              padding: '10px 28px',
              fontSize: 14,
              fontWeight: 600,
              fontFamily: '"DM Sans", sans-serif',
              color: '#FAF3EB',
              backgroundColor: '#B8336A',
              border: '2px solid transparent',
              borderRadius: 8,
              cursor: 'pointer',
              minHeight: 44,
              minWidth: 44,
              transition: prefersReducedMotion ? 'none' : 'background-color 0.15s ease, box-shadow 0.15s ease',
              boxShadow: '0 2px 8px rgba(184, 51, 106, 0.25)',
            }}
            onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#A02D5E'; }}
            onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#B8336A'; }}
            onFocus={e => { e.currentTarget.style.outline = '2px solid #B8336A'; e.currentTarget.style.outlineOffset = '2px'; }}
            onBlur={e => { e.currentTarget.style.outline = 'none'; }}
          >
            {isLastStep ? 'Start exploring' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
}
