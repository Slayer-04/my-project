import React from 'react'
import { useNavigate } from 'react-router-dom'
import Sidebar from '../../components/Sidebar.jsx'
import Topbar  from '../../components/Topbar.jsx'
import { useAuth } from '../../App.jsx'
import { bookings, matchHistory, challenges } from '../../data/mockData.js'

export default function TeamDashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const upcoming = bookings.filter(b => b.status !== 'cancelled').slice(0,3)
  const recent   = matchHistory.slice(0,3)

  const resultColor = r => r==='win' ? '#00b96b' : r==='loss' ? '#e53e3e' : '#eab308'

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
              { icon:'fa-users',          cls:'si-green',  val:'Green Eagles',  lbl:'My Team',         sub:'8 members' },
              { icon:'fa-calendar-check', cls:'si-blue',   val:'3',             lbl:'Upcoming Matches', sub:'Next: Tomorrow' },
              { icon:'fa-building',       cls:'si-orange', val:'2',             lbl:'Booked Futsals',  sub:'This week' },
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
                <button className="btn btn-outline btn-sm" onClick={() => navigate('/team/book-futsal')}>
                  <i className="fas fa-plus" /> Book
                </button>
              </div>
              <div>
                {upcoming.map(b => (
                  <div key={b.id} style={{ padding:'13px 22px', borderBottom:'1px solid #f0f4f8', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                    <div>
                      <div style={{ fontWeight:700, fontSize:14 }}>{b.venue}</div>
                      <div style={{ fontSize:12, color:'#4a5568', marginTop:2 }}>
                        <i className="fas fa-calendar" style={{ color:'var(--green)', marginRight:5 }} />{b.date}
                        <span style={{ margin:'0 7px', color:'#e4e8ee' }}>|</span>
                        <i className="fas fa-clock" style={{ color:'var(--green)', marginRight:5 }} />{b.time}
                      </div>
                    </div>
                    <span className={`badge badge-${b.status==='confirmed'?'success':b.status==='pending'?'warning':'danger'}`}>
                      {b.status}
                    </span>
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
                {recent.map(m => (
                  <div key={m.id} className="match-row">
                    <div className="match-teams">
                      <span style={{ color:'var(--green)', fontWeight:800 }}>My Team</span>
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

          {/* Challenges */}
          <div className="card anim-4" style={{ marginTop:22 }}>
            <div className="card-hd">
              <h3>Active Challenges</h3>
              <button className="btn btn-outline btn-sm" onClick={() => navigate('/team/challenges')}>
                See All <i className="fas fa-arrow-right" />
              </button>
            </div>
            <div>
              {challenges.map(c => (
                <div key={c.id} style={{ padding:'13px 22px', borderBottom:'1px solid #f0f4f8', display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:8 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                    <div style={{ width:36, height:36, borderRadius:10, background: c.status==='accepted'?'#e6faf2':'#f4f4f4', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16 }}>
                      {c.status==='accepted'?'✅': c.status==='declined'?'❌':'⏳'}
                    </div>
                    <div>
                      <div style={{ fontWeight:700, fontSize:14 }}>
                        <span style={{ color:'var(--green)' }}>{c.from}</span>
                        <span style={{ color:'#a0aec0', margin:'0 6px', fontWeight:400 }}>vs</span>
                        <span>{c.to}</span>
                      </div>
                      <div style={{ fontSize:12, color:'#4a5568', marginTop:2 }}>{c.date} · {c.time} — {c.venue}</div>
                    </div>
                  </div>
                  <span className={`badge badge-${c.status==='accepted'?'success':c.status==='declined'?'danger':'warning'}`}>
                    {c.status}
                  </span>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
