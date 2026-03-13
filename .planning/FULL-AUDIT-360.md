# EMBRYO — Full 360° Audit Report

**Date:** 2026-03-13 | **Audited by:** 6 parallel specialist agents | **Codebase:** 6,118 lines across 18 files

---

## TIER 1: CRITICAL — Must Fix

| # | Category | Issue | File(s) | Complexity | Time |
|---|----------|-------|---------|-----------|------|
| 1 | **BUG** | **Timeline drag stale closures** — `handlePointerMove` captures `rangeStart`/`rangeEnd` at drag start. Window event listener references the old function, causing handles to jump/skip during drag. | Timeline.jsx:141-155 | STANDARD | 30min |
| 2 | **PERF** | **18.5MB artists_final.json blocks LCP** — Nothing renders until full 23MB (artists + connections) is downloaded and parsed. Mobile LCP could be 15-30s on 4G. This is the #1 reason for Lighthouse score 74. | useArtistData.js, public/data/ | COMPLEX | 6h |
| 3 | **PERF** | **Supercluster rebuilds on every timeline drag frame** — Effect A rebuilds spatial index (~50-100ms) on every `filteredArtists` change, causing 100-200ms jank per frame during drag. | CanvasOverlay.jsx:1020-1070 | STANDARD | 4h |
| 4 | **BUG** | **Genre misclassification** — Substring matching `"bebop".includes("pop")` → true. Bebop artists get classified as Pop/Soul. Also "art" matches too broadly. | genres.js:21 | STANDARD | 20min |
| 5 | **A11Y** | **Inactive genre filter text fails 4.5:1 contrast** — `#6B5F55` on effective `#E8DFD3` ≈ 2.8:1 ratio at 12px. WCAG AA violation. | GenreFilters.jsx | TRIVIAL | 5min |
| 6 | **A11Y** | **Mobile filters toggle button 36px** — Below 44px WCAG 2.2 minimum touch target. | App.jsx:513 | TRIVIAL | 5min |

---

## TIER 2: HIGH — Should Fix Soon

| # | Category | Issue | File(s) | Complexity | Time |
|---|----------|-------|---------|-----------|------|
| 7 | **BUG** | **posMapRef race condition** — Map is `.clear()`ed at start of each render frame, leaving hit testing with empty data between frames. | CanvasOverlay.jsx | STANDARD | 15min |
| 8 | **BUG** | **Fuse search index uses `.length` as dep** — `indexSource.length` as useMemo dep means index won't rebuild when array reference changes but length stays the same. | SearchBar.jsx:32 | TRIVIAL | 5min |
| 9 | **BUG** | **Selected artist persists when filtered out** — Select artist → drag timeline to exclude their era → panel stays open for invisible artist. | App.jsx | STANDARD | 30min |
| 10 | **BUG** | **Timeline auto-expand can desync mode** — Auto-expand effect pushes range (start ≠ end) without updating Timeline's local `mode` state. UI shows "Year" while range is expanded. | App.jsx, Timeline.jsx | STANDARD | 20min |
| 11 | **A11Y** | **Inactive connection filter text fails contrast** — `#5A5048` on `#E8DFD3` ≈ 3.6:1 at 11px. | ConnectionFilters.jsx | TRIVIAL | 5min |
| 12 | **A11Y** | **Connection filter count can shrink to 9px** — `clamp(9px, 1.2vw, 11px)` — 9px is illegible. | ConnectionFilters.jsx | TRIVIAL | 5min |
| 13 | **A11Y** | **Timeline year labels fail contrast** — `#6B5F55` at 11px over varying map backgrounds. | Timeline.jsx | STANDARD | 15min |
| 14 | **A11Y** | **SearchBar "no results" text fails contrast** — `#6B5F55` at 13px on `rgba(250,243,235,0.98)` ≈ 3.5:1. | SearchBar.jsx | TRIVIAL | 5min |
| 15 | **A11Y** | **Genre shapes at 8px illegible** — Unicode symbols (●◆▲■★♥✦) at 8px defeat the purpose of redundant color encoding. | GenreFilters.jsx | TRIVIAL | 10min |
| 16 | **A11Y** | **Canvas hover pill invisible to screen readers** — Rendered on canvas, not mirrored in DOM/ARIA. | CanvasOverlay.jsx | COMPLEX | 1-2h |
| 17 | **A11Y** | **Radio group (Year/Range) missing arrow key navigation** — Only click/Enter works, violating ARIA radio pattern. | Timeline.jsx:302-367 | STANDARD | 1h |
| 18 | **UX** | **Error screen is dead end** — No retry button. Must refresh page. | App.jsx:404-413 | STANDARD | 20min |
| 19 | **UX** | **Timeline slider handles nearly invisible** — 4px-wide visual affordance. Hard to discover and grab. | Timeline.jsx | STANDARD | 30min |
| 20 | **PERF** | **4.6MB duplicate connections_enriched.json** — Unused file deployed to CDN, wasting bandwidth on initial crawl. | public/data/ | TRIVIAL | 2min |
| 21 | **PERF** | **No cache headers** — No `_headers` file. Repeat visitors re-download 23MB every time. | _headers (missing) | TRIVIAL | 15min |
| 22 | **RESPONSIVE** | **Phone rotation flips layout mode** — `useIsMobile` only checks width. Portrait→landscape on phone (414→896px) switches to desktop layout mid-use. | App.jsx, hooks | STANDARD | 1h |
| 23 | **RESPONSIVE** | **Mobile landscape: filters + timeline consume >60% viewport** — At 812×375 (iPhone landscape), expanded filters leave almost no map visible. | App.jsx, filters | STANDARD | 30min |

