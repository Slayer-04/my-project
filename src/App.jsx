import React, { createContext, useContext, useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { challenges as seedChallenges } from './data/mockData.js'
import { initSocket, emitUserJoin, disconnectSocket } from './utils/socketService.js'

/* ── Auth ──────────────────────────────── */
import Login    from './pages/auth/Login.jsx'
import Register from './pages/auth/Register.jsx'
import VerifyEmail from './pages/auth/VerifyEmail.jsx'

/* ── Team User ─────────────────────────── */
import TeamDashboard from './pages/team/TeamDashboard.jsx'
import FindMatch     from './pages/team/FindMatch.jsx'
import BookFutsal    from './pages/team/BookFutsal.jsx'
import TeamProfile   from './pages/team/TeamProfile.jsx'
import TeamChoice    from './pages/team/TeamChoice.jsx'
import JoinTeam      from './pages/team/JoinTeam.jsx'
import Members       from './pages/team/Members.jsx'

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

const hasActiveTeam = user => Boolean(
  user?.teamProfileCompleted
  || (
    (user?.teamAccess === 'basic' || user?.isCaptain === false)
    && (
      user?.teamInfo?.teamId
      || user?.teamInfo?.uid
      || user?.teamInfo?.teamName
      || user?.teamName
    )
  )
)

function TeamProfileGuard({ children }) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  if (user.role !== 'team') return <Navigate to="/login" replace />
  try {
    const seenKey = `fotmatch.seenTeamChoice:${user.id || user.email || ''}`
    const seen = typeof window !== 'undefined' && localStorage.getItem(seenKey)
    if (!hasActiveTeam(user) && !seen) return <Navigate to="/team/choice" replace />
  } catch (_e) {
    if (!hasActiveTeam(user)) return <Navigate to="/team/choice" replace />
  }
  return children
}

function TeamFeatureGuard({ children }) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  if (user.role !== 'team') return <Navigate to="/login" replace />
  try {
    const seenKey = `fotmatch.seenTeamChoice:${user.id || user.email || ''}`
    const seen = typeof window !== 'undefined' && localStorage.getItem(seenKey)
    if (!hasActiveTeam(user) && !seen) return <Navigate to="/team/choice" replace />
  } catch (_e) {
    if (!hasActiveTeam(user)) return <Navigate to="/team/choice" replace />
  }
  if (user.teamAccess === 'basic') return <Navigate to="/team" replace />
  return children
}

export default function App() {
  const [user, setUser] = useState(null)
  const ONE_DAY_MS = 24 * 60 * 60 * 1000

  const parseScheduledDateTime = (post) => {
    const dateText = String(post?.date || '').trim()
    if (!dateText) return null

    const scheduledDate = new Date(dateText)
    if (Number.isNaN(scheduledDate.getTime())) return null

    const timeText = String(post?.time || '').trim()
    const timeMatch = timeText.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i)
    if (timeMatch) {
      let hours = Number(timeMatch[1])
      const minutes = Number(timeMatch[2])
      const meridiem = timeMatch[3]?.toUpperCase()

      if (meridiem === 'PM' && hours !== 12) hours += 12
      if (meridiem === 'AM' && hours === 12) hours = 0

      scheduledDate.setHours(hours, minutes, 0, 0)
    } else {
      scheduledDate.setHours(23, 59, 59, 999)
    }

    return scheduledDate
  }

  const isActiveMatchPost = (post) => {
    const scheduledDate = parseScheduledDateTime(post)
    if (!scheduledDate) return true
    return scheduledDate.getTime() >= Date.now()
  }

  const normalizeNotifications = (items) => {
    if (!Array.isArray(items)) return []

    const cutoffTime = Date.now() - ONE_DAY_MS

    return items
      .filter(notification => {
        const createdAt = new Date(notification?.createdAt || 0).getTime()
        return Number.isFinite(createdAt) && createdAt >= cutoffTime
      })
      .sort((left, right) => {
        const leftTime = new Date(left?.createdAt || 0).getTime()
        const rightTime = new Date(right?.createdAt || 0).getTime()

        return rightTime - leftTime
      })
  }

  const [bookings, setBookings] = useState(() => {
    try {
      const stored = localStorage.getItem('fotmatch-bookings')
      return stored ? JSON.parse(stored) : []
    } catch (_error) {
      return []
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
      return normalizeNotifications(stored ? JSON.parse(stored) : [])
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
      const parsed = stored ? JSON.parse(stored) : []
      // Filter out any auto-generated posts from previous app versions.
      // Auto-generated IDs used to be prefixed with "post-" (e.g. "post-<id>").
      const manualOnly = Array.isArray(parsed)
        ? parsed.filter(p => !(typeof p?.id === 'string' && p.id.startsWith('post-')))
        : []
      return Array.isArray(manualOnly) ? manualOnly.filter(isActiveMatchPost) : []
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
      const normalizedNotifications = normalizeNotifications(resolvedNotifications)

      try {
        localStorage.setItem('fotmatch-notifications', JSON.stringify(normalizedNotifications))
      } catch (_error) {
        // Ignore storage failures and keep the in-memory state.
      }

      return normalizedNotifications
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
      const activePosts = Array.isArray(resolvedPosts) ? resolvedPosts.filter(isActiveMatchPost) : []

      try {
        localStorage.setItem('fotmatch-match-posts', JSON.stringify(activePosts))
      } catch (_error) {
        // Ignore storage failures and keep the in-memory state.
      }

      return activePosts
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
          <Route path="/verify-email" element={<VerifyEmail />} />
          <Route path="/signup"  element={<Navigate to="/register" replace />} />

          {/* Team */}
          <Route path="/team"             element={<Guard role="team"><TeamDashboard /></Guard>} />
          <Route path="/team/find-match"  element={<TeamFeatureGuard><FindMatch /></TeamFeatureGuard>} />
          <Route path="/team/book-futsal" element={<TeamFeatureGuard><BookFutsal /></TeamFeatureGuard>} />
          <Route path="/team/profile"     element={<Guard role="team"><TeamProfile /></Guard>} />
          <Route path="/team/choice"      element={<Guard role="team"><TeamChoice /></Guard>} />
          <Route path="/team/join"        element={<Guard role="team"><JoinTeam /></Guard>} />
          <Route path="/team/members"     element={<Guard role="team"><Members /></Guard>} />

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
