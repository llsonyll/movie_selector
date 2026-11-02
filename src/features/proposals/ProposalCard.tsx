import { useState } from 'react'
import { Check, ExternalLink, History, Pencil, Trash2, Trophy } from 'lucide-react'
import { toast } from 'sonner'
import { Avatar, Button, Poster, cx } from '@/components/ui'
import { firstName, formatRuntime, formatShort, plural } from '@/lib/format'
import { friendly, useRemoveProposal, useUpdatePitch } from '@/lib/queries'
import { posterUrl, watchUrl } from '@/lib/tmdb'
import type { MemberRef, Movie, Proposal, Round } from '@/lib/types'

export function MovieFacts({ movie, className }: { movie: Movie; className?: string }) {
  const facts = [movie.director, formatRuntime(movie.runtime), movie.genres.slice(0, 2).join(', ')].filter(Boolean)
  return facts.length ? <p className={cx('text-sm text-stone-400', className)}>{facts.join(' · ')}</p> : null
}

export function Providers({ movie }: { movie: Movie }) {
  return (
    <a
      href={watchUrl(movie.tmdb_id)}
      target="_blank"
      rel="noreferrer"
      className="inline-flex flex-wrap items-center gap-1.5 text-xs text-stone-400 hover:text-stone-200"
    >
      {movie.providers.length ? (
        movie.providers.slice(0, 4).map((p) => (
          <span key={p.name} className="rounded bg-stone-800 px-1.5 py-0.5 text-stone-300">{p.name}</span>
        ))
      ) : (
        <span>Dónde verla</span>
      )}
      <ExternalLink className="h-3 w-3" />
    </a>
  )
}

interface Props {
  proposal: Proposal
  round: Round
  meId: string
  isOrganizer: boolean
  voted?: boolean
  onToggleVote?: () => void
  /** Ronda cerrada: quiénes la votaron. */
  voters?: MemberRef[]
  watchedIn?: Round
}

