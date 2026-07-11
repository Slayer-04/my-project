import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Sidebar from '../../components/Sidebar.jsx'
import Topbar  from '../../components/Topbar.jsx'
import { useAuth } from '../../App.jsx'
import { fetchApiJson } from '../../utils/apiClient.js'

export default function AdminDashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [stats, setStats] = useState({
    totalUsers: 0,
    activeUsers: 0,
    teamUsers: 0,
    totalVenues: 0,
    approvedVenues: 0,
    totalBookings: 0,
  })
  const [recentBookings, setRecentBookings] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true

    const load = async () => {
      try {
        const [usersRes, venuesRes, bookingsRes] = await Promise.all([
          fetchApiJson('/users'),
          fetchApiJson('/venues'),
          fetchApiJson('/bookings'),
        ])

        if (!mounted) return

        const users = Array.isArray(usersRes.data) ? usersRes.data : []
        const venues = Array.isArray(venuesRes.data) ? venuesRes.data : []
        const bookings = Array.isArray(bookingsRes.data) ? bookingsRes.data : []

        setStats({
          totalUsers: users.length,
          activeUsers: users.filter(u => u.status === 'active').length,
          teamUsers: users.filter(u => u.role === 'team').length,
          totalVenues: venues.length,
          approvedVenues: venues.filter(v => v.status === 'approved').length,
          totalBookings: bookings.length,
        })

        setRecentBookings(
          [...bookings]
            .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
            .slice(0, 6)
        )
      } catch (_error) {
        // Leave stats at their defaults if the backend is unreachable.
      } finally {
        if (mounted) setLoading(false)
      }
    }

    load()
    return () => { mounted = false }
  }, [])

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
            <p style={{ color:'#4a5568', fontSize:14, marginTop:4 }}>Welcome back, {user?.name}.</p>
          </div>

          {/* Stats — real counts from the database */}
          <div className="stats-row anim-2">
            {[
              { icon:'fa-users',    cls:'si-blue',   val: stats.totalUsers,   lbl:'Total Users',        sub:`${stats.activeUsers} active` },
              { icon:'fa-shield',   cls:'si-green',  val: stats.teamUsers,    lbl:'Team Accounts',       sub:'Registered teams' },
              { icon:'fa-building', cls:'si-orange', val: stats.totalVenues,  lbl:'Registered Futsals',  sub:`${stats.approvedVenues} approved` },
              { icon:'fa-clipboard-list', cls:'si-purple', val: stats.totalBookings, lbl:'Total Bookings', sub:'All time' },
            ].map(s => (
              <div className="stat-card" key={s.lbl}>
                <div className={`stat-icon ${s.cls}`}><i className={`fas ${s.icon}`} /></div>
                <div><div className="stat-val">{loading ? '—' : s.val}</div><div className="stat-label">{s.lbl}</div><div className="stat-sub">{s.sub}</div></div>
              </div>
            ))}
          </div>

          <div className="two-col anim-3">
            {/* Recent bookings — real data */}
            <div className="card">
              <div className="card-hd">
                <h3>Recent Bookings</h3>
                <button className="btn btn-ghost btn-sm" onClick={() => navigate('/admin/reports')}>
                  View All <i className="fas fa-arrow-right" />
                </button>
              </div>
              <div className="card-bd" style={{ paddingTop:4 }}>
                {recentBookings.length === 0 ? (
                  <div className="empty-state" style={{ margin:0, padding:'20px 0' }}>
                    <p style={{ margin:0, fontSize:13, color:'#8a96a8' }}>
                      {loading ? 'Loading…' : 'No bookings yet.'}
                    </p>
                  </div>
                ) : (
                  <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                    {recentBookings.map(b => (
                      <div key={b._id || b.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 0', borderBottom:'1px solid #f0f4f8' }}>
                        <div>
                          <div style={{ fontWeight:700, fontSize:13 }}>{b.team}</div>
                          <div style={{ fontSize:12, color:'#8a96a8' }}>{b.venue} · {b.date} {b.time}</div>
                        </div>
                        <span className={`badge badge-${b.status==='confirmed'?'success':b.status==='pending'?'warning':'danger'}`}>{b.status}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Quick nav cards */}
            <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
              {[
                { icon:'fa-users',     label:'User Management',     sub:`${stats.totalUsers} registered users`,    path:'/admin/users',   cls:'si-blue'   },
                { icon:'fa-building',  label:'Futsal Partners',     sub:`${stats.totalVenues} venues total`,        path:'/admin/futsals', cls:'si-orange' },
                { icon:'fa-chart-bar', label:'Reports & Monitoring',sub:'Bookings & user data',                    path:'/admin/reports', cls:'si-green'  },
                { icon:'fa-server',    label:'System Status',       sub:'Backend & database health',               path:'/admin/system',  cls:'si-purple' },
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

        </div>
      </div>
    </div>
  )
}