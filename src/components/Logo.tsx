/** Claqueta con una estrella: el ícono del cineclub. */
export function Logo({ className = 'h-8 w-8' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      <rect x="6" y="22" width="52" height="34" rx="6" fill="#fbbf24" />
      <path d="M6 22 8 10l52 4-2 8z" fill="#fde68a" />
      <path d="m16 11 6 10M30 12l6 10M44 13l6 10" stroke="#1c1917" strokeWidth="4" strokeLinecap="round" />
      <path d="m32 29 3.5 7.2 7.9 1.1-5.7 5.6 1.3 7.8L32 47l-7 3.7 1.3-7.8-5.7-5.6 7.9-1.1z" fill="#1c1917" />
    </svg>
  )
}
