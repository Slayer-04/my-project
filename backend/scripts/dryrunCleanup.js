const dotenv = require('dotenv')
const mongoose = require('mongoose')
const Team = require('../src/models/Team')
const User = require('../src/models/User')
const Venue = require('../src/models/Venue')

dotenv.config()

async function main() {
  const uri = process.env.MONGODB_URI
  if (!uri) {
    console.error('MONGODB_URI is not set in environment. Aborting.')
    process.exit(1)
  }

  await mongoose.connect(uri)
  console.log('Connected to MongoDB')

  try {
    const totalTeams = await Team.countDocuments()
    const teamsNoProfileCount = await Team.countDocuments({ teamProfileCompleted: false })

    const teamsNoUserAgg = await Team.aggregate([
      { $lookup: { from: 'users', localField: 'email', foreignField: 'email', as: 'user' } },
      { $match: { $expr: { $eq: [{ $size: '$user' }, 0] } } },
      { $count: 'count' }
    ])
    const teamsNoUserCount = (teamsNoUserAgg[0] && teamsNoUserAgg[0].count) || 0

    const teamsWouldBeRemovedAgg = await Team.aggregate([
      { $lookup: { from: 'users', localField: 'email', foreignField: 'email', as: 'user' } },
      { $match: { $or: [ { teamProfileCompleted: false }, { $expr: { $eq: [{ $size: '$user' }, 0] } } ] } },
      { $count: 'count' }
    ])
    const teamsWouldBeRemoved = (teamsWouldBeRemovedAgg[0] && teamsWouldBeRemovedAgg[0].count) || 0

    const sampleTeamsNoProfile = await Team.find({ teamProfileCompleted: false }).limit(10).select('teamName captainName email skill')
    const sampleTeamsNoUser = await Team.aggregate([
      { $lookup: { from: 'users', localField: 'email', foreignField: 'email', as: 'user' } },
      { $match: { $expr: { $eq: [{ $size: '$user' }, 0] } } },
      { $project: { teamName: 1, captainName:1, email:1, skill:1 } },
      { $limit: 10 }
    ])

    const ownersCount = await User.countDocuments({ role: 'owner' })
    const sampleOwners = await User.find({ role: 'owner' }).limit(10).select('name email ownerProfile')

    const venuesCount = await Venue.countDocuments()
    const sampleVenues = await Venue.find().limit(10).select('name location owner ownerEmail')

    console.log('\nDRY-RUN CLEANUP REPORT')
    console.log('====================')
    console.log(`Total teams: ${totalTeams}`)
    console.log(`Teams with profileIncomplete (teamProfileCompleted=false): ${teamsNoProfileCount}`)
    console.log(`Teams without User (no login record): ${teamsNoUserCount}`)
    console.log(`Teams that WOULD be removed (union of above): ${teamsWouldBeRemoved}`)
    console.log('\nSample teams with incomplete profile:')
    console.log(JSON.stringify(sampleTeamsNoProfile, null, 2))
    console.log('\nSample teams without user:')
    console.log(JSON.stringify(sampleTeamsNoUser, null, 2))

    console.log('\nOwners (Users where role == owner):')
    console.log(`Count: ${ownersCount}`)
    console.log(JSON.stringify(sampleOwners, null, 2))

    console.log('\nVenues:')
    console.log(`Count: ${venuesCount}`)
    console.log(JSON.stringify(sampleVenues, null, 2))

  } catch (err) {
    console.error('Error during dry-run:', err)
  } finally {
    await mongoose.disconnect()
    process.exit(0)
  }
}

main()
