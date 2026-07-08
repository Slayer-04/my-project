const mongoose = require('mongoose')
const dotenv = require('dotenv')
const Challenge = require('../models/Challenge')

dotenv.config()

const MONGODB_URI = process.env.MONGODB_URI

const pairKeyFor = (from, to) => [String(from || '').trim().toLowerCase(), String(to || '').trim().toLowerCase()].sort().join('::')

const run = async () => {
  if (!MONGODB_URI) {
    throw new Error('Missing MONGODB_URI in environment variables.')
  }

  await mongoose.connect(MONGODB_URI)

  const all = await Challenge.find({}).sort({ createdAt: 1 })
  console.log(`Found ${all.length} challenge records.`)

  const pendingByPair = new Map()

  for (const challenge of all) {
    const pairKey = pairKeyFor(challenge.from, challenge.to)
    if (challenge.pairKey !== pairKey) {
      challenge.pairKey = pairKey
    }

    if (challenge.status === 'pending') {
      if (!pendingByPair.has(pairKey)) {
        pendingByPair.set(pairKey, [])
      }
      pendingByPair.get(pairKey).push(challenge)
    }
  }

  let cancelledCount = 0
  for (const [pairKey, group] of pendingByPair.entries()) {
    if (group.length <= 1) continue
    const [, ...duplicates] = group
    for (const duplicate of duplicates) {
      duplicate.status = 'cancelled'
      cancelledCount += 1
    }
    console.log(`Pair "${pairKey}": kept 1 pending, cancelled ${duplicates.length} duplicate(s).`)
  }

  for (const challenge of all) {
    await challenge.save()
  }

  console.log(`Backfilled pairKey on ${all.length} records; cancelled ${cancelledCount} duplicate pending challenges.`)

  console.log('Syncing indexes with the current schema...')
  await Challenge.syncIndexes()

  console.log('Done.')
  await mongoose.disconnect()
}

run().catch(error => {
  console.error('Migration failed:', error)
  process.exit(1)
})