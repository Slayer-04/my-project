const express = require('express')
const Booking = require('../models/Booking')
const Challenge = require('../models/Challenge')
const Match = require('../models/Match')
const Notification = require('../models/Notification')

const router = express.Router()

function createCrudRoutes({ path, label, model, createValidator, updateValidator }) {
  router.get(path, async (_req, res) => {
    try {
      const records = await model.find({}).sort({ createdAt: -1 })
      return res.json(records)
    } catch (error) {
      return res.status(500).json({ message: `Failed to fetch ${label} records.`, error: error.message })
    }
  })

  router.post(path, async (req, res) => {
    try {
      const validation = await createValidator(req.body || {})
      if (!validation.ok) {
        return res.status(400).json({ message: validation.message })
      }

      const record = await model.create(validation.data)
      return res.status(201).json({ message: `${label} created successfully.`, [path.slice(1)]: record })
    } catch (error) {
      // A duplicate-key error here means a unique index (e.g. one pending
      // challenge per team pair, or one confirmed booking per team/slot)
      // blocked the write. Report it as a normal validation failure rather
      // than a server error.
      if (error && error.code === 11000) {
        return res.status(409).json({ message: `That ${label} already exists or conflicts with an existing one.` })
      }
      return res.status(500).json({ message: `Failed to create ${label}.`, error: error.message })
    }
  })

  router.patch(`${path}/:id`, async (req, res) => {
    try {
      const record = await model.findById(req.params.id)
      if (!record) {
        return res.status(404).json({ message: `${label} not found.` })
      }

      const validation = await updateValidator(req.body || {}, record)
      if (!validation.ok) {
        return res.status(400).json({ message: validation.message })
      }

      // Run any side effects (e.g. booking creation on challenge accept)
      if (validation.sideEffect) {
        await validation.sideEffect()
      }

      Object.assign(record, validation.data)
      await record.save()

      return res.json({ message: `${label} updated successfully.`, [label]: record })
    } catch (error) {
      if (error && error.code === 11000) {
        return res.status(409).json({ message: `That ${label} conflicts with an existing record.` })
      }
      return res.status(500).json({ message: `Failed to update ${label}.`, error: error.message })
    }
  })
}

function validateString(value, label) {
  if (typeof value !== 'string' || !value.trim()) {
    return `${label} is required.`
  }
  return null
}

function validateNumber(value, label, min) {
  if (typeof value !== 'number' || Number.isNaN(value) || value < min) {
    return `${label} must be a number greater than or equal to ${min}.`
  }
  return null
}

createCrudRoutes({
  path: '/bookings',
  label: 'booking',
  model: Booking,
  createValidator: (body) => {
    const requiredFields = ['team', 'venue', 'date', 'time', 'status', 'players', 'amount']
    for (const field of requiredFields) {
      if (field === 'players') {
        const error = validateNumber(body.players, 'players', 1)
        if (error) return { ok: false, message: error }
        continue
      }

      if (field === 'status') {
        if (body.status && !['confirmed', 'pending', 'cancelled'].includes(body.status)) {
          return { ok: false, message: 'status must be confirmed, pending, or cancelled.' }
        }
        continue
      }

      const error = validateString(body[field], field)
      if (error) return { ok: false, message: error }
    }

    return {
      ok: true,
      data: {
        team: body.team.trim(),
        venue: body.venue.trim(),
        date: body.date.trim(),
        time: body.time.trim(),
        status: body.status || 'pending',
        players: Number(body.players),
        amount: body.amount.trim(),
        note: typeof body.note === 'string' ? body.note.trim() : '',
      },
    }
  },
  updateValidator: async (body) => {
    const updates = {}

    if (typeof body.team !== 'undefined') {
      const error = validateString(body.team, 'team')
      if (error) return { ok: false, message: error }
      updates.team = body.team.trim()
    }

    if (typeof body.venue !== 'undefined') {
      const error = validateString(body.venue, 'venue')
      if (error) return { ok: false, message: error }
      updates.venue = body.venue.trim()
    }

    if (typeof body.date !== 'undefined') {
      const error = validateString(body.date, 'date')
      if (error) return { ok: false, message: error }
      updates.date = body.date.trim()
    }

    if (typeof body.time !== 'undefined') {
      const error = validateString(body.time, 'time')
      if (error) return { ok: false, message: error }
      updates.time = body.time.trim()
    }

    if (typeof body.status !== 'undefined') {
      if (!['confirmed', 'pending', 'cancelled'].includes(body.status)) {
        return { ok: false, message: 'status must be confirmed, pending, or cancelled.' }
      }
      updates.status = body.status
    }

    if (typeof body.players !== 'undefined') {
      const error = validateNumber(body.players, 'players', 1)
      if (error) return { ok: false, message: error }
      updates.players = Number(body.players)
    }

    if (typeof body.amount !== 'undefined') {
      const error = validateString(body.amount, 'amount')
      if (error) return { ok: false, message: error }
      updates.amount = body.amount.trim()
    }

    if (typeof body.note !== 'undefined') {
      updates.note = String(body.note || '').trim()
    }

    return { ok: true, data: updates }
  },
})

