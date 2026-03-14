import { readFileSync } from 'fs';

const data = JSON.parse(readFileSync('./public/data/artists_final.json', 'utf8'));
const withOcc = data.filter(a => a.occupations && a.occupations.length > 0);
const withoutOcc = data.filter(a => !(a.occupations && a.occupations.length > 0));
console.log('Total artists:', data.length);
console.log('With occupations:', withOcc.length);
console.log('Without occupations:', withoutOcc.length);

const allOccs = {};
for (const a of data) {
  if (a.occupations) {
    for (const o of a.occupations) {
      allOccs[o] = (allOccs[o] || 0) + 1;
    }
  }
}
const sorted = Object.entries(allOccs).sort((a,b) => b[1] - a[1]);
console.log('\nTop 60 occupations:');
sorted.slice(0, 60).forEach(([o, c]) => console.log('  ' + c + 'x ' + o));
console.log('\n... total unique occupations:', sorted.length);

// Find non-music occupations
const NON_MUSIC_OCCUPATIONS = [
  'politician', 'minister', 'priest', 'bishop', 'pope', 'cardinal',
  'chess player', 'athlete', 'footballer', 'tennis player', 'cricketer',
  'soldier', 'general', 'admiral', 'military officer',
  'mathematician', 'physicist', 'chemist', 'biologist', 'scientist',
  'painter', 'sculptor', 'architect',
  'judge', 'lawyer', 'barrister',
  'businessman', 'merchant', 'banker', 'industrialist',
  'king', 'queen', 'emperor', 'duke', 'prince', 'princess', 'noble',
  'explorer', 'navigator',
  'philosopher',
  'physician', 'surgeon', 'doctor',
];

console.log('\n--- Non-musician occupation matches ---');
let nonMusicCount = 0;
for (const a of data) {
  if (!a.occupations) continue;
  const occs = a.occupations.map(o => o.toLowerCase());
  const hasMusicOcc = occs.some(o =>
    o.includes('music') || o.includes('singer') || o.includes('composer') ||
    o.includes('pianist') || o.includes('guitarist') || o.includes('drummer') ||
    o.includes('rapper') || o.includes('conductor') || o.includes('violinist') ||
    o.includes('cellist') || o.includes('organist') || o.includes('vocalist') ||
    o.includes('disc jockey') || o.includes('dj') || o.includes('songwriter') ||
    o.includes('lyricist') || o.includes('record producer') || o.includes('instrumentalist') ||
    o.includes('saxophonist') || o.includes('trumpeter') || o.includes('flutist') ||
    o.includes('bass') || o.includes('opera') || o.includes('bandleader') ||
    o.includes('choirmaster') || o.includes('cantor')
  );

  if (!hasMusicOcc) {
    const hasNonMusic = occs.some(o => NON_MUSIC_OCCUPATIONS.some(nm => o.includes(nm)));
    if (hasNonMusic) {
      nonMusicCount++;
      if (nonMusicCount <= 30) {
        console.log(`  ${a.name} — occs: [${a.occupations.join(', ')}] — genres: [${(a.genres || []).join(', ')}]`);
      }
    }
  }
}
console.log(`\nTotal with non-music occupations and NO music occupation: ${nonMusicCount}`);

// Also check genre=Other with no music occupation
const otherGenreNoMusic = data.filter(a => {
  if (!a.occupations || a.occupations.length === 0) return false;
  const occs = a.occupations.map(o => o.toLowerCase());
  const hasMusicOcc = occs.some(o =>
    o.includes('music') || o.includes('singer') || o.includes('composer') ||
    o.includes('pianist') || o.includes('guitarist') || o.includes('drummer') ||
    o.includes('rapper') || o.includes('conductor') || o.includes('violinist') ||
    o.includes('cellist') || o.includes('organist') || o.includes('vocalist') ||
    o.includes('disc jockey') || o.includes('dj') || o.includes('songwriter') ||
    o.includes('lyricist') || o.includes('record producer') || o.includes('instrumentalist') ||
    o.includes('saxophonist') || o.includes('trumpeter') || o.includes('flutist') ||
    o.includes('bass') || o.includes('opera') || o.includes('bandleader') ||
    o.includes('choirmaster') || o.includes('cantor')
  );
  return !hasMusicOcc;
});
console.log(`\nAll artists with occupations but NO music-related occupation: ${otherGenreNoMusic.length}`);
console.log('Sample (first 20):');
otherGenreNoMusic.slice(0, 20).forEach(a => {
  console.log(`  ${a.name} — [${a.occupations.join(', ')}] — genres: [${(a.genres || []).join(', ')}]`);
});
