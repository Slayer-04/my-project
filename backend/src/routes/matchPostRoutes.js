const express = require('express')
const mongoose = require('mongoose')
const MatchPost = require('../models/MatchPost')
const Booking = require('../models/Booking')
const Challenge = require('../models/Challenge')
const Notification = require('../models/Notification')
const Venue = require('../models/Venue')
const { isSlotTaken, expirePostsForSlot, sweepExpiredMatchPosts, resolveVenueName, getVenueOwnerInfo, notifyVenueOwnerOfMatch } = require('../utils/slotAvailability')

const router = express.Router()

const norm = value => (typeof value === 'string' ? value.trim() : '')

const validateString = (value, label) => {
  if (typeof value !== 'string' || !value.trim()) {
    return `${label} is required.`
  }
  return null
}

/**
 * Run `fn(session)` inside a MongoDB transaction if the underlying deployment
 * supports one (replica set / Atlas). Standalone MongoDB instances (common in
 * local dev) do not support multi-document transactions at all, so we detect
 * that specific failure and re-run `fn(null)` without a session instead. The
 * critical "only one booking can win a slot" guarantee still holds in that
 * fallback path because it is enforced by the unique index on Booking, not by
 * the transaction itself — the transaction is an extra layer of atomicity for
 * the *other* writes (challenge/post/notification updates), not the last line
 * of defense.
 */
const runWithOptionalTransaction = async (fn) => {
  const session = await mongoose.startSession()
  try {
    let result
    await session.withTransaction(async () => {
      result = await fn(session)
    })
    return result
  } catch (error) {
    const message = String(error?.message || '')
    const unsupported = message.includes('Transaction numbers')
      || message.includes('replica set')
      || message.includes('IllegalOperation')
      || error?.code === 20

    if (!unsupported) throw error

    // Fall back to running the same steps without a session/transaction.
    return fn(null)
  } finally {
    await session.endSession()
  }
}

/* ────────────────────────────────────────────────────────────────── */
/* GET /match-posts - list active posts (sweeps stale ones first)     */
/* ────────────────────────────────────────────────────────────────── */
router.get('/match-posts', async (_req, res) => {
  try {
    await sweepExpiredMatchPosts()

    const posts = await MatchPost.find({ status: { $in: ['open', 'requested'] } })
      .sort({ createdAt: -1 })

    return res.json(posts)
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch match posts.', error: error.message })
  }
})

/* ────────────────────────────────────────────────────────────────── */
/* POST /match-posts - create a post, only for a currently-open slot  */
/* ────────────────────────────────────────────────────────────────── */
router.post('/match-posts', async (req, res) => {
  try {
    const requiredFields = ['team', 'venue', 'date', 'time']
    for (const field of requiredFields) {
      const error = validateString(req.body[field], field)
      if (error) return res.status(400).json({ message: error })
    }

    const team = norm(req.body.team)
    const rawVenue = norm(req.body.venue)
    const date = norm(req.body.date)
    const time = norm(req.body.time)
    const players = Number(req.body.players) || 8
    const note = norm(req.body.note)
    const visibilityHours = Number(req.body.visibilityHours) || 24

    // Reject a date/time that's already in the past. The client hides these
    // from the picker, but that's just UI convenience — never trust it alone.
    const parsedSlot = new Date(`${date} ${time}`)
    if (!Number.isNaN(parsedSlot.getTime()) && parsedSlot.getTime() <= Date.now()) {
      return res.status(400).json({ message: 'That date and time has already passed. Please choose a future slot.' })
    }

    // Resolve to the venue's canonical name FIRST. Without this, a post
    // created against "Name - Location" (as typed in the autocomplete) would
    // never be recognised as the same venue as a booking stored under just
    // "Name" - the two flows would silently never see each other's slots.
    const venue = await resolveVenueName(rawVenue)

    // Server-side availability check — never trust the client's slot picker alone.
    if (await isSlotTaken({ venue, date, time })) {
      return res.status(409).json({ message: `${time} on ${date} at ${venue} is already booked. Please choose another slot.` })
    }

    let venueId = null
    const linkedVenue = await Venue.findOne({ name: venue })
    if (linkedVenue) venueId = linkedVenue._id

    const post = await MatchPost.create({
      team, venue, venueId, date, time, players, note, visibilityHours, status: 'open',
    })

    return res.status(201).json({ message: 'Match post created successfully.', matchPost: post })
  } catch (error) {
    return res.status(500).json({ message: 'Failed to create match post.', error: error.message })
  }
})

