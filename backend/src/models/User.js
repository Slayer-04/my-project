const mongoose = require('mongoose')

const UserSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true, unique: true },
    password: { type: String, required: true }, // Should be hashed
    role: {
      type: String,
      enum: ['team', 'owner', 'admin'],
      required: true,
    },
    teamInfo: {
      teamId: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', default: null },
      teamName: { type: String, default: '', trim: true },
      captainName: { type: String, default: '', trim: true },
    },
    ownerProfile: {
      venueName: { type: String, default: '', trim: true },
      location: { type: String, default: '', trim: true },
      lat: { type: Number, default: null },
      lng: { type: Number, default: null },
      courts: { type: Number, default: 0, min: 0 },
      phone: { type: String, default: '', trim: true },
      hours: { type: String, default: '', trim: true },
      locationVerified: { type: Boolean, default: false },
    },
    status: {
      type: String,
      enum: ['active', 'inactive', 'suspended'],
      default: 'active',
    },
    profileCompleted: { type: Boolean, default: false },
    lastLogin: { type: Date, default: null },
    verified: { type: Boolean, default: false },
    verificationToken: { type: String, default: null },
    // Email verification / OTP subdocument
    otp: {
      codeHash: { type: String, default: null }, // bcrypt-hashed OTP
      expiresAt: { type: Date, default: null },
      attempts: { type: Number, default: 0 },
    },
  },
  { timestamps: true }
)

module.exports = mongoose.model('User', UserSchema)
