import React, { useEffect, useState, lazy, Suspense } from 'react'
import { useNavigate } from 'react-router-dom'
import Sidebar from '../../components/Sidebar.jsx'
import Topbar  from '../../components/Topbar.jsx'
import { useAuth } from '../../App.jsx'
import { getApiBaseUrl } from '../../utils/apiConfig.js'

const LocationPicker = lazy(() => import('../../components/LocationPicker.jsx'))

const API_BASE = getApiBaseUrl()

export default function TeamProfile() {
  const { user, setUser, matchResults } = useAuth()
  const navigate = useNavigate()
  const [editing, setEditing] = useState(false)
  const [leavingTeam, setLeavingTeam] = useState(false)
  const [teamRoster, setTeamRoster] = useState({ captainName: '', members: [] })
  const dayOptions = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
  const timeOptions = ['06:00 AM', '07:00 AM', '08:00 AM', '10:00 AM', '12:00 PM', '02:00 PM', '04:00 PM', '06:00 PM', '08:00 PM']
  const [info, setInfo] = useState(
    user?.teamInfo || {
      name:'',
      location:'',
      skill:'Intermediate',
      preferredDay:'Saturday',
      preferredTime:'06:00 PM',
      lat: 27.7172,
      lng: 85.3240,
    }
  )
  const [toast, setToast] = useState('')
  const [locationVerified, setLocationVerified] = useState(false)
  const [showMap, setShowMap] = useState(false)
  const isFirstSetup = !user?.teamProfileCompleted
  const isCaptain = user?.isCaptain !== false

  const skillBaseElo = {
    Beginner: 1000,
    Intermediate: 1200,
    Advanced: 1400,
  }

  const myTeamName = info.name || user?.teamInfo?.name || user?.teamName || 'My Team'
  const captainName = teamRoster.captainName || user?.teamInfo?.captainName || user?.captainName || user?.name || 'Captain'
  const memberCount = Math.max(1, 1 + teamRoster.members.length)
  const formatUid = value => {
    const digits = String(value || '').replace(/\D/g, '')
    if (digits.length !== 8) return 'Pending'
    return digits
  }
  const teamUid = formatUid(user?.uid)

  useEffect(() => {
    let active = true

    const loadRoster = async () => {
      if (!teamUid || teamUid === 'Pending') {
        if (active) {
          setTeamRoster({ captainName: user?.name || '', members: [] })
        }
        return
      }

      try {
        const response = await fetch(`${API_BASE}/team-joins/team/${encodeURIComponent(teamUid)}`)
        const data = await response.json()

        if (!active || !response.ok || !Array.isArray(data)) return

        const approvedMembers = data
          .filter(request => request.status === 'approved')
          .map(request => ({
            name: request.requesterName,
            email: request.requesterEmail,
          }))

        const captain = data.find(request => request.captainName)?.captainName || user?.name || ''

        setTeamRoster({
          captainName: captain,
          members: approvedMembers,
        })
      } catch (_error) {
        if (active) {
          setTeamRoster({ captainName: user?.name || '', members: [] })
        }
      }
    }

    loadRoster()

    return () => {
      active = false
    }
  }, [teamUid, user?.name])

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
        myScore,
        opponentScore,
        sortValue: Number.isFinite(sortTimestamp) ? sortTimestamp : sortFallbackDate,
      }
    })
    .sort((left, right) => right.sortValue - left.sortValue)

  const wins   = teamMatchHistory.filter(m => m.result==='win').length
  const losses = teamMatchHistory.filter(m => m.result==='loss').length
  const draws  = teamMatchHistory.filter(m => m.result==='draw').length
  const total  = wins + losses + draws || 1
  const goalsFor = teamMatchHistory.reduce((sum, match) => sum + match.myScore, 0)
  const goalsAgainst = teamMatchHistory.reduce((sum, match) => sum + match.opponentScore, 0)
  const baseElo = info.baseElo ?? skillBaseElo[info.skill] ?? 1200
  const fallbackElo = baseElo + (wins * 25) + (draws * 10) - (losses * 20)
  const currentElo = user?.eloRating ?? info.currentElo ?? fallbackElo

  const handleLocationConfirm = (loc) => {
    setInfo({ ...info, location: loc.address, lat: loc.lat, lng: loc.lng })
    setLocationVerified(true)
    setToast('✅ Location set from map!')
    setTimeout(() => setToast(''), 3000)
  }

  const save = async () => {
    if (!isCaptain && !isFirstSetup) {
      setToast('Only the captain can edit team profile details.')
      setTimeout(() => setToast(''), 3000)
      return
    }

    if (!info.name.trim() || !info.location.trim()) {
      setToast('Please fill in team name and location.')
      setTimeout(() => setToast(''), 3000)
      return
    }

    if (isFirstSetup && !locationVerified) {
      setToast('Please pick your location on the map before continuing.')
      setTimeout(() => setToast(''), 3000)
      return
    }

    if (user?.id) {
      try {
        if (isFirstSetup) {
          const response = await fetch(`${API_BASE}/teams/${user.id}/complete-profile`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              teamName: info.name.trim(),
              location: info.location.trim(),
              lat: info.lat,
              lng: info.lng,
              skill: info.skill,
              preferredDay: info.preferredDay,
              preferredTime: info.preferredTime,
              locationVerified: true,
            }),
          })
          const data = await response.json()
          if (!response.ok) {
            setToast(data.message || 'Failed to complete team profile.')
            setTimeout(() => setToast(''), 3000)
            return
          }
          setUser({
            ...user,
            uid: data.team.uid || user?.uid || '',
            eloRating: data.team.eloRating,
            eloMatchesPlayed: data.team.eloMatchesPlayed || 0,
            teamProfileCompleted: data.team.teamProfileCompleted,
            teamInfo: {
              ...info,
              name: data.team.teamName || info.name.trim(),
              location: data.team.location || info.location.trim(),
              skill: data.team.skill || info.skill,
              preferredDay: data.team.preferredDay || info.preferredDay,
              preferredTime: data.team.preferredTime || info.preferredTime,
              lat: info.lat,
              lng: info.lng,
              baseElo,
              currentElo: data.team.eloRating ?? currentElo,
            },
          })
        } else {
          const response = await fetch(`${API_BASE}/teams/${user.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              teamName: info.name.trim(),
              location: info.location.trim(),
              lat: info.lat,
              lng: info.lng,
              preferredDay: info.preferredDay,
              preferredTime: info.preferredTime,
            }),
          })
          const data = await response.json()
          if (!response.ok) {
            setToast(data.message || 'Failed to update team info.')
            setTimeout(() => setToast(''), 3000)
            return
          }
          setUser({
            ...user,
            uid: data.team.uid || user?.uid || '',
            eloRating: data.team.eloRating,
            eloMatchesPlayed: data.team.eloMatchesPlayed || 0,
            teamProfileCompleted: data.team.teamProfileCompleted,
            teamInfo: {
              ...info,
              name: data.team.teamName || info.name.trim(),
              location: data.team.location || info.location.trim(),
              skill: data.team.skill || info.skill,
              preferredDay: data.team.preferredDay || info.preferredDay,
              preferredTime: data.team.preferredTime || info.preferredTime,
              lat: info.lat,
              lng: info.lng,
              baseElo,
              currentElo: data.team.eloRating ?? currentElo,
            },
          })
        }
      } catch (_error) {
        setToast('Unable to connect to server.')
        setTimeout(() => setToast(''), 3000)
        return
      }
    } else {
      const computedBaseElo = info.baseElo ?? skillBaseElo[info.skill] ?? 1200
      setUser({
        ...user,
        uid: user?.uid || '',
        teamProfileCompleted: true,
        teamInfo: {
          ...info,
          name: info.name.trim(),
          location: info.location.trim(),
          preferredDay: info.preferredDay,
          preferredTime: info.preferredTime,
          lat: info.lat,
          lng: info.lng,
          baseElo: computedBaseElo,
          currentElo,
        },
      })
    }

    setEditing(false)
    setToast(isFirstSetup ? '✅ Team profile completed!' : '✅ Team name updated!')
    if (isFirstSetup) setTimeout(() => navigate('/team'), 500)
    setTimeout(() => setToast(''), 3000)
  }

  const leaveTeam = async () => {
    if (!user?.email) return
    const confirmed = window.confirm('Are you sure you want to leave this team?')
    if (!confirmed) return

    setLeavingTeam(true)
    try {
      const response = await fetch(`${API_BASE}/team-joins/leave`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requesterEmail: user.email,
          teamId: user.id,
        }),
      })

      const data = await response.json()
      if (!response.ok) {
        setToast(data.message || 'Failed to leave team.')
        setTimeout(() => setToast(''), 3000)
        return
      }

      setUser({
        ...user,
        uid: '',
        teamAccess: 'basic',
        isCaptain: false,
        teamProfileCompleted: false,
        teamName: '',
        teamInfo: {
          name: '',
          teamName: '',
          location: '',
          skill: 'Intermediate',
          preferredDay: 'Saturday',
          preferredTime: '06:00 PM',
          lat: 27.7172,
          lng: 85.3240,
          currentElo: 1000,
        },
      })

      setToast('You left the team. Join another team using UID.')
      setTimeout(() => navigate('/team/join'), 500)
    } catch (_error) {
      setToast('Unable to leave team right now.')
      setTimeout(() => setToast(''), 3000)
    } finally {
      setLeavingTeam(false)
    }
  }

  const rColor = r => r==='win'?'#00b96b': r==='loss'?'#e53e3e':'#eab308'

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-area">
        <Topbar title="Profile" breadcrumb="Team / Profile" />
        <div className="page-inner">
          {toast && <div className="alert alert-success"><i className="fas fa-check-circle" />{toast}</div>}

          {/* Hero */}
          <div className="profile-hero anim-1">
            <div className="ph-avatar">🦅</div>
            <div style={{ flex:1 }}>
              <div className="ph-name">{info.name || 'Set your team name'}</div>
              <div className="ph-sub"><i className="fas fa-location-dot" style={{ marginRight:5 }} />{info.location || 'Set your location'}</div>
              <div className="ph-tags">
                <span className="ph-tag">{info.skill}</span>
                <span className="ph-tag">Elo {currentElo}</span>
                <span className="ph-tag">UID {teamUid}</span>
                <span className="ph-tag">{memberCount} Members</span>
                <span className="ph-tag">Est. 2023</span>
              </div>
            </div>
            {!isFirstSetup && isCaptain && (
              <div className="ph-actions">
                <button
                  className="btn btn-outline"
                  style={{ background:'rgba(255,255,255,.15)', border:'1.5px solid rgba(255,255,255,.4)', color:'#fff' }}
                  onClick={() => setEditing(e => !e)}
                >
                  <i className={`fas fa-${editing?'xmark':'pen'}`} />
                  {editing ? 'Cancel' : 'Edit'}
                </button>
              </div>
            )}
          </div>

          <div className="two-col anim-2">
            {/* Info / Edit */}
            <div className="card">
              <div className="card-hd">
                <h3>{isFirstSetup ? 'Complete Team Profile' : (isCaptain && editing) ? 'Edit Info' : 'Team Information'}</h3>
              </div>
              <div className="card-bd">
                {(isCaptain && (editing || isFirstSetup)) ? (
                  <>
                    <div className="form-group">
                      <label className="form-label">Team Name</label>
                      <input
                        className="form-control"
                        value={info.name}
                        onChange={e => setInfo({...info, name: e.target.value})}
                        placeholder="Enter your team name"
                      />
                    </div>

                    {isFirstSetup && (
                      <>
                        {/* Location with Map Picker */}
                        <div className="form-group">
                          <label className="form-label">Location</label>
                          <div style={{ display:'flex', gap:8 }}>
                            <input
                              className="form-control"
                              value={info.location}
                              placeholder="Click the map button to set location"
                              readOnly
                              style={{ background: locationVerified ? '#f0fdf4' : '#fff', cursor:'default' }}
                            />
                            <button
                              type="button"
                              className="btn btn-outline"
                              onClick={() => setShowMap(true)}
                              style={{ flexShrink:0, whiteSpace:'nowrap' }}
                            >
                              <i className="fas fa-map-marker-alt" /> Pick on Map
                            </button>
                          </div>
                          {locationVerified && (
                            <div style={{ fontSize:12, color:'var(--green)', marginTop:5, display:'flex', alignItems:'center', gap:5 }}>
                              <i className="fas fa-circle-check" /> Location verified from map
                            </div>
                          )}
                          {!locationVerified && (
                            <div style={{ fontSize:12, color:'#8a96a8', marginTop:5 }}>
                              <i className="fas fa-info-circle" style={{ marginRight:4 }} />
                              You must pick your location on the map to continue
                            </div>
                          )}
                        </div>

                        <div className="form-group">
                          <label className="form-label">Skill Level</label>
                          <select
                            className="form-control"
                            value={info.skill}
                            onChange={e => setInfo({...info, skill: e.target.value})}
                          >
                            <option>Beginner</option>
                            <option>Intermediate</option>
                            <option>Advanced</option>
                          </select>
                          <div style={{ fontSize:12, color:'#8a96a8', marginTop:6 }}>
                            Base Elo for selected skill: <strong>{skillBaseElo[info.skill] ?? 1200}</strong>
                          </div>
                        </div>

                        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                          <div className="form-group">
                            <label className="form-label">Preferred Day</label>
                            <select
                              className="form-control"
                              value={info.preferredDay || 'Saturday'}
                              onChange={e => setInfo({ ...info, preferredDay: e.target.value })}
                            >
                              {dayOptions.map(day => <option key={day}>{day}</option>)}
                            </select>
                          </div>

                          <div className="form-group">
                            <label className="form-label">Preferred Time</label>
                            <select
                              className="form-control"
                              value={info.preferredTime || '06:00 PM'}
                              onChange={e => setInfo({ ...info, preferredTime: e.target.value })}
                            >
                              {timeOptions.map(time => <option key={time}>{time}</option>)}
                            </select>
                          </div>
                        </div>
                      </>
                    )}

                    {!isFirstSetup && (
                      <>
                        <div className="form-group">
                          <label className="form-label">Location</label>
                          <div style={{ display:'flex', gap:8 }}>
                            <input
                              className="form-control"
                              value={info.location}
                              onChange={e => setInfo({ ...info, location: e.target.value })}
                              placeholder="Update your team location"
                            />
                            <button
                              type="button"
                              className="btn btn-outline"
                              onClick={() => setShowMap(true)}
                              style={{ flexShrink:0, whiteSpace:'nowrap' }}
                            >
                              <i className="fas fa-map-marker-alt" /> Pick on Map
                            </button>
                          </div>
                        </div>

                        <div style={{ fontSize:12, color:'#8a96a8', marginBottom:12 }}>
                          Skill is locked after setup. Team name and location can be updated.
                        </div>

                        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                          <div className="form-group">
                            <label className="form-label">Preferred Day</label>
                            <select
                              className="form-control"
                              value={info.preferredDay || 'Saturday'}
                              onChange={e => setInfo({ ...info, preferredDay: e.target.value })}
                            >
                              {dayOptions.map(day => <option key={day}>{day}</option>)}
                            </select>
                          </div>

                          <div className="form-group">
                            <label className="form-label">Preferred Time</label>
                            <select
                              className="form-control"
                              value={info.preferredTime || '06:00 PM'}
                              onChange={e => setInfo({ ...info, preferredTime: e.target.value })}
                            >
                              {timeOptions.map(time => <option key={time}>{time}</option>)}
                            </select>
                          </div>
                        </div>
                      </>
                    )}

                    <button
                      className="btn btn-primary btn-full"
                      onClick={save}
                      disabled={isFirstSetup && !locationVerified}
                    >
                      <i className="fas fa-floppy-disk" />
                      {isFirstSetup ? 'Save & Continue' : 'Save Changes'}
                    </button>
                  </>
                ) : (
                  <>
                    {[
                      { lbl:'Team Name', val: info.name,      icon:'fa-users' },
                      { lbl:'Location',  val: info.location,  icon:'fa-location-dot' },
                      { lbl:'Skill',     val: info.skill,     icon:'fa-signal' },
                      { lbl:'Preferred Day',  val: info.preferredDay || 'Saturday', icon:'fa-calendar-day' },
                      { lbl:'Preferred Time', val: info.preferredTime || '06:00 PM', icon:'fa-clock' },
                      { lbl:'Captain',   val: captainName,                 icon:'fa-user-tie' },
                      { lbl:'Members',   val: `${memberCount} players`,   icon:'fa-person-running' },
                    ].map(item => (
                      <div key={item.lbl} style={{ display:'flex', justifyContent:'space-between', padding:'10px 0', borderBottom:'1px solid #f0f4f8' }}>
                        <span style={{ fontSize:12, color:'#8a96a8', display:'flex', alignItems:'center', gap:7, fontWeight:700, textTransform:'uppercase', letterSpacing:.3 }}>
                          <i className={`fas ${item.icon}`} style={{ width:14, color:'var(--green)' }} />{item.lbl}
                        </span>
                        <span style={{ fontSize:13, fontWeight:700 }}>{item.val}</span>
                      </div>
                    ))}

                    {!isCaptain && !isFirstSetup && (
                      <div style={{ marginTop:14 }}>
                        <button
                          type="button"
                          className="btn btn-outline btn-full"
                          style={{ borderColor:'#e53e3e', color:'#e53e3e' }}
                          onClick={leaveTeam}
                          disabled={leavingTeam}
                        >
                          <i className="fas fa-right-from-bracket" />
                          {leavingTeam ? 'Leaving Team…' : 'Leave Team'}
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Stats */}
            <div className="card">
              <div className="card-hd"><h3>Season Stats</h3></div>
              <div className="card-bd">
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10, marginBottom:20 }}>
                  {[
                    { lbl:'Wins',   v:wins,   bg:'#e6faf2', c:'#00b96b' },
                    { lbl:'Draws',  v:draws,  bg:'#fefce8', c:'#ca8a04' },
                    { lbl:'Losses', v:losses, bg:'#fff5f5', c:'#e53e3e' },
                  ].map(s => (
                    <div key={s.lbl} style={{ textAlign:'center', padding:'14px 8px', background:s.bg, borderRadius:12 }}>
                      <div style={{ fontFamily:'Barlow Condensed,sans-serif', fontSize:28, fontWeight:900, color:s.c, lineHeight:1 }}>{s.v}</div>
                      <div style={{ fontSize:11, fontWeight:800, color:s.c, marginTop:4, textTransform:'uppercase' }}>{s.lbl}</div>
                    </div>
                  ))}
                </div>

                <div className="health-row">
                  <div className="health-lbl">
                    <span>Win Rate</span>
                    <span style={{ color:'var(--green)' }}>{Math.round((wins/total)*100)}%</span>
                  </div>
                  <div className="health-track">
                    <div className="health-fill hf-green" style={{ width:`${Math.round((wins/total)*100)}%` }} />
                  </div>
                </div>

                <div style={{ marginTop:16, padding:14, background:'#f8fafc', borderRadius:10, textAlign:'center' }}>
                  <div style={{ fontSize:12, color:'#8a96a8', marginBottom:4, fontWeight:700, textTransform:'uppercase' }}>Goals For / Against</div>
                  <div style={{ fontFamily:'Barlow Condensed,sans-serif', fontSize:24, fontWeight:900 }}>
                    <span style={{ color:'var(--green)' }}>{goalsFor}</span>
                    <span style={{ color:'#e4e8ee', margin:'0 8px' }}>/</span>
                    <span style={{ color:'var(--red)' }}>{goalsAgainst}</span>
                  </div>
                </div>

                <div style={{ marginTop:12, padding:14, background:'#eef8ff', borderRadius:10, textAlign:'center' }}>
                  <div style={{ fontSize:12, color:'#4b5f7a', marginBottom:4, fontWeight:700, textTransform:'uppercase' }}>Elo Rating</div>
                  <div style={{ fontFamily:'Barlow Condensed,sans-serif', fontSize:30, fontWeight:900, color:'#1e5eff', lineHeight:1 }}>{currentElo}</div>
                  <div style={{ fontSize:12, color:'#5f6f87', marginTop:6 }}>
                    Base {baseElo} + {wins}W / {draws}D / {losses}L
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Match History */}
          <div className="card anim-3" style={{ marginTop:22 }}>
            <div className="card-hd"><h3>Match History</h3></div>
            <div className="card-bd" style={{ paddingTop:8 }}>
              {teamMatchHistory.length === 0 ? (
                <div className="empty-state" style={{ padding:'26px 18px' }}>
                  <i className="fas fa-futbol" />
                  <h3>No match history yet</h3>
                  <p>Finished matches will appear here once scores are submitted.</p>
                </div>
              ) : teamMatchHistory.map(m => (
                <div key={m.id} className="match-row">
                  <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                    <div style={{ width:36, height:36, borderRadius:10, background: m.result==='win'?'#e6faf2': m.result==='loss'?'#fff5f5':'#fefce8', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16 }}>
                      {m.result==='win'?'🏆': m.result==='loss'?'💔':'🤝'}
                    </div>
                    <div>
                      <div className="match-teams">
                        <span style={{ color:'var(--green)' }}>{myTeamName}</span>
                        <span className="vs">vs</span>
                        <span>{m.opponent}</span>
                      </div>
                      <div style={{ fontSize:11, color:'#8a96a8' }}>{m.venue}</div>
                    </div>
                  </div>
                  <div style={{ textAlign:'right' }}>
                    <div className="match-score" style={{ color: rColor(m.result) }}>{m.score}</div>
                    <div className="match-date">{m.date}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>

      {/* Map Modal */}
      {showMap && (
        <Suspense fallback={<div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:500, color:'#fff', fontSize:16 }}><i className="fas fa-circle-notch fa-spin" style={{ marginRight:10 }} />Loading map...</div>}>
          <LocationPicker
            initialLat={info.lat || 27.7172}
            initialLng={info.lng || 85.3240}
            onConfirm={handleLocationConfirm}
            onClose={() => setShowMap(false)}
          />
        </Suspense>
      )}

    </div>
  )
}