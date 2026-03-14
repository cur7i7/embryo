// WARNING: Bucket iteration order matters for substring matching.
// Longer/more-specific keywords must appear before shorter ones within each
// bucket, AND buckets whose keywords are substrings of another bucket's
// keywords (e.g. "baroque" in Classical vs "rock" in Rock) must be listed
// first in the GENRE_BUCKETS object.  Classical appears before Rock for this
// reason.  Do not reorder buckets or move short keywords above long ones
// without auditing for false matches.
const GENRE_BUCKETS = {
  Classical: {
    genres: [
      // existing
      'classical', 'opera', 'symphony', 'chamber', 'sacred', 'baroque', 'romantic',
      'film score', 'soundtrack', 'musical theatre', 'musical', 'choral', 'orchestral',
      'romantic period',
      // added
      'chamber music', 'neo-classical', 'twelve-tone', 'tuvan throat singing',
      'minimalism', 'impressionism', 'harpsichord', 'oratorio', 'cantata',
      'operetta', 'liturgical', 'symphonic', 'requiem', 'madrigal', 'concerto',
      'sonata', 'serial', 'ballet', 'motet', 'organ',
    ],
    color: '#912761',
  },
  'Jazz & Blues': {
    genres: [
      // existing
      'jazz', 'blues', 'funk', 'bebop', 'swing',
      'bossa nova', 'samba', 'latin jazz', 'smooth jazz', 'acid jazz', 'afrobeat',
      // added
      'boogie-woogie', 'west coast jazz', 'chicago blues', 'delta blues',
      'electric blues', 'texas blues', 'jazz fusion', 'barrelhouse', 'jump blues',
      'dixieland', 'hard bop', 'cool jazz', 'modal jazz', 'free jazz', 'big band',
      'nu jazz', 'post-bop', 'stride',
    ],
    color: '#FFBA52',
  },
  Rock: {
    genres: [
      // existing
      'rock', 'metal', 'punk', 'alternative', 'grunge', 'hard rock',
      'new wave', 'post-punk', 'shoegaze', 'britpop', 'garage', 'surf', 'psychedelic',
      'stoner', 'doom', 'sludge', 'emo',
      // added
      'progressive metal', 'symphonic metal', 'gothic metal', 'power metal',
      'thrash metal', 'death metal', 'black metal', 'glam metal', 'folk metal',
      'viking metal', 'doom metal', 'nu metal', 'post-hardcore', 'post-rock',
      'math rock', 'noise rock', 'stoner rock', 'surf rock', 'garage rock',
      'glam rock', 'psychobilly', 'rockabilly', 'metalcore', 'deathcore',
      'screamo',
    ],
    color: '#D4295E',
  },
  Electronic: {
    genres: [
      // existing
      'electronic', 'ambient', 'idm', 'house', 'techno', 'dance',
      'trip hop', 'downtempo', 'electropop', 'synth', 'drum and bass', 'dnb',
      'dubstep', 'breakbeat', 'industrial',
      // added
      'minimal techno', 'deep house', 'progressive house', 'acid house',
      'tech house', 'electroclash', 'psytrance', 'goa trance', 'future bass',
      'trap music', 'chillwave', 'synthwave', 'vaporwave', 'darkwave',
      'hardstyle', 'new age', 'chiptune', 'glitch', 'gabber', 'electro',
    ],
    color: '#D0DF00',
  },
  'Hip-hop': {
    genres: [
      // existing
      'hip-hop', 'rap',
      'grime', 'drill', 'trap', 'crunk', 'bounce', 'chopped and screwed',
      // added
      'east coast hip hop', 'west coast hip hop', 'southern hip hop',
      'underground hip hop', 'conscious rap', 'gangsta rap', 'mumble rap',
      'cloud rap', 'dirty south', 'boom bap', 'rapping', 'phonk',
    ],
    color: '#F4762D',
  },
  'Pop & Soul': {
    genres: [
      // existing
      'pop', 'disco', 'r&b', 'gospel', 'soul',
      'cantopop', 'mandopop', 'j-pop', 'k-pop', 'c-pop', 'schlager', 'chanson',
      'ballad', 'adult contemporary', 'euro', 'enka',
      // added
      'bubblegum pop', 'easy listening', 'anime song', 'dance-pop', 'europop',
      'synthpop', 'post-punk', 'dark wave', 'yacht rock', 'city pop',
      'adult contemporary', 'soft rock', 'power pop', 'teen pop', 'new wave',
    ],
    color: '#DB608F',
  },
  'Folk & Country': {
    genres: [
      // existing
      'country', 'folk', 'bluegrass', 'americana', 'traditional folk',
      // added
      'singer-songwriter', 'irish traditional', 'outlaw country', 'western swing',
      'country rock', 'country pop', 'honky-tonk', 'alt-country', 'appalachian',
      'anti-folk', 'cowpunk', 'neofolk', 'celtic',
    ],
    color: '#ADA400',
  },
  'World & Latin': {
    genres: [
      // existing
      'world music', 'world', 'arabic', 'afro', 'reggae', 'ska', 'dancehall',
      'reggaeton', 'latin', 'salsa', 'merengue', 'cumbia', 'bachata', 'tango',
      'flamenco', 'fado', 'música popular brasileira', 'popular music',
      'video game music', 'experimental',
      // added
      'tuvan throat singing', 'filmi music', 'hindustani', 'carnatic',
      'afrobeats', 'amapiano', 'vallenato', 'corrido', 'ranchera',
      'klezmer', 'estrada', 'norteño', 'gamelan', 'qawwali', 'gnawa',
      'griot', 'highlife', 'mbalax', 'soukous', 'romani', 'huayno',
      'zouk', 'zydeco', 'cajun', 'maqam', 'chaabi', 'juju', 'enka',
      'rai',
    ],
    color: '#C34121',
  },
  Other: { genres: [], color: '#FFCB78' },
};

