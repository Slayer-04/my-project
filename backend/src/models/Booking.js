const mongoose = require('mongoose')

const BookingSchema = new mongoose.Schema(
  {
    team: { type: String, required: true, trim: true },
    venue: { type: String, required: true, trim: true },
    date: { type: String, required: true, trim: true },
    time: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ['confirmed', 'pending', 'cancelled'],
      default: 'pending',
    },
    players: { type: Number, required: true, min: 1 },
    amount: { type: String, required: true, trim: true },
    opponent: { type: String, default: '', trim: true }, // Team name of opponent (for challenges)
    challengeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Challenge', default: null }, // Reference to challenge
    note: { type: String, default: '', trim: true },
  },
  { timestamps: true }
)

module.exports = mongoose.model('Booking', BookingSchema)