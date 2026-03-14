# embryo.wiki

**How music was born.** An interactive map of 17,000+ musicians plotted at their birth locations, with connections tracing influence, teaching, and collaboration across six centuries.

Live at: https://embryo.wiki

## Stack

- React 19.2 + Vite 7.3
- MapLibre GL JS 5.20 via react-map-gl 8.1 (interactive map + clustering)
- Fuse.js 7.1 (fuzzy search)
- Inline CSS styles (no Tailwind, no CSS framework)
- Cloudflare Pages (deployment)

## Features

- Interactive world map with 17,288 musicians plotted at birth coordinates
- 9 genre-color-coded clusters with MapLibre clustering at zoom-out
- Timeline slider (1400–2025) with play/pause animation
- Fuzzy search with keyboard navigation
- Artist detail panel showing influences, teachers, and peers
- Side-by-side artist comparison
- Guided journeys: jazz evolution, Bach teaching lineage, electronic pioneers
- Filter by genre and connection type
- URL hash-based state persistence

## Design

- Font: DM Sans (Google Fonts)
- Background: `#FAF3EB` (cream)
- Accent: `#C4366F` (magenta)
- Genre colors:
  - Classical `#912761`
  - Jazz `#FFBA52`
  - Rock `#D4295E`
  - Electronic `#D0DF00`
  - Hip-hop `#F4762D`
  - Pop `#DB608F`
  - Folk `#ADA400`
  - World `#C34121`
  - Other `#FFCB78`

## Setup

```bash
npm install
npm run dev      # Start dev server
npm run build    # Production build → dist/
npm run lint     # ESLint
```

## Deployment

```bash
npx wrangler pages deploy dist --project-name embryo-wiki
```

## Project Structure

```
src/
├── App.jsx              # Root — all state lives here
├── components/
│   ├── Map.jsx          # MapLibre GL map with clustering
│   ├── FilterPanel.jsx  # Genre + connection type filters
│   ├── DetailPanel.jsx  # Artist detail sidebar
│   ├── Timeline.jsx     # Year range slider + playback
│   ├── SearchBar.jsx    # Fuse.js fuzzy search
│   └── ...              # 10+ more components
├── hooks/               # Data fetching, viewport, etc.
├── utils/               # Genre classification, geo helpers
└── contexts/            # TotalArtistCountContext
public/data/
├── artists_final.json   # 17,288 musicians
└── connections_final.json # 15,229 connections
```

## Data

- **Artists:** 17,288 musicians with birth coordinates, genres, birth/death/active years, education, Wikipedia/Wikidata/MusicBrainz IDs
- **Connections:** 15,229 relationships (peer, teacher, influence, collaboration, rivalry)
- **Journeys:** 3 curated guided tours
