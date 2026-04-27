const express = require('express')
const Booking = require('../models/Booking')
const Challenge = require('../models/Challenge')
const Match = require('../models/Match')

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
      const validation = createValidator(req.body || {})
      if (!validation.ok) {
        return res.status(400).json({ message: validation.message })
      }

      const record = await model.create(validation.data)
      return res.status(201).json({ message: `${label} created successfully.`, [path.slice(1)]: record })
    } catch (error) {
      return res.status(500).json({ message: `Failed to create ${label}.`, error: error.message })
    }
  })

  router.patch(`${path}/:id`, async (req, res) => {
    try {
      const record = await model.findById(req.params.id)
      if (!record) {
        return res.status(404).json({ message: `${label} not found.` })
      }

      const validation = updateValidator(req.body || {}, record)
      if (!validation.ok) {
        return res.status(400).json({ message: validation.message })
      }

      Object.assign(record, validation.data)
      await record.save()

      return res.json({ message: `${label} updated successfully.`, [label]: record })
    } catch (error) {
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
  updateValidator: (body, record) => {
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
  createValidator: (body) => {
    const requiredFields = ['from', 'to', 'date', 'time', 'venue']
    for (const field of requiredFields) {
      const error = validateString(body[field], field)
      if (error) return { ok: false, message: error }
    }

    if (typeof body.status !== 'undefined' && !['pending', 'accepted', 'declined', 'cancelled'].includes(body.status)) {
      return { ok: false, message: 'status must be pending, accepted, declined, or cancelled.' }
    }

    return {
      ok: true,
      data: {
        from: body.from.trim(),
        to: body.to.trim(),
        date: body.date.trim(),
        time: body.time.trim(),
        venue: body.venue.trim(),
        status: body.status || 'pending',
        note: typeof body.note === 'string' ? body.note.trim() : '',
      },
    }
  },
  updateValidator: (body) => {
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

    return { ok: true, data: updates }
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
  updateValidator: (body) => {
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