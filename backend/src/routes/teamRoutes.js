const express = require('express')
const Team = require('../models/Team')

const router = express.Router()

router.post('/register', async (req, res) => {
  try {
    const { captainName, email } = req.body

    if (!captainName || !email) {
      return res.status(400).json({ message: 'captainName and email are required.' })
    }

    const existing = await Team.findOne({ email: email.trim().toLowerCase() })
    if (existing) {
      return res.status(409).json({ message: 'Team account already exists for this email.' })
    }

    const team = await Team.create({
      captainName: captainName.trim(),
      email: email.trim().toLowerCase(),
      teamProfileCompleted: false,
    })

    return res.status(201).json({
      message: 'Team account created. Complete profile on first login.',
      team,
    })
  } catch (error) {
    return res.status(500).json({ message: 'Failed to register team.', error: error.message })
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
    const { teamName, location, skill, locationVerified } = req.body

    if (!teamName || !location || !skill) {
      return res.status(400).json({ message: 'teamName, location, and skill are required.' })
    }

    if (!locationVerified) {
      return res.status(400).json({ message: 'Location must be re-verified before completing profile.' })
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
    team.skill = skill
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
    const { teamName, location, skill } = req.body

    const team = await Team.findById(req.params.id)
    if (!team) {
      return res.status(404).json({ message: 'Team not found.' })
    }

    if (team.teamProfileCompleted) {
      if (typeof location !== 'undefined' || typeof skill !== 'undefined') {
        return res.status(400).json({ message: 'Location and skill are locked after profile completion. Only teamName can be updated.' })
      }
    }

    if (typeof teamName !== 'undefined') {
      if (!teamName.trim()) {
        return res.status(400).json({ message: 'teamName cannot be empty.' })
      }
      team.teamName = teamName.trim()
    }

    if (!team.teamProfileCompleted) {
      if (typeof location !== 'undefined') team.location = String(location).trim()
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
