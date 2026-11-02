import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { CalendarDays, Clapperboard, Lock, Pencil, Plus, Trash2, Undo2, Vote } from 'lucide-react'
import { toast } from 'sonner'
import { Avatar, Button, Empty, Spinner, cx } from '@/components/ui'
import { useMe } from '@/features/auth/AuthProvider'
import { ProposalCard, WinnerHero } from '@/features/proposals/ProposalCard'
import { ProposeDialog } from '@/features/proposals/ProposeDialog'
import { firstName, formatMeeting, personalOrder, plural } from '@/lib/format'
import {
  friendly, useCloseRound, useClosedRounds, useCreateRound, useCurrentRound, useDeleteRound, useMembers,
  useProposals, useRound, useToggleVote, useUpdateRound, useVoters, useVotes, useWatched,
} from '@/lib/queries'
import { MAX_PROPOSALS } from '@/lib/tmdb'
import type { Member, MemberRef, Phase, Proposal, Round } from '@/lib/types'
import { shareMessage } from '@/lib/whatsapp'
import { RoundForm } from './RoundForm'
import { ShareRound } from './ShareRound'

export function CurrentRoundPage() {
  const current = useCurrentRound()
  if (current.isPending) return <PageSpinner />
  if (current.isError) return <p className="text-red-400">{friendly(current.error)}</p>
  return current.data ? <RoundView round={current.data} /> : <NoOpenRound />
}

export function RoundPage() {
  const { id = '' } = useParams()
  const round = useRound(id)
  if (round.isPending) return <PageSpinner />
  if (!round.data) return <Empty icon={<Clapperboard className="h-5 w-5" />} title="Esta ronda no existe">
    <Link to="/" className="text-amber-300 underline underline-offset-4">Ir a la ronda de esta semana</Link>
  </Empty>
  return <RoundView round={round.data} />
}

const PageSpinner = () => <div className="grid place-items-center py-24"><Spinner /></div>

// ── La ronda ──────────────────────────────────────────────────────────────────────────────────────

