// Puente con TMDB (themoviedb.org): la clave queda en el servidor y el navegador recibe solo lo que usa.
// Lo usan las funciones de Vercel (api/search.ts, api/movie.ts) y el servidor de desarrollo (vite.config.ts).

export interface TmdbEnv {
  TMDB_TOKEN?: string     // "API Read Access Token" (empieza con eyJ…) o la "API Key" corta de TMDB
  TMDB_LANGUAGE?: string  // idioma de títulos y sinopsis; por defecto es-MX (títulos latinoamericanos)
  TMDB_REGION?: string    // país para "dónde verla"; por defecto PE
}

export interface SearchResult {
  tmdb_id: number
  title: string
  original_title: string | null
  year: number | null
  poster_path: string | null
  overview: string | null
}

export interface MovieDetail extends SearchResult {
  runtime: number | null
  director: string | null
  genres: string[]
  providers: { name: string; logo_path: string | null }[]
}

type Json = Record<string, any>

async function tmdb(env: TmdbEnv, path: string, params: Record<string, string>): Promise<Json> {
  const token = env.TMDB_TOKEN
  if (!token) throw new HttpError(500, 'Falta TMDB_TOKEN en el servidor')
  const url = new URL(`https://api.themoviedb.org/3${path}`)
  url.searchParams.set('language', env.TMDB_LANGUAGE || 'es-MX')
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  const headers: Record<string, string> = { accept: 'application/json' }
  if (token.startsWith('eyJ')) headers.authorization = `Bearer ${token}`
  else url.searchParams.set('api_key', token)
  const res = await fetch(url, { headers })
  if (res.status === 404) throw new HttpError(404, 'Película no encontrada')
  if (!res.ok) throw new HttpError(502, `TMDB respondió ${res.status}`)
  return res.json()
}

const year = (date?: string) => (date && /^\d{4}/.test(date) ? Number(date.slice(0, 4)) : null)

function base(m: Json): SearchResult {
  return {
    tmdb_id: m.id,
    title: m.title || m.original_title,
    original_title: m.original_title && m.original_title !== m.title ? m.original_title : null,
    year: year(m.release_date),
    poster_path: m.poster_path ?? null,
    overview: m.overview || null,
  }
}

export async function searchMovies(env: TmdbEnv, query: string): Promise<SearchResult[]> {
  const q = query.trim()
  if (q.length < 2) return []
  const data = await tmdb(env, '/search/movie', { query: q, include_adult: 'false' })
  return (data.results as Json[]).slice(0, 12).map(base)
}

export async function getMovie(env: TmdbEnv, id: number): Promise<MovieDetail> {
  const m = await tmdb(env, `/movie/${id}`, { append_to_response: 'credits,watch/providers' })
  const region = (env.TMDB_REGION || 'PE').toUpperCase()
  const offers = m['watch/providers']?.results?.[region] ?? {}
  const seen = new Set<string>()
  const providers = [...(offers.flatrate ?? []), ...(offers.free ?? []), ...(offers.ads ?? [])]
    .filter((p: Json) => !seen.has(p.provider_name) && seen.add(p.provider_name))
    .slice(0, 6)
    .map((p: Json) => ({ name: p.provider_name as string, logo_path: (p.logo_path as string) ?? null }))
  const directors = (m.credits?.crew as Json[] | undefined)?.filter((c) => c.job === 'Director').map((c) => c.name)
  return {
    ...base(m),
    runtime: m.runtime || null,
    director: directors?.length ? directors.slice(0, 2).join(', ') : null,
    genres: ((m.genres as Json[]) ?? []).map((g) => g.name),
    providers,
  }
}

export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message) }
}

// Respuesta común de las dos rutas: JSON, con caché en el CDN (las fichas cambian poco).
export async function respond(fn: () => Promise<unknown>, maxAge: number): Promise<Response> {
  try {
    return Response.json(await fn(), {
      headers: { 'cache-control': `public, s-maxage=${maxAge}, stale-while-revalidate=86400` },
    })
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 500
    return Response.json({ error: e instanceof Error ? e.message : 'Error' }, { status })
  }
}

export async function handle(url: URL, env: TmdbEnv): Promise<Response> {
  if (url.pathname.endsWith('/search')) {
    return respond(() => searchMovies(env, url.searchParams.get('q') ?? ''), 3600)
  }
  if (url.pathname.endsWith('/movie')) {
    const id = Number(url.searchParams.get('id'))
    if (!Number.isInteger(id) || id <= 0) return Response.json({ error: 'id inválido' }, { status: 400 })
    return respond(() => getMovie(env, id), 86400)
  }
  return Response.json({ error: 'Ruta desconocida' }, { status: 404 })
}
