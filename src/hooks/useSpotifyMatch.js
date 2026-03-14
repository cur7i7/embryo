import { useEffect, useMemo, useRef, useState } from 'react';

const CACHE_KEY = 'embryo-spotify-cache:v1';
const CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days
const memoryCache = new Map();

function normalize(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function loadPersistentCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    for (const [artistId, item] of Object.entries(parsed)) {
      if (!item?.updatedAt) continue;
      if (Date.now() - item.updatedAt > CACHE_TTL_MS) continue;
      memoryCache.set(artistId, item);
    }
  } catch {
    // ignore malformed cache
  }
}

function persistCache() {
  try {
    const data = Object.fromEntries(memoryCache.entries());
    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
  } catch {
    // storage full or blocked
  }
}

let loadedPersistent = false;
let tokenCache = null;

async function getSpotifyToken(clientId, clientSecret) {
  if (!clientId || !clientSecret) return null;
  const now = Date.now();
  if (tokenCache && tokenCache.expiresAt > now + 5000) return tokenCache.token;

  const basic = btoa(`${clientId}:${clientSecret}`);
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  if (!res.ok) throw new Error(`Spotify auth failed (${res.status})`);
  const json = await res.json();
  tokenCache = {
    token: json.access_token,
    expiresAt: now + (json.expires_in || 3600) * 1000,
  };
  return tokenCache.token;
}

function scoreTrack(track, artistNameNorm, artistGenresNorm) {
  const trackArtistNames = (track.artists || []).map((a) => normalize(a.name));
  let score = 0;
  if (trackArtistNames.includes(artistNameNorm)) score += 6;
  if (trackArtistNames.some((n) => n.includes(artistNameNorm) || artistNameNorm.includes(n))) score += 4;
  if (track.preview_url) score += 3;
  if (track.popularity) score += Math.min(track.popularity / 25, 3);

  // Lightweight genre hint via artist names matching genre tokens in title.
  const titleNorm = normalize(track.name);
  if (artistGenresNorm.some((g) => g && titleNorm.includes(g))) score += 1;
  return score;
}

export function useSpotifyMatch(artist) {
  const [state, setState] = useState({
    loading: false,
    error: null,
    match: null,
  });
  const requestIdRef = useRef(0);

  const spotifySearchUrl = useMemo(() => {
    const q = encodeURIComponent(artist?.name || '');
    return q ? `https://open.spotify.com/search/${q}` : null;
  }, [artist?.name]);

  useEffect(() => {
    if (!loadedPersistent) {
      loadedPersistent = true;
      loadPersistentCache();
    }
  }, []);

  useEffect(() => {
    if (!artist?.id || !artist?.name) {
      setState({ loading: false, error: null, match: null });
      return;
    }

    const cached = memoryCache.get(artist.id);
    if (cached && Date.now() - cached.updatedAt < CACHE_TTL_MS) {
      setState({ loading: false, error: null, match: cached });
      return;
    }

    const clientId = import.meta.env.VITE_SPOTIFY_CLIENT_ID;
    // Security: The client secret must NOT use the VITE_ prefix, which would
    // cause Vite to bundle it into the client-side JavaScript. We read from a
    // non-prefixed env var that Vite intentionally excludes from the bundle.
    // In practice this means the token exchange cannot run in the browser —
    // a server-side proxy should be used instead.
    const clientSecret = import.meta.env.SPOTIFY_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      setState({ loading: false, error: null, match: null });
      return;
    }

    let cancelled = false;
    const currentRequestId = ++requestIdRef.current;
    setState((prev) => ({ ...prev, loading: true, error: null }));

    (async () => {
      try {
        const token = await getSpotifyToken(clientId, clientSecret);
        if (!token) throw new Error('Missing Spotify token');

        const query = encodeURIComponent(artist.name);
        const url = `https://api.spotify.com/v1/search?q=${query}&type=track&limit=12`;
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error(`Spotify search failed (${res.status})`);
        const data = await res.json();
        const tracks = data?.tracks?.items || [];
        if (!tracks.length) {
          if (!cancelled && requestIdRef.current === currentRequestId) {
            setState({ loading: false, error: null, match: null });
          }
          return;
        }

        const artistNameNorm = normalize(artist.name);
        const artistGenresNorm = (artist.genres || []).map(normalize).filter(Boolean);
        const best = [...tracks].sort(
          (a, b) =>
            scoreTrack(b, artistNameNorm, artistGenresNorm) -
            scoreTrack(a, artistNameNorm, artistGenresNorm)
        )[0];

        const match = {
          trackId: best.id,
          trackName: best.name,
          trackArtist: (best.artists || []).map((a) => a.name).join(', '),
          previewUrl: best.preview_url || null,
          externalUrl: best.external_urls?.spotify || null,
          embedUrl: `https://open.spotify.com/embed/track/${best.id}?utm_source=generator`,
          updatedAt: Date.now(),
        };

        memoryCache.set(artist.id, match);
        persistCache();
        if (!cancelled && requestIdRef.current === currentRequestId) {
          setState({ loading: false, error: null, match });
        }
      } catch (error) {
        if (!cancelled && requestIdRef.current === currentRequestId) {
          setState({ loading: false, error: error?.message || 'Spotify lookup failed', match: null });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [artist]);

  return {
    ...state,
    spotifySearchUrl,
  };
}

