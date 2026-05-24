const nodemailer = require('nodemailer')
const dotenv = require('dotenv')
const sendgrid = require('@sendgrid/mail')

dotenv.config()

let transporter = null

const initSendGrid = () => {
  const apiKey = process.env.SENDGRID_API_KEY
  if (!apiKey) return false
  try {
    sendgrid.setApiKey(apiKey)
    return true
  } catch (err) {
    console.error('[Email] SendGrid init failed', err.message)
    return false
  }
}

const initTransporter = () => {
  if (process.env.SENDGRID_API_KEY) {
    const ok = initSendGrid()
    if (ok) return 'sendgrid'
  }

  if (transporter) return transporter

  const user = process.env.EMAIL_USER
  const pass = process.env.EMAIL_PASS
  if (!user || !pass) {
    console.warn('[Email] EMAIL_USER or EMAIL_PASS not set in environment')
    return null
  }

  transporter = nodemailer.createTransport({
    host: process.env.EMAIL_SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.EMAIL_SMTP_PORT || 465),
    secure: String(process.env.EMAIL_SMTP_SECURE || 'true') === 'true',
    auth: { user, pass },
  })

  return transporter
}

const verifyTransport = async () => {
  if (process.env.SENDGRID_API_KEY) {
    const ok = initSendGrid()
    if (ok) {
      console.log('[Email] SendGrid API key present')
      return { ok: true, provider: 'sendgrid' }
    }
    return { ok: false, message: 'SendGrid init failed' }
  }

  const t = initTransporter()
  if (!t) {
    console.warn('[Email] Transporter not configured; skipping SMTP verify')
    return { ok: false, message: 'Transporter not configured' }
  }

  try {
    await t.verify()
    console.log('[Email] SMTP transporter verified')
    return { ok: true, provider: 'smtp' }
  } catch (err) {
    console.error('[Email] SMTP verify failed:', err.message)
    return { ok: false, message: err.message }
  }
}

const sendOtpEmail = async ({ to, otp, appName = 'FotMatch' }) => {
  const provider = initTransporter()

  const html = `<div style="font-family: Arial; font-size: 16px;">
      <p>Hi,</p>
      <p>Your verification code is:</p>
      <h2 style="letter-spacing: 6px">${otp}</h2>
      <p>This code will expire in 10 minutes.</p>
      <p>If you didn't request this, ignore this email.</p>
    </div>`

  if (provider === 'sendgrid') {
    try {
      await sendgrid.send({
        to,
        from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
        subject: `${appName} - Verify your email`,
        html,
      })
      return true
    } catch (err) {
      console.error('[Email] SendGrid send failed:', err.message)
      return false
    }
  }

  if (!provider) {
    // Fallback: log OTP to console for local dev
    console.warn('[Email] No email provider configured — OTP (console fallback):', otp)
    return true
  }

  const mailOptions = {
    from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
    to,
    subject: `${appName} - Verify your email`,
    html,
  }

  try {
    await provider.sendMail(mailOptions)
    return true
  } catch (err) {
    console.error('[Email] Failed to send OTP email', err.message)
    return false
  }
}

module.exports = { sendOtpEmail, verifyTransport }
