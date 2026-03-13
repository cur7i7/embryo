# EMBRYO Strategic Roadmap

> Last updated: 2026-03-13
> Scope: 31K+ musician interactive map — React 19 + Vite 7 + MapLibre GL + Canvas 2D + Supercluster

---

## What's Holding the Project Back

### 1. Discovery & Onboarding

| Problem | Impact | Proposed Solution | Complexity | Time Est |
|---------|--------|-------------------|-----------|----------|
| New users see colored orbs with no explanation | Bounce rate — users leave within seconds because nothing is labeled | **OnboardingOverlay** (3-4 step walkthrough on first visit) | Low | 2h (DONE) |
| Returning users still have no persistent legend | Genre colors are meaningless without the filter bar visible | **Persistent legend chip** in the top-left corner — small, always-visible genre key with color dots + shape symbols | Low | 3h |
| No editorial hook to pull users in | The map is data without narrative — nothing says "start here" | **Featured artist of the day** banner: curated or random notable artist shown on load with "Explore" CTA | Medium | 6h |
| No contextual tooltips for UI elements | Users don't know what the timeline, filters, or search hotkey do | **First-use tooltips**: small popovers that appear once per UI element (stored in localStorage), dismissed on click | Medium | 4h |

### 2. Navigation Friction

| Problem | Impact | Proposed Solution | Complexity | Time Est |
|---------|--------|-------------------|-----------|----------|
| 5-6 clicks to reach an individual artist from full zoom-out | Users give up before finding anyone | **Smarter cluster zoom**: click a cluster to zoom to its bounds instead of fixed +2 zoom, reaching artists in 2-3 clicks max | Medium | 4h |
| Search bar is subtle and easy to miss | The primary way to find a specific artist is nearly invisible | **Search prominence**: larger default size, pulsing hint on first load, always show placeholder text "Search 30,000+ artists..." | Low | 2h |
| No URL deep links to artists | Users can't share discoveries — "look at this artist" requires manual navigation | **Shareable deep links**: encode artist ID + zoom + center in URL hash (partially done — needs artist name in hash for readability + social preview meta tags) | Medium | 4h |
| No "nearby artists" when zoomed in | At high zoom, isolated dots with no context about neighbors | **Viewport artist list**: small collapsible panel showing artists currently visible on screen, sorted by connection count | Medium | 6h |

### 3. Data Density

| Problem | Impact | Proposed Solution | Complexity | Time Est |
|---------|--------|-------------------|-----------|----------|
| Mid-zoom is either empty space or dot soup | No useful information layer between cluster view and individual view | **Cluster labels**: render top 2-3 artist names on cluster markers instead of just a count number | Medium | 6h |
| No visual hierarchy at medium zoom | All dots are the same size regardless of significance | **Connection-weighted dot sizes**: artists with more connections get slightly larger dots, creating visual anchors | Low | 3h |
| Genre boundaries are invisible | Users can't see where "jazz" ends and "classical" begins | **Density heat map at mid-zoom**: subtle genre-colored heat overlay that fades in at zoom 4-6, fades out at zoom 7+ | High | 8h |
| No progressive disclosure of artist info | You see nothing until you click — no hover preview | **Hover card**: lightweight tooltip showing name + genre + lifespan + connection count on pointer hover (desktop only) | Medium | 4h |

### 4. Connection Visualization

| Problem | Impact | Proposed Solution | Complexity | Time Est |
|---------|--------|-------------------|-----------|----------|
| Connections are only visible in the detail panel text list | The "map of connections" doesn't show connections on the map | **Connection arcs on map**: draw curved lines between connected artists at zoom >= 7, color-coded by type (teacher=warm, influence=cool, etc.) | High | 10h |
| No way to see an artist's network at a glance | You have to click each connected artist individually to understand the web | **Highlight connected artists**: when an artist is selected, pulse/glow their connected artists on the map | Medium | 5h |
| No graph view for exploring connection chains | Teacher-of-teacher chains are invisible | **Connection graph mini-view**: force-directed graph in a panel showing 2-hop connections from selected artist | High | 16h |

### 5. Performance at Scale

| Problem | Impact | Proposed Solution | Complexity | Time Est |
|---------|--------|-------------------|-----------|----------|
| All 31K artists loaded upfront as one JSON blob | ~4MB initial download, 3-8s load on slow connections | **Progressive loading**: split data by geographic quadrant, load visible viewport first, then expand | High | 12h |
| Canvas 2D rendering for all visible artists per frame | Smooth at 1K visible, choppy at 5K+ on low-end devices | **WebGL upgrade path**: move dot rendering to WebGL (via deck.gl or custom shaders), keep Canvas for labels | Very High | 24h |
| Supercluster recalculates on every filter change | Noticeable 100-300ms stutter when toggling genres | **Spatial index caching**: pre-build Supercluster indices per genre combination, swap instead of rebuilding | Medium | 6h |
| Connection data is a second large JSON file | Adds another 2-3MB to initial load | **Lazy connection loading**: load connections on demand when an artist is selected, cache by artist ID | Medium | 8h |

