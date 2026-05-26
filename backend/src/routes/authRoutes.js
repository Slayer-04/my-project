const express = require('express')
const router = express.Router()
const { sendOtp, verifyOtp, resendOtp, login } = require('../controllers/authController')

router.post('/send-otp', sendOtp)
router.post('/verify-otp', verifyOtp)
router.post('/resend-otp', resendOtp)
router.post('/login', login)

module.exports = router