// Pre-compile RegExp patterns for short keywords (≤4 chars) so we don't
// rebuild the same RegExp on every call to getGenreBucket().
const COMPILED_BUCKETS = Object.entries(GENRE_BUCKETS)
  .filter(([name]) => name !== 'Other')
  .map(([name, data]) => {
    const compiledPatterns = data.genres
      .filter((g) => g.length <= 4)
      .map((g) => {
        const escaped = g.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return {
          keyword: g,
          re: new RegExp(`(?:^|[\\s\\-\\/,])${escaped}(?:$|[\\s\\-\\/,])`, 'i'),
        };
      });
    const longKeywords = data.genres.filter((g) => g.length > 4);
    return { name, color: data.color, longKeywords, compiledPatterns };
  });

export function getGenreBucket(genres) {
  if (!genres || genres.length === 0) {
    return { bucket: 'Other', color: GENRE_BUCKETS.Other.color };
  }

  for (const genre of genres) {
    const lowerGenre = genre.toLowerCase();

    // Pass 1 — exact match across all buckets.
    // Handles cases like "yacht rock" (Pop & Soul) which would otherwise be
    // caught by Rock's shorter "rock" keyword in pass 2.
    for (const bucket of COMPILED_BUCKETS) {
      for (const kw of bucket.longKeywords) {
        if (lowerGenre === kw) {
          return { bucket: bucket.name, color: bucket.color };
        }
      }
    }

    // Pass 2 — substring / word-boundary match across all buckets.
    // Longer/more-specific keywords are listed first in each array so that a
    // specific match wins over a generic one within the same bucket.
    // Bucket order also matters: Classical before Rock (baroque), etc.
    // See the file header comment for full ordering documentation.
    for (const bucket of COMPILED_BUCKETS) {
      for (const kw of bucket.longKeywords) {
        if (lowerGenre.includes(kw)) {
          return { bucket: bucket.name, color: bucket.color };
        }
      }
      for (const { re } of bucket.compiledPatterns) {
        if (re.test(lowerGenre)) {
          return { bucket: bucket.name, color: bucket.color };
        }
      }
    }
  }

  return { bucket: 'Other', color: GENRE_BUCKETS.Other.color };
}

/**
 * Returns a text color ('#FAF3EB' cream or '#1A1512' near-black) that has
 * better WCAG contrast against the given hex background color.
 */
export function getTextColorForBg(hexColor) {
  const r = parseInt(hexColor.slice(1, 3), 16) / 255;
  const g = parseInt(hexColor.slice(3, 5), 16) / 255;
  const b = parseInt(hexColor.slice(5, 7), 16) / 255;

  // sRGB to linear
  const toLinear = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const L = 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);

  // Relative luminance of the two candidate text colors
  const lCream = 0.2126 * toLinear(0xFA / 255) + 0.7152 * toLinear(0xF3 / 255) + 0.0722 * toLinear(0xEB / 255);
  const lDark = 0.2126 * toLinear(0x1A / 255) + 0.7152 * toLinear(0x15 / 255) + 0.0722 * toLinear(0x12 / 255);

  const contrastCream = (Math.max(lCream, L) + 0.05) / (Math.min(lCream, L) + 0.05);
  const contrastDark = (Math.max(lDark, L) + 0.05) / (Math.min(lDark, L) + 0.05);

  return contrastCream >= contrastDark ? '#FAF3EB' : '#1A1512';
}

export { GENRE_BUCKETS };
