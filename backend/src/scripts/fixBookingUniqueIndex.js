const mongoose = require('mongoose')
const dotenv = require('dotenv')
const Booking = require('../models/Booking')

dotenv.config()

const MONGODB_URI = process.env.MONGODB_URI

const run = async () => {
  if (!MONGODB_URI) {
    throw new Error('Missing MONGODB_URI in environment variables.')
  }

  await mongoose.connect(MONGODB_URI)

  const collection = Booking.collection
  const existingIndexes = await collection.indexes()

  const oldIndex = existingIndexes.find(index => {
    const keys = Object.keys(index.key)
    return keys.length === 4
      && index.key.venue === 1
      && index.key.date === 1
      && index.key.time === 1
      && index.key.status === 1
  })

  if (oldIndex) {
    console.log(`Dropping outdated index "${oldIndex.name}"...`)
    await collection.dropIndex(oldIndex.name)
  } else {
    console.log('No outdated index found (already migrated).')
  }

  console.log('Syncing indexes with the current schema...')
  await Booking.syncIndexes()

  const finalIndexes = await collection.indexes()
  console.log('Current indexes:', finalIndexes.map(i => ({ name: i.name, key: i.key, unique: !!i.unique })))

  console.log('Done.')
  await mongoose.disconnect()
}

run().catch(error => {
  console.error('Migration failed:', error)
  process.exit(1)
})