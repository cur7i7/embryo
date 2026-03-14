# Native MapLibre Clustering Migration

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 1968-line custom CanvasOverlay with MapLibre's native clustering — GPU-rendered circles, automatic progressive disclosure, built-in hit-testing. Keep connection arcs in a minimal canvas.

**Architecture:** Artists become a GeoJSON `FeatureCollection` fed to a MapLibre `Source` with `cluster: true`. Circle and symbol `Layer` components handle all rendering via paint expressions. `clusterProperties` aggregates per-genre counts so clusters color by dominant genre. Click/hover use `interactiveLayerIds` + `queryRenderedFeatures`. A thin `ArcOverlay` canvas remains for connection lines only.

**Tech Stack:** react-map-gl `<Source>` + `<Layer>`, MapLibre GL JS native clustering, MapLibre style expressions (`step`, `case`, `match`).

**Constraints (INVIOLABLE):**
- Opacity always 70% (`circle-opacity: 0.7`)
- Genre colors from `GENRE_BUCKETS` — DO NOT change
- Progressive disclosure like Google Maps (few clusters at low zoom → individuals at high zoom)
- All circles clickable
- Same callback contracts: `onSelect(artist)`, `onHover(artist)`, `onHoverPosition({x,y})`

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `src/components/Map.jsx` | **Modify** | Add `<Source>`, `<Layer>` components, event handlers, interactiveLayerIds |
| `src/components/ArcOverlay.jsx` | **Create** | Minimal canvas for connection arcs only (~150 lines) |
| `src/utils/geoJsonSource.js` | **Create** | Convert artist array → GeoJSON FeatureCollection + layer config |
| `src/components/CanvasOverlay.jsx` | **Delete** (Task 6) | Replaced entirely by native layers |
| `src/utils/rendering.js` | **Modify** | Keep `drawArcParticle` + `hexToRgba`, remove unused functions |
| `src/App.jsx` | **Modify** | Remove CanvasOverlay props, wire up new event handlers from Map |

**Files that DO NOT change:** `DetailPanel.jsx`, `HoverCard.jsx`, `Timeline.jsx`, `GenreLegend.jsx`, `SearchBar.jsx`, `genres.js`, `useArtistData.js`, `useConnectionData.js`, `useViewportArtists.js`, `cityGrouping.js`.

---

## Chunk 1: Core Clustering Layers

### Task 1: Create GeoJSON source utility

**Files:**
- Create: `src/utils/geoJsonSource.js`

- [ ] **Step 1: Create the artist-to-GeoJSON converter**

This module converts the artist array into a GeoJSON FeatureCollection with genre properties for clustering aggregation.

```javascript
// src/utils/geoJsonSource.js
import { getGenreBucket, GENRE_BUCKETS } from './genres.js';

const BUCKET_KEYS = Object.keys(GENRE_BUCKETS);

/**
 * Convert filtered artists array into a GeoJSON FeatureCollection.
 * Each feature carries its genre bucket name + color for layer expressions.
 */
export function artistsToGeoJSON(artists) {
  const features = [];
  for (const a of artists) {
    if (!a.birth_lng || !a.birth_lat) continue;
    const bucket = getGenreBucket(a.genres);
    features.push({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [a.birth_lng, a.birth_lat],
      },
      properties: {
        artistId: a.id,
        name: a.name,
        genre: bucket.name,
        genreColor: bucket.color,
        birthYear: a.birth_year ?? null,
        deathYear: a.death_year ?? null,
      },
    });
  }
  return { type: 'FeatureCollection', features };
}

/**
 * clusterProperties config for MapLibre source.
 * Counts artists per genre bucket within each cluster.
 * Example result on a cluster: { Classical: 12, Rock: 45, ... }
 */
export const clusterProperties = Object.fromEntries(
  BUCKET_KEYS.map((key) => [
    key,
    ['+', ['case', ['==', ['get', 'genre'], key], 1, 0]],
  ])
);

/**
 * MapLibre expression: pick the genre color of the bucket with the highest count.
 * Returns a 'case' expression that checks each genre count and returns the
 * color of whichever genre has the most artists in the cluster.
 */
export function buildDominantGenreColorExpression() {
  // Build a list of [genreName, color] pairs
  const pairs = BUCKET_KEYS.map((key) => ({
    key,
    color: GENRE_BUCKETS[key].color,
  }));

  // For each genre, check if it has the max count among all genres
  // We use nested case expressions: for each genre, check if its count >= all others
  const conditions = [];
  for (const { key, color } of pairs) {
    const isMax = ['all',
      ...pairs
        .filter((p) => p.key !== key)
        .map((p) => ['>=', ['get', key], ['get', p.key]]),
    ];
    conditions.push(isMax, color);
  }

  return ['case', ...conditions, '#FFCB78']; // fallback = Other color
}

/** Genre color match expression for unclustered individual points */
export const individualColorExpression = [
  'match',
  ['get', 'genre'],
  ...BUCKET_KEYS.flatMap((key) => [key, GENRE_BUCKETS[key].color]),
  '#FFCB78', // fallback
];
```

