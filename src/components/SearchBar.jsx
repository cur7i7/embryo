import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import Fuse from 'fuse.js';
import { getGenreBucket } from '../utils/genres.js';
import { useIsPointerFine } from '../hooks/useIsPointerFine.js';

const MAX_RESULTS = 8;

function SearchBar({ artists, allArtists, onSelect, isMobile = false, artistCount }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [hasFocus, setHasFocus] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const isPointerFine = useIsPointerFine();
  const inputRef = useRef(null);
  const dropdownRef = useRef(null);
  const blurTimeoutRef = useRef(null);

  // Fix #49: Derive total artist count for the placeholder.
  // Prefer the explicit `artistCount` prop; fall back to allArtists/artists length.
  // NOTE: parent (App.jsx) can pass `artistCount={allArtists.length}` to make this
  // reflect the full dataset rather than the currently-filtered slice.
  const totalCount = artistCount ?? (allArtists?.length || artists?.length) ?? 0;
  const searchPlaceholder = totalCount > 0
    ? `Search ${totalCount.toLocaleString()} artists…`
    : 'Search artists…';

  // Use the full unfiltered dataset for indexing so the Fuse index is not
  // rebuilt on every timeline drag (which changes the filtered artists list
  // every frame). Fall back to artists if allArtists is not provided.
  const indexSource = allArtists && allArtists.length > 0 ? allArtists : artists;
  const fuse = useMemo(() => {
    if (!indexSource || indexSource.length === 0) return null;
    return new Fuse(indexSource, {
      keys: ['name'],
      threshold: 0.3,
      minMatchCharLength: 2,
      includeScore: true,
    });
  }, [indexSource]);

  const handleInputChange = useCallback((e) => {
    const val = e.target.value;
    setQuery(val);
    setActiveIndex(-1);

    if (!val.trim() || !fuse) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    const matches = fuse.search(val).slice(0, MAX_RESULTS).map((r) => r.item);
    setResults(matches);
    setIsOpen(matches.length > 0);
  }, [fuse]);

  const selectArtist = useCallback((artist) => {
    setQuery(artist.name);
    setResults([]);
    setIsOpen(false);
    setActiveIndex(-1);
    onSelect?.(artist);
  }, [onSelect]);

  const handleKeyDown = useCallback((e) => {
    if (!isOpen || results.length === 0) {
      if (e.key === 'Escape') {
        setQuery('');
        setResults([]);
        setIsOpen(false);
        inputRef.current?.blur();
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((prev) => Math.min(prev + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((prev) => Math.max(prev - 1, -1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIndex >= 0 && activeIndex < results.length) {
        selectArtist(results[activeIndex]);
      } else if (results.length > 0) {
        selectArtist(results[0]);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      setActiveIndex(-1);
      inputRef.current?.blur();
    }
  }, [isOpen, results, activeIndex, selectArtist]);

  const handleBlur = useCallback(() => {
    // Delay close to allow result click to register
    blurTimeoutRef.current = setTimeout(() => {
      setIsOpen(false);
      setHasFocus(false);
      setActiveIndex(-1);
    }, 200);
  }, []);

  const handleFocus = useCallback(() => {
    if (blurTimeoutRef.current) {
      clearTimeout(blurTimeoutRef.current);
    }
    setHasFocus(true);
    if (query.trim() && results.length > 0) {
      setIsOpen(true);
    }
  }, [query, results]);

  // Clean up blur timeout on unmount
  useEffect(() => {
    return () => {
      if (blurTimeoutRef.current) {
        clearTimeout(blurTimeoutRef.current);
      }
    };
  }, []);

  // Fix #46: Global keyboard shortcut to focus search (/ or Ctrl/Cmd+K)
  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      // Ctrl+K (Windows/Linux) or Cmd+K (Mac)
      if (e.key === 'k' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
        return;
      }
      // "/" only when no text input is focused
      if (e.key === '/') {
        const tag = document.activeElement?.tagName?.toLowerCase();
        const isEditable = document.activeElement?.isContentEditable;
        if (tag === 'input' || tag === 'textarea' || isEditable) return;
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  // Scroll active result into view
  useEffect(() => {
    if (activeIndex < 0 || !dropdownRef.current) return;
    const items = dropdownRef.current.querySelectorAll('[data-result-item]');
    if (items[activeIndex]) {
      items[activeIndex].scrollIntoView({ block: 'nearest' });
    }
  }, [activeIndex]);

  return (
    <div
      style={{
        position: 'fixed',
        top: `calc(16px + env(safe-area-inset-top))`,
        right: `max(16px, env(safe-area-inset-right))`,
        left: isMobile ? `max(16px, env(safe-area-inset-left))` : 'auto',
        zIndex: 20,
        width: isMobile ? 'auto' : 'clamp(240px, 30vw, 320px)',
        maxWidth: 400,
        fontFamily: '"DM Sans", sans-serif',
      }}
      role="search"
      aria-label="Search for artists"
    >
      {/* Input */}
      <div style={{ position: 'relative' }}>
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#7A6E65"
          strokeWidth="2.5"
          style={{
            position: 'absolute',
            left: 12,
            top: '50%',
            transform: 'translateY(-50%)',
            pointerEvents: 'none',
          }}
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          id="search-input"
          ref={inputRef}
          type="search"
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          onFocus={handleFocus}
          placeholder={searchPlaceholder}
          aria-label="Search artists"
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          aria-controls="search-results-list"
          aria-autocomplete="list"
          aria-activedescendant={activeIndex >= 0 ? `search-result-${activeIndex}` : undefined}
          role="combobox"
          style={{
            width: '100%',
            boxSizing: 'border-box',
            padding: '9px 12px 9px 36px',
            fontSize: 14,
            fontFamily: '"DM Sans", sans-serif',
            color: '#3E3530',
            backgroundColor: 'rgba(250, 243, 235, 0.95)',
            border: '1px solid rgba(224, 216, 204, 0.8)',
            borderRadius: (isOpen || (hasFocus && query.trim().length >= 2 && results.length === 0)) ? '12px 12px 0 0' : 999,
            outline: '2px solid transparent',
            boxShadow: '0 2px 12px rgba(90, 80, 72, 0.10)',
            backdropFilter: 'blur(8px)',
            transition: 'border-color 0.15s ease, border-radius 0.15s ease',
            minHeight: isPointerFine ? 36 : 44,
          }}
          onFocusCapture={e => { if (e.target.matches(':focus-visible')) { e.target.style.borderColor = 'rgba(168, 144, 128, 0.9)'; e.target.style.boxShadow = '0 0 0 3px rgba(168, 144, 128, 0.4)'; } }}
          onBlurCapture={e => { e.target.style.borderColor = 'rgba(224, 216, 204, 0.8)'; e.target.style.boxShadow = '0 2px 12px rgba(90, 80, 72, 0.10)'; }}
        />
        {query && (
          <button
            onClick={() => {
              setQuery('');
              setResults([]);
              setIsOpen(false);
              inputRef.current?.focus();
            }}
            aria-label="Clear search"
            style={{
              position: 'absolute',
              right: 10,
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: '#7A6E65',
              fontSize: 16,
              padding: '8px',
              lineHeight: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minWidth: 44,
              minHeight: 44,
              outline: '2px solid transparent',
            }}
            onFocus={(e) => { if (e.currentTarget.matches(':focus-visible')) e.currentTarget.style.boxShadow = '0 0 0 2px rgba(122,110,101,0.4)'; }}
            onBlur={(e) => { e.currentTarget.style.boxShadow = 'none'; }}
          >
            ×
          </button>
        )}
      </div>

      {/* Dropdown */}
      {isOpen && results.length > 0 && (
        <ul
          id="search-results-list"
          ref={dropdownRef}
          role="listbox"
          aria-label="Search results"
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            margin: 0,
            padding: 0,
            listStyle: 'none',
            backgroundColor: 'rgba(250, 243, 235, 0.98)',
            border: '1px solid rgba(224, 216, 204, 0.8)',
            borderTop: 'none',
            borderRadius: '0 0 12px 12px',
            boxShadow: '0 4px 16px rgba(90, 80, 72, 0.18), 0 1px 3px rgba(90, 80, 72, 0.08)',
            backdropFilter: 'blur(8px)',
            maxHeight: 'clamp(160px, 40vh, 320px)',
            overflowY: 'auto',
            zIndex: 21,
          }}
        >
          {results.map((artist, i) => {
            const { color, bucket } = getGenreBucket(artist.genres);
            const isActive = i === activeIndex;
            return (
              <li
                key={artist.id}
                id={`search-result-${i}`}
                data-result-item
                role="option"
                aria-selected={isActive}
                onMouseDown={(e) => {
                  // Prevent input blur before click fires
                  e.preventDefault();
                  selectArtist(artist);
                }}
                onMouseEnter={() => setActiveIndex(i)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: isPointerFine ? '6px 14px' : '9px 14px',
                  minHeight: isPointerFine ? 36 : 44,
                  cursor: 'pointer',
                  backgroundColor: isActive ? 'rgba(168, 144, 128, 0.10)' : 'transparent',
                  borderBottom: i < results.length - 1 ? '1px solid rgba(224, 216, 204, 0.4)' : 'none',
                  transition: 'background-color 0.1s ease',
                }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    backgroundColor: color,
                    flexShrink: 0,
                  }}
                  aria-hidden="true"
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 500,
                      color: '#3E3530',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {artist.name}
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: '#6B5F55',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {[bucket, artist.birth_city].filter(Boolean).join(' · ')}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {hasFocus && query.trim().length >= 2 && results.length === 0 && (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            padding: '12px 14px',
            fontSize: 14,
            fontFamily: '"DM Sans", sans-serif',
            color: '#4A3F37',
            backgroundColor: 'rgba(250, 243, 235, 0.98)',
            border: '1px solid rgba(224, 216, 204, 0.8)',
            borderTop: 'none',
            borderRadius: '0 0 12px 12px',
            boxShadow: '0 4px 16px rgba(90, 80, 72, 0.14)',
            backdropFilter: 'blur(8px)',
            zIndex: 21,
          }}
        >
          No artists found
        </div>
      )}
    </div>
  );
}

export default React.memo(SearchBar);
