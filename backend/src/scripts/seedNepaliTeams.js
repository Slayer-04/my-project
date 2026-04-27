const mongoose = require('mongoose')
const dotenv = require('dotenv')
const Team = require('../models/Team')

dotenv.config()

const MONGODB_URI = process.env.MONGODB_URI

const DISTRICTS = [
  { name: 'Kathmandu', centers: [27.7172, 85.3240], places: ['Baneshwor', 'Lazimpat', 'Thamel', 'Maitidevi', 'Koteshwor', 'Kalanki', 'Gongabu'] },
  { name: 'Lalitpur', centers: [27.6644, 85.3188], places: ['Patan', 'Pulchowk', 'Sanepa', 'Bhaisepati', 'Gwarko', 'Kumaripati'] },
  { name: 'Bhaktapur', centers: [27.6710, 85.4298], places: ['Suryabinayak', 'Thimi', 'Balkot', 'Lokanthali', 'Dudukhel'] },
  { name: 'Kaski', centers: [28.2096, 83.9856], places: ['Lakeside', 'Chipledhunga', 'Nadipur', 'Bagar', 'Prithvi Chowk'] },
  { name: 'Chitwan', centers: [27.5291, 84.3542], places: ['Bharatpur', 'Narayanghat', 'Tandi', 'Sauraha', 'Pulchowk'] },
  { name: 'Rupandehi', centers: [27.6869, 83.4324], places: ['Butwal', 'Bhairahawa', 'Manigram', 'Sainamaina', 'Tilottama'] },
  { name: 'Morang', centers: [26.6667, 87.2833], places: ['Biratnagar', 'Jhorahat', 'Letang', 'Urlabari', 'Sundar Haraicha'] },
  { name: 'Sunsari', centers: [26.6217, 87.2790], places: ['Dharan', 'Itahari', 'Inaruwa', 'Duhabi', 'Ramdhuni'] },
  { name: 'Jhapa', centers: [26.6643, 87.9998], places: ['Birtamod', 'Damak', 'Bhadrapur', 'Kankai', 'Shivasatakshi'] },
  { name: 'Dhanusha', centers: [26.9330, 85.9256], places: ['Janakpur', 'Mithila', 'Sabaila', 'Laxminiya', 'Chhireswarnath'] },
  { name: 'Parsa', centers: [27.0435, 84.8568], places: ['Birgunj', 'Pokhariya', 'Bahudaramai', 'Parsauni', 'Jirabhawani'] },
  { name: 'Makwanpur', centers: [27.4285, 85.0322], places: ['Hetauda', 'Bhimphedi', 'Manahari', 'Makwanpurgadhi', 'Thaha'] },
  { name: 'Banke', centers: [28.0442, 81.6167], places: ['Nepalgunj', 'Kohalpur', 'Khajura', 'Duduwa', 'Rapti Sonari'] },
  { name: 'Kailali', centers: [28.9239, 80.5898], places: ['Dhangadhi', 'Tikapur', 'Lamki', 'Ghodaghodi', 'Bhajani'] },
  { name: 'Bardiya', centers: [28.3000, 81.3000], places: ['Gulariya', 'Rajapur', 'Madhuban', 'Bansgadhi', 'Barbardiya'] },
  { name: 'Dang', centers: [28.0500, 82.3000], places: ['Ghorahi', 'Tulsipur', 'Lamahi', 'Satbariya', 'Hekuli'] },
  { name: 'Palpa', centers: [27.8667, 83.5500], places: ['Tansen', 'Rampur', 'Bagnaskali', 'Rainadevi', 'Nisdi'] },
  { name: 'Gorkha', centers: [28.0000, 84.6333], places: ['Gorkha Bazaar', 'Palungtar', 'Siranchok', 'Aarughat', 'Shahid Lakhan'] },
  { name: 'Tanahun', centers: [27.9167, 84.2500], places: ['Damauli', 'Bhimad', 'Shuklagandaki', 'Myagde', 'Devghat'] },
  { name: 'Syangja', centers: [28.1000, 83.8500], places: ['Putalibazar', 'Waling', 'Galyang', 'Chapakot', 'Arjun Chaupari'] },
  { name: 'Baglung', centers: [28.2667, 83.6000], places: ['Baglung Bazaar', 'Galkot', 'Kathekhola', 'Jaimini', 'Dhorpatan'] },
  { name: 'Nuwakot', centers: [27.9167, 85.2833], places: ['Bidur', 'Belkotgadhi', 'Kakani', 'Tarkeshwar', 'Panchakanya'] },
  { name: 'Kavrepalanchok', centers: [27.6500, 85.5500], places: ['Dhulikhel', 'Banepa', 'Panauti', 'Panchkhal', 'Namobuddha'] },
  { name: 'Saptari', centers: [26.6500, 86.7500], places: ['Rajbiraj', 'Kanchanrup', 'Bode Barsain', 'Dakneshwori', 'Surunga'] },
  { name: 'Mahottari', centers: [26.7500, 85.8000], places: ['Jaleshwar', 'Bardibas', 'Gaushala', 'Ramgopalpur', 'Loharpatti'] },
]

