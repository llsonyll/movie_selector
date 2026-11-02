const dateFmt = new Intl.DateTimeFormat('es-PE', { weekday: 'long', day: 'numeric', month: 'long' })
const timeFmt = new Intl.DateTimeFormat('es-PE', { hour: 'numeric', minute: '2-digit' })
const shortFmt = new Intl.DateTimeFormat('es-PE', { day: 'numeric', month: 'short', year: 'numeric' })

/** "viernes 6 de noviembre, 8:00 p. m." */
export function formatMeeting(iso: string | null) {
  if (!iso) return null
  const d = new Date(iso)
  return `${dateFmt.format(d)}, ${timeFmt.format(d)}`
}

export const formatShort = (iso: string) => shortFmt.format(new Date(iso))

export function formatRuntime(min: number | null) {
  if (!min) return null
  const h = Math.floor(min / 60)
  return h ? `${h} h ${String(min % 60).padStart(2, '0')} min` : `${min} min`
}

/** Valor para <input type="datetime-local"> a partir de una fecha ISO, en la hora local. */
export function toLocalInput(iso: string | null) {
  if (!iso) return ''
  const d = new Date(iso)
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}

export const fromLocalInput = (value: string) => (value ? new Date(value).toISOString() : null)

export const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

export const firstName = (name: string) => name.split(/\s+/)[0]

/** Orden estable pero distinto para cada persona: nadie ve siempre arriba la misma película. */
export function personalOrder<T extends { id: string }>(items: T[], seed: string): T[] {
  const hash = (s: string) => {
    let h = 2166136261
    for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
    return h >>> 0
  }
  return [...items].sort((a, b) => hash(seed + a.id) - hash(seed + b.id))
}
