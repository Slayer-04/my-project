const mongoose = require('mongoose')

const TeamSchema = new mongoose.Schema(
  {
    captainName: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true, unique: true },
    teamName: { type: String, default: '', trim: true },
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
  },
  { timestamps: true }
)

module.exports = mongoose.model('Team', TeamSchema)
