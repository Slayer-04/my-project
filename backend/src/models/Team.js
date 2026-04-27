const mongoose = require('mongoose')

const TeamSchema = new mongoose.Schema(
  {
    captainName: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true, unique: true },
    teamName: { type: String, default: '', trim: true },
    district: { type: String, default: '', trim: true },
    location: { type: String, default: '', trim: true },
    skill: {
      type: String,
      enum: ['Beginner', 'Intermediate', 'Advanced', ''],
      default: '',
    },
    teamProfileCompleted: { type: Boolean, default: false },
    locationVerified: { type: Boolean, default: false },
    skillLocked: { type: Boolean, default: false },
    locationLocked: { type: Boolean, default: false },
    profileCompletedAt: { type: Date, default: null },
    preferredDay: {
      type: String,
      enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday', ''],
      default: '',
      trim: true,
    },
    preferredTime: { type: String, default: '', trim: true },
    lat: { type: Number, default: null },
    lng: { type: Number, default: null },
    eloRating: { type: Number, default: 1000, min: 100, max: 3000 },
    eloMatchesPlayed: { type: Number, default: 0, min: 0 },
    matchesWon: { type: Number, default: 0, min: 0 },
    matchesLost: { type: Number, default: 0, min: 0 },
    currentStreak: { type: Number, default: 0 },
  },
  { timestamps: true }
)

module.exports = mongoose.model('Team', TeamSchema)
