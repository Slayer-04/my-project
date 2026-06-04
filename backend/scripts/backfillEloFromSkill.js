/* One-off script to set eloRating from skill for teams with no matches */
const dotenv = require('dotenv')
const mongoose = require('mongoose')
const Team = require('../src/models/Team')

dotenv.config()

const SKILL_BASE = { Beginner: 1000, Intermediate: 1500, Advanced: 2000 }

async function main() {
  const uri = process.env.MONGODB_URI
  if (!uri) {
    console.error('MONGODB_URI is not set in environment. Aborting.')
    process.exit(1)
  }

  await mongoose.connect(uri)
  console.log('Connected to MongoDB')

  try {
    const teams = await Team.find({ $or: [ { eloMatchesPlayed: { $exists: false } }, { eloMatchesPlayed: 0 } ] })
    console.log(`Found ${teams.length} teams with zero matches.`)

    let updated = 0
    for (const t of teams) {
      const skill = t.skill || ''
      const base = SKILL_BASE[skill] || null
      if (base && Number(t.eloRating) !== Number(base)) {
        t.eloRating = Number(base)
        await t.save()
        updated++
        console.log(`Updated team ${t._id} (${t.teamName || t.captainName}) -> elo ${base}`)
      }
    }

    console.log(`Done. Updated ${updated} teams.`)
  } catch (err) {
    console.error('Error updating teams', err)
  } finally {
    await mongoose.disconnect()
    process.exit(0)
  }
}

main()
