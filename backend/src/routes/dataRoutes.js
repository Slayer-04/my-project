const express = require('express')
const Booking = require('../models/Booking')
const Challenge = require('../models/Challenge')
const Match = require('../models/Match')
const Notification = require('../models/Notification')
const Venue = require('../models/Venue')
const User = require('../models/User')
const Team = require('../models/Team')
const MatchResult = require('../models/MatchResult')

const router = express.Router()

const norm = value => (typeof value === 'string' ? value.trim() : '')

const findTeamByAlias = async (alias) => {
  const value = norm(alias)
  if (!value) return null

  return Team.findOne({
    $or: [
      { teamName: value },
      { captainName: value },
    ],
  })
}

const calculateExpectedScore = (rating, opponentRating) => (
  1 / (1 + (10 ** ((opponentRating - rating) / 400)))
)

const calculateNewRating = (rating, opponentRating, score, kFactor = 32) => (
  Math.round(rating + (kFactor * (score - calculateExpectedScore(rating, opponentRating))))
)

const DEFAULT_PRICE_PLAN = {
  weekdayDay: 1200,
  weekdayEvening: 1500,
  weekend: 1800,
  eveningStart: '18:00',
}

const parseTimeToMinutes = (value) => {
  const text = norm(value)
  if (!text) return null

  const is12Hour = /\b(AM|PM)\b/i.test(text)
  if (is12Hour) {
    const [timePart, meridiemRaw] = text.split(' ')
    if (!timePart || !meridiemRaw) return null

    const [hourRaw, minuteRaw] = timePart.split(':')
    const hour = Number(hourRaw)
    const minute = Number(minuteRaw)
    if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null

    const meridiem = meridiemRaw.toUpperCase()
    let normalizedHour = hour
    if (meridiem === 'PM' && normalizedHour !== 12) normalizedHour += 12
    if (meridiem === 'AM' && normalizedHour === 12) normalizedHour = 0
    return (normalizedHour * 60) + minute
  }

  const [hourRaw, minuteRaw] = text.split(':')
  const hour = Number(hourRaw)
  const minute = Number(minuteRaw)
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null
  return (hour * 60) + minute
}

const formatRupees = (value) => `Rs. ${Number(value || 0).toLocaleString('en-IN')}`

const parsePricePlan = (ownerProfile = {}) => {
  const weekdayDay = Number(ownerProfile.weekdayPrice ?? ownerProfile.dayPrice ?? ownerProfile.pricePerHour)
  const weekdayEvening = Number(ownerProfile.eveningPrice ?? ownerProfile.nightPrice)
  const weekend = Number(ownerProfile.weekendPrice)
  const eveningStart = norm(ownerProfile.eveningStart) || DEFAULT_PRICE_PLAN.eveningStart

  return {
    weekdayDay: Number.isFinite(weekdayDay) && weekdayDay >= 0 ? weekdayDay : DEFAULT_PRICE_PLAN.weekdayDay,
    weekdayEvening: Number.isFinite(weekdayEvening) && weekdayEvening >= 0 ? weekdayEvening : DEFAULT_PRICE_PLAN.weekdayEvening,
    weekend: Number.isFinite(weekend) && weekend >= 0 ? weekend : DEFAULT_PRICE_PLAN.weekend,
    eveningStart,
  }
}

const parseOperatingHours = (ownerProfile = {}) => {
  const explicitOpen = norm(ownerProfile.operatingOpen)
  const explicitClose = norm(ownerProfile.operatingClose)
  const explicitHours = norm(ownerProfile.hours)
  const [parsedOpen, parsedClose] = explicitHours.includes('-')
    ? explicitHours.split('-').map(part => norm(part))
    : ['', '']

  return {
    open: explicitOpen || parsedOpen || '06:00',
    close: explicitClose || parsedClose || '22:00',
  }
}

const buildPriceSummary = (pricing) => (
  `Day ${formatRupees(pricing.weekdayDay)} · Evening ${formatRupees(pricing.weekdayEvening)} · Weekend ${formatRupees(pricing.weekend)}`
)

const resolveBookingAmount = (venue, dateValue, timeValue) => {
  const pricing = venue?.pricing || parsePricePlan(venue || {})
  const bookingDate = new Date(`${dateValue}T00:00:00`)
  const isWeekend = !Number.isNaN(bookingDate.getTime()) && [0, 6].includes(bookingDate.getDay())
  const timeMinutes = parseTimeToMinutes(timeValue)
  const eveningStartMinutes = parseTimeToMinutes(pricing.eveningStart || DEFAULT_PRICE_PLAN.eveningStart) ?? (18 * 60)

  if (isWeekend) return pricing.weekend
  if (timeMinutes !== null && timeMinutes >= eveningStartMinutes) return pricing.weekdayEvening
  return pricing.weekdayDay
}

