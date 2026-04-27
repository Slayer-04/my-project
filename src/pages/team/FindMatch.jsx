import React, { useMemo, useState, useEffect } from 'react'
import Sidebar from '../../components/Sidebar.jsx'
import Topbar  from '../../components/Topbar.jsx'
import { teams as mockTeams, LOCATION_COORDS } from '../../data/mockData.js'
import { useAuth } from '../../App.jsx'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

/* Seed open match posts visible to everyone */
const SEED_POSTS = []
const POST_COLORS = ['blue', 'teal', 'purple', 'green', 'orange']
const POST_EMOJIS = ['⚽', '🔥', '🦁', '🦅', '🏆', '⚡', '🥅', '🛡️', '🚀', '🎯']
const POST_TIMES = ['06:00 AM', '08:00 AM', '10:00 AM', '12:00 PM', '02:00 PM', '04:00 PM', '06:00 PM', '08:00 PM']
const POST_VENUES = ['Arena Futsal Park', 'Champions Court', 'Goal Zone Futsal', 'Patan Sports Hub']

const SKILL_TO_ELO = { Beginner:1400, Intermediate:1600, Advanced:1800 }
const SKILL_LEVEL = { Beginner: 1, Intermediate: 2, Advanced: 3 }
const COMPATIBILITY_WEIGHTS = {
  elo: 0.42,
  distance: 0.28,
  form: 0.2,
  extras: 0.1,
}
const HARD_FILTERS = {
  maxEloDiff: 500,
  maxDistanceKm: 4,
}
const TEAM_AVAILABILITY = {
  'Thunder Strikers': { day:'Saturday', slots:['06:00 PM', '08:00 PM'], venues:['Arena Futsal Park', 'Goal Zone Futsal'] },
  'Green Eagles': { day:'Sunday', slots:['07:00 AM', '09:00 AM'], venues:['Champions Court', 'Arena Futsal Park'] },
  'Red Wolves': { day:'Saturday', slots:['06:00 PM', '07:00 PM'], venues:['Goal Zone Futsal', 'Champions Court'] },
  'Blue Phoenix': { day:'Friday', slots:['10:00 AM', '04:00 PM'], venues:['Patan Sports Hub'] },
  'Night Owls': { day:'Saturday', slots:['08:00 AM', '06:00 PM'], venues:['Champions Court', 'Patan Sports Hub'] },
  'Storm United': { day:'Sunday', slots:['06:00 AM', '08:00 AM'], venues:['Champions Court'] },
}

const toDayLabel = (dateValue, defaultDay = 'Saturday') => {
  if (!dateValue) return defaultDay
  const date = new Date(dateValue)
  if (Number.isNaN(date.getTime())) return defaultDay
  return date.toLocaleDateString('en-US', { weekday:'long' })
}

const parseTimeToMinutes = (timeValue) => {
  if (!timeValue) return null
  const is12Hour = /AM|PM/i.test(timeValue)

  if (is12Hour) {
    const [timePart, meridiemRaw] = timeValue.trim().split(' ')
    if (!timePart || !meridiemRaw) return null
    const [hRaw, mRaw] = timePart.split(':')
    const meridiem = meridiemRaw.toUpperCase()
    let hour = Number(hRaw)
    const minute = Number(mRaw)
    if (Number.isNaN(hour) || Number.isNaN(minute)) return null
    if (meridiem === 'PM' && hour !== 12) hour += 12
    if (meridiem === 'AM' && hour === 12) hour = 0
    return (hour * 60) + minute
  }

  const [hRaw, mRaw] = timeValue.split(':')
  const hour = Number(hRaw)
  const minute = Number(mRaw)
  if (Number.isNaN(hour) || Number.isNaN(minute)) return null
  return (hour * 60) + minute
}

const getClosestSlotGapHours = (slots, targetMinutes) => {
  if (!Array.isArray(slots) || slots.length === 0 || targetMinutes === null) return 2
  const slotMinutes = slots
    .map(parseTimeToMinutes)
    .filter(v => v !== null)
  if (slotMinutes.length === 0) return 2
  const minGapMinutes = Math.min(...slotMinutes.map(v => Math.abs(v - targetMinutes)))
  return minGapMinutes / 60
}

const toRadians = (value) => (value * Math.PI) / 180

const resolveCoordinates = (value) => {
  if (!value) return null

  if (typeof value === 'string') {
    return LOCATION_COORDS[value] || null
  }

  if (typeof value.lat === 'number' && typeof value.lng === 'number') {
    return { lat: value.lat, lng: value.lng }
  }

  if (value.location && LOCATION_COORDS[value.location]) {
    return LOCATION_COORDS[value.location]
  }

  return null
}

const getDistanceKm = (fromValue, toValue) => {
  const from = resolveCoordinates(fromValue)
  const to = resolveCoordinates(toValue)

  if (!from || !to) return null

  const earthRadiusKm = 6371
  const latDelta = toRadians(to.lat - from.lat)
  const lngDelta = toRadians(to.lng - from.lng)
  const a = Math.sin(latDelta / 2) ** 2
    + Math.cos(toRadians(from.lat)) * Math.cos(toRadians(to.lat)) * Math.sin(lngDelta / 2) ** 2
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  return earthRadiusKm * c
}

const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value))

