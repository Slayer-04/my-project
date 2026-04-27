import React, { useState } from 'react'
import Sidebar from '../../components/Sidebar.jsx'
import Topbar  from '../../components/Topbar.jsx'
import { teams } from '../../data/mockData.js'
import { useAuth } from '../../App.jsx'
import { selectOptimalMatchLocation } from '../../utils/venueSelector.js'

export default function Challenges() {
  const { user, challenges, setChallenges, setNotifications, bookings, setBookings } = useAuth()
  const [modal,  setModal]  = useState(false)
  const [tab,    setTab]    = useState('all')
  const [toast,  setToast]  = useState('')
  const [detail, setDetail] = useState(null)
  const [form,   setForm]   = useState({ team:'', date:'', time:'', venue:'Arena Futsal Park', note:'' })
  const myTeamName = user?.teamInfo?.name || user?.teamInfo?.teamName || user?.teamName || 'My Team'
  const list = challenges

  const toast$ = msg => { setToast(msg); setTimeout(() => setToast(''), 3000) }

  const send = () => {
    if (!form.team || !form.date || !form.time) return
    const challengeId = Date.now()
    setChallenges(prev => [{
      id: challengeId,
      from: myTeamName, to: form.team,
      date: form.date, time: form.time,
      venue: form.venue, note: form.note,
      status: 'pending',
    }, ...prev])
    setNotifications(prev => [{
      id: Date.now(),
      challengeId,
      type: 'challenge-request',
      text: `${myTeamName} challenged your team!`,
      time: 'just now',
      unread: true,
      team: form.team,
      createdAt: new Date().toISOString(),
    }, ...prev])
    setModal(false)
    setForm({ team:'', date:'', time:'', venue:'Arena Futsal Park', note:'' })
    toast$(`🏆 Challenge sent to ${form.team}!`)
  }

  const accept  = id => { 
    const challenge = list.find(c => c.id === id)
    if (!challenge) return
    
    const useExactSchedule = Boolean(challenge.exactSchedule)
    const location = useExactSchedule
      ? { venue: challenge.venue, time: challenge.time }
      : selectOptimalMatchLocation(
          challenge.from,
          challenge.to,
          challenge.date || new Date().toISOString().split('T')[0],
          challenge.time,
          bookings
        )
    
    // Auto-selected booking date
    const bookingDate = challenge.date || new Date().toISOString().split('T')[0]
    
    // Update challenge status with venue and time
    setChallenges(l => l.map(c => c.id===id ? {...c, status:'accepted', venue: location.venue, time: location.time}  : c))
    
    // Add bookings for BOTH teams so they both see it in upcoming bookings
    const baseBookingId = Date.now()
    setBookings(prev => [
      ...prev,
      {
        id: baseBookingId,
        team: myTeamName,
        venue: location.venue,
        date: bookingDate,
        time: location.time,
        status: 'confirmed',
        players: 11,
        amount: 'Rs. 1,200',
        challengeId: challenge.id,
        opponent: challenge.from,
      },
      {
        id: baseBookingId + 1,
        team: challenge.from,
        venue: location.venue,
        date: bookingDate,
        time: location.time,
        status: 'confirmed',
        players: 11,
        amount: 'Rs. 1,200',
        challengeId: challenge.id,
        opponent: myTeamName,
      }
    ])
    
    setDetail(null)
    toast$(useExactSchedule
      ? `✅ Challenge accepted with exact schedule: ${location.venue} at ${location.time}`
      : `✅ Challenge accepted! Match at ${location.venue} at ${location.time}`)
  }
  const decline = id => { setChallenges(l => l.map(c => c.id===id ? {...c,status:'declined'}  : c)); setDetail(null) }
  const cancel  = id => { setChallenges(l => l.map(c => c.id===id ? {...c,status:'cancelled'} : c)); setDetail(null); toast$('Challenge cancelled.') }

  const incoming  = list.filter(c => c.to   === myTeamName)
  const outgoing  = list.filter(c => c.from === myTeamName)
  const scopedList = [...incoming, ...outgoing]
  const displayed = tab==='incoming' ? incoming : tab==='outgoing' ? outgoing : scopedList

  const bdg = s =>
    s==='accepted'  ? 'success' :
    s==='declined'  ? 'danger'  :
    s==='cancelled' ? 'muted'   : 'warning'

  const pendingIncoming = incoming.filter(c => c.status==='pending').length

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-area">
        <Topbar title="Challenges" breadcrumb="Team / Challenges" />
        <div className="page-inner">
          {toast && <div className="alert alert-success"><i className="fas fa-check-circle" />{toast}</div>}

          <div className="sec-hd anim-1">
            <div><h2>Challenges</h2><p>Manage incoming and outgoing match challenges</p></div>
            <button className="btn btn-primary" onClick={() => setModal(true)}>
              <i className="fas fa-flag" /> Send Challenge
            </button>
          </div>

          {/* Stats */}
          <div className="stats-row anim-2" style={{ gridTemplateColumns:'repeat(4,1fr)' }}>
            {[
              { lbl:'Incoming', cls:'si-orange', icon:'fa-inbox',       v: incoming.length,                               sub:'Received' },
              { lbl:'Outgoing', cls:'si-blue',   icon:'fa-paper-plane', v: outgoing.length,                               sub:'Sent by you' },
              { lbl:'Accepted', cls:'si-green',  icon:'fa-check-circle',v: scopedList.filter(c=>c.status==='accepted').length,  sub:'Confirmed' },
              { lbl:'Pending',  cls:'si-yellow', icon:'fa-clock',       v: scopedList.filter(c=>c.status==='pending').length,   sub:'Awaiting reply' },
            ].map(s => (
              <div className="stat-card" key={s.lbl}>
                <div className={`stat-icon ${s.cls}`}><i className={`fas ${s.icon}`} /></div>
                <div><div className="stat-val">{s.v}</div><div className="stat-label">{s.lbl}</div><div className="stat-sub">{s.sub}</div></div>
              </div>
            ))}
          </div>

          {/* Incoming alert */}
          {pendingIncoming > 0 && (
            <div className="alert alert-info anim-2">
              <i className="fas fa-bell" />
              You have <strong>{pendingIncoming}</strong> pending challenge{pendingIncoming > 1 ? 's' : ''} waiting for your response!
            </div>
          )}

          {/* Tabs */}
          <div style={{ display:'flex', gap:8, marginBottom:18 }} className="anim-3">
            {[
              { key:'all',      label:'All',      count: scopedList.length, dot: 0 },
              { key:'incoming', label:'Incoming', count: incoming.length, dot: pendingIncoming },
              { key:'outgoing', label:'Outgoing', count: outgoing.length, dot: 0 },
            ].map(t => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`btn btn-sm ${tab===t.key ? 'btn-primary' : 'btn-outline'}`}
                style={{ position:'relative' }}
              >
                {t.label}
                <span style={{ background: tab===t.key?'rgba(255,255,255,.25)':'var(--bg)', color: tab===t.key?'#fff':'var(--txt-3)', borderRadius:20, padding:'1px 7px', fontSize:11, fontWeight:800, marginLeft:4 }}>
                  {t.count}
                </span>
                {t.dot > 0 && (
                  <span style={{ position:'absolute', top:-4, right:-4, width:14, height:14, background:'var(--orange)', borderRadius:'50%', border:'2px solid #fff', fontSize:9, display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontWeight:900 }}>
                    {t.dot}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Challenge cards */}
          <div style={{ display:'flex', flexDirection:'column', gap:12 }} className="anim-3">
            {displayed.length === 0 ? (
              <div className="empty-state">
                <i className="fas fa-flag" />
                <h3>No challenges here</h3>
                <p>{tab==='incoming' ? 'No one has challenged you yet.' : tab==='outgoing' ? "You haven't sent any challenges." : 'No challenges yet.'}</p>
              </div>
            ) : displayed.map((c, i) => {
              const isIncoming = c.to === MY_TEAM
              const isPending  = c.status === 'pending'
              return (
                <div key={c.id} className="card" style={{ borderLeft:`4px solid ${c.status==='accepted'?'var(--green)':c.status==='pending'?'var(--orange)':c.status==='cancelled'?'#e4e8ee':'#ef4444'}` }}>
                  <div style={{ padding:'16px 20px', display:'flex', gap:14, flexWrap:'wrap', alignItems:'flex-start' }}>

                    <div style={{ width:44, height:44, borderRadius:12, background: isIncoming?'#fff7ed':'#eff6ff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, flexShrink:0 }}>
                      {isIncoming ? '📥' : '📤'}
                    </div>

                    <div style={{ flex:1, minWidth:200 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap', marginBottom:6 }}>
                        <span style={{ fontSize:11, fontWeight:800, textTransform:'uppercase', letterSpacing:.5, color: isIncoming?'var(--orange)':'var(--blue)', background: isIncoming?'#fff7ed':'#eff6ff', padding:'2px 8px', borderRadius:20 }}>
                          {isIncoming ? 'Received' : 'Sent'}
                        </span>
                        <span className={`badge badge-${bdg(c.status)}`}>{c.status}</span>
                      </div>

                      <div style={{ fontFamily:'Barlow Condensed,sans-serif', fontSize:17, fontWeight:900, marginBottom:6 }}>
                        <span style={{ color:'var(--green)' }}>{c.from}</span>
                        <span style={{ color:'#ccc', margin:'0 8px', fontWeight:400 }}>vs</span>
                        <span>{c.to}</span>
                      </div>

                      <div style={{ display:'flex', flexWrap:'wrap', gap:14, fontSize:12, color:'#4a5568' }}>
                        <span><i className="fas fa-calendar" style={{ color:'var(--green)',  marginRight:4 }} />{c.date}</span>
                        <span><i className="fas fa-clock"    style={{ color:'var(--blue)',   marginRight:4 }} />{c.time}</span>
                        <span><i className="fas fa-building" style={{ color:'var(--orange)', marginRight:4 }} />{c.venue}</span>
                      </div>

                      {c.note && (
                        <div style={{ fontSize:12, color:'#4a5568', fontStyle:'italic', marginTop:8 }}>"{c.note}"</div>
                      )}
                    </div>

                    <div style={{ display:'flex', flexDirection:'column', gap:7, alignItems:'flex-end', flexShrink:0 }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => setDetail(c)}>
                        <i className="fas fa-eye" /> Details
                      </button>
                      {isPending && isIncoming && (
                        <>
                          <button className="btn btn-primary btn-sm" onClick={() => accept(c.id)}>
                            <i className="fas fa-check" /> Accept
                          </button>
                          <button className="btn btn-outline btn-sm" onClick={() => decline(c.id)}>Decline</button>
                        </>
                      )}
                      {isPending && !isIncoming && (
                        <button className="btn btn-danger btn-sm" onClick={() => cancel(c.id)}>
                          <i className="fas fa-xmark" /> Cancel
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Quick challenge row */}
          <div className="card anim-4" style={{ marginTop:24 }}>
            <div className="card-hd"><h3>Quick Challenge a Team</h3></div>
            <div className="card-bd">
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(240px,1fr))', gap:10 }}>
                {teams.filter(t => t.name !== myTeamName).map(t => {
                  const alreadySent = list.some(c => c.from===myTeamName && c.to===t.name && c.status==='pending')
                  return (
                    <div key={t.id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'11px 14px', background:'#f8fafc', borderRadius:10, border:'1px solid #e4e8ee' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                        <div style={{ width:36, height:36, borderRadius:10, background:'var(--green-light)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18 }}>{t.emoji}</div>
                        <div>
                          <div style={{ fontWeight:700, fontSize:13 }}>{t.name}</div>
                          <div style={{ fontSize:11, color:'#4a5568' }}>{t.location} · {t.skill}</div>
                        </div>
                      </div>
                      <button
                        className={`btn btn-sm ${alreadySent ? 'btn-outline' : 'btn-primary'}`}
                        disabled={alreadySent}
                        onClick={() => { setForm({...form,team:t.name}); setModal(true) }}
                      >
                        {alreadySent ? '⏳ Sent' : <><i className="fas fa-flag" /> Challenge</>}
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* ── SEND CHALLENGE MODAL ── */}
      {modal && (
        <div className="modal-overlay" onClick={() => setModal(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth:500 }}>
            <div className="modal-hd">
              <h3><i className="fas fa-flag" style={{ color:'var(--green)', marginRight:8 }} />Send Challenge</h3>
              <button className="modal-close" onClick={() => setModal(false)}><i className="fas fa-xmark" /></button>
            </div>
            <div className="form-group">
              <label className="form-label">Challenge Team</label>
              <select className="form-control" value={form.team} onChange={e => setForm({...form,team:e.target.value})}>
                <option value="">— Select opponent —</option>
                {teams.map(t => <option key={t.id}>{t.name} ({t.skill})</option>)}
              </select>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
              <div className="form-group">
                <label className="form-label">Match Date</label>
                <input type="date" className="form-control" value={form.date} onChange={e => setForm({...form,date:e.target.value})} />
              </div>
              <div className="form-group">
                <label className="form-label">Match Time</label>
                <input type="time" className="form-control" value={form.time} onChange={e => setForm({...form,time:e.target.value})} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Venue</label>
              <select className="form-control" value={form.venue} onChange={e => setForm({...form,venue:e.target.value})}>
                <option>Arena Futsal Park</option>
                <option>Champions Court</option>
                <option>Goal Zone Futsal</option>
                <option>Patan Sports Hub</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Message (optional)</label>
              <input type="text" className="form-control" placeholder="e.g. Let's have a great game!"
                value={form.note} onChange={e => setForm({...form,note:e.target.value})} />
            </div>
            <div style={{ display:'flex', gap:10, marginTop:8 }}>
              <button className="btn btn-primary" style={{ flex:1 }}
                disabled={!form.team || !form.date || !form.time}
                onClick={send}>
                <i className="fas fa-paper-plane" /> Send Challenge
              </button>
              <button className="btn btn-outline" onClick={() => setModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── DETAIL MODAL ── */}
      {detail && (
        <div className="modal-overlay" onClick={() => setDetail(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="modal-hd">
              <h3>Challenge Details</h3>
              <button className="modal-close" onClick={() => setDetail(null)}><i className="fas fa-xmark" /></button>
            </div>
            <div style={{ textAlign:'center', marginBottom:20 }}>
              <div style={{ fontFamily:'Barlow Condensed,sans-serif', fontSize:20, fontWeight:900 }}>
                <span style={{ color:'var(--green)' }}>{detail.from}</span>
                <span style={{ color:'#ccc', margin:'0 10px' }}>vs</span>
                <span>{detail.to}</span>
              </div>
              <span className={`badge badge-${bdg(detail.status)}`} style={{ marginTop:8 }}>{detail.status}</span>
            </div>
            {[
              { lbl:'Date',  val: detail.date,  icon:'fa-calendar' },
              { lbl:'Time',  val: detail.time,  icon:'fa-clock' },
              { lbl:'Venue', val: detail.venue, icon:'fa-building' },
              { lbl:'Type',  val: detail.to===MY_TEAM ? 'Incoming' : 'Outgoing', icon:'fa-arrow-right-arrow-left' },
            ].map(r => (
              <div key={r.lbl} style={{ display:'flex', justifyContent:'space-between', padding:'9px 0', borderBottom:'1px solid #f0f4f8' }}>
                <span style={{ fontSize:12, fontWeight:800, color:'#8a96a8', textTransform:'uppercase', display:'flex', alignItems:'center', gap:7 }}>
                  <i className={`fas ${r.icon}`} style={{ color:'var(--green)', width:14 }} />{r.lbl}
                </span>
                <span style={{ fontWeight:700, fontSize:13 }}>{r.val}</span>
              </div>
            ))}
            {detail.note && (
              <div style={{ marginTop:12, padding:'10px 14px', background:'#f8fafc', borderRadius:8, fontSize:13, color:'#4a5568', fontStyle:'italic' }}>
                "{detail.note}"
              </div>
            )}
            <div style={{ display:'flex', gap:10, marginTop:20 }}>
                      {detail.status==='pending' && detail.to===myTeamName && (
                <>
                  <button className="btn btn-primary" style={{ flex:1 }} onClick={() => accept(detail.id)}>
                    <i className="fas fa-check" /> Accept
                  </button>
                  <button className="btn btn-outline" onClick={() => decline(detail.id)}>Decline</button>
                </>
              )}
              {detail.status==='pending' && detail.from===myTeamName && (
                <button className="btn btn-danger" style={{ flex:1 }} onClick={() => cancel(detail.id)}>
                  <i className="fas fa-xmark" /> Cancel Challenge
                </button>
              )}
              <button className="btn btn-outline" onClick={() => setDetail(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}