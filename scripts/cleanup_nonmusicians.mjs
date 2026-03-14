/**
 * EMBRYO Data Cleanup — Round 2: Remove non-musicians
 *
 * Targets:
 * 1. Artists whose genres are ALL non-musical (painters, novelists, chess players, etc.)
 * 2. Artists with no genres AND no connections (can't verify they're musicians)
 *
 * Keeps:
 * - Artists with at least one musical genre
 * - No-genre artists WITH connections (connected to verified musicians)
 */
import { readFileSync, writeFileSync } from 'fs';

const artists = JSON.parse(readFileSync('./public/data/artists_final.json', 'utf8'));
const connections = JSON.parse(readFileSync('./public/data/connections_final.json', 'utf8'));

console.log(`Starting cleanup: ${artists.length} artists, ${connections.length} connections`);

// Build connection set
const connectedIds = new Set();
for (const c of connections) {
  connectedIds.add(c.source_id);
  connectedIds.add(c.target_id);
}

// Non-musical genre keywords — if ALL of an artist's genres match these, they're not a musician
const NON_MUSIC_GENRE_PATTERNS = [
  // Visual arts
  'portrait', 'religious art', 'religious painting', 'animal art', 'figure painting',
  'nude', 'landscape art', 'landscape painting', 'sculpture', 'still life',
  'painting', 'fresco', 'engraving', 'printmaking', 'woodcut', 'figurative art',
  'abstract art', 'calligraphy', 'art of sculpture', 'portrait photography',
  'mythological painting', 'history painting', 'genre art', 'conceptual art',
  'self-portrait', 'public art', 'installation art', 'land art', 'video art',
  'graffiti', 'cityscape', 'caricature',

  // Literature & fiction
  'narrative poetry', 'chivalric romance', 'novel', 'fiction',
  'science fiction', 'fantasy', 'horror fiction', 'speculative fiction',
  'ghost story', 'alternate history', 'mystery fiction', 'crime fiction',
  'romance novel', 'thriller', 'detective fiction', 'gothic novel',
  'non-fiction', 'novella', 'drama fiction', 'epistolary novel',
  'lyric poetry', 'pop novel', 'feminist science fiction',
  'utopian and dystopian fiction', 'psychological novel', 'thesis novel',
  'crime novel', 'fantasy novel', 'art of poetry', 'prose poetry',
  'magic realist fiction', 'fiction literature', 'wuxia novel',
  'dictator novel', 'fantasy comedy', 'military science fiction',
  'science fiction literature', 'dystopian fiction', 'post-apocalyptic fiction',
  'historical fiction', "children's fiction", 'noir novel', 'thriller novel',
  'adventure fiction', 'non-fiction literature', 'short novel',
  'children\'s literature', 'young adult literature', 'comic novel',
  'spy fiction', 'dark fantasy', 'urban fantasy', 'weird fiction',
  'lovecraftian horror', 'body horror literature', 'cosmicism',
  'gothic literature', 'horror literature', 'crime literature',
  'historical prose literature', 'bildungsroman', 'picaresque novel',
  'social novel', 'epistolary fiction', 'epistolary literature',
  'fantasy literature', 'supernatural fiction', 'lesbian literature',
  'recursive science fiction', 'holocaust literature', 'war novel',
  'travel literature', 'business literature', 'dystopian literature',
  'apocalyptic literature', 'contemporary fantasy', 'juvenile fantasy',
  'erotic literature', 'chick lit', 'historical novel', 'western novel',
  'historical romance',

  // Poetry (non-sung)
  'confessional poetry', 'free verse', 'long poem', 'concrete poetry',
  'sound poetry', 'nature poetry', 'occasional poem', 'religious poem',

  // Journalism & essays
  'essay', 'opinion journalism', 'journalism', 'reportage',
  'literary criticism', 'feuilleton', 'editorial', 'investigative journalism',
  'political journalism', 'current affairs', 'column', 'interview',
  'creative nonfiction', 'documentary literature',

  // Film genres (when sole genre — not soundtrack/score)
  'drama film', 'action film', 'comedy film', 'thriller film',
  'crime film', 'horror film', 'western film', 'adventure film',
  'fantasy film', 'mystery film', 'science fiction film',
  'war film', 'historical drama film', 'crime drama film',
  'crime thriller film', 'gothic film', 'gothic horror film',
  'supernatural horror film', 'body horror film', 'psychological horror film',
  'psychological thriller film', 'psychological drama film',
  'romance film', 'gangster film', 'sport film', 'film noir',
  'science fiction horror film', 'comedy horror film', 'black comedy film',
  'slasher film', 'spaghetti western', 'silent film', 'independent film',
  'art film', 'documentary film', 'italian neorealism',
  'action comedy film', 'anthology film', 'contemporary western film',
  'exploitation film', 'fantasy comedy film', 'girls with guns',
  'monster film', 'splatter film', 'spy film', 'teen film',
  'teen horror film', 'vigilante film', 'zombie film', 'animated film',
  'epic film', 'surrealist cinema', 'b movie', 'giallo', 'gore film',
  'short film', 'comedy drama', 'war drama', 'new hollywood',

  // TV/video
  'telenovela', 'sitcom', 'drama television series', 'vlog',
  "let's play", 'dance video game', 'music video game',

  // Comics/manga
  'comics', 'manga', 'franco-belgian comics',
  'drama anime and manga', 'slice of life anime and manga',

  // Games/sports
  'chess', 'football', 'cricket', 'tennis', 'athletics',
  'mountaineering', 'game',

  // Other non-music
  'pornography genre', 'anti-humor', 'puzzle', 'recreational mathematics',
  'conspiracy theory', 'shamanism', 'spirituality', 'environmentalist',
  'gastronomy', 'cookbook', 'guide book', 'textbook', 'how-to', 'self-help',
  'travel', 'travel book', 'travel journal', 'history book', 'history',
  'psychology', 'science', 'pedagogy', 'treaty', 'treatise', 'pamphlet',
  'annotated edition', 'micromagic', 'architecture',
];

