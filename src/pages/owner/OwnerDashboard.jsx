import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Sidebar from '../../components/Sidebar.jsx'
import Topbar  from '../../components/Topbar.jsx'
import { useAuth } from '../../App.jsx'
import { scheduleData } from '../../data/mockData.js'
import { getApiBaseUrl } from '../../utils/apiConfig.js'

const DAYS  = ['M','T','W','T','F','S','S']
const API_BASE = getApiBaseUrl()

const normalize = value => (typeof value === 'string' ? value.trim() : '')
const sameEmail = (left, right) => normalize(left).toLowerCase() === normalize(right).toLowerCase()

const mapBookingFromApi = booking => ({
  ...booking,
  id: booking.id || booking._id,
  venue: booking.venueId?.name || booking.venue,
})

const parseAmount = amount => {
  if (typeof amount === 'number') return Number.isFinite(amount) ? amount : 0
  if (typeof amount !== 'string') return 0
  const numeric = Number(amount.replace(/[^\d.]/g, ''))
  return Number.isFinite(numeric) ? numeric : 0
}

const isSameDay = (left, right) => (
  left.getFullYear() === right.getFullYear()
  && left.getMonth() === right.getMonth()
  && left.getDate() === right.getDate()
)

const weekStartMonday = date => {
  const copy = new Date(date)
  const day = (copy.getDay() + 6) % 7
  copy.setHours(0, 0, 0, 0)
  copy.setDate(copy.getDate() - day)
  return copy
}

const formatCurrency = value => `Rs. ${Math.round(value).toLocaleString('en-IN')}`

