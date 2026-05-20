import React, { useMemo, useState, useEffect } from 'react'
import Sidebar from '../../components/Sidebar.jsx'
import Topbar  from '../../components/Topbar.jsx'
import { useAuth } from '../../App.jsx'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

const HOUR_SLOTS = Array.from({ length: 17 }, (_, index) => {
  const hour = index + 6
  const suffix = hour >= 12 ? 'PM' : 'AM'
  const displayHour = hour % 12 === 0 ? 12 : hour % 12
  return `${String(displayHour).padStart(2, '0')}:00 ${suffix}`
})

const mapBookingFromApi = booking => ({
  ...booking,
  id: booking.id || booking._id,
  venue: booking.venueId?.name || booking.venue,
})

const toDateId = dateValue => {
  if (!dateValue) return ''
  if (typeof dateValue === 'string') {
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) return dateValue
    const parsed = new Date(dateValue)
    if (Number.isNaN(parsed.getTime())) return ''
    return parsed.toISOString().split('T')[0]
  }

  const parsed = new Date(dateValue)
  if (Number.isNaN(parsed.getTime())) return ''
  return parsed.toISOString().split('T')[0]
}

const toSlotTime = value => {
  if (!value) return ''
  if (/^\d{2}:\d{2}\s(?:AM|PM)$/.test(value)) return value

  const [hourPart, minutePart] = value.split(':')
  const hourNum = Number(hourPart)
  const minuteNum = Number(minutePart)
  if (Number.isNaN(hourNum) || Number.isNaN(minuteNum)) return ''

  const suffix = hourNum >= 12 ? 'PM' : 'AM'
  const displayHour = hourNum % 12 === 0 ? 12 : hourNum % 12
  return `${String(displayHour).padStart(2, '0')}:${String(minuteNum).padStart(2, '0')} ${suffix}`
}

