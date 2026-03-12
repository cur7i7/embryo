const GENRE_BUCKETS = {
  Classical: { genres: ['classical', 'opera', 'symphony', 'chamber', 'sacred', 'baroque', 'romantic'], color: '#9C27B0' },
  'Jazz/Blues': { genres: ['jazz', 'blues', 'soul', 'r&b', 'funk', 'bebop', 'swing'], color: '#C2185B' },
  Rock: { genres: ['rock', 'metal', 'punk', 'alternative', 'grunge', 'hard rock'], color: '#FF7043' },
  Electronic: { genres: ['electronic', 'ambient', 'idm', 'house', 'techno', 'dance'], color: '#FDD835' },
  'Hip-hop': { genres: ['hip-hop', 'rap'], color: '#FF8F00' },
  'Pop/Soul': { genres: ['pop', 'disco', 'r&b', 'gospel', 'soul'], color: '#AB47BC' },
  Other: { genres: [], color: '#F9A825' },
};

export function getGenreBucket(genres) {
  if (!genres || genres.length === 0) {
    return { bucket: 'Other', color: GENRE_BUCKETS.Other.color };
  }

  const firstGenre = genres[0].toLowerCase();

  for (const [bucketName, bucketData] of Object.entries(GENRE_BUCKETS)) {
    if (bucketName === 'Other') continue;
    for (const g of bucketData.genres) {
      if (firstGenre.includes(g) || g.includes(firstGenre)) {
        return { bucket: bucketName, color: bucketData.color };
      }
    }
  }

  return { bucket: 'Other', color: GENRE_BUCKETS.Other.color };
}

export { GENRE_BUCKETS };