const isBookingWithinOperatingHours = (venue, timeValue) => {
  const operatingHours = venue?.operatingHours || parseOperatingHours(venue || {})
  const startMinutes = parseTimeToMinutes(operatingHours.open)
  const endMinutes = parseTimeToMinutes(operatingHours.close)
  const timeMinutes = parseTimeToMinutes(timeValue)

  if (startMinutes === null || endMinutes === null || timeMinutes === null) return true

  return timeMinutes >= startMinutes && (timeMinutes + 60) <= endMinutes
}

const getSlotQuery = booking => {
  if (booking.venueId) {
    return { venueId: booking.venueId, date: booking.date, time: booking.time }
  }

  return { venue: booking.venue, date: booking.date, time: booking.time }
}

const sameEmail = (left, right) => norm(left).toLowerCase() === norm(right).toLowerCase()

const buildVenueFromOwnerProfile = (user, ownerProfile) => {
  const venueName = norm(ownerProfile.venueName)
  const location = norm(ownerProfile.location)
  const district = norm(ownerProfile.district)
  const courts = Math.max(1, Number(ownerProfile.courts) || 1)
  const phone = norm(ownerProfile.phone)
  const operatingHours = parseOperatingHours(ownerProfile)
  const pricing = parsePricePlan(ownerProfile)

  return {
    filter: { ownerEmail: norm(user.email).toLowerCase() || venueName },
    update: {
      name: venueName,
      location,
      rating: 4.5,
      price: buildPriceSummary(pricing),
      emoji: '🏟️',
      type: 'Indoor',
      courts,
      pricePerHour: pricing.weekdayDay,
      pricing,
      lat: Number(ownerProfile.lat),
      lng: Number(ownerProfile.lng),
      owner: norm(user.name),
      ownerEmail: norm(user.email).toLowerCase(),
      contactPhone: phone,
      operatingHours,
      amenities: district ? [district] : [],
    },
  }
}

const normalizeVenueRecord = venue => ({
  ...venue.toObject ? venue.toObject() : venue,
  id: venue._id || venue.id,
})

const buildVenueFromOwnerUser = user => {
  const ownerProfile = user.ownerProfile || {}
  const venueName = norm(ownerProfile.venueName)
  const location = norm(ownerProfile.location)
  if (!venueName || !location) return null

  return {
    id: user._id,
    _id: user._id,
    uid: String(user.venueUid || user._id),
    name: venueName,
    location,
    rating: 4.5,
    price: buildPriceSummary(parsePricePlan(ownerProfile)),
    emoji: '🏟️',
    type: 'Indoor',
    courts: Math.max(1, Number(ownerProfile.courts) || 1),
    pricePerHour: parsePricePlan(ownerProfile).weekdayDay,
    pricing: parsePricePlan(ownerProfile),
    lat: Number(ownerProfile.lat) || null,
    lng: Number(ownerProfile.lng) || null,
    owner: norm(user.name),
    ownerEmail: norm(user.email).toLowerCase(),
    contactPhone: norm(ownerProfile.phone),
    operatingHours: parseOperatingHours(ownerProfile),
    createdAt: user.updatedAt || user.createdAt || new Date(),
  }
}

const createBookingStatusNotification = async (booking, statusText) => {
  if (!booking?.team) return

  await Notification.create({
    team: booking.team,
    text: statusText,
    type: 'match-update',
    bookingId: booking._id,
    unread: true,
    createdAt: new Date(),
  })
}

/* ────────────────────────────────────────────────────────────────── */
/* BOOKINGS ROUTES                                                    */
/* ────────────────────────────────────────────────────────────────── */

router.get('/bookings', async (_req, res) => {
  try {
    const bookings = await Booking.find({})
      .populate('challengeId')
      .sort({ createdAt: -1 })
    return res.json(bookings)
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch bookings.', error: error.message })
  }
})

router.get('/bookings/team/:teamName', async (req, res) => {
  try {
    const bookings = await Booking.find({ team: req.params.teamName })
      .populate('challengeId')
      .sort({ createdAt: -1 })
    return res.json(bookings)
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch team bookings.', error: error.message })
  }
})