- [ ] **Step 2: Verify module imports work**

Run: `cd /Users/flork/Documents/embryo && node -e "import('./src/utils/geoJsonSource.js')" 2>&1 || echo "ESM check - verify at build time instead"`
Then: `npm run build`
Expected: No errors related to geoJsonSource.

- [ ] **Step 3: Commit**

```bash
git add src/utils/geoJsonSource.js
git commit -m "feat: add GeoJSON source utility for native MapLibre clustering"
```

---

### Task 2: Add native clustering layers to Map.jsx

**Files:**
- Modify: `src/components/Map.jsx`

This is the core change. We add `<Source>` with clustering enabled and `<Layer>` components for cluster circles, count labels, and individual artist circles — all inside the existing `<MapGL>`.

- [ ] **Step 1: Add imports and GeoJSON memo**

At the top of Map.jsx, add:

```javascript
import { Source, Layer } from 'react-map-gl/maplibre';
import {
  artistsToGeoJSON,
  clusterProperties,
  buildDominantGenreColorExpression,
  individualColorExpression,
} from '../utils/geoJsonSource.js';
```

Add a `useMemo` for the GeoJSON data inside the component:

```javascript
const geojsonData = useMemo(
  () => artistsToGeoJSON(artists),
  [artists]
);
```

- [ ] **Step 2: Define layer style objects**

Add these as constants outside the component (or in a separate file — but keep them co-located for now):

```javascript
const clusterCircleLayer = {
  id: 'clusters',
  type: 'circle',
  source: 'artists',
  filter: ['has', 'point_count'],
  paint: {
    'circle-color': buildDominantGenreColorExpression(),
    'circle-radius': [
      'step',
      ['get', 'point_count'],
      12,   // default: 12px for < 10 points
      10, 16,   // 16px for 10-49
      50, 22,   // 22px for 50-199
      200, 30,  // 30px for 200-999
      1000, 40, // 40px for 1000+
    ],
    'circle-opacity': 0.7,
    'circle-stroke-width': 1.5,
    'circle-stroke-color': buildDominantGenreColorExpression(),
    'circle-stroke-opacity': 0.9,
  },
};

const clusterCountLayer = {
  id: 'cluster-count',
  type: 'symbol',
  source: 'artists',
  filter: ['has', 'point_count'],
  layout: {
    'text-field': '{point_count_abbreviated}',
    'text-font': ['Noto Sans Regular'],
    'text-size': [
      'step',
      ['get', 'point_count'],
      11,       // default
      100, 13,  // larger text for big clusters
      1000, 15,
    ],
    'text-allow-overlap': true,
  },
  paint: {
    'text-color': '#FFFFFF',
    'text-halo-color': 'rgba(0,0,0,0.4)',
    'text-halo-width': 1.5,
  },
};

const unclusteredPointLayer = {
  id: 'unclustered-point',
  type: 'circle',
  source: 'artists',
  filter: ['!', ['has', 'point_count']],
  paint: {
    'circle-color': individualColorExpression,
    'circle-radius': [
      'interpolate', ['linear'], ['zoom'],
      5, 4,    // tiny at zoom 5
      8, 7,    // medium at zoom 8
      12, 12,  // full size at zoom 12+
    ],
    'circle-opacity': 0.7,
    'circle-stroke-width': 1.5,
    'circle-stroke-color': individualColorExpression,
    'circle-stroke-opacity': 0.9,
  },
};

const unclusteredLabelLayer = {
  id: 'unclustered-label',
  type: 'symbol',
  source: 'artists',
  filter: ['!', ['has', 'point_count']],
  minzoom: 10,
  layout: {
    'text-field': ['get', 'name'],
    'text-font': ['Noto Sans Regular'],
    'text-size': 11,
    'text-offset': [0, 1.5],
    'text-anchor': 'top',
    'text-max-width': 10,
    'text-optional': true,
  },
  paint: {
    'text-color': '#3E3530',
    'text-halo-color': 'rgba(250, 243, 235, 0.85)',
    'text-halo-width': 1.5,
  },
};
```

