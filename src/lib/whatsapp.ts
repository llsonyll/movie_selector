import { formatMeeting, formatRuntime, plural } from './format'
import type { Proposal, Round } from './types'

export const roundUrl = (round: Round) => `${window.location.origin}/ronda/${round.id}`

// Une líneas descartando las opcionales vacías (null/false).
const lines = (...l: (string | null | false | undefined)[]) =>
  l.filter((x): x is string => typeof x === 'string').join('\n')

/**
 * Mensaje corto para el grupo, según la fase: tres líneas y el link (la vista previa del link pone la imagen).
 * El link va al final para que WhatsApp lo muestre como tarjeta debajo del texto.
 */
export function shareMessage(round: Round, proposals: Proposal[], votesFor: (id: string) => number) {
  const when = formatMeeting(round.meeting_at)
  const url = `👉 ${roundUrl(round)}`

  if (round.phase === 'proposals') {
    return lines(
      `🎬 *Cineclub · ${round.title}*`,
      '¡Ya pueden proponer sus películas! Hasta 2 cada uno.',
      when && `📅 ${when}`,
      url,
    )
  }

  if (round.phase === 'voting') {
    return lines(
      `🗳️ *¡A votar! · ${round.title}*`,
      `Hay ${plural(proposals.length, 'propuesta', 'propuestas')}. Marquen todas las que verían con gusto.`,
      when && `📅 ${when}`,
      url,
    )
  }

  const winner = proposals.find((p) => p.id === round.winner_proposal_id)
  if (!winner) return lines(`🎬 *Cineclub · ${round.title}*`, url)
  const m = winner.movie
  const details = [m.director && `de ${m.director}`, formatRuntime(m.runtime)].filter(Boolean).join(' · ')
  return lines(
    `🍿 *Esta semana vemos ${m.title}${m.year ? ` (${m.year})` : ''}*`,
    details || null,
    `Ganó con ${plural(votesFor(winner.id), 'voto', 'votos')}${round.tie_broken ? ' (en sorteo)' : ''} · la propuso ${winner.member.display_name.split(/\s+/)[0]}`,
    when && `📅 ${when}`,
    url,
  )
}

export type ShareResult = 'shared' | 'copied' | 'cancelled'

/** En el celular abre el menú nativo de compartir (WhatsApp y el grupo aparecen ahí); si no, copia el mensaje. */
export async function shareText(text: string): Promise<ShareResult> {
  // Solo en pantallas táctiles: en la computadora el menú del sistema muchas veces no trae WhatsApp.
  const touch = window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0
  if (typeof navigator.share === 'function' && touch) {
    try {
      await navigator.share({ text })
      return 'shared'
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return 'cancelled'
      // Cualquier otro problema (navegador dentro de otra app, permisos): se copia.
    }
  }
  await copyText(text)
  return 'copied'
}

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    const area = document.createElement('textarea')
    area.value = text
    area.style.position = 'fixed'
    area.style.opacity = '0'
    document.body.appendChild(area)
    area.select()
    document.execCommand('copy')
    area.remove()
  }
}

// Recordar, en este navegador, que el organizador ya avisó al grupo de esta fase (para no insistir).
const sharedKey = (round: Round) => `cineclub:avisado:${round.id}:${round.phase}`

export function wasShared(round: Round) {
  try {
    return localStorage.getItem(sharedKey(round)) === '1'
  } catch {
    return false
  }
}

export function markShared(round: Round) {
  try {
    localStorage.setItem(sharedKey(round), '1')
  } catch {
    /* sin almacenamiento: la tarjeta volverá a aparecer, no pasa nada */
  }
}