---

## TIER 3: MEDIUM — Polish & Quality

| # | Category | Issue | File(s) | Complexity | Time |
|---|----------|-------|---------|-----------|------|
| 24 | **BUG** | **`inert` attribute update timing** — Set via callback ref, may not toggle correctly on every open/close cycle of DetailPanel. | DetailPanel.jsx | STANDARD | 15min |
| 25 | **BUG** | **NaN in year input blur** — Empty/non-numeric input produces NaN; input editor closes with no feedback. | Timeline.jsx:657-667 | STANDARD | 10min |
| 26 | **BUG** | **Pointer capture + window listeners redundant** — `setPointerCapture` and window `pointermove`/`pointerup` listeners double-register. | Timeline.jsx:146 | STANDARD | 15min |
| 27 | **A11Y** | **ConnectionFilters missing aria-live region** — GenreFilters has one; ConnectionFilters does not. | ConnectionFilters.jsx | TRIVIAL | 10min |
| 28 | **A11Y** | **`aria-controls="filter-panels"` points to unmounted element** — When filters collapsed, the div doesn't exist. | App.jsx | TRIVIAL | 10min |
| 29 | **A11Y** | **Keyboard/map arrow key conflict** — Arrow keys on canvas overlay may simultaneously pan map and cycle artists. | CanvasOverlay.jsx | STANDARD | 2-3h |
| 30 | **A11Y** | **Focus-visible relies on JS handlers** — `outline: 'none'` + JS-based `boxShadow` could fail if `:focus-visible` detection fails. | Multiple | STANDARD | 2h |
| 31 | **UX** | **DetailPanel no-connections empty state** — When artist has 0 connections, section is simply absent. No message. | DetailPanel.jsx | TRIVIAL | 10min |
| 32 | **UX** | **Drag handle misleads** — Visual handle on mobile panel suggests swipe-to-dismiss, which isn't implemented. | DetailPanel.jsx | COMPLEX | 2-3h |
| 33 | **UX** | **Long connection lists unmanageable** — 30+ connections render in single list with no grouping or "show more". | DetailPanel.jsx | STANDARD | 30min |
| 34 | **UX** | **Loading state gives no progress indication** — Infinite animation with no percentage or "still loading" fallback. | App.jsx | STANDARD | 20min |
| 35 | **PERF** | **`cityPosMap` allocates new Map every frame** — GC pressure from frame-level allocation. | CanvasOverlay.jsx:586 | STANDARD | 10min |
| 36 | **PERF** | **Effect B deps include unused `connections`** — Causes unnecessary re-runs and `startRaf()` calls. | CanvasOverlay.jsx:1131 | TRIVIAL | 5min |
| 37 | **PERF** | **No font preloading** — DM Sans and Instrument Serif loaded via Google Fonts with no `preload`. | index.html | TRIVIAL | 10min |
| 38 | **PERF** | **Raster tiles underutilize MapLibre GL** — Using 256px raster PNGs instead of vector tiles. ~70% larger transfer size. | Map.jsx | COMPLEX | 3h |
| 39 | **RESPONSIVE** | **Landscape safe-area-inset-left/right not handled** — SearchBar, ArtistCount, Reset button ignore landscape notch insets. | Multiple | TRIVIAL | 15min |
| 40 | **RESPONSIVE** | **Desktop DetailPanel uses `100vh` not `100dvh`** — May extend below visible viewport on mobile browsers with dynamic toolbar. | DetailPanel.jsx | TRIVIAL | 5min |
| 41 | **RESPONSIVE** | **Typography: 1px increments (9-13px) weaken hierarchy** — 9, 10, 11, 12, 13px too tightly packed. | Multiple | STANDARD | 30min |
| 42 | **RESPONSIVE** | **`lineHeight: 1` clips descenders** — Letters g, y, p get clipped on genre/connection buttons. | GenreFilters.jsx, ConnectionFilters.jsx | TRIVIAL | 15min |

