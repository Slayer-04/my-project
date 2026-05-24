const User = require('../models/User')
const { generateOtp, hashOtp, compareOtpHash } = require('../utils/otpUtils')
const bcrypt = require('bcryptjs')
const { sendOtpEmail } = require('../utils/emailUtils')

const OTP_EXPIRY_MINUTES = Number(process.env.OTP_EXP_MIN || 10)
const MAX_ATTEMPTS = Number(process.env.OTP_MAX_ATTEMPTS || 5)

// POST /api/auth/send-otp
const sendOtp = async (req, res) => {
  const { email } = req.body
  if (!email) return res.status(400).json({ message: 'Email required' })

  try {
    let user = await User.findOne({ email: email.toLowerCase() })
    if (!user) {
      // Create minimal user record (password must be set later)
      const fallbackName = String(email).split('@')[0] || 'User'
      user = await User.create({ email: email.toLowerCase(), name: fallbackName, password: 'placeholder', role: 'team' })
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

    return res.json({ ok: true, message: 'Email verified' })
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

    const otp = generateOtp(6)
    const codeHash = await hashOtp(otp)
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000)

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

module.exports = { sendOtp, verifyOtp, resendOtp }
