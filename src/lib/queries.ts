import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from './supabase'
import type { Member, MovieDetail, Phase, Proposal, Round, Vote } from './types'

// Entre proposals y members hay dos caminos (quién la propuso, y quiénes la votaron a través de votes), y
// entre rounds y proposals también (la ganadora y las de la ronda): cada embed nombra su clave foránea.
const MEMBER_OF_PROPOSAL = 'member:members!proposals_member_id_fkey'
const ROUND_SELECT = `*, winner:proposals!rounds_winner_fk(id, tmdb_id, movie:movies(*), ${MEMBER_OF_PROPOSAL}(display_name))`
const PROPOSAL_SELECT = `*, movie:movies(*), ${MEMBER_OF_PROPOSAL}(id, display_name, avatar_url)`

/** Convierte errores de Postgres/Supabase en mensajes para la gente. */
export function friendly(error: unknown): string {
  const e = error as { code?: string; message?: string }
  if (e?.code === '23505') {
    if (e.message?.includes('rounds_one_open')) return 'Ya hay una ronda abierta: ciérrala antes de abrir otra'
    return 'Esa película ya está propuesta en esta ronda'
  }
  if (e?.code === '42501') return 'No se pudo: puede que la ronda haya cambiado de fase. Recarga la página.'
  return e?.message ?? 'Algo salió mal'
}

function check<T>({ data, error }: { data: T; error: unknown }): T {
  if (error) throw error
  return data
}

// ── Lecturas ──────────────────────────────────────────────────────────────────────────────────────

export const useCurrentRound = () =>
  useQuery({
    queryKey: ['rounds', 'current'],
    queryFn: async () =>
      check(await supabase.from('rounds').select(ROUND_SELECT).neq('phase', 'closed').maybeSingle()) as Round | null,
  })

export const useRound = (id: string) =>
  useQuery({
    queryKey: ['rounds', id],
    queryFn: async () =>
      check(await supabase.from('rounds').select(ROUND_SELECT).eq('id', id).maybeSingle()) as Round | null,
  })

export const useClosedRounds = () =>
  useQuery({
    queryKey: ['rounds', 'closed'],
    queryFn: async () =>
      check(
        await supabase.from('rounds').select(ROUND_SELECT).eq('phase', 'closed').order('closed_at', { ascending: false }),
      ) as Round[],
  })

/** Películas que ya ganaron alguna ronda (para avisar si alguien propone una repetida). */
export function useWatched() {
  const closed = useClosedRounds()
  const map = new Map<number, Round>()
  for (const r of closed.data ?? []) if (r.winner && !map.has(r.winner.tmdb_id)) map.set(r.winner.tmdb_id, r)
  return map
}

export const useProposals = (roundId: string) =>
  useQuery({
    queryKey: ['proposals', roundId],
    queryFn: async () =>
      check(
        await supabase.from('proposals').select(PROPOSAL_SELECT).eq('round_id', roundId).order('created_at'),
      ) as Proposal[],
  })

/** Votos visibles: los propios mientras se vota; todos cuando la ronda está cerrada (lo decide RLS). */
export const useVotes = (roundId: string) =>
  useQuery({
    queryKey: ['votes', roundId],
    queryFn: async () =>
      check(await supabase.from('votes').select('proposal_id, member_id').eq('round_id', roundId)) as Vote[],
  })

/** Quién ya votó (sin saber por qué). Se refresca solo durante la votación. */
export const useVoters = (roundId: string, phase: Phase) =>
  useQuery({
    queryKey: ['voters', roundId],
    enabled: phase !== 'proposals',
    refetchInterval: phase === 'voting' ? 15_000 : false,
    queryFn: async () => check(await supabase.rpc('round_voters', { p_round: roundId })) as string[],
  })

export const useMembers = () =>
  useQuery({
    queryKey: ['members'],
    queryFn: async () =>
      check(await supabase.from('members').select('*').order('display_name')) as Member[],
  })

/** Mantiene la página al día: cuando alguien propone, retira o cambia la fase, se vuelve a consultar. */
export function useLiveUpdates(enabled: boolean) {
  const qc = useQueryClient()
  useEffect(() => {
    if (!enabled) return
    const channel = supabase
      .channel('cineclub')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rounds' }, () => {
        qc.invalidateQueries({ queryKey: ['rounds'] })
        qc.invalidateQueries({ queryKey: ['votes'] })
        qc.invalidateQueries({ queryKey: ['voters'] })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'proposals' }, () =>
        qc.invalidateQueries({ queryKey: ['proposals'] }),
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'members' }, () =>
        qc.invalidateQueries({ queryKey: ['members'] }),
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [enabled, qc])
}

