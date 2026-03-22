import React, { useMemo, useState } from 'react'
import Sidebar from '../../components/Sidebar.jsx'
import Topbar  from '../../components/Topbar.jsx'
import { teams } from '../../data/mockData.js'

/* Seed open match posts visible to everyone */
const SEED_POSTS = [
  { id:1, team:'Thunder Strikers', emoji:'⚡', elo:1850, location:'Baneshwor', date:'2025-03-18', time:'06:00 PM', venue:'Arena Futsal Park', players:10, note:'Looking for a tough opponent!', color:'blue', requestedBy: null },
  { id:2, team:'Night Owls', emoji:'🦉', elo:1620, location:'Bhaktapur', date:'2025-03-19', time:'08:00 AM', venue:'Champions Court', players:9, note:'Friendly match, any skill welcome.', color:'teal', requestedBy: null },
  { id:3, team:'Blue Phoenix', emoji:'🔥', elo:1450, location:'Patan', date:'2025-03-21', time:'10:00 AM', venue:'Patan Sports Hub', players:7, note:'New team, looking to grow! 😅', color:'purple', requestedBy: null },
]

const MY_TEAM = {
  name:'My Team',
  elo:1600,
  location:'Lazimpat',
  defaultDay:'Saturday',
  defaultTime:'06:00 PM',
  preferredVenue:'Arena Futsal Park',
  winRate:0.58,
}
const SKILL_TO_ELO = { Beginner:1400, Intermediate:1600, Advanced:1800 }
const LOCATION_DISTANCE_KM = {
  Lazimpat: 0,
  Baneshwor: 2,
  Thamel: 2,
  Koteshwor: 5,
  Patan: 4,
  Bhaktapur: 12,
}
const TEAM_AVAILABILITY = {
  'Thunder Strikers': { day:'Saturday', slots:['06:00 PM', '08:00 PM'], venues:['Arena Futsal Park', 'Goal Zone Futsal'] },
  'Green Eagles': { day:'Sunday', slots:['07:00 AM', '09:00 AM'], venues:['Champions Court', 'Arena Futsal Park'] },
  'Red Wolves': { day:'Saturday', slots:['06:00 PM', '07:00 PM'], venues:['Goal Zone Futsal', 'Champions Court'] },
  'Blue Phoenix': { day:'Friday', slots:['10:00 AM', '04:00 PM'], venues:['Patan Sports Hub'] },
  'Night Owls': { day:'Saturday', slots:['08:00 AM', '06:00 PM'], venues:['Champions Court', 'Patan Sports Hub'] },
  'Storm United': { day:'Sunday', slots:['06:00 AM', '08:00 AM'], venues:['Champions Court'] },
}

const toDayLabel = (dateValue) => {
  if (!dateValue) return MY_TEAM.defaultDay
  const date = new Date(dateValue)
  if (Number.isNaN(date.getTime())) return MY_TEAM.defaultDay
  return date.toLocaleDateString('en-US', { weekday:'long' })
}

const parseTimeToMinutes = (timeValue) => {
  if (!timeValue) return null
  const is12Hour = /AM|PM/i.test(timeValue)

  if (is12Hour) {
    const [timePart, meridiemRaw] = timeValue.trim().split(' ')
    if (!timePart || !meridiemRaw) return null
    const [hRaw, mRaw] = timePart.split(':')
    const meridiem = meridiemRaw.toUpperCase()
    let hour = Number(hRaw)
    const minute = Number(mRaw)
    if (Number.isNaN(hour) || Number.isNaN(minute)) return null
    if (meridiem === 'PM' && hour !== 12) hour += 12
    if (meridiem === 'AM' && hour === 12) hour = 0
    return (hour * 60) + minute
  }

  const [hRaw, mRaw] = timeValue.split(':')
  const hour = Number(hRaw)
  const minute = Number(mRaw)
  if (Number.isNaN(hour) || Number.isNaN(minute)) return null
  return (hour * 60) + minute
}

const getClosestSlotGapHours = (slots, targetMinutes) => {
  if (!Array.isArray(slots) || slots.length === 0 || targetMinutes === null) return 2
  const slotMinutes = slots
    .map(parseTimeToMinutes)
    .filter(v => v !== null)
  if (slotMinutes.length === 0) return 2
  const minGapMinutes = Math.min(...slotMinutes.map(v => Math.abs(v - targetMinutes)))
  return minGapMinutes / 60
}

