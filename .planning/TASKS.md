# EMBRYO — Remaining Codex Items

## Task 1: Canvas Performance — Viewport Culling + rAF Idle Stop + Canvas State Reset
**Agent:** Builder (STANDARD — Sonnet)
**Files:** `CanvasOverlay.jsx`
**Items:**
- 3.2: Cull by viewport bounds before projection in individual mode (don't iterate all 31k)
- 3.5: Hard-reset canvas state per phase (globalAlpha, font, compositeOperation, lineWidth)
- 3.7: Stop rAF when map idle and no animated state; restart on relevant events
**Estimated:** Medium complexity, single file

## Task 2: Hit Testing — DPR-Scaled Radius + Keyboard Nav Visible-Only
**Agent:** Builder (STANDARD — Sonnet)
**Files:** `CanvasOverlay.jsx`
**Depends on:** Task 1 (same file)
**Items:**
- 4.3: Hit radius scales by DPR and input type (touch gets larger radius)
- 4.4: Keyboard navigation cycles only through currently visible candidates in active mode
**Estimated:** Medium complexity, single file

## Task 3: Accessibility — aria-pressed, :focus-visible, Live Regions
**Agent:** Designer (STANDARD — Sonnet)
**Files:** `GenreFilters.jsx`, `ConnectionFilters.jsx`, `Timeline.jsx`, `SearchBar.jsx`
**Items:**
- 7.2: Live region announcements for hover/select changes
- 7.3: aria-pressed on filter toggles, labels, and current state
- 7.4: Visible :focus-visible indicators on all keyboard-reachable controls
**Estimated:** Medium complexity, multi-file but independent of canvas

## Task 4: Accessibility — Live Regions for Canvas (hover/select announcements)
**Agent:** Designer (STANDARD — Sonnet)
**Files:** `CanvasOverlay.jsx`, `App.jsx`
**Depends on:** Tasks 1-2 (CanvasOverlay locked)
**Items:**
- 7.2 (canvas part): Announce hovered/selected artist changes via ARIA live region
**Estimated:** Small scope

## Task 5: Responsiveness — clamp()-based Sizing
**Agent:** Designer (STANDARD — Sonnet)
**Files:** `GenreFilters.jsx`, `ConnectionFilters.jsx`, `Timeline.jsx`, `SearchBar.jsx`, `DetailPanel.jsx`
**Depends on:** Task 3 (same files)
**Items:**
- 5.4: Convert rigid overlay sizing to clamp()-based widths/heights for phones/tablets/desktops
- 5.5: Collapse secondary controls into progressive disclosure on small screens
**Estimated:** Medium complexity

## Task 6: Spatial — City-Mode Label Density Budgeting
**Agent:** Spatial (STANDARD — Sonnet)
**Files:** `CanvasOverlay.jsx`
**Depends on:** Tasks 1-2-4 (CanvasOverlay locked)
**Items:**
- 6.2: Label density budgeting in city mode (priority by city weight + zoom + overlap score)
- 6.4: Text halo/backplate consistency across modes
- 6.5: Reduce cross-fade double-draw artifacts
**Estimated:** Complex canvas work

## Task 7: Data Normalization — Coordinate Validation at Ingest
**Agent:** Builder (STANDARD — Sonnet)
**Files:** `hooks/useArtistData.js`
**Items:**
- 2.3: Normalize missing/invalid coordinates once at ingest; never re-check in frame loops
**Estimated:** Small scope

## Task 8: Consistency — Filter Signature Versioning + One Filter Pipeline
**Agent:** Consistency (COMPLEX — Opus)
**Files:** `CanvasOverlay.jsx`, `App.jsx`
**Depends on:** Task 6 (CanvasOverlay locked)
**Items:**
- 1.3: One filter pipeline output drives draw, hit-test, counters, search scope, keyboard scope
- 2.5: cityGroups and supercluster indexes versioned by filter signature
**Estimated:** Complex state management

## Task 9: Accessibility — Non-Color Genre Cues
**Agent:** Designer (STANDARD — Sonnet)
**Files:** `utils/rendering.js`, `GenreFilters.jsx`
**Depends on:** Tasks 3, 5 (GenreFilters locked)
**Items:**
- 7.5: Non-color genre cues (pattern/icon/shape) for color-independent differentiation
**Estimated:** Medium, needs design decisions

## Task 10: Final Verification + Deploy
**Agent:** OPS
**Depends on:** All above
**Items:**
- Build check (npm run build)
- Deploy to Cloudflare Pages
- Mobile + desktop screenshot verification

---

## Execution Order (respecting file locks)

**Batch 1 (parallel):**
- Task 1: Builder → CanvasOverlay.jsx (perf)
- Task 3: Designer → GenreFilters, ConnectionFilters, Timeline, SearchBar (a11y)
- Task 7: Builder → useArtistData.js (data normalization)

**Batch 2 (parallel after Batch 1):**
- Task 2: Builder → CanvasOverlay.jsx (hit testing)
- Task 5: Designer → GenreFilters, ConnectionFilters, Timeline, SearchBar, DetailPanel (responsive)

**Batch 3 (sequential after Batch 2):**
- Task 4: Designer → CanvasOverlay.jsx, App.jsx (canvas live regions)
- Task 6: Spatial → CanvasOverlay.jsx (city labels, halo, cross-fade)

**Batch 4 (after Batch 3):**
- Task 8: Consistency → CanvasOverlay.jsx, App.jsx (filter pipeline)

**Batch 5 (after Batch 2+3):**
- Task 9: Designer → rendering.js, GenreFilters.jsx (non-color cues)

**Batch 6:**
- Task 10: OPS → build + deploy