createCrudRoutes({
  path: '/challenges',
  label: 'challenge',
  model: Challenge,
  createValidator: async (body) => {
    const requiredFields = ['from', 'to', 'date', 'time', 'venue']
    for (const field of requiredFields) {
      const error = validateString(body[field], field)
      if (error) return { ok: false, message: error }
    }

    const from = body.from.trim()
    const to = body.to.trim()

    // Guard: never allow a self-challenge
    if (from.toLowerCase() === to.toLowerCase()) {
      return { ok: false, message: 'A team cannot challenge itself.' }
    }

    if (typeof body.status !== 'undefined' && !['pending', 'accepted', 'declined', 'cancelled'].includes(body.status)) {
      return { ok: false, message: 'status must be pending, accepted, declined, or cancelled.' }
    }

    const pairKey = [from.toLowerCase(), to.toLowerCase()].sort().join('::')

    // Guard: only one pending challenge is allowed between the same two teams at a
    // time, no matter who challenges whom. This is a defense-in-depth check on top
    // of the DB-level unique index on { pairKey, status } — it lets us return a
    // clear, friendly message instead of a raw duplicate-key error in the common case.
    const existingPending = await Challenge.findOne({ pairKey, status: 'pending' })
    if (existingPending) {
      return {
        ok: false,
        message: `There is already a pending match request between ${existingPending.from} and ${existingPending.to}. Wait for a response before sending another.`,
      }
    }

    return {
      ok: true,
      data: {
        from,
        to,
        date: body.date.trim(),
        time: body.time.trim(),
        venue: body.venue.trim(),
        status: body.status || 'pending',
        note: typeof body.note === 'string' ? body.note.trim() : '',
        pairKey,
      },
    }
  },
  // ── KEY FIX: updateValidator is now async and creates bookings on accept ──
  updateValidator: async (body, record) => {
    const updates = {}

    for (const field of ['from', 'to', 'date', 'time', 'venue']) {
      if (typeof body[field] !== 'undefined') {
        const error = validateString(body[field], field)
        if (error) return { ok: false, message: error }
        updates[field] = body[field].trim()
      }
    }

    if (typeof body.status !== 'undefined') {
      if (!['pending', 'accepted', 'declined', 'cancelled'].includes(body.status)) {
        return { ok: false, message: 'status must be pending, accepted, declined, or cancelled.' }
      }
      updates.status = body.status
    }

    if (typeof body.note !== 'undefined') {
      updates.note = String(body.note || '').trim()
    }

    // When accepting, set up a sideEffect to create bookings for both teams
    let sideEffect = null
    if (updates.status === 'accepted' && record.status !== 'accepted') {
      const fromTeam = (updates.from || record.from || '').trim()
      const toTeam   = (updates.to   || record.to   || '').trim()
      const date     = (updates.date || record.date || '').trim()
      const time     = (updates.time || record.time || '').trim()
      const venue    = (updates.venue || record.venue || '').trim()
      const challengeId = record._id

      // Guard: never create a self-match
      if (fromTeam.toLowerCase() === toTeam.toLowerCase()) {
        return { ok: false, message: 'Cannot create a match between the same team.' }
      }

      sideEffect = async () => {
        const base = {
          date, time, venue,
          status:      'confirmed',
          players:     11,
          amount:      'Rs. 1,200',
          challengeId,
        }

        // Create (or confirm) each team's own booking independently. This is
        // deliberately NOT a single Promise.all([...]) over both inserts:
        // both bookings share the same venue/date/time, and if anything ever
        // races or a duplicate-key error occurs on one insert, the two calls
        // must not be able to take each other down. Each side is self-healing:
        // if a team is missing its booking for this match (e.g. from a past
        // partial failure), it gets created now.
        const ensureBookingFor = async (teamName, opponentName) => {
          const existingForTeam = await Booking.findOne({
            team: teamName,
            opponent: opponentName,
            date,
            time,
            venue,
            status: { $ne: 'cancelled' },
          })
          if (existingForTeam) return existingForTeam

          try {
            return await Booking.create({ ...base, team: teamName, opponent: opponentName })
          } catch (error) {
            if (error && error.code === 11000) {
              // Another confirmed booking for this exact team/venue/date/time
              // already exists (shouldn't normally happen once opponent is
              // included in the lookup above, but guards against stale data).
              return Booking.findOne({ team: teamName, venue, date, time, status: 'confirmed' })
            }
            throw error
          }
        }

        await Promise.all([
          ensureBookingFor(toTeam, fromTeam),
          ensureBookingFor(fromTeam, toTeam),
        ])

        // Notify the challenger that their challenge was accepted
        try {
          await Notification.create({
            team:        fromTeam,
            text:        `${toTeam} accepted your challenge! Match on ${date} at ${time} (${venue}).`,
            type:        'match-update',
            challengeId: challengeId,
            unread:      true,
            createdAt:   new Date(),
          })
        } catch (_notifError) {
          // Notification failure should not block booking creation
        }
      }
    }

    return { ok: true, data: updates, sideEffect }
  },
})

