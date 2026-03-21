import React, { useState } from 'react'
import Sidebar from '../../components/Sidebar.jsx'
import Topbar  from '../../components/Topbar.jsx'
import { activityLogs, bookings, users, futsalPartners } from '../../data/mockData.js'

const WEEKLY = [
  { day:'Mon', bookings:8,  matches:3,  users:5  },
  { day:'Tue', bookings:12, matches:5,  users:8  },
  { day:'Wed', bookings:6,  matches:2,  users:3  },
  { day:'Thu', bookings:15, matches:7,  users:12 },
  { day:'Fri', bookings:11, matches:4,  users:9  },
  { day:'Sat', bookings:20, matches:10, users:18 },
  { day:'Sun', bookings:9,  matches:4,  users:6  },
]
const MAX_B = Math.max(...WEEKLY.map(w => w.bookings))
const MAX_U = Math.max(...WEEKLY.map(w => w.users))

export default function Reports() {
  const [tab, setTab] = useState('activity')

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-area">
        <Topbar title="Reports & Monitoring" breadcrumb="Admin / Reports" />
        <div className="page-inner">

          <div className="sec-hd anim-1">
            <div><h2>Reports &amp; Analytics</h2><p>Platform activity, booking trends and user metrics</p></div>
            <button className="btn btn-outline" style={{ gap:8 }}>
              <i className="fas fa-download" /> Export CSV
            </button>
          </div>

          {/* KPI Summary */}
          <div className="stats-row anim-2">
            {[
              { icon:'fa-clipboard-list', cls:'si-blue',   val: bookings.length,  lbl:'Total Bookings',  sub:'All time' },
              { icon:'fa-users',          cls:'si-green',  val: users.length,     lbl:'Registered Users',sub:'All roles' },
              { icon:'fa-building',       cls:'si-orange', val: futsalPartners.filter(p=>p.status==='approved').length, lbl:'Active Venues', sub:'Approved partners' },
              { icon:'fa-chart-line',     cls:'si-purple', val:'76%',             lbl:'Match Rate',      sub:'Challenges converted' },
            ].map(s => (
              <div className="stat-card" key={s.lbl}>
                <div className={`stat-icon ${s.cls}`}><i className={`fas ${s.icon}`} /></div>
                <div><div className="stat-val">{s.val}</div><div className="stat-label">{s.lbl}</div><div className="stat-sub">{s.sub}</div></div>
              </div>
            ))}
          </div>

          {/* Charts row */}
          <div className="two-col anim-3">
            {/* Bookings trend */}
            <div className="card">
              <div className="card-hd"><h3>Daily Bookings (This Week)</h3></div>
              <div className="card-bd">
                <div style={{ display:'flex', alignItems:'flex-end', gap:8, height:120 }}>
                  {WEEKLY.map((w, i) => (
                    <div key={i} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:6, height:'100%', justifyContent:'flex-end' }}>
                      <div style={{ fontSize:10, fontWeight:700, color:'var(--green)' }}>{w.bookings}</div>
                      <div style={{ width:'100%', height:`${(w.bookings/MAX_B)*100}%`, minHeight:6, borderRadius:'5px 5px 0 0', background:'var(--green)', opacity: i===5?1:.6, cursor:'pointer', transition:'opacity .2s' }}
                        onMouseEnter={e => e.target.style.opacity=1}
                        onMouseLeave={e => { if(i!==5) e.target.style.opacity='.6' }}
                      />
                      <div style={{ fontSize:10, color:'#8a96a8', fontWeight:700 }}>{w.day}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* New users trend */}
            <div className="card">
              <div className="card-hd"><h3>New Registrations (This Week)</h3></div>
              <div className="card-bd">
                <div style={{ display:'flex', alignItems:'flex-end', gap:8, height:120 }}>
                  {WEEKLY.map((w, i) => (
                    <div key={i} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:6, height:'100%', justifyContent:'flex-end' }}>
                      <div style={{ fontSize:10, fontWeight:700, color:'var(--blue)' }}>{w.users}</div>
                      <div style={{ width:'100%', height:`${(w.users/MAX_U)*100}%`, minHeight:6, borderRadius:'5px 5px 0 0', background:'var(--blue)', opacity: i===5?1:.55, cursor:'pointer', transition:'opacity .2s' }}
                        onMouseEnter={e => e.target.style.opacity=1}
                        onMouseLeave={e => { if(i!==5) e.target.style.opacity='.55' }}
                      />
                      <div style={{ fontSize:10, color:'#8a96a8', fontWeight:700 }}>{w.day}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Tab section */}
          <div className="card anim-4" style={{ marginTop:22 }}>
            <div className="card-hd" style={{ flexDirection:'column', alignItems:'flex-start', gap:12 }}>
              <h3>Detailed Logs</h3>
              <div style={{ display:'flex', gap:8 }}>
                {['activity','bookings','users'].map(t => (
                  <button key={t} className={`btn btn-sm ${tab===t?'btn-primary':'btn-outline'}`}
                    onClick={() => setTab(t)} style={{ textTransform:'capitalize' }}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <div className="card-bd" style={{ paddingTop:8 }}>
              {tab==='activity' && (
                <div className="activity-list">
                  {activityLogs.map(a => (
                    <div key={a.id} className="activity-item">
                      <div className={`act-dot ${a.type}`} />
                      <div>
                        <div className="act-event">{a.event}</div>
                        <div className="act-detail">{a.detail}</div>
                        <div className="act-time">{a.time}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {tab==='bookings' && (
                <div className="table-wrap" style={{ border:'none' }}>
                  <table>
                    <thead><tr><th>Team</th><th>Venue</th><th>Date</th><th>Amount</th><th>Status</th></tr></thead>
                    <tbody>
                      {bookings.map(b => (
                        <tr key={b.id}>
                          <td style={{ fontWeight:700 }}>{b.team}</td>
                          <td style={{ fontSize:13 }}>{b.venue}</td>
                          <td style={{ fontSize:13 }}>{b.date} · {b.time}</td>
                          <td style={{ fontWeight:700, color:'var(--green)' }}>{b.amount}</td>
                          <td><span className={`badge badge-${b.status==='confirmed'?'success':b.status==='pending'?'warning':'danger'}`}>{b.status}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {tab==='users' && (
                <div className="table-wrap" style={{ border:'none' }}>
                  <table>
                    <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Team</th><th>Joined</th><th>Status</th></tr></thead>
                    <tbody>
                      {users.map(u => (
                        <tr key={u.id}>
                          <td style={{ fontWeight:700 }}>{u.name}</td>
                          <td style={{ fontSize:13, color:'#4a5568' }}>{u.email}</td>
                          <td><span className={`badge badge-${u.role==='Admin'?'purple':u.role==='Futsal Owner'?'info':'success'}`}>{u.role}</span></td>
                          <td style={{ fontSize:13 }}>{u.team}</td>
                          <td style={{ fontSize:12, color:'#8a96a8' }}>{u.joined}</td>
                          <td>
                            <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                              <span className={`status-dot ${u.status==='active'?'sd-online':'sd-offline'}`} />
                              <span style={{ fontSize:12, fontWeight:700, color: u.status==='active'?'var(--green)':'#8a96a8' }}>{u.status}</span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