router.get('/bookings/owner', async (req, res) => {
  try {
    const ownerEmail = norm(req.query.ownerEmail).toLowerCase()
    const ownerName = norm(req.query.ownerName)
    const venue = norm(req.query.venue)
    const venueId = norm(req.query.venueId)

    if (!ownerEmail && !ownerName && !venue && !venueId) {
      return res.status(400).json({ message: 'ownerEmail, ownerName, venue, or venueId is required.' })
    }

    const filters = []
    if (venueId) filters.push({ venueId })
    if (venue) filters.push({ venue: { $regex: `^${venue.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}$`, $options: 'i' } })
    if (ownerEmail) filters.push({ ownerEmail })
    if (ownerName) {
      filters.push({ ownerName: { $regex: `^${ownerName.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}$`, $options: 'i' } })
    }

    const query = filters.length === 1 ? filters[0] : { $or: filters }

    const bookings = await Booking.find(query)
      .populate('challengeId')
      .populate('venueId')
      .sort({ createdAt: -1 })

    return res.json(bookings)
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch owner bookings.', error: error.message })
  }
})

router.post('/bookings', async (req, res) => {
  try {
    const {
      team,
      teamEmail,
      venue,
      venueId,
      ownerName,
      ownerEmail,
      date,
      time,
      status,
      players,
      amount,
      opponent,
      challengeId,
      note,
    } = req.body

    if (!team || !venue || !date || !time) {
      return res.status(400).json({ message: 'team, venue, date, time are required.' })
    }

    if (status === 'confirmed') {
      return res.status(400).json({ message: 'New bookings must start in pending state.' })
    }

    const normalizedTeam = norm(team)
    const normalizedVenue = norm(venue)
    const normalizedDate = norm(date)
    const normalizedTime = norm(time)

    let linkedVenue = null
    if (venueId) {
      linkedVenue = await Venue.findById(venueId)
    }
    if (!linkedVenue && normalizedVenue) {
      linkedVenue = await Venue.findOne({ name: normalizedVenue })
    }

    const resolvedVenueId = linkedVenue ? linkedVenue._id : (venueId || null)
    const resolvedVenueName = linkedVenue ? linkedVenue.name : normalizedVenue
    const resolvedOwnerName = norm(ownerName) || norm(linkedVenue?.owner)
    const resolvedOwnerEmail = norm(ownerEmail).toLowerCase() || norm(linkedVenue?.ownerEmail).toLowerCase()
    const canUseLinkedVenue = Boolean(linkedVenue)

    if (canUseLinkedVenue && !isBookingWithinOperatingHours(linkedVenue, normalizedTime)) {
      return res.status(400).json({ message: 'Selected time is outside the venue operating hours.' })
    }

    const computedAmount = canUseLinkedVenue
      ? formatRupees(resolveBookingAmount(linkedVenue, normalizedDate, normalizedTime))
      : norm(amount) || 'Rs. 1,200'

    const activeConflict = await Booking.findOne({
      ...(resolvedVenueId
        ? { venueId: resolvedVenueId }
        : { venue: resolvedVenueName }),
      date: normalizedDate,
      time: normalizedTime,
      status: { $in: ['pending', 'confirmed'] },
    })

    if (activeConflict) {
      return res.status(409).json({ message: 'This slot is already booked or pending for this venue.' })
    }

    const booking = await Booking.create({
      team: normalizedTeam,
      teamEmail: norm(teamEmail).toLowerCase(),
      venueId: resolvedVenueId,
      venue: resolvedVenueName,
      ownerName: resolvedOwnerName,
      ownerEmail: resolvedOwnerEmail,
      date: normalizedDate,
      time: normalizedTime,
      status: 'pending',
      players: players || 11,
      amount: computedAmount,
      opponent: opponent ? norm(opponent) : '',
      challengeId: challengeId || null,
      note: note ? norm(note) : '',
    })

    return res.status(201).json({ message: 'Booking created successfully.', booking })
  } catch (error) {
    return res.status(500).json({ message: 'Failed to create booking.', error: error.message })
  }
})

