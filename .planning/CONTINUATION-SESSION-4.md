# EMBRYO — Continuation Prompt for Session 4+

## Copy everything below this line and paste into a new Claude Code session.

---

## Context

You are continuing work on **EMBRYO**, a music history visualization app that maps 31,069 classical-to-contemporary artists on an interactive world map with connection arcs, genre filtering, and a playable timeline. The app is at `/Users/flork/Documents/embryo`.

### Tech Stack
- **React 19.2** + **Vite 7.3** SPA (no SSR)
- **MapLibre GL JS** via `react-map-gl/maplibre` — OpenStreetMap raster tiles
- **Canvas 2D overlay** (`CanvasOverlay.jsx`, 1198 lines) for all visualization: clusters, city groups, individual artist nodes, connection arcs, particles, orbs
- **Supercluster** for geographic clustering — three-tier zoom: cluster (<8), city (8-12), individual (>12)
- **Fuse.js** for fuzzy search across 31K artists
- **DM Sans** (body) + **Instrument Serif** (display) fonts
- **No test framework** currently configured
- Tailwind is in `devDependencies` and imported in `index.css` but completely unused — all styling is inline
- Data: two JSON files in `/public/data/` — `artists_final.json` (~18MB) and `connections_final.json`

### File Structure (15 files, ~4,346 lines total)
```
src/
  App.jsx                 (490 lines) — root component, useReducer for timeline, all state
  main.jsx                (39 lines)  — ErrorBoundary + ReactDOM render
  components/
    CanvasOverlay.jsx      (1198 lines) — canvas rendering, hit testing, keyboard nav, Supercluster
    Timeline.jsx           (504 lines)  — range slider, histogram, play/pause, year inputs
    DetailPanel.jsx        (651 lines)  — artist detail sidebar/bottom sheet
    SearchBar.jsx          (348 lines)  — Fuse.js search with dropdown
    Map.jsx                (200 lines)  — MapGL wrapper, skip links, ArtistCount
    GenreFilters.jsx       (157 lines)  — genre filter chips
    ConnectionFilters.jsx  (150 lines)  — connection type filter chips
    ArtistCount.jsx        (64 lines)   — visible artist count badge
  hooks/
    useArtistData.js       (33 lines)   — fetch artists JSON
    useConnectionData.js   (69 lines)   — fetch connections JSON, build lookup maps
  utils/
    rendering.js           (313 lines)  — drawArtistNode, drawCityGroup, drawArc, drawOrb, etc.
    genres.js              (54 lines)   — GENRE_BUCKETS, getGenreBucket, getTextColorForBg
    cityGrouping.js        (76 lines)   — buildCityGroups utility
```

### Design System
- **Palette**: Cream `#FAF3EB` (bg), Dark `#3E3530` (primary text), `#5A5048` (secondary), `#7A6E65` (tertiary), `#6B5F55` (muted), Pink accent `#D83E7F` / `#C4326B`
- **Glass tokens**: `rgba(250, 243, 235, 0.88)` bg + `backdrop-filter: blur(8px)` + `border: 1px solid rgba(224, 216, 204, 0.5)`
- **Genre colors**: Classical `#912761`, Jazz/Blues `#D4295E`, Rock `#F4762D`, Electronic `#DB608F`, Hip-hop `#FFBA52`, Pop/Soul `#E05262`, Other `#C48272`
- **Touch targets**: 44px minimum everywhere
- **WCAG 2.2 AA** strict — all contrast calculated with relative luminance formula

### Git State
- Branch: `feature/maplibre-rebuild`
- 20 commits on this branch across 3 prior sessions
- Latest uncommitted changes: Session 4 visual redesign + 13 Codex bug fixes (7 files modified)
- Dev server config: `.claude/launch.json` → `embryo-dev` on port 5199

---

## What Was Completed (Sessions 1-4)

### Session 1: Core Build
- Three-tier zoom rendering (cluster → city → individual)
- Supercluster integration with zoom-aware hit testing
- City label typography and collision detection
- Performance: stopped continuous polling, fixed Supercluster rebuild

