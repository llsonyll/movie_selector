import { useState } from 'react'
import { Share2, X } from 'lucide-react'
import { toast } from 'sonner'
import { WhatsAppIcon } from '@/components/ui'
import type { Round } from '@/lib/types'
import { markShared, shareText, wasShared } from '@/lib/whatsapp'

const HINTS: Record<Round['phase'], { title: string; text: string; cta: string }> = {
  proposals: { title: 'Avísale al grupo', text: 'La ronda está abierta. Manda el link para que propongan.', cta: 'Avisar al grupo' },
  voting: { title: 'Avísale al grupo', text: 'La votación está abierta. Avisa para que voten.', cta: 'Avisar al grupo' },
  closed: { title: '¡Ya hay película!', text: 'Anuncia la ganadora en el grupo.', cta: 'Anunciar al grupo' },
}

/** Una ronda cerrada hace más de 3 días ya no pide aviso (p. ej. al mirarla desde el historial). */
const isRecent = (round: Round) =>
  round.phase !== 'closed' || (round.closed_at && Date.now() - new Date(round.closed_at).getTime() < 3 * 86_400_000)

function useShare(round: Round, message: string) {
  const [shared, setShared] = useState(() => wasShared(round))
  const done = () => {
    markShared(round)
    setShared(true)
  }
  const share = async () => {
    const result = await shareText(message)
    if (result === 'cancelled') return
    done()
    if (result === 'copied') {
      toast.success('Mensaje copiado', {
        description: 'Pégalo en el grupo de WhatsApp.',
        action: { label: 'Abrir WhatsApp', onClick: () => window.open('https://web.whatsapp.com/', '_blank', 'noopener') },
      })
    }
  }
  return { shared, share, dismiss: done }
}

/**
 * Botón "Compartir" para todos y, para el organizador, una tarjeta "Avísale al grupo" justo después de abrir la
 * ronda, abrir la votación o cerrarla. La tarjeta se va al compartir (o al descartarla).
 * Montar con key={`${round.id}-${round.phase}`} para que cada fase pida su propio aviso.
 */
export function ShareRound({ round, message, isOrganizer }: { round: Round; message: string; isOrganizer: boolean }) {
  const { shared, share, dismiss } = useShare(round, message)
  const hint = HINTS[round.phase]
  const prompt = isOrganizer && !shared && isRecent(round)

  if (prompt) {
    return (
      <section className="relative mt-5 flex flex-col gap-3 rounded-2xl bg-[#25D366]/10 p-4 ring-1 ring-[#25D366]/40 sm:flex-row sm:items-center sm:pr-12">
        <div className="min-w-0 flex-1 pr-8 sm:pr-0">
          <p className="font-medium text-stone-50">{hint.title}</p>
          <p className="text-sm text-stone-300">{hint.text}</p>
        </div>
        <button
          type="button"
          onClick={share}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-[#25D366] px-5 py-3 text-sm font-semibold text-stone-950 hover:brightness-110 sm:py-2.5"
        >
          <WhatsAppIcon /> {hint.cta}
        </button>
        <button type="button" onClick={dismiss} title="Ya avisé" aria-label="Ya avisé, ocultar" className="absolute right-2 top-2 rounded-full p-2 text-stone-400 hover:bg-stone-800 hover:text-stone-100 sm:top-1/2 sm:-translate-y-1/2">
          <X className="h-4 w-4" />
        </button>
      </section>
    )
  }

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={share}
        className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm text-stone-300 ring-1 ring-stone-700 hover:bg-stone-800 hover:text-stone-50"
      >
        <Share2 className="h-4 w-4" /> Compartir
      </button>
    </div>
  )
}
