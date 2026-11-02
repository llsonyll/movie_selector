import { formatMeeting, formatRuntime, plural } from './format'
import type { Proposal, Round } from './types'

export const roundUrl = (round: Round) => `${window.location.origin}/ronda/${round.id}`

export const whatsappLink = (text: string) => `https://wa.me/?text=${encodeURIComponent(text)}`

// Une líneas descartando las vacías opcionales (null/false); '' se conserva como salto de párrafo.
const lines = (...l: (string | null | false | undefined)[]) =>
  l.filter((x): x is string => typeof x === 'string').join('\n')

const label = (p: Proposal) => `${p.movie.title}${p.movie.year ? ` (${p.movie.year})` : ''}`

/** Mensaje listo para pegar en el grupo, según la fase de la ronda. */
export function shareMessage(round: Round, proposals: Proposal[], votesFor: (id: string) => number) {
  const when = formatMeeting(round.meeting_at)
  const url = roundUrl(round)
  const list = proposals.map((p) => `• ${label(p)} — ${p.member.display_name}`).join('\n')

  if (round.phase === 'proposals') {
    return lines(
      `🎬 *Cineclub · ${round.title}*`,
      when && `📅 ${when}`,
      '',
      'Ya pueden proponer películas (hasta 2 por persona):',
      url,
      proposals.length > 0 && `\nPropuestas hasta ahora:\n${list}`,
    )
  }

  if (round.phase === 'voting') {
    return lines(
      `🗳️ *Votación abierta · ${round.title}*`,
      when && `📅 ${when}`,
      '',
      'Marquen todas las que verían con gusto:',
      list,
      '',
      url,
    )
  }

  const winner = proposals.find((p) => p.id === round.winner_proposal_id)
  if (!winner) return `🎬 *Cineclub · ${round.title}*\n${url}`
  const m = winner.movie
  const details = [m.director, formatRuntime(m.runtime)].filter(Boolean).join(' · ')
  const where = m.providers.length ? `📺 ${m.providers.map((p) => p.name).join(', ')}` : null
  return lines(
    `🍿 *Esta semana vemos: ${label(winner)}*`,
    details || null,
    when && `📅 ${when}`,
    '',
    `${plural(votesFor(winner.id), 'voto', 'votos')}${round.tie_broken ? ' (ganó en sorteo entre empatadas)' : ''} · propuesta de ${winner.member.display_name}`,
    where,
    url,
  )
}
