const { haversineDistanceKm, resolveCoordinates } = require('./haversine')

const DEFAULT_WEIGHTS = {
  elo: 0.42,
  distance: 0.28,
  form: 0.2,
  extras: 0.1,
}

const HARD_FILTERS = {
  maxEloDiff: 500,
  maxDistanceKm: 4,
}

const SKILL_LEVEL = {
  Beginner: 1,
  Intermediate: 2,
  Advanced: 3,
}

function clamp(value, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value))
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function getTeamStrength(team) {
  const elo = toNumber(team && team.eloRating, 1000)
  const wins = toNumber(team && team.matchesWon, 0)
  const losses = toNumber(team && team.matchesLost, 0)
  const totalMatches = wins + losses
  const winRate = totalMatches > 0 ? wins / totalMatches : 0.5
  const streak = toNumber(team && team.currentStreak, 0)
  const momentum = clamp(winRate + (streak * 0.04), 0, 1)

  return {
    elo,
    wins,
    losses,
    totalMatches,
    winRate,
    streak,
    momentum,
  }
}

function getSkillScore(mySkill, opponentSkill) {
  const myLevel = SKILL_LEVEL[mySkill] || 2
  const opponentLevel = SKILL_LEVEL[opponentSkill] || 2
  const levelGap = Math.abs(myLevel - opponentLevel)

  if (levelGap === 0) return 1
  if (levelGap === 1) return 0.74
  return 0.48
}

function getFormScore(myTeamStrength, opponentStrength) {
  const challengeBias = myTeamStrength.momentum >= 0.7
    ? 0.18
    : myTeamStrength.momentum <= 0.45
      ? -0.18
      : 0

  const targetOpponentMomentum = clamp(myTeamStrength.momentum + challengeBias, 0, 1)
  const momentumGap = Math.abs(opponentStrength.momentum - targetOpponentMomentum)

  return {
    score: clamp(1 - momentumGap, 0, 1),
    challengeBias,
    targetOpponentMomentum,
    momentumGap,
  }
}

function getVenueDistanceKm(team, venueCoords) {
  const teamCoords = resolveCoordinates(team)
  if (!teamCoords || !venueCoords) return null

  return haversineDistanceKm(teamCoords, venueCoords)
}

function getAvailabilityScore(team, context) {
  const preferredDay = context && context.day ? context.day : 'Saturday'
  const preferredTime = context && context.time ? context.time : null
  const preferredVenue = context && context.venue ? context.venue : null
  const availability = team && team.availability ? team.availability : {}
  const day = availability.day || preferredDay
  const slots = Array.isArray(availability.slots) ? availability.slots : []
  const venues = Array.isArray(availability.venues) ? availability.venues : []

  const sameDay = day === preferredDay
  const slotGapHours = preferredTime ? getClosestSlotGapHours(slots, preferredTime) : 2
  const venueOverlap = preferredVenue ? venues.includes(preferredVenue) : false

  const dayScore = sameDay ? 1 : 0.45
  const slotScore = clamp(1 - (slotGapHours / 4), 0, 1)
  const venueScore = venueOverlap ? 1 : 0.55

  return {
    score: (dayScore * 0.4) + (slotScore * 0.35) + (venueScore * 0.25),
    sameDay,
    slotGapHours,
    venueOverlap,
    availability: {
      day,
      slots,
      venues,
    },
  }
}

function parseTimeToMinutes(timeValue) {
  if (!timeValue || typeof timeValue !== 'string') return null

  const is12Hour = /AM|PM/i.test(timeValue)

  if (is12Hour) {
    const parts = timeValue.trim().split(' ')
    const timePart = parts[0]
    const meridiemRaw = parts[1]
    if (!timePart || !meridiemRaw) return null

    const timeParts = timePart.split(':')
    const hourRaw = timeParts[0]
    const minuteRaw = timeParts[1]
    const meridiem = meridiemRaw.toUpperCase()
    let hour = Number(hourRaw)
    const minute = Number(minuteRaw)

    if (Number.isNaN(hour) || Number.isNaN(minute)) return null
    if (meridiem === 'PM' && hour !== 12) hour += 12
    if (meridiem === 'AM' && hour === 12) hour = 0
    return (hour * 60) + minute
  }

  const parts = timeValue.split(':')
  const hour = Number(parts[0])
  const minute = Number(parts[1])
  if (Number.isNaN(hour) || Number.isNaN(minute)) return null
  return (hour * 60) + minute
}

function getClosestSlotGapHours(slots, targetTimeValue) {
  if (!Array.isArray(slots) || slots.length === 0) return 2

  const targetMinutes = parseTimeToMinutes(targetTimeValue)
  if (targetMinutes === null) return 2

  const slotMinutes = slots
    .map(parseTimeToMinutes)
    .filter((value) => value !== null)

  if (slotMinutes.length === 0) return 2

  const minGapMinutes = Math.min(...slotMinutes.map((value) => Math.abs(value - targetMinutes)))
  return minGapMinutes / 60
}

