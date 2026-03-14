# EMBRYO Phase 4 — Codex Implementation Prompt

## Project Context

EMBRYO (embryo.wiki) is an interactive map of 31K+ musicians showing teacher/student, influence, peer, and collaboration connections across centuries of music history.

**Stack**: React 19.2 + Vite 7.3 + MapLibre GL JS (WebGL map) + Canvas 2D overlay (custom rendering) + Supercluster (spatial indexing) + Fuse.js (search). All styles are inline JS objects — no CSS files, no Tailwind. Fonts: DM Sans (body), Instrument Serif (display). Colors: cream #FAF3EB, dark #3E3530, accent #B8336A/#C4366F. Deployed to Cloudflare Pages via `npx wrangler pages deploy dist`.

**Architecture**: Single-page React app. MapLibre renders the base map tile layer. A transparent `<canvas>` overlays the map for all artist/cluster/connection rendering via Canvas 2D API. Three rendering modes based on zoom: cluster (z<5), city (z5-9), individual (z>=9) with cross-fade transitions.

## File Map (18 source files, ~7K lines)

### Core Rendering
- `src/components/CanvasOverlay.jsx` (~2000 lines) — Main render loop. Three-tier zoom rendering (cluster/city/individual), cross-fade alpha, Supercluster integration, hit testing, arc rendering, particle animation, label collision detection, density budgeting. This is the performance-critical file.
- `src/utils/rendering.js` (~295 lines) — Canvas drawing primitives: `drawOrb()`, `drawArtistNode()`, `drawCityGroup()`, `drawArcParticle()`, `preRenderOrbTexture()`, `createGrainTexture()`, `hexToRgba()`.
- `src/utils/cityGrouping.js` (~77 lines) — Groups artists by birth city for city-mode rendering. Returns Map keyed by "city|lat|lng".
- `src/utils/genres.js` — Genre bucket definitions with colors: Classical=#B8336A, Jazz=#D4A574, Rock=#E07A3A, Electronic=#C77DBA, Hip-hop=#D4A438, Pop=#D88B8B, Other=#A89080.

### Data Layer
- `src/hooks/useArtistData.js` — Loads `/data/artists_final.json` (31K entries, ~13MB). Validates coordinates (lat/lng bounds, null island rejection). Returns filtered artist array.
- `src/hooks/useConnectionData.js` — Loads `/data/connections_final.json`. Returns connection array + connectionsByArtist Map + connectionCounts Map.
- `public/data/artists_final.json` — 31K artist objects: `{name, birth_year, death_year, birth_city, birth_country, genres[], education, id, birth_lat, birth_lng, active_start, active_end, wikipedia_url, image_url}`.
- `public/data/connections_final.json` — Connection objects: `{source_id, target_id, type, confidence, source}`. Types: teacher, influence, peer, collaboration.

### UI Components
- `src/App.jsx` (~780 lines) — Root component. State management for activeArtist, hoveredArtist, timeline, genres, connections. Renders Map + all overlay components.
- `src/components/Map.jsx` — MapLibre GL wrapper. Zoom controls (+/-/home), style switcher, passes map ref to CanvasOverlay.
- `src/components/SearchBar.jsx` (~465 lines) — Fuse.js search with connection-count boosting, surname bonus. `keys: ['name']`, threshold 0.4. Keyboard nav (arrow keys + Enter). React.memo wrapped.
- `src/components/DetailPanel.jsx` (~890 lines) — Artist detail panel. Desktop: right sidebar with clamp() width. Mobile: full-screen takeover with drag-to-dismiss. Shows connections grouped by type with confidence bars, Wikipedia link. React.memo wrapped.
- `src/components/HoverCard.jsx` — Desktop-only tooltip near cursor: name, genre dot, lifespan, connection count. pointer-events: none, edge-aware positioning.
- `src/components/GenreFilters.jsx` (~256 lines) — Genre toggle buttons with Unicode shape indicators (●◆▲■★♥✦) for colorblind accessibility. aria-pressed, focus-visible. React.memo wrapped.
- `src/components/ConnectionFilters.jsx` (~199 lines) — Connection type toggle buttons with counts. Same a11y pattern as GenreFilters.
- `src/components/Timeline.jsx` (~700+ lines) — Dual-mode timeline: Year (single pin) or Range (two handles). SVG histogram of artist density per decade. Play/animate mode. Icons for mode toggle.
- `src/components/OnboardingOverlay.jsx` — 4-step first-visit walkthrough stored in localStorage.
- `src/components/GenreLegend.jsx` — Collapsible genre legend with color dots + shapes.

