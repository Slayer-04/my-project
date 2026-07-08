const mongoose = require('mongoose')
const dotenv = require('dotenv')
const Challenge = require('../models/Challenge')
const Booking = require('../models/Booking')

dotenv.config()

const MONGODB_URI = process.env.MONGODB_URI

const run = async () => {
  if (!MONGODB_URI) {
    throw new Error('Missing MONGODB_URI in environment variables.')
  }

  await mongoose.connect(MONGODB_URI)

  const acceptedChallenges = await Challenge.find({ status: 'accepted' })
  console.log(`Found ${acceptedChallenges.length} accepted challenges to check.`)

  let createdCount = 0

  for (const challenge of acceptedChallenges) {
    const fromTeam = String(challenge.from || '').trim()
    const toTeam = String(challenge.to || '').trim()
    const date = String(challenge.date || '').trim()
    const time = String(challenge.time || '').trim()
    const venue = String(challenge.venue || '').trim()

    if (!fromTeam || !toTeam || fromTeam.toLowerCase() === toTeam.toLowerCase()) continue

    const pairs = [
      [fromTeam, toTeam],
      [toTeam, fromTeam],
    ]

    for (const [teamName, opponentName] of pairs) {
      const existing = await Booking.findOne({
        team: teamName,
        opponent: opponentName,
        date,
        time,
        venue,
        status: { $ne: 'cancelled' },
      })

      if (existing) continue

      await Booking.create({
        team: teamName,
        opponent: opponentName,
        date,
        time,
        venue,
        status: 'confirmed',
        players: 11,
        amount: 'Rs. 1,200',
        challengeId: challenge._id,
      })

      createdCount += 1
      console.log(`Created missing booking for "${teamName}" vs "${opponentName}" on ${date} at ${time} (${venue}).`)
    }
  }

  console.log(`Done. Created ${createdCount} missing booking(s).`)
  await mongoose.disconnect()
}

run().catch(error => {
  console.error('Backfill failed:', error)
  process.exit(1)
})