### 6. Mobile Experience

| Problem | Impact | Proposed Solution | Complexity | Time Est |
|---------|--------|-------------------|-----------|----------|
| Bottom sheet + small map = very cramped | Detail panel covers ~45% of the screen, leaving a tiny map window | **Full-screen detail view on mobile**: detail panel takes over the entire screen on mobile, with a "back to map" button | Medium | 4h |
| No gesture-based navigation for connections | Tapping each connected artist is tedious on mobile | **Swipe between connected artists**: horizontal swipe in the detail panel to move between connections like a card stack | Medium | 6h |
| Filter bar takes too much vertical space on mobile | Even collapsed, the filter toggle button is always present | **Sheet-based filters**: move all filters into a bottom sheet that opens from a single FAB button | Medium | 5h |
| Landscape phone is nearly unusable | 500px viewport height with bottom sheet leaves ~200px of map | **Landscape-aware layout**: side panel instead of bottom sheet when in landscape + constrained height (partially addressed but needs polish) | Low | 3h |

### 7. Content & Curation

| Problem | Impact | Proposed Solution | Complexity | Time Est |
|---------|--------|-------------------|-----------|----------|
| Raw data without editorial layer | The app feels like a database browser, not a discovery tool | **Curated journeys**: predefined paths through the data (e.g., "The evolution of Jazz", "Bach's teaching lineage") with narration text | High | 16h |
| No temporal storytelling | The timeline is a filter, not a narrative device | **Time-lapse animation mode**: watch music history unfold decade by decade with smooth map animation showing artists appearing/disappearing | High | 12h |
| No way to compare artists | Users often want to see two artists side by side | **Artist comparison view**: side-by-side panels comparing connections, timelines, locations, genres | Medium | 8h |
| No community input mechanism | Users notice missing connections but can't contribute corrections | **Suggestion form**: simple "suggest a correction" button on artist detail that opens a pre-filled GitHub issue or form | Low | 4h |

---

## What Would Make It Great

| Feature | Why It Matters | Implementation Approach | Priority | Time Est |
|---------|---------------|------------------------|----------|----------|
| **Curated Musical Journeys** | Transforms raw data into narrative experiences — "Bach to Beethoven to Brahms" becomes a story, not just dots on a map | JSON-defined journey files with waypoints (artist ID + narration text + zoom level). Journey player component with forward/back, auto-fly between waypoints, narration panel. | P2 | 16h |
| **Connection Arcs on Map** | The single most-requested missing feature — an app about connections should show them visually | At zoom >= 7, query visible artists, draw bezier curves on the Canvas overlay layer between connected pairs. Color by type, animate on hover. Cull arcs outside viewport. | P1 | 10h |
| **Time-Lapse Mode** | Makes the temporal dimension tangible — watching jazz emerge in New Orleans and spread outward is unforgettable | Animate the timeline range forward in configurable steps (decade/year). Smooth camera movements between geographic centers of activity. Overlay decade label. Pause on notable clusters. | P2 | 12h |
| **Artist Comparison** | Users frequently want to understand relationships between two specific artists they already know | Split detail panel into dual-pane mode. Shared connections highlighted. Timeline overlap visualization. Shared genres/locations marked. Diff-style view for their connection networks. | P3 | 8h |
| **Shareable Deep Links** | Viral growth mechanism — users share specific discoveries on social media, each link brings new visitors directly to the interesting part | Enhance existing hash-based URL state to include readable artist slug. Add Open Graph meta tags for social previews (artist name + genre as title/description). Server-side rendering for link previews would need a separate service. | P1 | 4h |
| **Cluster Labels** | Reduces "what is this blob?" confusion by showing actual names — users can see "Bach, Mozart, Beethoven" instead of "47" | Modify CanvasOverlay cluster rendering to pick top N artists (by connection count) from cluster.properties and render their names below the count. Truncate with ellipsis. Font size scales with cluster size. | P1 | 6h |
| **Search by Connection** | Power-user feature that enables relationship-based exploration — "Show me all students of Bach" | Extend search to support query syntax: `students:Bach`, `influences:Miles Davis`, `peers:Coltrane`. Parse in SearchBar, query connectionsByArtist, return filtered results. | P2 | 8h |
| **Audio Integration** | Hearing the music while reading about the artist creates an emotional connection to the data | Integrate Spotify/Apple Music embed API. Show 30s preview player in detail panel when available. Match artists by name + genre to music catalog. Graceful fallback when no match found. | P3 | 12h |
| **Community Contributions** | Scales data quality beyond what any single team can maintain — users are domain experts in their niches | "Suggest correction" button per artist. Opens a pre-filled form (or GitHub issue template) with artist name + ID. Moderation queue for reviewing submissions before merge. | P3 | 4h |
| **Progressive Data Loading** | Cuts initial load from 8s to under 2s — critical for retention | Tile-based artist data split by geographic quadrant + time period. Load viewport-relevant tiles first. Background-fetch remaining tiles. Supercluster rebuilt incrementally as tiles arrive. | P1 | 12h |

