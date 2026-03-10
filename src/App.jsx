import { useEffect, useMemo, useState } from 'react'
import NetworkGraph from './components/NetworkGraph'

const YEAR_MIN = 1550
const YEAR_MAX = 2025
const PLAY_INCREMENT = 10
const PLAY_INTERVAL_MS = 2000

const EDGE_FILTERS = [
  {
    id: 'all',
    label: 'All',
    types: ['teacher', 'influence', 'peer', 'collaboration', 'rivalry'],
  },
  { id: 'teacher', label: 'Teacher→Student', types: ['teacher'] },
  { id: 'influence', label: 'Influence', types: ['influence'] },
  { id: 'friendship', label: 'Friendship', types: ['peer', 'collaboration'] },
]

const GENRE_COLORS = {
  classical: '#D7B55A',
  jazz_blues: '#5D8FA8',
  rock: '#6CA870',
  electronic: '#8B6CB0',
  hip_hop: '#B6555A',
  pop_soul: '#CB8852',
  other: '#92848E',
}

const GENRE_LABELS = {
  classical: 'Classical',
  jazz_blues: 'Jazz/Blues',
  rock: 'Rock',
  electronic: 'Electronic',
  hip_hop: 'Hip-Hop',
  pop_soul: 'Pop/Soul',
  other: 'Other',
}

const TYPE_LABELS = {
  teacher: 'Teacher→Student',
  influence: 'Influence',
  peer: 'Peer',
  collaboration: 'Collaboration',
  rivalry: 'Rivalry',
}

const normalizeText = (value) => String(value || '').toLowerCase()

const normalizeType = (value) => normalizeText(value).trim()

const inferGenreBucket = (genres) => {
  const values = (Array.isArray(genres) ? genres : []).map((genre) =>
    normalizeText(genre),
  )

  const has = (patterns) =>
    values.some((genre) => patterns.some((pattern) => genre.includes(pattern)))

  if (
    has([
      'classical',
      'baroque',
      'romantic',
      'renaissance',
      'opera',
      'symph',
      'orchestral',
      'madrigal',
      'choral',
    ])
  ) {
    return 'classical'
  }

  if (has(['jazz', 'blues', 'swing', 'bebop'])) {
    return 'jazz_blues'
  }

  if (
    has([
      'rock',
      'metal',
      'punk',
      'grunge',
      'indie rock',
      'progressive rock',
      'hard rock',
    ])
  ) {
    return 'rock'
  }

  if (has(['electronic', 'edm', 'house', 'techno', 'ambient', 'synth'])) {
    return 'electronic'
  }

  if (has(['hip hop', 'hip-hop', 'rap', 'trap'])) {
    return 'hip_hop'
  }

  if (has(['pop', 'soul', 'funk', 'disco', 'r&b'])) {
    return 'pop_soul'
  }

  return 'other'
}

const numberOrNull = (value) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

const clampYear = (value) => Math.min(YEAR_MAX, Math.max(YEAR_MIN, value))

const displayYears = (artist) => {
  const birth = numberOrNull(artist.birth_year)
  const death = numberOrNull(artist.death_year)

  if (birth && death) {
    return `${birth} - ${death}`
  }

  if (birth) {
    return `${birth} -`
  }

  if (death) {
    return `- ${death}`
  }

  return 'Unknown'
}

const activeSpan = (artist) => {
  const start = numberOrNull(artist.active_start)
  const end = numberOrNull(artist.active_end)

  if (start && end) {
    return `${start} - ${end}`
  }

  return 'Unknown'
}

const artistLocation = (artist) => {
  const city = artist.birth_city?.trim()
  const country = artist.birth_country?.trim()

  if (city && country) {
    return `${city}, ${country}`
  }

  return city || country || 'Unknown'
}