// ── Cambios ───────────────────────────────────────────────────────────────────────────────────────

function useAction<A, R = unknown>(fn: (args: A) => Promise<R>, invalidate: string[][]) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSettled: () => Promise.all(invalidate.map((queryKey) => qc.invalidateQueries({ queryKey }))),
  })
}

export const useCreateRound = () =>
  useAction(
    async (r: { title: string; meeting_at: string | null }) =>
      check(await supabase.from('rounds').insert(r).select('id').single()) as { id: string },
    [['rounds']],
  )

export const useUpdateRound = () =>
  useAction(
    async ({ id, ...patch }: { id: string; title?: string; meeting_at?: string | null; phase?: Phase }) => {
      const rows = check(await supabase.from('rounds').update(patch).eq('id', id).select('id'))
      if (!rows?.length) throw new Error('No se pudo actualizar la ronda')
    },
    [['rounds'], ['voters']],
  )

export const useDeleteRound = () =>
  useAction(async (id: string) => void check(await supabase.from('rounds').delete().eq('id', id)), [['rounds']])

export const useCloseRound = () =>
  useAction(
    async (id: string) => check(await supabase.rpc('close_round', { p_round: id })) as string | null,
    [['rounds'], ['votes'], ['voters'], ['proposals']],
  )

export const usePropose = () =>
  useAction(
    async ({ roundId, movie, pitch }: { roundId: string; movie: MovieDetail; pitch: string }) => {
      check(await supabase.from('movies').upsert({ ...movie, updated_at: new Date().toISOString() }))
      check(
        await supabase.from('proposals').insert({ round_id: roundId, tmdb_id: movie.tmdb_id, pitch: pitch.trim() || null }),
      )
    },
    [['proposals']],
  )

export const useUpdatePitch = () =>
  useAction(
    async ({ id, pitch }: { id: string; pitch: string }) =>
      void check(await supabase.from('proposals').update({ pitch: pitch.trim() || null }).eq('id', id)),
    [['proposals']],
  )

export const useRemoveProposal = () =>
  useAction(
    async (id: string) => {
      const rows = check(await supabase.from('proposals').delete().eq('id', id).select('id'))
      if (!rows?.length) throw new Error('No se pudo retirar la propuesta')
    },
    [['proposals']],
  )

/** Marcar o desmarcar una película (voto por aprobación). Se refleja al instante y se corrige si falla. */
export function useToggleVote(roundId: string, memberId: string) {
  const qc = useQueryClient()
  const key = ['votes', roundId]
  return useMutation({
    mutationFn: async ({ proposalId, vote }: { proposalId: string; vote: boolean }) => {
      if (vote) check(await supabase.from('votes').insert({ proposal_id: proposalId, round_id: roundId }))
      else
        check(await supabase.from('votes').delete().eq('proposal_id', proposalId).eq('member_id', memberId))
    },
    onMutate: async ({ proposalId, vote }) => {
      await qc.cancelQueries({ queryKey: key })
      const before = qc.getQueryData<Vote[]>(key)
      qc.setQueryData<Vote[]>(key, (old = []) =>
        vote
          ? [...old, { proposal_id: proposalId, member_id: memberId }]
          : old.filter((v) => !(v.proposal_id === proposalId && v.member_id === memberId)),
      )
      return { before }
    },
    onError: (_e, _v, ctx) => qc.setQueryData(key, ctx?.before),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: key })
      qc.invalidateQueries({ queryKey: ['voters', roundId] })
    },
  })
}

export const useSetMemberRole = () =>
  useAction(
    async (a: { id: string; is_organizer: boolean; active: boolean }) =>
      void check(
        await supabase.rpc('set_member_role', { p_member: a.id, p_organizer: a.is_organizer, p_active: a.active }),
      ),
    [['members']],
  )

export const useRename = () =>
  useAction(
    async ({ id, name }: { id: string; name: string }) =>
      void check(await supabase.from('members').update({ display_name: name.trim() }).eq('id', id)),
    [['members'], ['me'], ['proposals']],
  )
