import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Logo } from '@/components/Logo'
import { signOut } from './AuthProvider'

function signInWithGoogle() {
  // Vuelve a la misma página (p. ej. el link de la ronda que llegó por WhatsApp).
  return supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.href },
  })
}

export function LoginScreen() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  return (
    <main className="min-h-dvh grid place-items-center px-4 py-10">
      <div className="w-full max-w-sm text-center">
        <Logo className="mx-auto h-14 w-14" />
        <h1 className="mt-5 font-display text-4xl tracking-tight text-stone-50">Cineclub</h1>
        <p className="mt-3 text-stone-400 text-pretty">
          Propón películas para la reunión de la semana y vota las que te gustaría ver.
        </p>
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true)
            const { error } = await signInWithGoogle()
            if (error) {
              setError(error.message)
              setBusy(false)
            }
          }}
          className="mt-8 inline-flex w-full items-center justify-center gap-3 rounded-full bg-stone-50 px-5 py-3 font-medium text-stone-900 hover:bg-white disabled:opacity-60"
        >
          <GoogleMark />
          {busy ? 'Abriendo Google…' : 'Entrar con Google'}
        </button>
        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
      </div>
    </main>
  )
}

export function NotAMemberScreen() {
  return (
    <main className="min-h-dvh grid place-items-center px-4">
      <div className="max-w-sm text-center">
        <Logo className="mx-auto h-12 w-12 opacity-60" />
        <h1 className="mt-5 text-xl font-semibold text-stone-100">No tienes acceso al cineclub</h1>
        <p className="mt-2 text-stone-400">El organizador te sacó del club. Si es un error, escríbele por WhatsApp.</p>
        <button type="button" onClick={signOut} className="mt-6 text-sm text-amber-300 underline underline-offset-4">
          Entrar con otra cuenta
        </button>
      </div>
    </main>
  )
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" className="h-5 w-5" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  )
}
