// NOTE: Spotify integration is currently disabled in the browser.
// The client secret is intentionally NOT prefixed with VITE_ to prevent bundling.
// To re-enable, implement a server-side proxy for token exchange.
import { useMemo } from 'react';

export function useSpotifyMatch(artist) {
  const spotifySearchUrl = useMemo(() => {
    const q = encodeURIComponent(artist?.name || '');
    return q ? `https://open.spotify.com/search/${q}` : null;
  }, [artist?.name]);

  return { loading: false, error: null, match: null, spotifySearchUrl };
}