---

## TIER 4: LOW — Nice to Have

| # | Category | Issue | File(s) | Complexity | Time |
|---|----------|-------|---------|-----------|------|
| 43 | **BUG** | `hexToRgba` doesn't validate input — undefined/shorthand hex produces NaN rgba. | rendering.js:5-9 | TRIVIAL | 5min |
| 44 | **BUG** | `parseInt` without radix in year inputs. | Timeline.jsx:657 | TRIVIAL | 5min |
| 45 | **BUG** | `mapHelpers.js` opts.zoom=undefined overrides computed zoom. | mapHelpers.js:16 | TRIVIAL | 5min |
| 46 | **A11Y** | No keyboard shortcut (/ or Ctrl+K) to focus search. | SearchBar.jsx | STANDARD | 30min |
| 47 | **A11Y** | Year input clamping gives no error feedback (no `aria-invalid`). | Timeline.jsx | STANDARD | 1h |
| 48 | **A11Y** | DetailPanel focus restore fails if previous element was removed from DOM. | DetailPanel.jsx:127-153 | TRIVIAL | 30min |
| 49 | **UX** | Search placeholder could show artist count ("Search 31,069 musicians..."). | SearchBar.jsx | TRIVIAL | 10min |
| 50 | **UX** | GenreFilters mobile scroll missing left fade gradient. | GenreFilters.jsx | TRIVIAL | 10min |
| 51 | **UX** | DetailPanel image fallback fixed 120px height — disproportionate on narrow screens. | DetailPanel.jsx | TRIVIAL | 5min |
| 52 | **PERF** | connections_final.json has verbose field names (source_pipeline, evidence text). Could strip ~40%. | public/data/ | STANDARD | 1h |
| 53 | **PERF** | 70KB MapLibre CSS mostly unused (controls, popups not used). | index.css | STANDARD | 1h |
| 54 | **RESPONSIVE** | Filter toggle button position uses hardcoded 168px — may mismatch actual panel height. | App.jsx:494 | STANDARD | 1h |
| 55 | **RESPONSIVE** | `scrollbarWidth: thin` on GenreFilters but not ConnectionFilters. | ConnectionFilters.jsx | TRIVIAL | 5min |
| 56 | **RESPONSIVE** | 768px breakpoint means tablets get mobile layout. Consider 1024px or tablet-specific. | App.jsx | STANDARD | 1h |
| 57 | **PERF** | Error from either dataset blocks entire app — could show map with just artists. | App.jsx:379,404 | STANDARD | 2h |

---

## SUMMARY

| Severity | Count | Total Time |
|----------|-------|-----------|
| **CRITICAL** | 6 | ~11h |
| **HIGH** | 17 | ~9h |
| **MEDIUM** | 19 | ~15h |
| **LOW** | 15 | ~8h |
| **TOTAL** | **57** | **~43h** |

### Top 5 Highest-Impact Fixes (effort → reward ratio)

1. **Reduce artists_final.json from 18.5MB to ~5MB** (#2) — Strip unused fields, shorten keys. Halves load time. LCP improvement: 5-15s on mobile.
2. **Fix 6 contrast failures** (#5, 11, 12, 13, 14, 15) — All TRIVIAL, 35min total. Fixes all WCAG text contrast violations.
3. **Add Cloudflare `_headers` for caching** (#21) — 15min. Repeat visitors skip 23MB re-download.
4. **Fix genre misclassification** (#4) — 20min. Bebop artists stop appearing as Pop.
5. **Fix timeline drag stale closures** (#1) — 30min. Fixes the most user-visible interaction bug.

### What's Working Well

- Comprehensive ARIA: combobox search, slider timeline, live regions with debouncing, skip links
- Focus trap with Escape-to-close on DetailPanel
- `prefers-reduced-motion` respected in animations
- Genre shapes alongside colors (colorblind support)
- Viewport culling and rAF idle stop in canvas
- Graceful handling of missing connection artist references
- z-index stacking is clean and intentional
- Canvas ref pattern avoids render callback recreation
- 44px touch targets on most interactive elements
