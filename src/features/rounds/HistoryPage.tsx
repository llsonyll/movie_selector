import { Link } from 'react-router-dom'
import { History } from 'lucide-react'
import { Empty, Poster, Spinner } from '@/components/ui'
import { formatShort } from '@/lib/format'
import { friendly, useClosedRounds } from '@/lib/queries'

export function HistoryPage() {
  const rounds = useClosedRounds()
  if (rounds.isPending) return <div className="grid place-items-center py-24"><Spinner /></div>
  if (rounds.isError) return <p className="text-red-400">{friendly(rounds.error)}</p>

  const list = rounds.data
  return (
    <div>
      <h1 className="font-display text-3xl text-stone-50">Historial</h1>
      <p className="mt-1 text-stone-400">
        {list.length ? `Las ${list.length} películas que eligió el club.` : 'Aquí aparecerán las películas que vaya eligiendo el club.'}
      </p>
      {list.length === 0 ? (
        <div className="mt-6"><Empty icon={<History className="h-5 w-5" />} title="Todavía no se cerró ninguna ronda" /></div>
      ) : (
        <ul className="mt-6 grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-5">
          {list.map((r) => (
            <li key={r.id}>
              <Link to={`/ronda/${r.id}`} className="group block">
                <Poster
                  path={r.winner?.movie.poster_path ?? null}
                  title={r.winner?.movie.title ?? r.title}
                  className="ring-1 ring-stone-800 transition group-hover:ring-amber-400"
                />
                <p className="mt-2 text-sm font-medium leading-snug text-stone-100">
                  {r.winner ? r.winner.movie.title : 'Sin película'}
                  {r.winner?.movie.year && <span className="font-normal text-stone-500"> ({r.winner.movie.year})</span>}
                </p>
                <p className="text-xs text-stone-500">
                  {r.title}
                  {r.closed_at && ` · ${formatShort(r.meeting_at ?? r.closed_at)}`}
                </p>
                {r.winner && <p className="text-xs text-stone-500">Propuso {r.winner.member.display_name}</p>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
