import React, { useMemo, useState, useEffect } from 'react'
import Sidebar from '../../components/Sidebar.jsx'
import Topbar  from '../../components/Topbar.jsx'
import { venues as mockVenues } from '../../data/mockData.js'
import { useAuth } from '../../App.jsx'
import { emitBookingCreate } from '../../utils/socketService.js'
import { getApiBaseUrl } from '../../utils/apiConfig.js'

const API_BASE = getApiBaseUrl()

const mapBookingFromApi = booking => ({
  ...booking,
  id: booking.id || booking._id,
  venue: booking.venueId?.name || booking.venue,
  date: booking.date ? booking.date.toString().split('T')[0] : booking.date,
  time: booking.time ? minutesToTimeLabel(parseTimeToMinutes(booking.time) ?? 0) : booking.time,
})

const parseTimeToMinutes = (timeValue) => {
  if (!timeValue) return null
  const text = String(timeValue).trim()
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

  const [hourRaw, minuteRaw] = text.split(':')
  const hour = Number(hourRaw)
  const minute = Number(minuteRaw)
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null
  return (hour * 60) + minute
}

const minutesToTimeLabel = (minutes) => {
  const normalized = Math.max(0, minutes)
  const hour24 = Math.floor(normalized / 60)
  const minute = normalized % 60
  const suffix = hour24 >= 12 ? 'PM' : 'AM'
  const displayHour = hour24 % 12 === 0 ? 12 : hour24 % 12
  return `${String(displayHour).padStart(2, '0')}:${String(minute).padStart(2, '0')} ${suffix}`
}

const normalizeDateId = value => {
  if (!value) return ''
  const text = String(value).trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text
  const parsed = new Date(text)
  if (Number.isNaN(parsed.getTime())) return text
  return parsed.toISOString().split('T')[0]
}

const normalizeSlotTime = value => {
  const minutes = parseTimeToMinutes(value)
  return minutes === null ? String(value || '').trim() : minutesToTimeLabel(minutes)
}

const toRupees = (value) => `Rs. ${Number(value || 0).toLocaleString('en-IN')}`

const getVenuePricing = (venue) => venue?.pricing || {
  weekdayDay: Number(venue?.pricePerHour) || 1200,
  weekdayEvening: Number(venue?.pricePerHour) || 1200,
  weekend: Number(venue?.pricePerHour) || 1200,
  eveningStart: '18:00',
}

const getVenueOperatingHours = (venue) => venue?.operatingHours || { open: '06:00', close: '22:00' }

const resolveBookingAmount = (venue, bookingDate, slot) => {
  const pricing = getVenuePricing(venue)
  const date = new Date(`${bookingDate}T00:00:00`)
  const isWeekend = !Number.isNaN(date.getTime()) && [0, 6].includes(date.getDay())
  const slotMinutes = parseTimeToMinutes(slot)
  const eveningStartMinutes = parseTimeToMinutes(pricing.eveningStart || '18:00') ?? (18 * 60)

  if (isWeekend) return pricing.weekend
  if (slotMinutes !== null && slotMinutes >= eveningStartMinutes) return pricing.weekdayEvening
  return pricing.weekdayDay
}

const mapVenueFromApi = (venue, index) => ({
  ...venue,
  id: venue.id || venue._id || `venue-${index + 1}`,
  name: String(venue.name || '').trim(),
  location: String(venue.location || '').trim(),
  rating: Number(venue.rating) || 0,
  price: venue.price || `Day ${toRupees(venue?.pricing?.weekdayDay || venue.pricePerHour || 1200)} · Evening ${toRupees(venue?.pricing?.weekdayEvening || venue.pricePerHour || 1200)} · Weekend ${toRupees(venue?.pricing?.weekend || venue.pricePerHour || 1200)}`,
  emoji: venue.emoji || '🏟️',
  type: venue.type || 'Indoor',
  pricing: venue.pricing || null,
  operatingHours: venue.operatingHours || null,
})

