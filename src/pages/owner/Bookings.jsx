import React, { useState, useEffect } from 'react'
import Sidebar from '../../components/Sidebar.jsx'
import Topbar  from '../../components/Topbar.jsx'
import { useAuth } from '../../App.jsx'
import { onBookingCreated, onBookingUpdated, onBookingCancelled } from '../../utils/socketService.js'
import { getApiBaseUrl } from '../../utils/apiConfig.js'

const API_BASE = getApiBaseUrl()

const mapBookingFromApi = booking => ({
  ...booking,
  id: booking.id || booking._id,
  venue: booking.venueId?.name || booking.venue,
})

export default function Bookings() {
  const { user, bookings, setBookings, setNotifications } = useAuth()
  const [detail, setDetail] = useState(null)
  const [toast,  setToast]  = useState('')
  const [filter, setFilter] = useState('All')
  const ownerVenueName = (user?.venueName || '').trim()
  const ownerEmail = (user?.email || '').trim().toLowerCase()
  const ownerName = (user?.name || '').trim()

  const toast$ = msg => { setToast(msg); setTimeout(() => setToast(''), 3000) }

  const refreshOwnerBookings = async () => {
    try {
      const params = new URLSearchParams()
      if (ownerVenueName) {
        params.set('venue', ownerVenueName)
      } else if (ownerEmail) {
        params.set('ownerEmail', ownerEmail)
      } else if (ownerName) {
        params.set('ownerName', ownerName)
      }

      if (![...params.keys()].length) return

      const response = await fetch(`${API_BASE}/bookings/owner?${params.toString()}`)
      if (!response.ok) return

      const data = await response.json()
      if (!Array.isArray(data)) return

      setBookings(data.map(mapBookingFromApi))
    } catch (_error) {
      // Keep current local state if API call fails.
    }
  }

  useEffect(() => {
    refreshOwnerBookings()
  }, [ownerEmail, ownerName, ownerVenueName])

  // Listen for real-time booking updates from other users
  useEffect(() => {
    // Listen for new bookings from other team members
    const unsubscribeCreate = onBookingCreated((bookingData) => {
      console.log('[Bookings] Received booking:created event:', bookingData)

      if (ownerVenueName && bookingData.venue !== ownerVenueName) {
        return
      }
      
      setBookings(prev => {
        const bookingExists = prev.some(b => b.id === bookingData.id)
        if (bookingExists) return prev

        toast$(`📌 New booking received: ${bookingData.team} at ${bookingData.venue}`)
        return [bookingData, ...prev]
      })
    })

    // Listen for booking updates (status changes)
    const unsubscribeUpdate = onBookingUpdated((updateData) => {
      console.log('[Bookings] Received booking:updated event:', updateData)
      
      setBookings(prev => 
        prev.map(b => b.id === updateData.id ? { ...b, ...updateData } : b)
      )
      toast$(`✏️ Booking updated: ${updateData.venue}`)
    })

    // Listen for booking cancellations
    const unsubscribeCancel = onBookingCancelled((cancelData) => {
      console.log('[Bookings] Received booking:cancelled event:', cancelData)
      
      setBookings(prev => 
        prev.map(b => b.id === cancelData.id ? { ...b, status: 'cancelled' } : b)
      )
      toast$(`❌ Booking cancelled: ${cancelData.venue}`)
    })

    // Cleanup listeners on unmount
    return () => {
      if (unsubscribeCreate) unsubscribeCreate()
      if (unsubscribeUpdate) unsubscribeUpdate()
      if (unsubscribeCancel) unsubscribeCancel()
    }
  }, [ownerVenueName, setBookings])

  const ownerBookings = bookings.filter(b => !ownerVenueName || b.venue === ownerVenueName)

  const parseTimeToMinutesOwner = (timeValue) => {
    if (!timeValue) return null
    const text = String(timeValue).trim()

    // Accept formats like "HH:MM AM" or "HH:MM PM".
    const is12Hour = /\b(AM|PM)\b/i.test(text)
    if (is12Hour) {
      const [timePart, meridiemRaw] = text.split(' ')
      if (!timePart || !meridiemRaw) return null

      const [hourRaw, minuteRaw] = timePart.split(':')
      let hour = Number(hourRaw)
      const minute = Number(minuteRaw)
      if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null

      const meridiem = meridiemRaw.toUpperCase()
      if (meridiem === 'PM' && hour !== 12) hour += 12
      if (meridiem === 'AM' && hour === 12) hour = 0
      return (hour * 60) + minute
    }

    // Accept formats like "HH:MM".
    const [hourRaw, minuteRaw] = text.split(':')
    const hour = Number(hourRaw)
    const minute = Number(minuteRaw)
    if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null
    return (hour * 60) + minute
  }

  const parseDateToYMD = (dateValue) => {
    if (!dateValue) return ''
    const text = String(dateValue).trim()
    if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text
    const d = new Date(text)
    if (Number.isNaN(d.getTime())) return text
    return d.toISOString().split('T')[0]
  }

  const isBookingExpired = (booking) => {
    if (!booking?.date || !booking?.time) return false

    const ymd = parseDateToYMD(booking.date)
    const minutesStart = parseTimeToMinutesOwner(booking.time)
    if (!ymd || minutesStart === null) return false

    // Slot duration is 1 hour in the UI.
    const slotEndMinutes = minutesStart + 60

    const [year, month, day] = ymd.split('-').map(Number)
    if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return false

    const endHours24 = Math.floor(slotEndMinutes / 60)
    const endMinutes = slotEndMinutes % 60
    const endDate = new Date(year, month - 1, day, endHours24, endMinutes, 0, 0)

    return endDate.getTime() <= Date.now()
  }

  const nonExpiredBookings = ownerBookings.filter(b => !isBookingExpired(b))


  const hasConfirmedConflict = (targetBooking, ignoreBookingId) => (
    bookings.some(b => (
      b.status === 'confirmed'
      && b.id !== ignoreBookingId
      && b.venue === targetBooking.venue
      && b.date === targetBooking.date
      && b.time === targetBooking.time
    ))
  )

  const acceptBooking = async (notificationId, bookingId) => {
    const acceptedBooking = bookings.find(b => b.id === bookingId)
    if (!acceptedBooking) {
      toast$('⛔ Booking not found.')
      return
    }

    if (ownerVenueName && acceptedBooking.venue !== ownerVenueName) {
      toast$('⛔ You can only accept bookings for your own futsal.')
      return
    }

    if (hasConfirmedConflict(acceptedBooking, bookingId)) {
      toast$('⛔ This slot is already confirmed. Duplicate acceptance blocked.')
      return
    }

    try {
      const response = await fetch(`${API_BASE}/bookings/${bookingId}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ownerEmail, ownerName }),
      })

      const result = await response.json()
      if (!response.ok) {
        toast$(`⛔ ${result.message || 'Failed to confirm booking.'}`)
        return
      }

      await refreshOwnerBookings()
    } catch (_error) {
      toast$('⛔ Could not connect to booking server. Please try again.')
      return
    }
    
    // Remove notification and auto-reject notifications for conflicting bookings
    setNotifications(prevNotifications => 
      prevNotifications.filter(notif => {
        // Keep the notification we're accepting
        if (notif.id === notificationId) return false
        
        // Remove notifications for conflicting bookings
        if (notif.type === 'booking_request'
            && notif.venue === acceptedBooking.venue
            && notif.date === acceptedBooking.date
            && notif.time === acceptedBooking.time) {
          return false
        }
        return true
      })
    )
    
    toast$('✅ Booking accepted! Other conflicting bookings auto-rejected.')
  }

  const declineBooking = async (notificationId, bookingId) => {
    const targetBooking = bookings.find(b => b.id === bookingId)
    if (targetBooking && ownerVenueName && targetBooking.venue !== ownerVenueName) {
      toast$('⛔ You can only decline bookings for your own futsal.')
      return
    }

    try {
      const response = await fetch(`${API_BASE}/bookings/${bookingId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ownerEmail, ownerName }),
      })

      const result = await response.json()
      if (!response.ok) {
        toast$(`⛔ ${result.message || 'Failed to decline booking.'}`)
        return
      }

      await refreshOwnerBookings()
    } catch (_error) {
      toast$('⛔ Could not connect to booking server. Please try again.')
      return
    }
    
    // Remove notification
    setNotifications(n => n.filter(notif => notif.id !== notificationId))
    
    toast$('❌ Booking request declined!')
  }

  const confirm = async id => {
    const confirmedBooking = bookings.find(b => b.id === id)
    if (!confirmedBooking) {
      toast$('⛔ Booking not found.')
      return
    }

    if (ownerVenueName && confirmedBooking.venue !== ownerVenueName) {
      toast$('⛔ You can only confirm bookings for your own futsal.')
      return
    }

    if (hasConfirmedConflict(confirmedBooking, id)) {
      toast$('⛔ This slot is already confirmed. Duplicate acceptance blocked.')
      return
    }

    try {
      const response = await fetch(`${API_BASE}/bookings/${id}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ownerEmail, ownerName }),
      })

      const result = await response.json()
      if (!response.ok) {
        toast$(`⛔ ${result.message || 'Failed to confirm booking.'}`)
        return
      }

      await refreshOwnerBookings()
    } catch (_error) {
      toast$('⛔ Could not connect to booking server. Please try again.')
      return
    }

    toast$('✅ Booking confirmed! Other conflicting bookings auto-rejected.')
  }
  const cancel = async id => {
    const targetBooking = bookings.find(b => b.id === id)
    if (targetBooking && ownerVenueName && targetBooking.venue !== ownerVenueName) {
      toast$('⛔ You can only cancel bookings for your own futsal.')
      return
    }

    try {
      const response = await fetch(`${API_BASE}/bookings/${id}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ownerEmail, ownerName }),
      })

      const result = await response.json()
      if (!response.ok) {
        toast$(`⛔ ${result.message || 'Failed to cancel booking.'}`)
        return
      }

      await refreshOwnerBookings()
    } catch (_error) {
      toast$('⛔ Could not connect to booking server. Please try again.')
      return
    }

    setDetail(null)
  }

  const filtered = nonExpiredBookings.filter(b => filter==='All' || b.status===filter.toLowerCase())
  
  // Build pending requests from server-backed bookings so owners can always act.
  const pendingRequests = nonExpiredBookings
    .filter(booking => booking.status === 'pending')

    .map(booking => ({
      id: booking.id,
      bookingId: booking.id,
      team: booking.team,
      venue: booking.venue,
      ownerName: booking.ownerName,
      ownerEmail: booking.ownerEmail,
      date: booking.date,
      time: booking.time,
      message: `${booking.team} requested ${booking.venue} on ${booking.date} at ${booking.time}`,
      unread: true,
    }))

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
              { lbl:'Total',     cls:'si-blue',   icon:'fa-clipboard-list', v: ownerBookings.length },
              { lbl:'Confirmed', cls:'si-green',  icon:'fa-check-circle',   v: ownerBookings.filter(b=>b.status==='confirmed').length },
              { lbl:'Pending',   cls:'si-orange', icon:'fa-clock',          v: ownerBookings.filter(b=>b.status==='pending').length },
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
                  <div key={req.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', padding:'12px', backgroundColor:'white', borderRadius:'8px', border:'1px solid #ffe0b2' }}>
                    <div style={{ flex:1 }}>
                      <div style={{ fontWeight:700, fontSize:14 }}>{req.team} - {req.venue}</div>
                      <div style={{ fontSize:12, color:'#8a96a8', marginTop:4 }}>
                        📅 {req.date} at {req.time}
                      </div>
                      <div style={{ fontSize:12, color:'#555', marginTop:4, marginBottom:8 }}>{req.message}</div>
                      <div style={{ backgroundColor:'#f5f5f5', padding:'8px', borderRadius:'4px', fontSize:11, color:'#333' }}>
                        <div><strong>📧 Email:</strong> {req.ownerEmail}</div>
                        <div><strong>👤 Owner:</strong> {req.ownerName}</div>
                        {req.ownerPhone && <div><strong>📱 Phone:</strong> {req.ownerPhone}</div>}
                      </div>
                    </div>
                    <div style={{ display:'flex', gap:8, marginLeft:12, flexShrink:0 }}>
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
                    <tr
                      key={b.id}
                      style={b.status === 'pending' ? { backgroundColor: '#fff8db' } : undefined}
                    >
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
