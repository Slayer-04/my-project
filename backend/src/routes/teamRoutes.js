const express = require('express')
const Team = require('../models/Team')
const PendingRegistration = require('../models/PendingRegistration')
const User = require('../models/User')
const bcrypt = require('bcryptjs')
const { rankTeamsByCompatibility } = require('../algorithms/compatibility')

const router = express.Router()

// Create a pending registration — the real Team record will be created after OTP verification
router.post('/register', async (req, res) => {
  try {
    const { captainName, email, password, confirmPassword } = req.body

    if (!captainName || !email) {
      return res.status(400).json({ message: 'captainName and email are required.' })
    }

    if (!password || !confirmPassword) {
      return res.status(400).json({ message: 'Password and confirm password are required.' })
    }

    if (String(password) !== String(confirmPassword)) {
      return res.status(400).json({ message: 'Passwords do not match.' })
    }

    if (String(password).length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters.' })
    }

    const normalizedEmail = email.trim().toLowerCase()

    const existing = await Team.findOne({ email: normalizedEmail })
    if (existing) {
      return res.status(409).json({ message: 'Team account already exists for this email.' })
    }

    const existingUser = await User.findOne({ email: normalizedEmail })
    if (existingUser) {
      return res.status(409).json({ message: existingUser.verified ? 'An account already exists for this email.' : 'This email is already pending verification.' })
    }

    const alreadyPending = await PendingRegistration.findOne({ email: normalizedEmail })
    if (alreadyPending) {
      return res.status(200).json({ message: 'Pending registration already created. Please verify your email.', pending: true })
    }

    const pending = await PendingRegistration.create({ captainName: captainName.trim(), email: normalizedEmail, role: 'team' })

    return res.status(201).json({ message: 'Pending registration created. Verify your email to complete registration.', pending: true })
  } catch (error) {
    return res.status(500).json({ message: 'Failed to create pending registration.', error: error.message })
  }
})

router.get('/email/:email', async (req, res) => {
  try {
    const email = decodeURIComponent(req.params.email || '').trim().toLowerCase()
    if (!email) {
      return res.status(400).json({ message: 'Email is required.' })
    }

    const team = await Team.findOne({ email })
    if (!team) {
      return res.status(404).json({ message: 'Team not found for this email.' })
    }

    return res.json(team)
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch team by email.', error: error.message })
  }
})

router.get('/', async (req, res) => {
  try {
    const query = {}
    if (typeof req.query.district === 'string' && req.query.district.trim()) {
      query.district = req.query.district.trim()
    }

    const limit = Number(req.query.limit)
    const random = String(req.query.random || '').toLowerCase() === 'true'

    let teamsQuery

    if (random && Number.isFinite(limit) && limit > 0) {
      const pipeline = [{ $match: query }, { $sample: { size: limit } }]
      const allTeams = await Team.aggregate(pipeline)
      return res.json(allTeams)
    }

    teamsQuery = Team.find(query).sort({ createdAt: -1 })
    if (Number.isFinite(limit) && limit > 0) {
      teamsQuery = teamsQuery.limit(limit)
    }

    const allTeams = await teamsQuery
    return res.json(allTeams)
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch teams.', error: error.message })
  }
})

router.get('/:id/recommendations', async (req, res) => {
  try {
    const team = await Team.findById(req.params.id)
    if (!team) {
      return res.status(404).json({ message: 'Team not found.' })
    }

    const allTeams = await Team.find({})
    const venueCoords = req.query.lat && req.query.lng
      ? { lat: Number(req.query.lat), lng: Number(req.query.lng) }
      : null

    const result = rankTeamsByCompatibility({
      myTeam: team,
      teams: allTeams,
      venueCoords,
      preferredDay: req.query.day,
      preferredTime: req.query.time,
      preferredVenue: req.query.venue,
      limit: Number(req.query.limit) > 0 ? Number(req.query.limit) : 5,
    })

    return res.json({
      teamId: team._id,
      context: {
        day: req.query.day || null,
        time: req.query.time || null,
        venue: req.query.venue || null,
      },
      ...result,
    })
  } catch (error) {
    return res.status(500).json({ message: 'Failed to score team compatibility.', error: error.message })
  }
})