### Hooks
- `src/hooks/useIsPointerFine.js` — Detects fine vs coarse pointer (mouse vs touch) for hit-test radius scaling.

### Config
- `.claude/launch.json` — Dev server config: `npm run dev` on port 5199.
- `vite.config.js` — React plugin, port 5199.

## What Phases 1-3 Already Implemented

- OnboardingOverlay, genre legend, search prominence, deep links (hash-based), connection-weighted dot sizes
- Cluster labels with density budget + collision detection, connection arcs (top 15 by confidence), connected artist highlight, hover card, smart cluster zoom, full-screen mobile detail
- Genre-colored city circles at city zoom (radial gradient fill)
- Comprehensive ARIA: aria-pressed, aria-live regions, aria-labels, focus-visible, 44px touch targets, reduced-motion, genre shapes for colorblind
- Label collision detection at all zoom levels (cluster, city, individual)
- Canvas state resets between render phases, rAF idle stop

## Phase 4 Objectives

Implement the following features. Each is independent and can be done in any order:

### 1. WebGL Rendering Upgrade (~24h)
**Goal**: Move dot/orb rendering from Canvas 2D to WebGL for smooth interaction with all 31K artists visible.
**Approach**: Use deck.gl ScatterplotLayer (or custom WebGL shaders) for artist dots. Keep Canvas 2D overlay for labels, arcs, and text — WebGL handles points only. The current `preRenderOrbTexture()` creates offscreen canvases per genre color — replace with GPU-instanced rendering using the same color palette. Must maintain the three-tier zoom rendering and cross-fade behavior. Profile before/after: target 60fps at zoom levels where >5K artists are visible.
**Files**: CanvasOverlay.jsx (major refactor — split point rendering to WebGL layer), rendering.js (keep label functions, remove orb functions if migrated), Map.jsx (add deck.gl overlay layer if using deck.gl).
**Constraints**: Must not regress accessibility (aria-labels, live regions), hit testing (must still work for hover/click), or visual aesthetic (orb gradients, genre colors).

### 2. Artist Comparison View (~8h)
**Goal**: Side-by-side panels comparing two artists' connections, timelines, locations, genres.
**Approach**: New ComparisonView.jsx component. User selects two artists (second selection via "Compare" button in DetailPanel). Split view: left and right panels with shared connections highlighted in the middle. Timeline overlap visualization showing both artists' active periods. Shared genres/locations marked. On mobile, stack vertically with tabs.
**Files**: ComparisonView.jsx (new), DetailPanel.jsx (add "Compare" button), App.jsx (comparison state management).

### 3. Audio Integration (~12h)
**Goal**: 30-second music previews in the detail panel using Spotify embed API.
**Approach**: Match artists by name + genre to Spotify catalog via Spotify Web API search endpoint. Show embedded player (iframe) in DetailPanel when match found. Cache Spotify IDs in localStorage to avoid repeated API calls. Graceful fallback: "Listen on Spotify" link when embed fails. No autoplay. Must handle: artist name variations (e.g., "J.S. Bach" vs "Johann Sebastian Bach"), classical vs popular catalog differences, rate limiting.
**Files**: DetailPanel.jsx (embed player section), hooks/useSpotifyMatch.js (new — search + cache logic), .env (SPOTIFY_CLIENT_ID).
**Note**: Requires a Spotify Developer account and client ID. The client credentials flow (no user auth) is sufficient for search + 30s previews.