---

## Phased Execution Plan

### Phase 1 — Quick wins + critical fixes (next sprint)

| Item | WHY (user impact) | Est |
|------|-------------------|-----|
| Integrate OnboardingOverlay into App.jsx | First-time visitors finally understand what they're looking at — directly reduces bounce rate | 1h |
| Shareable deep links with readable artist slug | Users can share discoveries — every shared link is a potential new user | 4h |
| Search prominence improvements | The fastest path to any artist becomes obvious instead of hidden | 2h |
| Connection-weighted dot sizes | Creates visual hierarchy — notable artists stand out naturally without clicking | 3h |
| Persistent genre legend chip | Returning users can always decode what colors mean | 3h |

**Phase 1 total: ~13h**

### Phase 2 — Core experience improvements (1-2 weeks)

| Item | WHY (user impact) | Est |
|------|-------------------|-----|
| Cluster labels showing top artist names | "47" becomes "Bach, Mozart +45" — clusters become meaningful at a glance | 6h |
| Connection arcs on map (zoom >= 7) | The app's core promise (connections between musicians) becomes visible on the map itself | 10h |
| Highlight connected artists when one is selected | Selection becomes spatial — you can see the geographic spread of an artist's network | 5h |
| Hover card on desktop | Progressive disclosure — see basic info without committing to a click | 4h |
| Smarter cluster zoom (zoom to bounds) | Cuts navigation from 5-6 clicks to 2-3 clicks to reach any artist | 4h |
| Full-screen detail view on mobile | Detail reading experience goes from cramped to comfortable | 4h |

**Phase 2 total: ~33h**

### Phase 3 — Differentiating features (1 month)

| Item | WHY (user impact) | Est |
|------|-------------------|-----|
| Progressive data loading (viewport-first) | Load time drops from 8s to <2s — users see content before they can form the thought "this is slow" | 12h |
| Curated musical journeys (3-5 initial journeys) | Transforms the app from "explore this data" to "let me show you something amazing" | 16h |
| Time-lapse animation mode | The single most compelling demo — watching 600 years of music history unfold on a map | 12h |
| Search by connection type | Power users can ask the questions they actually have: "Who did Nadia Boulanger teach?" | 8h |
| Nearby artists viewport list | Zoomed-in exploration becomes browsable, not just point-and-click | 6h |
| Swipe between connected artists (mobile) | Mobile connection browsing goes from tedious tapping to fluid swiping | 6h |

**Phase 3 total: ~60h**

### Phase 4 — Aspirational vision

| Item | WHY (user impact) | Est |
|------|-------------------|-----|
| WebGL rendering upgrade | Enables smooth interaction with all 31K artists visible simultaneously — removes the performance ceiling | 24h |
| Artist comparison view | Side-by-side analysis for musicologists, educators, and curious users | 8h |
| Audio integration (Spotify/Apple Music previews) | Hearing the music while exploring creates emotional resonance that data alone cannot | 12h |
| Connection graph mini-view (force-directed) | Reveals the hidden structure of multi-hop teacher lineages and influence chains | 16h |
| Community contribution system | Scales data accuracy through crowd-sourced expertise — users are domain experts | 4h+ |
| Genre density heat map at mid-zoom | Shows the geographic "shape" of musical traditions — where jazz lives vs. where classical lives | 8h |
| Lazy connection loading (on-demand per artist) | Cuts initial payload by ~40% — connections only loaded when actually viewed | 8h |

**Phase 4 total: ~80h+**

---

## Key Dependencies & Risks

1. **Connection arcs + Canvas performance**: Drawing potentially hundreds of arcs at zoom 7+ could tank frame rate. Must implement viewport culling and limit visible arcs to ~50 nearest the center. Profile before shipping.

2. **Progressive loading breaks Supercluster**: Supercluster expects all points upfront. Incremental loading requires either (a) rebuilding the index as tiles arrive, or (b) switching to a streaming-compatible spatial index. Research needed.

3. **Curated journeys need editorial work**: The feature is technically straightforward but content creation (writing narration, selecting waypoints, testing the narrative flow) takes significant time per journey. Start with 3 well-crafted journeys, not 20 shallow ones.

4. **Audio integration licensing**: Spotify and Apple Music embed APIs have usage restrictions. The 30-second preview approach is standard for music discovery apps, but must verify terms of service compliance. Fallback: link to external player instead of embedding.

5. **Mobile layout rework**: Full-screen detail view and swipe navigation are individually straightforward but together represent a significant UX rearchitecture for mobile. Test on real devices early — simulator behavior diverges significantly for touch interactions.
