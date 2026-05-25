import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Sidebar from '../../components/Sidebar.jsx'
import Topbar  from '../../components/Topbar.jsx'
import ScoreModal from '../../components/ScoreModal.jsx'
import { useAuth } from '../../App.jsx'

export default function TeamDashboard() {
  const { user, bookings, setBookings, matchResults, setMatchResults, matchPosts } = useAuth()
  const navigate = useNavigate()
  const [scoreModalOpen, setScoreModalOpen] = useState(false)
  const [selectedMatch, setSelectedMatch] = useState(null)
  const myTeamName = user?.teamInfo?.name || user?.teamName || 'My Team'
  const isBasicTeamMember = user?.teamAccess === 'basic'

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

  const myBookings = bookings.filter(b => b.team === myTeamName)
  
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

    // Check if booking is today and time has passed (+ 2 hour buffer for match duration)
    if (bDate.getTime() === today.getTime()) {
      const currentMinutes = now.getHours() * 60 + now.getMinutes()
      const bookingMinutes = parseTimeToMinutes(bookingTime)
      return currentMinutes > bookingMinutes + 120 // 2 hours after scheduled time
    }

    // If booking is in past date, it's finished
    if (bDate < today) return true

    return false
  }

  // Find finished matches that need score entry
  const finishedMatchesNeedingScores = myBookings.filter(b => {
    if (b.status === 'cancelled' || !b.opponent) return false // Only matches with opponents
    if (!isMatchFinished(b.date, b.time)) return false // Only finished matches
    // Check if score already submitted
    const scoreExists = matchResults.find(r => r.bookingId === b.id && r.team === myTeamName)
    return !scoreExists // Only if score not submitted
  })

  // Show score modal for first finished match needing score
  React.useEffect(() => {
    if (finishedMatchesNeedingScores.length > 0 && !selectedMatch) {
      setSelectedMatch(finishedMatchesNeedingScores[0])
      setScoreModalOpen(true)
    }
  }, [finishedMatchesNeedingScores, selectedMatch])

  const handleScoreSubmit = async (scoreData) => {
    setMatchResults(prev => [...prev, scoreData])
    setScoreModalOpen(false)
    setSelectedMatch(null)
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

  const upcoming = myBookings
    .filter(b => b.status !== 'cancelled' && isUpcoming(b.date, b.time))
    .sort((a, b) => bookingSortValue(a) - bookingSortValue(b))
    .slice(0, 3)
  const activeBookingCount = myBookings.filter(b => b.status !== 'cancelled').length
  const recent = teamMatchHistory.slice(0, 3)

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

  const unbook = (bookingId, venue, date, time) => {
    const confirmed = window.confirm(`Unbook ${venue} on ${date} at ${time}?`)
    if (!confirmed) return

    setBookings(prev => prev.map(booking => (
      booking.id === bookingId ? { ...booking, status: 'cancelled' } : booking
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
              { icon:'fa-calendar-check', cls:'si-blue',   val:'3',             lbl:'Upcoming Matches', sub:'Next: Tomorrow' },
              { icon:'fa-building',       cls:'si-orange', val:String(activeBookingCount), lbl:'Booked Futsals',  sub:'Your team only' },
              { icon:'fa-trophy',         cls:'si-purple', val:'12',            lbl:'Season Wins',     sub:'+3 this month' },
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
                {!isBasicTeamMember && (
                  <button className="btn btn-outline btn-sm" onClick={() => navigate('/team/book-futsal')}>
                    <i className="fas fa-plus" /> Book
                  </button>
                )}
              </div>
              <div>
                {upcoming.length === 0 ? (
                  <div className="empty-state" style={{ padding:'26px 18px' }}>
                    <i className="fas fa-calendar-plus" />
                    <h3>No bookings yet</h3>
                    <p>Your upcoming bookings will appear here.</p>
                  </div>
                ) : upcoming.map(b => (
                  <div key={b.id} style={{ padding:'13px 22px', borderBottom:'1px solid #f0f4f8', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                    <div>
                      {b.opponent ? (
                        <>
                          <div style={{ fontWeight:900, fontSize:15, fontFamily:'Barlow Condensed,sans-serif', color:'#1a202c', marginBottom:6 }}>
                            <span style={{ color:'var(--green)' }}>{myTeamName}</span>
                            <span style={{ color:'#cbd5e0', margin:'0 8px' }}>vs</span>
                            <span>{b.opponent}</span>
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
                          onClick={() => unbook(b.id, b.venue, b.date, b.time)}
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

        </div>
      </div>

      {/* Score Entry Modal */}
      {scoreModalOpen && selectedMatch && (
        <ScoreModal
          booking={selectedMatch}
          myTeamName={myTeamName}
          onSubmit={handleScoreSubmit}
          onClose={() => setScoreModalOpen(false)}
        />
      )}
    </div>
  )
}
