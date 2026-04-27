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
  },
  { timestamps: true }
)

module.exports = mongoose.model('Challenge', ChallengeSchema)