const mongoose = require('mongoose')

const MatchPostSchema = new mongoose.Schema(
  {
    team: { type: String, required: true, trim: true },
    venue: { type: String, required: true, trim: true },
    venueId: { type: mongoose.Schema.Types.ObjectId, ref: 'Venue', default: null },
    date: { type: String, required: true, trim: true },
    time: { type: String, required: true, trim: true },
    players: { type: Number, default: 8 },
    note: { type: String, default: '', trim: true },
    visibilityHours: { type: Number, default: 24 },
    status: {
      type: String,
      // open       - visible, waiting for a request
      // requested  - a team has requested it, waiting on the poster to accept/decline
      // accepted   - a match was confirmed from this post (kept briefly for reference, then removed)
      // expired    - the slot became unavailable (booked elsewhere) before it could be accepted
      // cancelled  - the poster removed it manually
      enum: ['open', 'requested', 'accepted', 'expired', 'cancelled'],
      default: 'open',
    },
    requestedBy: { type: String, default: null, trim: true },
    challengeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Challenge', default: null },
  },
  { timestamps: true }
)

// Fast lookups when checking "is there an open/requested post for this exact slot"
MatchPostSchema.index({ venue: 1, date: 1, time: 1, status: 1 })
MatchPostSchema.index({ team: 1, status: 1 })

module.exports = mongoose.model('MatchPost', MatchPostSchema)