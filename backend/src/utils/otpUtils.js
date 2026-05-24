const crypto = require('crypto')
const bcrypt = require('bcryptjs')

const generateOtp = (digits = 6) => {
  const max = 10 ** digits
  const num = crypto.randomInt(0, max)
  return String(num).padStart(digits, '0')
}

const hashOtp = async (otp) => {
  const salt = await bcrypt.genSalt(10)
  return bcrypt.hash(otp, salt)
}

const compareOtpHash = async (otp, hash) => {
  return bcrypt.compare(otp, hash)
}

module.exports = { generateOtp, hashOtp, compareOtpHash }
