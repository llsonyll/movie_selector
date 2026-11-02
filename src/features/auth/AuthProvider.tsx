import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Member } from '@/lib/types'
import { LoginScreen, NotAMemberScreen } from './LoginScreen'
import { FullScreenSpinner } from '@/components/ui'

const MeContext = createContext<Member | null>(null)

/** El miembro con sesión iniciada. Solo se usa dentro de <AuthGate>, donde siempre existe. */
export function useMe(): Member {
  const me = useContext(MeContext)
  if (!me) throw new Error('useMe fuera de AuthGate')
  return me
}

export function AuthGate({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null | undefined>(undefined)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  const userId = session?.user.id
  const me = useQuery({
    queryKey: ['me', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase.from('members').select('*').eq('id', userId!).maybeSingle()
      if (error) throw error
      return data as Member | null
    },
  })

  if (session === undefined || (userId && me.isPending)) return <FullScreenSpinner />
  if (!session) return <LoginScreen />
  if (!me.data || !me.data.active) return <NotAMemberScreen />
  return <MeContext.Provider value={me.data}>{children}</MeContext.Provider>
}

export const signOut = () => supabase.auth.signOut()
