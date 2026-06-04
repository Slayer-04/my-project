const express = require('express')
const Team = require('../models/Team')
const PendingRegistration = require('../models/PendingRegistration')
const User = require('../models/User')
const bcrypt = require('bcryptjs')
const { rankTeamsByCompatibility } = require('../algorithms/compatibility')

const router = express.Router()

const norm = value => (typeof value === 'string' ? value.trim() : '')

const deriveDistrict = (location, district) => {
  const explicitDistrict = norm(district)
  if (explicitDistrict) return explicitDistrict

  const normalizedLocation = norm(location)
  if (!normalizedLocation) return ''

  const parts = normalizedLocation.split(',').map(part => part.trim()).filter(Boolean)
  if (parts.length === 0) return ''
  return parts[parts.length - 1]
}

const serializeTeam = (team) => ({
  ...team.toObject(),
  teamName: norm(team.teamName) || norm(team.captainName),
  location: norm(team.location),
  district: deriveDistrict(team.location, team.district),
})

// Create team immediately so UID is available right after registration,
// while still requiring OTP verification for login access.
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

    const existingUser = await User.findOne({ email: normalizedEmail })
    if (existingUser?.verified) {
      return res.status(409).json({ message: 'An account already exists for this email.' })
    }

    let team = await Team.findOne({ email: normalizedEmail })
    if (!team) {
      team = await Team.create({
        captainName: captainName.trim(),
        email: normalizedEmail,
        teamProfileCompleted: false,
      })
    }

    const alreadyPending = await PendingRegistration.findOne({ email: normalizedEmail, role: 'team' })
    if (!alreadyPending) {
      await PendingRegistration.create({ captainName: captainName.trim(), email: normalizedEmail, role: 'team' })
    }

    return res.status(201).json({
      message: 'Team account created. Verify your email to activate login.',
      pending: true,
      team: serializeTeam(team),
    })
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

    return res.json(serializeTeam(team))
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

    if (random && Number.isFinite(limit) && limit > 0) {
      const pipeline = [
        { $match: query },
        { $lookup: { from: 'users', localField: 'email', foreignField: 'email', as: 'user' } },
        { $match: { $expr: { $gt: [{ $size: '$user' }, 0] } } },
        { $sample: { size: limit } },
      ]
      const allTeams = await Team.aggregate(pipeline)
      return res.json(allTeams.map(team => ({
        ...team,
        teamName: norm(team.teamName) || norm(team.captainName),
        location: norm(team.location),
        district: deriveDistrict(team.location, team.district),
      })))
    }

    // Default listing: only include teams that have a linked User record (real users)
    const agg = [
      { $match: query },
      { $lookup: { from: 'users', localField: 'email', foreignField: 'email', as: 'user' } },
      { $match: { $expr: { $gt: [{ $size: '$user' }, 0] } } },
      { $sort: { createdAt: -1 } },
    ]

    if (Number.isFinite(limit) && limit > 0) {
      agg.push({ $limit: limit })
    }

    const allTeams = await Team.aggregate(agg)
    return res.json(allTeams.map(t => ({
      ...t,
      teamName: norm(t.teamName) || norm(t.captainName),
      location: norm(t.location),
      district: deriveDistrict(t.location, t.district),
    })))
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
      preferredVenue: req.query.venue,
      limit: Number(req.query.limit) > 0 ? Number(req.query.limit) : 5,
    })

    return res.json({
      teamId: team._id,
      context: {
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
    return res.json(serializeTeam(team))
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch team.', error: error.message })
  }
})

router.patch('/:id/complete-profile', async (req, res) => {
  try {
    const { teamName, location, district, skill, locationVerified, lat, lng } = req.body

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

    const team = await Team.findById(req.params.id)
    if (!team) {
      return res.status(404).json({ message: 'Team not found.' })
    }

    if (team.teamProfileCompleted) {
      return res.status(409).json({ message: 'Team profile is already completed.' })
    }

    team.teamName = teamName.trim()
    team.location = location.trim()
    team.district = deriveDistrict(location, district)
    team.skill = skill
    team.lat = lat
    team.lng = lng
    team.locationVerified = true
    team.teamProfileCompleted = true
    team.skillLocked = true
    team.locationLocked = true
    team.profileCompletedAt = new Date()

    // Set initial ELO based on declared skill level if no matches played yet.
    const SKILL_BASE = { Beginner: 1000, Intermediate: 1500, Advanced: 2000 }
    if (!team.eloMatchesPlayed || Number(team.eloMatchesPlayed) === 0) {
      const base = SKILL_BASE[skill] ?? Number(team.eloRating ?? 1000)
      team.eloRating = Number(base)
    }

    await team.save()

    return res.json({
      message: 'Team profile completed successfully.',
      team: serializeTeam(team),
    })
  } catch (error) {
    return res.status(500).json({ message: 'Failed to complete team profile.', error: error.message })
  }
})

router.patch('/:id', async (req, res) => {
  try {
    const { teamName, location, district, skill, lat, lng } = req.body

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
      team.district = deriveDistrict(normalizedLocation, district || team.district)
    }

    if (typeof district !== 'undefined' && typeof location === 'undefined') {
      team.district = deriveDistrict(team.location, district)
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
      team: serializeTeam(team),
    })
  } catch (error) {
    return res.status(500).json({ message: 'Failed to update team.', error: error.message })
  }
})

module.exports = router
