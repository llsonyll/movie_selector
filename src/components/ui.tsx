import { useEffect, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { Film, Loader2, X } from 'lucide-react'
import { posterUrl } from '@/lib/tmdb'
import type { MemberRef } from '@/lib/types'

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(' ')
}

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
const variants: Record<Variant, string> = {
  primary: 'bg-amber-400 text-stone-950 hover:bg-amber-300 font-semibold',
  secondary: 'bg-stone-800 text-stone-100 hover:bg-stone-700 ring-1 ring-inset ring-stone-700',
  ghost: 'text-stone-300 hover:bg-stone-800 hover:text-stone-50',
  danger: 'text-red-300 hover:bg-red-950/60',
}

export function Button({
  variant = 'secondary',
  busy,
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; busy?: boolean }) {
  return (
    <button
      type="button"
      {...props}
      disabled={props.disabled || busy}
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm transition-colors',
        'disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300',
        variants[variant],
        className,
      )}
    >
      {busy && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  )
}

export function Spinner({ className = 'h-6 w-6' }: { className?: string }) {
  return <Loader2 className={cx('animate-spin text-stone-500', className)} />
}

export function FullScreenSpinner() {
  return (
    <div className="min-h-dvh grid place-items-center">
      <Spinner className="h-8 w-8" />
    </div>
  )
}

export function Avatar({ member, size = 'h-7 w-7' }: { member: Pick<MemberRef, 'display_name' | 'avatar_url'>; size?: string }) {
  const initials = member.display_name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('')
  return member.avatar_url ? (
    <img
      src={member.avatar_url}
      alt=""
      title={member.display_name}
      referrerPolicy="no-referrer"
      className={cx(size, 'shrink-0 rounded-full object-cover ring-2 ring-stone-950')}
    />
  ) : (
    <span
      title={member.display_name}
      className={cx(size, 'shrink-0 grid place-items-center rounded-full bg-stone-700 text-[0.65rem] font-semibold text-stone-200 ring-2 ring-stone-950')}
    >
      {initials}
    </span>
  )
}

export function Poster({ path, title, className, size }: { path: string | null; title: string; className?: string; size?: 'w92' | 'w185' | 'w342' | 'w500' }) {
  const src = posterUrl(path, size)
  return (
    <div className={cx('relative aspect-[2/3] overflow-hidden rounded-lg bg-stone-800', className)}>
      {src ? (
        <img src={src} alt={`Póster de ${title}`} loading="lazy" className="h-full w-full object-cover" />
      ) : (
        <div className="absolute inset-0 grid place-items-center p-2 text-center text-xs text-stone-500">
          <Film className="h-6 w-6" />
        </div>
      )}
    </div>
  )
}

/** Ventana sobre la página: pantalla completa en el celular, centrada en la computadora. */
export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/70 backdrop-blur-sm sm:items-start sm:p-6 sm:pt-[8vh]" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className="flex w-full flex-col bg-stone-900 sm:max-h-[84vh] sm:max-w-xl sm:rounded-2xl sm:ring-1 sm:ring-stone-800"
      >
        <div className="flex items-center justify-between gap-3 border-b border-stone-800 px-4 py-3">
          <h2 className="font-semibold text-stone-100">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="-mr-1 rounded-full p-1.5 text-stone-400 hover:bg-stone-800 hover:text-stone-100">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  )
}

export function Empty({ icon, title, children }: { icon: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-stone-800 px-6 py-12 text-center">
      <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-stone-900 text-stone-500">{icon}</div>
      <p className="mt-4 font-medium text-stone-200">{title}</p>
      {children && <div className="mt-1 text-sm text-stone-400">{children}</div>}
    </div>
  )
}

export function WhatsAppIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M17.5 14.4c-.3-.1-1.8-.9-2-1-.3-.1-.5-.1-.7.1-.2.3-.8 1-.9 1.2-.2.2-.3.2-.6.1-.3-.1-1.3-.5-2.4-1.5-.9-.8-1.5-1.8-1.7-2.1-.2-.3 0-.5.1-.6l.4-.5.3-.5v-.5l-.9-2.2c-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1.1 2.9 1.2 3.1c.1.2 2.1 3.2 5.1 4.5.7.3 1.3.5 1.7.6.7.2 1.4.2 1.9.1.6-.1 1.8-.7 2-1.4.2-.7.2-1.3.2-1.4-.1-.1-.3-.2-.6-.4zM12 21.8c-1.8 0-3.5-.5-5-1.4l-.4-.2-3.7 1 1-3.6-.2-.4C2.7 15.6 2.2 13.8 2.2 12 2.2 6.6 6.6 2.2 12 2.2c2.6 0 5.1 1 6.9 2.9 1.8 1.8 2.9 4.3 2.9 6.9 0 5.4-4.4 9.8-9.8 9.8zM20.5 3.5C18.2 1.2 15.2 0 12 0 5.4 0 .1 5.3.1 11.9c0 2.1.6 4.1 1.6 5.9L0 24l6.3-1.7c1.7.9 3.7 1.4 5.7 1.4 6.6 0 11.9-5.3 11.9-11.9 0-3.2-1.2-6.2-3.4-8.3z" />
    </svg>
  )
}
