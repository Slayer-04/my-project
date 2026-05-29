const crypto = require('crypto')
const mongoose = require('mongoose')

const generateUid = () => String(crypto.randomInt(10000000, 100000000))

const VenueSchema = new mongoose.Schema(
  {
    uid: { type: String, required: true, unique: true, index: true, default: generateUid, immutable: true },
    name: { type: String, required: true, trim: true, unique: true },
    location: { type: String, required: true, trim: true },
    rating: { type: Number, required: true, min: 0, max: 5 },
    price: { type: String, required: true, trim: true },
    emoji: { type: String, default: '🏟️' },
    type: {
      type: String,
      enum: ['Indoor', 'Outdoor'],
      required: true,
    },
    courts: { type: Number, required: true, min: 1 },
    pricePerHour: { type: Number, required: true, min: 0 },
    pricing: {
      weekdayDay: { type: Number, default: 1200, min: 0 },
      weekdayEvening: { type: Number, default: 1500, min: 0 },
      weekend: { type: Number, default: 1800, min: 0 },
      eveningStart: { type: String, default: '18:00' },
    },
    lat: { type: Number, default: null },
    lng: { type: Number, default: null },
    operatingHours: {
      open: { type: String, default: '06:00' },
      close: { type: String, default: '22:00' },
    },
    owner: { type: String, default: '', trim: true },
    ownerEmail: { type: String, default: '', trim: true },
    contactPhone: { type: String, default: '', trim: true },
    amenities: [{ type: String }],
    availability: {
      monday: { type: Boolean, default: true },
      tuesday: { type: Boolean, default: true },
      wednesday: { type: Boolean, default: true },
      thursday: { type: Boolean, default: true },
      friday: { type: Boolean, default: true },
      saturday: { type: Boolean, default: true },
      sunday: { type: Boolean, default: true },
    },
  },
  { timestamps: true }
)

module.exports = mongoose.model('Venue', VenueSchema)
