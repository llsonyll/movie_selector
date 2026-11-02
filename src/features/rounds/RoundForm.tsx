import { useState, type FormEvent } from 'react'
import { fromLocalInput, toLocalInput } from '@/lib/format'
import { Button } from '@/components/ui'

/** "Viernes 6/11" a partir de la fecha de la reunión. */
function titleFor(local: string) {
  if (!local) return ''
  const d = new Date(local)
  const day = new Intl.DateTimeFormat('es-PE', { weekday: 'long' }).format(d)
  return `${day[0].toUpperCase()}${day.slice(1)} ${d.getDate()}/${d.getMonth() + 1}`
}

interface Props {
  initial?: { title: string; meeting_at: string | null }
  submitLabel: string
  busy?: boolean
  onSubmit: (values: { title: string; meeting_at: string | null }) => void
  onCancel?: () => void
}

export function RoundForm({ initial, submitLabel, busy, onSubmit, onCancel }: Props) {
  const [when, setWhen] = useState(toLocalInput(initial?.meeting_at ?? null))
  const [title, setTitle] = useState(initial?.title ?? '')
  const [titleTouched, setTitleTouched] = useState(!!initial)
  const shownTitle = titleTouched ? title : titleFor(when)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const t = shownTitle.trim()
    if (!t) return
    onSubmit({ title: t, meeting_at: fromLocalInput(when) })
  }

  const field = 'mt-1.5 w-full rounded-xl bg-stone-950 px-3 py-2.5 text-stone-100 ring-1 ring-stone-700 outline-none focus:ring-amber-400'
  return (
    <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
      <label className="text-sm font-medium text-stone-300">
        Fecha y hora de la reunión
        <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className={field} />
      </label>
      <label className="text-sm font-medium text-stone-300">
        Nombre de la ronda
        <input
          value={shownTitle}
          onChange={(e) => {
            setTitleTouched(true)
            setTitle(e.target.value)
          }}
          maxLength={80}
          required
          placeholder="Viernes 6/11"
          className={field}
        />
      </label>
      <div className="flex gap-2 sm:col-span-2">
        <Button type="submit" variant="primary" busy={busy} disabled={!shownTitle.trim()}>{submitLabel}</Button>
        {onCancel && <Button variant="ghost" onClick={onCancel}>Cancelar</Button>}
      </div>
    </form>
  )
}
