# Embryo

Embryo is an interactive museum-style web app that visualizes how music history evolves over time through artist relationships.

Tagline: **How music was born.**

## Demo Concept

- Timeline from **1550 to 2025** controls which artists are visible based on active years.
- A **D3 force-directed graph** maps connections such as teaching, influence, collaboration, and rivalry.
- Clicking an artist opens a detail panel with biography and evidence-backed relationship history.

## Tech Stack

- React + Vite
- Tailwind CSS
- D3.js (force simulation + transitions)

## Data Files

This project expects:

- `public/data/artists_final.json`
- `public/data/connections_final.json`

`artists_final.json` fields used:

- `name`
- `birth_year`
- `death_year`
- `active_start`
- `active_end`
- `birth_city`
- `birth_country`
- `genres`
- `education`

`connections_final.json` fields used:

- `source_name`
- `target_name`
- `type` (`teacher`, `influence`, `peer`, `collaboration`, `rivalry`)
- `confidence`
- `evidence`

## Core Features Implemented

1. Timeline slider (1550–2025) with smooth network transitions.
2. Artist visibility by active years (`active_start <= year <= active_end`).
3. Edge visibility only when both endpoint artists are visible.
4. D3 force-directed layout with node size based on connection count.
5. Node color buckets by genre:
   - Classical (gold)
   - Jazz/Blues (blue)
   - Rock (green)
   - Electronic (purple)
   - Hip-Hop (red)
   - Pop/Soul (orange)
   - Other (grey)
6. Top edge filters:
   - All
   - Teacher→Student
   - Influence
   - Friendship (maps to `peer` + `collaboration`)
7. Play/Pause timeline control that advances by decade every 2 seconds.
8. Artist detail panel with all known relationships and evidence text.
9. Responsive layout for desktop and mobile.

## Branding + Visual Direction

- Primary background: `#672146` (deep burgundy)
- Secondary UI accents: `#AA737D` (mesa rose)
- Text and labels: `#FFF7C7` (warm cream)

The UI uses layered gradients, a subtle grid, and serif-forward typography for an exhibit-like look.

## Local Development

```bash
npm install
npm run dev
```

Build for production:

```bash
npm run build
npm run preview
```

## Deployment

### Vercel

- `vercel.json` is included for SPA rewrites.
- Build command: `npm run build`
- Output directory: `dist`

### Netlify

- `netlify.toml` is included.
- Build command: `npm run build`
- Publish directory: `dist`
- SPA redirect is configured.

## Project Structure

```text
embryo/
  public/
    data/
      artists_final.json
      connections_final.json
  src/
    components/
      NetworkGraph.jsx
    App.jsx
    index.css
    main.jsx
  netlify.toml
  vercel.json
  tailwind.config.js
  postcss.config.js
```