export default function FindMatch() {
  const [posts,     setPosts]     = useState(SEED_POSTS)
  const [toast,     setToast]     = useState({ msg:'', type:'success' })
  const [postModal, setPostModal] = useState(false)
  const [reqModal,  setReqModal]  = useState(null)
  const [form, setForm] = useState({ date:'', time:'', venue:'Arena Futsal Park', note:'', visibility:'24' })

  const getTeamElo = (team) => team.elo ?? SKILL_TO_ELO[team.skill] ?? 1600
  const getDistanceKm = (location) => LOCATION_DISTANCE_KM[location] ?? 8

  const latestMyPost = useMemo(
    () => posts.find(p => p.team === MY_TEAM.name) || null,
    [posts]
  )

  const preferredContext = useMemo(() => {
    const day = toDayLabel(latestMyPost?.date)
    const time = latestMyPost?.time || MY_TEAM.defaultTime
    const venue = latestMyPost?.venue || MY_TEAM.preferredVenue
    return { day, time, venue }
  }, [latestMyPost])

  const scoreCandidate = (candidate) => {
    const elo = candidate.elo ?? getTeamElo(candidate)
    const distanceKm = getDistanceKm(candidate.location)
    const availability = TEAM_AVAILABILITY[candidate.name] || { day:'Sunday', slots:['07:00 PM'], venues:[candidate.venue || 'Arena Futsal Park'] }
    const eloDiff = Math.abs(elo - MY_TEAM.elo)
    const sameDay = availability.day === preferredContext.day
    const targetMinutes = parseTimeToMinutes(preferredContext.time)
    const slotGapHours = getClosestSlotGapHours(availability.slots, targetMinutes)
    const venueOverlap = (availability.venues || []).includes(preferredContext.venue)
    const teamWinRate = typeof candidate.wins === 'number' && typeof candidate.losses === 'number'
      ? candidate.wins / Math.max(1, (candidate.wins + candidate.losses))
      : 0.5
    const formGap = Math.abs(teamWinRate - MY_TEAM.winRate)
    const rawScore = 100
      - (eloDiff * 0.18)
      - (distanceKm * 4)
      - (slotGapHours * 6)
      - (formGap * 22)
      + (sameDay ? 14 : 0)
      + (venueOverlap ? 12 : 0)
    const score = Math.round(Math.max(0, Math.min(100, rawScore)))
    const tier = score >= 80 ? 'Excellent Fit' : score >= 65 ? 'Strong Fit' : score >= 50 ? 'Possible Fit' : 'Low Fit'
    const tierType = score >= 80 ? 'success' : score >= 65 ? 'info' : score >= 50 ? 'warning' : 'muted'
    const reasons = [
      `Close ELO (${elo}, diff ${eloDiff})`,
      `${distanceKm}km away`,
      sameDay ? `Both free ${preferredContext.day}` : `Free ${availability.day}`,
      slotGapHours <= 1 ? `Time overlap near ${preferredContext.time}` : `Closest slot ${availability.slots[0]}`,
      venueOverlap ? `Venue overlap at ${preferredContext.venue}` : `Can host at ${availability.venues[0]}`,
    ]
    return { ...candidate, elo, score, tier, tierType, reasons }
  }

  const recommendationData = useMemo(() => {
    const scored = teams
      .filter(t => t.name !== MY_TEAM.name)
      .map(scoreCandidate)
      .sort((a, b) => b.score - a.score)

    return {
      recommended: scored.slice(0, 5),
      others: scored.slice(5),
      hasFallback: scored.length < 5,
      context: preferredContext,
    }
  }, [preferredContext])

  const reqModalFit = useMemo(() => {
    if (!reqModal) return null
    return scoreCandidate({
      id: reqModal.id,
      name: reqModal.team,
      location: reqModal.location,
      venue: reqModal.venue,
      wins: 10,
      losses: 8,
      elo: reqModal.elo,
      color: reqModal.color,
      emoji: reqModal.emoji,
      players: reqModal.players,
    })
  }, [reqModal, preferredContext])

  const toast$ = (msg, type='success') => { setToast({ msg, type }); setTimeout(() => setToast({ msg:'', type:'success' }), 3500) }

  const submitPost = () => {
    if (!form.date || !form.time) return
    const newPost = {
      id: posts.length + Date.now(),
      team: 'My Team', emoji: '🦅', elo: 1600,
      location: 'Lazimpat', date: form.date, time: form.time,
      venue: form.venue, players: 8, note: form.note || 'Open for any match!',
      color: 'green', requestedBy: null, visibility: form.visibility,
    }
    setPosts(prev => [newPost, ...prev])
    setPostModal(false)
    setForm({ date:'', time:'', venue:'Arena Futsal Park', note:'', visibility:'24' })
    toast$('📣 Your match post is live! Teams can now request you.')
  }

  const validateCompatibility = (opponent) => {
    const opponentElo = opponent.elo
    const eloDiff = Math.abs((opponentElo || MY_TEAM.elo) - MY_TEAM.elo)
    if (eloDiff > 320) {
      return { allow:false, message:`⛔ Request blocked: ELO gap is ${eloDiff}. Please use manual match request.` }
    }

    const distanceKm = getDistanceKm(opponent.location)
    if (distanceKm > 15) {
      return { allow:true, message:`⚠️ Request sent with caution: ${distanceKm}km distance might reduce acceptance.` }
    }

    const preferredMinutes = parseTimeToMinutes(preferredContext.time)
    const opponentMinutes = parseTimeToMinutes(opponent.time)
    const timeGap = preferredMinutes !== null && opponentMinutes !== null
      ? Math.abs(preferredMinutes - opponentMinutes) / 60
      : 0

    if (timeGap > 3) {
      return { allow:true, message:`⚠️ Request sent with warning: time gap is ${timeGap.toFixed(1)} hours.` }
    }

    if (eloDiff > 200) {
      return { allow:true, message:`⚠️ Request sent with warning: ELO gap is ${eloDiff}.` }
    }
    return { allow:true, message:null }
  }

  const acceptRequest = (postId) => {
    setPosts(prev => prev.map(p => p.id===postId ? {...p, requestedBy: null, accepted: true} : p))
    toast$('✅ Match accepted! Check match details in your board.')
  }

  const sendRequest = (post) => {
    const validation = validateCompatibility(post)
    if (!validation.allow) {
      setReqModal(null)
      toast$(validation.message, 'info')
      return
    }

    setPosts(prev => prev.map(p => p.id===post.id ? {...p, requestedBy:'My Team'} : p))
    setReqModal(null)
    toast$(validation.message || `⚡ Join request sent to ${post.team}!`, validation.message ? 'info' : 'success')
  }

  const deletePost = (id) => {
    setPosts(prev => prev.filter(p => p.id!==id))
    toast$('Post removed.', 'info')
  }

  const hitTeam = team => toast$(`Send a manual match request to ${team.name}.`, 'info')

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-area">
        <Topbar title="Find Match" breadcrumb="Team / Find Match" />
        <div className="page-inner">

          {toast.msg && (
            <div className={`alert alert-${toast.type==='info' ? 'info' : 'success'}`}>
              <i className={`fas fa-${toast.type==='info' ? 'circle-info' : 'check-circle'}`} />
              {toast.msg}
            </div>
          )}

          <div className="sec-hd anim-1">
            <div>
              <h2>Find a Match</h2>
              <p>Algorithm-first matching with practical fallback when data is limited</p>
            </div>
            <button className="btn btn-primary" onClick={() => setPostModal(true)}>
              <i className="fas fa-bullhorn" /> Post Your Team
            </button>
          </div>

          <div className="card anim-2" style={{ marginBottom:20, border:'1px solid var(--border)' }}>
            <div style={{ padding:'14px 16px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'space-between', gap:8, flexWrap:'wrap' }}>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <i className="fas fa-wand-magic-sparkles" style={{ color:'var(--blue)' }} />
                <strong style={{ fontSize:14 }}>Recommended For You</strong>
              </div>
              <span className="badge badge-info">Top {recommendationData.recommended.length} Algorithm Matches</span>
            </div>
            <div style={{ padding:'10px 16px', background:'var(--bg)', borderBottom:'1px solid var(--border)', fontSize:12, color:'var(--txt-3)' }}>
              Tuned for {recommendationData.context.day}, {recommendationData.context.time} at {recommendationData.context.venue}
            </div>
            <div style={{ padding:'14px 16px' }}>
              {recommendationData.recommended.length === 0 ? (
                <div className="empty-state" style={{ margin:0 }}>
                  <i className="fas fa-robot" />
                  <h3>No recommendations yet</h3>
                  <p>As more team activity data arrives, this section will auto-populate.</p>
                </div>
              ) : (
                <div className="team-grid">
                  {recommendationData.recommended.map((team, i) => (
                    <div key={team.id} className={`team-card anim-${Math.min(i+1,5)}`}>
                      <div className={`tc-header ${team.color}`}>
                        <div className="tc-emoji">{team.emoji}</div>
                        <h3>{team.name}</h3>
                        <p><i className="fas fa-location-dot" /> {team.location}</p>
                        <span className="tc-skill-badge">ELO {team.elo}</span>
                      </div>
                      <div className="tc-body">
                        <div className="tc-meta">
                          <div className="tc-meta-item"><i className="fas fa-users" />{team.players} players</div>
                          <div className="tc-meta-item"><i className="fas fa-trophy" />{team.wins}W / {team.losses}L</div>
                          <div className="tc-meta-item"><i className="fas fa-chart-line" />{team.score}% fit</div>
                        </div>
                        <div style={{ marginBottom:10 }}>
                          <span className={`badge badge-${team.tierType}`}>{team.tier}</span>
                        </div>
                        <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:14 }}>
                          {team.reasons.slice(0, 3).map(reason => (
                            <span key={reason} className="badge badge-muted">{reason}</span>
                          ))}
                        </div>
                        <button className="btn btn-outline btn-full" onClick={() => hitTeam(team)}>
                          <i className="fas fa-flag-checkered" /> Request Match
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {recommendationData.hasFallback && recommendationData.others.length > 0 && (
            <div className="card anim-3" style={{ marginBottom:20, border:'1px dashed var(--border)' }}>
              <div style={{ padding:'14px 16px', borderBottom:'1px solid var(--border)' }}>
                <strong style={{ fontSize:14 }}>Not Enough Data Yet</strong>
                <p style={{ margin:'6px 0 0', fontSize:13, color:'var(--txt-3)' }}>
                  Showing additional nearby teams while recommendation quality improves.
                </p>
              </div>
              <div style={{ padding:'14px 16px' }}>
                <div className="team-grid">
                {recommendationData.others.map((team, i) => (
                  <div key={team.id} className={`team-card anim-${Math.min(i+1,5)}`}>
                    <div className={`tc-header ${team.color}`}>
                      <div className="tc-emoji">{team.emoji}</div>
                      <h3>{team.name}</h3>
                      <p><i className="fas fa-location-dot" /> {team.location}</p>
                      <span className="tc-skill-badge">ELO {team.elo}</span>
                    </div>
                    <div className="tc-body">
                      <div className="tc-meta">
                        <div className="tc-meta-item"><i className="fas fa-users" />{team.players} players</div>
                        <div className="tc-meta-item"><i className="fas fa-trophy" />{team.wins}W / {team.losses}L</div>
                        <div className="tc-meta-item"><i className="fas fa-chart-line" />{team.score}% fit</div>
                      </div>
                      <div style={{ marginBottom:10 }}>
                        <span className={`badge badge-${team.tierType}`}>{team.tier}</span>
                      </div>
                      <button className="btn btn-outline btn-full" onClick={() => hitTeam(team)}>
                        <i className="fas fa-flag-checkered" /> Request Match
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              </div>
            </div>
          )}

          {/* ── MATCH BOARD ── */}
          {posts.length === 0 ? (
            <div className="empty-state">
              <i className="fas fa-clipboard-list" />
              <h3>No open matches</h3>
              <p>Be the first - post your team above!</p>
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
              {posts.map((post, i) => {
                const isMine = post.team === 'My Team'
                const hasRequest = !!post.requestedBy
                return (
                  <div key={post.id} className={`card anim-${Math.min(i+1,5)}`} style={{ overflow:'visible' }}>
                    <div style={{ display:'flex', gap:0, flexWrap:'wrap' }}>
                      <div style={{ width:6, background: isMine ? 'var(--green)' : 'var(--blue)', flexShrink:0, borderRadius:'var(--radius) 0 0 var(--radius)' }} />
                      <div style={{ flex:1, padding:'18px 20px', display:'flex', gap:16, flexWrap:'wrap', alignItems:'flex-start' }}>
                        <div style={{ width:52, height:52, borderRadius:14, background: isMine ? 'var(--green-light)' : 'var(--blue-light)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:26, flexShrink:0 }}>
                          {post.emoji}
                        </div>

                        <div style={{ flex:1, minWidth:180 }}>
                          <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap', marginBottom:6 }}>
                            <span style={{ fontFamily:'Barlow Condensed,sans-serif', fontSize:17, fontWeight:900 }}>{post.team}</span>
                            {isMine && <span className="badge badge-success">Your Post</span>}
                            <span className="badge badge-muted">ELO: {post.elo}</span>
                            {post.accepted && <span className="badge badge-info">Match Confirmed ✅</span>}
                            {hasRequest && !isMine && <span className="badge badge-warning">You Requested</span>}
                            {hasRequest &&  isMine && <span className="badge badge-warning">⚡ Request Pending</span>}
                          </div>

                          <div style={{ display:'flex', flexWrap:'wrap', gap:16, fontSize:13, color:'#4a5568', marginBottom:8 }}>
                            <span><i className="fas fa-location-dot" style={{ color:'var(--green)', marginRight:4 }} />{post.location}</span>
                            <span><i className="fas fa-building" style={{ color:'var(--blue)', marginRight:4 }} />{post.venue}</span>
                            <span><i className="fas fa-calendar" style={{ color:'var(--orange)', marginRight:4 }} />{post.date}</span>
                            <span><i className="fas fa-clock" style={{ color:'var(--purple)', marginRight:4 }} />{post.time}</span>
                            <span><i className="fas fa-users" style={{ color:'var(--txt-3)', marginRight:4 }} />{post.players} players</span>
                          </div>

                          {post.note && (
                            <div style={{ fontSize:13, color:'#4a5568', fontStyle:'italic', background:'#f8fafc', padding:'8px 12px', borderRadius:8, borderLeft:'3px solid var(--border)' }}>
                              "{post.note}"
                            </div>
                          )}

                          {isMine && hasRequest && !post.accepted && (
                            <div style={{ marginTop:10, padding:'10px 14px', background:'#fefce8', border:'1px solid #fde68a', borderRadius:8, display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:8 }}>
                              <span style={{ fontSize:13, fontWeight:700, color:'#92400e' }}>
                                <i className="fas fa-bell" style={{ marginRight:6 }} />
                                <strong>{post.requestedBy}</strong> wants to match with you!
                              </span>
                              <div style={{ display:'flex', gap:8 }}>
                                <button className="btn btn-primary btn-sm" onClick={() => acceptRequest(post.id)}>
                                  <i className="fas fa-check" /> Accept
                                </button>
                                <button className="btn btn-outline btn-sm" onClick={() => setPosts(prev => prev.map(p => p.id===post.id ? {...p,requestedBy:null} : p))}>
                                  Decline
                                </button>
                              </div>
                            </div>
                          )}
                        </div>

                        <div style={{ display:'flex', flexDirection:'column', gap:8, alignItems:'flex-end', flexShrink:0 }}>
                          {isMine ? (
                            <button className="btn btn-outline btn-sm" onClick={() => deletePost(post.id)}>
                              <i className="fas fa-trash" /> Remove
                            </button>
                          ) : post.accepted ? (
                            <span className="badge badge-success" style={{ padding:'6px 12px' }}>Filled</span>
                          ) : hasRequest ? (
                            <span className="badge badge-warning" style={{ padding:'6px 12px' }}>Requested</span>
                          ) : (
                            <button className="btn btn-primary btn-sm" onClick={() => setReqModal(post)}>
                              <i className="fas fa-bolt" /> Request Match
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

        </div>
      </div>

      {/* ── POST YOUR TEAM MODAL ── */}
      {postModal && (
        <div className="modal-overlay" onClick={() => setPostModal(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth:500 }}>
            <div className="modal-hd">
              <h3><i className="fas fa-bullhorn" style={{ color:'var(--green)', marginRight:8 }} />Post Your Team</h3>
              <button className="modal-close" onClick={() => setPostModal(false)}><i className="fas fa-xmark" /></button>
            </div>
            <p style={{ fontSize:13, color:'#8a96a8', marginBottom:18 }}>
              Your post will appear on the Match Board. Other teams can request to play against you.
            </p>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
              <div className="form-group">
                <label className="form-label">Preferred Date</label>
                <input type="date" className="form-control" value={form.date} onChange={e => setForm({...form,date:e.target.value})} />
              </div>
              <div className="form-group">
                <label className="form-label">Preferred Time</label>
                <input type="time" className="form-control" value={form.time} onChange={e => setForm({...form,time:e.target.value})} />
              </div>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
              <div className="form-group">
                <label className="form-label">Request Visibility</label>
                <select className="form-control" value={form.visibility} onChange={e => setForm({...form,visibility:e.target.value})}>
                  <option value="6">6 Hours</option>
                  <option value="12">12 Hours</option>
                  <option value="24">24 Hours</option>
                  <option value="48">48 Hours</option>
                  <option value="72">72 Hours</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Preferred Venue</label>
                <select className="form-control" value={form.venue} onChange={e => setForm({...form,venue:e.target.value})}>
                  <option>Arena Futsal Park</option>
                  <option>Champions Court</option>
                  <option>Goal Zone Futsal</option>
                  <option>Patan Sports Hub</option>
                </select>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Message (optional)</label>
              <input type="text" className="form-control" placeholder="e.g. Friendly match, any skill welcome!"
                value={form.note} onChange={e => setForm({...form,note:e.target.value})} />
            </div>
            <div style={{ display:'flex', gap:10, marginTop:8 }}>
              <button className="btn btn-primary" style={{ flex:1 }} onClick={submitPost} disabled={!form.date || !form.time}>
                <i className="fas fa-bullhorn" /> Post Match
              </button>
              <button className="btn btn-outline" onClick={() => setPostModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── REQUEST MATCH MODAL ── */}
      {reqModal && (
        <div className="modal-overlay" onClick={() => setReqModal(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="modal-hd">
              <h3><i className="fas fa-bolt" style={{ color:'var(--orange)', marginRight:8 }} />Request Match</h3>
              <button className="modal-close" onClick={() => setReqModal(null)}><i className="fas fa-xmark" /></button>
            </div>
            <div style={{ background:'#f8fafc', borderRadius:10, padding:'14px 16px', marginBottom:20 }}>
              <div style={{ fontFamily:'Barlow Condensed,sans-serif', fontSize:18, fontWeight:900, marginBottom:6 }}>
                {reqModal.emoji} {reqModal.team}
              </div>
              {reqModalFit && (
                <div style={{ marginBottom:8, display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                  <span className={`badge badge-${reqModalFit.tierType}`}>{reqModalFit.score}% fit</span>
                  <span className="badge badge-muted">{reqModalFit.tier}</span>
                </div>
              )}
              {[
                { icon:'fa-calendar', val: reqModal.date },
                { icon:'fa-clock',    val: reqModal.time },
                { icon:'fa-building', val: reqModal.venue },
                { icon:'fa-star',   val: `ELO: ${reqModal.elo}` },
              ].map(r => (
                <div key={r.icon} style={{ fontSize:13, color:'#4a5568', marginTop:4, display:'flex', alignItems:'center', gap:8 }}>
                  <i className={`fas ${r.icon}`} style={{ color:'var(--green)', width:14 }} /> {r.val}
                </div>
              ))}
              {reqModal.note && (
                <div style={{ fontSize:13, color:'#4a5568', fontStyle:'italic', marginTop:8 }}>"{reqModal.note}"</div>
              )}
            </div>
            <p style={{ fontSize:13, color:'#4a5568', marginBottom:18 }}>
              Sending a request will notify <strong>{reqModal.team}</strong>. ELO compatibility will be validated before it goes through.
            </p>
            <div style={{ display:'flex', gap:10 }}>
              <button className="btn btn-primary" style={{ flex:1 }} onClick={() => sendRequest(reqModal)}>
                <i className="fas fa-paper-plane" /> Send Request
              </button>
              <button className="btn btn-outline" onClick={() => setReqModal(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}