export default function Schedule() {
  const { user, bookings, setBookings } = useAuth()
  const [toast, setToast] = useState('')
  const [modal, setModal] = useState(false)
  const [nSlot, setNSlot] = useState({ day:0, time:'' })
  const [blockedSlots, setBlockedSlots] = useState(() => {
    try {
      const stored = localStorage.getItem('fotmatch-owner-blocked-slots')
      return stored ? JSON.parse(stored) : []
    } catch (_error) {
      return []
    }
  })

  const ownerVenueName = (user?.venueName || '').trim()
  const ownerEmail = (user?.email || '').trim().toLowerCase()
  const ownerName = (user?.name || '').trim()

  const toast$ = msg => { setToast(msg); setTimeout(() => setToast(''), 3000) }

  const persistBlockedSlots = nextBlocked => {
    setBlockedSlots(nextBlocked)
    try {
      localStorage.setItem('fotmatch-owner-blocked-slots', JSON.stringify(nextBlocked))
    } catch (_error) {
      // Keep schedule usable even when local storage is unavailable.
    }
  }

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

  const scheduleDays = useMemo(() => {
    const weekdayFormatter = new Intl.DateTimeFormat('en-US', { weekday: 'long' })
    const dateFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' })
    const today = new Date()

    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(today)
      date.setDate(today.getDate() + index)
      const dateId = date.toISOString().split('T')[0]

      return {
        id: dateId,
        day: `${weekdayFormatter.format(date)}, ${dateFormatter.format(date)}`,
      }
    })
  }, [])

  const ownerBookings = useMemo(
    () => bookings.filter(booking => !ownerVenueName || booking.venue === ownerVenueName),
    [bookings, ownerVenueName]
  )

  const bookingSlotMap = useMemo(() => {
    const map = new Map()

    ownerBookings.forEach(booking => {
      if (booking.status === 'cancelled') return

      const dateId = toDateId(booking.date)
      if (!dateId) return
      const key = `${dateId}|${booking.time}`
      map.set(key, {
        status: booking.status,
        team: booking.team,
      })
    })

    return map
  }, [ownerBookings])

  const blockedSlotSet = useMemo(() => {
    const next = new Set()
    blockedSlots.forEach(slot => {
      if (!slot?.date || !slot?.time) return
      next.add(`${slot.date}|${slot.time}`)
    })
    return next
  }, [blockedSlots])

  const sched = useMemo(() => (
    scheduleDays.map(day => ({
      ...day,
      slots: HOUR_SLOTS.map(time => {
        const key = `${day.id}|${time}`
        const bookingInfo = bookingSlotMap.get(key)

        if (bookingInfo) {
          return {
            date: day.id,
            time,
            status: 'booked',
            team: bookingInfo.status === 'pending'
              ? `${bookingInfo.team} (pending)`
              : bookingInfo.team,
          }
        }

        if (blockedSlotSet.has(key)) {
          return { date: day.id, time, status: 'blocked' }
        }

        return { date: day.id, time, status: 'available' }
      }),
    }))
  ), [bookingSlotMap, blockedSlotSet, scheduleDays])

  const cycle = (di, si) => {
    const day = sched[di]
    const slot = day?.slots?.[si]

    if (!slot || slot.status === 'booked') return

    const key = `${slot.date}|${slot.time}`
    if (slot.status === 'available') {
      persistBlockedSlots([...blockedSlots, { date: slot.date, time: slot.time }])
      return
    }

    persistBlockedSlots(blockedSlots.filter(item => `${item.date}|${item.time}` !== key))
  }

  const addSlot = () => {
    if (!nSlot.time) return

    const selectedDay = scheduleDays[nSlot.day]
    if (!selectedDay) return

    const normalizedTime = toSlotTime(nSlot.time)
    if (!normalizedTime) {
      toast$('⛔ Invalid slot time.')
      return
    }

    const key = `${selectedDay.id}|${normalizedTime}`

    const alreadyBooked = bookingSlotMap.has(key)
    if (alreadyBooked) {
      toast$('⛔ This slot already has a booking request.')
      return
    }

    const alreadyBlocked = blockedSlotSet.has(key)
    if (!alreadyBlocked) {
      persistBlockedSlots([...blockedSlots, { date: selectedDay.id, time: normalizedTime }])
    }

    setModal(false)
    setNSlot({ day:0, time:'' })
    toast$('✅ Slot blocked in schedule!')
  }

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-area">
        <Topbar title="Schedule Management" breadcrumb="Owner / Schedule" />
        <div className="page-inner">
          {toast && <div className="alert alert-success"><i className="fas fa-check-circle" />{toast}</div>}

          <div className="sec-hd anim-1">
            <div>
              <h2>Weekly Schedule</h2>
              <p>Live slots are synced with bookings. Pending and confirmed bookings are locked.</p>
            </div>
            <button className="btn btn-primary" onClick={() => setModal(true)}>
              <i className="fas fa-plus" /> Add Slot
            </button>
          </div>

          {/* Legend */}
          <div style={{ display:'flex', gap:18, marginBottom:20, flexWrap:'wrap' }} className="anim-2">
            {[
              { lbl:'Available', c:'var(--green)',  bg:'var(--green-light)' },
              { lbl:'Booked',    c:'var(--red)',    bg:'var(--red-light)' },
              { lbl:'Blocked',   c:'#8a96a8',       bg:'#f4f4f4' },
            ].map(l => (
              <div key={l.lbl} style={{ display:'flex', alignItems:'center', gap:7, fontSize:12, fontWeight:800, color:l.c }}>
                <div style={{ width:12, height:12, borderRadius:3, background:l.bg, border:`2px solid ${l.c}` }} />
                {l.lbl}
              </div>
            ))}
          </div>

          <div className="schedule-stack">
            {sched.map((day, di) => (
              <div key={di} className={`sched-day anim-${Math.min(di+1,4)}`}>
                <div className="sched-day-hd">
                  <i className="fas fa-calendar-day" style={{ color:'var(--green)' }} />
                  {day.day}
                  <span className="sched-count">
                    {day.slots.filter(s=>s.status==='available').length} available
                  </span>
                </div>
                <div className="sched-slots">
                  {day.slots.map((slot, si) => (
                    <div
                      key={si}
                      className={`sched-slot ${slot.status}`}
                      onClick={() => cycle(di, si)}
                      title={slot.team ? `Booked: ${slot.team}` : `Click to ${slot.status==='available'?'block':'unblock'}`}
                    >
                      {slot.time}
                      {slot.team && <div className="sched-slot-team">{slot.team}</div>}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {modal && (
        <div className="modal-overlay" onClick={() => setModal(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="modal-hd">
              <h3><i className="fas fa-plus-circle" style={{ color:'var(--green)', marginRight:8 }} />Add New Slot</h3>
              <button className="modal-close" onClick={() => setModal(false)}><i className="fas fa-xmark" /></button>
            </div>
            <div className="form-group">
              <label className="form-label">Day</label>
              <select className="form-control" value={nSlot.day} onChange={e => setNSlot({...nSlot,day:+e.target.value})}>
                {sched.map((d,i) => <option key={i} value={i}>{d.day}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Time</label>
              <input type="time" className="form-control" value={nSlot.time} onChange={e => setNSlot({...nSlot,time:e.target.value})} />
            </div>
            <div style={{ display:'flex', gap:10 }}>
              <button className="btn btn-primary" style={{ flex:1 }} onClick={addSlot}>
                <i className="fas fa-plus" /> Add Slot
              </button>
              <button className="btn btn-outline" onClick={() => setModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
