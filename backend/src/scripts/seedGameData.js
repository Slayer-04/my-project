const mongoose = require('mongoose')
const dotenv = require('dotenv')
const Booking = require('../models/Booking')
const Challenge = require('../models/Challenge')
const Match = require('../models/Match')

dotenv.config()

const MONGODB_URI = process.env.MONGODB_URI

const bookings = [
  { team: 'Thunder Strikers', venue: 'Arena Futsal Park', date: '2025-03-15', time: '08:00 AM', status: 'confirmed', players: 10, amount: 'Rs. 1,200' },
  { team: 'Green Eagles', venue: 'Champions Court', date: '2025-03-16', time: '07:00 AM', status: 'pending', players: 8, amount: 'Rs. 1,000' },
  { team: 'Red Wolves', venue: 'Goal Zone Futsal', date: '2025-03-14', time: '06:00 AM', status: 'confirmed', players: 10, amount: 'Rs. 1,400' },
  { team: 'Blue Phoenix', venue: 'Arena Futsal Park', date: '2025-03-17', time: '04:00 PM', status: 'cancelled', players: 7, amount: 'Rs. 1,200' },
  { team: 'Night Owls', venue: 'Patan Sports Hub', date: '2025-03-18', time: '09:00 AM', status: 'confirmed', players: 9, amount: 'Rs. 900' },
  { team: 'Storm United', venue: 'Champions Court', date: '2025-03-19', time: '03:00 PM', status: 'pending', players: 10, amount: 'Rs. 1,000' },
]

const challenges = [
  { from: 'Thunder Strikers', to: 'My Team', date: '2025-03-16', time: '06:00 PM', venue: 'Arena Futsal Park', status: 'pending' },
  { from: 'My Team', to: 'Red Wolves', date: '2025-03-20', time: '08:00 AM', venue: 'Champions Court', status: 'accepted' },
  { from: 'Green Eagles', to: 'My Team', date: '2025-03-22', time: '10:00 AM', venue: 'Goal Zone Futsal', status: 'declined' },
  { from: 'My Team', to: 'Storm United', date: '2025-03-25', time: '06:00 PM', venue: 'Patan Sports Hub', status: 'pending' },
]

const matches = [
  { opponent: 'Thunder Strikers', score: '3-2', result: 'win', date: 'Mar 10, 2025', venue: 'Arena Futsal Park' },
  { opponent: 'Night Owls', score: '1-4', result: 'loss', date: 'Mar 5, 2025', venue: 'Champions Court' },
  { opponent: 'Storm United', score: '2-2', result: 'draw', date: 'Feb 28, 2025', venue: 'Goal Zone Futsal' },
  { opponent: 'Green Eagles', score: '5-1', result: 'win', date: 'Feb 22, 2025', venue: 'Arena Futsal Park' },
  { opponent: 'Blue Phoenix', score: '3-0', result: 'win', date: 'Feb 15, 2025', venue: 'Patan Sports Hub' },
]

async function seedCollection(Model, records, label) {
  await Model.deleteMany({})
  await Model.insertMany(records)
  console.log(`Seeded ${records.length} ${label} records.`)
}

async function main() {
  if (!MONGODB_URI) {
    throw new Error('Missing MONGODB_URI in environment variables.')
  }

  await mongoose.connect(MONGODB_URI)

  await seedCollection(Booking, bookings, 'booking')
  await seedCollection(Challenge, challenges, 'challenge')
  await seedCollection(Match, matches, 'match')

  console.log('Game data seeding complete.')
}

main()
  .catch((error) => {
    console.error('Failed to seed game data:', error.message)
    process.exitCode = 1
  })
  .finally(async () => {
    await mongoose.disconnect()
  })