router.post('/bookings/:id/confirm', async (req, res) => {
  try {
    const ownerEmail = norm(req.body.ownerEmail).toLowerCase()
    const ownerName = norm(req.body.ownerName)

    const booking = await Booking.findById(req.params.id)
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found.' })
    }

    if (ownerEmail && booking.ownerEmail && !sameEmail(booking.ownerEmail, ownerEmail)) {
      return res.status(403).json({ message: 'You can only confirm bookings for your own venue.' })
    }

    if (ownerName && booking.ownerName && norm(booking.ownerName).toLowerCase() !== ownerName.toLowerCase()) {
      return res.status(403).json({ message: 'You can only confirm bookings for your own venue.' })
    }

    if (booking.status === 'confirmed') {
      return res.json({ message: 'Booking already confirmed.', booking })
    }

    const slotQuery = getSlotQuery(booking)
    const conflict = await Booking.findOne({
      ...slotQuery,
      status: 'confirmed',
      _id: { $ne: booking._id },
    })

    if (conflict) {
      return res.status(409).json({ message: 'This slot has already been confirmed for this venue.' })
    }

    booking.status = 'confirmed'
    await booking.save()

    await createBookingStatusNotification(
      booking,
      `${booking.ownerName || booking.venue} confirmed your booking for ${booking.date} at ${booking.time}.`
    )

    const cancelResult = await Booking.updateMany(
      {
        ...slotQuery,
        status: 'pending',
        _id: { $ne: booking._id },
      },
      { $set: { status: 'cancelled' } }
    )

    if (cancelResult.modifiedCount > 0) {
      const cancelledBookings = await Booking.find({
        ...slotQuery,
        status: 'cancelled',
        _id: { $ne: booking._id },
      })

      await Promise.all(cancelledBookings.map(cancelledBooking => createBookingStatusNotification(
        cancelledBooking,
        `${booking.ownerName || booking.venue} confirmed another booking for ${booking.date} at ${booking.time}. Your request for ${cancelledBooking.venue} was not accepted.`
      )))
    }

    return res.json({
      message: 'Booking confirmed successfully.',
      booking,
      autoCancelledCount: cancelResult.modifiedCount || 0,
    })
  } catch (error) {
    return res.status(500).json({ message: 'Failed to confirm booking.', error: error.message })
  }
})

router.post('/bookings/:id/cancel', async (req, res) => {
  try {
    const ownerEmail = norm(req.body.ownerEmail).toLowerCase()
    const ownerName = norm(req.body.ownerName)

    const booking = await Booking.findById(req.params.id)
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found.' })
    }

    if (ownerEmail && booking.ownerEmail && !sameEmail(booking.ownerEmail, ownerEmail)) {
      return res.status(403).json({ message: 'You can only cancel bookings for your own venue.' })
    }

    if (ownerName && booking.ownerName && norm(booking.ownerName).toLowerCase() !== ownerName.toLowerCase()) {
      return res.status(403).json({ message: 'You can only cancel bookings for your own venue.' })
    }

    if (booking.status === 'cancelled') {
      return res.json({ message: 'Booking already cancelled.', booking })
    }

    booking.status = 'cancelled'
    await booking.save()

    await createBookingStatusNotification(
      booking,
      `${booking.ownerName || booking.venue} declined your booking for ${booking.date} at ${booking.time}.`
    )

    return res.json({ message: 'Booking cancelled successfully.', booking })
  } catch (error) {
    return res.status(500).json({ message: 'Failed to cancel booking.', error: error.message })
  }
})

router.patch('/bookings/:id', async (req, res) => {
  try {
    if (req.body?.status === 'confirmed') {
      return res.status(400).json({ message: 'Use POST /bookings/:id/confirm to confirm a booking.' })
    }

    const booking = await Booking.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true }
    )
      .populate('challengeId')
      .populate('venueId')

    if (!booking) {
      return res.status(404).json({ message: 'Booking not found.' })
    }

    return res.json({ message: 'Booking updated successfully.', booking })
  } catch (error) {
    return res.status(500).json({ message: 'Failed to update booking.', error: error.message })
  }
})

router.delete('/bookings/:id', async (req, res) => {
  try {
    const booking = await Booking.findByIdAndDelete(req.params.id)
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found.' })
    }
    return res.json({ message: 'Booking deleted successfully.', booking })
  } catch (error) {
    return res.status(500).json({ message: 'Failed to delete booking.', error: error.message })
  }
})

/* ────────────────────────────────────────────────────────────────── */
/* CHALLENGES ROUTES                                                  */
/* ────────────────────────────────────────────────────────────────── */

router.get('/challenges', async (_req, res) => {
  try {
    const challenges = await Challenge.find({}).sort({ createdAt: -1 })
    return res.json(challenges)
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch challenges.', error: error.message })
  }
})

router.get('/challenges/team/:teamName', async (req, res) => {
  try {
    const teamName = req.params.teamName
    const challenges = await Challenge.find({
      $or: [{ from: teamName }, { to: teamName }],
    }).sort({ createdAt: -1 })
    return res.json(challenges)
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch team challenges.', error: error.message })
  }
})

router.post('/challenges', async (req, res) => {
  try {
    const { from, to, date, time, venue, status, note } = req.body

    if (!from || !to || !date || !time || !venue) {
      return res.status(400).json({ message: 'from, to, date, time, venue are required.' })
    }

    const challenge = await Challenge.create({
      from: from.trim(),
      to: to.trim(),
      date: date.trim(),
      time: time.trim(),
      venue: venue.trim(),
      status: status || 'pending',
      note: note ? note.trim() : '',
      sentAt: new Date(),
    })

    await Notification.create({
      team: to.trim(),
      text: `${from.trim()} sent you a match request for ${venue.trim()} on ${date.trim()} at ${time.trim()}.`,
      type: 'challenge-request',
      challengeId: challenge._id,
      unread: true,
      createdAt: new Date(),
    })

    return res.status(201).json({ message: 'Challenge created successfully.', challenge })
  } catch (error) {
    return res.status(500).json({ message: 'Failed to create challenge.', error: error.message })
  }
})