export function ProposalCard({ proposal, round, meId, isOrganizer, voted, onToggleVote, voters, watchedIn }: Props) {
  const { movie, member } = proposal
  const mine = proposal.member_id === meId
  const [editing, setEditing] = useState(false)
  const [pitch, setPitch] = useState(proposal.pitch ?? '')
  const update = useUpdatePitch()
  const remove = useRemoveProposal()
  const canEdit = round.phase === 'proposals' && mine
  const canRemove = round.phase === 'proposals' && (mine || isOrganizer)
  const voting = round.phase === 'voting'

  return (
    <article
      className={cx(
        'flex gap-4 rounded-2xl bg-stone-900 p-3 ring-1 transition-shadow sm:p-4',
        voted ? 'ring-2 ring-amber-400' : 'ring-stone-800',
      )}
    >
      <button
        type="button"
        disabled={!voting}
        onClick={onToggleVote}
        aria-label={voting ? `Votar por ${movie.title}` : undefined}
        className="w-24 shrink-0 self-start sm:w-28 disabled:cursor-default"
      >
        <Poster path={movie.poster_path} title={movie.title} size="w185" />
      </button>

      <div className="flex min-w-0 flex-1 flex-col">
        <h3 className="font-semibold leading-snug text-stone-50">
          {movie.title}
          {movie.year && <span className="font-normal text-stone-400"> ({movie.year})</span>}
        </h3>
        {movie.original_title && <p className="text-xs italic text-stone-500">{movie.original_title}</p>}
        <MovieFacts movie={movie} className="mt-1" />

        {watchedIn && (
          <p className="mt-2 inline-flex items-center gap-1.5 self-start rounded-full bg-amber-950/60 px-2 py-0.5 text-xs text-amber-200">
            <History className="h-3 w-3" /> Ya la vieron en «{watchedIn.title}»
          </p>
        )}

        {editing ? (
          <div className="mt-3">
            <textarea
              value={pitch}
              onChange={(e) => setPitch(e.target.value)}
              maxLength={280}
              rows={3}
              autoFocus
              className="w-full rounded-lg bg-stone-950 p-2 text-sm text-stone-100 ring-1 ring-stone-700 outline-none focus:ring-amber-400"
            />
            <div className="mt-2 flex gap-2">
              <Button
                variant="primary"
                busy={update.isPending}
                onClick={() =>
                  update.mutate(
                    { id: proposal.id, pitch },
                    { onSuccess: () => setEditing(false), onError: (e) => toast.error(friendly(e)) },
                  )
                }
              >
                Guardar
              </Button>
              <Button variant="ghost" onClick={() => setEditing(false)}>Cancelar</Button>
            </div>
          </div>
        ) : (
          <div className="mt-3 flex items-start gap-2">
            <Avatar member={member} size="h-6 w-6" />
            <p className="min-w-0 text-sm text-stone-300">
              <span className="text-stone-400">{mine ? 'Tu propuesta' : firstName(member.display_name)}</span>
              {proposal.pitch && <span className="text-stone-200">: “{proposal.pitch}”</span>}
            </p>
          </div>
        )}

        <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-2 pt-3">
          {voting && (
            <Button variant={voted ? 'primary' : 'secondary'} onClick={onToggleVote} aria-pressed={voted}>
              <Check className={cx('h-4 w-4', !voted && 'opacity-40')} />
              {voted ? 'La vería' : 'Marcar'}
            </Button>
          )}
          {voters && (
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-stone-200">{plural(voters.length, 'voto', 'votos')}</span>
              <div className="flex -space-x-1">
                {voters.map((v) => <Avatar key={v.id} member={v} size="h-6 w-6" />)}
              </div>
            </div>
          )}
          {!voting && !editing && <Providers movie={movie} />}
          <div className="ml-auto flex gap-1">
            {canEdit && !editing && (
              <button type="button" onClick={() => setEditing(true)} title="Editar comentario" aria-label="Editar comentario" className="rounded-full p-1.5 text-stone-500 hover:bg-stone-800 hover:text-stone-200">
                <Pencil className="h-4 w-4" />
              </button>
            )}
            {canRemove && (
              <button
                type="button"
                title="Retirar propuesta"
                aria-label="Retirar propuesta"
                disabled={remove.isPending}
                onClick={() => {
                  const who = mine ? 'tu propuesta' : `la propuesta de ${firstName(member.display_name)}`
                  if (confirm(`¿Retirar ${who}: ${movie.title}?`))
                    remove.mutate(proposal.id, { onError: (e) => toast.error(friendly(e)) })
                }}
                className="rounded-full p-1.5 text-stone-500 hover:bg-red-950/60 hover:text-red-300"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </article>
  )
}

/** La ganadora de una ronda cerrada, en grande. */
export function WinnerHero({ proposal, round, voters }: { proposal: Proposal; round: Round; voters: MemberRef[] }) {
  const { movie } = proposal
  return (
    <section className="relative overflow-hidden rounded-3xl bg-stone-900 ring-1 ring-amber-400/40">
      {movie.poster_path && (
        <img
          src={posterUrl(movie.poster_path)!}
          alt=""
          className="pointer-events-none absolute inset-0 h-full w-full scale-110 object-cover opacity-20 blur-2xl"
        />
      )}
      <div className="relative flex flex-col gap-5 p-5 sm:flex-row sm:p-7">
        <Poster path={movie.poster_path} title={movie.title} size="w342" className="w-40 shrink-0 shadow-2xl sm:w-48" />
        <div className="min-w-0">
          <p className="inline-flex items-center gap-1.5 text-sm font-medium text-amber-300">
            <Trophy className="h-4 w-4" /> Esta semana vemos
          </p>
          <h2 className="mt-1 font-display text-3xl leading-tight text-stone-50 sm:text-4xl">
            {movie.title}
            {movie.year && <span className="text-stone-400"> ({movie.year})</span>}
          </h2>
          {movie.original_title && <p className="text-sm italic text-stone-400">{movie.original_title}</p>}
          <MovieFacts movie={movie} className="mt-2" />
          {movie.overview && <p className="mt-3 line-clamp-4 text-sm text-stone-300 text-pretty">{movie.overview}</p>}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <span className="font-semibold text-stone-100">{plural(voters.length, 'voto', 'votos')}</span>
            <div className="flex -space-x-1">{voters.map((v) => <Avatar key={v.id} member={v} size="h-7 w-7" />)}</div>
            <span className="text-sm text-stone-400">· propuesta de {proposal.member.display_name}</span>
          </div>
          {round.tie_broken && (
            <p className="mt-2 text-xs text-stone-400">Hubo empate en el primer lugar: la ganadora salió por sorteo.</p>
          )}
          <div className="mt-4"><Providers movie={movie} /></div>
          {round.closed_at && <p className="mt-4 text-xs text-stone-500">Votación cerrada el {formatShort(round.closed_at)}</p>}
        </div>
      </div>
    </section>
  )
}
