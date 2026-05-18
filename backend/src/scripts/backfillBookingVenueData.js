const mongoose = require('mongoose')
const dotenv = require('dotenv')
const Booking = require('../models/Booking')
const Venue = require('../models/Venue')

dotenv.config()

const MONGODB_URI = process.env.MONGODB_URI

const normalize = value => (typeof value === 'string' ? value.trim() : '')

const run = async () => {
  if (!MONGODB_URI) {
    throw new Error('Missing MONGODB_URI in environment variables.')
  }

  await mongoose.connect(MONGODB_URI)

  const venues = await Venue.find({})
  const venueByName = new Map(venues.map(v => [normalize(v.name).toLowerCase(), v]))

  const bookings = await Booking.find({}).sort({ createdAt: 1 })

  let updatedCount = 0
  const confirmedSlotMap = new Map()

  for (const booking of bookings) {
    let changed = false

    const venueNameKey = normalize(booking.venue).toLowerCase()
    const linkedVenue = venueByName.get(venueNameKey)

    if (linkedVenue && !booking.venueId) {
      booking.venueId = linkedVenue._id
      changed = true
    }

    if (linkedVenue && !normalize(booking.ownerName)) {
      booking.ownerName = normalize(linkedVenue.owner)
      changed = true
    }

    if (linkedVenue && !normalize(booking.ownerEmail)) {
      booking.ownerEmail = normalize(linkedVenue.ownerEmail).toLowerCase()
      changed = true
    }

    if (booking.teamEmail) {
      const normalizedTeamEmail = normalize(booking.teamEmail).toLowerCase()
      if (booking.teamEmail !== normalizedTeamEmail) {
        booking.teamEmail = normalizedTeamEmail
        changed = true
      }
    }

    if (booking.status === 'confirmed') {
      const slotVenueKey = booking.venueId
        ? String(booking.venueId)
        : normalize(booking.venue).toLowerCase()
      const slotKey = `${slotVenueKey}|${booking.date}|${booking.time}`

      if (confirmedSlotMap.has(slotKey)) {
        booking.status = 'cancelled'
        changed = true
      } else {
        confirmedSlotMap.set(slotKey, booking._id)
      }
    }

    if (changed) {
      await booking.save()
      updatedCount += 1
    }
  }

  console.log(`Backfill complete. Updated ${updatedCount} booking(s).`)
}

run()
  .then(() => mongoose.disconnect())
  .catch(async error => {
    console.error('Backfill failed:', error.message)
    await mongoose.disconnect()
    process.exit(1)
  })
