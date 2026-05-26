const mongoose = require('mongoose')

const PendingRegistrationSchema = new mongoose.Schema({
  email: { type: String, required: true, trim: true, lowercase: true, index: true },
  captainName: { type: String, required: true, trim: true },
  role: { type: String, default: 'team' },
  createdAt: { type: Date, default: Date.now },
})

module.exports = mongoose.model('PendingRegistration', PendingRegistrationSchema)
