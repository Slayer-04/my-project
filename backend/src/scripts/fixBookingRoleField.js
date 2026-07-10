// One-time migration: assigns `role` ('primary' | 'secondary') to existing
// confirmed Booking documents, and creates the new global slot-exclusivity
// index: only one PRIMARY confirmed booking may exist per venue/date/time,
// no matter which team holds it.
//
// Why this is needed: match bookings come in pairs (one per team) sharing the
// exact same venue/date/time. If we just defaulted every existing document to
// 'primary', the new unique index would immediately reject the second booking
// of every existing match pair. This script picks exactly one booking per
// slot to keep as 'primary' and demotes the rest to 'secondary' first, then
// creates the index.
//
// Run once, after fixBookingUniqueIndex.js / fixChallengeDuplicates.js:
//   node src/scripts/fixBookingRoleField.js

const mongoose = require('mongoose')
const dotenv = require('dotenv')
const Booking = require('../models/Booking')

dotenv.config()

const MONGODB_URI = process.env.MONGODB_URI

const norm = value => String(value || '').trim()

const run = async () => {
  if (!MONGODB_URI) {
    throw new Error('Missing MONGODB_URI in environment variables.')
  }

  await mongoose.connect(MONGODB_URI)

  const confirmedBookings = await Booking.find({ status: 'confirmed' }).sort({ createdAt: 1 })
  console.log(`Found ${confirmedBookings.length} confirmed bookings.`)

  const bySlot = new Map()
  for (const booking of confirmedBookings) {
    const slotKey = `${norm(booking.venue).toLowerCase()}|${norm(booking.date)}|${norm(booking.time)}`
    if (!bySlot.has(slotKey)) bySlot.set(slotKey, [])
    bySlot.get(slotKey).push(booking)
  }

  let primaryCount = 0
  let secondaryCount = 0

  for (const [slotKey, group] of bySlot.entries()) {
    // Keep the earliest-created booking in the slot as primary; demote the rest.
    const [primary, ...rest] = group

    if (primary.role !== 'primary') {
      primary.role = 'primary'
      await primary.save()
    }
    primaryCount += 1

    for (const secondary of rest) {
      if (secondary.role !== 'secondary') {
        secondary.role = 'secondary'
        await secondary.save()
      }
      secondaryCount += 1
    }

    if (rest.length > 1) {
      console.log(`Slot "${slotKey}" had ${group.length} confirmed bookings (expected at most 2) — kept 1 primary, demoted ${rest.length} to secondary. Investigate if this looks wrong.`)
    }
  }

  console.log(`Assigned role: primary=${primaryCount}, secondary=${secondaryCount}.`)

  console.log('Syncing indexes with the current schema...')
  await Booking.syncIndexes()

  const finalIndexes = await Booking.collection.indexes()
  console.log('Current indexes:', finalIndexes.map(i => ({ name: i.name, key: i.key, unique: !!i.unique })))

  console.log('Done.')
  await mongoose.disconnect()
}

run().catch(error => {
  console.error('Migration failed:', error)
  process.exit(1)
})