router.post('/matches', async (req, res) => {
  try {
    const { bookingId, team, opponent, venue, date, time, myScore, opponentScore, note } = req.body

    if (!bookingId || !team || !opponent || !venue || !date || !time) {
      return res.status(400).json({ message: 'bookingId, team, opponent, venue, date, time are required.' })
    }

    const myScoreNum = Number(myScore)
    const opponentScoreNum = Number(opponentScore)

    let result = 'draw'
    if (myScoreNum > opponentScoreNum) result = 'win'
    else if (myScoreNum < opponentScoreNum) result = 'loss'

    const match = await Match.create({
      bookingId,
      team: team.trim(),
      opponent: opponent.trim(),
      venue: venue.trim(),
      date: date.trim(),
      time: time.trim(),
      myScore: myScoreNum,
      opponentScore: opponentScoreNum,
      result,
      note: note ? note.trim() : '',
    })

    return res.status(201).json({ message: 'Match result recorded successfully.', match })
  } catch (error) {
    return res.status(500).json({ message: 'Failed to record match result.', error: error.message })
  }
})

/* ────────────────────────────────────────────────────────────────── */
/* NOTIFICATIONS ROUTES                                               */
/* ────────────────────────────────────────────────────────────────── */

router.get('/notifications/team/:teamName', async (req, res) => {
  try {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000)

    await Notification.deleteMany({ createdAt: { $lt: cutoff } })

    const notifications = await Notification.find({
      team: req.params.teamName,
      createdAt: { $gte: cutoff },
    })
      .populate('challengeId')
      .populate('bookingId')
      .sort({ createdAt: -1 })
    return res.json(notifications)
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch notifications.', error: error.message })
  }
})

router.post('/notifications', async (req, res) => {
  try {
    const { team, text, type, challengeId, bookingId } = req.body
    if (!team || !text) {
      return res.status(400).json({ message: 'team and text are required.' })
    }

    const notification = await Notification.create({
      team: team.trim(),
      text: text.trim(),
      type: type || 'info',
      challengeId: challengeId || null,
      bookingId: bookingId || null,
      unread: true,
      createdAt: new Date(),
    })

    return res.status(201).json({
      message: 'Notification created successfully.',
      notification,
    })
  } catch (error) {
    return res.status(500).json({ message: 'Failed to create notification.', error: error.message })
  }
})

router.patch('/notifications/:id', async (req, res) => {
  try {
    const notification = await Notification.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true }
    )

    if (!notification) {
      return res.status(404).json({ message: 'Notification not found.' })
    }

    return res.json({ message: 'Notification updated.', notification })
  } catch (error) {
    return res.status(500).json({ message: 'Failed to update notification.', error: error.message })
  }
})

/* ────────────────────────────────────────────────────────────────── */
/* VENUES ROUTES                                                      */
/* ────────────────────────────────────────────────────────────────── */

router.get('/venues', async (_req, res) => {
  try {
    const [venues, ownerUsers] = await Promise.all([
      Venue.find({}).sort({ createdAt: -1 }),
      User.find({ role: 'owner' }).select('name email ownerProfile venueUid updatedAt createdAt').sort({ updatedAt: -1 }),
    ])

    const mergedByKey = new Map()

    // Build a set of owner emails from owner users so we only include venues
    // that are associated with a real owner account.
    const ownerEmailSet = new Set(ownerUsers.map(u => String(u.email || '').toLowerCase()))

    venues.forEach(venue => {
      const normalized = normalizeVenueRecord(venue)
      const key = `${norm(normalized.name).toLowerCase()}|${norm(normalized.ownerEmail).toLowerCase()}`
      // Only include seeded venues if they have an ownerEmail that matches an owner user
      if (ownerEmailSet.has(String(normalized.ownerEmail || '').toLowerCase())) {
        mergedByKey.set(key, normalized)
      }
    })

    ownerUsers.forEach(user => {
      const derivedVenue = buildVenueFromOwnerUser(user)
      if (!derivedVenue) return

      const key = `${norm(derivedVenue.name).toLowerCase()}|${norm(derivedVenue.ownerEmail).toLowerCase()}`
      if (!mergedByKey.has(key)) {
        mergedByKey.set(key, derivedVenue)
      }
    })

    const mergedVenues = Array.from(mergedByKey.values()).sort((left, right) => {
      const leftCreated = new Date(left.createdAt || 0).getTime()
      const rightCreated = new Date(right.createdAt || 0).getTime()
      return rightCreated - leftCreated
    })

    return res.json(mergedVenues)
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch venues.', error: error.message })
  }
})

