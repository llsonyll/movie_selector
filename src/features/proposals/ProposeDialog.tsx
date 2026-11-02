import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Check, History, Search } from 'lucide-react'
import { toast } from 'sonner'
import { Button, Modal, Poster, Spinner } from '@/components/ui'
import { friendly, usePropose, useWatched } from '@/lib/queries'
import { getMovie, searchMovies } from '@/lib/tmdb'
import type { Proposal, Round } from '@/lib/types'
import { MovieFacts, Providers } from './ProposalCard'

function useDebounced<T>(value: T, ms: number) {
  const [v, setV] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return v
}

interface Props {
  open: boolean
  onClose: () => void
  round: Round
  proposals: Proposal[]
  remaining: number
}

export function ProposeDialog({ open, onClose, round, proposals, remaining }: Props) {
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<number | null>(null)
  const [pitch, setPitch] = useState('')
  const q = useDebounced(query.trim(), 300)
  const watched = useWatched()
  const propose = usePropose()
  const inRound = new Map(proposals.map((p) => [p.tmdb_id, p]))

  const results = useQuery({
    queryKey: ['tmdb-search', q],
    enabled: open && q.length >= 2,
    staleTime: 10 * 60_000,
    queryFn: ({ signal }) => searchMovies(q, signal),
  })
  const detail = useQuery({
    queryKey: ['tmdb-movie', selected],
    enabled: selected !== null,
    staleTime: 60 * 60_000,
    queryFn: () => getMovie(selected!),
  })

  const close = () => {
    onClose()
    setTimeout(() => {
      setQuery('')
      setSelected(null)
      setPitch('')
    }, 150)
  }

  const movie = detail.data
  const seenIn = selected !== null ? watched.get(selected) : undefined

  return (
    <Modal open={open} onClose={close} title={selected === null ? 'Proponer película' : 'Tu propuesta'}>
      {selected === null ? (
        <div>
          <div className="sticky top-0 z-10 bg-stone-900 p-4 pb-2">
            <label className="flex items-center gap-2 rounded-full bg-stone-950 px-4 py-2.5 ring-1 ring-stone-700 focus-within:ring-amber-400">
              <Search className="h-4 w-4 shrink-0 text-stone-500" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Busca por título: Perfect Days, Aftersun…"
                className="w-full bg-transparent text-stone-100 placeholder:text-stone-500 outline-none"
                enterKeyHint="search"
              />
            </label>
            <p className="mt-2 px-1 text-xs text-stone-500">
              Te quedan {remaining} {remaining === 1 ? 'propuesta' : 'propuestas'} en esta ronda.
            </p>
          </div>
          <ul className="px-2 pb-4">
            {results.isFetching && !results.data && (
              <li className="grid place-items-center py-10"><Spinner /></li>
            )}
            {results.isError && <li className="px-3 py-6 text-center text-sm text-red-400">{friendly(results.error)}</li>}
            {results.data?.length === 0 && (
              <li className="px-3 py-6 text-center text-sm text-stone-400">No encontramos nada con «{q}».</li>
            )}
            {results.data?.map((m) => {
              const taken = inRound.get(m.tmdb_id)
              const seen = watched.get(m.tmdb_id)
              return (
                <li key={m.tmdb_id}>
                  <button
                    type="button"
                    disabled={!!taken}
                    onClick={() => setSelected(m.tmdb_id)}
                    className="flex w-full items-center gap-3 rounded-xl p-2 text-left hover:bg-stone-800 disabled:opacity-50 disabled:hover:bg-transparent"
                  >
                    <Poster path={m.poster_path} title={m.title} size="w92" className="w-12 shrink-0 rounded-md" />
                    <div className="min-w-0">
                      <p className="truncate font-medium text-stone-100">
                        {m.title} {m.year && <span className="font-normal text-stone-400">({m.year})</span>}
                      </p>
                      {m.original_title && <p className="truncate text-xs italic text-stone-500">{m.original_title}</p>}
                      {taken ? (
                        <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-stone-400">
                          <Check className="h-3 w-3" /> Ya la propuso {taken.member.display_name}
                        </p>
                      ) : seen ? (
                        <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-amber-300">
                          <History className="h-3 w-3" /> Ya la vieron en «{seen.title}»
                        </p>
                      ) : (
                        m.overview && <p className="line-clamp-1 text-xs text-stone-500">{m.overview}</p>
                      )}
                    </div>
                  </button>
                </li>
              )
            })}
            {q.length < 2 && (
              <li className="px-3 py-10 text-center text-sm text-stone-500">Escribe al menos 2 letras para buscar.</li>
            )}
          </ul>
        </div>
      ) : (
        <div className="p-4">
          <button type="button" onClick={() => setSelected(null)} className="mb-4 inline-flex items-center gap-1 text-sm text-stone-400 hover:text-stone-100">
            <ArrowLeft className="h-4 w-4" /> Volver a la búsqueda
          </button>
          {detail.isPending && <div className="grid place-items-center py-16"><Spinner /></div>}
          {detail.isError && <p className="py-6 text-center text-sm text-red-400">{friendly(detail.error)}</p>}
          {movie && (
            <form
              onSubmit={(e) => {
                e.preventDefault()
                propose.mutate(
                  { roundId: round.id, movie, pitch },
                  {
                    onSuccess: () => {
                      toast.success(`Propusiste ${movie.title}`)
                      close()
                    },
                    onError: (err) => toast.error(friendly(err)),
                  },
                )
              }}
            >
              <div className="flex gap-4">
                <Poster path={movie.poster_path} title={movie.title} className="w-28 shrink-0" />
                <div className="min-w-0">
                  <h3 className="font-display text-2xl leading-tight text-stone-50">
                    {movie.title} {movie.year && <span className="text-stone-400">({movie.year})</span>}
                  </h3>
                  {movie.original_title && <p className="text-sm italic text-stone-500">{movie.original_title}</p>}
                  <MovieFacts movie={movie} className="mt-1" />
                  <div className="mt-2"><Providers movie={movie} /></div>
                </div>
              </div>
              {movie.overview && <p className="mt-4 line-clamp-6 text-sm text-stone-300 text-pretty">{movie.overview}</p>}
              {seenIn && (
                <p className="mt-4 rounded-xl bg-amber-950/50 p-3 text-sm text-amber-200 ring-1 ring-amber-900">
                  Ojo: esta ya la vieron en «{seenIn.title}». Puedes proponerla igual si quieren repetir.
                </p>
              )}
              <label className="mt-5 block text-sm font-medium text-stone-200">
                ¿Por qué la propones? <span className="font-normal text-stone-500">(opcional)</span>
                <textarea
                  value={pitch}
                  onChange={(e) => setPitch(e.target.value)}
                  maxLength={280}
                  rows={3}
                  placeholder="Una línea para convencer al grupo…"
                  className="mt-2 w-full rounded-xl bg-stone-950 p-3 text-sm font-normal text-stone-100 ring-1 ring-stone-700 outline-none placeholder:text-stone-600 focus:ring-amber-400"
                />
              </label>
              <Button type="submit" variant="primary" busy={propose.isPending} className="mt-4 w-full py-3">
                Proponer {movie.title}
              </Button>
            </form>
          )}
        </div>
      )}
    </Modal>
  )
}
