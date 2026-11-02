import type { MovieDetail, SearchResult } from './types'

export const MAX_PROPOSALS = 2

export function posterUrl(path: string | null | undefined, size: 'w92' | 'w185' | 'w342' | 'w500' = 'w342') {
  return path ? `https://image.tmdb.org/t/p/${size}${path}` : null
}

export const watchUrl = (tmdbId: number) => `https://www.themoviedb.org/movie/${tmdbId}/watch`

async function get<T>(path: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(path, { signal })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body.error ?? `Error ${res.status} al consultar TMDB`)
  return body as T
}

export const searchMovies = (q: string, signal?: AbortSignal) =>
  get<SearchResult[]>(`/api/search?q=${encodeURIComponent(q)}`, signal)

export const getMovie = (id: number) => get<MovieDetail>(`/api/movie?id=${id}`)
