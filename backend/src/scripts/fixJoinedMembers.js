/**
 * fixJoinedMembers.js
 * -------------------
 * One-time script that fixes User records for members who joined a team via
 * UID but whose profileCompleted flag is still false in the database.
 *
 * It works in two passes:
 *  Pass 1 — For users who have an approved TeamJoinRequest, stamp their User
 *            record with profileCompleted=true, teamAccess='basic', isCaptain=false,
 *            and fill in teamInfo from the join request + Team document.
 *  Pass 2 — For users who have teamAccess='basic' and isCaptain=false but no
 *            approved TeamJoinRequest (e.g. old in-memory data), create a new
 *            approved TeamJoinRequest from their teamInfo so future lookups work.
 *
 * Run once from the backend/ folder:
 *   node src/scripts/fixJoinedMembers.js
 */

const mongoose = require('mongoose')
const dotenv = require('dotenv')
const path = require('path')

dotenv.config({ path: path.resolve(__dirname, '../../.env') })

const User = require('../models/User')
const Team = require('../models/Team')
const TeamJoinRequest = require('../models/TeamJoinRequest')

const MONGODB_URI = process.env.MONGODB_URI

if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI not set in backend/.env')
  process.exit(1)
}

async function run() {
  await mongoose.connect(MONGODB_URI)
  console.log('✅ Connected to MongoDB:', MONGODB_URI)

  // ── Pass 1: fix users who have an approved TeamJoinRequest ────────────────
  console.log('\n── Pass 1: backfill from approved TeamJoinRequests ──')
  const approvedRequests = await TeamJoinRequest.find({ status: 'approved' })
  console.log(`   Found ${approvedRequests.length} approved join request(s)`)

  let pass1Fixed = 0
  for (const req of approvedRequests) {
    const memberUser = await User.findOne({ email: req.requesterEmail })
    if (!memberUser) {
      console.log(`   ⚠️  No User found for ${req.requesterEmail} — skipping`)
      continue
    }

    let needsSave = false

    if (!memberUser.profileCompleted) {
      memberUser.profileCompleted = true
      needsSave = true
    }
    if (memberUser.teamAccess !== 'basic') {
      memberUser.teamAccess = 'basic'
      needsSave = true
    }
    if (memberUser.isCaptain !== false) {
      memberUser.isCaptain = false
      needsSave = true
    }

    // Fill teamInfo if missing
    if (!memberUser.teamInfo?.teamId || !memberUser.teamInfo?.teamName) {
      const team = await Team.findById(req.teamId)
      memberUser.teamInfo = {
        teamId: req.teamId || null,
        teamName: team?.teamName || req.teamName || '',
        captainName: team?.captainName || req.captainName || '',
      }
      needsSave = true
    }

    if (needsSave) {
      await memberUser.save()
      pass1Fixed++
      console.log(`   ✅ Fixed: ${memberUser.email} → team "${memberUser.teamInfo.teamName}"`)
    } else {
      console.log(`   ✓  Already correct: ${memberUser.email}`)
    }
  }

  // ── Pass 2: create missing TeamJoinRequests for basic-access users ─────────
  console.log('\n── Pass 2: create missing TeamJoinRequests ──')
  const basicUsers = await User.find({
    role: 'team',
    teamAccess: 'basic',
    isCaptain: false,
  })
  console.log(`   Found ${basicUsers.length} basic-access user(s)`)

  let pass2Fixed = 0
  for (const u of basicUsers) {
    // Already has an approved request — skip
    const existing = await TeamJoinRequest.findOne({
      requesterEmail: u.email,
      status: 'approved',
    })
    if (existing) continue

    // Find their team
    const teamId = u.teamInfo?.teamId
    const teamName = u.teamInfo?.teamName
    if (!teamId && !teamName) {
      console.log(`   ⚠️  ${u.email} has no teamInfo — cannot create join request`)
      continue
    }

    let team = teamId ? await Team.findById(teamId) : null
    if (!team && teamName) {
      team = await Team.findOne({ teamName })
    }
    if (!team) {
      console.log(`   ⚠️  Team not found for ${u.email} (teamId=${teamId}, teamName=${teamName})`)
      continue
    }

    await TeamJoinRequest.create({
      teamId: team._id,
      teamUid: team.uid || '',
      teamName: team.teamName || '',
      captainName: team.captainName || '',
      captainEmail: team.email || '',
      requesterName: u.name,
      requesterEmail: u.email,
      message: '',
      status: 'approved',
      reviewedAt: new Date(),
    })

    // Also stamp profileCompleted while we're here
    if (!u.profileCompleted) {
      u.profileCompleted = true
      await u.save()
    }

    pass2Fixed++
    console.log(`   ✅ Created join request for ${u.email} → team "${team.teamName}"`)
  }

  console.log(`\n── Summary ──────────────────────────────────`)
  console.log(`   Pass 1 fixed: ${pass1Fixed} user(s)`)
  console.log(`   Pass 2 fixed: ${pass2Fixed} user(s)`)
  console.log(`   Total fixed : ${pass1Fixed + pass2Fixed} user(s)`)

  if (pass1Fixed + pass2Fixed === 0) {
    console.log('\n   ℹ️  Nothing to fix — all records are already correct.')
    console.log('   If the problem persists, the issue is not in the database.')
    console.log('   Make sure you deployed the latest authController.js and Login.jsx fixes.')
  }

  await mongoose.disconnect()
  console.log('\n✅ Done. You can delete this script after running it.')
}

run().catch(err => {
  console.error('❌ Script failed:', err.message)
  process.exit(1)
})