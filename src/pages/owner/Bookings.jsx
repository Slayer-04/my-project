import React, { useState } from 'react'
import Sidebar from '../../components/Sidebar.jsx'
import Topbar  from '../../components/Topbar.jsx'
import { useAuth } from '../../App.jsx'

export default function Bookings() {
  const { bookings, setBookings, notifications, setNotifications } = useAuth()
  const [detail, setDetail] = useState(null)
  const [toast,  setToast]  = useState('')
  const [filter, setFilter] = useState('All')

  const toast$ = msg => { setToast(msg); setTimeout(() => setToast(''), 3000) }

  const acceptBooking = (notificationId, bookingId) => {
    // Update booking status to confirmed
    setBookings(l => l.map(b => b.id===bookingId ? {...b, status:'confirmed'} : b))
    
    // Remove notification
    setNotifications(n => n.filter(notif => notif.id !== notificationId))
    
    toast$('✅ Booking accepted and confirmed!')
  }

  const declineBooking = (notificationId, bookingId) => {
    // Update booking status to cancelled
    setBookings(l => l.map(b => b.id===bookingId ? {...b, status:'cancelled'} : b))
    
    // Remove notification
    setNotifications(n => n.filter(notif => notif.id !== notificationId))
    
    toast$('❌ Booking request declined!')
  }

  const confirm = id => {
    setBookings(l => l.map(b => b.id===id ? {...b, status:'confirmed'} : b))
    toast$('✅ Booking confirmed!')
  }
  const cancel = id => {
    setBookings(l => l.map(b => b.id===id ? {...b, status:'cancelled'} : b))
    setDetail(null)
  }

  const filtered = bookings.filter(b => filter==='All' || b.status===filter.toLowerCase())
  
  // Get pending booking request notifications
  const pendingRequests = notifications.filter(n => n.type === 'booking_request' && n.status === 'unread')

  const bdg = s => s==='confirmed'?'success': s==='pending'?'warning':'danger'

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-area">
        <Topbar title="Bookings" breadcrumb="Owner / Bookings" />
        <div className="page-inner">
          {toast && <div className="alert alert-success"><i className="fas fa-check-circle" />{toast}</div>}

          <div className="sec-hd anim-1">
            <div><h2>All Bookings</h2><p>Manage team reservations for your venue</p></div>
          </div>

          {/* Stats */}
          <div className="stats-row anim-2" style={{ gridTemplateColumns:'repeat(3,1fr)' }}>
            {[
              { lbl:'Total',     cls:'si-blue',   icon:'fa-clipboard-list', v: bookings.length },
              { lbl:'Confirmed', cls:'si-green',  icon:'fa-check-circle',   v: bookings.filter(b=>b.status==='confirmed').length },
              { lbl:'Pending',   cls:'si-orange', icon:'fa-clock',          v: bookings.filter(b=>b.status==='pending').length },
            ].map(s => (
              <div className="stat-card" key={s.lbl}>
                <div className={`stat-icon ${s.cls}`}><i className={`fas ${s.icon}`} /></div>
                <div><div className="stat-val">{s.v}</div><div className="stat-label">{s.lbl}</div></div>
              </div>
            ))}
          </div>

          {/* Pending Booking Requests */}
          {pendingRequests.length > 0 && (
            <div className="card anim-3" style={{ backgroundColor:'#fffbf0', borderLeft:'4px solid #ff9800' }}>
              <div style={{ padding:'16px', display:'flex', flexDirection:'column', gap:12 }}>
                <h3 style={{ color:'#ff9800', margin:0, display:'flex', alignItems:'center', gap:8 }}>
                  <i className="fas fa-bell" /> Pending Booking Requests
                </h3>
                {pendingRequests.map(req => (
                  <div key={req.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'12px', backgroundColor:'white', borderRadius:'8px', border:'1px solid #ffe0b2' }}>
                    <div>
                      <div style={{ fontWeight:700, fontSize:14 }}>{req.team} - {req.venue}</div>
                      <div style={{ fontSize:12, color:'#8a96a8', marginTop:4 }}>
                        📅 {req.date} at {req.time}
                      </div>
                      <div style={{ fontSize:12, color:'#555', marginTop:4 }}>{req.message}</div>
                    </div>
                    <div style={{ display:'flex', gap:8 }}>
                      <button 
                        className="btn btn-success btn-sm" 
                        onClick={() => acceptBooking(req.id, req.bookingId)}
                        style={{ backgroundColor:'var(--green)', borderColor:'var(--green)', color:'white' }}
                      >
                        <i className="fas fa-check" /> Accept
                      </button>
                      <button 
                        className="btn btn-danger btn-sm" 
                        onClick={() => declineBooking(req.id, req.bookingId)}
                      >
                        <i className="fas fa-times" /> Decline
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Filter */}
          <div className="filter-bar anim-3">
            {['All','Confirmed','Pending','Cancelled'].map(f => (
              <button
                key={f}
                className={`btn ${filter===f ? 'btn-primary' : 'btn-outline'} btn-sm`}
                onClick={() => setFilter(f)}
              >{f}</button>
            ))}
          </div>

          <div className="card anim-3">
            <div className="table-wrap" style={{ border:'none', borderRadius:0 }}>
              <table>
                <thead>
                  <tr>
                    <th>#</th><th>Team</th><th>Venue</th><th>Date</th><th>Time</th>
                    <th>Players</th><th>Amount</th><th>Status</th><th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(b => (
                    <tr key={b.id}>
                      <td style={{ color:'#8a96a8', fontWeight:700 }}>#{b.id}</td>
                      <td style={{ fontWeight:700 }}>{b.team}</td>
                      <td style={{ fontSize:13 }}>{b.venue}</td>
                      <td style={{ fontSize:13 }}>{b.date}</td>
                      <td style={{ fontSize:13 }}>{b.time}</td>
                      <td style={{ fontSize:13 }}>{b.players}</td>
                      <td style={{ fontWeight:700, color:'var(--green)' }}>{b.amount}</td>
                      <td><span className={`badge badge-${bdg(b.status)}`}>{b.status}</span></td>
                      <td>
                        <div style={{ display:'flex', gap:6 }}>
                          <button className="btn btn-ghost btn-sm" onClick={() => setDetail(b)}>
                            <i className="fas fa-eye" />
                          </button>
                          {b.status==='pending' && (
                            <button className="btn btn-primary btn-sm" onClick={() => confirm(b.id)}>
                              Confirm
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Detail Modal */}
      {detail && (
        <div className="modal-overlay" onClick={() => setDetail(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="modal-hd">
              <h3><i className="fas fa-clipboard-list" style={{ color:'var(--green)', marginRight:8 }} />Booking Details</h3>
              <button className="modal-close" onClick={() => setDetail(null)}><i className="fas fa-xmark" /></button>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              {[
                { lbl:'Team',    val: detail.team,   icon:'fa-users' },
                { lbl:'Venue',   val: detail.venue,  icon:'fa-building' },
                { lbl:'Date',    val: detail.date,   icon:'fa-calendar' },
                { lbl:'Time',    val: detail.time,   icon:'fa-clock' },
                { lbl:'Players', val: detail.players, icon:'fa-person-running' },
                { lbl:'Amount',  val: detail.amount, icon:'fa-tag' },
              ].map(r => (
                <div key={r.lbl} style={{ display:'flex', justifyContent:'space-between', padding:'9px 0', borderBottom:'1px solid #f0f4f8' }}>
                  <span style={{ fontSize:12, fontWeight:800, color:'#8a96a8', textTransform:'uppercase', display:'flex', alignItems:'center', gap:7 }}>
                    <i className={`fas ${r.icon}`} style={{ color:'var(--green)', width:14 }} />{r.lbl}
                  </span>
                  <span style={{ fontWeight:700, fontSize:13 }}>{r.val}</span>
                </div>
              ))}
              <div style={{ display:'flex', justifyContent:'space-between', padding:'9px 0' }}>
                <span style={{ fontSize:12, fontWeight:800, color:'#8a96a8', textTransform:'uppercase' }}>Status</span>
                <span className={`badge badge-${bdg(detail.status)}`}>{detail.status}</span>
              </div>
            </div>
            <div style={{ display:'flex', gap:10, marginTop:20 }}>
              {detail.status==='pending' && (
                <button className="btn btn-primary" style={{ flex:1 }} onClick={() => { confirm(detail.id); setDetail(null) }}>
                  <i className="fas fa-check" /> Confirm Booking
                </button>
              )}
              {detail.status!=='cancelled' && (
                <button className="btn btn-danger" onClick={() => cancel(detail.id)}>
                  Cancel
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
