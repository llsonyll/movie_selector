import { Route, Routes } from 'react-router-dom'
import { AuthGate } from '@/features/auth/AuthProvider'
import { Layout } from '@/components/Layout'
import { CurrentRoundPage, RoundPage } from '@/features/rounds/RoundPage'
import { HistoryPage } from '@/features/rounds/HistoryPage'
import { MembersPage } from '@/features/members/MembersPage'

export function App() {
  return (
    <AuthGate>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<CurrentRoundPage />} />
          <Route path="ronda/:id" element={<RoundPage />} />
          <Route path="historial" element={<HistoryPage />} />
          <Route path="miembros" element={<MembersPage />} />
          <Route path="*" element={<CurrentRoundPage />} />
        </Route>
      </Routes>
    </AuthGate>
  )
}
