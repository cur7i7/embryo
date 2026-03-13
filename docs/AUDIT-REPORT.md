# EMBRYO — Total Audit Report
## Compared to: histography.io | mapofmetal.com | runningreality.org

**Date**: 2026-03-13
**Scope**: Read-only audit. No code changes.
**Goal**: What must change to publish embryo.wiki as a real product.

---

## EXECUTIVE SUMMARY

EMBRYO has a genuinely impressive canvas visualization engine and solid data foundations (31K musicians, 6K connections, map rendering with three-tier zoom). But compared to the reference products, it is a **visualization demo, not a web product**. The three reference sites all share traits EMBRYO lacks: linkable URLs, rich per-entity content, proper SEO, multiple navigation modes, and enough content depth that visitors spend minutes per entity instead of seconds.

**Overall Scores:**

| Dimension | Score | Reference Standard |
|---|---|---|
| Canvas/Visualization | 8/10 | Competitive with all three references |
| Data Completeness | 3/10 | Needs bios, works, full genres, countries |
| Feature Completeness | 3/10 | No routing, no wiki pages, no SEO |
| Visual Polish (UI chrome) | 5/10 | Canvas is polished; everything else is prototype |
| Wiki Readiness | 1/10 | Zero infrastructure |
| Deployment Readiness | 4/10 | Builds, but 21MB payload, no CI/CD |
| Mobile Readiness | 5/10 | Basic responsive, but touch UX has gaps |
| Accessibility | 6/10 | Good foundation from recent sprint, but gaps remain |

---

## PART 1: REFERENCE SITE COMPARISON

### What Each Reference Does That EMBRYO Doesn't

