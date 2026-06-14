const express = require('express')
const Team = require('../models/Team')
const TeamJoinRequest = require('../models/TeamJoinRequest')
const Notification = require('../models/Notification')
const User = require('../models/User')

const router = express.Router()

const norm = value => (typeof value === 'string' ? value.trim() : '')

router.post('/request', async (req, res) => {
  try {
    const teamUid = norm(req.body.teamUid)
    const requesterName = norm(req.body.requesterName)
    const requesterEmail = norm(req.body.requesterEmail).toLowerCase()
    const message = norm(req.body.message)

    if (!teamUid || !requesterName || !requesterEmail) {
      return res.status(400).json({ message: 'teamUid, requesterName, and requesterEmail are required.' })
    }

    let team = await Team.findOne({ uid: teamUid })
    if (!team && /^\d+$/.test(teamUid)) {
      const withoutLeadingZeros = String(Number(teamUid))
      team = await Team.findOne({ uid: withoutLeadingZeros })
    }
    if (!team) {
      return res.status(404).json({ message: 'Team not found for that UID.' })
    }

    const existingRequest = await TeamJoinRequest.findOne({
      teamUid,
      requesterEmail,
      status: 'pending',
    })

    if (existingRequest) {
      return res.status(409).json({ message: 'You already have a pending request for this team.', request: existingRequest })
    }

    const request = await TeamJoinRequest.create({
      teamId: team._id,
      teamUid,
      teamName: team.teamName || '',
      captainName: team.captainName || '',
      captainEmail: team.email || '',
      requesterName,
      requesterEmail,
      message,
      status: 'pending',
    })

    await Notification.create({
      team: team.teamName || teamUid,
      text: `${requesterName} requested to join your team${message ? `: ${message}` : '.'}`,
      type: 'join-request',
      unread: true,
      joinRequestId: request._id,
      joinRequestStatus: 'pending',
      requesterName,
      requesterEmail,
      teamUid,
      time: 'just now',
    })

    return res.status(201).json({ message: 'Join request sent to the captain notification bell.', request })
  } catch (error) {
    return res.status(500).json({ message: 'Failed to create join request.', error: error.message })
  }
})

router.get('/team/:teamUid', async (req, res) => {
  try {
    const teamUid = norm(req.params.teamUid)
    if (!teamUid) {
      return res.status(400).json({ message: 'teamUid is required.' })
    }

    const requests = await TeamJoinRequest.find({ teamUid }).sort({ createdAt: -1 })
    return res.json(requests)
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch join requests.', error: error.message })
  }
})

router.get('/status', async (req, res) => {
  try {
    const teamUid = norm(req.query.teamUid)
    const requesterEmail = norm(req.query.requesterEmail).toLowerCase()

    if (!teamUid || !requesterEmail) {
      return res.status(400).json({ message: 'teamUid and requesterEmail are required.' })
    }

    const latestRequest = await TeamJoinRequest.findOne({
      teamUid,
      requesterEmail,
    }).sort({ createdAt: -1 })

    if (!latestRequest) {
      return res.status(404).json({ message: 'Join request not found for this team/email pair.' })
    }

    return res.json({
      status: latestRequest.status,
      requestId: latestRequest._id,
      teamUid: latestRequest.teamUid,
      requesterEmail: latestRequest.requesterEmail,
      requesterName: latestRequest.requesterName,
      reviewedAt: latestRequest.reviewedAt,
    })
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch join request status.', error: error.message })
  }
})

router.get('/member/:email', async (req, res) => {
  try {
    const requesterEmail = decodeURIComponent(req.params.email || '').trim().toLowerCase()
    if (!requesterEmail) {
      return res.status(400).json({ message: 'Email is required.' })
    }

    const approvedRequest = await TeamJoinRequest.findOne({
      requesterEmail,
      status: 'approved',
    }).sort({ reviewedAt: -1, createdAt: -1 })

    if (!approvedRequest) {
      return res.status(404).json({ message: 'No approved team membership found for this email.' })
    }

    const team = await Team.findById(approvedRequest.teamId)
    if (!team) {
      return res.status(404).json({ message: 'Approved team record is no longer available.' })
    }

    return res.json({
      memberName: approvedRequest.requesterName,
      memberEmail: approvedRequest.requesterEmail,
      team: {
        _id: team._id,
        uid: team.uid,
        teamName: team.teamName,
        location: team.location,
        skill: team.skill,
        lat: team.lat,
        lng: team.lng,
        eloRating: team.eloRating,
        teamProfileCompleted: team.teamProfileCompleted,
        captainName: team.captainName,
        captainEmail: team.email,
      },
    })
  } catch (error) {
    return res.status(500).json({ message: 'Failed to resolve team member by email.', error: error.message })
  }
})

