const mongoose = require('mongoose')

const TeamJoinRequestSchema = new mongoose.Schema(
  {
    teamId: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true, index: true },
    teamUid: { type: String, required: true, trim: true, index: true },
    teamName: { type: String, default: '', trim: true },
    captainName: { type: String, default: '', trim: true },
    captainEmail: { type: String, default: '', trim: true, lowercase: true },
    requesterName: { type: String, required: true, trim: true },
    requesterEmail: { type: String, required: true, trim: true, lowercase: true },
    message: { type: String, default: '', trim: true },
    status: {
      type: String,
      enum: ['pending', 'approved', 'declined', 'left'],
      default: 'pending',
      index: true,
    },
    reviewedAt: { type: Date, default: null },
  },
  { timestamps: true }
)

TeamJoinRequestSchema.index({ teamUid: 1, requesterEmail: 1, status: 1 })

module.exports = mongoose.model('TeamJoinRequest', TeamJoinRequestSchema)