function RoundView({ round }: { round: Round }) {
  const me = useMe()
  const proposals = useProposals(round.id)
  const votes = useVotes(round.id)
  const voters = useVoters(round.id, round.phase)
  const members = useMembers()
  const watched = useWatched()
  const toggle = useToggleVote(round.id, me.id)
  const [proposing, setProposing] = useState(false)

  const list = proposals.data ?? []
  const active = (members.data ?? []).filter((m) => m.active)
  const byId = new Map((members.data ?? []).map((m) => [m.id, m]))
  const mine = list.filter((p) => p.member_id === me.id)
  const myVotes = new Set((votes.data ?? []).filter((v) => v.member_id === me.id).map((v) => v.proposal_id))
  const votersOf = (proposalId: string): MemberRef[] =>
    (votes.data ?? []).filter((v) => v.proposal_id === proposalId).map((v) => byId.get(v.member_id)).filter((m): m is Member => !!m)

  const ordered = useMemo(() => {
    if (round.phase === 'voting') return personalOrder(list, me.id)
    if (round.phase === 'closed') {
      const count = (id: string) => (votes.data ?? []).filter((v) => v.proposal_id === id).length
      return [...list].sort((a, b) => Number(b.id === round.winner_proposal_id) - Number(a.id === round.winner_proposal_id) || count(b.id) - count(a.id))
    }
    return list
  }, [list, votes.data, round.phase, round.winner_proposal_id, me.id])

  const message = shareMessage(round, ordered, (id) => votersOf(id).length)
  const winner = list.find((p) => p.id === round.winner_proposal_id)

  return (
    <div>
      <PhaseSteps phase={round.phase} />

      <header className="mt-5">
        <h1 className="font-display text-3xl text-stone-50 sm:text-4xl">{round.title}</h1>
        {round.meeting_at && (
          <p className="mt-1 inline-flex items-center gap-1.5 text-stone-400 first-letter:uppercase">
            <CalendarDays className="h-4 w-4" /> {formatMeeting(round.meeting_at)}
          </p>
        )}
      </header>

      <ShareRound key={`${round.id}-${round.phase}`} round={round} message={message} isOrganizer={me.is_organizer} />

      {me.is_organizer && round.phase !== 'closed' && (
        <OrganizerBar round={round} proposals={list} votedCount={voters.data?.length ?? 0} activeCount={active.length} />
      )}

      {round.phase === 'proposals' && (
        <section className="mt-6">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-stone-900/60 p-4 ring-1 ring-stone-800">
            <div>
              <p className="font-medium text-stone-100">
                {mine.length >= MAX_PROPOSALS ? 'Ya hiciste tus 2 propuestas' : `Puedes proponer ${MAX_PROPOSALS - mine.length} ${MAX_PROPOSALS - mine.length === 1 ? 'película más' : 'películas'}`}
              </p>
              <p className="text-sm text-stone-400">
                {plural(list.length, 'propuesta', 'propuestas')} hasta ahora. Cuando el organizador abra la votación, ya no se podrán agregar.
              </p>
            </div>
            {mine.length < MAX_PROPOSALS && (
              <Button variant="primary" onClick={() => setProposing(true)}>
                <Plus className="h-4 w-4" /> Proponer película
              </Button>
            )}
          </div>
          <ProposeDialog open={proposing} onClose={() => setProposing(false)} round={round} proposals={list} remaining={MAX_PROPOSALS - mine.length} />
        </section>
      )}

      {round.phase === 'voting' && (
        <section className="mt-6 rounded-2xl bg-stone-900/60 p-4 ring-1 ring-stone-800">
          <p className="font-medium text-stone-100">Marca todas las que verías con gusto</p>
          <p className="text-sm text-stone-400">
            {myVotes.size ? `Marcaste ${plural(myVotes.size, 'película', 'películas')}.` : 'Todavía no marcaste ninguna.'} Puedes cambiarlo hasta que se cierre la votación. Los votos se revelan al final.
          </p>
          <Participation voterIds={voters.data ?? []} members={active} />
        </section>
      )}

      {round.phase === 'closed' && winner && (
        <div className="mt-6"><WinnerHero proposal={winner} round={round} voters={votersOf(winner.id)} /></div>
      )}

      <section className="mt-6">
        {round.phase === 'closed' && list.length > 1 && <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-stone-500">El resto de las propuestas</h2>}
        {proposals.isPending ? (
          <PageSpinner />
        ) : list.length === 0 ? (
          <Empty icon={<Clapperboard className="h-5 w-5" />} title="Todavía no hay propuestas">
            {round.phase === 'proposals' ? 'Sé el primero: busca una película y propónla.' : 'Esta ronda terminó sin propuestas.'}
          </Empty>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {ordered
              .filter((p) => round.phase !== 'closed' || p.id !== round.winner_proposal_id)
              .map((p: Proposal) => (
                <ProposalCard
                  key={p.id}
                  proposal={p}
                  round={round}
                  meId={me.id}
                  isOrganizer={me.is_organizer}
                  voted={round.phase === 'voting' ? myVotes.has(p.id) : undefined}
                  onToggleVote={() =>
                    toggle.mutate({ proposalId: p.id, vote: !myVotes.has(p.id) }, { onError: (e) => toast.error(friendly(e)) })
                  }
                  voters={round.phase === 'closed' ? votersOf(p.id) : undefined}
                  watchedIn={round.phase !== 'closed' ? watched.get(p.tmdb_id) : undefined}
                />
              ))}
          </div>
        )}
      </section>
    </div>
  )
}

const PHASES: { phase: Phase; label: string }[] = [
  { phase: 'proposals', label: 'Propuestas' },
  { phase: 'voting', label: 'Votación' },
  { phase: 'closed', label: 'Resultado' },
]

function PhaseSteps({ phase }: { phase: Phase }) {
  const current = PHASES.findIndex((p) => p.phase === phase)
  return (
    <ol className="flex items-center gap-2 text-xs font-medium" aria-label="Fase de la ronda">
      {PHASES.map((p, i) => (
        <li key={p.phase} className="flex items-center gap-2" aria-current={i === current ? 'step' : undefined}>
          {i > 0 && <span className={cx('h-px w-5 sm:w-8', i <= current ? 'bg-amber-400/60' : 'bg-stone-800')} />}
          <span
            className={cx(
              'rounded-full px-2.5 py-1',
              i === current ? 'bg-amber-400 text-stone-950' : i < current ? 'text-amber-300' : 'text-stone-500 ring-1 ring-stone-800',
            )}
          >
            {i + 1}. {p.label}
          </span>
        </li>
      ))}
    </ol>
  )
}

/** Quién ya votó y a quién falta recordarle (sin revelar los votos). */
function Participation({ voterIds, members }: { voterIds: string[]; members: Member[] }) {
  const done = new Set(voterIds)
  const voted = members.filter((m) => done.has(m.id))
  const pending = members.filter((m) => !done.has(m.id))
  return (
    <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
      <span className="text-stone-300">Votaron {voted.length} de {members.length}</span>
      <div className="flex -space-x-1">{voted.map((m) => <Avatar key={m.id} member={m} size="h-6 w-6" />)}</div>
      {pending.length > 0 && pending.length < members.length && (
        <span className="text-stone-500">Faltan: {pending.map((m) => firstName(m.display_name)).join(', ')}</span>
      )}
    </div>
  )
}

// ── Controles del organizador ─────────────────────────────────────────────────────────────────────

function OrganizerBar({ round, proposals, votedCount, activeCount }: { round: Round; proposals: Proposal[]; votedCount: number; activeCount: number }) {
  const navigate = useNavigate()
  const update = useUpdateRound()
  const close = useCloseRound()
  const del = useDeleteRound()
  const [editing, setEditing] = useState(false)
  const fail = (e: unknown) => toast.error(friendly(e))

  if (editing) {
    return (
      <div className="mt-5 rounded-2xl bg-stone-900 p-4 ring-1 ring-stone-800">
        <RoundForm
          initial={round}
          submitLabel="Guardar"
          busy={update.isPending}
          onCancel={() => setEditing(false)}
          onSubmit={(v) => update.mutate({ id: round.id, ...v }, { onSuccess: () => setEditing(false), onError: fail })}
        />
      </div>
    )
  }

  return (
    <div className="mt-5 flex flex-wrap items-center gap-2 rounded-2xl border border-dashed border-stone-800 p-3">
      <span className="mr-1 text-xs font-medium uppercase tracking-wide text-stone-500">Organizador</span>
      {round.phase === 'proposals' && (
        <>
          <Button
            variant="primary"
            busy={update.isPending}
            onClick={() => {
              const warn = proposals.length < 2 ? `\n\nOjo: hay solo ${plural(proposals.length, 'propuesta', 'propuestas')}.` : ''
              if (confirm(`¿Abrir la votación? Ya no se podrán agregar ni retirar propuestas.${warn}`))
                update.mutate({ id: round.id, phase: 'voting' }, {
                  onSuccess: () => toast.success('Votación abierta'),
                  onError: fail,
                })
            }}
          >
            <Vote className="h-4 w-4" /> Abrir votación
          </Button>
          <Button variant="ghost" onClick={() => setEditing(true)}><Pencil className="h-4 w-4" /> Editar</Button>
          <Button
            variant="danger"
            busy={del.isPending}
            onClick={() => {
              if (confirm(`¿Eliminar la ronda «${round.title}» con sus ${proposals.length} propuestas? No se puede deshacer.`))
                del.mutate(round.id, { onSuccess: () => navigate('/'), onError: fail })
            }}
          >
            <Trash2 className="h-4 w-4" /> Eliminar
          </Button>
        </>
      )}
      {round.phase === 'voting' && (
        <>
          <Button
            variant="primary"
            busy={close.isPending}
            onClick={() => {
              const missing = activeCount - votedCount
              const note = missing > 0 ? `\n\nTodavía faltan ${plural(missing, 'persona', 'personas')} por votar.` : ''
              if (confirm(`¿Cerrar la votación y anunciar la ganadora?${note}\n\nSi hay empate, se sortea entre las empatadas.`))
                close.mutate(round.id, {
                  onSuccess: () => toast.success('¡Tenemos película!'),
                  onError: fail,
                })
            }}
          >
            <Lock className="h-4 w-4" /> Cerrar y elegir ganadora
          </Button>
          <Button
            variant="ghost"
            busy={update.isPending}
            onClick={() => {
              if (confirm('¿Volver a la fase de propuestas? Los votos marcados se mantienen.'))
                update.mutate({ id: round.id, phase: 'proposals' }, { onError: fail })
            }}
          >
            <Undo2 className="h-4 w-4" /> Volver a propuestas
          </Button>
          <Button variant="ghost" onClick={() => setEditing(true)}><Pencil className="h-4 w-4" /> Editar</Button>
        </>
      )}
    </div>
  )
}

// ── Sin ronda abierta ─────────────────────────────────────────────────────────────────────────────

/** Sin ronda abierta: se muestra el resultado de la última hasta que el organizador abra la siguiente. */
function NoOpenRound() {
  const me = useMe()
  const closed = useClosedRounds()
  const last = closed.data?.[0]
  const [opening, setOpening] = useState(false)

  if (closed.isPending) return <PageSpinner />
  if (!last) {
    return me.is_organizer ? (
      <NewRoundPanel />
    ) : (
      <Empty icon={<Clapperboard className="h-5 w-5" />} title="Todavía no hay una ronda abierta">
        El organizador la abre y comparte el link en el grupo de WhatsApp.
      </Empty>
    )
  }
  return (
    <div className="space-y-6">
      {me.is_organizer &&
        (opening ? (
          <NewRoundPanel onCancel={() => setOpening(false)} />
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-dashed border-stone-800 p-3">
            <p className="text-sm text-stone-400">La votación terminó. Cuando quieras, abre la ronda de la próxima reunión.</p>
            <Button variant="primary" onClick={() => setOpening(true)}>
              <Plus className="h-4 w-4" /> Abrir la próxima ronda
            </Button>
          </div>
        ))}
      <RoundView round={last} />
    </div>
  )
}

function NewRoundPanel({ onCancel }: { onCancel?: () => void }) {
  const create = useCreateRound()
  return (
    <section className="rounded-2xl bg-stone-900 p-5 ring-1 ring-stone-800 sm:p-6">
      <h1 className="font-display text-2xl text-stone-50">Abrir la ronda de esta semana</h1>
      <p className="mt-1 mb-5 text-sm text-stone-400">
        Al abrirla, cada miembro puede proponer hasta {MAX_PROPOSALS} películas. Después avisas al grupo con un toque.
      </p>
      <RoundForm
        submitLabel="Abrir ronda"
        busy={create.isPending}
        onCancel={onCancel}
        onSubmit={(v) =>
          create.mutate(v, {
            onSuccess: () => toast.success('Ronda abierta'),
            onError: (e) => toast.error(friendly(e)),
          })
        }
      />
    </section>
  )
}
