const mongoose = require('mongoose')

const NotificationSchema = new mongoose.Schema(
  {
    team: { type: String, required: true, trim: true },
    text: { type: String, required: true, trim: true },
    time: { type: String, default: 'just now', trim: true },
    unread: { type: Boolean, default: true },
    type: {
      type: String,
      enum: ['challenge-request', 'join-request', 'match-update', 'score-submission', 'general'],
      default: 'general',
    },
    challengeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Challenge', default: null },
    bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', default: null },
    joinRequestId: { type: mongoose.Schema.Types.ObjectId, default: null },
    joinRequestStatus: {
      type: String,
      enum: ['pending', 'approved', 'declined', 'left', ''],
      default: '',
    },
    requesterName: { type: String, default: '', trim: true },
    requesterEmail: { type: String, default: '', trim: true, lowercase: true },
    teamUid: { type: String, default: '', trim: true },
    createdAt: { type: Date, default: () => new Date() },
  },
  { timestamps: true }
)

// Remove default updatedAt for notifications, keep only createdAt
NotificationSchema.set('timestamps', false)

module.exports = mongoose.model('Notification', NotificationSchema)
