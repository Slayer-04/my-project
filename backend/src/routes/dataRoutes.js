const express = require('express')
const Booking = require('../models/Booking')
const Challenge = require('../models/Challenge')
const Match = require('../models/Match')
const Notification = require('../models/Notification')
const Venue = require('../models/Venue')
const User = require('../models/User')
const MatchResult = require('../models/MatchResult')

const router = express.Router()

const norm = value => (typeof value === 'string' ? value.trim() : '')

const getSlotQuery = booking => {
  if (booking.venueId) {
    return { venueId: booking.venueId, date: booking.date, time: booking.time }
  }

  return { venue: booking.venue, date: booking.date, time: booking.time }
}

const sameEmail = (left, right) => norm(left).toLowerCase() === norm(right).toLowerCase()

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

    const confirmedConflict = await Booking.findOne({
      ...(resolvedVenueId
        ? { venueId: resolvedVenueId }
        : { venue: resolvedVenueName }),
      date: normalizedDate,
      time: normalizedTime,
      status: 'confirmed',
    })

    if (confirmedConflict) {
      return res.status(409).json({ message: 'This slot is already confirmed for this venue.' })
    }

    const pendingDuplicate = await Booking.findOne({
      ...(resolvedVenueId
        ? { venueId: resolvedVenueId }
        : { venue: resolvedVenueName }),
      date: normalizedDate,
      time: normalizedTime,
      team: normalizedTeam,
      status: 'pending',
    })

    if (pendingDuplicate) {
      return res.status(409).json({ message: 'You already have a pending booking for this slot.' })
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
      amount: amount || 'Rs. 1,200',
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

    const cancelResult = await Booking.updateMany(
      {
        ...slotQuery,
        status: 'pending',
        _id: { $ne: booking._id },
      },
      { $set: { status: 'cancelled' } }
    )

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

    return res.status(201).json({ message: 'Challenge created successfully.', challenge })
  } catch (error) {
    return res.status(500).json({ message: 'Failed to create challenge.', error: error.message })
  }
})

router.patch('/challenges/:id', async (req, res) => {
  try {
    const challenge = await Challenge.findByIdAndUpdate(
      req.params.id,
      { $set: req.body, acceptedAt: req.body.status === 'accepted' ? new Date() : undefined },
      { new: true, runValidators: true }
    )

    if (!challenge) {
      return res.status(404).json({ message: 'Challenge not found.' })
    }

    return res.json({ message: 'Challenge updated successfully.', challenge })
  } catch (error) {
    return res.status(500).json({ message: 'Failed to update challenge.', error: error.message })
  }
})

/* ────────────────────────────────────────────────────────────────── */
/* MATCHES (RESULTS) ROUTES                                           */
/* ────────────────────────────────────────────────────────────────── */

router.get('/matches', async (_req, res) => {
  try {
    const matches = await Match.find({})
      .populate('bookingId')
      .sort({ createdAt: -1 })
    return res.json(matches)
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch matches.', error: error.message })
  }
})

router.get('/matches/team/:teamName', async (req, res) => {
  try {
    const matches = await Match.find({ team: req.params.teamName })
      .populate('bookingId')
      .sort({ createdAt: -1 })
    return res.json(matches)
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch team matches.', error: error.message })
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
    const notifications = await Notification.find({ team: req.params.teamName })
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
      type: type || 'general',
      challengeId: challengeId || null,
      bookingId: bookingId || null,
      unread: true,
      createdAt: new Date(),
    })

    return res.status(201).json({ message: 'Notification created.', notification })
  } catch (error) {
    return res.status(500).json({ message: 'Failed to create notification.', error: error.message })
  }
})

router.patch('/notifications/:id', async (req, res) => {
  try {
    const notification = await Notification.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true }
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
    const venues = await Venue.find({}).sort({ rating: -1 })
    return res.json(venues)
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
    const courtsRaw = ownerProfile.courts
    const courts = Number(courtsRaw)
    const phone = String(ownerProfile.phone || '').trim()
    const hours = String(ownerProfile.hours || '').trim()
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
      lat,
      lng,
      courts: Number.isFinite(courts) && courts >= 0 ? courts : 0,
      phone,
      hours,
      locationVerified: true,
    }
    user.profileCompleted = true
    await user.save()

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

    const result = await MatchResult.create({
      bookingId,
      team: team.trim(),
      opponent: opponent.trim(),
      myScore: Number(myScore),
      opponentScore: Number(opponentScore),
      matchDate: matchDate || new Date().toISOString().split('T')[0],
      matchTime: matchTime || '00:00',
      venue: venue ? venue.trim() : '',
      submittedBy: submittedBy ? submittedBy.trim() : '',
      timestamp: new Date(),
    })

    return res.status(201).json({ message: 'Match result submitted successfully.', result })
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

module.exports = router
