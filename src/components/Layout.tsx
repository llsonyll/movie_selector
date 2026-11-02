import { NavLink, Outlet } from 'react-router-dom'
import { History, LogOut, Popcorn, Users } from 'lucide-react'
import { signOut, useMe } from '@/features/auth/AuthProvider'
import { useLiveUpdates } from '@/lib/queries'
import { Logo } from './Logo'
import { Avatar, cx } from './ui'

const links = [
  { to: '/', label: 'Esta semana', icon: Popcorn, end: true },
  { to: '/historial', label: 'Historial', icon: History, end: false },
  { to: '/miembros', label: 'Miembros', icon: Users, end: false },
]

export function Layout() {
  const me = useMe()
  useLiveUpdates(true)
  return (
    <div className="min-h-dvh flex flex-col">
      <header className="sticky top-0 z-40 border-b border-stone-900 bg-stone-950/85 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-2 px-4 py-2.5">
          <NavLink to="/" className="mr-1 flex shrink-0 items-center gap-2 sm:mr-2">
            <Logo className="h-7 w-7" />
            <span className="font-display text-lg text-stone-50 max-sm:sr-only">Cineclub</span>
          </NavLink>
          <nav className="flex min-w-0 flex-1 items-center gap-0.5 sm:gap-1">
            {links.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  cx(
                    'flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1.5 text-sm transition-colors sm:px-3',
                    isActive ? 'bg-stone-800 text-stone-50' : 'text-stone-400 hover:text-stone-100',
                  )
                }
              >
                <Icon className="h-4 w-4 max-sm:hidden" />
                {label}
              </NavLink>
            ))}
          </nav>
          <Avatar member={me} />
          <button type="button" onClick={signOut} title="Salir" aria-label="Salir" className="rounded-full p-1.5 text-stone-500 hover:bg-stone-800 hover:text-stone-200">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pt-6 pb-16">
        <Outlet />
      </main>
      <footer className="pb-safe px-4 text-center text-xs text-stone-600">
        Datos e imágenes de <a href="https://www.themoviedb.org" target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-stone-400">TMDB</a>. Este producto usa la API de TMDB pero no está avalado ni certificado por TMDB.
      </footer>
    </div>
  )
}