router.post('/venues', async (req, res) => {
  try {
    const { name, location, rating, price, type, courts, pricePerHour, lat, lng, owner, ownerEmail } = req.body

    if (!name || !location || !rating || !type || !courts) {
      return res.status(400).json({ message: 'name, location, rating, type, courts are required.' })
    }

    const venue = await Venue.create({
      name: name.trim(),
      location: location.trim(),
      rating: Number(rating),
      price: price || 'Rs. 1,200/hr',
      type,
      courts: Number(courts),
      pricePerHour: pricePerHour || 1200,
      lat: lat || null,
      lng: lng || null,
      owner: owner ? owner.trim() : '',
      ownerEmail: ownerEmail ? ownerEmail.trim().toLowerCase() : '',
    })

    return res.status(201).json({ message: 'Venue created successfully.', venue })
  } catch (error) {
    return res.status(500).json({ message: 'Failed to create venue.', error: error.message })
  }
})

router.patch('/venues/:id', async (req, res) => {
  try {
    const venue = await Venue.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true }
    )

    if (!venue) {
      return res.status(404).json({ message: 'Venue not found.' })
    }

    return res.json({ message: 'Venue updated successfully.', venue })
  } catch (error) {
    return res.status(500).json({ message: 'Failed to update venue.', error: error.message })
  }
})

router.delete('/venues/:id', async (req, res) => {
  try {
    const venue = await Venue.findByIdAndDelete(req.params.id)

    if (!venue) {
      return res.status(404).json({ message: 'Venue not found.' })
    }

    return res.json({ message: 'Venue deleted successfully.', venue })
  } catch (error) {
    return res.status(500).json({ message: 'Failed to delete venue.', error: error.message })
  }
})

/* ────────────────────────────────────────────────────────────────── */
/* USERS ROUTES                                                       */
/* ────────────────────────────────────────────────────────────────── */

router.post('/users/register', async (req, res) => {
  try {
    const { name, email, password, role } = req.body

    if (!name || !email || !password || !role) {
      return res.status(400).json({ message: 'name, email, password, role are required.' })
    }

    const existing = await User.findOne({ email: email.trim().toLowerCase() })
    if (existing) {
      return res.status(409).json({ message: 'User already exists.' })
    }

    const user = await User.create({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password, // TODO: Hash password before saving
      role,
      status: 'active',
    })

    return res.status(201).json({ message: 'User created successfully.', user })
  } catch (error) {
    return res.status(500).json({ message: 'Failed to create user.', error: error.message })
  }
})

router.get('/users', async (req, res) => {
  try {
    const role = String(req.query.role || '').trim().toLowerCase()
    const filter = {}
    if (role) filter.role = role

    const users = await User.find(filter).select('-password').sort({ name: 1 })
    return res.json(users)
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch users.', error: error.message })
  }
})

router.get('/users/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password')
    if (!user) {
      return res.status(404).json({ message: 'User not found.' })
    }
    return res.json(user)
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch user.', error: error.message })
  }
})

router.get('/users/email/:email', async (req, res) => {
  try {
    const email = String(req.params.email || '').trim().toLowerCase()
    if (!email) {
      return res.status(400).json({ message: 'Email is required.' })
    }

    const user = await User.findOne({ email }).select('-password')
    if (!user) {
      return res.status(404).json({ message: 'User not found.' })
    }

    return res.json(user)
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch user by email.', error: error.message })
  }
})

