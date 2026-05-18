import React, { createContext, useContext, useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { bookings as seedBookings } from './data/mockData.js'
import { challenges as seedChallenges } from './data/mockData.js'
import { initSocket, emitUserJoin, disconnectSocket } from './utils/socketService.js'

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
  const [bookings, setBookings] = useState(() => {
    try {
      const stored = localStorage.getItem('fotmatch-bookings')
      return stored ? JSON.parse(stored) : seedBookings
    } catch (_error) {
      return seedBookings
    }
  })
  const [challenges, setChallenges] = useState(() => {
    try {
      const stored = localStorage.getItem('fotmatch-challenges')
      return stored ? JSON.parse(stored) : seedChallenges
    } catch (_error) {
      return seedChallenges
    }
  })
  const [notifications, setNotifications] = useState(() => {
    try {
      const stored = localStorage.getItem('fotmatch-notifications')
      return stored ? JSON.parse(stored) : []
    } catch (_error) {
      return []
    }
  })
  const [matchResults, setMatchResults] = useState(() => {
    try {
      const stored = localStorage.getItem('fotmatch-match-results')
      return stored ? JSON.parse(stored) : []
    } catch (_error) {
      return []
    }
  })
  const [matchPosts, setMatchPosts] = useState(() => {
    try {
      const stored = localStorage.getItem('fotmatch-match-posts')
      return stored ? JSON.parse(stored) : []
    } catch (_error) {
      return []
    }
  })

  const updateBookings = nextBookings => {
    setBookings(prev => {
      const resolvedBookings = typeof nextBookings === 'function'
        ? nextBookings(prev)
        : nextBookings

      try {
        localStorage.setItem('fotmatch-bookings', JSON.stringify(resolvedBookings))
      } catch (_error) {
        // Ignore storage failures and keep the in-memory state.
      }

      return resolvedBookings
    })
  }

  const updateChallenges = nextChallenges => {
    setChallenges(prev => {
      const resolvedChallenges = typeof nextChallenges === 'function'
        ? nextChallenges(prev)
        : nextChallenges

      try {
        localStorage.setItem('fotmatch-challenges', JSON.stringify(resolvedChallenges))
      } catch (_error) {
        // Ignore storage failures and keep the in-memory state.
      }

      return resolvedChallenges
    })
  }

  const updateNotifications = nextNotifications => {
    setNotifications(prev => {
      const resolvedNotifications = typeof nextNotifications === 'function'
        ? nextNotifications(prev)
        : nextNotifications

      try {
        localStorage.setItem('fotmatch-notifications', JSON.stringify(resolvedNotifications))
      } catch (_error) {
        // Ignore storage failures and keep the in-memory state.
      }

      return resolvedNotifications
    })
  }

  const updateMatchResults = nextResults => {
    setMatchResults(prev => {
      const resolvedResults = typeof nextResults === 'function'
        ? nextResults(prev)
        : nextResults

      try {
        localStorage.setItem('fotmatch-match-results', JSON.stringify(resolvedResults))
      } catch (_error) {
        // Ignore storage failures and keep the in-memory state.
      }

      return resolvedResults
    })
  }

  const updateMatchPosts = nextPosts => {
    setMatchPosts(prev => {
      const resolvedPosts = typeof nextPosts === 'function'
        ? nextPosts(prev)
        : nextPosts

      try {
        localStorage.setItem('fotmatch-match-posts', JSON.stringify(resolvedPosts))
      } catch (_error) {
        // Ignore storage failures and keep the in-memory state.
      }

      return resolvedPosts
    })
  }

  // Initialize WebSocket when user logs in
  useEffect(() => {
    if (user) {
      // Initialize socket connection
      initSocket()
      
      // Notify server about user join
      emitUserJoin(user)
      
      console.log(`✅ App: User logged in - ${user.email} (${user.role})`)
    } else {
      // Disconnect when user logs out
      disconnectSocket()
    }

    // Cleanup on unmount
    return () => {
      // Optional: Keep connection alive even if component unmounts
      // Only disconnect on actual logout (handled above)
    }
  }, [user])

  return (
    <AuthContext.Provider value={{
      user,
      setUser,
      bookings,
      setBookings: updateBookings,
      challenges,
      setChallenges: updateChallenges,
      notifications,
      setNotifications: updateNotifications,
      matchResults,
      setMatchResults: updateMatchResults,
      matchPosts,
      setMatchPosts: updateMatchPosts,
    }}>
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
