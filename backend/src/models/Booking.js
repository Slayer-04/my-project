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
    matchPostId: { type: mongoose.Schema.Types.ObjectId, ref: 'MatchPost', default: null }, // Reference to a Find-Match post, if this booking came from one
    note: { type: String, default: '', trim: true },
    // A match/venue slot is shared by (at most) two bookings once a challenge is
    // accepted - one per team, both at the exact same venue/date/time. Only ONE
    // of those two documents is ever marked `primary`; the other is `secondary`.
    // This lets the unique index below enforce "this slot belongs to exactly one
    // match/booking, globally" while still allowing both teams to have their own
    // booking record (each showing up on their own dashboard).
    role: {
      type: String,
      enum: ['primary', 'secondary'],
      default: 'primary',
    },
  },
  { timestamps: true }
)

// Only one confirmed booking is allowed per TEAM for a given venue/date/time slot.
// NOTE: `team` must be part of this index. A confirmed match booking always creates
// TWO documents for the same venue/date/time (one per team) - without `team` here,
// the second insert would violate uniqueness and fail, silently leaving one side of
// the match without a booking (it would then never show up on that team's dashboard).
BookingSchema.index(
  { team: 1, venue: 1, date: 1, time: 1, status: 1 },
  { unique: true, partialFilterExpression: { status: 'confirmed' } }
)

// GLOBAL slot exclusivity: only one PRIMARY confirmed booking may exist for a
// given venue/date/time, no matter which team holds it. This is what actually
// prevents two different teams (or a team and an unrelated venue booking) from
// ever both ending up with a confirmed reservation for the same slot. It is
// enforced atomically by MongoDB itself, so it is race-safe even without an
// application-level transaction: whichever insert loses the race gets an
// E11000 duplicate-key error and must be treated as "slot no longer available".
BookingSchema.index(
  { venue: 1, date: 1, time: 1 },
  { unique: true, partialFilterExpression: { status: 'confirmed', role: 'primary' } }
)

module.exports = mongoose.model('Booking', BookingSchema)