createCrudRoutes({
  path: '/matches',
  label: 'match',
  model: Match,
  createValidator: (body) => {
    const requiredFields = ['opponent', 'score', 'result', 'date', 'venue']
    for (const field of requiredFields) {
      const error = validateString(body[field], field)
      if (error) return { ok: false, message: error }
    }

    if (!['win', 'loss', 'draw'].includes(body.result)) {
      return { ok: false, message: 'result must be win, loss, or draw.' }
    }

    return {
      ok: true,
      data: {
        opponent: body.opponent.trim(),
        score: body.score.trim(),
        result: body.result,
        date: body.date.trim(),
        venue: body.venue.trim(),
        note: typeof body.note === 'string' ? body.note.trim() : '',
      },
    }
  },
  updateValidator: async (body) => {
    const updates = {}

    for (const field of ['opponent', 'score', 'date', 'venue']) {
      if (typeof body[field] !== 'undefined') {
        const error = validateString(body[field], field)
        if (error) return { ok: false, message: error }
        updates[field] = body[field].trim()
      }
    }

    if (typeof body.result !== 'undefined') {
      if (!['win', 'loss', 'draw'].includes(body.result)) {
        return { ok: false, message: 'result must be win, loss, or draw.' }
      }
      updates.result = body.result
    }

    if (typeof body.note !== 'undefined') {
      updates.note = String(body.note || '').trim()
    }

    return { ok: true, data: updates }
  },
})

module.exports = router