router.patch('/users/:id/profile', async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
    if (!user) {
      return res.status(404).json({ message: 'User not found.' })
    }

    if (user.role !== 'owner') {
      return res.status(400).json({ message: 'Only owner profiles can be updated via this endpoint.' })
    }

    const ownerProfile = req.body?.ownerProfile || {}
    const venueName = String(ownerProfile.venueName || '').trim()
    const location = String(ownerProfile.location || '').trim()
    const district = String(ownerProfile.district || '').trim()
    const courtsRaw = ownerProfile.courts
    const courts = Number(courtsRaw)
    const phone = String(ownerProfile.phone || '').trim()
    const hours = String(ownerProfile.hours || '').trim()
    const operatingOpen = String(ownerProfile.operatingOpen || hours.split('-')[0] || '06:00').trim()
    const operatingClose = String(ownerProfile.operatingClose || hours.split('-')[1] || '22:00').trim()
    const pricing = parsePricePlan(ownerProfile)
    const lat = Number(ownerProfile.lat)
    const lng = Number(ownerProfile.lng)

    if (!venueName || !location) {
      return res.status(400).json({ message: 'venueName and location are required.' })
    }

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return res.status(400).json({ message: 'Exact map coordinates (lat/lng) are required.' })
    }

    user.ownerProfile = {
      venueName,
      location,
      district: district || location,
      lat,
      lng,
      courts: Number.isFinite(courts) && courts >= 0 ? courts : 0,
      phone,
      hours: `${operatingOpen}-${operatingClose}`,
      operatingHours: {
        open: operatingOpen,
        close: operatingClose,
      },
      pricing,
      locationVerified: true,
    }
    user.profileCompleted = true
    await user.save()

    const { filter, update } = buildVenueFromOwnerProfile(user, user.ownerProfile)
    let venue = await Venue.findOne(filter)
    if (!venue) {
      venue = await Venue.create(update)
    } else {
      Object.assign(venue, update)
      await venue.save()
    }

    return res.json({
      message: 'Owner profile updated.',
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        profileCompleted: user.profileCompleted,
        ownerProfile: user.ownerProfile,
      },
      venue,
    })
  } catch (error) {
    return res.status(500).json({ message: 'Failed to update owner profile.', error: error.message })
  }
})

/* ────────────────────────────────────────────────────────────────── */
/* MATCH RESULTS ROUTES                                               */
/* ────────────────────────────────────────────────────────────────── */

router.post('/match-results', async (req, res) => {
  try {
    const { bookingId, team, opponent, myScore, opponentScore, matchDate, matchTime, venue, submittedBy } = req.body

    if (!bookingId || !team || !opponent || myScore === undefined || opponentScore === undefined) {
      return res.status(400).json({ message: 'bookingId, team, opponent, myScore, opponentScore are required.' })
    }

    const submittedTeamName = norm(team)
    const opponentTeamName = norm(opponent)
    const myScoreNum = Number(myScore)
    const opponentScoreNum = Number(opponentScore)

    let matchOutcome = 'draw'
    if (myScoreNum > opponentScoreNum) matchOutcome = 'win'
    else if (myScoreNum < opponentScoreNum) matchOutcome = 'loss'

    const [submittingTeam, opponentTeam] = await Promise.all([
      findTeamByAlias(submittedTeamName),
      findTeamByAlias(opponentTeamName),
    ])

    const submittingTeamRating = Number(submittingTeam?.eloRating ?? 1000)
    const opponentTeamRating = Number(opponentTeam?.eloRating ?? 1000)
    const submittingScore = matchOutcome === 'win' ? 1 : matchOutcome === 'loss' ? 0 : 0.5
    const opponentScoreForElo = 1 - submittingScore

    if (submittingTeam) {
      submittingTeam.eloRating = calculateNewRating(submittingTeamRating, opponentTeamRating, submittingScore)
      submittingTeam.eloMatchesPlayed = Number(submittingTeam.eloMatchesPlayed ?? 0) + 1
      submittingTeam.matchesWon = Number(submittingTeam.matchesWon ?? 0) + (matchOutcome === 'win' ? 1 : 0)
      submittingTeam.matchesLost = Number(submittingTeam.matchesLost ?? 0) + (matchOutcome === 'loss' ? 1 : 0)
      submittingTeam.currentStreak = matchOutcome === 'win'
        ? Math.max(0, Number(submittingTeam.currentStreak ?? 0)) + 1
        : matchOutcome === 'loss'
          ? Math.min(0, Number(submittingTeam.currentStreak ?? 0)) - 1
          : 0
    }

    if (opponentTeam) {
      opponentTeam.eloRating = calculateNewRating(opponentTeamRating, submittingTeamRating, opponentScoreForElo)
      opponentTeam.eloMatchesPlayed = Number(opponentTeam.eloMatchesPlayed ?? 0) + 1
      opponentTeam.matchesWon = Number(opponentTeam.matchesWon ?? 0) + (matchOutcome === 'loss' ? 1 : 0)
      opponentTeam.matchesLost = Number(opponentTeam.matchesLost ?? 0) + (matchOutcome === 'win' ? 1 : 0)
      opponentTeam.currentStreak = matchOutcome === 'loss'
        ? Math.max(0, Number(opponentTeam.currentStreak ?? 0)) + 1
        : matchOutcome === 'win'
          ? Math.min(0, Number(opponentTeam.currentStreak ?? 0)) - 1
          : 0
    }

    const saveOperations = []
    if (submittingTeam) saveOperations.push(submittingTeam.save())
    if (opponentTeam && opponentTeam !== submittingTeam) saveOperations.push(opponentTeam.save())

    if (saveOperations.length > 0) {
      await Promise.all(saveOperations)
    }

    const matchResult = await MatchResult.create({
      bookingId,
      team: submittedTeamName,
      opponent: opponentTeamName,
      myScore: myScoreNum,
      opponentScore: opponentScoreNum,
      matchDate: matchDate || new Date().toISOString().split('T')[0],
      matchTime: matchTime || '00:00',
      venue: venue ? venue.trim() : '',
      submittedBy: submittedBy ? submittedBy.trim() : submittedTeamName,
      timestamp: new Date(),
    })

    return res.status(201).json({
      message: 'Match result submitted successfully.',
      result: matchResult,
      updatedTeam: submittingTeam ? {
        id: submittingTeam._id,
        teamName: submittingTeam.teamName,
        captainName: submittingTeam.captainName,
        eloRating: submittingTeam.eloRating,
        eloMatchesPlayed: submittingTeam.eloMatchesPlayed,
        matchesWon: submittingTeam.matchesWon,
        matchesLost: submittingTeam.matchesLost,
        currentStreak: submittingTeam.currentStreak,
      } : null,
      updatedOpponentTeam: opponentTeam ? {
        id: opponentTeam._id,
        teamName: opponentTeam.teamName,
        captainName: opponentTeam.captainName,
        eloRating: opponentTeam.eloRating,
        eloMatchesPlayed: opponentTeam.eloMatchesPlayed,
        matchesWon: opponentTeam.matchesWon,
        matchesLost: opponentTeam.matchesLost,
        currentStreak: opponentTeam.currentStreak,
      } : null,
    })
  } catch (error) {
    return res.status(500).json({ message: 'Failed to submit match result.', error: error.message })
  }
})