/* ────────────────────────────────────────────────────────────────── */
/* POST /match-posts/:id/request - another team requests this post    */
/* ────────────────────────────────────────────────────────────────── */
router.post('/match-posts/:id/request', async (req, res) => {
  try {
    const requesterTeam = norm(req.body.requestedBy)
    const error = validateString(requesterTeam, 'requestedBy')
    if (error) return res.status(400).json({ message: error })

    const post = await MatchPost.findById(req.params.id)
    if (!post) return res.status(404).json({ message: 'Match post not found.' })

    if (requesterTeam.toLowerCase() === post.team.toLowerCase()) {
      return res.status(400).json({ message: 'You cannot request your own post.' })
    }

    if (post.status !== 'open') {
      return res.status(409).json({ message: 'This post is no longer open for requests.' })
    }

    // Re-check the slot right now: it may have been booked by someone else
    // since this post was created.
    if (await isSlotTaken({ venue: post.venue, date: post.date, time: post.time })) {
      post.status = 'expired'
      await post.save()
      return res.status(409).json({ message: 'That slot has just been booked and is no longer available.' })
    }

    const from = requesterTeam
    const to = post.team
    const pairKey = [from.toLowerCase(), to.toLowerCase()].sort().join('::')

    const existingPending = await Challenge.findOne({ pairKey, status: 'pending' })
    if (existingPending) {
      return res.status(409).json({
        message: `There is already a pending match request between ${existingPending.from} and ${existingPending.to}. Wait for a response before sending another.`,
      })
    }

    let challenge
    try {
      challenge = await Challenge.create({
        from, to,
        date: post.date, time: post.time, venue: post.venue,
        status: 'pending',
        note: post.note || 'Challenge request from Find Match.',
        pairKey,
      })
    } catch (error) {
      if (error && error.code === 11000) {
        // Two simultaneous requests raced past the findOne check above —
        // the DB-level unique index on { pairKey, status: 'pending' } is
        // what actually stops the duplicate from being created.
        return res.status(409).json({
          message: 'There is already a pending match request between these two teams. Wait for a response before sending another.',
        })
      }
      throw error
    }

    post.status = 'requested'
    post.requestedBy = from
    post.challengeId = challenge._id
    await post.save()

    await Notification.create({
      team: to,
      text: `${from} sent you a match request for ${post.venue} on ${post.date} at ${post.time}.`,
      type: 'challenge-request',
      challengeId: challenge._id,
      unread: true,
      createdAt: new Date(),
    })

    return res.json({ message: 'Request sent.', matchPost: post, challenge })
  } catch (error) {
    return res.status(500).json({ message: 'Failed to request match post.', error: error.message })
  }
})

/* ────────────────────────────────────────────────────────────────── */
/* POST /match-posts/:id/decline - poster declines the pending request*/
/* ────────────────────────────────────────────────────────────────── */
router.post('/match-posts/:id/decline', async (req, res) => {
  try {
    const post = await MatchPost.findById(req.params.id)
    if (!post) return res.status(404).json({ message: 'Match post not found.' })

    if (post.status !== 'requested') {
      return res.status(409).json({ message: 'This post has no pending request to decline.' })
    }

    if (post.challengeId) {
      await Challenge.findByIdAndUpdate(post.challengeId, { $set: { status: 'declined' } })
    }

    const stillAvailable = !(await isSlotTaken({ venue: post.venue, date: post.date, time: post.time }))

    post.status = stillAvailable ? 'open' : 'expired'
    post.requestedBy = null
    post.challengeId = null
    await post.save()

    return res.json({ message: 'Request declined.', matchPost: post })
  } catch (error) {
    return res.status(500).json({ message: 'Failed to decline match post request.', error: error.message })
  }
})

