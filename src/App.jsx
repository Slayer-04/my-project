import React, { createContext, useContext, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'

/* ── Auth ──────────────────────────────── */
import Login    from './pages/auth/Login.jsx'
import Register from './pages/auth/Register.jsx'

/* ── Team User ─────────────────────────── */
import TeamDashboard from './pages/team/TeamDashboard.jsx'
import FindMatch     from './pages/team/FindMatch.jsx'
import BookFutsal    from './pages/team/BookFutsal.jsx'
import TeamProfile   from './pages/team/TeamProfile.jsx'

/* ── Futsal Owner ──────────────────────── */
import OwnerDashboard from './pages/owner/OwnerDashboard.jsx'
import Schedule       from './pages/owner/Schedule.jsx'
import Bookings       from './pages/owner/Bookings.jsx'
import OwnerProfile   from './pages/owner/OwnerProfile.jsx'

/* ── Admin ─────────────────────────────── */
import AdminDashboard from './pages/admin/AdminDashboard.jsx'
import Users          from './pages/admin/Users.jsx'
import Futsals        from './pages/admin/Futsals.jsx'
import Reports        from './pages/admin/Reports.jsx'
import SystemStatus   from './pages/admin/SystemStatus.jsx'

/* ── Auth Context ──────────────────────── */
export const AuthContext = createContext(null)
export const useAuth = () => useContext(AuthContext)

function Guard({ role, children }) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  if (user.role !== role) return <Navigate to="/login" replace />
  return children
}

function TeamProfileGuard({ children }) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  if (user.role !== 'team') return <Navigate to="/login" replace />
  if (!user.teamProfileCompleted) return <Navigate to="/team/profile" replace />
  return children
}

export default function App() {
  const [user, setUser] = useState(null)

  return (
    <AuthContext.Provider value={{ user, setUser }}>
      <BrowserRouter>
        <Routes>
          <Route path="/"        element={<Navigate to="/login" replace />} />
          <Route path="/login"   element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/signup"  element={<Navigate to="/register" replace />} />

          {/* Team */}
          <Route path="/team"             element={<Guard role="team"><TeamDashboard /></Guard>} />
          <Route path="/team/find-match"  element={<TeamProfileGuard><FindMatch /></TeamProfileGuard>} />
          <Route path="/team/book-futsal" element={<TeamProfileGuard><BookFutsal /></TeamProfileGuard>} />
          <Route path="/team/profile"     element={<Guard role="team"><TeamProfile /></Guard>} />

          {/* Owner */}
          <Route path="/owner"          element={<Guard role="owner"><OwnerDashboard /></Guard>} />
          <Route path="/owner/schedule" element={<Guard role="owner"><Schedule /></Guard>} />
          <Route path="/owner/bookings" element={<Guard role="owner"><Bookings /></Guard>} />
          <Route path="/owner/profile"  element={<Guard role="owner"><OwnerProfile /></Guard>} />

          {/* Admin */}
          <Route path="/admin"         element={<Guard role="admin"><AdminDashboard /></Guard>} />
          <Route path="/admin/users"   element={<Guard role="admin"><Users /></Guard>} />
          <Route path="/admin/futsals" element={<Guard role="admin"><Futsals /></Guard>} />
          <Route path="/admin/reports" element={<Guard role="admin"><Reports /></Guard>} />
          <Route path="/admin/system"  element={<Guard role="admin"><SystemStatus /></Guard>} />

          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthContext.Provider>
  )
}