router.get('/:id', async (req, res) => {
  try {
    const team = await Team.findById(req.params.id)
    if (!team) {
      return res.status(404).json({ message: 'Team not found.' })
    }
    return res.json(team)
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch team.', error: error.message })
  }
})

router.patch('/:id/complete-profile', async (req, res) => {
  try {
    const { teamName, location, skill, locationVerified, lat, lng, preferredDay, preferredTime } = req.body

    if (!teamName || !location || !skill) {
      return res.status(400).json({ message: 'teamName, location, and skill are required.' })
    }

    if (!locationVerified) {
      return res.status(400).json({ message: 'Location must be re-verified before completing profile.' })
    }

    if (typeof lat !== 'number' || typeof lng !== 'number') {
      return res.status(400).json({ message: 'Valid lat and lng coordinates are required.' })
    }

    if (!['Beginner', 'Intermediate', 'Advanced'].includes(skill)) {
      return res.status(400).json({ message: 'Invalid skill value.' })
    }

    const allowedDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
    if (typeof preferredDay !== 'undefined' && preferredDay && !allowedDays.includes(preferredDay)) {
      return res.status(400).json({ message: 'Invalid preferredDay value.' })
    }

    const team = await Team.findById(req.params.id)
    if (!team) {
      return res.status(404).json({ message: 'Team not found.' })
    }

    if (team.teamProfileCompleted) {
      return res.status(409).json({ message: 'Team profile is already completed.' })
    }

    team.teamName = teamName.trim()
    team.location = location.trim()
    team.skill = skill
    team.preferredDay = preferredDay || ''
    team.preferredTime = preferredTime || ''
    team.lat = lat
    team.lng = lng
    team.locationVerified = true
    team.teamProfileCompleted = true
    team.skillLocked = true
    team.locationLocked = true
    team.profileCompletedAt = new Date()

    await team.save()

    return res.json({
      message: 'Team profile completed successfully.',
      team,
    })
  } catch (error) {
    return res.status(500).json({ message: 'Failed to complete team profile.', error: error.message })
  }
})

router.patch('/:id', async (req, res) => {
  try {
    const { teamName, location, skill, lat, lng, preferredDay, preferredTime } = req.body
    const allowedDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
    if (typeof preferredDay !== 'undefined' && preferredDay && !allowedDays.includes(preferredDay)) {
      return res.status(400).json({ message: 'Invalid preferredDay value.' })
    }


    const team = await Team.findById(req.params.id)
    if (!team) {
      return res.status(404).json({ message: 'Team not found.' })
    }

    if (team.teamProfileCompleted) {
      if (typeof skill !== 'undefined') {
        return res.status(400).json({ message: 'Skill is locked after profile completion.' })
      }
    }

    if (typeof teamName !== 'undefined') {
      if (!teamName.trim()) {
        return res.status(400).json({ message: 'teamName cannot be empty.' })
      }
      team.teamName = teamName.trim()
    }

    if (typeof location !== 'undefined') {
      const normalizedLocation = String(location).trim()
      if (!normalizedLocation) {
        return res.status(400).json({ message: 'location cannot be empty.' })
      }
      team.location = normalizedLocation
    }

    if (typeof preferredDay !== 'undefined') {
      team.preferredDay = String(preferredDay).trim()
    }

    if (typeof preferredTime !== 'undefined') {
      team.preferredTime = String(preferredTime).trim()
    }

    if (typeof lat === 'number' && typeof lng === 'number') {
      team.lat = lat
      team.lng = lng
    }

    if (!team.teamProfileCompleted) {
      if (typeof skill !== 'undefined') {
        if (!['Beginner', 'Intermediate', 'Advanced'].includes(skill)) {
          return res.status(400).json({ message: 'Invalid skill value.' })
        }
        team.skill = skill
      }
    }

    await team.save()

    return res.json({
      message: 'Team updated successfully.',
      team,
    })
  } catch (error) {
    return res.status(500).json({ message: 'Failed to update team.', error: error.message })
  }
})

module.exports = router