export default function BookFutsal() {
  const { user, bookings, setBookings, notifications, setNotifications } = useAuth()
  const [venueList, setVenueList] = useState(() => [])
  const [q,    setQ]   = useState('')
  const [type, setType]= useState('All')
  const [toast,setToast]= useState('')
  const [bookingVenue, setBookingVenue] = useState(null)
  const [selectedDayIndex, setSelectedDayIndex] = useState(0)
  const canManageTeam = user?.teamAccess !== 'basic' && user?.isCaptain !== false

  const toast$ = msg => { setToast(msg); setTimeout(() => setToast(''), 3000) }

  useEffect(() => {
    let active = true

    const seedVenues = []

    const mergeVenueLists = (liveVenues) => {
      const combined = Array.isArray(liveVenues) ? liveVenues : []
      const uniqueByVenue = [...new Map(combined.map(venue => [
        `${String(venue.name || '').toLowerCase()}|${String(venue.location || '').toLowerCase()}`,
        venue,
      ])).values()]

      return uniqueByVenue.sort((left, right) => {
        const leftCreated = new Date(left.createdAt || 0).getTime()
        const rightCreated = new Date(right.createdAt || 0).getTime()
        return rightCreated - leftCreated
      })
    }

    const loadVenues = async () => {
      try {
        const response = await fetch(`${API_BASE}/venues`)
        if (!response.ok) return

        const data = await response.json()
        if (!active || !Array.isArray(data)) return

        const mappedVenues = data.map(mapVenueFromApi)
        const mergedVenues = mergeVenueLists(mappedVenues)
        // Do not fall back to seeded venues. Only show venues returned by API (owner-linked).
        setVenueList(mergedVenues)
      } catch (_error) {
        if (!active) return
        // On error, show no venues rather than seeded mock venues.
        setVenueList([])
      }
    }

    const loadBookings = async () => {
      try {
        const response = await fetch(`${API_BASE}/bookings`)
        if (!response.ok) return

        const data = await response.json()
        if (!active || !Array.isArray(data)) return

        // Filter bookings to only include those for venues returned by the API.
        const mappedBookings = data.map(mapBookingFromApi)
        const availableVenueNames = new Set(mappedVenues ? mappedVenues.map(v => v.name) : [])
        const filtered = mappedBookings.filter(b => availableVenueNames.size === 0 ? false : availableVenueNames.has(b.venue))
        setBookings(filtered)
      } catch (_error) {
        // Keep existing local data when API is unavailable.
      }
    }

    loadVenues()
    loadBookings()

    const venueRefreshId = setInterval(loadVenues, 5000)

    const handleFocus = () => {
      loadVenues()
    }

    window.addEventListener('focus', handleFocus)

    return () => {
      active = false
      clearInterval(venueRefreshId)
      window.removeEventListener('focus', handleFocus)
    }
  }, [setBookings])

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

    const operatingHours = getVenueOperatingHours(bookingVenue)
    const openMinutes = parseTimeToMinutes(operatingHours.open) ?? (6 * 60)
    const closeMinutes = parseTimeToMinutes(operatingHours.close) ?? (22 * 60)

    const now = new Date()
    const todayId = now.toISOString().split('T')[0]
    const isToday = selectedBookingDate === todayId
    const nowMinutes = (now.getHours() * 60) + now.getMinutes()

    const times = []
    for (let slotMinutes = openMinutes; slotMinutes + 60 <= closeMinutes; slotMinutes += 60) {
      if (isToday && slotMinutes <= nowMinutes) continue

      times.push({ time: minutesToTimeLabel(slotMinutes), status: 'available' })
    }

    return times
  }, [bookingVenue, selectedBookingDate])

  const bookedSlotTimes = useMemo(() => {
    if (!bookingVenue || !selectedBookingDate) return new Set()

    const bookedTimes = bookings
      .filter(booking => (
        booking.status === 'confirmed'
        && booking.venue === bookingVenue.name
        && normalizeDateId(booking.date) === selectedBookingDate
      ))
      .map(booking => normalizeSlotTime(booking.time))

    return new Set(bookedTimes)
  }, [bookingVenue, bookings, selectedBookingDate])

  const pendingSlotTimes = useMemo(() => {
    if (!bookingVenue || !selectedBookingDate) return new Set()

    const pendingTimes = bookings
      .filter(booking => (
        booking.status === 'pending'
        && booking.venue === bookingVenue.name
        && normalizeDateId(booking.date) === selectedBookingDate
      ))
      .map(booking => normalizeSlotTime(booking.time))

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

  const book = async (venueObj, dayLabel, slot) => {
    if (!canManageTeam) {
      toast$('Only the captain can create bookings.')
      return
    }

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

    let bookingRecord = null

    try {
      const amount = toRupees(resolveBookingAmount(venueObj, bookingDate, slot))
      const response = await fetch(`${API_BASE}/bookings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          team: teamName,
          teamEmail: user?.email || '',
          venue: venueName,
          venueId: venueObj._id || null,
          ownerName: venueObj.owner || '',
          ownerEmail: venueObj.ownerEmail || '',
          date: bookingDate,
          time: slot,
          players: 8,
          amount,
        }),
      })

      const result = await response.json()
      if (!response.ok) {
        toast$(`⛔ ${result.message || 'Booking request failed.'}`)
        return
      }

      bookingRecord = mapBookingFromApi(result.booking)
      setBookings(prev => {
        const withoutDuplicate = prev.filter(b => b.id !== bookingRecord.id)
        return [bookingRecord, ...withoutDuplicate]
      })
    } catch (_error) {
      toast$('⛔ Could not connect to booking server. Please try again.')
      return
    }

    // Emit booking event to all connected users via WebSocket
    emitBookingCreate({
      id: bookingRecord.id,
      team: bookingRecord.team,
      venue: bookingRecord.venue,
      date: bookingRecord.date,
      time: bookingRecord.time,
      status: bookingRecord.status,
      players: bookingRecord.players,
      amount: bookingRecord.amount,
      email: user?.email,
    })

    // Send notification to futsal owner
    setNotifications(prev => ([
      {
        id: Date.now(),
        type: 'booking_request',
        bookingId: bookingRecord.id,
        team: teamName,
        venue: venueName,
        ownerName: venueObj.owner,
        ownerEmail: venueObj.ownerEmail,
        ownerPhone: venueObj.ownerPhone,
        date: bookingDate,
        time: slot,
        message: `${teamName} has requested to book ${venueName} on ${dayLabel} at ${slot}`,
        unread: true,
        createdAt: new Date().toISOString(),
      },
      ...prev,
    ]))

    toast$(`✅ Booking request sent to ${venueName} owner for approval!`)
  }

  const filtered = venueList.filter(v =>
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