router.patch('/leave', async (req, res) => {
  try {
    const requesterEmail = norm(req.body.requesterEmail).toLowerCase()
    const teamId = norm(req.body.teamId)

    if (!requesterEmail) {
      return res.status(400).json({ message: 'requesterEmail is required.' })
    }

    const query = { requesterEmail, status: 'approved' }
    if (teamId) {
      query.teamId = teamId
    }

    const approvedRequest = await TeamJoinRequest.findOne(query).sort({ reviewedAt: -1, createdAt: -1 })
    if (!approvedRequest) {
      return res.status(404).json({ message: 'No approved team membership found to leave.' })
    }

    approvedRequest.status = 'left'
    approvedRequest.reviewedAt = new Date()
    await approvedRequest.save()

    await Notification.deleteMany({ joinRequestId: approvedRequest._id })

    await Notification.create({
      team: approvedRequest.teamName || approvedRequest.teamUid,
      text: `${approvedRequest.requesterName} left your team.`,
      type: 'general',
      unread: true,
      requesterName: approvedRequest.requesterName,
      requesterEmail: approvedRequest.requesterEmail,
      teamUid: approvedRequest.teamUid,
      joinRequestId: approvedRequest._id,
      joinRequestStatus: 'left',
      time: 'just now',
    })

    // Clear team info on the user record if present
    try {
      const user = await User.findOne({ email: approvedRequest.requesterEmail.toLowerCase() })
      if (user) {
        user.teamInfo = { teamId: null, teamName: '', captainName: '' }
        user.teamAccess = 'basic'
        user.isCaptain = false
        await user.save()
      }
    } catch (_e) {
      // ignore user update failures
    }

    return res.json({ message: 'You have left the team.', request: approvedRequest })
  } catch (error) {
    return res.status(500).json({ message: 'Failed to leave team.', error: error.message })
  }
})

router.patch('/:id/approve', async (req, res) => {
  try {
    const request = await TeamJoinRequest.findById(req.params.id)
    if (!request) {
      return res.status(404).json({ message: 'Join request not found.' })
    }

    // Approve this request
    request.status = 'approved'
    request.reviewedAt = new Date()
    await request.save()

    // Mark other previously approved requests for this email as left (single membership)
    try {
      await TeamJoinRequest.updateMany(
        { requesterEmail: request.requesterEmail, _id: { $ne: request._id }, status: 'approved' },
        { $set: { status: 'left', reviewedAt: new Date() } }
      )
    } catch (_e) {}

    // Update notifications related to this request
    await Notification.updateMany(
      { joinRequestId: request._id },
      {
        $set: {
          joinRequestStatus: 'approved',
          unread: false,
          text: `${request.requesterName} join request approved.`,
          time: 'just now',
        },
      }
    )

    // Update the user record to reflect new team membership (overwrite existing).
    // Fetch the Team document fresh so we always get the latest teamName, location,
    // district etc. — not the stale snapshot stored in the join request at request time.
    try {
      const user = await User.findOne({ email: request.requesterEmail.toLowerCase() })
      const latestTeam = await Team.findById(request.teamId).catch(() => null)
      if (user) {
        user.teamInfo = {
          teamId:      request.teamId || null,
          teamName:    latestTeam?.teamName  || request.teamName  || '',
          captainName: latestTeam?.captainName || request.captainName || '',
          location:    latestTeam?.location  || '',
          district:    latestTeam?.district  || '',
          uid:         latestTeam?.uid       || request.teamUid  || '',
        }
        user.teamAccess = 'basic'
        user.isCaptain = false
        user.profileCompleted = true
        await user.save()
      }
    } catch (_e) {
      // ignore user update failures
    }

    return res.json({ message: 'Join request approved.', request })
  } catch (error) {
    return res.status(500).json({ message: 'Failed to approve join request.', error: error.message })
  }
})

router.patch('/:id/decline', async (req, res) => {
  try {
    const request = await TeamJoinRequest.findById(req.params.id)
    if (!request) {
      return res.status(404).json({ message: 'Join request not found.' })
    }

    request.status = 'declined'
    request.reviewedAt = new Date()
    await request.save()

    await Notification.updateMany(
      { joinRequestId: request._id },
      {
        $set: {
          joinRequestStatus: 'declined',
          unread: false,
          text: `${request.requesterName} join request declined.`,
          time: 'just now',
        },
      }
    )

    return res.json({ message: 'Join request declined.', request })
  } catch (error) {
    return res.status(500).json({ message: 'Failed to decline join request.', error: error.message })
  }
})

module.exports = router