# EMBRYO — Deep UI & Responsiveness Audit

**Date:** 2026-03-13 | **Audited by:** 3 specialist agents (Visual, Responsive, Interaction) | **Scope:** All 18 source files

---

## TIER 1: CRITICAL — Blocks usability

| # | Category | Issue | File(s) | Complexity | Time |
|---|----------|-------|---------|-----------|------|
| 1 | **UX** | **No onboarding / first-time guidance** — New user sees colored orbs with no legend, no explanation of what clusters represent, no visible app name, no hint that clusters are clickable. Zero discoverability. The most critical UX issue. | Multiple | COMPLEX | 4-6h |
| 2 | **UX** | **5-6+ clicks to see a musician from cold start** — Zoom 2→9 requires 4-6 cluster/city clicks. City click hardcodes zoom 13 (overshoot). Search is 2 steps but not discoverable. No zoom buttons exist. | CanvasOverlay.jsx:1283, Map.jsx:47, mapHelpers.js:17 | COMPLEX | 2-3h |
| 3 | **CONSISTENCY** | **"31,069 musicians" vs "30,789 artists"** — SearchBar uses `allArtists.length` (raw JSON count), ArtistCount uses `filteredArtists.length` (filtered by timeline+genre), loading screen hardcodes "31,069", loading message says "30,000+". Four different numbers for the same concept. | App.jsx, SearchBar.jsx, index.html | STANDARD | 30min |
| 4 | **RESPONSIVE** | **Landscape phone: map nearly invisible** — At 812×375 (iPhone X landscape), stacked filter bars consume ~190px+ of 375px viewport. With filters expanded, only ~56px of map visible. | App.jsx, GenreFilters.jsx:46, ConnectionFilters.jsx:34 | COMPLEX | 2h |
| 5 | **RESPONSIVE** | **320×480: bottom UI consumes 46% of viewport** — Timeline + filters + safe area = ~220px of 480px. Map barely interactive on smallest phones. | Same as above | COMPLEX | (same fix as #4) |

---

## TIER 2: HIGH — Significant UX problems

| # | Category | Issue | File(s) | Complexity | Time |
|---|----------|-------|---------|-----------|------|
| 6 | **VISUAL** | **Timeline range bar overlaps year labels** — Range overlay ends at bottom 12-14px, year labels start at bottom 0-16px. Only 2-4px separation. User-reported issue confirmed. | Timeline.jsx:576-588, 685-721 | STANDARD | 1h |
| 7 | **RESPONSIVE** | **Timeline histogram padding 80px on tiny screens** — `padLeft + padRight = 80px` hardcoded. At 320px, only ~40px remains for the actual slider. Functionally broken. | Timeline.jsx:109-111, 234-235 | STANDARD | 30min |
| 8 | **VISUAL** | **Artist name collides with back+close buttons** — `paddingRight: 36px` but when back button is visible, buttons consume 108px. Long names overlap. | DetailPanel.jsx:682-694, 569 | STANDARD | 15min |
| 9 | **RESPONSIVE** | **Reset button overlaps ArtistCount on notched devices** — Reset at fixed `top: 100`, ArtistCount at `calc(56px + safe-area-top)` extends to ~115px on notched phones. Direct overlap. | App.jsx:572-573, ArtistCount.jsx:24 | STANDARD | 15min |
| 10 | **RESPONSIVE** | **Hardcoded filter positioning (168px, 108px, 72px, 128px)** — Filter bars use hardcoded bottom offsets that assume fixed heights. Any content wrapping or font change breaks positioning. | GenreFilters.jsx:46, ConnectionFilters.jsx:34 | COMPLEX | 2h |
| 11 | **UX** | **Auto-expand timeline + mode switch is disorienting** — Selecting an artist outside range silently expands timeline AND switches Year→Range mode. Double state change with no explanation. | App.jsx:319-333, Timeline.jsx:69-73 | STANDARD | 30min |
| 12 | **RESPONSIVE** | **Genre filter scroll affordance barely noticeable on mobile** — 24px fade gradient is the only hint that horizontal scrolling is available for 8 genre pills. | GenreFilters.jsx:182-210 | STANDARD | 30min |
| 13 | **A11Y** | **No zoom buttons on map** — No +/- controls for users without scroll wheel, trackpad, or pinch capability. Motor impairment accessibility gap. | Map.jsx | STANDARD | 30min |
| 14 | **A11Y** | **Timeline mode toggle 36px height** — Year/Range radio buttons have `height: 36` regardless of pointer type. Below 44px WCAG touch minimum. | Timeline.jsx:349-350, 380-381 | TRIVIAL | 5min |

---

## TIER 3: MEDIUM — Should fix

| # | Category | Issue | File(s) | Complexity | Time |
|---|----------|-------|---------|-----------|------|
| 15 | **UX** | **City click always flies to zoom 13** — Overshoots for large cities (NYC with 200 artists) and small villages alike. Should adapt based on city artist count. | CanvasOverlay.jsx:1283 | STANDARD | 30min |
| 16 | **UX** | **Last-filter-standing silent failure** — Trying to deselect the last genre/connection type does nothing with no feedback. User thinks the click didn't register. | App.jsx:258-269, 277-282 | STANDARD | 20min |
| 17 | **UX** | **No re-click deselect** — Clicking an already-selected artist does not deselect them. Only close button, Escape, or clicking empty map deselects. | App.jsx:297-314 | STANDARD | 15min |
| 18 | **UX** | **Editable year labels look like plain text** — Year numbers in range mode are clickable buttons styled with no visual affordance (no underline, no edit icon). Not discoverable. | Timeline.jsx:762-835 | STANDARD | 20min |
| 19 | **VISUAL** | **Slider handles overlap completely at narrow ranges** — At 10-year range on 320px, both 44px handles occupy the same pixel. Neither has priority (both z-index 5). | Timeline.jsx:591-682 | STANDARD | 30min |
| 20 | **VISUAL** | **Editable year buttons overflow above timeline** — `minHeight: 44` buttons at `bottom: 16` in a 44-52px tall bar. Buttons extend into map area. | Timeline.jsx:762-778, 819-835 | STANDARD | 20min |
| 21 | **VISUAL** | **Z-index conflicts** — Search dropdown (21) and mobile filters toggle (21) share z-index. Four elements share z-index 20 (SearchBar, GenreFilters, ConnectionFilters, Timeline). | Multiple | STANDARD | 15min |
| 22 | **VISUAL** | **Inconsistent border-radius** — Mix of 8, 10, 12, 16, 20, 999px with no system. | Multiple | STANDARD | 20min |
| 23 | **RESPONSIVE** | **DetailPanel mobile bottom offset hardcoded 80px** — Doesn't account for variable timeline height `clamp(44px, 6vw, 52px)`. Can leave gaps or overlaps. | DetailPanel.jsx:467 | STANDARD | 15min |
| 24 | **RESPONSIVE** | **iPad landscape (1024px touch) gets mobile layout** — Full-width bottom-sheet wastes the 1024px screen. Should use desktop sidebar. | App.jsx:79 | STANDARD | 15min |
| 25 | **RESPONSIVE** | **Filter panel maxHeight 200px = 42% of 480px viewport** — On smallest phones, expanded filters overwhelm the screen. | App.jsx:640-641 | STANDARD | 15min |
| 26 | **A11Y** | **10px font throughout** — SearchBar result subtitle (10px), DetailPanel section headers (10px), pipeline badges (10px), connection type labels (10px). Below legibility minimum. | SearchBar.jsx:345, DetailPanel.jsx:63,83,738,804 | STANDARD | 15min |
| 27 | **A11Y** | **"Show more" buttons 36px on touch** — `minHeight: 36` always, not gated on `isPointerFine`. Below 44px. | DetailPanel.jsx:261,275 | TRIVIAL | 5min |
| 28 | **A11Y** | **Timeline mode toggle font 11px** — Below the project's own minimum after the recent typography pass. | Timeline.jsx:354,389 | TRIVIAL | 5min |
| 29 | **A11Y** | **SearchBar input type="text" should be "search"** — Skip-to-search link targets `input[type="search"]` but actual input is type="text". Skip link is BROKEN. Mobile keyboard shows "return" instead of "search". | SearchBar.jsx:196, Map.jsx:101 | TRIVIAL | 5min |
| 30 | **RESPONSIVE** | **Timeline slider handle height ~32px on smallest screens** — Handle goes top:0 to bottom:12 in a 44px bar = 32px. Below 44px touch target. | Timeline.jsx:613-624 | STANDARD | 15min |
| 31 | **UX** | **Mobile filter auto-expand is invisible** — Selecting an artist auto-adds their genre to filters, but the filter panel is collapsed on mobile. User doesn't see the change. | App.jsx:297-314 | STANDARD | 15min |
| 32 | **RESPONSIVE** | **SearchBar dropdown may overlap ArtistCount on mobile** — Both positioned top-left area, search dropdown z-index 21 vs ArtistCount z-index 10. Technically stacks correctly but visually confusing. | SearchBar.jsx, ArtistCount.jsx | STANDARD | 10min |
| 33 | **VISUAL** | **DetailPanel image maxHeight 260px too large for mobile** — On mobile bottom sheet, 260px image pushes all metadata below fold. | DetailPanel.jsx:651-658 | STANDARD | 10min |
| 34 | **RESPONSIVE** | **Reset button missing safe-area-inset-left** — `left: 16px` can be behind notch on iPhone landscape. | App.jsx:571-573 | TRIVIAL | 5min |

---

## TIER 4: LOW — Polish

| # | Category | Issue | File(s) | Complexity | Time |
|---|----------|-------|---------|-----------|------|
| 35 | **UX** | **No cluster hover feedback** — Cursor stays default when hovering clusters at zoom <5. No tooltip showing cluster size. | CanvasOverlay.jsx | STANDARD | 30min |
| 36 | **UX** | **No empty state when filters yield 0 artists** — Map shows nothing, ArtistCount shows "0 artists" but no helpful message. | App.jsx | STANDARD | 20min |
| 37 | **UX** | **No "show all years" shortcut on timeline** — Must drag both handles to extremes. Global Reset button exists but requires discovering it. | Timeline.jsx | STANDARD | 20min |
| 38 | **VISUAL** | **Year label hide threshold is year-based not pixel-based** — Labels hidden when within 15 years of handle. At different screen widths, 15 years = vastly different pixel distances. | Timeline.jsx:698-700 | STANDARD | 20min |
| 39 | **VISUAL** | **Contradictory height + minHeight on year inputs** — `height: 24` + `minHeight: 44`. minHeight always wins. Dead code. | Timeline.jsx:755,770,812,827 | TRIVIAL | 5min |
| 40 | **VISUAL** | **Close button decorative shadow lost after focus/blur** — `onBlur` sets boxShadow to 'none', losing the original decorative shadow permanently. | DetailPanel.jsx:611-616 | TRIVIAL | 5min |
| 41 | **A11Y** | **ConnectionCard focus style triggers on click, not keyboard** — Missing `:focus-visible` guard unlike other buttons. | DetailPanel.jsx:152-153 | TRIVIAL | 5min |
| 42 | **A11Y** | **Warning dismiss button missing focus-visible pattern** — Different from all other buttons in the app. | App.jsx:517-536 | TRIVIAL | 5min |
| 43 | **A11Y** | **Error boundary vs App error screen different button styles** — Two completely different visual treatments for the same reload action. | main.jsx:24, App.jsx:457-467 | TRIVIAL | 10min |
| 44 | **VISUAL** | **Hardcoded "31,069" in loading screen** — Will drift as data changes. | App.jsx:435 | TRIVIAL | 5min |
| 45 | **VISUAL** | **Hardcoded "31,069" in meta description** — Same staleness problem. | index.html:7 | TRIVIAL | 5min |
| 46 | **UX** | **DetailPanel role="complementary" instead of role="dialog"** — Weaker focus containment for screen readers. | DetailPanel.jsx | STANDARD | 15min |
| 47 | **UX** | **Play speed fixed with no control** — 2s intervals, 10-year steps. No fast/slow option. | Timeline.jsx | STANDARD | 30min |

---

## SUMMARY

| Severity | Count | Est. Time |
|----------|-------|-----------|
| **CRITICAL** | 5 | ~11h |
| **HIGH** | 9 | ~6h |
| **MEDIUM** | 20 | ~5h |
| **LOW** | 13 | ~3.5h |
| **TOTAL** | **47** | **~25.5h** |

---

## TOP 5 HIGHEST-IMPACT FIXES

1. **Fix the artist count inconsistency (#3)** — 30min. Three numbers for one concept. Easy fix, embarrassing bug.
2. **Add onboarding/legend/hints (#1)** — 4-6h. Without this, the app is a beautiful mystery to first-time users.
3. **Reduce clicks to see a musician (#2)** — 2-3h. Change city click from zoom 13→10, add cluster double-click, add zoom buttons, make search more prominent.
4. **Fix timeline range/year overlap (#6)** — 1h. User-reported visual issue. Increase separation between range bar and year labels.
5. **Fix landscape phone layout (#4)** — 2h. Detect landscape and use side-panel layout instead of bottom-stack mobile layout.

---

## WHAT'S WORKING WELL

- Search UX: fast, keyboard-navigable, global shortcuts (/+Cmd+K), searches all artists regardless of filters
- Genre shape markers for colorblind support
- Connection grouping with show-more pattern
- Progressive disclosure on mobile (collapsed filters)
- Focus trap + Escape-to-close on DetailPanel
- Swipe-to-dismiss on mobile panel
- `prefers-reduced-motion` respected throughout
- 44px touch targets on most elements
- Artist auto-expand for timeline and genre filters
- Back button history in DetailPanel (max 10 entries)
- Comprehensive ARIA: combobox search, slider timeline, live regions, skip links
