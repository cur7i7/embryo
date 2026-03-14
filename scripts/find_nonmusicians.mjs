import { readFileSync } from 'fs';

const data = JSON.parse(readFileSync('./public/data/artists_final.json', 'utf8'));

// Show all fields on first artist
console.log('Fields on first artist:', Object.keys(data[0]));
console.log('Sample:', JSON.stringify(data[0], null, 2));

// Check what genres the "Other" bucket has
const otherBucket = data.filter(a => {
  if (!a.genres || a.genres.length === 0) return true;
  // Check if any genre matches known buckets
  const known = ['classical','opera','symphony','chamber','sacred','baroque','romantic',
    'film score','soundtrack','musical theatre','musical','choral','orchestral',
    'jazz','blues','funk','bebop','swing','bossa nova','samba','latin jazz',
    'rock','metal','punk','alternative','grunge','hard rock','new wave','post-punk',
    'electronic','ambient','idm','house','techno','dance','trip hop',
    'hip-hop','rap','grime','drill','trap',
    'pop','disco','r&b','gospel','soul','k-pop','j-pop',
    'country','folk','bluegrass','americana',
    'world','reggae','ska','latin','salsa','tango','flamenco','fado',
    'experimental'];
  const lowerGenres = a.genres.map(g => g.toLowerCase());
  for (const g of lowerGenres) {
    for (const k of known) {
      if (g.includes(k)) return false;
    }
  }
  return true;
});

console.log('\n"Other" bucket artists:', otherBucket.length);
console.log('\nSample Other artists (first 40):');
otherBucket.slice(0, 40).forEach(a => {
  console.log(`  ${a.name} — genres: [${(a.genres || []).join(', ')}] — city: ${a.birth_city || 'unknown'}`);
});

// Search for "minister" in names or any field
console.log('\n--- Searching for potential non-musicians ---');
const suspects = data.filter(a => {
  const name = (a.name || '').toLowerCase();
  const genres = (a.genres || []).join(' ').toLowerCase();
  // Look for suspicious patterns
  return name.includes('minister') || name.includes('bishop') ||
         name.includes('reverend') || name.includes('pastor') ||
         genres.includes('christian') || genres.includes('worship') ||
         genres.includes('minister');
});
console.log('Matches with minister/bishop/reverend/pastor/christian/worship:', suspects.length);
suspects.slice(0, 20).forEach(a => {
  console.log(`  ${a.name} — genres: [${(a.genres || []).join(', ')}]`);
});

// Count artists with no genres at all
const noGenres = data.filter(a => !a.genres || a.genres.length === 0);
console.log('\nArtists with NO genres:', noGenres.length);
noGenres.slice(0, 20).forEach(a => {
  console.log(`  ${a.name} — city: ${a.birth_city || 'unknown'}`);
});

// Look for genres that seem non-musical
const allGenres = {};
for (const a of data) {
  if (a.genres) {
    for (const g of a.genres) {
      allGenres[g] = (allGenres[g] || 0) + 1;
    }
  }
}
const sortedGenres = Object.entries(allGenres).sort((a,b) => b[1] - a[1]);
console.log('\nAll unique genres (top 80):');
sortedGenres.slice(0, 80).forEach(([g, c]) => console.log(`  ${c}x ${g}`));
console.log('\n... total unique genres:', sortedGenres.length);
console.log('\nAll genres (bottom 80 - rarest):');
sortedGenres.slice(-80).forEach(([g, c]) => console.log(`  ${c}x ${g}`));
