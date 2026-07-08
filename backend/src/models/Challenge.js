const mongoose = require('mongoose')

const ChallengeSchema = new mongoose.Schema(
  {
    from: { type: String, required: true, trim: true },
    to: { type: String, required: true, trim: true },
    date: { type: String, required: true, trim: true },
    time: { type: String, required: true, trim: true },
    venue: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'declined', 'cancelled'],
      default: 'pending',
    },
    note: { type: String, default: '', trim: true },
    acceptedAt: { type: Date, default: null }, // When was it accepted
    sentAt: { type: Date, default: () => new Date() }, // When was challenge sent
    // Order-independent key identifying the two teams involved, e.g. "dhobighat warriors::itapukhu boys".
    // Used to enforce (at the database level) that a team pair can have only one
    // pending challenge between them at a time, regardless of who challenged whom.
    pairKey: { type: String, default: '', index: true },
  },
  { timestamps: true }
)

// A given pair of teams may only have ONE pending challenge between them at a time.
// This blocks duplicates even under concurrent requests, race conditions, or if a
// client bypasses the app-level check in the route handler.
ChallengeSchema.index(
  { pairKey: 1, status: 1 },
  { unique: true, partialFilterExpression: { status: 'pending' } }
)

module.exports = mongoose.model('Challenge', ChallengeSchema)