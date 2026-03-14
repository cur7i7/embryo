# CHECKPOINT — Session 7 Bug Fix Sprint (2026-03-14)

## Status: 18 bugs fixed, deployed, 5 items remaining

## Completed (all committed f0f21f4, deployed to Cloudflare Pages)

| # | Severity | Fix | File(s) |
|---|----------|-----|---------|
| 1 | CRITICAL | vercel.json excludes /data/ and /assets/ from SPA rewrite | vercel.json |
| 2 | CRITICAL | Spotify client secret env var renamed to non-VITE prefix | useSpotifyMatch.js |
| 3 | CRITICAL | Canvas DPR resize uses Math.round() | CanvasOverlay.jsx:241 |
| 4 | HIGH | connectionCounts fallback {} → new Map() | App.jsx:716 |
| 5 | HIGH | Singleton city filter <2 → <1 | cityGrouping.js:56 |
| 6 | HIGH | Speed control wired through reducer + interval | App.jsx + Timeline.jsx |
| 7 | HIGH | Hover position throttled via rAF | App.jsx:387 |
| 8 | HIGH | Focus traps + Escape close on 3 modals | ComparisonView, SuggestionForm, JourneyPicker |
| 9 | MEDIUM | WCAG contrast #9A8E85→#6B5F55, font 11→12 | JourneyPlayer, NearbyArtists |
| 10 | MEDIUM | Touch targets raised to 44px min | JourneyPlayer, ComparisonView |
| 11 | MEDIUM | SearchBar connectionCounts added to deps | SearchBar.jsx:94 |
| 12 | MEDIUM | Swipe handlers attached to mobile panel | DetailPanel.jsx |
| 13 | MEDIUM | Duplicate display key removed (mobile close btn) | DetailPanel.jsx:648 |
| 14 | MEDIUM | Timeline ref read → useLayoutEffect + ResizeObserver | Timeline.jsx:757 |
| 15 | LOW | Loading copy "30,000+" removed | App.jsx, OnboardingOverlay.jsx |
| 16 | LOW | Tooltip node cleanup on unmount | CanvasOverlay.jsx |
| 17 | LOW | Supercluster maxZoom 16→20, co-location offset floor 0.5 | CanvasOverlay.jsx |
| 18 | LOW | Orb gradient opacity boosted (core CC→FF, mid 66→88) | rendering.js |

## Data
- Cleaned dataset: 17,288 musicians (31K raw → cleanup_nonmusicians.mjs → cleanup_artists.mjs)
- NEVER deploy the raw 31K. Always run both cleanup scripts if regenerating data.
- connections: 17,017

## Remaining Tasks

### P0 — Must verify
1. **Cluster orbs visibility** — User saw no orbs at z~5. Tooltip worked (canvas hit-test OK), but no visual orbs rendered. Opacity was boosted in rendering.js but not verified in real browser. Investigate: is the canvas element (z-index:1) being covered by MapLibre's WebGL canvas? Test at z=2 (clusterAlpha=1, should be fully visible) and z=5 (crossfade zone, clusterAlpha=0.5). If orbs still invisible, check whether orbTextures array is populated and whether drawImage actually paints pixels.

### P1 — Should fix
2. **Mobile end-to-end** — "Almost nothing works on mobile." Swipe and touch targets were fixed but not tested on real device or at 375px. Test: DetailPanel swipe-to-dismiss, search, filters, timeline.
3. **Lint cleanup** — 14 errors + 4 warnings from `npm run lint`. Mostly Timeline setState-in-effect and unused vars.

### P2 — Nice to have
4. **Cluster/city label caching** — getLeaves()+sort per frame. Cache per Supercluster rebuild. CanvasOverlay.jsx:678-699, 888-899.
5. **Zoom threshold alignment** — ZOOM_CITY=5, ZOOM_INDIVIDUAL=9 in code vs different values in product docs.

## Key Decisions
- Orb texture opacity boosted (core 80%→100%) to survive 50% crossfade alpha
- Spotify feature disabled (secret won't bundle) — needs server-side proxy to re-enable
- Data cleaning scripts are authoritative — raw 31K in git history is NOT the production dataset
- Co-location offset formula was going negative at zoom>16, fixed with floor of 0.5

## Deploy
```
cd /Users/flork/Documents/embryo
npm run build && npx wrangler pages deploy dist --project-name=embryo-wiki --commit-dirty=true
```

## Git
- Repo: cur7i7/embryo (GitHub)
- Latest: f0f21f4 on main
- Branch: main only

## Continuation Prompt
Continue EMBRYO at `/Users/flork/Documents/embryo`. Read `.planning/CHECKPOINT.md`. Priority #1: verify cluster orbs are actually visible in a real browser at z=2 and z=5. If invisible, debug the canvas rendering pipeline — the hit-test works so clusters exist, but drawImage may not be painting. Priority #2: mobile testing at 375px. Deploy via `npx wrangler pages deploy dist --project-name=embryo-wiki --commit-dirty=true`.
