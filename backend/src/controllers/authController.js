const User = require('../models/User')
const Team = require('../models/Team')
const PendingRegistration = require('../models/PendingRegistration')
const { generateOtp, hashOtp, compareOtpHash } = require('../utils/otpUtils')
const bcrypt = require('bcryptjs')
const { sendOtpEmail } = require('../utils/emailUtils')

const OTP_EXPIRY_MINUTES = Number(process.env.OTP_EXP_MIN || 10)
const MAX_ATTEMPTS = Number(process.env.OTP_MAX_ATTEMPTS || 5)
const TEMP_TEAM_PASSWORD = '123456'

// POST /api/auth/send-otp
const sendOtp = async (req, res) => {
  const { email } = req.body
  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : ''
  const role = req.body?.role === 'owner' ? 'owner' : 'team'
  const password = typeof req.body?.password === 'string' ? req.body.password : ''
  const confirmPassword = typeof req.body?.confirmPassword === 'string' ? req.body.confirmPassword : ''
  if (!email) return res.status(400).json({ message: 'Email required' })

  try {
    let user = await User.findOne({ email: email.toLowerCase() })

    if (user && user.verified) {
      return res.status(409).json({ message: 'An account already exists for this email.' })
    }

    if (password || confirmPassword) {
      if (!password || !confirmPassword) {
        return res.status(400).json({ message: 'Password and confirm password are required.' })
      }
      if (password !== confirmPassword) {
        return res.status(400).json({ message: 'Passwords do not match.' })
      }
      if (password.length < 6) {
        return res.status(400).json({ message: 'Password must be at least 6 characters.' })
      }
    }

    const fallbackName = name || String(email).split('@')[0] || 'User'
    const shouldCreateUser = !user

    if (!user) {
      if (!password) {
        return res.status(400).json({ message: 'Password is required for new accounts.' })
      }
      const salt = await bcrypt.genSalt(10)
      const passwordHash = await bcrypt.hash(password, salt)
      user = await User.create({ email: email.toLowerCase(), name: fallbackName, password: passwordHash, role, verified: false })
    } else {
      if (name) user.name = name
      user.role = role
      if (password) {
        const salt = await bcrypt.genSalt(10)
        user.password = await bcrypt.hash(password, salt)
      }
    }

    const otp = generateOtp(6)
    const codeHash = await hashOtp(otp)
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000)


    user.otp = { codeHash, expiresAt, attempts: 0 }
    await user.save()

    const sent = await sendOtpEmail({ to: email, otp })
    if (!sent) return res.status(500).json({ message: 'Failed to send OTP email' })

    return res.json({ ok: true, message: 'OTP sent' })
  } catch (err) {
    console.error('sendOtp error', err.message)
    return res.status(500).json({ message: 'Server error' })
  }
}

// POST /api/auth/login
const login = async (req, res) => {
  const { email, password, role } = req.body
  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password required.' })
  }

  try {
    const normalizedEmail = String(email || '').trim().toLowerCase()
    let user = await User.findOne({ email: normalizedEmail })

    // Backfill auth credentials for seeded/test teams that exist in Team collection
    // but do not yet have a User login record.
    if (!user && role === 'team') {
      const team = await Team.findOne({ email: normalizedEmail })
      if (team) {
        const salt = await bcrypt.genSalt(10)
        const passwordHash = await bcrypt.hash(TEMP_TEAM_PASSWORD, salt)
        user = await User.create({
          email: normalizedEmail,
          name: team.captainName || 'Team User',
          password: passwordHash,
          role: 'team',
          verified: true,
          teamAccess: 'full',
          isCaptain: true,
          teamInfo: {
            teamId: team._id,
            teamName: team.teamName || team.captainName || '',
            name: team.teamName || team.captainName || '',
            captainName: team.captainName || '',
          },
        })
      }
    }

    if (!user) {
      return res.status(404).json({ message: 'Account not found.' })
    }

    if (role && user.role !== role) {
      return res.status(403).json({ message: 'Account role does not match.' })
    }

    if (!user.verified) {
      return res.status(403).json({ message: 'Please verify your email first.' })
    }

    let ok = await bcrypt.compare(password, user.password)

    if (!ok && user.role === 'team' && password === TEMP_TEAM_PASSWORD) {
      const salt = await bcrypt.genSalt(10)
      user.password = await bcrypt.hash(TEMP_TEAM_PASSWORD, salt)
      await user.save()
      ok = true
    }

    if (!ok) {
      return res.status(401).json({ message: 'Incorrect password.' })
    }

    user.lastLogin = new Date()
    await user.save()

    if (user.role === 'team') {
      const team = await Team.findOne({ email: user.email })
      const inferredTeamAccess = user.teamAccess || (
        user.teamInfo?.captainName && user.name && String(user.name).trim() !== String(user.teamInfo.captainName).trim()
          ? 'basic'
          : 'full'
      )
      const inferredIsCaptain = typeof user.isCaptain === 'boolean'
        ? user.isCaptain
        : inferredTeamAccess !== 'basic'
      return res.json({
        ok: true,
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          teamInfo: {
            ...user.teamInfo,
            teamId: team?._id || user.teamInfo?.teamId || null,
            uid: team?.uid || '',
            teamName: team?.teamName || team?.captainName || user.teamInfo?.teamName || user.teamInfo?.captainName || '',
            name: team?.teamName || team?.captainName || user.teamInfo?.name || user.teamInfo?.teamName || user.teamInfo?.captainName || '',
            captainName: team?.captainName || user.teamInfo?.captainName || user.name || '',
            location: team?.location || '',
            district: team?.district || '',
          },
          teamAccess: team ? 'full' : inferredTeamAccess,
          isCaptain: team ? true : inferredIsCaptain,
          teamProfileCompleted: team?.teamProfileCompleted || false,
          ownerProfile: user.ownerProfile,
          verified: user.verified,
        },
        team: team || null,
      })
    }

    return res.json({
      ok: true,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        ownerProfile: user.ownerProfile,
        profileCompleted: user.profileCompleted,
        verified: user.verified,
      },
    })
  } catch (err) {
    console.error('login error', err.message)
    return res.status(500).json({ message: 'Server error' })
  }
}

