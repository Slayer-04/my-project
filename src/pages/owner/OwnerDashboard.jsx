import React from 'react'
import { useNavigate } from 'react-router-dom'
import Sidebar from '../../components/Sidebar.jsx'
import Topbar  from '../../components/Topbar.jsx'
import { useAuth } from '../../App.jsx'
import { bookings, scheduleData } from '../../data/mockData.js'

const BARS = [58, 74, 42, 91, 65, 100, 48]
const DAYS  = ['M','T','W','T','F','S','S']

export default function OwnerDashboard() {
  const { user }  = useAuth()
  const navigate  = useNavigate()
  const confirmed = bookings.filter(b => b.status==='confirmed').length
  const pending   = bookings.filter(b => b.status==='pending').length

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-area">
        <Topbar title="Dashboard" breadcrumb="FotMatch / Futsal Owner" />
        <div className="page-inner">

          <div className="anim-1" style={{ marginBottom:26 }}>
            <h1 style={{ fontFamily:'Barlow Condensed,sans-serif', fontSize:28, fontWeight:900 }}>
              Welcome, {user?.name?.split(' ')[0]}! 🏟️
            </h1>
            <p style={{ color:'#4a5568', fontSize:14, marginTop:4 }}>Here's your venue overview for today</p>
          </div>

          <div className="stats-row anim-2">
            {[
              { icon:'fa-clipboard-list', cls:'si-green',  val:bookings.length, lbl:'Total Bookings',    sub:'+5 this week' },
              { icon:'fa-calendar-day',   cls:'si-blue',   val:confirmed,       lbl:"Today's Confirmed", sub:'Arena Futsal Park' },
              { icon:'fa-clock',          cls:'si-orange', val:pending,         lbl:'Pending Approvals', sub:'Needs review' },
              { icon:'fa-door-open',      cls:'si-purple', val:12,              lbl:'Available Slots',   sub:'Across all venues' },
            ].map(s => (
              <div className="stat-card" key={s.lbl}>
                <div className={`stat-icon ${s.cls}`}><i className={`fas ${s.icon}`} /></div>
                <div><div className="stat-val">{s.val}</div><div className="stat-label">{s.lbl}</div><div className="stat-sub">{s.sub}</div></div>
              </div>
            ))}
          </div>

          <div className="two-col anim-3">
            {/* Today's slots */}
            <div className="card">
              <div className="card-hd">
                <h3>Today's Schedule</h3>
                <button className="btn btn-outline btn-sm" onClick={() => navigate('/owner/schedule')}>
                  Manage <i className="fas fa-arrow-right" />
                </button>
              </div>
              {scheduleData[0].slots.map((slot, i) => (
                <div key={i} style={{ padding:'11px 22px', borderBottom:'1px solid #f0f4f8', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                    <div style={{ width:8, height:8, borderRadius:'50%', background: slot.status==='booked'?'#e53e3e': slot.status==='blocked'?'#a0aec0':'#00b96b' }} />
                    <span style={{ fontWeight:700, fontSize:13 }}>{slot.time}</span>
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    {slot.team && <span style={{ fontSize:12, fontWeight:700 }}>{slot.team}</span>}
                    <span className={`badge badge-${slot.status==='booked'?'danger': slot.status==='blocked'?'muted':'success'}`}>
                      {slot.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Recent bookings */}
            <div className="card">
              <div className="card-hd">
                <h3>Recent Bookings</h3>
                <button className="btn btn-ghost btn-sm" onClick={() => navigate('/owner/bookings')}>View All</button>
              </div>
              {bookings.slice(0,5).map(b => (
                <div key={b.id} style={{ padding:'13px 22px', borderBottom:'1px solid #f0f4f8', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <div>
                    <div style={{ fontWeight:700, fontSize:13 }}>{b.team}</div>
                    <div style={{ fontSize:11, color:'#4a5568', marginTop:2 }}>{b.date} · {b.time}</div>
                  </div>
                  <span className={`badge badge-${b.status==='confirmed'?'success': b.status==='pending'?'warning':'danger'}`}>{b.status}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Revenue */}
          <div className="card anim-4" style={{ marginTop:22 }}>
            <div className="card-hd"><h3>Weekly Revenue</h3></div>
            <div className="card-bd">
              <div style={{ display:'flex', alignItems:'flex-end', gap:6, height:100 }}>
                {BARS.map((h, i) => (
                  <div key={i} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:5, height:'100%', justifyContent:'flex-end' }}>
                    <div
                      style={{ width:'100%', height:`${h}%`, minHeight:6, borderRadius:'5px 5px 0 0',
                               background: i===5 ? 'var(--green)' : 'var(--green-light)',
                               transition:'background .2s', cursor:'pointer' }}
                      onMouseEnter={e => e.target.style.background='var(--green)'}
                      onMouseLeave={e => { if(i!==5) e.target.style.background='var(--green-light)' }}
                    />
                    <div style={{ fontSize:10, color:'#8a96a8', fontWeight:700 }}>{DAYS[i]}</div>
                  </div>
                ))}
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10, marginTop:18, padding:14, background:'#f8fafc', borderRadius:10 }}>
                {[
                  { lbl:'This Week',   val:'Rs. 8,400',  c:'var(--green)' },
                  { lbl:'This Month',  val:'Rs. 32,100', c:'var(--blue)' },
                  { lbl:'Growth',      val:'+18%',       c:'var(--purple)' },
                ].map(r => (
                  <div key={r.lbl} style={{ textAlign:'center' }}>
                    <div style={{ fontFamily:'Barlow Condensed,sans-serif', fontSize:20, fontWeight:900, color:r.c }}>{r.val}</div>
                    <div style={{ fontSize:11, color:'#8a96a8', fontWeight:700, textTransform:'uppercase', marginTop:3 }}>{r.lbl}</div>
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