- [ ] **Step 3: Add Source and Layer components inside MapGL**

Inside the `<MapGL>` JSX, after the map loads, add:

```jsx
<Source
  id="artists"
  type="geojson"
  data={geojsonData}
  cluster={true}
  clusterRadius={60}
  clusterMaxZoom={14}
  clusterProperties={clusterProperties}
>
  <Layer {...clusterCircleLayer} />
  <Layer {...clusterCountLayer} />
  <Layer {...unclusteredPointLayer} />
  <Layer {...unclusteredLabelLayer} />
</Source>
```

- [ ] **Step 4: Add interactiveLayerIds to MapGL**

Add the `interactiveLayerIds` prop to `<MapGL>`:

```jsx
<MapGL
  // ... existing props
  interactiveLayerIds={['clusters', 'unclustered-point']}
  cursor={cursor}
>
```

Add cursor state:
```javascript
const [cursor, setCursor] = useState('auto');
```

- [ ] **Step 5: Build and verify layers render**

Run: `npm run build`
Expected: No errors. Then visually verify in preview — circles should appear on the map.

- [ ] **Step 6: Commit**

```bash
git add src/components/Map.jsx
git commit -m "feat: add native MapLibre clustering layers with genre-colored circles"
```

---

### Task 3: Wire up click and hover events

**Files:**
- Modify: `src/components/Map.jsx`
- Modify: `src/App.jsx` (minor — may need to adjust how `artistById` is passed)

- [ ] **Step 1: Create an artistById lookup**

In `Map.jsx` (or receive from App.jsx if it already exists):

```javascript
const artistById = useMemo(() => {
  const map = new Map();
  for (const a of artists) map.set(a.id, a);
  return map;
}, [artists]);
```

- [ ] **Step 2: Add click handler**

```javascript
const onClick = useCallback(
  async (event) => {
    const feature = event.features?.[0];
    if (!feature) return;

    // Cluster click → zoom in
    if (feature.properties.cluster) {
      const map = mapRef.current?.getMap();
      if (!map) return;
      const source = map.getSource('artists');
      const zoom = await source.getClusterExpansionZoom(feature.properties.cluster_id);
      map.easeTo({
        center: feature.geometry.coordinates,
        zoom: Math.min(zoom, 16),
        duration: 500,
      });
      return;
    }

    // Individual artist click → select
    const artist = artistById.get(feature.properties.artistId);
    if (artist) {
      onSelect(artist);
      const map = mapRef.current?.getMap();
      if (map) {
        map.easeTo({
          center: [artist.birth_lng, artist.birth_lat],
          zoom: Math.max(map.getZoom(), 10),
          duration: 500,
        });
      }
    }
  },
  [artistById, onSelect, mapRef]
);
```