| Capability | histography.io | mapofmetal.com | runningreality.org | EMBRYO |
|---|---|---|---|---|
| Deep-linkable URLs | No | Yes (#/genre) | Yes (coords+year) | **No** |
| Rich per-entity content | Wikipedia popups | Descriptions + audio | Structured data + narrative | **Side panel only** |
| SSR / SEO | Static | Yes | Yes | **No (SPA only)** |
| Audio/media integration | N/A | Embedded player | N/A | **No** |
| Per-entity images | Wikipedia thumbnails | Genre illustrations | Map imagery | **Data exists (87%) but unused** |
| Social sharing / OG tags | Yes | Yes | Yes | **No** |
| Onboarding / tutorial | Animated intro | Instructional overlay | Landing page + guide | **No** |
| Multiple views / layouts | Timeline + zoom | Map + panels | Map + timeline + layers | **Map only** |
| Search depth | Category filters | Genre search | Full-text entity search | Name/city only |
| Loading experience | Cinematic animation | Quick load | Progressive tiles | **Plain text** |

### The Core Gap

The reference products all function as **knowledge tools** — visitors learn things. EMBRYO currently functions as a **data visualization** — visitors see things. The difference is content depth per entity:

- **histography.io**: Click any dot → title, date, description, image, Wikipedia link
- **mapofmetal.com**: Click any genre → multi-paragraph history, key bands, audio samples
- **runningreality.org**: Click any entity → dates, relationships, narrative, sources
- **EMBRYO**: Click any artist → name, year, maybe genre, maybe education, Wikipedia link. **~5 seconds of content before the user leaves to Wikipedia.**

---

## PART 2: DATA GAPS

### Field Population Rates (31,069 artists)

| Field | Populated | Rate | Impact |
|---|---|---|---|
| name | 31,069 | 100% | OK |
| id | 31,069 | 100% | OK |
| birth_lat/lng | 30,658 | 98.7% | OK |
| birth_city | 30,660 | 98.7% | OK |
| wikipedia_url | 30,958 | 99.6% | OK — but never linked in UI |
| wikidata_id | 31,058 | 100% | OK — unused |
| image_url | 26,962 | 86.8% | **OK but NEVER DISPLAYED** |
| birth_year | 30,957 | 99.6% | OK |
| death_year | 14,282 | 46.0% | Expected (living artists) |
| education | 16,946 | 54.5% | Sparse |
| genres | 16,792 | 54.0% | **CRITICAL — 46% become "Other"** |
| birth_country | 181 | 0.6% | **BROKEN — effectively empty** |
| musicbrainz_id | 2,405 | 7.7% | Very sparse |

### Missing Data Fields (Required for Wiki)

| Field | Status | Impact |
|---|---|---|
| Biography/description | **Does not exist** | Cannot build wiki pages without narrative text |
| Works/discography | **Does not exist** | Nothing to show what artists created |
| Instruments | **Does not exist** | Cannot filter/display by instrument |
| Notable achievements | **Does not exist** | No context for significance |
| Album/cover art | **Does not exist** | Visual content for pages |
| Occupations | Rendered in UI but 0% populated | DetailPanel code exists for nothing |

### Data Quality Issues

- `birth_country` at 0.6% means location display almost always shows city without country
- Some `birth_city` values are institutions, not cities (e.g., "Roman Catholic Diocese of Liege")
- `image_url` links to Wikimedia Commons Special:FilePath — external dependency, no CDN proxy
- Connections: 6,038 across 31K artists = ~0.2 per artist. Most artists have zero connections.
- Genre data missing for 46% means nearly half the dataset renders as "Other" — the genre filter is unreliable

### Data Enrichment Needed

| Source | What It Provides | Difficulty |
|---|---|---|
| Wikidata API | Bio text, works lists, instruments, countries, images | MEDIUM — batch query 31K entities by wikidata_id |
| MusicBrainz API | Discography, recordings, releases, instruments | MEDIUM — 2,405 have musicbrainz_id already |
| Wikipedia API | First paragraph summary per artist | EASY — 99.6% have wikipedia_url |
| Genre inference | Fill missing genres from Wikidata/MusicBrainz | MEDIUM — cross-reference existing genre data |

---

## PART 3: FEATURE GAPS (Ranked by Priority)

### P0 — Blockers for Publishing

| # | Feature | Current State | What's Needed |
|---|---|---|---|
| F1 | **URL Routing** | No router installed. Cannot link to anything. | Add react-router or migrate to Astro/Next.js. Routes: `/`, `/artist/:slug`, `/genre/:name`, `/explore` |
| F2 | **Artist Wiki Pages** | Side panel only (320px, 5 seconds of content) | Full-page artist views with: image, bio, works, connections, map context, external links |
| F3 | **SSR / Static Generation for SEO** | 100% client-side SPA. Google sees empty `<div id="root">` | Astro SSG for 31K wiki pages + React island for map. Or Next.js with SSG. |
| F4 | **Data Payload Optimization** | 21MB JSON loaded eagerly on first visit. 30+ seconds on 3G. | Tile-based loading, pagination, or server-side filtering. At minimum: gzip + lazy load connections. |
| F5 | **Artist Images** | 87% have image_url. Never displayed. | Show in DetailPanel, wiki pages, search results. Proxy through CDN. |

### P1 — Critical for Product Quality

| # | Feature | Current State | What's Needed |
|---|---|---|---|
| F6 | **Data Enrichment Pipeline** | Raw data with 46% missing genres, 0.6% countries, no bios | Wikidata/Wikipedia API batch enrichment for bios, genres, countries, instruments, works |
| F7 | **Loading Experience** | Plain text "Loading musicians..." | Progress bar, skeleton screen, or streaming data load |
| F8 | **Onboarding / First-Time Experience** | None. User sees colored blobs with no context. | 3-4 step overlay: "Zoom to see artists", "Click to explore connections", "Filter by genre/era" |
| F9 | **Social Sharing / OG Tags** | Zero meta tags beyond basic description | Per-page OG title/description/image. OG image generation for 31K artists. |
| F10 | **Sitemap + robots.txt** | Neither exists | Auto-generated sitemap.xml with 31K URLs. robots.txt allowing crawling. |

### P2 — Important for Competitive Quality

| # | Feature | Current State | What's Needed |
|---|---|---|---|
| F11 | **Structured Data (schema.org)** | None | JSON-LD MusicGroup/Person per artist page for Google Knowledge Panels |
| F12 | **Audio Integration** | None | "Listen on Spotify/YouTube" links per artist. Embed player for previews. |
| F13 | **Advanced Search** | Name/city only via Fuse.js | Genre, year range, country, instrument filters in search. Faceted search. |
| F14 | **Genre Pages** | Genre filters only | Dedicated pages per genre with description, artist list, timeline, map view |
| F15 | **City/Country Pages** | None | Geographic landing pages showing artists by location |
| F16 | **Multiple Views** | Map only | Add timeline view (horizontal), list/table view, graph view options |
| F17 | **"Reset View" Button** | None | Floating button to return to default state after deep navigation |
| F18 | **Breadcrumbs / Navigation History** | None | Trail showing: Home → Classical → Vienna → Mozart |

---

## PART 4: RESPONSIVENESS BUGS (from Codex + audit)

| # | Severity | File | Issue | Fix |
|---|---|---|---|---|
| R1 | High | App.jsx:191, Map.jsx:55 | `100vh` clips bottom controls on mobile browsers with dynamic bars | Use `100dvh` with fallback: `minHeight: '100vh'; height: '100dvh'` |
| R2 | High | CanvasOverlay.jsx:1099 | Keyboard overlay enables pointer events on focus, blocks map interactions | Keep `pointerEvents: 'none'` always; use non-covering focus proxy |
| R3 | Medium | DetailPanel.jsx:211 | Mobile panel height `calc(60vh - 80px)` too small in landscape (320px viewport → 112px) | Use `clamp()` with sensible minimum |
| R4 | Medium | Timeline.jsx:6,367 | 8 year labels always rendered, overlap on narrow mobile widths | Reduce label density by viewport width |
| R5 | Medium | Timeline.jsx:416,464 | Year-edit inputs (56px fixed width) overlap when handles are close | Collapse to one active editor or use floating popover |
| R6 | Low | GenreFilters.jsx:91 | Active button font size changes (12→14px), causing horizontal jitter | Keep constant size, indicate active via weight/background |

## PART 5: LEGIBILITY BUGS (from Codex + audit)

| # | Severity | File | Issue | Fix |
|---|---|---|---|---|
| L1 | High | CanvasOverlay.jsx:508, rendering.js:254 | `drawCityGroup` receives `null` as city text but still calls `ctx.measureText(city)` | Add null guard, skip text measurement/draw when null |
| L2 | High | CanvasOverlay.jsx:488, rendering.js:250 | City label collision rect computed at different position than actual draw position | Align collision rect with actual `labelY` used in drawCityGroup |
| L3 | Medium | Timeline.jsx:430,478 | Year-edit text `#D83E7F` at 12px fails WCAG AA (~3.88:1 vs cream) | Darken to `#C4326B` or increase size |
| L4 | Medium | ConnectionFilters.jsx:136 | Count text 10px with opacity dimming — unreadable | Increase to 12px, remove opacity dimming |
| L5 | Low | DetailPanel.jsx:584 | Body text `#7A6E65` on cream is borderline (~4.49:1) | Use `#6B5F55` or darker |

---

## PART 6: VISUAL POLISH GAPS

### Inline Styles Problem
- **100+ raw hex color values** scattered across every component
- Tailwind is installed and configured but **never used in any component**
- No consistent token system in practice — colors, spacing, typography all ad-hoc
- The Tailwind config defines proper tokens (`text-primary`, `bg-cream`) that are never referenced

### Missing States
| State | Current | Needed |
|---|---|---|
| Loading (main) | Plain text | Progress bar or skeleton screen |
| Loading (panel) | None | Skeleton content |
| Empty (no filter results) | Blank map | "No artists match your filters" message |
| Empty (no search results) | Hidden (aria-live only) | Visible "No results" message |
| Empty (no connections) | Section hidden | "No known connections" text |
| Empty (no genres/education) | Section hidden | Graceful fallback text |
| Error (data fetch) | Error text, no retry | Error + retry button |
| Error (per-component) | None | Component-level error boundaries |

### Typography Issues
- No heading hierarchy beyond single h2 in DetailPanel
- Inconsistent sizes: 10px, 11px, 12px, 13px, 14px, 18px, 22px with no scale system
- Font weights vary (400-700) ad-hoc across components

---

## PART 7: DEPLOYMENT PLAN FOR embryo.wiki

### Phase 1: Deploy SPA Now (same day)

**Recommended: Cloudflare Pages**
- Unlimited bandwidth (critical for 21MB JSON payload)
- 300+ edge CDN locations
- Free SSL, free analytics
- Seamless with Cloudflare DNS

**Steps:**
1. Point embryo.wiki nameservers to Cloudflare (or add CNAME if DNS is elsewhere)
2. Connect GitHub repo (`cur7i7/embryo`) to Cloudflare Pages
3. Build command: `npm run build`, output: `dist`
4. Add `public/_redirects` file: `/* /index.html 200`
5. Add custom domain `embryo.wiki`
6. SSL auto-provisions. Live in ~15 minutes.

### Phase 2: Wiki Pages (1-2 weeks)

**Recommended: Astro SSG + React Islands**

| Step | What | Effort |
|---|---|---|
| 1 | Migrate to Astro with existing React components as islands | 2-3 days |
| 2 | Generate 31K static `/artist/[slug]` pages from artist data | 1 day |
| 3 | Add sitemap.xml, structured data, OG tags | 1 day |
| 4 | Run data enrichment pipeline (Wikidata → bios, genres, countries) | 2-3 days |
| 5 | Deploy everything to Cloudflare Pages | Same day |

**Why Astro:**
- Handles 31K+ static pages efficiently (tested to 50K+)
- React components work as "islands" — the map SPA runs inside Astro pages
- Pure static output — zero server costs, deploy anywhere
- Built-in sitemap, SEO, content collections
- Build time: ~3-8 minutes for 31K pages

### Phase 3: Content Enrichment (ongoing)

| Source | Data | Priority |
|---|---|---|
| Wikipedia API | First-paragraph biography for 31K artists | P0 |
| Wikidata SPARQL | Missing genres, countries, instruments, works | P0 |
| MusicBrainz API | Discography for 2,405 linked artists | P1 |
| Spotify API | "Listen" links, popularity data | P2 |
| Image CDN proxy | Cache Wikimedia images through own CDN | P1 |

---

## PART 8: WIKI FORMAT PROPOSAL

### Artist Page Structure

```
embryo.wiki/artist/johann-sebastian-bach
```

**Layout:**
```
┌──────────────────────────────────────────────┐
│ [Header: Name + Dates + Genre Badge]          │
│ ┌────────────┐  ┌───────────────────────────┐ │
│ │  Portrait   │  │ Quick Facts               │ │
│ │  (image)    │  │ Born: 1685, Eisenach      │ │
│ │             │  │ Died: 1750, Leipzig        │ │
│ │             │  │ Genre: Classical / Baroque  │ │
│ │             │  │ Instruments: Organ, Harp.. │ │
│ └────────────┘  │ Active: 1703–1750          │ │
│                  └───────────────────────────┘ │
├──────────────────────────────────────────────┤
│ [Biography - from Wikipedia API]              │
│ 2-3 paragraphs of narrative text...           │
├──────────────────────────────────────────────┤
│ [Notable Works]                               │
│ • Mass in B minor (1749)                     │
│ • Brandenburg Concertos (1721)               │
│ • The Well-Tempered Clavier (1722)           │
├──────────────────────────────────────────────┤
│ [Connections]                                 │
│ Teacher of → Johann Friedrich Krebs           │
│ Influenced → Mozart, Beethoven               │
│ Peer of → Handel, Telemann                   │
│ [View on Map] button → flies to artist       │
├──────────────────────────────────────────────┤
│ [Map Context - React Island]                  │
│ Small embedded map centered on birth location │
│ Showing connected artists as nodes            │
├──────────────────────────────────────────────┤
│ [External Links]                              │
│ Wikipedia | Wikidata | MusicBrainz | Spotify │
├──────────────────────────────────────────────┤
│ [Related Artists] (same genre/era/location)   │
│ Grid of 6-8 artist cards with thumbnails     │
└──────────────────────────────────────────────┘
```

### URL Structure

```
embryo.wiki/                        → Map visualization (current SPA)
embryo.wiki/artist/[slug]           → Individual artist wiki page
embryo.wiki/genre/[name]            → Genre page with description + artist list
embryo.wiki/city/[name]             → City page with local artists
embryo.wiki/era/[period]            → Era page (Baroque, Classical, etc.)
embryo.wiki/explore                 → Full-page map with URL state encoding
embryo.wiki/about                   → About the project
embryo.wiki/sitemap.xml             → Auto-generated
```

### SEO Per Page

```html
<title>Johann Sebastian Bach — Embryo Wiki</title>
<meta name="description" content="German Baroque composer (1685–1750).
  Born in Eisenach. Known for Mass in B minor, Brandenburg Concertos...">
<meta property="og:title" content="Johann Sebastian Bach">
<meta property="og:image" content="/og/johann-sebastian-bach.jpg">
<link rel="canonical" href="https://embryo.wiki/artist/johann-sebastian-bach">
<script type="application/ld+json">
  { "@type": "Person", "name": "Johann Sebastian Bach", ... }
</script>
```

---

## PART 9: COMPLETE PROPOSAL LIST (Prioritized)

### IMMEDIATE (Deploy this week)

| # | Proposal | Type | Effort |
|---|---|---|---|
| 1 | Deploy current SPA to embryo.wiki via Cloudflare Pages | OPS | 2 hours |
| 2 | Add `_redirects` file for SPA routing | OPS | 5 min |
| 3 | Add basic meta tags + OG tags to index.html | CODE | 30 min |
| 4 | Fix R1: `100vh` → `100dvh` for mobile | BUG | 15 min |
| 5 | Fix L1: null guard in drawCityGroup | BUG | 15 min |
| 6 | Fix L2: Align city label collision rect with draw position | BUG | 30 min |
| 7 | Display artist images in DetailPanel (87% have URLs) | FEATURE | 1 hour |
| 8 | Show Wikipedia link in DetailPanel | FEATURE | 30 min |
| 9 | Fix R2: Keyboard overlay blocking map | BUG | 1 hour |

### SHORT-TERM (Next 1-2 weeks)

| # | Proposal | Type | Effort |
|---|---|---|---|
| 10 | Add react-router with URL state encoding (artist, zoom, filters) | FEATURE | 2 days |
| 11 | Migrate to Astro with React islands | ARCH | 2-3 days |
| 12 | Generate 31K static artist wiki pages | FEATURE | 1 day |
| 13 | Data enrichment: Wikipedia API → bios for 31K artists | DATA | 2-3 days |
| 14 | Data enrichment: Wikidata → genres, countries, instruments | DATA | 2-3 days |
| 15 | Sitemap.xml generation (31K URLs) | SEO | 1 day |
| 16 | JSON-LD structured data per artist page | SEO | 1 day |
| 17 | OG image generation per artist | SEO | 1 day |
| 18 | Loading progress indicator (replace plain text) | UX | 1 day |
| 19 | Onboarding overlay for first-time users | UX | 1 day |
| 20 | Fix R3-R6: Mobile responsiveness issues | BUG | 1 day |
| 21 | Fix L3-L5: Contrast/legibility issues | BUG | 1 day |
| 22 | CI/CD: GitHub Actions for build + deploy on push | OPS | 2 hours |

### MEDIUM-TERM (Weeks 3-4)

| # | Proposal | Type | Effort |
|---|---|---|---|
| 23 | Data enrichment: MusicBrainz → discography for 2.4K artists | DATA | 2 days |
| 24 | Genre pages with descriptions + artist grids | FEATURE | 2 days |
| 25 | City/country pages with local artists | FEATURE | 2 days |
| 26 | Advanced search: genre, year, country, instrument filters | FEATURE | 2 days |
| 27 | Audio integration: Spotify/YouTube links per artist | FEATURE | 2 days |
| 28 | Data payload optimization: lazy load, paginate, or tile data | PERF | 3 days |
| 29 | Migrate inline styles to Tailwind utility classes | CODE | 3 days |
| 30 | Empty states for all filter/search scenarios | UX | 1 day |
| 31 | Image CDN proxy for Wikimedia images | OPS | 1 day |
| 32 | "View on Map" from wiki pages (deep link to map view) | FEATURE | 1 day |

### LONG-TERM (Month 2+)

| # | Proposal | Type | Effort |
|---|---|---|---|
| 33 | Timeline detail view (click decade → see who was active) | FEATURE | 3 days |
| 34 | Graph/network view toggle (alternative to map) | FEATURE | 5 days |
| 35 | "Trace lineage" mode (multi-hop A→B→C connections) | FEATURE | 3 days |
| 36 | Community contribution workflow (suggest edits) | FEATURE | 5 days |
| 37 | Dark mode support | DESIGN | 2 days |
| 38 | Embed/share widget for external sites | FEATURE | 2 days |
| 39 | API for programmatic access to data | FEATURE | 3 days |
| 40 | Internationalization (at minimum Spanish) | FEATURE | 3 days |

---

## PART 10: WHAT MAKES THE REFERENCES FEEL "FINISHED"

| Quality | How References Achieve It | EMBRYO Gap |
|---|---|---|
| **Content density** | Every entity has 3+ paragraphs of context | ~5 seconds of content per artist |
| **Self-contained** | Users don't need to leave the site | Users must go to Wikipedia for any depth |
| **Discoverable** | URLs, SEO, social sharing drive new visitors | Zero discoverability — SPA with no URLs |
| **Forgiving** | Multiple paths to find anything (search, browse, filter, link) | One path: zoom the map and click |
| **Educational** | Visitors learn something new every click | Visitors see data but don't learn context |
| **Shareable** | "Look at this!" → paste URL | Cannot share specific views |
| **Trustworthy** | Sources cited, data attributed, professional polish | No sources, no about page, prototype UI |

---

*End of audit. No files were modified.*
