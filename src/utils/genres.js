const GENRE_BUCKETS = {
  Classical: {
    genres: [
      'classical', 'opera', 'symphony', 'chamber', 'sacred', 'baroque', 'romantic',
      'film score', 'soundtrack', 'musical theatre', 'musical', 'choral', 'orchestral',
      'romantic period',
    ],
    color: '#912761',
  },
  'Jazz & Blues': {
    genres: [
      'jazz', 'blues', 'funk', 'bebop', 'swing',
      'bossa nova', 'samba', 'latin jazz', 'smooth jazz', 'acid jazz', 'afrobeat',
    ],
    color: '#FFBA52',
  },
  Rock: {
    genres: [
      'rock', 'metal', 'punk', 'alternative', 'grunge', 'hard rock',
      'new wave', 'post-punk', 'shoegaze', 'britpop', 'garage', 'surf', 'psychedelic',
      'stoner', 'doom', 'sludge', 'emo',
    ],
    color: '#D4295E',
  },
  Electronic: {
    genres: [
      'electronic', 'ambient', 'idm', 'house', 'techno', 'dance',
      'trip hop', 'downtempo', 'electropop', 'synth', 'drum and bass', 'dnb',
      'dubstep', 'breakbeat', 'industrial',
    ],
    color: '#D0DF00',
  },
  'Hip-hop': {
    genres: [
      'hip-hop', 'rap',
      'grime', 'drill', 'trap', 'crunk', 'bounce', 'chopped and screwed',
    ],
    color: '#F4762D',
  },
  'Pop & Soul': {
    genres: [
      'pop', 'disco', 'r&b', 'gospel', 'soul',
      'cantopop', 'mandopop', 'j-pop', 'k-pop', 'c-pop', 'schlager', 'chanson',
      'ballad', 'adult contemporary', 'euro', 'enka',
    ],
    color: '#DB608F',
  },
  'Folk & Country': {
    genres: [
      'country', 'folk', 'bluegrass', 'americana', 'traditional folk',
    ],
    color: '#ADA400',
  },
  'World & Latin': {
    genres: [
      'world music', 'world', 'arabic', 'afro', 'reggae', 'ska', 'dancehall',
      'reggaeton', 'latin', 'salsa', 'merengue', 'cumbia', 'bachata', 'tango',
      'flamenco', 'fado', 'música popular brasileira', 'popular music',
      'video game music', 'experimental',
    ],
    color: '#C34121',
  },
  Other: { genres: [], color: '#FFCB78' },
};

export function getGenreBucket(genres) {
  if (!genres || genres.length === 0) {
    return { bucket: 'Other', color: GENRE_BUCKETS.Other.color };
  }

  for (const genre of genres) {
    const lowerGenre = genre.toLowerCase();
    for (const [bucketName, bucketData] of Object.entries(GENRE_BUCKETS)) {
      if (bucketName === 'Other') continue;
      for (const g of bucketData.genres) {
        const matches = g.length <= 4
          ? (() => { const escaped = g.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); return new RegExp(`(?:^|[\\s\\-\\/,])${escaped}(?:$|[\\s\\-\\/,])`, 'i').test(lowerGenre); })()
          : lowerGenre.includes(g);
        if (matches) {
          return { bucket: bucketName, color: bucketData.color };
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
