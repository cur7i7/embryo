import { readFileSync } from 'fs';

const data = JSON.parse(readFileSync('./public/data/artists_final.json', 'utf8'));

// Non-musical genre keywords — these should NEVER appear in a musician's genre list
const NON_MUSIC_GENRES = [
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
  'anti-humor',
];

// Find artists whose ONLY genres are non-musical
const nonMusicians = [];
const suspiciousOther = [];

for (const a of data) {
  if (!a.genres || a.genres.length === 0) continue;

  const lowerGenres = a.genres.map(g => g.toLowerCase());

  // Check if ALL genres are non-musical
  const allNonMusic = lowerGenres.every(g => {
    return NON_MUSIC_GENRES.some(nm => g.includes(nm));
  });

  if (allNonMusic) {
    nonMusicians.push(a);
  }
}

console.log(`Artists with ONLY non-musical genres: ${nonMusicians.length}`);
nonMusicians.forEach(a => {
  console.log(`  ${a.name} — genres: [${a.genres.join(', ')}] — city: ${a.birth_city || '?'}`);
});

// Also find 1611 unique genres — which ones look non-musical?
const allGenres = {};
for (const a of data) {
  if (a.genres) {
    for (const g of a.genres) {
      allGenres[g.toLowerCase()] = (allGenres[g.toLowerCase()] || 0) + 1;
    }
  }
}

// Find genres that don't look musical at all
const MUSIC_INDICATORS = [
  'music', 'rock', 'pop', 'jazz', 'blues', 'folk', 'country', 'hip', 'rap',
  'soul', 'funk', 'disco', 'reggae', 'metal', 'punk', 'electronic', 'techno',
  'house', 'dance', 'classical', 'opera', 'symphony', 'beat', 'wave', 'ska',
  'gospel', 'r&b', 'swing', 'bop', 'fusion', 'indie', 'garage', 'grunge',
  'ambient', 'trance', 'dubstep', 'drum', 'bass', 'synth', 'song', 'sing',
  'vocal', 'choir', 'choral', 'hymn', 'liturgi', 'chanson', 'schlager',
  'samba', 'bossa', 'salsa', 'cumbia', 'tango', 'flamenco', 'fado',
  'merengue', 'bachata', 'reggaeton', 'latin', 'kpop', 'jpop', 'cantopop',
  'mandopop', 'enka', 'estrada', 'filmi', 'bhangra', 'qawwali', 'raga',
  'carnatic', 'hindustani', 'gamelan', 'mugham', 'maqam', 'oud',
  'grime', 'drill', 'trap', 'crunk', 'bounce', 'gangsta', 'diss',
  'motet', 'mass', 'cantata', 'sonata', 'concerto', 'fugue', 'aria',
  'acoustic', 'guitar', 'piano', 'violin', 'cello', 'trumpet', 'saxophone',
  'harmonica', 'banjo', 'ukulele', 'mandolin', 'accordion', 'organ',
  'ballad', 'lullaby', 'anthem', 'march', 'waltz', 'polka', 'mazurka',
  'bluegrass', 'americana', 'alt', 'lo-fi', 'noise', 'shoegaze',
  'post-', 'neo-', 'new age', 'world', 'arab', 'afro', 'celtic',
  'dub', 'breakbeat', 'idm', 'glitch', 'chiptune', 'vaporwave',
  'emo', 'screamo', 'hardcore', 'grindcore', 'black metal', 'death metal',
  'doom', 'stoner', 'sludge', 'thrash', 'speed metal', 'power metal',
  'musical', 'soundtrack', 'film score', 'video game',
  'spoken word', 'stand-up comedy', 'experimental',
  'ranchera', 'corrido', 'norteño', 'mariachi', 'tejano',
  'dangdut', 'koplo', 'brega', 'pagode', 'axé', 'forró', 'sertanejo',
  'baile', 'dembow', 'perreo',
  'christian', 'worship',
  'ars nova', 'ars antiqua', 'gregorian', 'plainchant', 'trecento',
  'burgundian', 'renaissance', 'baroque', 'romantic', 'impressionist',
  'serial', 'atonal', 'minimalist', 'spectral', 'aleatoric',
  'cantiga', 'troubadour', 'trouvère', 'minnesang',
  'cantus firmus', 'polyphon', 'counterpoint',
  'church', 'sacred', 'ruba',
];

console.log('\n--- Genres that look NON-musical ---');
const sorted = Object.entries(allGenres).sort((a,b) => b[1] - a[1]);
const nonMusicalGenres = sorted.filter(([g]) => {
  return !MUSIC_INDICATORS.some(m => g.includes(m));
});
console.log(`Genres not matching any music indicator: ${nonMusicalGenres.length}`);
nonMusicalGenres.forEach(([g, c]) => console.log(`  ${c}x ${g}`));