### Session 2: Audit Fixes Sprint (from full audit report)
- **B1**: `useReducer` for timeline state (was concurrent setState)
- **B2**: ID-based connection keying (was name-based)
- **B8**: Genre matching checks ALL genres (was first-only)
- **C6**: ErrorBoundary added in `main.jsx`
- **V1-V4**: Label collision, node spreading, text readability, hit testing
- **A3-A11, B5, B10**: Focus trap, contrast, announcements, skip links, flyTo dedup
- **A1, A2, A12**: ARIA live region, keyboard focus indicator, reduced motion
- **YS**: Editable year inputs on timeline, pointer capture fix, slider a11y

### Session 3: Polish & Accessibility
- Genre contrast fixes (darkened palette for WCAG AA)
- Canvas ARIA zoom mode announcements
- Playback announcement suppression
- URL hash state persistence + reset button + search auto-filter
- Mobile viewport, layout jitter, search UX, OG tags, SPA routing

### Session 4: Visual Redesign + Codex Bug Fixes (CURRENT — uncommitted)
**Visual redesign** (researched Felt.com, kepler.gl, Mapbox, Observable D3, earth.nullschool.net):
- GenreFilters: compact outline chips with colored dots, left-aligned
- ConnectionFilters: smaller pills, k-notation counts, "Collab" short label
- Timeline: compact 52px height, modern rounded play button
- Cluster counts: dark semi-transparent circle backgrounds with white text

**13 Codex bug fixes applied:**
1. Range clamping `Math.max(1400)/Math.min(2025)` in auto-expand
2. `parseHash()` → module-level `_initialHash` constant (no useRef re-parse)
3. `setTimeout` → `map.on('load')` event-based initialization
4. `moveend` listener for hash sync
5. Dead dispatch code removed (replaced by useReducer)
6. `setImageError(false)` moved from render body to `useEffect([artistKey])`
7. Pre-sorted artists array (avoids O(n log n) per frame)
8. Linear spiral offsets for co-located artists (was exponential)
9. `100vh` → `100dvh` on loading/error screens
10. "No artists found" dropdown guarded by `hasFocus` state
11. City label collision box includes count text width
12. Skip-link IDs: `id="search-input"`, `id="genre-filters"` + 3 skip links in Map.jsx
13. `#9A8E85` → `#7A6E65` for WCAG AA contrast compliance

---

## What Remains — YOUR ROADMAP

### Phase A: Commit Session 4 + Remaining Audit Items

**FIRST**: Commit the uncommitted Session 4 changes (visual redesign + 13 bug fixes).

Then address remaining items from the audit (`.planning/magical-chasing-mist.md`):

| ID | Category | Description | Status |
|----|----------|-------------|--------|
| V1 | Spatial | Label overlap at individual zoom — occlusion culling system | **Partially fixed** (node spreading done, but no label occlusion grid) |
| V2 | Spatial | Cluster hover pill overlaps nearby clusters | **Not started** |
| V5 | Spatial | City→individual transition spacing | **Partially fixed** (spiral offsets added) |
| V6 | Spatial | Density-aware label display (hide in dense areas) | **Not started** |
| B4 | Bug | opacityMap grows unbounded — memory leak | **Not started** |
| B6 | Bug | focusedArtistIndexRef not reset on artist change | **Not started** |
| C1 | Code | Remove unused Tailwind (in devDeps + index.css but unused) | **Not started** |
| C2 | Code | Centralize flyTo logic (still in 3 places) | **Not started** |
| C3 | Code | Name-based keys in posMap/opacityMap/artistMap → use ID | **Partially fixed** (connectionsByArtist uses ID, but canvas maps still use name) |
| C4 | Code | getGenreBucket called per frame → cache on data load | **Partially fixed** (artistMetaRef caches, but verify completeness) |
| C7 | Code | Magic numbers → named constants | **Not started** |
| P1 | Perf | filteredArtists iterates 31K on every change | **Not started** |
| P3 | Perf | posMap rebuilt every frame during pan/zoom | **Not started** (viewport culling added but projection still runs for all visible) |
| P4 | Perf | No virtualization for DetailPanel connections list | **Not started** |
| U2 | UX | No onboarding for first-time users | **Not started** |
| U6 | UX | Lineage chain tracing (multi-hop connections) | **Not started** |
| U8 | UX | Mobile bottom sheet drag handle | **Not started** |
| U10 | UX | Mobile filter overlap with timeline | **Not started** |
| U11 | UX | Dark mode support | **Not started** |

