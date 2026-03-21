import React from 'react'
import { useNavigate } from 'react-router-dom'
import Sidebar from '../../components/Sidebar.jsx'
import Topbar  from '../../components/Topbar.jsx'
import { useAuth } from '../../App.jsx'
import { users, futsalPartners, bookings, activityLogs } from '../../data/mockData.js'

const BARS = [40, 65, 55, 80, 70, 95, 60]
const DAYS  = ['M','T','W','T','F','S','S']

export default function AdminDashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const activeUsers  = users.filter(u => u.status==='active').length
  const teamUsers    = users.filter(u => u.role==='Team User').length
  const approvedVenues = futsalPartners.filter(v => v.status==='approved').length

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-area">
        <Topbar title="Admin Dashboard" breadcrumb="FotMatch / Administration" />
        <div className="page-inner">

          <div className="anim-1" style={{ marginBottom:26 }}>
            <h1 style={{ fontFamily:'Barlow Condensed,sans-serif', fontSize:28, fontWeight:900 }}>
              System Overview 🛡️
            </h1>
            <p style={{ color:'#4a5568', fontSize:14, marginTop:4 }}>Welcome back, {user?.name}. Everything looks good.</p>
          </div>

          {/* Stats */}
          <div className="stats-row anim-2">
            {[
              { icon:'fa-users',     cls:'si-blue',   val: users.length,     lbl:'Total Users',        sub:`${activeUsers} active` },
              { icon:'fa-shield',    cls:'si-green',  val: teamUsers,         lbl:'Active Teams',       sub:'Registered this month' },
              { icon:'fa-building',  cls:'si-orange', val: futsalPartners.length, lbl:'Registered Futsals', sub:`${approvedVenues} approved` },
              { icon:'fa-futbol',    cls:'si-purple', val: 4,                 lbl:'Ongoing Matches',    sub:'Live right now' },
            ].map(s => (
              <div className="stat-card" key={s.lbl}>
                <div className={`stat-icon ${s.cls}`}><i className={`fas ${s.icon}`} /></div>
                <div><div className="stat-val">{s.val}</div><div className="stat-label">{s.lbl}</div><div className="stat-sub">{s.sub}</div></div>
              </div>
            ))}
          </div>

          <div className="two-col anim-3">
            {/* Activity log */}
            <div className="card">
              <div className="card-hd">
                <h3>Live Activity Feed</h3>
                <button className="btn btn-ghost btn-sm" onClick={() => navigate('/admin/reports')}>
                  Full Log <i className="fas fa-arrow-right" />
                </button>
              </div>
              <div className="card-bd" style={{ paddingTop:4 }}>
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
              </div>
            </div>

            {/* Quick nav cards */}
            <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
              {[
                { icon:'fa-users',     label:'User Management',     sub:`${users.length} registered users`,    path:'/admin/users',   cls:'si-blue'   },
                { icon:'fa-building',  label:'Futsal Partners',     sub:`${futsalPartners.length} venues total`, path:'/admin/futsals', cls:'si-orange' },
                { icon:'fa-chart-bar', label:'Reports & Monitoring',sub:'Activity logs & analytics',           path:'/admin/reports', cls:'si-green'  },
                { icon:'fa-server',    label:'System Status',       sub:'All systems operational',             path:'/admin/system',  cls:'si-purple' },
              ].map(c => (
                <div key={c.path}
                  onClick={() => navigate(c.path)}
                  style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--radius)', padding:'16px 18px', display:'flex', alignItems:'center', gap:14, cursor:'pointer', transition:'var(--transition)', boxShadow:'var(--shadow-xs)' }}
                  onMouseEnter={e => { e.currentTarget.style.boxShadow='var(--shadow-md)'; e.currentTarget.style.transform='translateY(-2px)' }}
                  onMouseLeave={e => { e.currentTarget.style.boxShadow='var(--shadow-xs)'; e.currentTarget.style.transform='none' }}
                >
                  <div className={`stat-icon ${c.cls}`}><i className={`fas ${c.icon}`} /></div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontWeight:800, fontSize:14 }}>{c.label}</div>
                    <div style={{ fontSize:12, color:'#8a96a8', marginTop:2 }}>{c.sub}</div>
                  </div>
                  <i className="fas fa-chevron-right" style={{ color:'#8a96a8', fontSize:12 }} />
                </div>
              ))}
            </div>
          </div>

          {/* Platform activity chart */}
          <div className="card anim-4" style={{ marginTop:22 }}>
            <div className="card-hd"><h3>Platform Activity (This Week)</h3></div>
            <div className="card-bd">
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:24 }}>
                {/* Bookings bar */}
                <div>
                  <div style={{ fontSize:12, fontWeight:800, color:'#8a96a8', textTransform:'uppercase', marginBottom:10 }}>Daily Bookings</div>
                  <div style={{ display:'flex', alignItems:'flex-end', gap:6, height:90 }}>
                    {BARS.map((h, i) => (
                      <div key={i} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:5, height:'100%', justifyContent:'flex-end' }}>
                        <div style={{ width:'100%', height:`${h}%`, minHeight:5, borderRadius:'4px 4px 0 0', background: i===5?'var(--green)':'var(--green-light)', cursor:'pointer' }}
                          onMouseEnter={e => e.target.style.background='var(--green)'}
                          onMouseLeave={e => { if(i!==5) e.target.style.background='var(--green-light)' }}
                        />
                        <div style={{ fontSize:10, color:'#8a96a8', fontWeight:700 }}>{DAYS[i]}</div>
                      </div>
                    ))}
                  </div>
                </div>
                {/* Registrations */}
                <div>
                  <div style={{ fontSize:12, fontWeight:800, color:'#8a96a8', textTransform:'uppercase', marginBottom:10 }}>New Registrations</div>
                  <div style={{ display:'flex', alignItems:'flex-end', gap:6, height:90 }}>
                    {[25, 40, 30, 60, 45, 75, 35].map((h, i) => (
                      <div key={i} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:5, height:'100%', justifyContent:'flex-end' }}>
                        <div style={{ width:'100%', height:`${h}%`, minHeight:5, borderRadius:'4px 4px 0 0', background: i===5?'var(--blue)':'var(--blue-light)', cursor:'pointer' }}
                          onMouseEnter={e => e.target.style.background='var(--blue)'}
                          onMouseLeave={e => { if(i!==5) e.target.style.background='var(--blue-light)' }}
                        />
                        <div style={{ fontSize:10, color:'#8a96a8', fontWeight:700 }}>{DAYS[i]}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10, marginTop:20, padding:14, background:'#f8fafc', borderRadius:10 }}>
                {[
                  { lbl:'Total Bookings',  val: bookings.length,   c:'var(--blue)' },
                  { lbl:'Revenue (Est.)',  val:'Rs. 48,600',        c:'var(--green)' },
                  { lbl:'Avg. Daily Users',val:'124',               c:'var(--purple)' },
                  { lbl:'Match Rate',      val:'76%',               c:'var(--orange)' },
                ].map(r => (
                  <div key={r.lbl} style={{ textAlign:'center' }}>
                    <div style={{ fontFamily:'Barlow Condensed,sans-serif', fontSize:20, fontWeight:900, color:r.c }}>{r.val}</div>
                    <div style={{ fontSize:10, color:'#8a96a8', fontWeight:700, textTransform:'uppercase', marginTop:3 }}>{r.lbl}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
