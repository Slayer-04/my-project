import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Sidebar from '../../components/Sidebar.jsx'
import Topbar  from '../../components/Topbar.jsx'
import ScoreModal from '../../components/ScoreModal.jsx'
import { useAuth } from '../../App.jsx'
import { getApiBaseUrl } from '../../utils/apiConfig.js'

const API_BASE = getApiBaseUrl()

const mapBookingFromApi = booking => ({
  ...booking,
  id: booking.id || booking._id,
  venue: booking.venueId?.name || booking.venue,
})

export default function TeamDashboard() {
  const { user, setUser, bookings, setBookings, matchResults, setMatchResults, matchPosts } = useAuth()
  const navigate = useNavigate()
  const [scoreModalOpen, setScoreModalOpen] = useState(false)
  const [selectedMatch, setSelectedMatch] = useState(null)
  // Track bookings the user has dismissed so we don't re-open them automatically
  const dismissedMatchIds = React.useRef(new Set())
  const [showAllUpcoming, setShowAllUpcoming] = useState(false)
  const [showAllMatches, setShowAllMatches] = useState(false)
  const teamAliases = [
    user?.teamInfo?.teamName,
    user?.teamInfo?.name,
    user?.teamName,
    user?.teamInfo?.captainName,
    user?.name,
  ].map(value => String(value || '').trim()).filter(Boolean)
  const myTeamName = teamAliases[0] || 'My Team'
  const isBasicTeamMember = user?.teamAccess === 'basic'

  const matchesTeam = (booking) => {
    const bookingTeam = String(booking?.team || '').trim()
    const bookingOpponent = String(booking?.opponent || '').trim()
    const bookingTeamEmail = String(booking?.teamEmail || '').trim().toLowerCase()
    const userEmail = String(user?.email || '').trim().toLowerCase()

    return teamAliases.some(alias => alias === bookingTeam || alias === bookingOpponent)
      || (userEmail && bookingTeamEmail === userEmail)
  }

  useEffect(() => {
    if (user?.role !== 'team' || !myTeamName) return

    let active = true

    const loadTeamBookings = async () => {
      try {
        const response = await fetch(`${API_BASE}/bookings`)
        if (!response.ok) return

        const data = await response.json()
        if (!active || !Array.isArray(data)) return

        // Pull all bookings for this team from the API — both venue-only bookings
        // and match bookings (with opponent). The backend creates confirmed match
        // bookings directly when a challenge is accepted, so we must load them here
        // or they will never appear on the dashboard after a page reload.
        const apiBookings = data.map(mapBookingFromApi).filter(b => {
          if (!matchesTeam(b)) return false
          // For match bookings (has opponent), only show ones this team owns (b.team)
          // to avoid showing the opponent's copy (which would display as a self-match)
          if (b.opponent) {
            const bookingTeam = String(b.team || '').trim()
            return teamAliases.some(a => a === bookingTeam)
          }
          return true
        })

        setBookings(prev => {
          const apiById   = new Map(apiBookings.map(b => [String(b.id), b]))
          const apiBySlot = new Map(apiBookings.map(b => {
            const key = [
              String(b.team     || '').trim().toLowerCase(),
              String(b.opponent || '').trim().toLowerCase(),
              String(b.date     || ''),
              String(b.time     || ''),
              String(b.venue    || '').trim().toLowerCase(),
            ].join('|')
            return [key, b]
          }))

          let changed = false

          // Pass 1: reconcile bookings that already exist locally.
          // When the local id is a numeric Date.now() value but the DB has
          // assigned a real ObjectId, adopt the DB id so Pass 2 won't
          // re-add the same booking as a duplicate (the flicker bug).
          const updated = prev.map(existing => {
            // First try exact id match
            const apiMatch = apiById.get(String(existing.id))
            if (apiMatch) {
              if (apiMatch.status !== existing.status) {
                changed = true
                return { ...existing, id: apiMatch.id, status: apiMatch.status }
              }
              return existing
            }
            // Fallback: match by slot key (handles id mismatch between local & DB)
            const slotKey = [
              String(existing.team     || '').trim().toLowerCase(),
              String(existing.opponent || '').trim().toLowerCase(),
              String(existing.date     || ''),
              String(existing.time     || ''),
              String(existing.venue    || '').trim().toLowerCase(),
            ].join('|')
            const slotMatch = apiBySlot.get(slotKey)
            if (slotMatch) {
              // Always adopt the DB id to prevent duplicate insertion next poll
              const idChanged     = String(existing.id) !== String(slotMatch.id)
              const statusChanged = slotMatch.status !== existing.status
              if (idChanged || statusChanged) {
                changed = true
                return { ...existing, id: slotMatch.id, status: slotMatch.status }
              }
            }
            return existing
          })

          // Pass 2: add bookings from API not yet in local state
          const existingIds   = new Set(updated.map(b => String(b.id)))
          const existingMatchSlots = new Set(
            updated
              .filter(b => b.opponent)
              .map(b => [
                String(b.team     || '').trim().toLowerCase(),
                String(b.opponent || '').trim().toLowerCase(),
                String(b.date     || ''),
                String(b.time     || ''),
                String(b.venue    || '').trim().toLowerCase(),
              ].join('|'))
          )

          const newFromApi = apiBookings.filter(b => {
            if (existingIds.has(String(b.id))) return false
            if (b.opponent) {
              const slot = [
                String(b.team     || '').trim().toLowerCase(),
                String(b.opponent || '').trim().toLowerCase(),
                String(b.date     || ''),
                String(b.time     || ''),
                String(b.venue    || '').trim().toLowerCase(),
              ].join('|')
              if (existingMatchSlots.has(slot)) return false
            }
            return true
          })

          if (newFromApi.length > 0) return [...prev, ...newFromApi]
          if (changed) return updated
          return prev
        })
      } catch (_error) {
        // Keep local bookings if the server is unavailable.
      }
    }

    loadTeamBookings()
    const intervalId = setInterval(loadTeamBookings, 5000)

    const handleFocus = () => {
      loadTeamBookings()
    }

    window.addEventListener('focus', handleFocus)

    return () => {
      active = false
      clearInterval(intervalId)
      window.removeEventListener('focus', handleFocus)
    }
  }, [myTeamName, setBookings, user?.role])

  useEffect(() => {
    if (!Array.isArray(matchPosts) || matchPosts.length === 0) return

    let hasMismatch = false
    const postById = new Map(matchPosts.map(post => [post.id, post]))

    const reconciled = bookings.map(booking => {
      if (booking.source !== 'find-match-post' || !booking.postId) return booking

      const sourcePost = postById.get(booking.postId)
      if (!sourcePost) return booking

      const dateMismatch = booking.date !== sourcePost.date
      const timeMismatch = booking.time !== sourcePost.time
      const venueMismatch = booking.venue !== sourcePost.venue

      if (!dateMismatch && !timeMismatch && !venueMismatch) return booking

      hasMismatch = true
      return {
        ...booking,
        date: sourcePost.date,
        time: sourcePost.time,
        venue: sourcePost.venue,
      }
    })

    if (hasMismatch) {
      setBookings(reconciled)
    }
  }, [bookings, matchPosts, setBookings])

  // Only show bookings where myTeam is the booking owner (b.team).
  // The second booking created for the opponent team (b.team = opponentTeam) is meant
  // for the opponent's dashboard — including it here causes the "Team A vs Team A" 
  // self-match display bug because the render always shows "{myTeamName} vs {b.opponent}".
  const myBookings = bookings.filter(b => {
    if (!b.opponent) return matchesTeam(b)   // venue-only bookings: use full alias match
    const bookingTeam = String(b.team || '').trim()
    return teamAliases.some(alias => alias === bookingTeam)
  })
  
  // Helper: Parse time string (12-hour format) to minutes since midnight
  const parseTimeToMinutes = (timeStr) => {
    if (!timeStr) return 0
    const is12Hour = /AM|PM/i.test(timeStr)
    if (!is12Hour) {
      const [h, m] = timeStr.split(':').map(Number)
      return h * 60 + m
    }
    const parts = timeStr.trim().split(' ')
    const [h, m] = parts[0].split(':').map(Number)
    const meridiem = parts[1]?.toUpperCase()
    let hour = h
    if (meridiem === 'PM' && hour !== 12) hour += 12
    if (meridiem === 'AM' && hour === 12) hour = 0
    return hour * 60 + m
  }

  // Helper: Check if booking is in the future
  const isUpcoming = (bookingDate, bookingTime) => {
    const bDate = new Date(bookingDate)
    if (Number.isNaN(bDate.getTime())) return false

    const now = new Date()
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    bDate.setHours(0, 0, 0, 0)

    // If booking is for a future date, it's upcoming
    if (bDate > today) return true

    // If booking is for today, check if time is in future
    if (bDate.getTime() === today.getTime()) {
      const currentMinutes = now.getHours() * 60 + now.getMinutes()
      const bookingMinutes = parseTimeToMinutes(bookingTime)
      return bookingMinutes > currentMinutes + 30 // 30 min buffer
    }

    // If booking is in past, not upcoming
    return false
  }

  // Helper: Check if match is finished and score entry is needed
  const isMatchFinished = (bookingDate, bookingTime) => {
    const bDate = new Date(bookingDate)
    if (Number.isNaN(bDate.getTime())) return false

    const now = new Date()
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    bDate.setHours(0, 0, 0, 0)

    // Check if booking is today and time has passed (+ 1 hour buffer for match duration)
    if (bDate.getTime() === today.getTime()) {
      const currentMinutes = now.getHours() * 60 + now.getMinutes()
      const bookingMinutes = parseTimeToMinutes(bookingTime)
      return currentMinutes > bookingMinutes + 60 // 1 hour after scheduled time
    }

    // If booking is in past date, it's finished
    if (bDate < today) return true

    return false
  }

  // Find finished matches that need score entry
  const finishedMatchesNeedingScores = myBookings.filter(b => {
    if (b.status !== 'confirmed' || !b.opponent) return false // Only confirmed matches with opponents
    if (!isMatchFinished(b.date, b.time)) return false // Only finished matches
    // Only process bookings where this team is the owner (not the opponent copy)
    const bookingTeam = String(b.team || '').trim()
    if (!teamAliases.some(alias => alias === bookingTeam)) return false
    // Skip if the opponent is the same as this team (corrupt self-match data)
    if (String(b.opponent || '').trim().toLowerCase() === bookingTeam.toLowerCase()) return false
    // Check if score already submitted
    const scoreExists = matchResults.find(r => String(r.bookingId) === String(b.id) && r.team === myTeamName)
    return !scoreExists // Only if score not submitted
  })

  // Show score modal for first finished match needing score
  React.useEffect(() => {
    if (selectedMatch) return
    const next = finishedMatchesNeedingScores.find(b => {
      // Skip self-matches (corrupt data)
      if (String(b.team || '').trim().toLowerCase() === String(b.opponent || '').trim().toLowerCase()) return false
      // Skip bookings the user already dismissed
      if (dismissedMatchIds.current.has(String(b.id))) return false
      return true
    })
    if (next) {
      setSelectedMatch(next)
      setScoreModalOpen(true)
    }
  }, [finishedMatchesNeedingScores, selectedMatch])

  const handleScoreSubmit = async (scoreData) => {
    try {
      const response = await fetch(`${API_BASE}/match-results`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...scoreData,
          submittedBy: user?.name || myTeamName,
        }),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.message || 'Failed to submit match result.')
      }

      const savedResult = data.result || scoreData
      setMatchResults(prev => [...prev, savedResult])

      if (data.updatedTeam && user) {
        setUser(prev => {
          if (!prev) return prev

          return {
            ...prev,
            eloRating: data.updatedTeam.eloRating ?? prev.eloRating,
            eloMatchesPlayed: data.updatedTeam.eloMatchesPlayed ?? prev.eloMatchesPlayed,
            teamInfo: {
              ...prev.teamInfo,
              currentElo: data.updatedTeam.eloRating ?? prev.teamInfo?.currentElo,
            },
          }
        })
      }

      setScoreModalOpen(false)
      setSelectedMatch(null)
    } catch (_error) {
      alert('Unable to submit match result right now. Please try again.')
    }
  }

  const bookingSortValue = (booking) => {
    const bookingDate = new Date(booking.date)
    if (Number.isNaN(bookingDate.getTime())) return Number.MAX_SAFE_INTEGER
    bookingDate.setHours(0, 0, 0, 0)
    return bookingDate.getTime() + (parseTimeToMinutes(booking.time) * 60 * 1000)
  }

  const teamMatchHistory = matchResults
    .filter(result => result.team === myTeamName)
    .map(result => {
      const myScore = Number(result.myScore)
      const opponentScore = Number(result.opponentScore)
      const resultType = myScore > opponentScore ? 'win' : myScore < opponentScore ? 'loss' : 'draw'

      const parsedDate = result.matchDate ? new Date(result.matchDate) : null
      const dateLabel = parsedDate && !Number.isNaN(parsedDate.getTime())
        ? parsedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        : (result.matchDate || '-')

      const sortTimestamp = result.timestamp
        ? new Date(result.timestamp).getTime()
        : Number.NaN

      const sortFallbackDate = parsedDate && !Number.isNaN(parsedDate.getTime())
        ? parsedDate.getTime() + (parseTimeToMinutes(result.matchTime) * 60 * 1000)
        : 0

      return {
        id: result.bookingId || result.timestamp || `${result.opponent}-${result.matchDate}`,
        opponent: result.opponent || 'Unknown',
        score: `${myScore}-${opponentScore}`,
        result: resultType,
        date: dateLabel,
        venue: result.venue || '-',
        sortValue: Number.isFinite(sortTimestamp) ? sortTimestamp : sortFallbackDate,
      }
    })
    .sort((left, right) => right.sortValue - left.sortValue)

  const hasMatchScore = (booking) => (
    matchResults.some(result => String(result.bookingId) === String(booking.id) && result.team === myTeamName)
  )

  const upcoming = myBookings
    .filter(b => {
      if (b.status === 'cancelled') return false
      if (!isUpcoming(b.date, b.time)) return false
      // Block self-matches (corrupt booking where team === opponent)
      if (b.opponent && String(b.team || '').trim().toLowerCase() === String(b.opponent || '').trim().toLowerCase()) return false
      // For match bookings, hide ones where the score has already been submitted
      if (b.opponent && hasMatchScore(b)) return false
      return true
    })
    .sort((a, b) => bookingSortValue(a) - bookingSortValue(b))
  const visibleUpcoming = showAllUpcoming ? upcoming : upcoming.slice(0, 3)

  // Upcoming matches — confirmed bookings with an opponent (i.e. match bookings, not venue-only)
  const upcomingMatches = myBookings.filter(b => {
    if (b.status === 'cancelled' || !b.opponent) return false
    if (!isUpcoming(b.date, b.time)) return false
    // Only show bookings owned by this team
    const bookingTeam = String(b.team || '').trim()
    if (!teamAliases.some(a => a === bookingTeam)) return false
    // Skip self-matches
    if (bookingTeam.toLowerCase() === String(b.opponent || '').trim().toLowerCase()) return false
    return true
  }).sort((a, b) => bookingSortValue(a) - bookingSortValue(b))
  const visibleMatches = showAllMatches ? upcomingMatches : upcomingMatches.slice(0, 5)
  const upcomingCount = myBookings.filter(b =>
    b.status !== 'cancelled' &&
    isUpcoming(b.date, b.time) &&
    (!b.opponent || !hasMatchScore(b)) &&
    !(b.opponent && String(b.team || '').trim().toLowerCase() === String(b.opponent || '').trim().toLowerCase())
  ).length
  const activeBookingCount = myBookings.filter(b => b.status !== 'cancelled').length
  const recent = teamMatchHistory.slice(0, 3)
  const seasonWins = teamMatchHistory.filter(match => match.result === 'win').length

  const resultColor = r => r==='win' ? '#00b96b' : r==='loss' ? '#e53e3e' : '#eab308'

  const canUnbook = (dateValue) => {
    const bookingDate = new Date(dateValue)
    if (Number.isNaN(bookingDate.getTime())) return false

    const today = new Date()
    bookingDate.setHours(0, 0, 0, 0)
    today.setHours(0, 0, 0, 0)

    const dayDiff = (bookingDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    return dayDiff > 2
  }

  const unbook = (bookingId, venue, date, time, challengeId) => {
    const confirmed = window.confirm(`Unbook ${venue} on ${date} at ${time}?`)
    if (!confirmed) return

    setBookings(prev => prev.map(booking => (
      challengeId
        ? (booking.challengeId === challengeId ? { ...booking, status: 'cancelled' } : booking)
        : (booking.id === bookingId ? { ...booking, status: 'cancelled' } : booking)
    )))
  }

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-area">
        <Topbar title="Dashboard" breadcrumb="FotMatch / Team User" />
        <div className="page-inner">

          {/* Welcome */}
          <div className="anim-1" style={{ marginBottom:26 }}>
            <h1 style={{ fontFamily:'Barlow Condensed,sans-serif', fontSize:28, fontWeight:900 }}>
              Hey, {user?.name?.split(' ')[0]}! 👋
            </h1>
            <p style={{ color:'#4a5568', fontSize:14, marginTop:4 }}>Ready for your next match?</p>
          </div>

          {/* Stats */}
          <div className="stats-row anim-2">
            {[
              { icon:'fa-users',          cls:'si-green',  val:myTeamName,       lbl:'My Team',         sub:'8 members' },
              { icon:'fa-calendar-check', cls:'si-blue',   val:String(upcomingCount), lbl:'Upcoming Matches', sub: upcomingCount > 0 ? 'Next: Soon' : 'No upcoming matches' },
              { icon:'fa-building',       cls:'si-orange', val:String(activeBookingCount), lbl:'Booked Futsals',  sub:'Your team only' },
              { icon:'fa-trophy',         cls:'si-purple', val:String(seasonWins), lbl:'Season Wins',     sub: seasonWins > 0 ? 'From match history' : 'No wins yet' },
            ].map(s => (
              <div className="stat-card" key={s.lbl}>
                <div className={`stat-icon ${s.cls}`}><i className={`fas ${s.icon}`} /></div>
                <div>
                  <div className="stat-val">{s.val}</div>
                  <div className="stat-label">{s.lbl}</div>
                  <div className="stat-sub">{s.sub}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="two-col anim-3">
            {/* Upcoming Bookings */}
            <div className="card">
              <div className="card-hd">
                <h3>Upcoming Bookings</h3>
                <div style={{ display:'flex', gap:8 }}>
                  {upcoming.length > 3 && (
                    <button className="btn btn-ghost btn-sm" onClick={() => setShowAllUpcoming(v => !v)}>
                      <i className={`fas fa-${showAllUpcoming ? 'chevron-up' : 'ellipsis'}`} /> {showAllUpcoming ? 'Less' : 'More'}
                    </button>
                  )}
                  {!isBasicTeamMember && (
                    <button className="btn btn-outline btn-sm" onClick={() => navigate('/team/book-futsal')}>
                      <i className="fas fa-plus" /> Book
                    </button>
                  )}
                </div>
              </div>
              <div>
                {visibleUpcoming.length === 0 ? (
                  <div className="empty-state" style={{ padding:'26px 18px' }}>
                    <i className="fas fa-calendar-plus" />
                    <h3>No bookings yet</h3>
                    <p>Your upcoming bookings will appear here.</p>
                  </div>
                ) : visibleUpcoming.map(b => (
                  <div key={b.id} style={{ padding:'13px 22px', borderBottom:'1px solid #f0f4f8', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                    <div>
                      {b.opponent ? (
                        <>
                          <div style={{ fontWeight:900, fontSize:15, fontFamily:'Barlow Condensed,sans-serif', color:'#1a202c', marginBottom:6 }}>
                            <span style={{ color:'var(--green)' }}>{myTeamName}</span>
                            <span style={{ color:'#cbd5e0', margin:'0 8px' }}>vs</span>
                            <span>{teamAliases.some(a => a === String(b.team||'').trim()) ? b.opponent : b.team}</span>
                          </div>
                          <div style={{ fontSize:11, color:'#8a96a8', marginBottom:4, textTransform:'uppercase', fontWeight:700 }}>
                            <i className="fas fa-building" style={{ marginRight:4 }} />{b.venue}
                          </div>
                        </>
                      ) : (
                        <div style={{ fontWeight:700, fontSize:14 }}>{b.venue}</div>
                      )}
                      <div style={{ fontSize:12, color:'#4a5568', marginTop:2 }}>
                        <i className="fas fa-calendar" style={{ color:'var(--green)', marginRight:5 }} />{b.date}
                        <span style={{ margin:'0 7px', color:'#e4e8ee' }}>|</span>
                        <i className="fas fa-clock" style={{ color:'var(--green)', marginRight:5 }} />{b.time}
                      </div>
                    </div>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <span className={`badge badge-${b.status==='confirmed'?'success':b.status==='pending'?'warning':'danger'}`}>
                        {b.status}
                      </span>
                      {canUnbook(b.date) && (
                        <button
                          className="btn btn-outline btn-sm"
                          onClick={() => unbook(b.id, b.venue, b.date, b.time, b.challengeId)}
                        >
                          Unbook
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent Matches */}
            <div className="card">
              <div className="card-hd">
                <h3>Recent Matches</h3>
                <button className="btn btn-ghost btn-sm" onClick={() => navigate('/team/profile')}>View All</button>
              </div>
              <div className="card-bd" style={{ paddingTop:8 }}>
                {recent.length === 0 ? (
                  <div className="empty-state" style={{ padding:'26px 18px' }}>
                    <i className="fas fa-futbol" />
                    <h3>No match results yet</h3>
                    <p>Submit scores after matches to build recent history.</p>
                  </div>
                ) : recent.map(m => (
                  <div key={m.id} className="match-row">
                    <div className="match-teams">
                      <span style={{ color:'var(--green)', fontWeight:800 }}>{myTeamName}</span>
                      <span className="vs">vs</span>
                      <span>{m.opponent}</span>
                    </div>
                    <div style={{ textAlign:'right' }}>
                      <div className="match-score" style={{ color: resultColor(m.result) }}>{m.score}</div>
                      <div className="match-date">{m.date}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Upcoming Matches */}
          <div className="card anim-4" style={{ marginTop: 24 }}>
            <div className="card-hd">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <h3 style={{ margin: 0 }}>Upcoming Matches</h3>
                {upcomingMatches.length > 0 && (
                  <span style={{ background: 'var(--green)', color: '#fff', borderRadius: 20, padding: '2px 10px', fontSize: 12, fontWeight: 800 }}>
                    {upcomingMatches.length}
                  </span>
                )}
              </div>
              {upcomingMatches.length > 5 && (
                <button className="btn btn-ghost btn-sm" onClick={() => setShowAllMatches(v => !v)}>
                  <i className={`fas fa-${showAllMatches ? 'chevron-up' : 'ellipsis'}`} /> {showAllMatches ? 'Show less' : `Show all ${upcomingMatches.length}`}
                </button>
              )}
            </div>
            <div>
              {visibleMatches.length === 0 ? (
                <div className="empty-state" style={{ padding: '26px 18px' }}>
                  <i className="fas fa-futbol" />
                  <h3>No upcoming matches</h3>
                  <p>Accept a match request or send a challenge to schedule one.</p>
                </div>
              ) : visibleMatches.map(b => {
                const daysUntil = (() => {
                  const bDate = new Date(b.date)
                  const today = new Date()
                  bDate.setHours(0, 0, 0, 0)
                  today.setHours(0, 0, 0, 0)
                  return Math.round((bDate - today) / (1000 * 60 * 60 * 24))
                })()
                const urgencyColor = daysUntil === 0 ? '#e53e3e' : daysUntil <= 2 ? '#d97706' : 'var(--green)'
                const urgencyLabel = daysUntil === 0 ? 'Today!' : daysUntil === 1 ? 'Tomorrow' : `In ${daysUntil} days`
                return (
                  <div key={b.id} style={{ padding: '16px 22px', borderBottom: '1px solid #f0f4f8', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14, flex: 1, minWidth: 200 }}>
                      {/* VS badge */}
                      <div style={{ width: 44, height: 44, borderRadius: 12, background: '#f0fdf4', border: '2px solid var(--green)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 900, color: 'var(--green)', flexShrink: 0, letterSpacing: 0.5 }}>
                        VS
                      </div>
                      <div>
                        <div style={{ fontWeight: 900, fontSize: 16, fontFamily: 'Barlow Condensed,sans-serif', color: '#1a202c', marginBottom: 4 }}>
                          <span style={{ color: 'var(--green)' }}>{myTeamName}</span>
                          <span style={{ color: '#cbd5e0', margin: '0 8px', fontWeight: 400 }}>vs</span>
                          <span>{b.opponent}</span>
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, fontSize: 12, color: '#4a5568' }}>
                          <span><i className="fas fa-building" style={{ color: 'var(--green)', marginRight: 4 }} />{b.venue}</span>
                          <span><i className="fas fa-calendar" style={{ color: 'var(--blue, #3b82f6)', marginRight: 4 }} />{b.date}</span>
                          <span><i className="fas fa-clock" style={{ color: 'var(--orange)', marginRight: 4 }} />{b.time}</span>
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: urgencyColor, background: `${urgencyColor}18`, padding: '3px 10px', borderRadius: 20 }}>
                        {urgencyLabel}
                      </span>
                      <span className={`badge badge-${b.status === 'confirmed' ? 'success' : b.status === 'pending' ? 'warning' : 'danger'}`}>
                        {b.status}
                      </span>
                      {canUnbook(b.date) && (
                        <button className="btn btn-outline btn-sm" onClick={() => unbook(b.id, b.venue, b.date, b.time, b.challengeId)}>
                          Cancel
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

        </div>
      </div>

      {scoreModalOpen && selectedMatch && (
        <ScoreModal
          booking={selectedMatch}
          myTeamName={myTeamName}
          onSubmit={handleScoreSubmit}
          onClose={() => {
            if (selectedMatch) dismissedMatchIds.current.add(String(selectedMatch.id))
            setScoreModalOpen(false)
            setSelectedMatch(null)
          }}
        />
      )}
    </div>
  )
}