export default function OwnerDashboard() {
  const { user, bookings }  = useAuth()
  const navigate  = useNavigate()
  const [ownerBookings, setOwnerBookings] = useState([])

  const ownerVenueName = normalize(user?.venueName)
  const ownerEmail = normalize(user?.email).toLowerCase()
  const ownerName = normalize(user?.name)

  useEffect(() => {
    const fallback = bookings.filter(booking => {
      if (ownerVenueName && normalize(booking.venue) === ownerVenueName) return true
      if (ownerEmail && sameEmail(booking.ownerEmail, ownerEmail)) return true
      if (ownerName && normalize(booking.ownerName).toLowerCase() === ownerName.toLowerCase()) return true
      return false
    })

    let active = true

    const fetchOwnerBookings = async () => {
      try {
        const params = new URLSearchParams()
        if (ownerVenueName) {
          params.set('venue', ownerVenueName)
        } else if (ownerEmail) {
          params.set('ownerEmail', ownerEmail)
        } else if (ownerName) {
          params.set('ownerName', ownerName)
        }

        if (![...params.keys()].length) {
          if (active) setOwnerBookings(fallback)
          return
        }

        const response = await fetch(`${API_BASE}/bookings/owner?${params.toString()}`)
        if (!response.ok) {
          if (active) setOwnerBookings(fallback)
          return
        }

        const data = await response.json()
        if (!active) return

        if (Array.isArray(data)) {
          setOwnerBookings(data.map(mapBookingFromApi))
          return
        }

        setOwnerBookings(fallback)
      } catch (_error) {
        if (active) setOwnerBookings(fallback)
      }
    }

    fetchOwnerBookings()

    return () => {
      active = false
    }
  }, [bookings, ownerEmail, ownerName, ownerVenueName])

  const today = useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  }, [])

  const confirmed = ownerBookings.filter(b => b.status==='confirmed').length
  const pending = ownerBookings.filter(b => b.status==='pending').length
  const todaysConfirmed = ownerBookings.filter(b => {
    if (b.status !== 'confirmed' || !b.date) return false
    const bookingDate = new Date(b.date)
    if (Number.isNaN(bookingDate.getTime())) return false
    return isSameDay(bookingDate, today)
  }).length
  const availableSlots = scheduleData[0].slots.filter(slot => slot.status === 'available').length

  const revenueMetrics = useMemo(() => {
    const now = new Date()
    const thisWeekStart = weekStartMonday(now)
    const nextWeekStart = new Date(thisWeekStart)
    nextWeekStart.setDate(thisWeekStart.getDate() + 7)

    const lastWeekStart = new Date(thisWeekStart)
    lastWeekStart.setDate(thisWeekStart.getDate() - 7)

    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const dayTotals = [0, 0, 0, 0, 0, 0, 0]
    let weekRevenue = 0
    let monthRevenue = 0
    let lastWeekRevenue = 0

    ownerBookings.forEach(booking => {
      if (booking.status !== 'confirmed' || !booking.date) return
      const bookingDate = new Date(booking.date)
      if (Number.isNaN(bookingDate.getTime())) return

      const amount = parseAmount(booking.amount)
      if (amount <= 0) return

      if (bookingDate >= thisMonthStart && bookingDate <= now) {
        monthRevenue += amount
      }

      if (bookingDate >= thisWeekStart && bookingDate < nextWeekStart) {
        weekRevenue += amount
        const dayIndex = (bookingDate.getDay() + 6) % 7
        dayTotals[dayIndex] += amount
      }

      if (bookingDate >= lastWeekStart && bookingDate < thisWeekStart) {
        lastWeekRevenue += amount
      }
    })

    const growth = lastWeekRevenue === 0
      ? (weekRevenue > 0 ? 100 : 0)
      : ((weekRevenue - lastWeekRevenue) / lastWeekRevenue) * 100

    return { dayTotals, weekRevenue, monthRevenue, growth }
  }, [ownerBookings])

  const maxDailyRevenue = Math.max(...revenueMetrics.dayTotals, 0)

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
              { icon:'fa-clipboard-list', cls:'si-green',  val:ownerBookings.length, lbl:'Total Bookings',    sub:'All time' },
              { icon:'fa-calendar-day',   cls:'si-blue',   val:todaysConfirmed, lbl:"Today's Confirmed", sub:ownerVenueName || 'Your venue' },
              { icon:'fa-clock',          cls:'si-orange', val:pending,         lbl:'Pending Approvals', sub:'Needs review' },
              { icon:'fa-door-open',      cls:'si-purple', val:availableSlots,  lbl:'Available Slots',   sub:'Today' },
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
              {ownerBookings.slice(0,5).map(b => (
                <div key={b.id} style={{ padding:'13px 22px', borderBottom:'1px solid #f0f4f8', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <div>
                    <div style={{ fontWeight:700, fontSize:13 }}>{b.team}</div>
                    <div style={{ fontSize:11, color:'#4a5568', marginTop:2 }}>{b.date} · {b.time}</div>
                  </div>
                  <span className={`badge badge-${b.status==='confirmed'?'success': b.status==='pending'?'warning':'danger'}`}>{b.status}</span>
                </div>
              ))}
              {ownerBookings.length === 0 && (
                <div style={{ padding:'20px 22px', color:'#8a96a8', fontSize:13 }}>
                  No bookings yet.
                </div>
              )}
            </div>
          </div>

          {/* Revenue */}
          <div className="card anim-4" style={{ marginTop:22 }}>
            <div className="card-hd"><h3>Weekly Revenue</h3></div>
            <div className="card-bd">
              <div style={{ display:'flex', alignItems:'flex-end', gap:6, height:100 }}>
                {revenueMetrics.dayTotals.map((dailyRevenue, i) => {
                  const heightPercent = maxDailyRevenue === 0 ? 0 : Math.round((dailyRevenue / maxDailyRevenue) * 100)
                  const isActive = dailyRevenue > 0
                  return (
                  <div key={i} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:5, height:'100%', justifyContent:'flex-end' }}>
                    <div
                      style={{ width:'100%', height:`${heightPercent}%`, minHeight:6, borderRadius:'5px 5px 0 0',
                               background: isActive ? 'var(--green)' : 'var(--green-light)',
                               transition:'background .2s', cursor:'pointer' }}
                      onMouseEnter={e => e.target.style.background='var(--green)'}
                      onMouseLeave={e => { if(!isActive) e.target.style.background='var(--green-light)' }}
                    />
                    <div style={{ fontSize:10, color:'#8a96a8', fontWeight:700 }}>{DAYS[i]}</div>
                  </div>
                )})}
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10, marginTop:18, padding:14, background:'#f8fafc', borderRadius:10 }}>
                {[
                  { lbl:'This Week',   val:formatCurrency(revenueMetrics.weekRevenue),  c:'var(--green)' },
                  { lbl:'This Month',  val:formatCurrency(revenueMetrics.monthRevenue), c:'var(--blue)' },
                  { lbl:'Growth',      val:`${revenueMetrics.growth >= 0 ? '+' : ''}${Math.round(revenueMetrics.growth)}%`, c:'var(--purple)' },
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
