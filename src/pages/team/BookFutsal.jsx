import React, { useMemo, useState } from 'react'
import Sidebar from '../../components/Sidebar.jsx'
import Topbar  from '../../components/Topbar.jsx'
import { venues } from '../../data/mockData.js'
import { useAuth } from '../../App.jsx'
import { emitBookingCreate } from '../../utils/socketService.js'

export default function BookFutsal() {
  const { user, bookings, setBookings, notifications, setNotifications } = useAuth()
  const [q,    setQ]   = useState('')
  const [type, setType]= useState('All')
  const [toast,setToast]= useState('')
  const [bookingVenue, setBookingVenue] = useState(null)
  const [selectedDayIndex, setSelectedDayIndex] = useState(0)

  const toast$ = msg => { setToast(msg); setTimeout(() => setToast(''), 3000) }

  const bookingDays = useMemo(() => {
    const dayFormatter = new Intl.DateTimeFormat('en-US', { weekday: 'long' })
    const dateFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' })
    const today = new Date()

    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(today)
      date.setDate(today.getDate() + index)

      return {
        id: date.toISOString().split('T')[0],
        label: index === 0 ? 'Today' : dayFormatter.format(date),
        dateLabel: dateFormatter.format(date),
        date,
      }
    })
  }, [])

  const parseTimeToMinutes = (timeValue) => {
    if (!timeValue) return null
    const [timePart, meridiemRaw] = timeValue.trim().split(' ')
    if (!timePart || !meridiemRaw) return null

    const [hRaw, mRaw] = timePart.split(':')
    let hour = Number(hRaw)
    const minute = Number(mRaw)
    if (Number.isNaN(hour) || Number.isNaN(minute)) return null

    const meridiem = meridiemRaw.toUpperCase()
    if (meridiem === 'PM' && hour !== 12) hour += 12
    if (meridiem === 'AM' && hour === 12) hour = 0
    return (hour * 60) + minute
  }

  const selectedBookingDate = bookingDays[selectedDayIndex]?.id || ''

  const openSlotsForVenue = useMemo(() => {
    if (!bookingVenue) return []

    const now = new Date()
    const todayId = now.toISOString().split('T')[0]
    const isToday = selectedBookingDate === todayId
    const nowMinutes = (now.getHours() * 60) + now.getMinutes()

    const times = []
    for (let hour = 6; hour <= 22; hour += 1) {
      if (isToday) {
        const slotMinutes = hour * 60
        if (slotMinutes <= nowMinutes) continue
      }

      const suffix = hour >= 12 ? 'PM' : 'AM'
      const displayHour = hour % 12 === 0 ? 12 : hour % 12
      times.push({ time: `${String(displayHour).padStart(2, '0')}:00 ${suffix}`, status: 'available' })
    }

    return times
  }, [bookingVenue, selectedBookingDate])

  const bookedSlotTimes = useMemo(() => {
    if (!bookingVenue || !selectedBookingDate) return new Set()

    const bookedTimes = bookings
      .filter(booking => (
        booking.status === 'confirmed'
        && booking.venue === bookingVenue.name
        && booking.date === selectedBookingDate
      ))
      .map(booking => booking.time)

    return new Set(bookedTimes)
  }, [bookingVenue, bookings, selectedBookingDate])

  const pendingSlotTimes = useMemo(() => {
    if (!bookingVenue || !selectedBookingDate) return new Set()

    const pendingTimes = bookings
      .filter(booking => (
        booking.status === 'pending'
        && booking.venue === bookingVenue.name
        && booking.date === selectedBookingDate
      ))
      .map(booking => booking.time)

    return new Set(pendingTimes)
  }, [bookingVenue, bookings, selectedBookingDate])

  const openSlotCount = openSlotsForVenue.filter(slot => (
    !bookedSlotTimes.has(slot.time) && !pendingSlotTimes.has(slot.time)
  )).length

  const openBookingModal = venue => {
    setBookingVenue(venue)
    setSelectedDayIndex(0)
  }

  const closeBookingModal = () => {
    setBookingVenue(null)
    setSelectedDayIndex(0)
  }

  const book = (venueObj, dayLabel, slot) => {
    const bookingDate = bookingDays[selectedDayIndex].id
    const teamName = user?.teamInfo?.name || user?.teamInfo?.teamName || user?.teamName || 'My Team'
    const todayId = new Date().toISOString().split('T')[0]
    const venueName = venueObj.name

    if (bookedSlotTimes.has(slot)) {
      toast$(`⛔ ${slot} on ${dayLabel} is already booked.`)
      return
    }

    const hasPendingBooking = bookings.some(booking => (
      booking.status === 'pending'
      && booking.venue === venueName
      && booking.date === bookingDate
      && booking.time === slot
    ))

    if (hasPendingBooking) {
      toast$(`⏳ ${slot} on ${dayLabel} is pending owner confirmation.`)
      return
    }

    const hasConfirmedBooking = bookings.some(booking => (
      booking.status === 'confirmed'
      && booking.venue === venueName
      && booking.date === bookingDate
      && booking.time === slot
    ))

    if (hasConfirmedBooking) {
      toast$(`⛔ ${slot} on ${dayLabel} is already confirmed for another team.`)
      return
    }

    if (bookingDate === todayId) {
      const now = new Date()
      const nowMinutes = (now.getHours() * 60) + now.getMinutes()
      const slotMinutes = parseTimeToMinutes(slot)
      if (slotMinutes !== null && slotMinutes <= nowMinutes) {
        toast$(`⛔ ${slot} has already passed. Please choose a future slot.`)
        return
      }
    }

    const confirmed = window.confirm(`Confirm booking for ${dayLabel} at ${slot} in ${venueName}?`)

    if (!confirmed) {
      return
    }

    const bookingId = Date.now()

    setBookings(prev => ([
      {
        id: bookingId,
        team: teamName,
        venue: venueName,
        date: bookingDate,
        time: slot,
        status: 'pending',
        players: 8,
        amount: 'Rs. 1,200',
      },
      ...prev,
    ]))

    // Emit booking event to all connected users via WebSocket
    emitBookingCreate({
      id: bookingId,
      team: teamName,
      venue: venueName,
      date: bookingDate,
      time: slot,
      status: 'pending',
      players: 8,
      amount: 'Rs. 1,200',
      email: user?.email,
    })

    // Send notification to futsal owner
    setNotifications(prev => ([
      {
        id: Date.now(),
        type: 'booking_request',
        bookingId,
        team: teamName,
        venue: venueName,
        ownerName: venueObj.owner,
        ownerEmail: venueObj.ownerEmail,
        ownerPhone: venueObj.ownerPhone,
        date: bookingDate,
        time: slot,
        message: `${teamName} has requested to book ${venueName} on ${dayLabel} at ${slot}`,
        status: 'unread',
        createdAt: new Date().toISOString(),
      },
      ...prev,
    ]))

    toast$(`✅ Booking request sent to ${venueName} owner for approval!`)
  }

  const filtered = venues.filter(v =>
    v.name.toLowerCase().includes(q.toLowerCase()) &&
    (type==='All' || v.type===type)
  )

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-area">
        <Topbar title="Book Futsal" breadcrumb="Team / Book Futsal" />
        <div className="page-inner">
          {toast && <div className="alert alert-success"><i className="fas fa-check-circle" />{toast}</div>}

          <div className="sec-hd anim-1">
            <div><h2>Futsal Venues</h2><p>Browse courts and book your preferred time slot</p></div>
          </div>

          <div className="filter-bar anim-2">
            <div className="search-wrap" style={{ maxWidth:320 }}>
              <i className="fas fa-search" />
              <input placeholder="Search venues…" value={q} onChange={e => setQ(e.target.value)} />
            </div>
            <select className="form-control" style={{ width:'auto' }} value={type} onChange={e => setType(e.target.value)}>
              <option value="All">All Types</option>
              <option>Indoor</option>
              <option>Outdoor</option>
            </select>
          </div>

          <div className="venue-grid">
            {filtered.map((v, i) => (
              <div key={v.id} className={`venue-card anim-${Math.min(i+1,5)}`}>
                <div className="vc-img">
                  {v.emoji}
                  <span className="vc-type-tag">{v.type}</span>
                </div>
                <div className="vc-body">
                  <h3>{v.name}</h3>
                  <div className="vc-loc"><i className="fas fa-location-dot" />{v.location}</div>

                  <div style={{ display:'flex', gap:16, marginBottom:12 }}>
                    <div style={{ fontSize:13, fontWeight:700 }}>
                      <i className="fas fa-star" style={{ color:'#eab308', marginRight:4 }} />{v.rating}
                    </div>
                    <div style={{ fontSize:13, fontWeight:800, color:'var(--green)' }}>
                      <i className="fas fa-tag" style={{ marginRight:4 }} />{v.price}
                    </div>
                  </div>

                  <div style={{ fontSize:11, fontWeight:800, color:'#8a96a8', textTransform:'uppercase', letterSpacing:.5, marginBottom:8 }}>
                    Available Slots
                  </div>
                  <button
                    className="btn btn-primary btn-full btn-sm"
                    onClick={() => openBookingModal(v)}
                  >
                    <i className="fas fa-calendar-check" />
                    Book a Slot
                  </button>
                </div>
              </div>
            ))}
          </div>

          {bookingVenue && (
            <div className="booking-modal-overlay" role="dialog" aria-modal="true" aria-label="Select a booking day and slot">
              <div className="booking-modal">
                <div className="booking-modal-hd">
                  <div className="booking-modal-title">
                    <h3>{bookingVenue.name}</h3>
                    <div className="booking-modal-sub">
                      Select a day from today onward, then pick an open slot to continue.
                    </div>
                  </div>
                  <button className="modal-close" onClick={closeBookingModal} aria-label="Close booking modal">
                    <i className="fas fa-xmark" />
                  </button>
                </div>

                <div className="booking-modal-body">
                  <div className="booking-day-rail">
                    <div className="booking-rail-label">Choose a day</div>
                    <div className="booking-day-list">
                      {bookingDays.map((day, index) => (
                        <button
                          key={day.id}
                          className={`booking-day-chip ${selectedDayIndex === index ? 'active' : ''}`}
                          onClick={() => setSelectedDayIndex(index)}
                        >
                          <span>{day.label}</span>
                          <small>{day.dateLabel}</small>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="booking-slot-panel">
                    <div className="booking-slot-head">
                      <div>
                        <h4>{bookingDays[selectedDayIndex].label}</h4>
                        <p>{bookingDays[selectedDayIndex].dateLabel} • 1-hour open slots for {bookingVenue.name}</p>
                      </div>
                      <span className="badge badge-info">
                        {openSlotCount} slots open
                      </span>
                    </div>

                    {openSlotCount === 0 ? (
                      <div className="empty-state" style={{ margin: 0 }}>
                        <i className="fas fa-calendar-xmark" />
                        <h3>No open slots</h3>
                        <p>This venue has no available slots right now.</p>
                      </div>
                    ) : (
                      <div className="booking-slot-grid">
                        {openSlotsForVenue.map(slot => {
                          const isConfirmed = bookedSlotTimes.has(slot.time)
                          const isPending = pendingSlotTimes.has(slot.time)
                          const isDisabled = isConfirmed || isPending
                          return (
                          <button
                            key={`${bookingVenue.id}-${selectedDayIndex}-${slot.time}`}
                            className={`booking-slot-card ${isConfirmed ? 'booked' : isPending ? 'pending' : ''}`}
                            disabled={isDisabled}
                            onClick={() => book(bookingVenue, bookingDays[selectedDayIndex].label, slot.time)}
                          >
                            <strong>{slot.time}</strong>
                            <span>
                              {isConfirmed ? '❌ Booked' : isPending ? '⏳ Pending' : 'Tap to book'}
                            </span>
                          </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
