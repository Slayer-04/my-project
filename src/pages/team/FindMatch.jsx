import React, { useMemo, useState, useEffect } from 'react'
import Sidebar from '../../components/Sidebar.jsx'
import Topbar  from '../../components/Topbar.jsx'
import { teams as mockTeams, venues as mockVenues, LOCATION_COORDS } from '../../data/mockData.js'
import { useAuth } from '../../App.jsx'
import { emitChallengeCreate, onChallengeCreated } from '../../utils/socketService.js'
import { getApiBaseUrl } from '../../utils/apiConfig.js'

const API_BASE = getApiBaseUrl()

/* Open match posts are created manually via the UI; no seed posts */
const POST_COLORS = ['blue', 'teal', 'purple', 'green', 'orange']
const POST_EMOJIS = ['⚽', '🔥', '🦁', '🦅', '🏆', '⚡', '🥅', '🛡️', '🚀', '🎯']
const POST_TIMES = ['06:00 AM', '07:00 AM', '08:00 AM', '09:00 AM', '10:00 AM', '11:00 AM', '12:00 PM', '01:00 PM', '02:00 PM', '03:00 PM', '04:00 PM', '05:00 PM', '06:00 PM', '07:00 PM', '08:00 PM']
const POST_VENUES = ['Arena Futsal Park', 'Champions Court', 'Goal Zone Futsal', 'Patan Sports Hub']

