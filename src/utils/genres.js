const GENRE_BUCKETS = {
  Classical: { genres: ['classical', 'opera', 'symphony', 'chamber', 'sacred', 'baroque', 'romantic'], color: '#912761' },
  'Jazz/Blues': { genres: ['jazz', 'blues', 'funk', 'bebop', 'swing'], color: '#D4295E' },
  Rock: { genres: ['rock', 'metal', 'punk', 'alternative', 'grunge', 'hard rock'], color: '#F4762D' },
  Electronic: { genres: ['electronic', 'ambient', 'idm', 'house', 'techno', 'dance'], color: '#DB608F' },
  'Hip-hop': { genres: ['hip-hop', 'rap'], color: '#FFBA52' },
  'Pop/Soul': { genres: ['pop', 'disco', 'r&b', 'gospel', 'soul'], color: '#FF7276' },
  Other: { genres: [], color: '#E8A99B' },
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
        if (g.length >= 3 && (lowerGenre.includes(g) || g.includes(lowerGenre))) {
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