function App() {
  const [artists, setArtists] = useState([])
  const [connections, setConnections] = useState([])
  const [selectedYear, setSelectedYear] = useState(1900)
  const [edgeFilter, setEdgeFilter] = useState('all')
  const [selectedArtistName, setSelectedArtistName] = useState(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    let cancelled = false

    const loadData = async () => {
      try {
        setIsLoading(true)
        setErrorMessage('')

        const [artistsResponse, connectionsResponse] = await Promise.all([
          fetch('/data/artists_final.json'),
          fetch('/data/connections_final.json'),
        ])

        if (!artistsResponse.ok || !connectionsResponse.ok) {
          throw new Error('Unable to load dataset files from /public/data')
        }

        const [artistsRaw, connectionsRaw] = await Promise.all([
          artistsResponse.json(),
          connectionsResponse.json(),
        ])

        if (cancelled) {
          return
        }

        const normalizedArtists = (Array.isArray(artistsRaw) ? artistsRaw : [])
          .map((artist) => {
            const birthYear = numberOrNull(artist.birth_year)
            const deathYear = numberOrNull(artist.death_year)
            const inferredStart =
              numberOrNull(artist.active_start) ?? birthYear ?? YEAR_MIN
            const inferredEnd =
              numberOrNull(artist.active_end) ?? deathYear ?? YEAR_MAX
            const activeStart = clampYear(Math.min(inferredStart, inferredEnd))
            const activeEnd = clampYear(Math.max(inferredStart, inferredEnd))

            return {
              ...artist,
              name: String(artist.name || '').trim(),
              genres: Array.isArray(artist.genres) ? artist.genres : [],
              education: Array.isArray(artist.education) ? artist.education : [],
              active_start: activeStart,
              active_end: activeEnd,
              genreBucket: inferGenreBucket(artist.genres),
            }
          })
          .filter((artist) => artist.name.length > 0)

        const normalizedConnections = (Array.isArray(connectionsRaw)
          ? connectionsRaw
          : []
        )
          .map((connection) => ({
            ...connection,
            source_name: String(connection.source_name || '').trim(),
            target_name: String(connection.target_name || '').trim(),
            type: normalizeType(connection.type),
            confidence: Number(connection.confidence) || 0,
            evidence: String(connection.evidence || '').trim(),
          }))
          .filter(
            (connection) =>
              connection.source_name &&
              connection.target_name &&
              connection.source_name !== connection.target_name,
          )

        setArtists(normalizedArtists)
        setConnections(normalizedConnections)
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(error instanceof Error ? error.message : 'Unknown error')
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    loadData()

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!isPlaying) {
      return undefined
    }

    const timer = window.setInterval(() => {
      setSelectedYear((currentYear) => {
        const nextYear = Math.min(YEAR_MAX, currentYear + PLAY_INCREMENT)

        if (nextYear >= YEAR_MAX) {
          setIsPlaying(false)
        }

        return nextYear
      })
    }, PLAY_INTERVAL_MS)

    return () => window.clearInterval(timer)
  }, [isPlaying])

  const artistByName = useMemo(
    () => new Map(artists.map((artist) => [artist.name, artist])),
    [artists],
  )

  const selectedFilter =
    EDGE_FILTERS.find((filterConfig) => filterConfig.id === edgeFilter) ||
    EDGE_FILTERS[0]

  const degreeByName = useMemo(() => {
    const countByArtist = new Map(artists.map((artist) => [artist.name, 0]))

    for (const connection of connections) {
      if (countByArtist.has(connection.source_name)) {
        countByArtist.set(
          connection.source_name,
          (countByArtist.get(connection.source_name) || 0) + 1,
        )
      }

      if (countByArtist.has(connection.target_name)) {
        countByArtist.set(
          connection.target_name,
          (countByArtist.get(connection.target_name) || 0) + 1,
        )
      }
    }

    return countByArtist
  }, [artists, connections])

  const visibleArtists = useMemo(
    () =>
      artists.filter(
        (artist) =>
          selectedYear >= artist.active_start && selectedYear <= artist.active_end,
      ),
    [artists, selectedYear],
  )

  const visibleArtistNames = useMemo(
    () => new Set(visibleArtists.map((artist) => artist.name)),
    [visibleArtists],
  )

  const visibleConnections = useMemo(
    () =>
      connections.filter(
        (connection) =>
          selectedFilter.types.includes(connection.type) &&
          visibleArtistNames.has(connection.source_name) &&
          visibleArtistNames.has(connection.target_name),
      ),
    [connections, selectedFilter, visibleArtistNames],
  )

  useEffect(() => {
    if (selectedArtistName && !visibleArtistNames.has(selectedArtistName)) {
      setSelectedArtistName(null)
    }
  }, [selectedArtistName, visibleArtistNames])

  const selectedArtist = useMemo(
    () => (selectedArtistName ? artistByName.get(selectedArtistName) ?? null : null),
    [artistByName, selectedArtistName],
  )

  const selectedArtistConnections = useMemo(() => {
    if (!selectedArtist) {
      return []
    }

    return connections
      .filter(
        (connection) =>
          connection.source_name === selectedArtist.name ||
          connection.target_name === selectedArtist.name,
      )
      .map((connection) => {
        const outgoing = connection.source_name === selectedArtist.name

        return {
          ...connection,
          counterpart: outgoing ? connection.target_name : connection.source_name,
          direction: outgoing ? 'to' : 'from',
        }
      })
      .sort((a, b) => a.counterpart.localeCompare(b.counterpart))
  }, [connections, selectedArtist])

  const handleYearChange = (event) => {
    setSelectedYear(Number(event.target.value))
    setIsPlaying(false)
  }

  const handlePlayToggle = () => {
    if (isPlaying) {
      setIsPlaying(false)
      return
    }

    if (selectedYear >= YEAR_MAX) {
      setSelectedYear(YEAR_MIN)
    }

    setIsPlaying(true)
  }

  return (
    <div className="app-shell relative min-h-screen overflow-hidden text-cream">
      <div className="museum-grid pointer-events-none absolute inset-0 z-0 opacity-50" />

      <header className="relative z-10 border-b border-mesa/55 bg-burgundy/55 backdrop-blur-sm">
        <div className="mx-auto w-full max-w-[1400px] px-4 pb-5 pt-8 sm:px-6">
          <h1 className="font-display text-5xl leading-none tracking-[0.18em] text-cream sm:text-6xl">
            Embryo
          </h1>
          <p className="mt-1 font-accent text-xl italic text-cream/80">
            How music was born.
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-2">
            {EDGE_FILTERS.map((filterConfig) => {
              const isActive = edgeFilter === filterConfig.id

              return (
                <button
                  key={filterConfig.id}
                  type="button"
                  onClick={() => setEdgeFilter(filterConfig.id)}
                  className={`rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] transition-all duration-300 ${
                    isActive
                      ? 'border-cream bg-cream text-burgundy shadow-panel'
                      : 'border-mesa/70 bg-burgundy/30 text-cream hover:border-cream/70 hover:bg-mesa/25'
                  }`}
                >
                  {filterConfig.label}
                </button>
              )
            })}
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto grid w-full max-w-[1400px] grid-cols-1 gap-4 px-4 pb-40 pt-4 sm:px-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className="rounded-[1.8rem] border border-mesa/45 bg-burgundy/45 p-3 shadow-exhibit backdrop-blur-xs sm:p-4">
          <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="font-accent text-2xl tracking-[0.06em] text-cream/95">
                Year {selectedYear}
              </p>
              <p className="text-xs uppercase tracking-[0.15em] text-cream/70">
                {visibleArtists.length} active artists · {visibleConnections.length}{' '}
                visible connections
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {Object.entries(GENRE_COLORS).map(([bucket, color]) => (
                <div
                  key={bucket}
                  className="inline-flex items-center gap-1.5 rounded-full border border-mesa/60 bg-burgundy/40 px-2.5 py-1 text-[10px] uppercase tracking-[0.12em] text-cream/80"
                >
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: color }}
                  />
                  {GENRE_LABELS[bucket]}
                </div>
              ))}
            </div>
          </div>

          {isLoading ? (
            <div className="flex min-h-[460px] items-center justify-center rounded-[1.6rem] border border-mesa/45 bg-burgundy-panel/70 text-sm text-cream/80">
              Loading music genealogy data...
            </div>
          ) : errorMessage ? (
            <div className="flex min-h-[460px] items-center justify-center rounded-[1.6rem] border border-rose-300/65 bg-rose-950/35 px-6 text-center text-sm text-rose-200">
              {errorMessage}
            </div>
          ) : (
            <NetworkGraph
              artists={visibleArtists}
              connections={visibleConnections}
              degreeByName={degreeByName}
              selectedArtistName={selectedArtistName}
              onSelectArtist={setSelectedArtistName}
              genreColors={GENRE_COLORS}
            />
          )}
        </section>

        <aside className="h-full rounded-[1.8rem] border border-mesa/45 bg-burgundy/60 p-4 shadow-exhibit backdrop-blur-sm lg:max-h-[calc(100vh-260px)] lg:overflow-y-auto">
          <h2 className="font-accent text-3xl text-cream/95">Artist Detail</h2>

          {!selectedArtist ? (
            <p className="mt-4 text-sm leading-relaxed text-cream/78">
              Select a node in the network to inspect biographical details and read
              evidence-backed links across musical lineages.
            </p>
          ) : (
            <div className="mt-4 space-y-4 text-sm text-cream/90">
              <div>
                <p className="font-display text-2xl tracking-[0.04em] text-cream">
                  {selectedArtist.name}
                </p>
                <p className="mt-1 text-xs uppercase tracking-[0.14em] text-cream/70">
                  Lifespan {displayYears(selectedArtist)} · Active{' '}
                  {activeSpan(selectedArtist)}
                </p>
              </div>

              <dl className="space-y-3">
                <div>
                  <dt className="text-[11px] uppercase tracking-[0.15em] text-cream/65">
                    Birthplace
                  </dt>
                  <dd>{artistLocation(selectedArtist)}</dd>
                </div>

                <div>
                  <dt className="text-[11px] uppercase tracking-[0.15em] text-cream/65">
                    Genres
                  </dt>
                  <dd>
                    {selectedArtist.genres.length > 0
                      ? selectedArtist.genres.join(', ')
                      : 'Unknown'}
                  </dd>
                </div>

                <div>
                  <dt className="text-[11px] uppercase tracking-[0.15em] text-cream/65">
                    Education
                  </dt>
                  <dd>
                    {selectedArtist.education.length > 0
                      ? selectedArtist.education.join(', ')
                      : 'Unknown'}
                  </dd>
                </div>
              </dl>

              <section>
                <p className="mb-2 text-[11px] uppercase tracking-[0.15em] text-cream/65">
                  Connections ({selectedArtistConnections.length})
                </p>

                {selectedArtistConnections.length === 0 ? (
                  <p className="text-sm text-cream/78">No known connections.</p>
                ) : (
                  <ul className="space-y-2.5">
                    {selectedArtistConnections.map((connection, index) => (
                      <li
                        key={`${connection.source_name}-${connection.target_name}-${connection.type}-${index}`}
                        className="rounded-2xl border border-mesa/45 bg-burgundy-panel/45 px-3 py-2.5"
                      >
                        <p className="text-xs uppercase tracking-[0.12em] text-cream/78">
                          {TYPE_LABELS[connection.type] || connection.type} {connection.direction}{' '}
                          <span className="font-semibold text-cream">
                            {connection.counterpart}
                          </span>
                          {Number.isFinite(connection.confidence) &&
                            connection.confidence > 0 && (
                              <span className="ml-1 text-cream/65">
                                · confidence {connection.confidence.toFixed(2)}
                              </span>
                            )}
                        </p>
                        <p className="mt-1 leading-relaxed text-cream/90">
                          {connection.evidence || 'No evidence text provided.'}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          )}
        </aside>
      </main>

      <footer className="timeline-dock fixed bottom-0 left-0 right-0 z-20 border-t border-mesa/60 bg-burgundy/88 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-[1400px] items-center gap-4 px-4 py-4 sm:px-6">
          <button
            type="button"
            onClick={handlePlayToggle}
            disabled={isLoading || Boolean(errorMessage)}
            className="rounded-full border border-cream bg-cream px-5 py-2 text-xs font-bold uppercase tracking-[0.15em] text-burgundy transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isPlaying ? 'Pause' : 'Play'}
          </button>

          <div className="flex-1">
            <div className="mb-1.5 flex items-center justify-between text-[11px] uppercase tracking-[0.16em] text-cream/75">
              <span>{YEAR_MIN}</span>
              <span className="font-accent text-2xl normal-case tracking-[0.06em] text-cream">
                {selectedYear}
              </span>
              <span>{YEAR_MAX}</span>
            </div>
            <input
              className="timeline-slider"
              type="range"
              min={YEAR_MIN}
              max={YEAR_MAX}
              step={1}
              value={selectedYear}
              onChange={handleYearChange}
              disabled={isLoading || Boolean(errorMessage)}
              aria-label="Timeline year"
            />
          </div>
        </div>
      </footer>
    </div>
  )
}

export default App