const FIRST_NAMES = [
  'Aarav', 'Bibek', 'Bikash', 'Dipesh', 'Prakash', 'Sajan', 'Sandeep', 'Roshan', 'Sujan', 'Niraj',
  'Anil', 'Kiran', 'Rajan', 'Ritesh', 'Sagar', 'Prabin', 'Nabin', 'Amit', 'Sushil', 'Nischal',
]

const LAST_NAMES = [
  'Shrestha', 'Sharma', 'Rai', 'Karki', 'Thapa', 'Gurung', 'Magar', 'Lama', 'Adhikari', 'Bista',
  'Maharjan', 'KC', 'Poudel', 'Bhattarai', 'Khadka', 'Neupane', 'Basnet', 'Tamang', 'Acharya', 'Joshi',
]

const TEAM_PREFIXES = [
  'Valley', 'Himal', 'Nepal', 'Kathmandu', 'Bagmati', 'Everest', 'Gorkha', 'Malla', 'Shakti', 'Rhino',
]

const TEAM_SUFFIXES = [
  'United', 'FC', 'Strikers', 'Warriors', 'Rangers', 'Blazers', 'Legends', 'Dynamos', 'Athletic', 'Club',
]

const TEAM_EMOJIS = ['⚽', '🔥', '🦁', '🦅', '🏆', '⚡', '🥅', '🛡️', '🚀', '🎯']

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function pickRandom(items) {
  return items[randomInt(0, items.length - 1)]
}

function buildSlug(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.|\.$/g, '')
}

function makeEmail(captainName, districtName, index) {
  const captainSlug = buildSlug(captainName)
  const districtSlug = buildSlug(districtName)
  return `${captainSlug}.${districtSlug}.${index}@fotmatch.com`
}

function jitterCoordinate(value, spread = 0.012) {
  const delta = (Math.random() - 0.5) * spread
  return Number((value + delta).toFixed(6))
}

function buildTeamDocument(district, districtIndex, teamIndex, globalIndex) {
  const captainName = `${pickRandom(FIRST_NAMES)} ${pickRandom(LAST_NAMES)}`
  const place = pickRandom(district.places)
  const teamName = `${pickRandom(TEAM_PREFIXES)} ${place} ${pickRandom(TEAM_SUFFIXES)}`
  const skill = pickRandom(['Beginner', 'Intermediate', 'Advanced'])
  const preferredDay = pickRandom(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'])
  const preferredTime = pickRandom(['06:00 AM', '08:00 AM', '10:00 AM', '12:00 PM', '02:00 PM', '04:00 PM', '06:00 PM', '08:00 PM'])
  const wins = randomInt(3, 24)
  const losses = randomInt(1, 14)
  const draws = randomInt(0, 5)
  const eloRating = Math.max(100, Math.min(3000, 1000 + (wins * 18) - (losses * 11) + (draws * 6) + randomInt(-50, 140)))
  const lat = jitterCoordinate(district.centers[0])
  const lng = jitterCoordinate(district.centers[1])

  return {
    captainName,
    email: makeEmail(captainName, district.name, `${districtIndex + 1}-${teamIndex + 1}-${globalIndex + 1}`),
    teamName,
    district: district.name,
    location: `${place}, ${district.name}`,
    skill,
    teamProfileCompleted: true,
    locationVerified: true,
    skillLocked: true,
    locationLocked: true,
    profileCompletedAt: new Date(),
    preferredDay,
    preferredTime,
    lat,
    lng,
    eloRating,
    eloMatchesPlayed: wins + losses + draws,
    matchesWon: wins,
    matchesLost: losses,
    currentStreak: randomInt(-3, 6),
  }
}

async function main() {
  if (!MONGODB_URI) {
    throw new Error('Missing MONGODB_URI in environment variables.')
  }

  const targetTeams = Number(process.env.SEED_TEAM_COUNT || 100)
  const teamsPerDistrict = Number(process.env.SEED_TEAM_PER_DISTRICT || 4)

  if (!Number.isFinite(targetTeams) || targetTeams < 100) {
    throw new Error('SEED_TEAM_COUNT must be a number greater than or equal to 100.')
  }

  if (!Number.isFinite(teamsPerDistrict) || teamsPerDistrict < 1) {
    throw new Error('SEED_TEAM_PER_DISTRICT must be a positive number.')
  }

  await mongoose.connect(MONGODB_URI)
  await Team.deleteMany({})

  const records = []
  const districtCount = DISTRICTS.length
  const iterations = Math.ceil(targetTeams / teamsPerDistrict)

  for (let districtIndex = 0; districtIndex < iterations; districtIndex += 1) {
    const district = DISTRICTS[districtIndex % districtCount]

    for (let teamIndex = 0; teamIndex < teamsPerDistrict && records.length < targetTeams; teamIndex += 1) {
      records.push(buildTeamDocument(district, districtIndex % districtCount, teamIndex, records.length))
    }
  }

  const created = await Team.insertMany(records)
  console.log(`Seeded ${created.length} teams across ${districtCount} districts.`)

  console.log('Nepali team seeding complete.')
}

main()
  .catch((error) => {
    console.error('Failed to seed Nepali teams:', error.message)
    process.exitCode = 1
  })
  .finally(async () => {
    await mongoose.disconnect()
  })