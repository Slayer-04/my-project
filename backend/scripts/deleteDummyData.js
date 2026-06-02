const dotenv = require('dotenv')
const mongoose = require('mongoose')
const Team = require('../src/models/Team')
const User = require('../src/models/User')
const Venue = require('../src/models/Venue')

dotenv.config()

async function main() {
  const uri = process.env.MONGODB_URI
  if (!uri) {
    console.error('MONGODB_URI is not set. Aborting.')
    process.exit(1)
  }

  await mongoose.connect(uri)
  console.log('Connected to MongoDB')

  try {
    // Find teams without corresponding User
    const users = await User.find({}).select('email')
    const userEmails = new Set(users.map(u => String(u.email).toLowerCase()))

    const teams = await Team.find({})
    const teamsNoUser = teams.filter(t => !userEmails.has(String(t.email || '').toLowerCase()))
    const teamsIncomplete = teams.filter(t => !t.teamProfileCompleted)

    // Union of teams to delete (by _id)
    const teamsToDeleteIds = new Set()
    teamsNoUser.forEach(t => teamsToDeleteIds.add(String(t._id)))
    teamsIncomplete.forEach(t => teamsToDeleteIds.add(String(t._id)))

    const teamsToDeleteCount = teamsToDeleteIds.size

    console.log(`Teams without user: ${teamsNoUser.length}`)
    console.log(`Teams with incomplete profile: ${teamsIncomplete.length}`)
    console.log(`Total teams to delete (union): ${teamsToDeleteCount}`)

    if (teamsToDeleteCount > 0) {
      const ids = Array.from(teamsToDeleteIds)
      const delT = await Team.deleteMany({ _id: { $in: ids } })
      console.log(`Deleted ${delT.deletedCount} teams.`)
    } else {
      console.log('No teams to delete.')
    }

    // Delete all owner users
    const delOwners = await User.deleteMany({ role: 'owner' })
    console.log(`Deleted owner users: ${delOwners.deletedCount}`)

    // Delete all venues
    const delVenues = await Venue.deleteMany({})
    console.log(`Deleted venues: ${delVenues.deletedCount}`)

    console.log('Deletion complete.')
  } catch (err) {
    console.error('Error during deletion:', err)
  } finally {
    await mongoose.disconnect()
    process.exit(0)
  }
}

main()