- [ ] **Step 3: Add hover handlers**

```javascript
const onMouseMove = useCallback(
  (event) => {
    const feature = event.features?.[0];
    if (!feature || feature.properties.cluster) {
      onHover(null);
      setCursor('auto');
      return;
    }
    const artist = artistById.get(feature.properties.artistId);
    if (artist) {
      onHover(artist);
      onHoverPosition({ x: event.point.x, y: event.point.y });
      setCursor('pointer');
    }
  },
  [artistById, onHover, onHoverPosition]
);

const onMouseLeave = useCallback(() => {
  onHover(null);
  setCursor('auto');
}, [onHover]);
```

- [ ] **Step 4: Wire handlers to MapGL**

```jsx
<MapGL
  // ... existing props
  interactiveLayerIds={['clusters', 'unclustered-point']}
  onClick={onClick}
  onMouseMove={onMouseMove}
  onMouseLeave={onMouseLeave}
  cursor={cursor}
>
```

- [ ] **Step 5: Set cursor to pointer on cluster hover too**

Update `onMouseMove` to set pointer cursor for clusters as well:

```javascript
if (feature.properties.cluster) {
  setCursor('pointer');
  onHover(null);  // no artist hover for clusters
  return;
}
```

- [ ] **Step 6: Build and test click/hover**

Run: `npm run build`
Then verify: clicking a cluster zooms in, clicking an individual opens DetailPanel, hovering shows HoverCard.

- [ ] **Step 7: Commit**

```bash
git add src/components/Map.jsx src/App.jsx
git commit -m "feat: wire click/hover events for native cluster and artist layers"
```

---

## Chunk 2: Arc Overlay + Selected Artist Highlighting

### Task 4: Create minimal ArcOverlay for connection lines

**Files:**
- Create: `src/components/ArcOverlay.jsx`

This is a thin canvas overlay that ONLY draws connection arcs when an artist is selected. No circles, no clusters, no hit-testing. ~150 lines max.

- [ ] **Step 1: Create ArcOverlay component**

```javascript
// src/components/ArcOverlay.jsx
import { useRef, useEffect, useCallback } from 'react';
import { hexToRgba } from '../utils/rendering.js';

/**
 * Minimal canvas overlay for connection arcs only.
 * Draws curved lines between selected artist and their connections.
 */
export default function ArcOverlay({
  mapRef,
  selectedArtist,
  connectionsByArtist,
  activeConnectionTypes,
  artists,
  connectionCounts,
}) {
  const canvasRef = useRef(null);
  const rafRef = useRef(null);

  // Build artist position lookup
  const artistById = useRef(new Map());
  useEffect(() => {
    const m = new Map();
    for (const a of artists) m.set(a.id, a);
    artistById.current = m;
  }, [artists]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const map = mapRef.current?.getMap();
    if (!canvas || !map || !selectedArtist) {
      if (canvas) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
      return;
    }

    const dpr = window.devicePixelRatio || 1;
    const { width, height } = map.getCanvas().getBoundingClientRect();
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const conns = connectionsByArtist?.get(selectedArtist.id);
    if (!conns) return;

    const srcPt = map.project([selectedArtist.birth_lng, selectedArtist.birth_lat]);

    for (const conn of conns) {
      if (!activeConnectionTypes.has(conn.type)) continue;
      const targetId = conn.source_id === selectedArtist.id ? conn.target_id : conn.source_id;
      const target = artistById.current.get(targetId);
      if (!target || !target.birth_lng || !target.birth_lat) continue;

      const tgtPt = map.project([target.birth_lng, target.birth_lat]);
      const x1 = srcPt.x, y1 = srcPt.y, x2 = tgtPt.x, y2 = tgtPt.y;

      // Quadratic Bézier arc
      const midX = (x1 + x2) / 2;
      const midY = (y1 + y2) / 2;
      const dist = Math.hypot(x2 - x1, y2 - y1);
      if (dist < 1) continue;

      const bulge = dist * 0.2;
      const nx = -(y2 - y1) / dist;
      const ny = (x2 - x1) / dist;
      const cpx = midX + nx * bulge;
      const cpy = midY + ny * bulge;

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.quadraticCurveTo(cpx, cpy, x2, y2);

      // Style by connection type
      const alpha = 0.25 + (conn.confidence ?? 0.5) * 0.25;
      ctx.strokeStyle = hexToRgba('#3E3530', alpha);
      ctx.lineWidth = 1.5;
      if (conn.type === 'influence') ctx.setLineDash([4, 4]);
      else if (conn.type === 'peer' || conn.type === 'collaboration') ctx.setLineDash([8, 4]);
      else ctx.setLineDash([]);

      ctx.stroke();
      ctx.setLineDash([]);
    }
  }, [mapRef, selectedArtist, connectionsByArtist, activeConnectionTypes]);

  // Redraw on map move
  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!map) return;

    const redraw = () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(draw);
    };

    map.on('move', redraw);
    map.on('zoom', redraw);
    redraw();

    return () => {
      map.off('move', redraw);
      map.off('zoom', redraw);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [mapRef, draw]);

  // Redraw when selection changes
  useEffect(() => { draw(); }, [draw]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        pointerEvents: 'none',
        zIndex: 2,
      }}
    />
  );
}
```