function getProfileConfidence(team) {
  const profileCompleted = typeof team.profileCompleted === 'boolean' ? team.profileCompleted : true
  const locationVerified = typeof team.locationVerified === 'boolean' ? team.locationVerified : true
  const matchesPlayed = toNumber(team.matchesPlayed, toNumber(team.matchesWon, 0) + toNumber(team.matchesLost, 0))

  const profileScore = profileCompleted ? 1 : 0.72
  const verificationScore = locationVerified ? 1 : 0.82
  const experienceScore = clamp(matchesPlayed / 20, 0.4, 1)

  return (profileScore * 0.45) + (verificationScore * 0.35) + (experienceScore * 0.2)
}

function scoreTeamCompatibility(options) {
  const {
    myTeam,
    candidate,
    venueCoords,
    preferredDay,
    preferredTime,
    preferredVenue,
    weights = DEFAULT_WEIGHTS,
  } = options || {}

  if (!myTeam) {
    throw new Error('myTeam is required.')
  }

  if (!candidate) {
    throw new Error('candidate is required.')
  }

  const myStrength = getTeamStrength(myTeam)
  const opponentStrength = getTeamStrength(candidate)
  const eloDiff = Math.abs(opponentStrength.elo - myStrength.elo)
  const distanceKm = getVenueDistanceKm(candidate, venueCoords) ?? getVenueDistanceKm(candidate, resolveCoordinates(myTeam))
  const availability = getAvailabilityScore(candidate, {
    day: preferredDay,
    time: preferredTime,
    venue: preferredVenue,
  })
  const formFit = getFormScore(myStrength, opponentStrength)
  const skillScore = getSkillScore(myTeam.skill, candidate.skill)
  const profileConfidence = getProfileConfidence(candidate)

  const eloScore = clamp(1 - (eloDiff / 450), 0, 1)
  const distanceScore = clamp(1 - ((distanceKm || 0) / 18), 0, 1)
  const extraScore = (availability.score * 0.5) + (skillScore * 0.3) + (profileConfidence * 0.2)

  const score = Math.round(100 * (
    (eloScore * weights.elo)
    + (distanceScore * weights.distance)
    + (formFit.score * weights.form)
    + (extraScore * weights.extras)
  ))

  const tier = score >= 80 ? 'Excellent Fit' : score >= 65 ? 'Strong Fit' : score >= 50 ? 'Possible Fit' : 'Low Fit'
  const tierType = score >= 80 ? 'success' : score >= 65 ? 'info' : score >= 50 ? 'warning' : 'muted'
  const distanceDisplay = distanceKm !== null ? distanceKm.toFixed(2) : '?'

  return {
    ...candidate,
    score,
    tier,
    tierType,
    distanceKm,
    breakdown: {
      elo: Math.round(eloScore * 100),
      distance: Math.round(distanceScore * 100),
      form: Math.round(formFit.score * 100),
      extras: Math.round(extraScore * 100),
    },
    reasons: [
      `ELO gap ${eloDiff} with ${opponentStrength.elo}`,
      `${distanceDisplay}km from ${preferredVenue || 'selected venue'}`,
      formFit.challengeBias > 0 ? 'You can stretch to a stronger opponent' : formFit.challengeBias < 0 ? 'Better for a softer opponent while form recovers' : 'Form is balanced',
      availability.sameDay ? `Both free on ${preferredDay || 'selected day'}` : `Closest availability: ${availability.availability.day}`,
      availability.venueOverlap ? `Venue match at ${preferredVenue}` : `Next best venue: ${availability.availability.venues[0] || 'any venue'}`,
      `Skill balance: ${myTeam.skill || 'Unknown'} vs ${candidate.skill || 'Unknown'}`,
    ],
  }
}

function passesHardFilters(options) {
  const { myTeam, candidate, venueCoords } = options || {}

  if (!myTeam || !candidate) return false

  const myStrength = getTeamStrength(myTeam)
  const candidateStrength = getTeamStrength(candidate)
  const eloDiff = Math.abs(candidateStrength.elo - myStrength.elo)

  if (eloDiff > HARD_FILTERS.maxEloDiff) {
    return false
  }

  const distanceKm = getVenueDistanceKm(candidate, venueCoords) ?? getVenueDistanceKm(candidate, resolveCoordinates(myTeam))
  if (distanceKm !== null && distanceKm > HARD_FILTERS.maxDistanceKm) {
    return false
  }

  return true
}

function rankTeamsByCompatibility(options) {
  const {
    myTeam,
    teams,
    venueCoords,
    preferredDay,
    preferredTime,
    preferredVenue,
    weights,
    limit = 5,
  } = options || {}

  if (!Array.isArray(teams)) {
    throw new Error('teams must be an array.')
  }

  const scored = teams
    .filter((team) => !myTeam || team._id?.toString() !== myTeam._id?.toString())
    .filter((team) => passesHardFilters({ myTeam, candidate: team, venueCoords }))
    .map((team) => scoreTeamCompatibility({
      myTeam,
      candidate: team,
      venueCoords,
      preferredDay,
      preferredTime,
      preferredVenue,
      weights,
    }))
    .sort((left, right) => right.score - left.score)

  return {
    recommended: scored.slice(0, limit),
    others: scored.slice(limit),
  }
}

module.exports = {
  DEFAULT_WEIGHTS,
  HARD_FILTERS,
  SKILL_LEVEL,
  clamp,
  getTeamStrength,
  getSkillScore,
  getFormScore,
  getVenueDistanceKm,
  getAvailabilityScore,
  getProfileConfidence,
  passesHardFilters,
  scoreTeamCompatibility,
  rankTeamsByCompatibility,
}