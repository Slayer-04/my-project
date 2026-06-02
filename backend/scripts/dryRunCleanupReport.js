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
    // Teams lacking a verified User
    const teams = await Team.find({})
    const users = await User.find({})
    const userEmails = new Set(users.map(u => String(u.email).toLowerCase()))

    const teamsWithoutUser = teams.filter(t => !userEmails.has(String(t.email || '').toLowerCase()))
    const teamsProfileIncomplete = teams.filter(t => !t.teamProfileCompleted)

    console.log('\n--- Teams summary ---')
    console.log('Total teams:', teams.length)
    console.log('Teams without any User account:', teamsWithoutUser.length)
    console.log('Teams with profile incomplete:', teamsProfileIncomplete.length)

    console.log('\nSample teams without User (up to 10):')
    teamsWithoutUser.slice(0,10).forEach(t => console.log(JSON.stringify({ id: t._id, email: t.email, teamName: t.teamName || t.captainName, skill: t.skill, eloRating: t.eloRating, teamProfileCompleted: t.teamProfileCompleted }, null, 2)))

    console.log('\nSample teams with incomplete profile (up to 10):')
    teamsProfileIncomplete.slice(0,10).forEach(t => console.log(JSON.stringify({ id: t._id, email: t.email, teamName: t.teamName || t.captainName, skill: t.skill, eloRating: t.eloRating }, null, 2)))

    // Owner users
    const ownerUsers = users.filter(u => u.role === 'owner')
    console.log('\n--- Owner Users summary ---')
    console.log('Total users:', users.length)
    console.log('Owner users count:', ownerUsers.length)
    console.log('\nSample owner users (up to 10):')
    ownerUsers.slice(0,10).forEach(u => console.log(JSON.stringify({ id: u._id, email: u.email, name: u.name, ownerProfile: u.ownerProfile ? { venueName: u.ownerProfile.venueName, location: u.ownerProfile.location } : null }, null, 2)))

    // Venues
    const venues = await Venue.find({})
    console.log('\n--- Venues summary ---')
    console.log('Total venues:', venues.length)
    console.log('\nSample venues (up to 10):')
    venues.slice(0,10).forEach(v => console.log(JSON.stringify({ id: v._id, name: v.name, owner: v.owner, ownerEmail: v.ownerEmail, location: v.location }, null, 2)))

  } catch (err) {
    console.error('Error generating report', err)
  } finally {
    await mongoose.disconnect()
    process.exit(0)
  }
}

main()