const SKILL_TO_ELO = { Beginner:1000, Intermediate:1500, Advanced:2000 }
const SKILL_LEVEL = { Beginner: 1, Intermediate: 2, Advanced: 3 }
const COMPATIBILITY_WEIGHTS = {
  elo: 0.25,
  distance: 0.5,
  form: 0.15,
  extras: 0.1,
}
const HARD_FILTERS = {
  maxEloDiff: 400,
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
const normalizeTeamKey = (value) => String(value || '').trim().toLowerCase()

const getTeamStrength = (team) => {
  const elo = Number(team?.elo ?? SKILL_TO_ELO[team?.skill] ?? 1500)
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

const getVenueFitScore = (candidate, context) => {
  const availability = TEAM_AVAILABILITY[candidate.name] || {
    slots:['07:00 PM'],
    venues:[candidate.venue || 'Arena Futsal Park'],
  }

  const venueOverlap = (availability.venues || []).includes(context.venue)

  const venueScore = venueOverlap ? 1 : 0.55

  return {
    score: venueScore,
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

const formatMonthDay = (dateValue) => {
  if (!dateValue) return '-'
  const date = new Date(dateValue)
  if (Number.isNaN(date.getTime())) return String(dateValue)
  return date.toLocaleDateString('en-US', { month:'short', day:'numeric' })
}

const venueDisplayLabel = (venue) => {
  const name = String(venue?.name || '').trim()
  const location = String(venue?.location || '').trim()
  if (!name && !location) return ''
  if (!location) return name
  return `${name} - ${location}`
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
      const eloGap = Math.abs((myTeam.elo ?? 1500) - (team.elo ?? 1500))
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
    elo: Number(team.eloRating ?? team.elo ?? SKILL_TO_ELO[team.skill] ?? 1500),
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

const parseScheduledPostDate = (post) => {
  const dateText = String(post?.date || '').trim()
  if (!dateText) return null

  const scheduledDate = new Date(dateText)
  if (Number.isNaN(scheduledDate.getTime())) return null

  const timeText = String(post?.time || '').trim()
  const timeMatch = timeText.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i)
  if (timeMatch) {
    let hours = Number(timeMatch[1])
    const minutes = Number(timeMatch[2])
    const meridiem = timeMatch[3]?.toUpperCase()

    if (meridiem === 'PM' && hours !== 12) hours += 12
    if (meridiem === 'AM' && hours === 12) hours = 0

    scheduledDate.setHours(hours, minutes, 0, 0)
  } else {
    scheduledDate.setHours(23, 59, 59, 999)
  }

  return scheduledDate
}

const isActiveMatchPost = (post) => {
  const dateText = String(post?.date || '').trim()
  if (!dateText) return true

  const postDate = new Date(dateText)
  if (Number.isNaN(postDate.getTime())) return true

  // Keep posts visible until end of their scheduled day (midnight)
  // so a post for "today" stays visible all day regardless of time
  const endOfPostDay = new Date(postDate)
  endOfPostDay.setHours(23, 59, 59, 999)

  return endOfPostDay.getTime() >= Date.now()
}

export default function FindMatch() {
  const { user, challenges, setChallenges, notifications, setNotifications, matchPosts, setMatchPosts, bookings, setBookings } = useAuth()
  const [teams,     setTeams]     = useState(mockTeams)
  const [toast,     setToast]     = useState({ msg:'', type:'success' })
  const [postModal, setPostModal] = useState(false)
  const [reqModal,  setReqModal]  = useState(null)
  const [showAllPosts, setShowAllPosts] = useState(false)
  const [venueOptions, setVenueOptions] = useState([])
  const [showVenueSuggestions, setShowVenueSuggestions] = useState(false)
  const [form,      setForm]      = useState({
    date:'',
    time:'',
    venue:'',
    note:'',
    visibility:'24',
  })

  // Defined early so all useEffects and handlers below can safely call it
  const toast$ = (msg, type='success') => { setToast({ msg, type }); setTimeout(() => setToast({ msg:'', type:'success' }), 3500) }

  const currentTeamName = user?.teamInfo?.name || user?.teamInfo?.teamName || user?.teamInfo?.captainName || user?.name || user?.teamName || 'My Team'
  const currentTeamId = user?.id || user?._id || null
  const canManageTeam = user?.teamAccess !== 'basic' && user?.isCaptain !== false

  const myTeam = useMemo(() => ({
    name: currentTeamName,
    elo: user?.eloRating ?? user?.teamInfo?.eloRating ?? 1500,
    location: user?.teamInfo?.location || 'Lazimpat',
    lat: user?.teamInfo?.lat ?? 27.7184,
    lng: user?.teamInfo?.lng ?? 85.3235,
    skill: user?.teamInfo?.skill || user?.skill || 'Intermediate',
    wins: user?.teamInfo?.wins ?? 0,
    losses: user?.teamInfo?.losses ?? 0,
    streak: user?.teamInfo?.streak ?? 0,
    profileCompleted: Boolean(user?.teamProfileCompleted),
    locationVerified: Boolean(user?.locationVerified),
    preferredVenue: 'Arena Futsal Park',
    winRate: 0.58,
  }), [currentTeamName, user?.eloRating, user?.locationVerified, user?.skill, user?.teamInfo?.eloRating, user?.teamInfo?.lat, user?.teamInfo?.lng, user?.teamInfo?.location, user?.teamInfo?.losses, user?.teamInfo?.skill, user?.teamInfo?.streak, user?.teamInfo?.teamName, user?.teamInfo?.name, user?.teamInfo?.wins, user?.teamName, user?.teamProfileCompleted])
  const currentTeamLocation = myTeam.location
  const safeMatchPosts = (Array.isArray(matchPosts) ? matchPosts : []).filter(isActiveMatchPost)

  const venueCoordinateMap = useMemo(() => {
    const map = new Map()
    venueOptions.forEach(venue => {
      if (typeof venue.lat === 'number' && typeof venue.lng === 'number') {
        map.set(String(venue.label || '').toLowerCase(), { lat: venue.lat, lng: venue.lng })
        map.set(String(venue.name || '').toLowerCase(), { lat: venue.lat, lng: venue.lng })
      }
    })
    return map
  }, [venueOptions])

  const resolveVenueCoords = (venueLabel) => {
    const raw = String(venueLabel || '').trim()
    if (!raw) return null

    const lower = raw.toLowerCase()
    if (venueCoordinateMap.has(lower)) {
      return venueCoordinateMap.get(lower)
    }

    if (LOCATION_COORDS[raw]) {
      return LOCATION_COORDS[raw]
    }

    const venueName = raw.includes(' - ') ? raw.split(' - ')[0].trim() : raw
    if (venueCoordinateMap.has(venueName.toLowerCase())) {
      return venueCoordinateMap.get(venueName.toLowerCase())
    }

    return LOCATION_COORDS[venueName] || null
  }

  const getTeamElo = (team) => team.elo ?? SKILL_TO_ELO[team.skill] ?? 1500

  const getTeamDistanceMetrics = (team) => {
    const postedVenueCoords = resolveVenueCoords(team.postedVenue || team.venue)
    const venueDistanceKm = postedVenueCoords ? getDistanceKm(myTeam, postedVenueCoords) : null
    const betweenTeamsKm = getDistanceKm(myTeam, team)
    const fallbackDistance = venueDistanceKm ?? betweenTeamsKm ?? 8

    return {
      scoreDistanceKm: fallbackDistance,
      betweenTeamsKm,
      venueDistanceKm,
    }
  }

  const matchContext = useMemo(() => ({ venue: myTeam.preferredVenue }), [myTeam.preferredVenue])

  const scoreCandidate = (candidate) => {
    const elo = candidate.elo ?? getTeamElo(candidate)
    const opponentStrength = getTeamStrength(candidate)
    const myStrength = getTeamStrength(myTeam)
    const distance = getTeamDistanceMetrics(candidate)
    const distanceKm = distance.venueDistanceKm ?? distance.scoreDistanceKm
    const eloDiff = Math.abs(elo - myStrength.elo)

    if (eloDiff > HARD_FILTERS.maxEloDiff) {
      return null
    }

    if (distanceKm !== null && distanceKm > HARD_FILTERS.maxDistanceKm) {
      return null
    }

    const venueFit = getVenueFitScore(candidate, matchContext)
    const formFit = getFormScore(myStrength, opponentStrength)
    const skillScore = getSkillScore(myTeam.skill, candidate.skill)
    const profileConfidence = getProfileConfidence(candidate)
    const proposedTime = candidate.postedTime || ''
    const proposedVenue = candidate.postedVenue || (venueFit.availability.venues && venueFit.availability.venues[0]) || matchContext.venue
    const proposedDate = candidate.postedDate || toIsoDate(1)

    const eloScore = clamp(1 - (eloDiff / 450), 0, 1)
    const distanceScore = clamp(1 - (distanceKm / 18), 0, 1)
    const extraScore = (venueFit.score * 0.5) + (skillScore * 0.3) + (profileConfidence * 0.2)

    const score = Math.round(100 * (
      (eloScore * COMPATIBILITY_WEIGHTS.elo)
      + (distanceScore * COMPATIBILITY_WEIGHTS.distance)
      + (formFit.score * COMPATIBILITY_WEIGHTS.form)
      + (extraScore * COMPATIBILITY_WEIGHTS.extras)
    ))
    const tier = score >= 80 ? 'Excellent Fit' : score >= 65 ? 'Strong Fit' : score >= 50 ? 'Possible Fit' : 'Low Fit'
    const tierType = score >= 80 ? 'success' : score >= 65 ? 'info' : score >= 50 ? 'warning' : 'muted'
    const distanceDisplay = distance.venueDistanceKm !== null ? distance.venueDistanceKm.toFixed(2) : '?'
    const reasons = [
      `ELO gap ${eloDiff} with ${elo}`,
      `${distanceDisplay}km from your team to posted futsal`,
      `Posted futsal: ${proposedVenue}`,
      formFit.challengeBias > 0 ? 'You can stretch to a stronger opponent' : formFit.challengeBias < 0 ? 'Better for a softer opponent while form recovers' : 'Form is balanced',
      venueFit.venueOverlap ? `Venue match at ${matchContext.venue}` : `Posted venue: ${proposedVenue}`,
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
      } catch (_error) {
        if (!active) return
        setTeams(mockTeams)
      }
    }

    loadTeams()

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    let active = true

    const fallbackVenues = (Array.isArray(mockVenues) ? mockVenues : []).map((venue, index) => ({
      id: venue._id || venue.id || `mock-venue-${index + 1}`,
      name: String(venue.name || '').trim(),
      location: String(venue.location || '').trim(),
      label: venueDisplayLabel(venue),
      lat: typeof venue.lat === 'number' ? venue.lat : LOCATION_COORDS[venue.name]?.lat,
      lng: typeof venue.lng === 'number' ? venue.lng : LOCATION_COORDS[venue.name]?.lng,
    })).filter(venue => venue.name && venue.label)

    const loadVenues = async () => {
      try {
        const response = await fetch(`${API_BASE}/venues`)
        const data = await response.json()

        if (!response.ok || !Array.isArray(data)) {
          throw new Error('Failed to load venues')
        }

        const mapped = data
          .map((venue, index) => ({
            id: venue._id || venue.id || `venue-${index + 1}`,
            name: String(venue.name || '').trim(),
            location: String(venue.location || '').trim(),
            label: venueDisplayLabel(venue),
            lat: typeof venue.lat === 'number' ? venue.lat : null,
            lng: typeof venue.lng === 'number' ? venue.lng : null,
          }))
          .filter(venue => venue.name && venue.label)

        const uniqueByLabel = [...new Map(mapped.map(venue => [venue.label.toLowerCase(), venue])).values()]

        if (!active) return
        setVenueOptions(uniqueByLabel)
      } catch (_error) {
        if (!active) return
        setVenueOptions(fallbackVenues)
      }
    }

    loadVenues()

    return () => {
      active = false
    }
  }, [])

  // Match posts now live on the backend (MatchPost model) so that availability
  // and expiry are enforced consistently for every team, not just the browser
  // that created the post. Poll it, same pattern as venues/teams above.
  useEffect(() => {
    let active = true

    const mapPostFromApi = (post) => ({
      id: post._id || post.id,
      team: post.team,
      venue: post.venue,
      date: post.date,
      time: post.time,
      players: post.players || 8,
      note: post.note || '',
      color: 'green',
      emoji: '🦅',
      elo: null,
      location: '',
      status: post.status,
      requestedBy: post.requestedBy || null,
      challengeId: post.challengeId || null,
      visibility: post.visibilityHours,
    })

    const loadMatchPosts = async () => {
      try {
        const response = await fetch(`${API_BASE}/match-posts`)
        const data = await response.json()

        if (!response.ok || !Array.isArray(data)) {
          throw new Error('Failed to load match posts')
        }

        if (!active) return
        setMatchPosts(data.map(mapPostFromApi))
      } catch (_error) {
        // Keep whatever is already in state if the fetch fails momentarily.
      }
    }

    loadMatchPosts()
    const pollId = setInterval(loadMatchPosts, 5000)

    return () => {
      active = false
      clearInterval(pollId)
    }
  }, [setMatchPosts])

  // Listen for challenge creations from other teams
  useEffect(() => {
    const unsubscribe = onChallengeCreated((challengeData) => {
      console.log('[FindMatch] Received challenge:created event:', challengeData)
      
      // Only process if challenge is directed to this team
      if (challengeData.to !== currentTeamName) return
      
      const newNotification = {
        id: Date.now(),
        challengeId: challengeData.id,
        type: 'challenge-request',
        text: `${challengeData.from} sent you a match request.`,
        time: 'just now',
        unread: true,
        team: currentTeamName,
        createdAt: new Date().toISOString(),
      }
      
      // Add challenge to local state
      setChallenges(prev => {
        const alreadyExists = prev.some(c => c.id === challengeData.id)
        if (alreadyExists) return prev
        return [challengeData, ...prev]
      })
      
      // Add notification to local state
      setNotifications(prev => [newNotification, ...prev])
      
      toast$(`⚡ ${challengeData.from} sent you a match request!`, 'info')
    })

    return () => {
      if (unsubscribe) unsubscribe()
    }
  }, [currentTeamName, setChallenges, setNotifications])

  const postedRecommendationCandidates = useMemo(() => {
    const profileByTeamName = new Map(teams.map(team => [normalizeTeamKey(team.name), team]))
    const seenTeams = new Set()
    const myTeamKey = normalizeTeamKey(myTeam.name)

    return safeMatchPosts
      .filter(post => post && post.team && normalizeTeamKey(post.team) !== myTeamKey && post.venue)
      .filter(post => {
        const key = normalizeTeamKey(post.team)
        if (seenTeams.has(key)) return false
        seenTeams.add(key)
        return true
      })
      .map((post, index) => {
        const profile = profileByTeamName.get(normalizeTeamKey(post.team)) || {}
        return {
          id: `posted-${post.id || index + 1}`,
          name: post.team,
          skill: profile.skill || 'Intermediate',
          location: profile.location || post.location || 'Kathmandu',
          lat: typeof profile.lat === 'number' ? profile.lat : null,
          lng: typeof profile.lng === 'number' ? profile.lng : null,
          players: profile.players || post.players || 8,
          wins: profile.wins || 0,
          losses: profile.losses || 0,
          streak: profile.streak || 0,
          elo: profile.elo || post.elo || 1500,
          color: profile.color || post.color || POST_COLORS[index % POST_COLORS.length],
          emoji: profile.emoji || post.emoji || POST_EMOJIS[index % POST_EMOJIS.length],
          profileCompleted: typeof profile.profileCompleted === 'boolean' ? profile.profileCompleted : true,
          locationVerified: typeof profile.locationVerified === 'boolean' ? profile.locationVerified : true,
          postedVenue: post.venue,
          postedTime: post.time || '',
          postedDate: post.date || '',
          matchPostId: post.id,
        }
      })
  }, [safeMatchPosts, teams, myTeam.name])

  const recommendationData = useMemo(() => {
    const scored = postedRecommendationCandidates
      .map(scoreCandidate)
      .filter(Boolean)
      .sort((a, b) => b.score - a.score)

    return {
      recommended: scored.slice(0, 5),
      others: scored.slice(5),
      hasFallback: scored.length < 5,
      context: matchContext,
    }
  }, [postedRecommendationCandidates, matchContext, myTeam.lat, myTeam.lng, myTeam.name, myTeam.skill, myTeam.streak, myTeam.elo, myTeam.wins, myTeam.losses])

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
  }, [reqModal, matchContext])

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

  const resolveVenueNameLocal = (venueInput) => {
    const raw = String(venueInput || '').trim()
    if (!raw) return raw

    const lower = raw.toLowerCase()
    const exactMatch = venueOptions.find(v => v.name.toLowerCase() === lower || v.label.toLowerCase() === lower)
    if (exactMatch) return exactMatch.name

    if (raw.includes(' - ')) {
      const namePart = raw.split(' - ')[0].trim().toLowerCase()
      const byNamePart = venueOptions.find(v => v.name.toLowerCase() === namePart)
      if (byNamePart) return byNamePart.name
    }

    return raw
  }

  const bookedTimesForSelectedSlot = useMemo(() => {
    if (!form.venue || !form.date) return new Set()
    const canonicalVenue = resolveVenueNameLocal(form.venue)
    return new Set(
      bookings
        .filter(b => b.status === 'confirmed' && b.venue === canonicalVenue && b.date === form.date)
        .map(b => b.time)
    )
  }, [bookings, form.venue, form.date, venueOptions])

  const availablePostTimes = useMemo(() => (
    POST_TIMES.filter(t => !bookedTimesForSelectedSlot.has(t))
  ), [bookedTimesForSelectedSlot])

  const submitPost = async () => {
    if (!canManageTeam) {
      toast$('Only the captain can post matches.', 'info')
      return
    }

    if (!form.date || !form.time || !String(form.venue || '').trim()) {
      toast$('Please select date, time, and venue.', 'info')
      return
    }

    // Fast local check — the backend re-validates this for real before creating the post.
    if (bookedTimesForSelectedSlot.has(form.time)) {
      toast$(`${form.time} on ${form.date} is already booked at that venue. Please pick another time.`, 'info')
      return
    }

    try {
      const response = await fetch(`${API_BASE}/match-posts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          team: myTeam.name,
          venue: resolveVenueNameLocal(form.venue),
          date: form.date,
          time: form.time,
          players: 8,
          note: form.note || 'Open for any match!',
          visibilityHours: Number(form.visibility) || 24,
        }),
      })

      const result = await response.json().catch(() => ({}))

      if (!response.ok) {
        // e.g. the slot was booked by someone else moments ago.
        toast$(result.message || 'Unable to create that match post right now.', 'info')
        return
      }

      const created = result.matchPost
      setMatchPosts(prev => [{
        id: created._id || created.id,
        team: created.team,
        venue: created.venue,
        date: created.date,
        time: created.time,
        players: created.players || 8,
        note: created.note || '',
        color: 'green',
        emoji: '🦅',
        elo: myTeam.elo,
        location: myTeam.location,
        status: created.status,
        requestedBy: null,
        visibility: created.visibilityHours,
      }, ...prev])

      setPostModal(false)
      setForm({
        date:'',
        time:'',
        venue:'',
        note:'',
        visibility:'24',
      })
      toast$('📣 Your match post is live! Teams can now request you.')
    } catch (_error) {
      toast$('Unable to create that match post right now. Please check your connection and try again.', 'info')
    }
  }

  const validateCompatibility = (opponent) => {
    const opponentElo = opponent.elo
    const eloDiff = Math.abs((opponentElo || myTeam.elo) - myTeam.elo)
    if (eloDiff > 400) {
      return { allow:false, message:`⛔ Request blocked: ELO gap is ${eloDiff}. Please use manual match request.` }
    }

    const distanceKm = getDistanceKm(myTeam, opponent) ?? 8
    if (distanceKm > 15) {
      return { allow:true, message:`⚠️ Request sent with caution: ${distanceKm.toFixed(2)}km distance might reduce acceptance.` }
    }

    if (eloDiff > 300) {
      return { allow:true, message:`⚠️ Request sent with warning: ELO gap is ${eloDiff}.` }
    }
    return { allow:true, message:null }
  }

  // Helper: normalise a MongoDB ObjectId or numeric id to a plain string for comparison
  const resolveId = (value) => String(value || '').trim()

  // Accepting now happens entirely on the backend in one atomic call:
  // POST /match-posts/:id/accept re-checks the slot is still free, books it
  // for both teams, marks the challenge accepted, and removes the post — all
  // in a single transaction (with a race-safe fallback if the DB doesn't
  // support multi-document transactions). If the slot was taken by someone
  // else in the meantime, the backend expires the post and tells us why.
  const acceptRequest = async (post) => {
    if (!canManageTeam) {
      toast$('Only the captain can accept match requests.', 'info')
      return
    }

    if (!post?.requestedBy) return

    if (normalizeTeamKey(post.requestedBy) === normalizeTeamKey(myTeam.name)) {
      toast$('Cannot create a match against your own team.', 'info')
      return
    }

    try {
      const response = await fetch(`${API_BASE}/match-posts/${post.id}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })

      const result = await response.json().catch(() => ({}))

      if (!response.ok) {
        // Slot got booked by someone else, post already gone, etc.
        setMatchPosts(prev => prev.filter(p => p.id !== post.id))
        toast$(result.message || 'Unable to accept that match right now.', 'info')
        return
      }

      // Success — the post is gone server-side; drop it locally too, and let
      // the next bookings/challenges poll pick up the two new confirmed bookings.
      setMatchPosts(prev => prev.filter(p => p.id !== post.id))
      setChallenges(prev => prev.map(challenge => (
        resolveId(challenge._id || challenge.id) === resolveId(post.challengeId)
          ? { ...challenge, status: 'accepted' }
          : challenge
      )))

      toast$('✅ Match accepted and booked for both teams.')
    } catch (_error) {
      toast$('Unable to accept that match right now. Please check your connection and try again.', 'info')
    }
  }

  const declineRequest = async (post) => {
    if (!canManageTeam) {
      toast$('Only the captain can decline match requests.', 'info')
      return
    }

    try {
      const response = await fetch(`${API_BASE}/match-posts/${post.id}/decline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })

      const result = await response.json().catch(() => ({}))

      if (!response.ok) {
        toast$(result.message || 'Unable to decline that request right now.', 'info')
        return
      }

      const updated = result.matchPost
      if (updated?.status === 'expired') {
        setMatchPosts(prev => prev.filter(p => p.id !== post.id))
      } else {
        setMatchPosts(prev => prev.map(p => p.id === post.id ? { ...p, requestedBy: null, status: 'open' } : p))
      }
    } catch (_error) {
      toast$('Unable to decline that request right now. Please check your connection and try again.', 'info')
    }
  }

  const sendRequest = async (post) => {
    if (!canManageTeam) {
      toast$('Only the captain can send match requests.', 'info')
      return
    }

    // Prevent a team from requesting their own post
    if (normalizeTeamKey(post.team) === normalizeTeamKey(myTeam.name)) {
      toast$('You cannot send a request to your own post.', 'info')
      return
    }

    const validation = validateCompatibility(post)

    try {
      const response = await fetch(`${API_BASE}/match-posts/${post.id}/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestedBy: myTeam.name }),
      })

      const result = await response.json().catch(() => ({}))

      if (!response.ok) {
        // Backend rejected it (duplicate pending request, slot no longer
        // available, etc). If the slot is gone, drop the post locally too.
        if (response.status === 409 && /booked|available/i.test(String(result.message || ''))) {
          setMatchPosts(prev => prev.filter(p => p.id !== post.id))
        }
        toast$(result.message || 'Unable to send that match request right now.', 'info')
        return
      }

      if (result.challenge) {
        emitChallengeCreate({
          id: result.challenge._id,
          from: result.challenge.from,
          to: result.challenge.to,
          date: result.challenge.date,
          time: result.challenge.time,
          venue: result.challenge.venue,
          note: result.challenge.note,
          status: result.challenge.status,
        })
        setChallenges(prev => [{ ...result.challenge, id: result.challenge._id }, ...prev])
      }

      setMatchPosts(prev => prev.map(p => (
        p.id === post.id ? { ...p, status: 'requested', requestedBy: myTeam.name } : p
      )))
      setReqModal(null)
      toast$(validation.message || `⚡ Join request sent to ${post.team}!`, validation.message ? 'info' : 'success')
    } catch (_error) {
      toast$('Unable to send that match request right now. Please check your connection and try again.', 'info')
    }
  }

  const deletePost = async (id) => {
    setMatchPosts(prev => prev.filter(p => p.id !== id))
    try {
      await fetch(`${API_BASE}/match-posts/${id}`, { method: 'DELETE' })
    } catch (_error) {
      // The post is already gone from the UI; a failed network call here
      // just means it may reappear on the next poll, which is an acceptable
      // fallback rather than blocking the user on a delete confirmation.
    }
    toast$('Post removed.', 'info')
  }

  const hitTeam = async team => {
    if (!canManageTeam) {
      toast$('Only the captain can send match requests.', 'info')
      return
    }

    if (!team.matchPostId) {
      toast$('Unable to send that request right now.', 'info')
      return
    }

    try {
      const response = await fetch(`${API_BASE}/match-posts/${team.matchPostId}/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestedBy: myTeam.name }),
      })

      const result = await response.json().catch(() => ({}))

      if (!response.ok) {
        if (response.status === 409 && /booked|available/i.test(String(result.message || ''))) {
          setMatchPosts(prev => prev.filter(p => p.id !== team.matchPostId))
        }
        toast$(result.message || 'Unable to send that request right now.', 'info')
        return
      }

      if (result.challenge) {
        emitChallengeCreate({
          id: result.challenge._id,
          from: result.challenge.from,
          to: result.challenge.to,
          date: result.challenge.date,
          time: result.challenge.time,
          venue: result.challenge.venue,
          note: result.challenge.note,
          status: result.challenge.status,
        })
        setChallenges(prev => [{ ...result.challenge, id: result.challenge._id }, ...prev])
      }

      setMatchPosts(prev => prev.map(p => (
        p.id === team.matchPostId ? { ...p, status: 'requested', requestedBy: myTeam.name } : p
      )))
      toast$(`⚡ Request sent to ${team.name}. They will see it in Challenges and Notifications.`, 'success')
    } catch (_error) {
      toast$('Unable to send that request right now. Please check your connection and try again.')
    }
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
              Tuned by ELO, distance, form, and posted venue
            </div>
            <div style={{ padding:'14px 16px' }}>
              {recommendationData.recommended.length === 0 ? (
                <div className="empty-state" style={{ margin:0 }}>
                  <i className="fas fa-robot" />
                  <h3>No recommendations yet</h3>
                  <p>This section shows algorithmic recommendations based on existing manual posts.</p>
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
                          <span><i className="fas fa-calendar" style={{ color:'var(--orange)', marginRight:4 }} />{formatMonthDay(team.proposedDate || toIsoDate(1))}</span>
                          <span><i className="fas fa-clock" style={{ color:'var(--purple)', marginRight:4 }} />{team.proposedTime || '06:00 PM'}</span>
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
                        <span><i className="fas fa-calendar" style={{ color:'var(--orange)', marginRight:4 }} />{formatMonthDay(team.proposedDate || toIsoDate(1))}</span>
                        <span><i className="fas fa-clock" style={{ color:'var(--purple)', marginRight:4 }} />{team.proposedTime || '06:00 PM'}</span>
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
              <p>Create a post using the "Post Your Team" button — automatic posts are disabled.</p>
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
                            <span><i className="fas fa-calendar" style={{ color:'var(--orange)', marginRight:4 }} />{formatMonthDay(post.date)}</span>
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
                                <button className="btn btn-outline btn-sm" onClick={() => declineRequest(post)}>
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
              Select exact date, time, and venue for your post.
            </p>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
              <div className="form-group">
                <label className="form-label">Exact Date</label>
                <input type="date" className="form-control" value={form.date} onChange={e => setForm({...form,date:e.target.value})} />
              </div>
              <div className="form-group">
                <label className="form-label">Exact Time</label>
                <select className="form-control" value={form.time} onChange={e => setForm({...form,time:e.target.value})}>
                  <option value="">{form.venue && form.date ? 'Select an available time' : 'Select venue and date first'}</option>
                  {availablePostTimes.map(timeOption => <option key={timeOption} value={timeOption}>{timeOption}</option>)}
                </select>
                {form.venue && form.date && availablePostTimes.length === 0 && (
                  <div style={{ fontSize:12, color:'#b91c1c', marginTop:6 }}>
                    No open time slots left for this venue on this date.
                  </div>
                )}
                {form.venue && form.date && availablePostTimes.length < POST_TIMES.length && availablePostTimes.length > 0 && (
                  <div style={{ fontSize:12, color:'#8a96a8', marginTop:6 }}>
                    Already-booked times for this venue/date are hidden.
                  </div>
                )}
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
                <label className="form-label">Exact Venue</label>
                <div style={{ position:'relative' }}>
                  <input
                    type="text"
                    className="form-control"
                    value={form.venue}
                    placeholder="Type venue name or location"
                    onFocus={() => setShowVenueSuggestions(true)}
                    onBlur={() => setTimeout(() => setShowVenueSuggestions(false), 120)}
                    onChange={e => {
                      setForm({ ...form, venue: e.target.value })
                      setShowVenueSuggestions(true)
                    }}
                  />
                  {showVenueSuggestions && (
                    <div style={{ position:'absolute', left:0, right:0, top:'calc(100% + 6px)', maxHeight:210, overflowY:'auto', background:'#fff', border:'1px solid var(--border)', borderRadius:10, zIndex:20, boxShadow:'0 10px 24px rgba(0,0,0,.12)' }}>
                      {venueOptions
                        .filter(venue => {
                          const query = String(form.venue || '').trim().toLowerCase()
                          if (!query) return true
                          return venue.label.toLowerCase().includes(query) || venue.name.toLowerCase().includes(query) || venue.location.toLowerCase().includes(query)
                        })
                        .slice(0, 12)
                        .map(venue => (
                          <button
                            key={venue.id}
                            type="button"
                            onMouseDown={() => {
                              setForm({ ...form, venue: venue.label })
                              setShowVenueSuggestions(false)
                            }}
                            style={{ width:'100%', textAlign:'left', padding:'10px 12px', border:'none', background:'#fff', cursor:'pointer', fontSize:13 }}
                          >
                            {venue.label}
                          </button>
                        ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Message (optional)</label>
              <input type="text" className="form-control" placeholder="e.g. Friendly match, any skill welcome!"
                value={form.note} onChange={e => setForm({...form,note:e.target.value})} />
            </div>
            <div style={{ display:'flex', gap:10, marginTop:8 }}>
              <button className="btn btn-primary" style={{ flex:1 }} onClick={submitPost} disabled={!form.date || !form.time || !form.venue}>
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
                { icon:'fa-calendar', val: formatMonthDay(reqModal.date) },
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