/* ────────────────────────────────────────────────────────────────── */
/* POST /match-posts/:id/accept - THE key transactional endpoint.     */
/* Verifies the slot is still free, books it for both teams, confirms */
/* the challenge, and removes the post — all atomically.              */
/* ────────────────────────────────────────────────────────────────── */
router.post('/match-posts/:id/accept', async (req, res) => {
  try {
    const outcome = await runWithOptionalTransaction(async (session) => {
      const postQuery = MatchPost.findById(req.params.id)
      const post = session ? await postQuery.session(session) : await postQuery

      if (!post) {
        return { status: 404, body: { message: 'Match post not found.' } }
      }

      if (post.status !== 'requested' || !post.requestedBy || !post.challengeId) {
        return { status: 409, body: { message: 'This post has no pending request to accept.' } }
      }

      const posterTeam = norm(post.team)
      const requesterTeam = norm(post.requestedBy)

      if (posterTeam.toLowerCase() === requesterTeam.toLowerCase()) {
        return { status: 400, body: { message: 'Cannot create a match against your own team.' } }
      }

      // The authoritative check: is the slot still free right now? Reading
      // and writing the "primary" booking below is what actually makes this
      // race-safe — even two simultaneous accept attempts can't both succeed,
      // because only one primary insert can ever satisfy the unique index.
      const slotTaken = await isSlotTaken({ venue: post.venue, date: post.date, time: post.time, session })
      if (slotTaken) {
        post.status = 'expired'
        post.requestedBy = null
        if (session) await post.save({ session })
        else await post.save()

        return { status: 409, body: { message: 'That slot has already been booked by someone else. This post has been removed.' } }
      }

      const venueOwnerInfo = await getVenueOwnerInfo(post.venue)

      const base = {
        date: post.date,
        time: post.time,
        venue: post.venue,
        status: 'confirmed',
        players: post.players || 11,
        amount: 'Rs. 1,200',
        challengeId: post.challengeId,
        matchPostId: post._id,
        venueId: venueOwnerInfo.venueId,
        ownerName: venueOwnerInfo.ownerName,
        ownerEmail: venueOwnerInfo.ownerEmail,
      }

      let primaryBooking
      let secondaryBooking
      try {
        const createOpts = session ? { session } : undefined
        const created = await Booking.create([
          { ...base, team: posterTeam, opponent: requesterTeam, role: 'primary' },
        ], createOpts)
        primaryBooking = created[0]

        const created2 = await Booking.create([
          { ...base, team: requesterTeam, opponent: posterTeam, role: 'secondary' },
        ], createOpts)
        secondaryBooking = created2[0]
      } catch (error) {
        if (error && error.code === 11000) {
          // Someone else won the race for this slot between our check above
          // and this insert. Treat it exactly like "slot taken".
          post.status = 'expired'
          post.requestedBy = null
          if (session) await post.save({ session })
          else await post.save()

          return { status: 409, body: { message: 'That slot was just booked by someone else. This post has been removed.' } }
        }
        throw error
      }

      await Challenge.findByIdAndUpdate(
        post.challengeId,
        { $set: { status: 'accepted', acceptedAt: new Date() } },
        session ? { session } : undefined
      )

      // The post has done its job now — remove it rather than just marking it,
      // so it doesn't linger in the Find Match feed.
      if (session) {
        await MatchPost.deleteOne({ _id: post._id }).session(session)
      } else {
        await MatchPost.deleteOne({ _id: post._id })
      }

      // Invalidate any OTHER open/requested posts pointing at this same slot
      // (e.g. a duplicate post, or someone else's post for the same venue/time).
      await expirePostsForSlot({ venue: post.venue, date: post.date, time: post.time, exceptId: post._id }, session)

      return {
        status: 200,
        body: { message: 'Match accepted and booked.', primaryBooking, secondaryBooking },
        notify: { posterTeam, requesterTeam, date: post.date, time: post.time, venue: post.venue },
      }
    })

    if (outcome.notify) {
      const { posterTeam, requesterTeam, date, time, venue } = outcome.notify
      try {
        await Promise.all([
          Notification.create({
            team: requesterTeam,
            text: `${posterTeam} accepted your match request. ${date} at ${time} (${venue}).`,
            type: 'match-update',
            unread: true,
            createdAt: new Date(),
          }),
          Notification.create({
            team: posterTeam,
            text: `You accepted ${requesterTeam}'s match request. ${date} at ${time} (${venue}).`,
            type: 'match-update',
            unread: true,
            createdAt: new Date(),
          }),
          notifyVenueOwnerOfMatch({ venueName: venue, teamA: posterTeam, teamB: requesterTeam, date, time }),
        ])
      } catch (_notifError) {
        // Notification failure should never undo a successful booking.
      }
    }

    return res.status(outcome.status).json(outcome.body)
  } catch (error) {
    return res.status(500).json({ message: 'Failed to accept match post.', error: error.message })
  }
})

/* ────────────────────────────────────────────────────────────────── */
/* DELETE /match-posts/:id - poster removes their own post manually   */
/* ────────────────────────────────────────────────────────────────── */
router.delete('/match-posts/:id', async (req, res) => {
  try {
    const post = await MatchPost.findById(req.params.id)
    if (!post) return res.status(404).json({ message: 'Match post not found.' })

    if (post.challengeId && post.status === 'requested') {
      await Challenge.findByIdAndUpdate(post.challengeId, { $set: { status: 'cancelled' } })
    }

    await MatchPost.deleteOne({ _id: post._id })

    return res.json({ message: 'Match post removed.' })
  } catch (error) {
    return res.status(500).json({ message: 'Failed to remove match post.', error: error.message })
  }
})

module.exports = router