### Phase B: Full 2026 UX/UI/Accessibility/Responsiveness Audit

After fixing the remaining audit items, conduct a **fresh comprehensive audit** against 2026 design standards:

**1. Visual Design Audit (2026 Aesthetics)**
- Research current state-of-art interactive map/data visualization UIs (March 2026)
- Audit against: glassmorphism evolution, spatial UI patterns, micro-interactions, motion design
- Check: typography hierarchy, spacing rhythm, color harmony, information density
- Evaluate: does this feel like a 2026 product or a 2023 prototype?
- Consider: subtle animations (node hover, filter transitions, panel open/close), particle effects quality, map tile integration

**2. Responsive Design Audit**
- Test at: 375x812 (iPhone), 390x844 (iPhone 14), 768x1024 (iPad), 1024x768 (iPad landscape), 1280x800 (laptop), 1920x1080 (desktop), 2560x1440 (4K)
- Check: filter bar overflow, timeline usability at narrow widths, detail panel sizing, search bar positioning, touch target sizes
- Verify: `dvh` units work correctly, safe area insets on notched devices, landscape orientation
- Test: pinch-to-zoom conflicts with map zoom, scroll behavior on mobile detail panel

**3. Accessibility Re-audit (WCAG 2.2 AA)**
- Full keyboard-only walkthrough of every flow: search → select → view connections → navigate → close → filter → play timeline
- Screen reader testing: does every state change get announced? Are all interactive elements labeled?
- Focus management: is focus never lost? Does it always go somewhere logical?
- Contrast: re-verify ALL text and UI component contrast ratios with the updated colors
- Motion: does `prefers-reduced-motion` suppress ALL animations (CSS + canvas)?
- Color independence: can all information be understood without color (genre dots have labels, connection types have dash patterns)?

**4. Performance Audit**
- Measure: initial load time, time to interactive, frame rate during pan/zoom/playback
- Profile: memory usage over extended sessions (filter cycling, playback loops)
- Check: 18MB JSON load — should this be chunked, compressed, or lazy-loaded?
- Canvas: frame budget during animation (target 16ms), identify hot paths

**5. Interaction Design Audit**
- Map interactions: zoom, pan, click, hover, cluster expand — are transitions smooth?
- Filter interactions: do they feel responsive? Visual feedback on toggle?
- Timeline: is the range slider intuitive? Play button feedback? Year input UX?
- Search: typeahead speed, result relevance, clear affordance
- Detail panel: scroll behavior, connection navigation, back button, deep linking

---

## Rules

- Read CLAUDE.md if it exists before starting
- Target WCAG 2.2 Level AA strict for all UI work
- Use Atkinson Hyperlegible Next font when available (user preference)
- Calculate contrast with WCAG relative luminance formula — never eyeball
- 44px minimum touch targets
- No gray on color, no card-in-card, no bounce easing
- Commit frequently with descriptive messages
- If you error, say so immediately
- Never delete functions/features/data unless explicitly told
- Show diff before committing refactors
- For canvas work: build reusable spatial utilities, not inline fixes. O(1) grid lookups, not O(n²) pairwise
- Verify focus management after every accessibility change
- Test at mobile viewport (375x812) for every responsive change

## Dev Server

Start with: `preview_start` using the `embryo-dev` config in `.claude/launch.json` (port 5199).
Working directory: `/Users/flork/Documents/embryo`

## Audit Report

The full audit report with all findings is at: `/Users/flork/.claude/plans/magical-chasing-mist.md`
Read it before starting any work — it contains detailed root cause analysis and fix recommendations for every issue.