const getTeamStrength = (team) => {
  const elo = Number(team?.elo ?? SKILL_TO_ELO[team?.skill] ?? 1600)
  const wins = Number(team?.wins ?? 0)
  const losses = Number(team?.losses ?? 0)
  const totalMatches = wins + losses
  const winRate = totalMatches > 0 ? wins / totalMatches : 0.5
  const streak = Number(team?.streak ?? team?.currentStreak ?? 0)
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

const getSkillScore = (mySkill, opponentSkill) => {
  const myLevel = SKILL_LEVEL[mySkill] ?? 2
  const opponentLevel = SKILL_LEVEL[opponentSkill] ?? 2
  const levelGap = Math.abs(myLevel - opponentLevel)

  if (levelGap === 0) return 1
  if (levelGap === 1) return 0.74
  return 0.48
}

const getVenueDistanceKm = (team, venueName) => {
  const venueCoords = LOCATION_COORDS[venueName]
  if (!venueCoords) return null

  const teamCoords = resolveCoordinates(team)
  if (!teamCoords) return null

  return getDistanceKm(teamCoords, venueCoords)
}

const getAvailabilityScore = (candidate, context) => {
  const availability = TEAM_AVAILABILITY[candidate.name] || {
    day:'Sunday',
    slots:['07:00 PM'],
    venues:[candidate.venue || 'Arena Futsal Park'],
  }

  const sameDay = availability.day === context.day
  const targetMinutes = parseTimeToMinutes(context.time)
  const slotGapHours = getClosestSlotGapHours(availability.slots, targetMinutes)
  const venueOverlap = (availability.venues || []).includes(context.venue)

  const dayScore = sameDay ? 1 : 0.45
  const slotScore = clamp(1 - (slotGapHours / 4), 0, 1)
  const venueScore = venueOverlap ? 1 : 0.55

  return {
    score: (dayScore * 0.4) + (slotScore * 0.35) + (venueScore * 0.25),
    sameDay,
    slotGapHours,
    venueOverlap,
    availability,
  }
}

const getFormScore = (myTeamStrength, opponentStrength) => {
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

const getProfileConfidence = (team) => {
  const profileCompleted = typeof team.profileCompleted === 'boolean' ? team.profileCompleted : true
  const locationVerified = typeof team.locationVerified === 'boolean' ? team.locationVerified : true
  const matchesPlayed = Number(team.matchesPlayed ?? (Number(team.wins ?? 0) + Number(team.losses ?? 0)))

  const profileScore = profileCompleted ? 1 : 0.72
  const verificationScore = locationVerified ? 1 : 0.82
  const experienceScore = clamp(matchesPlayed / 20, 0.4, 1)

  return (profileScore * 0.45) + (verificationScore * 0.35) + (experienceScore * 0.2)
}

const toIsoDate = (daysFromNow = 0) => {
  const date = new Date()
  date.setDate(date.getDate() + daysFromNow)
  return date.toISOString().split('T')[0]
}

const weekdayIndex = {
  Sunday: 0,
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
}

const nextDateForPreferredDay = (dayLabel) => {
  const target = weekdayIndex[dayLabel]
  if (typeof target !== 'number') return toIsoDate(1)

  const now = new Date()
  const current = now.getDay()
  let delta = (target - current + 7) % 7
  if (delta === 0) delta = 7

  const next = new Date(now)
  next.setDate(now.getDate() + delta)
  return next.toISOString().split('T')[0]
}

const selectSmartVenueByHaversine = (myTeam, allTeams, currentTeamName) => {
  const myCoords = resolveCoordinates(myTeam)
  if (!myCoords) return 'Arena Futsal Park'

  const candidates = allTeams
    .filter(team => team.name !== currentTeamName)
    .map(team => {
      const teamCoords = resolveCoordinates(team)
      if (!teamCoords) return null
      const distanceKm = getDistanceKm(myCoords, teamCoords)
      const eloGap = Math.abs((myTeam.elo ?? 1600) - (team.elo ?? 1600))
      if (distanceKm === null) return null
      return {
        team,
        distanceKm,
        eloGap,
        score: (distanceKm * 0.7) + (eloGap / 800),
      }
    })
    .filter(Boolean)
    .sort((a, b) => a.score - b.score)

  const bestOpponent = candidates[0]
  if (!bestOpponent) return myTeam.preferredVenue || 'Arena Futsal Park'

  const oppCoords = resolveCoordinates(bestOpponent.team)
  if (!oppCoords) return myTeam.preferredVenue || 'Arena Futsal Park'

  const midpoint = {
    lat: (myCoords.lat + oppCoords.lat) / 2,
    lng: (myCoords.lng + oppCoords.lng) / 2,
  }

  const bestVenue = POST_VENUES
    .map(venue => {
      const venueCoords = LOCATION_COORDS[venue]
      if (!venueCoords) return null
      const distanceKm = getDistanceKm(midpoint, venueCoords)
      if (distanceKm === null) return null
      return { venue, distanceKm }
    })
    .filter(Boolean)
    .sort((a, b) => a.distanceKm - b.distanceKm)[0]

  return bestVenue?.venue || myTeam.preferredVenue || 'Arena Futsal Park'
}

const mapBackendTeamToUi = (team, index) => {
  const name = team.teamName || team.name || `Team ${index + 1}`
  const wins = Number(team.matchesWon ?? team.wins ?? 0)
  const losses = Number(team.matchesLost ?? team.losses ?? 0)

  return {
    id: team._id || team.id || `team-${index + 1}`,
    name,
    skill: team.skill || 'Intermediate',
    location: team.location || 'Kathmandu',
    district: team.district || '',
    lat: typeof team.lat === 'number' ? team.lat : null,
    lng: typeof team.lng === 'number' ? team.lng : null,
    players: Number(team.players ?? (7 + (index % 4))),
    wins,
    losses,
    streak: Number(team.currentStreak ?? team.streak ?? 0),
    elo: Number(team.eloRating ?? team.elo ?? SKILL_TO_ELO[team.skill] ?? 1600),
    color: POST_COLORS[index % POST_COLORS.length],
    emoji: POST_EMOJIS[index % POST_EMOJIS.length],
    profileCompleted: typeof team.teamProfileCompleted === 'boolean' ? team.teamProfileCompleted : true,
    locationVerified: typeof team.locationVerified === 'boolean' ? team.locationVerified : true,
  }
}

const buildPostsFromTeams = (teamList) => (
  teamList.map((team, index) => ({
    id: `post-${team.id || index + 1}`,
    team: team.name,
    emoji: team.emoji,
    elo: team.elo,
    location: team.location,
    date: toIsoDate(index % 14),
    time: POST_TIMES[index % POST_TIMES.length],
    venue: POST_VENUES[index % POST_VENUES.length],
    players: team.players,
    note: `Open challenge from ${team.district || 'Nepal'} teams.`,
    color: team.color,
    requestedBy: null,
  }))
)

export default function FindMatch() {
  const { user, challenges, setChallenges, setNotifications, matchPosts, setMatchPosts, bookings, setBookings } = useAuth()
  const [teams,     setTeams]     = useState(mockTeams)
  const [toast,     setToast]     = useState({ msg:'', type:'success' })
  const [postModal, setPostModal] = useState(false)
  const [reqModal,  setReqModal]  = useState(null)
  const [showAllPosts, setShowAllPosts] = useState(false)
  const [form,      setForm]      = useState({
    date:'',
    time:'',
    venue:'',
    note:'',
    visibility:'24',
  })

  const currentTeamName = user?.teamInfo?.name || user?.teamInfo?.teamName || user?.teamName || 'My Team'
  const currentTeamId = user?.id || user?._id || null

  const myTeam = useMemo(() => ({
    name: currentTeamName,
    elo: user?.eloRating ?? user?.teamInfo?.eloRating ?? 1600,
    location: user?.teamInfo?.location || 'Lazimpat',
    lat: user?.teamInfo?.lat ?? 27.7184,
    lng: user?.teamInfo?.lng ?? 85.3235,
    skill: user?.teamInfo?.skill || user?.skill || 'Intermediate',
    wins: user?.teamInfo?.wins ?? 0,
    losses: user?.teamInfo?.losses ?? 0,
    streak: user?.teamInfo?.streak ?? 0,
    profileCompleted: Boolean(user?.teamProfileCompleted),
    locationVerified: Boolean(user?.locationVerified),
    defaultDay: user?.teamInfo?.preferredDay || 'Saturday',
    defaultTime: user?.teamInfo?.preferredTime || '06:00 PM',
    preferredVenue: 'Arena Futsal Park',
    winRate: 0.58,
  }), [currentTeamName, user?.eloRating, user?.locationVerified, user?.skill, user?.teamInfo?.eloRating, user?.teamInfo?.lat, user?.teamInfo?.lng, user?.teamInfo?.location, user?.teamInfo?.losses, user?.teamInfo?.preferredDay, user?.teamInfo?.preferredTime, user?.teamInfo?.skill, user?.teamInfo?.streak, user?.teamInfo?.teamName, user?.teamInfo?.name, user?.teamInfo?.wins, user?.teamName, user?.teamProfileCompleted])
  const currentTeamLocation = myTeam.location
  const safeMatchPosts = Array.isArray(matchPosts) ? matchPosts : []

  const getTeamElo = (team) => team.elo ?? SKILL_TO_ELO[team.skill] ?? 1600

  const getTeamDistanceMetrics = (team) => {
    const betweenTeamsKm = getDistanceKm(myTeam, team)
    const venueDistanceKm = getVenueDistanceKm(team, preferredContext.venue)

    if (betweenTeamsKm !== null && venueDistanceKm !== null) {
      return {
        scoreDistanceKm: (betweenTeamsKm * 0.65) + (venueDistanceKm * 0.35),
        betweenTeamsKm,
        venueDistanceKm,
      }
    }

    const fallbackDistance = betweenTeamsKm ?? venueDistanceKm ?? 8
    return {
      scoreDistanceKm: fallbackDistance,
      betweenTeamsKm,
      venueDistanceKm,
    }
  }

  const latestMyPost = useMemo(
    () => safeMatchPosts.find(p => p.team === myTeam.name) || null,
    [safeMatchPosts, myTeam.name]
  )

  const preferredContext = useMemo(() => {
    const day = toDayLabel(latestMyPost?.date, myTeam.defaultDay)
    const time = latestMyPost?.time || myTeam.defaultTime
    const venue = latestMyPost?.venue || myTeam.preferredVenue
    return { day, time, venue }
  }, [latestMyPost, myTeam.defaultDay, myTeam.defaultTime, myTeam.preferredVenue])

  const scoreCandidate = (candidate) => {
    const elo = candidate.elo ?? getTeamElo(candidate)
    const opponentStrength = getTeamStrength(candidate)
    const myStrength = getTeamStrength(myTeam)
    const distance = getTeamDistanceMetrics(candidate)
    const distanceKm = distance.betweenTeamsKm ?? distance.scoreDistanceKm
    const eloDiff = Math.abs(elo - myStrength.elo)

    if (eloDiff > HARD_FILTERS.maxEloDiff) {
      return null
    }

    if (distanceKm !== null && distanceKm > HARD_FILTERS.maxDistanceKm) {
      return null
    }

    const availability = getAvailabilityScore(candidate, preferredContext)
    const formFit = getFormScore(myStrength, opponentStrength)
    const skillScore = getSkillScore(myTeam.skill, candidate.skill)
    const profileConfidence = getProfileConfidence(candidate)
    const proposedDay = availability.availability.day || preferredContext.day
    const proposedTime = (availability.availability.slots && availability.availability.slots[0]) || preferredContext.time
    const proposedVenue = (availability.availability.venues && availability.availability.venues[0]) || preferredContext.venue
    const proposedDate = nextDateForPreferredDay(proposedDay)

    const eloScore = clamp(1 - (eloDiff / 450), 0, 1)
    const distanceScore = clamp(1 - (distanceKm / 18), 0, 1)
    const extraScore = (availability.score * 0.5) + (skillScore * 0.3) + (profileConfidence * 0.2)

    const score = Math.round(100 * (
      (eloScore * COMPATIBILITY_WEIGHTS.elo)
      + (distanceScore * COMPATIBILITY_WEIGHTS.distance)
      + (formFit.score * COMPATIBILITY_WEIGHTS.form)
      + (extraScore * COMPATIBILITY_WEIGHTS.extras)
    ))
    const tier = score >= 80 ? 'Excellent Fit' : score >= 65 ? 'Strong Fit' : score >= 50 ? 'Possible Fit' : 'Low Fit'
    const tierType = score >= 80 ? 'success' : score >= 65 ? 'info' : score >= 50 ? 'warning' : 'muted'
    const distanceDisplay = distance.betweenTeamsKm !== null ? distance.betweenTeamsKm.toFixed(2) : '?'
    const reasons = [
      `ELO gap ${eloDiff} with ${elo}`,
      `${distanceDisplay}km from your team location`,
      formFit.challengeBias > 0 ? 'You can stretch to a stronger opponent' : formFit.challengeBias < 0 ? 'Better for a softer opponent while form recovers' : 'Form is balanced',
      availability.sameDay ? `Both free on ${preferredContext.day}` : `Closest availability: ${availability.availability.day}`,
      availability.venueOverlap ? `Venue match at ${preferredContext.venue}` : `Next best venue: ${availability.availability.venues[0]}`,
      `Skill balance: ${myTeam.skill} vs ${candidate.skill || 'Unknown'}`,
    ]
    return {
      ...candidate,
      elo,
      score,
      tier,
      tierType,
      proposedDate,
      proposedTime,
      proposedVenue,
      reasons,
      breakdown: {
        elo: Math.round(eloScore * 100),
        distance: Math.round(distanceScore * 100),
        form: Math.round(formFit.score * 100),
        extras: Math.round(extraScore * 100),
      },
    }
  }

  useEffect(() => {
    let active = true

    const loadTeams = async () => {
      try {
        const response = await fetch(`${API_BASE}/teams`)
        const data = await response.json()

        if (!response.ok || !Array.isArray(data)) {
          throw new Error('Failed to load seeded teams')
        }

        const mappedTeams = data.map((team, index) => mapBackendTeamToUi(team, index))
        if (!active) return

        setTeams(mappedTeams)
        setMatchPosts(prev => (Array.isArray(prev) && prev.length > 0 ? prev : buildPostsFromTeams(mappedTeams)))
      } catch (_error) {
        if (!active) return
        setTeams(mockTeams)
      }
    }

    loadTeams()

    return () => {
      active = false
    }
  }, [setMatchPosts])

  const recommendationData = useMemo(() => {
    const scored = teams
      .filter(t => t.id !== currentTeamId && t.name !== currentTeamName)
      .map(scoreCandidate)
      .filter(Boolean)
      .sort((a, b) => b.score - a.score)

    return {
      recommended: scored.slice(0, 5),
      others: scored.slice(5),
      hasFallback: scored.length < 5,
      context: preferredContext,
    }
  }, [currentTeamId, currentTeamName, preferredContext, teams, myTeam.lat, myTeam.lng, myTeam.name, myTeam.skill, myTeam.streak, myTeam.elo, myTeam.wins, myTeam.losses])

  const reqModalFit = useMemo(() => {
    if (!reqModal) return null
    return scoreCandidate({
      id: reqModal.id,
      name: reqModal.team,
      location: reqModal.location,
      venue: reqModal.venue,
      wins: 10,
      losses: 8,
      elo: reqModal.elo,
      color: reqModal.color,
      emoji: reqModal.emoji,
      players: reqModal.players,
    })
  }, [reqModal, preferredContext])

  const toast$ = (msg, type='success') => { setToast({ msg, type }); setTimeout(() => setToast({ msg:'', type:'success' }), 3500) }

  const autoPostPreview = useMemo(() => {
    const date = form.date || nextDateForPreferredDay(myTeam.defaultDay)
    const time = form.time || myTeam.defaultTime
    const venue = form.venue || selectSmartVenueByHaversine(myTeam, teams, currentTeamName)
    return { date, time, venue }
  }, [form.date, form.time, form.venue, myTeam.defaultDay, myTeam.defaultTime, myTeam, teams, currentTeamName])

  const visiblePosts = useMemo(() => {
    return safeMatchPosts
      .map(post => ({
        ...post,
        distanceKm: getDistanceKm(currentTeamLocation, post.location),
      }))
      .filter(post => post.team === myTeam.name || post.distanceKm === null || post.distanceKm <= 4)
      .sort((a, b) => (a.distanceKm ?? 999) - (b.distanceKm ?? 999))
  }, [currentTeamLocation, safeMatchPosts, myTeam.name])

  const displayedPosts = useMemo(() => {
    if (showAllPosts) return visiblePosts
    return visiblePosts.slice(0, 3)
  }, [showAllPosts, visiblePosts])

  const submitPost = () => {
    // Exact fields are respected as-is; only blank fields are auto-filled.
    const resolvedDate = form.date || autoPostPreview.date
    const resolvedTime = form.time || autoPostPreview.time
    const resolvedVenue = form.venue || autoPostPreview.venue
    const usedAutoFill = !form.date || !form.time || !form.venue

    const newPost = {
      id: Date.now(),
      team: myTeam.name, emoji: '🦅', elo: 1600,
      location: myTeam.location, date: resolvedDate, time: resolvedTime,
      venue: resolvedVenue, players: 8, note: form.note || 'Open for any match!',
      color: 'green', requestedBy: null, visibility: form.visibility,
    }
    setMatchPosts(prev => [newPost, ...prev])
    setPostModal(false)
    setForm({
      date:'',
      time:'',
      venue:'',
      note:'',
      visibility:'24',
    })
    toast$(usedAutoFill
      ? '📣 Match post is live. Missing fields were auto-selected for you.'
      : '📣 Your match post is live! Teams can now request you.'
    )
  }

  const validateCompatibility = (opponent) => {
    const opponentElo = opponent.elo
    const eloDiff = Math.abs((opponentElo || myTeam.elo) - myTeam.elo)
    if (eloDiff > 320) {
      return { allow:false, message:`⛔ Request blocked: ELO gap is ${eloDiff}. Please use manual match request.` }
    }

    const distanceKm = getDistanceKm(myTeam, opponent) ?? 8
    if (distanceKm > 15) {
      return { allow:true, message:`⚠️ Request sent with caution: ${distanceKm.toFixed(2)}km distance might reduce acceptance.` }
    }

    const preferredMinutes = parseTimeToMinutes(preferredContext.time)
    const opponentMinutes = parseTimeToMinutes(opponent.time)
    const timeGap = preferredMinutes !== null && opponentMinutes !== null
      ? Math.abs(preferredMinutes - opponentMinutes) / 60
      : 0

    if (timeGap > 3) {
      return { allow:true, message:`⚠️ Request sent with warning: time gap is ${timeGap.toFixed(1)} hours.` }
    }

    if (eloDiff > 200) {
      return { allow:true, message:`⚠️ Request sent with warning: ELO gap is ${eloDiff}.` }
    }
    return { allow:true, message:null }
  }

  const acceptRequest = (post) => {
    if (!post?.requestedBy) return

    setMatchPosts(prev => prev.map(p => p.id===post.id ? {...p, requestedBy: null, accepted: true} : p))

    const alreadyBooked = bookings.some(booking => (
      booking.status !== 'cancelled'
      && booking.date === post.date
      && booking.time === post.time
      && booking.venue === post.venue
      && (
        (booking.team === myTeam.name && booking.opponent === post.requestedBy)
        || (booking.team === post.requestedBy && booking.opponent === myTeam.name)
      )
    ))

    if (!alreadyBooked) {
      const baseBookingId = Date.now()
      setBookings(prev => [
        {
          id: baseBookingId,
          team: myTeam.name,
          venue: post.venue,
          date: post.date,
          time: post.time,
          status: 'confirmed',
          players: post.players || 8,
          amount: 'Rs. 1,200',
          opponent: post.requestedBy,
          source: 'find-match-post',
          postId: post.id,
        },
        {
          id: baseBookingId + 1,
          team: post.requestedBy,
          venue: post.venue,
          date: post.date,
          time: post.time,
          status: 'confirmed',
          players: post.players || 8,
          amount: 'Rs. 1,200',
          opponent: myTeam.name,
          source: 'find-match-post',
          postId: post.id,
        },
        ...prev,
      ])
    }

    setChallenges(prev => prev.map(challenge => {
      const isMatchingChallenge = challenge.status === 'pending'
        && challenge.from === post.requestedBy
        && challenge.to === myTeam.name
        && challenge.date === post.date
        && challenge.venue === post.venue

      if (!isMatchingChallenge) return challenge

      return {
        ...challenge,
        status: 'accepted',
        date: post.date,
        time: post.time,
        venue: post.venue,
        exactSchedule: true,
        source: 'find-match-post',
      }
    }))

    setNotifications(prev => [{
      id: Date.now(),
      text: `${myTeam.name} accepted your match request. ${post.date} at ${post.time} (${post.venue}).`,
      time: 'just now',
      unread: true,
      team: post.requestedBy,
      type: 'match-update',
      createdAt: new Date().toISOString(),
    }, ...prev])

    toast$('✅ Match accepted and added to Upcoming Bookings.')
  }

  const sendRequest = (post) => {
    const validation = validateCompatibility(post)
    if (!validation.allow) {
      setReqModal(null)
      toast$(validation.message, 'info')
      return
    }

    setMatchPosts(prev => prev.map(p => p.id===post.id ? {...p, requestedBy:myTeam.name} : p))

    const challengeAlreadyExists = challenges.some(challenge => (
      challenge.from === myTeam.name
      && challenge.to === post.team
      && challenge.date === post.date
      && challenge.time === post.time
      && challenge.venue === post.venue
      && challenge.status === 'pending'
    ))

    if (!challengeAlreadyExists) {
      const challengeId = Date.now()

      setChallenges(prev => [{
        id: challengeId,
        from: myTeam.name,
        to: post.team,
        date: post.date,
        time: post.time,
        venue: post.venue,
        note: post.note || 'Challenge request from Find Match.',
        status: 'pending',
        exactSchedule: true,
        source: 'find-match-post',
        postId: post.id,
      }, ...prev])

      setNotifications(prev => [{
        id: Date.now(),
        challengeId,
        type: 'challenge-request',
        text: `${myTeam.name} requested a match with you.`,
        time: 'just now',
        unread: true,
        team: post.team,
        createdAt: new Date().toISOString(),
      }, ...prev])
    }

    setReqModal(null)
    toast$(validation.message || `⚡ Join request sent to ${post.team}!`, validation.message ? 'info' : 'success')
  }

  const deletePost = (id) => {
    setMatchPosts(prev => prev.filter(p => p.id!==id))
    toast$('Post removed.', 'info')
  }

  const hitTeam = team => {
    const challengeId = Date.now()

    setChallenges(prev => [{
      id: challengeId,
      from: myTeam.name,
      to: team.name,
      date: team.proposedDate || toIsoDate(1),
      time: team.proposedTime || myTeam.defaultTime,
      venue: team.proposedVenue || preferredContext.venue,
      note: 'Manual challenge from team recommendation panel.',
      status: 'pending',
    }, ...prev])

    setNotifications(prev => [{
      id: Date.now(),
      challengeId,
      type: 'challenge-request',
      text: `${myTeam.name} sent you a manual challenge request.`,
      time: 'just now',
      unread: true,
      team: team.name,
      createdAt: new Date().toISOString(),
    }, ...prev])

    toast$(`⚡ Request sent to ${team.name}. They will see it in Challenges and Notifications.`, 'success')
  }

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-area">
        <Topbar title="Find Match" breadcrumb="Team / Find Match" />
        <div className="page-inner">

          {toast.msg && (
            <div className={`alert alert-${toast.type==='info' ? 'info' : 'success'}`}>
              <i className={`fas fa-${toast.type==='info' ? 'circle-info' : 'check-circle'}`} />
              {toast.msg}
            </div>
          )}

          <div className="sec-hd anim-1">
            <div>
              <h2>Find a Match</h2>
              <p>Weighted matching across ELO, venue distance, form, and smaller fit signals</p>
            </div>
            <button className="btn btn-primary" onClick={() => setPostModal(true)}>
              <i className="fas fa-bullhorn" /> Post Your Team
            </button>
          </div>

          <div className="card anim-2" style={{ marginBottom:20, border:'1px solid var(--border)' }}>
            <div style={{ padding:'14px 16px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'space-between', gap:8, flexWrap:'wrap' }}>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <i className="fas fa-wand-magic-sparkles" style={{ color:'var(--blue)' }} />
                <strong style={{ fontSize:14 }}>Recommended For You</strong>
              </div>
              <span className="badge badge-info">Top {recommendationData.recommended.length} Algorithm Matches</span>
            </div>
            <div style={{ padding:'10px 16px', background:'var(--bg)', borderBottom:'1px solid var(--border)', fontSize:12, color:'var(--txt-3)' }}>
              Tuned for {recommendationData.context.day}, {recommendationData.context.time} at {recommendationData.context.venue}
            </div>
            <div style={{ padding:'14px 16px' }}>
              {recommendationData.recommended.length === 0 ? (
                <div className="empty-state" style={{ margin:0 }}>
                  <i className="fas fa-robot" />
                  <h3>No recommendations yet</h3>
                  <p>As more team activity data arrives, this section will auto-populate.</p>
                </div>
              ) : (
                <div className="team-grid">
                  {recommendationData.recommended.map((team, i) => (
                    <div key={team.id} className={`team-card anim-${Math.min(i+1,5)}`}>
                      <div className={`tc-header ${team.color}`}>
                        <div className="tc-emoji">{team.emoji}</div>
                        <h3>{team.name}</h3>
                        <p><i className="fas fa-location-dot" /> {team.location}</p>
                        <span className="tc-skill-badge">ELO {team.elo}</span>
                      </div>
                      <div className="tc-body">
                        <div className="tc-meta">
                          <div className="tc-meta-item"><i className="fas fa-users" />{team.players} players</div>
                          <div className="tc-meta-item"><i className="fas fa-trophy" />{team.wins}W / {team.losses}L</div>
                          <div className="tc-meta-item"><i className="fas fa-chart-line" />{team.score}% fit</div>
                        </div>
                        <div style={{ marginBottom:10 }}>
                          <span className={`badge badge-${team.tierType}`}>{team.tier}</span>
                        </div>
                        <div style={{ display:'flex', flexWrap:'wrap', gap:10, marginBottom:10, fontSize:12, color:'#4a5568' }}>
                          <span><i className="fas fa-calendar" style={{ color:'var(--orange)', marginRight:4 }} />{team.proposedDate || toIsoDate(1)}</span>
                          <span><i className="fas fa-clock" style={{ color:'var(--purple)', marginRight:4 }} />{team.proposedTime || myTeam.defaultTime}</span>
                        </div>
                        <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:14 }}>
                          {team.reasons.slice(0, 3).map(reason => (
                            <span key={reason} className="badge badge-muted">{reason}</span>
                          ))}
                        </div>
                        <button className="btn btn-outline btn-full" onClick={() => hitTeam(team)}>
                          <i className="fas fa-flag-checkered" /> Request Match
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {recommendationData.hasFallback && recommendationData.others.length > 0 && (
            <div className="card anim-3" style={{ marginBottom:20, border:'1px dashed var(--border)' }}>
              <div style={{ padding:'14px 16px', borderBottom:'1px solid var(--border)' }}>
                <strong style={{ fontSize:14 }}>Not Enough Data Yet</strong>
                <p style={{ margin:'6px 0 0', fontSize:13, color:'var(--txt-3)' }}>
                  Showing additional nearby teams while recommendation quality improves.
                </p>
              </div>
              <div style={{ padding:'14px 16px' }}>
                <div className="team-grid">
                {recommendationData.others.map((team, i) => (
                  <div key={team.id} className={`team-card anim-${Math.min(i+1,5)}`}>
                    <div className={`tc-header ${team.color}`}>
                      <div className="tc-emoji">{team.emoji}</div>
                      <h3>{team.name}</h3>
                      <p><i className="fas fa-location-dot" /> {team.location}</p>
                      <span className="tc-skill-badge">ELO {team.elo}</span>
                    </div>
                    <div className="tc-body">
                      <div className="tc-meta">
                        <div className="tc-meta-item"><i className="fas fa-users" />{team.players} players</div>
                        <div className="tc-meta-item"><i className="fas fa-trophy" />{team.wins}W / {team.losses}L</div>
                        <div className="tc-meta-item"><i className="fas fa-chart-line" />{team.score}% fit</div>
                      </div>
                      <div style={{ marginBottom:10 }}>
                        <span className={`badge badge-${team.tierType}`}>{team.tier}</span>
                      </div>
                      <div style={{ display:'flex', flexWrap:'wrap', gap:10, marginBottom:10, fontSize:12, color:'#4a5568' }}>
                        <span><i className="fas fa-calendar" style={{ color:'var(--orange)', marginRight:4 }} />{team.proposedDate || toIsoDate(1)}</span>
                        <span><i className="fas fa-clock" style={{ color:'var(--purple)', marginRight:4 }} />{team.proposedTime || myTeam.defaultTime}</span>
                      </div>
                      <button className="btn btn-outline btn-full" onClick={() => hitTeam(team)}>
                        <i className="fas fa-flag-checkered" /> Request Match
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              </div>
            </div>
          )}

          {/* ── MATCH BOARD ── */}
          {visiblePosts.length === 0 ? (
            <div className="empty-state">
              <i className="fas fa-clipboard-list" />
              <h3>No open matches</h3>
              <p>Be the first - post your team above!</p>
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
              <div style={{ fontSize:12, color:'#8a96a8', marginBottom:2 }}>Showing nearest options first (ascending by distance)</div>
              {displayedPosts.map((post, i) => {
                const isMine = post.team === myTeam.name
                const hasRequest = !!post.requestedBy
                return (
                  <div key={post.id} className={`card anim-${Math.min(i+1,5)}`} style={{ overflow:'visible' }}>
                    <div style={{ display:'flex', gap:0, flexWrap:'wrap' }}>
                      <div style={{ width:6, background: isMine ? 'var(--green)' : 'var(--blue)', flexShrink:0, borderRadius:'var(--radius) 0 0 var(--radius)' }} />
                      <div style={{ flex:1, padding:'18px 20px', display:'flex', gap:16, flexWrap:'wrap', alignItems:'flex-start' }}>
                        <div style={{ width:52, height:52, borderRadius:14, background: isMine ? 'var(--green-light)' : 'var(--blue-light)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:26, flexShrink:0 }}>
                          {post.emoji}
                        </div>

                        <div style={{ flex:1, minWidth:180 }}>
                          <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap', marginBottom:6 }}>
                            <span style={{ fontFamily:'Barlow Condensed,sans-serif', fontSize:17, fontWeight:900 }}>{post.team}</span>
                            {isMine && <span className="badge badge-success">Your Post</span>}
                            <span className="badge badge-muted">ELO: {post.elo}</span>
                            {post.accepted && <span className="badge badge-info">Match Confirmed ✅</span>}
                            {hasRequest && !isMine && <span className="badge badge-warning">You Requested</span>}
                            {hasRequest &&  isMine && <span className="badge badge-warning">⚡ Request Pending</span>}
                          </div>

                          <div style={{ display:'flex', flexWrap:'wrap', gap:16, fontSize:13, color:'#4a5568', marginBottom:8 }}>
                            <span><i className="fas fa-location-dot" style={{ color:'var(--green)', marginRight:4 }} />{post.location}</span>
                            <span><i className="fas fa-building" style={{ color:'var(--blue)', marginRight:4 }} />{post.venue}</span>
                            <span><i className="fas fa-calendar" style={{ color:'var(--orange)', marginRight:4 }} />{post.date}</span>
                            <span><i className="fas fa-clock" style={{ color:'var(--purple)', marginRight:4 }} />{post.time}</span>
                            <span><i className="fas fa-users" style={{ color:'var(--txt-3)', marginRight:4 }} />{post.players} players</span>
                          </div>

                          {post.note && (
                            <div style={{ fontSize:13, color:'#4a5568', fontStyle:'italic', background:'#f8fafc', padding:'8px 12px', borderRadius:8, borderLeft:'3px solid var(--border)' }}>
                              "{post.note}"
                            </div>
                          )}

                          {isMine && hasRequest && !post.accepted && (
                            <div style={{ marginTop:10, padding:'10px 14px', background:'#fefce8', border:'1px solid #fde68a', borderRadius:8, display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:8 }}>
                              <span style={{ fontSize:13, fontWeight:700, color:'#92400e' }}>
                                <i className="fas fa-bell" style={{ marginRight:6 }} />
                                <strong>{post.requestedBy}</strong> wants to match with you!
                              </span>
                              <div style={{ display:'flex', gap:8 }}>
                                <button className="btn btn-primary btn-sm" onClick={() => acceptRequest(post)}>
                                  <i className="fas fa-check" /> Accept
                                </button>
                                <button className="btn btn-outline btn-sm" onClick={() => setMatchPosts(prev => prev.map(p => p.id===post.id ? {...p,requestedBy:null} : p))}>
                                  Decline
                                </button>
                              </div>
                            </div>
                          )}
                        </div>

                        <div style={{ display:'flex', flexDirection:'column', gap:8, alignItems:'flex-end', flexShrink:0 }}>
                          {isMine ? (
                            <button className="btn btn-outline btn-sm" onClick={() => deletePost(post.id)}>
                              <i className="fas fa-trash" /> Remove
                            </button>
                          ) : post.accepted ? (
                            <span className="badge badge-success" style={{ padding:'6px 12px' }}>Filled</span>
                          ) : hasRequest ? (
                            <span className="badge badge-warning" style={{ padding:'6px 12px' }}>Requested</span>
                          ) : (
                            <button className="btn btn-primary btn-sm" onClick={() => setReqModal(post)}>
                              <i className="fas fa-bolt" /> Request Match
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
              {visiblePosts.length > 3 && (
                <div style={{ display:'flex', justifyContent:'center', marginTop:6 }}>
                  <button
                    className="btn btn-outline btn-sm"
                    onClick={() => setShowAllPosts(v => !v)}
                  >
                    {showAllPosts ? 'See less' : `See more (${visiblePosts.length - 3} more)`}
                  </button>
                </div>
              )}
            </div>
          )}

        </div>
      </div>

      {/* ── POST YOUR TEAM MODAL ── */}
      {postModal && (
        <div className="modal-overlay" onClick={() => setPostModal(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth:500 }}>
            <div className="modal-hd">
              <h3><i className="fas fa-bullhorn" style={{ color:'var(--green)', marginRight:8 }} />Post Your Team</h3>
              <button className="modal-close" onClick={() => setPostModal(false)}><i className="fas fa-xmark" /></button>
            </div>
            <p style={{ fontSize:13, color:'#8a96a8', marginBottom:18 }}>
              Enter exact date, time, and venue if you want strict scheduling. Leave any field blank only if you want auto-fill for that field.
            </p>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
              <div className="form-group">
                <label className="form-label">Exact Date (optional)</label>
                <input type="date" className="form-control" value={form.date} onChange={e => setForm({...form,date:e.target.value})} />
              </div>
              <div className="form-group">
                <label className="form-label">Exact Time (optional)</label>
                <select className="form-control" value={form.time} onChange={e => setForm({...form,time:e.target.value})}>
                  <option value="">Auto choose time (profile default)</option>
                  {POST_TIMES.map(timeOption => <option key={timeOption} value={timeOption}>{timeOption}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
              <div className="form-group">
                <label className="form-label">Request Visibility</label>
                <select className="form-control" value={form.visibility} onChange={e => setForm({...form,visibility:e.target.value})}>
                  <option value="6">6 Hours</option>
                  <option value="12">12 Hours</option>
                  <option value="24">24 Hours</option>
                  <option value="48">48 Hours</option>
                  <option value="72">72 Hours</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Exact Venue (optional)</label>
                <select className="form-control" value={form.venue} onChange={e => setForm({...form,venue:e.target.value})}>
                  <option value="">Auto choose venue</option>
                  <option>Arena Futsal Park</option>
                  <option>Champions Court</option>
                  <option>Goal Zone Futsal</option>
                  <option>Patan Sports Hub</option>
                </select>
              </div>
            </div>

            <div style={{ fontSize:12, color:'#4a5568', background:'#f8fafc', border:'1px solid #e4e8ee', padding:'10px 12px', borderRadius:8, marginBottom:10 }}>
              <strong>Auto-fill preview for blank fields only:</strong> {autoPostPreview.date} at {autoPostPreview.time} • {autoPostPreview.venue}
            </div>

            <div className="form-group">
              <label className="form-label">Message (optional)</label>
              <input type="text" className="form-control" placeholder="e.g. Friendly match, any skill welcome!"
                value={form.note} onChange={e => setForm({...form,note:e.target.value})} />
            </div>
            <div style={{ display:'flex', gap:10, marginTop:8 }}>
              <button className="btn btn-primary" style={{ flex:1 }} onClick={submitPost}>
                <i className="fas fa-bullhorn" /> Post Match
              </button>
              <button className="btn btn-outline" onClick={() => setPostModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── REQUEST MATCH MODAL ── */}
      {reqModal && (
        <div className="modal-overlay" onClick={() => setReqModal(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="modal-hd">
              <h3><i className="fas fa-bolt" style={{ color:'var(--orange)', marginRight:8 }} />Request Match</h3>
              <button className="modal-close" onClick={() => setReqModal(null)}><i className="fas fa-xmark" /></button>
            </div>
            <div style={{ background:'#f8fafc', borderRadius:10, padding:'14px 16px', marginBottom:20 }}>
              <div style={{ fontFamily:'Barlow Condensed,sans-serif', fontSize:18, fontWeight:900, marginBottom:6 }}>
                {reqModal.emoji} {reqModal.team}
              </div>
              {reqModalFit && (
                <div style={{ marginBottom:8, display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                  <span className={`badge badge-${reqModalFit.tierType}`}>{reqModalFit.score}% fit</span>
                  <span className="badge badge-muted">{reqModalFit.tier}</span>
                </div>
              )}
              {[
                { icon:'fa-calendar', val: reqModal.date },
                { icon:'fa-clock',    val: reqModal.time },
                { icon:'fa-building', val: reqModal.venue },
                { icon:'fa-star',   val: `ELO: ${reqModal.elo}` },
              ].map(r => (
                <div key={r.icon} style={{ fontSize:13, color:'#4a5568', marginTop:4, display:'flex', alignItems:'center', gap:8 }}>
                  <i className={`fas ${r.icon}`} style={{ color:'var(--green)', width:14 }} /> {r.val}
                </div>
              ))}
              {reqModal.note && (
                <div style={{ fontSize:13, color:'#4a5568', fontStyle:'italic', marginTop:8 }}>"{reqModal.note}"</div>
              )}
            </div>
            <p style={{ fontSize:13, color:'#4a5568', marginBottom:18 }}>
              Sending a request will notify <strong>{reqModal.team}</strong>. ELO compatibility will be validated before it goes through.
            </p>
            <div style={{ display:'flex', gap:10 }}>
              <button className="btn btn-primary" style={{ flex:1 }} onClick={() => sendRequest(reqModal)}>
                <i className="fas fa-paper-plane" /> Send Request
              </button>
              <button className="btn btn-outline" onClick={() => setReqModal(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}