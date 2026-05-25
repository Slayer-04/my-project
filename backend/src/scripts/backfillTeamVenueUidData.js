const crypto = require('crypto')
const mongoose = require('mongoose')
const dotenv = require('dotenv')
const Team = require('../models/Team')
const Venue = require('../models/Venue')

dotenv.config()

const MONGODB_URI = process.env.MONGODB_URI

const generateUid = () => String(crypto.randomInt(10000000, 100000000))

const collectExistingUids = async () => {
  const [teams, venues] = await Promise.all([
    Team.find({}, { uid: 1 }).lean(),
    Venue.find({}, { uid: 1 }).lean(),
  ])

  return new Set(
    [...teams, ...venues]
      .map(item => String(item.uid || '').trim())
      .filter(Boolean)
  )
}

const nextUniqueUid = async existingUids => {
  let uid = generateUid()
  while (existingUids.has(uid)) {
    uid = generateUid()
  }
  existingUids.add(uid)
  return uid
}

const run = async () => {
  if (!MONGODB_URI) {
    throw new Error('Missing MONGODB_URI in environment variables.')
  }

  await mongoose.connect(MONGODB_URI)

  const existingUids = await collectExistingUids()

  const teams = await Team.find({ $or: [{ uid: { $exists: false } }, { uid: null }, { uid: '' }] })
  const venues = await Venue.find({ $or: [{ uid: { $exists: false } }, { uid: null }, { uid: '' }] })

  let updatedTeams = 0
  for (const team of teams) {
    team.uid = await nextUniqueUid(existingUids)
    await team.save()
    updatedTeams += 1
  }

  let updatedVenues = 0
  for (const venue of venues) {
    venue.uid = await nextUniqueUid(existingUids)
    await venue.save()
    updatedVenues += 1
  }

  console.log(`UID backfill complete. Updated ${updatedTeams} team(s) and ${updatedVenues} venue(s).`)
}

run()
  .then(() => mongoose.disconnect())
  .catch(async error => {
    console.error('UID backfill failed:', error.message)
    await mongoose.disconnect()
    process.exit(1)
  })
