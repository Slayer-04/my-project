const mongoose = require('mongoose')

const MatchResultSchema = new mongoose.Schema(
  {
    // bookingId can be a MongoDB ObjectId (DB bookings) OR a numeric/string id
    // (locally-created bookings from the frontend), so we use Mixed to accept both.
    bookingId: { type: mongoose.Schema.Types.Mixed, required: true },
    team: { type: String, required: true, trim: true },
    opponent: { type: String, required: true, trim: true },
    myScore: { type: Number, required: true, min: 0, max: 100 },
    opponentScore: { type: Number, required: true, min: 0, max: 100 },
    matchDate: { type: String, required: true },
    matchTime: { type: String, required: true },
    venue: { type: String, required: true, trim: true },
    submittedBy: { type: String, required: true, trim: true },
    verified: { type: Boolean, default: false },
    verifiedByOpponent: { type: Boolean, default: false },
    timestamp: { type: Date, default: () => new Date() },
  },
  { timestamps: true }
)

// Prevent the same team from having more than one result recorded for the
// same booking. Without this, a resubmission (e.g. triggered by the frontend
// re-prompting for a score it had already saved) creates a duplicate document
// and double-applies the ELO/win-loss update for that match.
MatchResultSchema.index({ bookingId: 1, team: 1 }, { unique: true })

module.exports = mongoose.model('MatchResult', MatchResultSchema)