### 4. Connection Graph Mini-View (~16h)
**Goal**: Force-directed graph in a panel showing 2-hop connections from selected artist.
**Approach**: When an artist is selected, fetch their connections + connections-of-connections (2 hops). Render as a force-directed graph using d3-force (already a common dependency) in a resizable panel. Nodes colored by genre, edges colored by connection type. Click a node to navigate to that artist on the map. On mobile, full-screen overlay. Performance budget: max 200 nodes in the graph (limit hops if needed).
**Files**: ConnectionGraph.jsx (new), hooks/useConnectionGraph.js (new — 2-hop traversal logic), DetailPanel.jsx (toggle button), App.jsx (graph panel state).

### 5. Community Contribution System (~4h+)
**Goal**: "Suggest a correction" button per artist that opens a pre-filled form.
**Approach**: Button in DetailPanel opens a form/modal with artist name + ID pre-filled. Fields: correction type (wrong info, missing connection, not a musician, other), description, user email (optional). Submissions go to a Google Form or GitHub issue template (via `window.open` with pre-filled URL params — no backend needed). Store "already suggested" in localStorage to prevent spam.
**Files**: DetailPanel.jsx (button + form trigger), SuggestionForm.jsx (new — modal with form fields).

### 6. Genre Density Heat Map at Mid-Zoom (~8h)
**Goal**: Subtle genre-colored heat overlay at zoom 4-6 showing where musical traditions cluster geographically.
**Approach**: At zoom 4-6, render a heatmap layer on the canvas using genre-colored gaussian blobs at each artist's position. Use the existing `artistMeta` genre color mapping. Intensity based on artist density. Fades in at z4, full at z5, fades out at z7. Must not obscure cluster labels or city circles. Render BEFORE clusters (behind them). Performance: pre-compute density grid, don't iterate all 31K artists per frame.
**Files**: CanvasOverlay.jsx (new render phase between clear and cluster phase), utils/heatmap.js (new — density grid computation, cached).

### 7. Lazy Connection Loading (~8h)
**Goal**: Load connections on demand when an artist is selected, not all upfront.
**Approach**: Split `connections_final.json` into per-artist chunks at build time (script). On artist select, fetch `/data/connections/{artist_id}.json`. Cache in memory. Update connectionsByArtist Map incrementally. Must handle: prefetching connected artists' connections for 2-hop display, race conditions when user selects rapidly, offline/error fallback to pre-loaded data if available.
**Files**: useConnectionData.js (major refactor — lazy loading + caching), scripts/split_connections.py (new — build-time splitting), App.jsx (loading state for connections).

## Development Rules

- All styles inline JS objects — no CSS files, no Tailwind, no styled-components
- Fonts: `"DM Sans", sans-serif` (body), `"Instrument Serif", serif` (display headings)
- Colors: cream `#FAF3EB` (background), dark `#3E3530` (text), accent `#B8336A`/`#C4366F` (interactive)
- WCAG 2.2 AA: 4.5:1 contrast, 44px touch targets, aria-labels on all interactive elements, focus-visible
- Mobile-first: test at 375px width. DetailPanel is full-screen on mobile. Use clamp() for responsive sizing.
- No unnecessary dependencies — check if the existing stack can handle it before adding packages
- Canvas rendering must maintain 60fps. Profile any render loop changes.
- Build with `npx vite build`. Deploy with `npx wrangler pages deploy dist --project-name=embryo-wiki --commit-dirty=true`.
- Dev server: `npm run dev` on port 5199

## Execution Order (Recommended)

1. **Community Contributions** (4h) — smallest, independent, ships fast
2. **Artist Comparison** (8h) — new component, no perf risk
3. **Genre Heat Map** (8h) — canvas addition, moderate complexity
4. **Lazy Connections** (8h) — data layer refactor, test thoroughly
5. **Audio Integration** (12h) — external API dependency, needs Spotify credentials
6. **Connection Graph** (16h) — largest new component, d3-force integration
7. **WebGL Upgrade** (24h) — highest risk, save for last, needs extensive profiling
