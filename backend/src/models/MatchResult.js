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

module.exports = mongoose.model('MatchResult', MatchResultSchema)