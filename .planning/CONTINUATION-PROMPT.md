# EMBRYO — Continuation Prompt (Session 7)

Paste this entire block into a new Claude Code conversation.

---

## Prompt

```
/agent-team Continue work on EMBRYO — an interactive map of 31K classical-to-contemporary artists at embryo.wiki.

## Project Location
Working directory: /Users/flork/Documents/embryo
Branch: main
Deploy: npx wrangler pages deploy dist --project-name=embryo-wiki --commit-dirty=true
Dev server: embryo-dev (port 5173, defined in .claude/launch.json)

## Tech Stack
- React 19.2 + Vite 7.3 SPA
- MapLibre GL JS via react-map-gl/maplibre
- Canvas 2D overlay (CanvasOverlay.jsx, ~1600 lines) for all visualization
- Supercluster for geographic clustering
- Fuse.js for fuzzy search
- Cloudflare Pages hosting at embryo.wiki
- No Tailwind (removed). All styles are inline JS.
- Fonts: DM Sans (UI), Instrument Serif (accents)

## What Just Happened (Sessions 5-6)
- Fixed 29 Codex-found bugs (TDZ crash, filter pipeline, a11y, spatial, perf)
- Phase 1 visual modernization: desktop-aware sizing via useIsPointerFine hook, canvas node modernization (cluster radii halved, orb opacity 0.85, zoom thresholds lowered ZOOM_CITY=5 ZOOM_INDIVIDUAL=9), timeline compacted to 44-52px with new year mode toggle
- Fixed invisible cluster orbs (opacity was too low), search dropdown oval shape (borderRadius 999px→16px), Fuse.js threshold (0.3→0.15)
- All deployed to embryo.wiki

## Current State / Known Issues
Read .planning/CHECKPOINT.md and .planning/TASKS.md for full audit findings.

Key remaining issues:
1. **Data enrichment running on Codex** — 88.6% of artists have 0 connections. Connection data is being enriched (was ~2hrs away as of session 6). Check if enriched data is ready.
2. **Search results still imperfect** — "moza" returns Karl Mozart first but also Gito Baloi (Mozambique city match). Could use smarter ranking (name matches above city matches).
3. **borderLeft/border React 19 warnings** — 42 console warnings about style property conflicts. Dev-only, doesn't affect prod. Source needs tracing and fixing.

## Remaining Tasks from TASKS.md (prioritized)

### HIGH PRIORITY — Performance & Canvas
- Task 1: Viewport culling in individual mode (don't iterate all 31k), rAF idle stop, canvas state reset
- Task 2: Hit-test DPR scaling, keyboard nav visible-only
- Task 6: City-mode label density budgeting (some done in session 6 — verify)
- Task 8: One filter pipeline (some done in session 6 — verify what's left)

### MEDIUM — Accessibility
- Task 3: aria-pressed on filter toggles, :focus-visible indicators, live regions
- Task 4: Canvas live region announcements for hover/select
- Task 9: Non-color genre cues (pattern/icon/shape for colorblind users)

### MEDIUM — Responsiveness
- Task 5: clamp()-based sizing for overlays, progressive disclosure on small screens

### LOW — Data
- Task 7: Coordinate validation at ingest (useArtistData.js)

## Big Picture / Long-Term Vision

EMBRYO is meant to become a public wiki/encyclopedia of musical connections:
- **embryo.wiki** — the live site, a visual map showing how 31K+ artists connect through teacher/student, influence, peer, and collaboration relationships
- **Goal**: Make the invisible web of musical influence visible and explorable. A user should be able to start at Bach, follow connections to his students, see how traditions branched through centuries, and end up at modern electronic artists — all on one interactive map.
- **Data enrichment**: The dataset is being actively expanded via Codex. Currently 88.6% of artists have 0 connections — this will improve dramatically as enrichment completes. The connection types are: Teacher, Influence, Peer, Collab.
- **Future features** (deferred, not for this session):
  - Onboarding/tutorial for first-time visitors
  - Lineage chains (trace teacher→student paths across generations)
  - Mobile drag handle for DetailPanel
  - Virtualized DetailPanel for artists with many connections
  - Eventually: user contributions, citation system, editorial workflow

## Rules
- NO dark mode (explicitly ruled out)
- WCAG 2.2 AA strict (44px touch targets, 4.5:1 contrast)
- Use useIsPointerFine hook for desktop vs mobile sizing (not breakpoints)
- Use subagent-driven development for execution
- Use the frontend-design skill for any UI/UX work
- Use the brainstorming skill before creative/design decisions
- Commit frequently, deploy after each major batch
- Data is in public/data/artists.json and public/data/connections.json
```

---
