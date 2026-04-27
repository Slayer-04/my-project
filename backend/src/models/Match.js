const mongoose = require('mongoose')

const MatchSchema = new mongoose.Schema(
  {
    bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true },
    team: { type: String, required: true, trim: true }, // Team that played
    opponent: { type: String, required: true, trim: true }, // Opponent team
    venue: { type: String, required: true, trim: true },
    date: { type: String, required: true, trim: true },
    time: { type: String, required: true, trim: true },
    myScore: { type: Number, required: true, min: 0 },
    opponentScore: { type: Number, required: true, min: 0 },
    result: {
      type: String,
      enum: ['win', 'loss', 'draw'],
      required: true,
    },
    note: { type: String, default: '', trim: true },
  },
  { timestamps: true }
)

module.exports = mongoose.model('Match', MatchSchema)