const mongoose = require('mongoose')

const MatchResultSchema = new mongoose.Schema(
  {
    bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true },
    team: { type: String, required: true, trim: true }, // Team submitting score
    opponent: { type: String, required: true, trim: true },
    myScore: { type: Number, required: true, min: 0, max: 100 },
    opponentScore: { type: Number, required: true, min: 0, max: 100 },
    matchDate: { type: String, required: true },
    matchTime: { type: String, required: true },
    venue: { type: String, required: true, trim: true },
    submittedBy: { type: String, required: true, trim: true }, // Captain name
    verified: { type: Boolean, default: false }, // Both teams need to verify
    verifiedByOpponent: { type: Boolean, default: false },
    opponentScore: { type: Number, default: null }, // Opponent's submitted score (if different)
    timestamp: { type: Date, default: () => new Date() },
  },
  { timestamps: true }
)

module.exports = mongoose.model('MatchResult', MatchResultSchema)
