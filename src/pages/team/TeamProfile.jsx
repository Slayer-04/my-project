import React, { useState } from 'react'
import Sidebar from '../../components/Sidebar.jsx'
import Topbar  from '../../components/Topbar.jsx'
import { useAuth } from '../../App.jsx'
import { matchHistory } from '../../data/mockData.js'

export default function TeamProfile() {
  const { user } = useAuth()
  const [editing, setEditing] = useState(false)
  const [info, setInfo] = useState({ name:'Green Eagles', location:'Lazimpat, Kathmandu', skill:'Intermediate' })
  const [toast, setToast] = useState('')

  const save = () => { setEditing(false); setToast('✅ Profile updated!'); setTimeout(() => setToast(''), 3000) }

  const wins   = matchHistory.filter(m => m.result==='win').length
  const losses = matchHistory.filter(m => m.result==='loss').length
  const draws  = matchHistory.filter(m => m.result==='draw').length
  const total  = wins + losses + draws || 1

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
              <div className="ph-name">{info.name}</div>
              <div className="ph-sub"><i className="fas fa-location-dot" style={{ marginRight:5 }} />{info.location}</div>
              <div className="ph-tags">
                <span className="ph-tag">{info.skill}</span>
                <span className="ph-tag">8 Members</span>
                <span className="ph-tag">Est. 2023</span>
              </div>
            </div>
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
          </div>

          <div className="two-col anim-2">
            {/* Info / Edit */}
            <div className="card">
              <div className="card-hd"><h3>{editing ? 'Edit Info' : 'Team Information'}</h3></div>
              <div className="card-bd">
                {editing ? (
                  <>
                    <div className="form-group">
                      <label className="form-label">Team Name</label>
                      <input className="form-control" value={info.name} onChange={e => setInfo({...info,name:e.target.value})} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Location</label>
                      <input className="form-control" value={info.location} onChange={e => setInfo({...info,location:e.target.value})} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Skill Level</label>
                      <select className="form-control" value={info.skill} onChange={e => setInfo({...info,skill:e.target.value})}>
                        <option>Beginner</option><option>Intermediate</option><option>Advanced</option>
                      </select>
                    </div>
                    <button className="btn btn-primary btn-full" onClick={save}>
                      <i className="fas fa-floppy-disk" /> Save Changes
                    </button>
                  </>
                ) : (
                  <>
                    {[
                      { lbl:'Team Name', val:info.name,           icon:'fa-users' },
                      { lbl:'Location',  val:info.location,       icon:'fa-location-dot' },
                      { lbl:'Skill',     val:info.skill,          icon:'fa-signal' },
                      { lbl:'Captain',   val:user?.name,          icon:'fa-user-tie' },
                      { lbl:'Members',   val:'8 players',         icon:'fa-person-running' },
                    ].map(item => (
                      <div key={item.lbl} style={{ display:'flex', justifyContent:'space-between', padding:'10px 0', borderBottom:'1px solid #f0f4f8' }}>
                        <span style={{ fontSize:12, color:'#8a96a8', display:'flex', alignItems:'center', gap:7, fontWeight:700, textTransform:'uppercase', letterSpacing:.3 }}>
                          <i className={`fas ${item.icon}`} style={{ width:14, color:'var(--green)' }} />{item.lbl}
                        </span>
                        <span style={{ fontSize:13, fontWeight:700 }}>{item.val}</span>
                      </div>
                    ))}
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
                  <div className="health-track"><div className="health-fill hf-green" style={{ width:`${Math.round((wins/total)*100)}%` }} /></div>
                </div>

                <div style={{ marginTop:16, padding:14, background:'#f8fafc', borderRadius:10, textAlign:'center' }}>
                  <div style={{ fontSize:12, color:'#8a96a8', marginBottom:4, fontWeight:700, textTransform:'uppercase' }}>Goals For / Against</div>
                  <div style={{ fontFamily:'Barlow Condensed,sans-serif', fontSize:24, fontWeight:900 }}>
                    <span style={{ color:'var(--green)' }}>24</span>
                    <span style={{ color:'#e4e8ee', margin:'0 8px' }}>/</span>
                    <span style={{ color:'var(--red)' }}>14</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Match History */}
          <div className="card anim-3" style={{ marginTop:22 }}>
            <div className="card-hd"><h3>Match History</h3></div>
            <div className="card-bd" style={{ paddingTop:8 }}>
              {matchHistory.map(m => (
                <div key={m.id} className="match-row">
                  <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                    <div style={{ width:36, height:36, borderRadius:10, background: m.result==='win'?'#e6faf2': m.result==='loss'?'#fff5f5':'#fefce8', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16 }}>
                      {m.result==='win'?'🏆': m.result==='loss'?'💔':'🤝'}
                    </div>
                    <div>
                      <div className="match-teams">
                        <span style={{ color:'var(--green)' }}>My Team</span>
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
    </div>
  )
}
