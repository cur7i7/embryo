import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const CORRECTION_TYPES = [
  { value: 'wrong_info', label: 'Wrong information' },
  { value: 'missing_connection', label: 'Missing connection' },
  { value: 'not_musician', label: 'Not a musician' },
  { value: 'other', label: 'Other' },
];

function buildIssueUrl(artist, correctionType, description, email) {
  const title = `[Correction] ${artist.name} (${artist.id})`;
  const body = [
    `### Artist`,
    `- Name: ${artist.name}`,
    `- ID: ${artist.id}`,
    '',
    `### Correction Type`,
    `- ${correctionType}`,
    '',
    `### Description`,
    description.trim(),
    '',
    `### Optional Contact`,
    email?.trim() ? `- ${email.trim()}` : '- not provided',
  ].join('\n');

  return `https://github.com/embryo-wiki/embryo/issues/new?title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`;
}

function readSuggestionRecord(storageKey) {
  if (!storageKey) return null;
  try {
    const raw = localStorage.getItem(storageKey);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function SuggestionForm({
  isOpen,
  artist,
  onClose,
  onSubmitted,
  isMobile = false,
}) {
  const dialogRef = useRef(null);
  const descriptionRef = useRef(null);
  const [correctionType, setCorrectionType] = useState(CORRECTION_TYPES[0].value);
  const [description, setDescription] = useState('');
  const [email, setEmail] = useState('');

  const storageKey = artist ? `embryo-suggestion:${artist.id}` : null;
  const existingRecord = useMemo(
    () => readSuggestionRecord(storageKey),
    [storageKey, isOpen]
  );

  useEffect(() => {
    if (!isOpen) return;
    setCorrectionType(CORRECTION_TYPES[0].value);
    setDescription('');
    setEmail('');
  }, [isOpen, artist?.id]);

  useEffect(() => {
    if (!isOpen) return;
    const prev = document.activeElement;
    const modal = dialogRef.current;
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

  const handleBackdropClick = useCallback((event) => {
    if (event.target === event.currentTarget) onClose?.();
  }, [onClose]);

  const handleSubmit = useCallback((event) => {
    event.preventDefault();
    if (!artist || !storageKey || existingRecord) return;

    const issueUrl = buildIssueUrl(artist, correctionType, description, email);
    try {
      window.open(issueUrl, '_blank', 'noopener,noreferrer');
    } catch {
      // Fallback for strict popup blockers.
      window.location.href = issueUrl;
    }

    try {
      localStorage.setItem(
        storageKey,
        JSON.stringify({
          submittedAt: new Date().toISOString(),
          correctionType,
        })
      );
    } catch {
      // Ignore storage failures; submission still opens.
    }

    onSubmitted?.(artist);
    onClose?.();
  }, [artist, correctionType, description, email, existingRecord, onClose, onSubmitted, storageKey]);

  if (!isOpen || !artist) return null;

  return (
    <div
      onClick={handleBackdropClick}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1200,
        backgroundColor: 'rgba(44, 36, 32, 0.46)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: isMobile ? 'flex-end' : 'center',
        justifyContent: 'center',
        padding: isMobile ? 0 : 16,
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Suggest a correction for ${artist.name}`}
        style={{
          width: '100%',
          maxWidth: isMobile ? '100%' : 560,
          maxHeight: isMobile ? '92dvh' : 'min(88dvh, 760px)',
          borderRadius: isMobile ? '16px 16px 0 0' : 14,
          border: '1px solid rgba(224, 216, 204, 0.8)',
          backgroundColor: '#FAF3EB',
          boxShadow: '0 16px 56px rgba(44, 36, 32, 0.28)',
          padding: isMobile
            ? 'calc(env(safe-area-inset-top) + 16px) 16px calc(env(safe-area-inset-bottom) + 16px)'
            : '20px',
          overflowY: 'auto',
          fontFamily: '"DM Sans", sans-serif',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 14 }}>
          <div>
            <h3
              style={{
                margin: 0,
                fontSize: 19,
                fontWeight: 600,
                color: '#3E3530',
                lineHeight: 1.2,
              }}
            >
              Suggest A Correction
            </h3>
            <p style={{ margin: '6px 0 0 0', fontSize: 13, color: '#6B5F55', lineHeight: 1.4 }}>
              {artist.name} ({artist.id})
            </p>
          </div>

          <button
            onClick={onClose}
            aria-label="Close correction form"
            style={{
              width: 44,
              height: 44,
              borderRadius: '50%',
              border: '1px solid rgba(224, 216, 204, 0.8)',
              backgroundColor: 'rgba(255, 255, 255, 0.7)',
              color: '#3E3530',
              fontSize: 20,
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            ×
          </button>
        </div>

        {existingRecord && (
          <div
            role="status"
            aria-live="polite"
            style={{
              marginBottom: 14,
              padding: '10px 12px',
              borderRadius: 10,
              border: '1px solid rgba(184, 51, 106, 0.3)',
              backgroundColor: 'rgba(184, 51, 106, 0.08)',
              color: '#5A4030',
              fontSize: 13,
              lineHeight: 1.45,
            }}
          >
            A correction has already been submitted for this artist from this device.
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#5A4F47', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              Correction Type
            </span>
            <select
              value={correctionType}
              onChange={(event) => setCorrectionType(event.target.value)}
              disabled={!!existingRecord}
              style={{
                width: '100%',
                minHeight: 44,
                borderRadius: 10,
                border: '1px solid rgba(168, 144, 128, 0.4)',
                backgroundColor: 'rgba(255, 255, 255, 0.85)',
                color: '#3E3530',
                fontFamily: '"DM Sans", sans-serif',
                fontSize: 14,
                padding: '10px 12px',
              }}
            >
              {CORRECTION_TYPES.map((item) => (
                <option key={item.value} value={item.value}>{item.label}</option>
              ))}
            </select>
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#5A4F47', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              Description
            </span>
            <textarea
              ref={descriptionRef}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Describe what should be corrected or added."
              required
              minLength={8}
              disabled={!!existingRecord}
              style={{
                width: '100%',
                minHeight: 120,
                borderRadius: 10,
                border: '1px solid rgba(168, 144, 128, 0.4)',
                backgroundColor: 'rgba(255, 255, 255, 0.85)',
                color: '#3E3530',
                fontFamily: '"DM Sans", sans-serif',
                fontSize: 14,
                padding: '10px 12px',
                resize: 'vertical',
                lineHeight: 1.45,
              }}
            />
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#5A4F47', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              Email (optional)
            </span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              disabled={!!existingRecord}
              placeholder="name@example.com"
              style={{
                width: '100%',
                minHeight: 44,
                borderRadius: 10,
                border: '1px solid rgba(168, 144, 128, 0.4)',
                backgroundColor: 'rgba(255, 255, 255, 0.85)',
                color: '#3E3530',
                fontFamily: '"DM Sans", sans-serif',
                fontSize: 14,
                padding: '10px 12px',
              }}
            />
          </label>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                minHeight: 44,
                padding: '10px 16px',
                borderRadius: 10,
                border: '1px solid rgba(168, 144, 128, 0.45)',
                backgroundColor: 'rgba(255, 255, 255, 0.8)',
                color: '#5A5048',
                fontFamily: '"DM Sans", sans-serif',
                fontWeight: 600,
                fontSize: 14,
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!!existingRecord || !description.trim()}
              style={{
                minHeight: 44,
                padding: '10px 16px',
                borderRadius: 10,
                border: '1px solid rgba(184, 51, 106, 0.45)',
                backgroundColor: existingRecord || !description.trim() ? 'rgba(184, 51, 106, 0.35)' : '#B8336A',
                color: '#FAF3EB',
                fontFamily: '"DM Sans", sans-serif',
                fontWeight: 700,
                fontSize: 14,
                cursor: existingRecord || !description.trim() ? 'not-allowed' : 'pointer',
              }}
            >
              Open Submission
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default React.memo(SuggestionForm);
