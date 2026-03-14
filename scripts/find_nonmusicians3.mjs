import { readFileSync } from 'fs';

const data = JSON.parse(readFileSync('./public/data/artists_final.json', 'utf8'));
const conns = JSON.parse(readFileSync('./public/data/connections_final.json', 'utf8'));

// Martin Luther check
const luther = data.find(a => a.name === 'Martin Luther');
if (luther) {
  console.log('Martin Luther found:', JSON.stringify(luther, null, 2));
}

// Connection set
const connSet = new Set();
for (const c of conns) {
  connSet.add(c.source_id);
  connSet.add(c.target_id);
}

const noGenre = data.filter(a => {
  const g = a.genres;
  return !g || g.length === 0;
});
const noGenreWithConn = noGenre.filter(a => connSet.has(a.id));
const noGenreNoConn = noGenre.filter(a => !connSet.has(a.id));
console.log('\nNo-genre artists:', noGenre.length);
console.log('  with connections:', noGenreWithConn.length);
console.log('  without connections:', noGenreNoConn.length);

// The 92 non-musicians by genre — do they have connections?
const NON_MUSIC_GENRES_ONLY = [
  'portrait', 'religious art', 'religious painting', 'animal art', 'figure',
  'nude', 'landscape art', 'sculpture', 'still life',
  'narrative poetry', 'chivalric romance', 'poetry', 'novel', 'fiction',
  'science fiction', 'fantasy', 'horror fiction', 'speculative fiction',
  'ghost story', 'alternate history', 'mystery fiction', 'crime fiction',
  'romance novel', 'thriller', 'detective fiction',
  'painting', 'fresco', 'engraving', 'printmaking', 'woodcut',
  'architecture', 'calligraphy',
  'chess', 'football', 'cricket', 'tennis', 'athletics',
  'pornography genre', 'gore film', 'short film', 'vlog',
  "let's play", 'dance video game', 'music video game',
  'anti-humor', 'non-fiction', 'novella', 'drama fiction',
  'epistolary novel', 'lyric poetry', 'history painting', 'landscape painting',
  'pop novel', 'feminist science fiction', 'utopian and dystopian fiction',
  'psychological novel', 'thesis novel', 'crime novel', 'fantasy novel',
  'art of poetry', 'prose poetry', 'magic realist fiction',
  'fiction literature', 'wuxia novel', 'telenovela',
  'gothic novel', 'dictator novel', 'fantasy comedy',
  'military science fiction', 'science fiction literature',
  'dystopian fiction', 'post-apocalyptic fiction',
  'historical fiction', 'children\'s fiction',
  'noir novel', 'thriller novel',
  'adventure fiction',
  'art of sculpture', 'portrait photography',
  'mythological painting',
  'alternate history', 'recursive science fiction',
  'non-fiction literature', 'short novel',
];

const nonMusicians = data.filter(a => {
  if (!a.genres || a.genres.length === 0) return false;
  return a.genres.every(g => {
    const lg = g.toLowerCase();
    return NON_MUSIC_GENRES_ONLY.some(nm => lg.includes(nm));
  });
});

const nmWithConn = nonMusicians.filter(a => connSet.has(a.id));
const nmNoConn = nonMusicians.filter(a => !connSet.has(a.id));
console.log('\nNon-musicians by genre:', nonMusicians.length);
console.log('  with connections:', nmWithConn.length);
console.log('  without connections:', nmNoConn.length);

console.log('\nNon-musicians WITH connections:');
nmWithConn.forEach(a => {
  const ac = conns.filter(c => c.source_id === a.id || c.target_id === a.id);
  const peers = ac.map(c => {
    const peerId = c.source_id === a.id ? c.target_id : c.source_id;
    const peer = data.find(x => x.id === peerId);
    return peer ? peer.name : peerId;
  });
  console.log(`  ${a.name} — [${a.genres.join(', ')}] — connected to: ${peers.join(', ')}`);
});

// Summary: total to remove
const toRemove = new Set();
// 1. Non-musicians by genre (no connections)
for (const a of nmNoConn) toRemove.add(a.id);
// 2. No-genre, no connections
for (const a of noGenreNoConn) toRemove.add(a.id);

console.log('\n=== CLEANUP SUMMARY ===');
console.log('Non-musicians (genre-only, no conns):', nmNoConn.length);
console.log('No-genre, no connections:', noGenreNoConn.length);
console.log('Total safe to remove:', toRemove.size);
console.log('Remaining dataset size:', data.length - toRemove.size);
console.log('\nKeeping but flagged:');
console.log('  Non-musicians WITH connections:', nmWithConn.length, '(keep — they connect to real musicians)');
console.log('  No-genre WITH connections:', noGenreWithConn.length, '(keep — they are connected to musicians)');
