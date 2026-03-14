import { readFileSync, writeFileSync } from 'fs';

const ARTISTS_PATH = '/Users/flork/Documents/embryo/public/data/artists_final.json';
const CONNECTIONS_PATH = '/Users/flork/Documents/embryo/public/data/connections_final.json';

// Non-music genres — artists whose ENTIRE genre list falls within this set are removed
const BLOCKLIST = new Set([
  'essay', 'poetry', 'prose', 'novel', 'short novel', 'short story', 'novella',
  'science fiction', 'crime literature', 'detective fiction', 'thriller',
  'horror fiction', 'fantasy', 'historical fiction', 'satire',
  'autobiography', 'biography', 'journalism', 'literary criticism',
  'drama', 'tragedy', 'comedy', 'screenplay',
  'painting', 'sculpture', 'portrait', 'landscape art', 'still life',
  'architecture', 'photography',
  'ballet', 'chess', 'sport',
]);

// ── Load data ────────────────────────────────────────────────────────────────
const artists = JSON.parse(readFileSync(ARTISTS_PATH, 'utf8'));
const connections = JSON.parse(readFileSync(CONNECTIONS_PATH, 'utf8'));

const totalBefore = artists.length;
const connectionsBefore = connections.length;

// Build set of all artist IDs that appear in any connection
const connectedIds = new Set();
for (const conn of connections) {
  connectedIds.add(conn.source_id);
  connectedIds.add(conn.target_id);
}

// ── Filter artists ───────────────────────────────────────────────────────────
let removedAllBlocklisted = 0;
let removedNoGenresNoConnections = 0;

const kept = [];

for (const artist of artists) {
  const genres = artist.genres ?? [];
  const hasGenres = genres.length > 0;
  const isConnected = connectedIds.has(artist.id);

  if (hasGenres) {
    // Normalise for comparison
    const lowerGenres = genres.map(g => g.toLowerCase().trim());
    const allBlocklisted = lowerGenres.every(g => BLOCKLIST.has(g));

    if (allBlocklisted) {
      // Every genre is a non-music genre → remove
      removedAllBlocklisted++;
    } else {
      // At least one music genre → keep
      kept.push(artist);
    }
  } else {
    // No genres at all
    if (isConnected) {
      // Has graph connections → keep
      kept.push(artist);
    } else {
      // No genres AND no connections → remove
      removedNoGenresNoConnections++;
    }
  }
}

const totalAfter = kept.length;
const totalRemoved = totalBefore - totalAfter;

// ── Filter connections ───────────────────────────────────────────────────────
const keptIds = new Set(kept.map(a => a.id));
const filteredConnections = connections.filter(
  conn => keptIds.has(conn.source_id) && keptIds.has(conn.target_id),
);
const connectionsAfter = filteredConnections.length;
const connectionsRemoved = connectionsBefore - connectionsAfter;

// ── Write output ─────────────────────────────────────────────────────────────
writeFileSync(ARTISTS_PATH, JSON.stringify(kept, null, 2), 'utf8');
writeFileSync(CONNECTIONS_PATH, JSON.stringify(filteredConnections, null, 2), 'utf8');

// ── Report ───────────────────────────────────────────────────────────────────
console.log('=== Artist Cleanup Report ===');
console.log(`Artists before : ${totalBefore.toLocaleString()}`);
console.log(`Artists after  : ${totalAfter.toLocaleString()}`);
console.log(`Artists removed: ${totalRemoved.toLocaleString()}`);
console.log('');
console.log('Breakdown by removal reason:');
console.log(`  All genres non-music (blocklist)  : ${removedAllBlocklisted.toLocaleString()}`);
console.log(`  No genres + no connections        : ${removedNoGenresNoConnections.toLocaleString()}`);
console.log('');
console.log('=== Connection Cleanup Report ===');
console.log(`Connections before : ${connectionsBefore.toLocaleString()}`);
console.log(`Connections after  : ${connectionsAfter.toLocaleString()}`);
console.log(`Connections removed: ${connectionsRemoved.toLocaleString()}`);
