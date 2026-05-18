const mongoose = require('mongoose')

const BookingSchema = new mongoose.Schema(
  {
    team: { type: String, required: true, trim: true },
    teamEmail: { type: String, default: '', trim: true },
    venueId: { type: mongoose.Schema.Types.ObjectId, ref: 'Venue', default: null },
    venue: { type: String, required: true, trim: true },
    ownerName: { type: String, default: '', trim: true },
    ownerEmail: { type: String, default: '', trim: true },
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

// Only one confirmed booking is allowed for a given venue/time slot.
BookingSchema.index(
  { venue: 1, date: 1, time: 1, status: 1 },
  { unique: true, partialFilterExpression: { status: 'confirmed' } }
)

module.exports = mongoose.model('Booking', BookingSchema)