// Check if a genre string matches any non-music pattern
function isNonMusicalGenre(genre) {
  const lg = genre.toLowerCase();
  return NON_MUSIC_GENRE_PATTERNS.some(pattern => lg === pattern || lg.includes(pattern));
}

// Categories of removal
const removedNonMusicalGenre = [];
const removedNoGenreNoConn = [];
const removeIds = new Set();

for (const a of artists) {
  const genres = a.genres || [];

  if (genres.length > 0) {
    // Has genres — check if ALL are non-musical
    if (genres.every(g => isNonMusicalGenre(g))) {
      removedNonMusicalGenre.push(a);
      removeIds.add(a.id);
    }
  } else {
    // No genres — keep only if connected to other artists
    if (!connectedIds.has(a.id)) {
      removedNoGenreNoConn.push(a);
      removeIds.add(a.id);
    }
  }
}

console.log('\n=== REMOVAL BREAKDOWN ===');
console.log(`Non-musical genres only: ${removedNonMusicalGenre.length}`);
console.log(`No genres + no connections: ${removedNoGenreNoConn.length}`);
console.log(`Total to remove: ${removeIds.size}`);

// Show what we're removing
console.log('\n--- Non-musicians by genre (sample) ---');
removedNonMusicalGenre.slice(0, 25).forEach(a => {
  console.log(`  ${a.name} — [${a.genres.join(', ')}]`);
});
if (removedNonMusicalGenre.length > 25) {
  console.log(`  ... and ${removedNonMusicalGenre.length - 25} more`);
}

// Filter datasets
const cleanedArtists = artists.filter(a => !removeIds.has(a.id));
const cleanedConnections = connections.filter(c =>
  !removeIds.has(c.source_id) && !removeIds.has(c.target_id)
);

const removedConnections = connections.length - cleanedConnections.length;

console.log('\n=== RESULTS ===');
console.log(`Artists: ${artists.length} → ${cleanedArtists.length} (removed ${removeIds.size})`);
console.log(`Connections: ${connections.length} → ${cleanedConnections.length} (removed ${removedConnections} dangling)`);

// Write cleaned files
writeFileSync('./public/data/artists_final.json', JSON.stringify(cleanedArtists));
writeFileSync('./public/data/connections_final.json', JSON.stringify(cleanedConnections));

console.log('\nFiles written successfully.');