- [ ] **Step 2: Add ArcOverlay to Map.jsx**

Import and render inside the MapGL wrapper div (NOT inside `<MapGL>` itself — it goes as a sibling positioned absolutely over the map):

```javascript
import ArcOverlay from './ArcOverlay.jsx';
```

```jsx
<div style={{ position: 'relative', width: '100%', height: '100%' }}>
  <MapGL ...>
    <Source ...>
      <Layer ... />
    </Source>
  </MapGL>
  <ArcOverlay
    mapRef={mapRef}
    selectedArtist={selectedArtist}
    connectionsByArtist={connectionsByArtist}
    activeConnectionTypes={activeConnectionTypes}
    artists={artists}
    connectionCounts={connectionCounts}
  />
</div>
```

- [ ] **Step 3: Build and verify arcs render**

Run: `npm run build`
Then verify: select an artist, arcs should appear connecting to related artists.

- [ ] **Step 4: Commit**

```bash
git add src/components/ArcOverlay.jsx src/components/Map.jsx
git commit -m "feat: add minimal ArcOverlay for connection lines"
```

---

### Task 5: Highlight selected artist and connected artists

**Files:**
- Modify: `src/components/Map.jsx`

Use MapLibre `feature-state` or a filter expression to visually highlight the selected artist and dim others.

- [ ] **Step 1: Add a selected-artist highlight layer**

Add a new layer that renders a larger, brighter circle for the selected artist:

```javascript
const selectedArtistLayer = {
  id: 'selected-artist',
  type: 'circle',
  source: 'artists',
  filter: ['==', ['get', 'artistId'], ''],  // empty filter, updated dynamically
  paint: {
    'circle-color': individualColorExpression,
    'circle-radius': 16,
    'circle-opacity': 0.9,
    'circle-stroke-width': 3,
    'circle-stroke-color': '#FAF3EB',
    'circle-stroke-opacity': 1,
  },
};
```

- [ ] **Step 2: Update filter dynamically when selectedArtist changes**

```javascript
useEffect(() => {
  const map = mapRef.current?.getMap();
  if (!map || !map.getLayer('selected-artist')) return;

  if (selectedArtist) {
    map.setFilter('selected-artist', ['==', ['get', 'artistId'], selectedArtist.id]);
  } else {
    map.setFilter('selected-artist', ['==', ['get', 'artistId'], '']);
  }
}, [selectedArtist, mapRef]);
```

- [ ] **Step 3: Add the layer to the Source**

