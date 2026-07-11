import React, { useEffect, useState } from 'react'
import Sidebar from '../../components/Sidebar.jsx'
import Topbar  from '../../components/Topbar.jsx'
import { fetchApiJson } from '../../utils/apiClient.js'

const toCsv = (rows, columns) => {
  const header = columns.map(c => c.label).join(',')
  const body = rows.map(row => (
    columns.map(c => {
      const value = String(row[c.key] ?? '').replace(/"/g, '""')
      return `"${value}"`
    }).join(',')
  )).join('\n')
  return `${header}\n${body}`
}

const downloadCsv = (filename, csvText) => {
  const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export default function Reports() {
  const [tab, setTab] = useState('bookings')
  const [bookings, setBookings] = useState([])
  const [users, setUsers] = useState([])
  const [venues, setVenues] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true

    const load = async () => {
      try {
        const [bookingsRes, usersRes, venuesRes] = await Promise.all([
          fetchApiJson('/bookings'),
          fetchApiJson('/users'),
          fetchApiJson('/venues'),
        ])

        if (!mounted) return
        if (bookingsRes.response.ok && Array.isArray(bookingsRes.data)) setBookings(bookingsRes.data)
        if (usersRes.response.ok && Array.isArray(usersRes.data)) setUsers(usersRes.data)
        if (venuesRes.response.ok && Array.isArray(venuesRes.data)) setVenues(venuesRes.data)
      } catch (_error) {
        // Leave data empty if the backend is unreachable.
      } finally {
        if (mounted) setLoading(false)
      }
    }

    load()
    return () => { mounted = false }
  }, [])

  const exportCurrentTab = () => {
    if (tab === 'bookings') {
      const csv = toCsv(bookings, [
        { key:'team', label:'Team' },
        { key:'venue', label:'Venue' },
        { key:'date', label:'Date' },
        { key:'time', label:'Time' },
        { key:'amount', label:'Amount' },
        { key:'status', label:'Status' },
      ])
      downloadCsv('bookings.csv', csv)
    } else {
      const csv = toCsv(users, [
        { key:'name', label:'Name' },
        { key:'email', label:'Email' },
        { key:'role', label:'Role' },
        { key:'status', label:'Status' },
      ])
      downloadCsv('users.csv', csv)
    }
  }

  const confirmedBookings = bookings.filter(b => b.status === 'confirmed').length
  const approvedVenues = venues.filter(v => v.status === 'approved').length

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-area">
        <Topbar title="Reports & Monitoring" breadcrumb="Admin / Reports" />
        <div className="page-inner">

          <div className="sec-hd anim-1">
            <div><h2>Reports</h2><p>Bookings and user data, straight from the database</p></div>
            <button className="btn btn-outline" style={{ gap:8 }} onClick={exportCurrentTab}>
              <i className="fas fa-download" /> Export {tab === 'bookings' ? 'Bookings' : 'Users'} CSV
            </button>
          </div>

          {/* KPI Summary — real counts */}
          <div className="stats-row anim-2">
            {[
              { icon:'fa-clipboard-list', cls:'si-blue',   val: loading ? '—' : bookings.length,      lbl:'Total Bookings', sub:'All time' },
              { icon:'fa-check-circle',   cls:'si-green',  val: loading ? '—' : confirmedBookings,     lbl:'Confirmed',      sub:'Bookings' },
              { icon:'fa-users',          cls:'si-orange', val: loading ? '—' : users.length,          lbl:'Registered Users', sub:'All roles' },
              { icon:'fa-building',       cls:'si-purple', val: loading ? '—' : approvedVenues,        lbl:'Active Venues',  sub:'Approved partners' },
            ].map(s => (
              <div className="stat-card" key={s.lbl}>
                <div className={`stat-icon ${s.cls}`}><i className={`fas ${s.icon}`} /></div>
                <div><div className="stat-val">{s.val}</div><div className="stat-label">{s.lbl}</div><div className="stat-sub">{s.sub}</div></div>
              </div>
            ))}
          </div>

          {/* Detail tables */}
          <div className="card anim-3" style={{ marginTop:22 }}>
            <div className="card-hd" style={{ flexDirection:'column', alignItems:'flex-start', gap:12 }}>
              <h3>Detailed Data</h3>
              <div style={{ display:'flex', gap:8 }}>
                {['bookings','users'].map(t => (
                  <button key={t} className={`btn btn-sm ${tab === t ? 'btn-primary' : 'btn-outline'}`}
                    onClick={() => setTab(t)} style={{ textTransform:'capitalize' }}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <div className="card-bd" style={{ paddingTop:8 }}>
              {tab === 'bookings' && (
                <div className="table-wrap" style={{ border:'none' }}>
                  <table>
                    <thead><tr><th>Team</th><th>Venue</th><th>Date</th><th>Amount</th><th>Status</th></tr></thead>
                    <tbody>
                      {bookings.length === 0 ? (
                        <tr><td colSpan={5} style={{ textAlign:'center', padding:'24px 0', color:'#8a96a8' }}>
                          {loading ? 'Loading…' : 'No bookings yet.'}
                        </td></tr>
                      ) : bookings.map(b => (
                        <tr key={b._id || b.id}>
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
              {tab === 'users' && (
                <div className="table-wrap" style={{ border:'none' }}>
                  <table>
                    <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th></tr></thead>
                    <tbody>
                      {users.length === 0 ? (
                        <tr><td colSpan={4} style={{ textAlign:'center', padding:'24px 0', color:'#8a96a8' }}>
                          {loading ? 'Loading…' : 'No users yet.'}
                        </td></tr>
                      ) : users.map(u => (
                        <tr key={u._id}>
                          <td style={{ fontWeight:700 }}>{u.name}</td>
                          <td style={{ fontSize:13, color:'#4a5568' }}>{u.email}</td>
                          <td><span className={`badge badge-${u.role==='admin'?'purple':u.role==='owner'?'info':'success'}`}>{u.role}</span></td>
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