router.get('/match-results/booking/:bookingId', async (req, res) => {
  try {
    const results = await MatchResult.find({ bookingId: req.params.bookingId })
    return res.json(results)
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch match results.', error: error.message })
  }
})

router.get('/match-results', async (_req, res) => {
  try {
    const results = await MatchResult.find({}).sort({ createdAt: -1 })
    return res.json(results)
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch all match results.', error: error.message })
  }
})

// ═══════════════════════════════════════════════════════════════════
// ADD THIS BLOCK to dataRoutes.js
// Place it BEFORE the final `module.exports = router` line
// ═══════════════════════════════════════════════════════════════════

router.patch('/challenges/:id', async (req, res) => {
try {
  const challenge = await Challenge.findById(req.params.id)
  if (!challenge) {
    return res.status(404).json({ message: 'Challenge not found.' })
  }

  const newStatus = req.body.status

  // When accepting a challenge, create confirmed bookings for both teams
  if (newStatus === 'accepted' && challenge.status !== 'accepted') {
    const fromTeam = norm(challenge.from)
    const toTeam   = norm(challenge.to)

    // Guard: never create a self-match
    if (fromTeam.toLowerCase() === toTeam.toLowerCase()) {
      return res.status(400).json({ message: 'Cannot create a match between the same team.' })
    }

    // Check if bookings already exist for this slot to prevent duplicates
    const existingBooking = await Booking.findOne({
      date:   challenge.date,
      time:   challenge.time,
      venue:  challenge.venue,
      status: { $ne: 'cancelled' },
      $or: [
        { team: fromTeam, opponent: toTeam },
        { team: toTeam,   opponent: fromTeam },
      ],
    })

    if (!existingBooking) {
      const bookingBase = {
        date:        challenge.date,
        time:        challenge.time,
        venue:       challenge.venue,
        status:      'confirmed',
        players:     11,
        amount:      'Rs. 1,200',
        challengeId: challenge._id,
      }
      await Promise.all([
        Booking.create({ ...bookingBase, team: toTeam,   opponent: fromTeam }),
        Booking.create({ ...bookingBase, team: fromTeam, opponent: toTeam   }),
      ])
    }

    // Notify the challenger that their challenge was accepted
    await Notification.create({
      team:        fromTeam,
      text:        `${toTeam} accepted your challenge! Match on ${challenge.date} at ${challenge.time} (${challenge.venue}).`,
      type:        'match-update',
      challengeId: challenge._id,
      unread:      true,
      createdAt:   new Date(),
    })
  }

  // Update allowed fields
  const allowedUpdates = ['status', 'date', 'time', 'venue', 'note']
  allowedUpdates.forEach(field => {
    if (req.body[field] !== undefined) {
      challenge[field] = typeof req.body[field] === 'string'
        ? req.body[field].trim()
        : req.body[field]
    }
  })
  await challenge.save()

  return res.json({ message: 'Challenge updated successfully.', challenge })
} catch (error) {
  return res.status(500).json({ message: 'Failed to update challenge.', error: error.message })
}
})

module.exports = router