```jsx
<Source ...>
  <Layer {...clusterCircleLayer} />
  <Layer {...clusterCountLayer} />
  <Layer {...unclusteredPointLayer} />
  <Layer {...unclusteredLabelLayer} />
  <Layer {...selectedArtistLayer} />
</Source>
```

- [ ] **Step 4: Build and verify highlighting**

Run: `npm run build`
Then verify: clicking an artist shows a highlighted circle.

- [ ] **Step 5: Commit**

```bash
git add src/components/Map.jsx
git commit -m "feat: add selected artist highlight layer"
```

---

## Chunk 3: Cleanup + Final Wiring

### Task 6: Remove old CanvasOverlay and unused code

**Files:**
- Delete: `src/components/CanvasOverlay.jsx`
- Modify: `src/components/Map.jsx` (remove CanvasOverlay import/usage)
- Modify: `src/utils/rendering.js` (remove unused functions, keep `hexToRgba` + `drawArcParticle`)
- Modify: `src/App.jsx` (remove CanvasOverlay-specific props if any)

- [ ] **Step 1: Remove CanvasOverlay import and usage from Map.jsx**

Remove the import and any `<CanvasOverlay ... />` JSX. Remove props that were only used by CanvasOverlay (e.g., `isFinePointer` if nothing else uses it).

- [ ] **Step 2: Clean up rendering.js**

Remove `preRenderOrbTexture`, `drawArtistNode`, `drawCityGroup` — these are no longer needed. Keep `hexToRgba` (used by ArcOverlay) and `drawArcParticle` (if arc particles are desired later). Remove `GENRE_COLORS` export if unused.

- [ ] **Step 3: Remove cityGrouping.js import if unused**

Check if `buildCityGroups` from `src/utils/cityGrouping.js` is still used anywhere. If not, it can stay (no need to delete files unnecessarily) but remove any imports of it.

- [ ] **Step 4: Clean up App.jsx**

Remove any state or props that existed solely for CanvasOverlay:
- `isFinePointer` / `useIsPointerFine` hook if nothing else uses it
- Any refs that were passed only to CanvasOverlay

- [ ] **Step 5: Delete CanvasOverlay.jsx**

```bash
rm src/components/CanvasOverlay.jsx
```

- [ ] **Step 6: Build and verify everything works**

Run: `npm run build`
Expected: Clean build, no missing imports, no unused variable warnings.

- [ ] **Step 7: Verify in preview**

Take screenshots at:
- Zoom 2 (world view — clusters)
- Zoom 6 (Europe — medium clusters)
- Zoom 10 (city level — individual artists)
- Click a cluster → verify zoom-in
- Click an artist → verify DetailPanel opens
- Hover → verify HoverCard shows

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "refactor: remove CanvasOverlay, complete migration to native MapLibre clustering"
```

---

### Task 7: Remove Supercluster dependency

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Verify Supercluster is no longer imported anywhere**

Run: `grep -r "supercluster" src/ --include="*.js" --include="*.jsx"`
Expected: No results.

- [ ] **Step 2: Uninstall Supercluster**

```bash
npm uninstall supercluster
```

- [ ] **Step 3: Build and verify**

```bash
npm run build
```

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: remove supercluster dependency (replaced by native MapLibre clustering)"
```

---

### Task 8: Final lint and build verification

- [ ] **Step 1: Run lint**

```bash
npm run lint
```

Fix any errors.

- [ ] **Step 2: Run build**

```bash
npm run build
```

- [ ] **Step 3: Visual verification at multiple zoom levels**

Screenshot at zoom 2, 6, 10 on desktop. Verify:
- 70% opacity on all circles
- Progressive disclosure (clusters merge/split with zoom)
- Genre colors match legend
- Click-to-zoom on clusters
- Click-to-select on individuals
- HoverCard appears on individual hover
- Connection arcs draw when artist is selected
- No console errors

- [ ] **Step 4: Final commit if any lint fixes needed**

```bash
git add -A
git commit -m "chore: lint fixes after clustering migration"
```