// POST /api/auth/verify-otp
const verifyOtp = async (req, res) => {
  const { email, otp } = req.body
  if (!email || !otp) return res.status(400).json({ message: 'Email and OTP required' })

  try {
    const user = await User.findOne({ email: email.toLowerCase() })
    if (!user || !user.otp || !user.otp.codeHash) return res.status(400).json({ message: 'OTP not found. Please request a new code.' })

    if (user.otp.attempts >= MAX_ATTEMPTS) return res.status(429).json({ message: 'Too many incorrect attempts. Request a new code.' })

    if (user.otp.expiresAt && new Date() > new Date(user.otp.expiresAt)) return res.status(400).json({ message: 'OTP expired. Request a new code.' })

    const ok = await compareOtpHash(otp, user.otp.codeHash)
    if (!ok) {
      user.otp.attempts = (user.otp.attempts || 0) + 1
      await user.save()
      return res.status(400).json({ message: 'Incorrect OTP' })
    }

    // Mark verified
    user.verified = true

    // If a password was supplied during verification, hash and save it
    const newPassword = req.body && req.body.password ? String(req.body.password) : null
    if (newPassword) {
      if (newPassword.length < 6) {
        return res.status(400).json({ message: 'Password must be at least 6 characters.' })
      }
      try {
        const salt = await bcrypt.genSalt(10)
        const passwordHash = await bcrypt.hash(newPassword, salt)
        user.password = passwordHash
      } catch (err) {
        console.error('hash password error', err.message)
        return res.status(500).json({ message: 'Failed to set password' })
      }
    }

    user.otp = { codeHash: null, expiresAt: null, attempts: 0 }
    await user.save()

    // If there is a pending registration for this email, finalize it by creating the Team
    try {
      const pending = await PendingRegistration.findOne({ email: user.email })
      if (pending) {
        if (pending.role === 'team') {
          // Ensure no existing team (race-safe)
          const existingTeam = await Team.findOne({ email: user.email })
          let createdTeam = null
          if (!existingTeam) {
            createdTeam = await Team.create({
              captainName: pending.captainName || user.name || 'Team',
              email: user.email,
              teamProfileCompleted: false,
            })
          }

          // Remove pending registration record
          await PendingRegistration.deleteOne({ _id: pending._id })

          return res.json({ ok: true, message: 'Email verified', team: createdTeam || existingTeam, user: { _id: user._id, name: user.name, email: user.email, role: user.role } })
        }

        user.name = pending.captainName || user.name || 'Owner'
        user.role = 'owner'
        await user.save()
        await PendingRegistration.deleteOne({ _id: pending._id })

        return res.json({ ok: true, message: 'Email verified', user: { _id: user._id, name: user.name, email: user.email, role: user.role } })
      }
    } catch (err) {
      console.error('finalize pending registration error', err.message)
      // Fall through and return verification success even if team creation failed
    }

    return res.json({ ok: true, message: 'Email verified', user: { _id: user._id, name: user.name, email: user.email, role: user.role } })
  } catch (err) {
    console.error('verifyOtp error', err.message)
    return res.status(500).json({ message: 'Server error' })
  }
}

// POST /api/auth/resend-otp
const resendOtp = async (req, res) => {
  const { email } = req.body
  if (!email) return res.status(400).json({ message: 'Email required' })

  try {
    const user = await User.findOne({ email: email.toLowerCase() })
    if (!user) return res.status(404).json({ message: 'User not found' })
    const role = user.role === 'owner' ? 'owner' : 'team'

    const otp = generateOtp(6)
    const codeHash = await hashOtp(otp)
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000)


    user.role = role
    user.otp = { codeHash, expiresAt, attempts: 0 }
    await user.save()

    const sent = await sendOtpEmail({ to: email, otp })
    if (!sent) return res.status(500).json({ message: 'Failed to send OTP email' })

    return res.json({ ok: true, message: 'OTP resent' })
  } catch (err) {
    console.error('resendOtp error', err.message)
    return res.status(500).json({ message: 'Server error' })
  }
}

module.exports = { sendOtp, verifyOtp, resendOtp, login }
