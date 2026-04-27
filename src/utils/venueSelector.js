import { teams as mockTeams, venues, LOCATION_COORDS, bookings as mockBookings } from '../data/mockData.js'

/**
 * Haversine distance calculator
 * Returns distance in kilometers between two coordinates
 */
function haversineDistanceKm(pointA, pointB) {
  const EARTH_RADIUS_KM = 6371
  const toRadians = (val) => (val * Math.PI) / 180

  const lat1 = toRadians(pointA.lat)
  const lon1 = toRadians(pointA.lng)
  const lat2 = toRadians(pointB.lat)
  const lon2 = toRadians(pointB.lng)

  const dLat = lat2 - lat1
  const dLon = lon2 - lon1

  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  return EARTH_RADIUS_KM * c
}

/**
 * Get team location coordinates
 */
function getTeamCoordinates(teamName) {
  const team = mockTeams.find(t => t.name === teamName)
  if (team) {
    return { lat: team.lat, lng: team.lng }
  }
  // Fallback to mock location if exact team not found
  return { lat: 27.7128, lng: 85.3240 } // Kathmandu center
}

/**
 * Find the best venue for a challenge between two teams
 * Considers: proximity to both teams, rating, and availability
 */
export function selectBestVenue(teamA, teamB, allBookings = []) {
  const coordsA = getTeamCoordinates(teamA)
  const coordsB = getTeamCoordinates(teamB)

  // Calculate midpoint between two teams
  const midLat = (coordsA.lat + coordsB.lat) / 2
  const midLng = (coordsA.lng + coordsB.lng) / 2
  const midpoint = { lat: midLat, lng: midLng }

  // Score each venue
  const scoredVenues = venues.map(venue => {
    const venueCoords = LOCATION_COORDS[venue.name]

    if (!venueCoords) {
      return { ...venue, score: 0, distance: Infinity }
    }

    // Distance score (closer is better, max 10)
    const distance = haversineDistanceKm(midpoint, venueCoords)
    const distanceScore = Math.max(0, 10 - distance * 2) // Penalize distance

    // Rating score (4.3-4.8 range, normalize to 0-10)
    const ratingScore = (venue.rating / 5) * 10

    // Availability score (venues with more available slots score higher)
    const availableSlots = venue.slots ? venue.slots.filter(s => s.status === 'available').length : 0
    const availabilityScore = (availableSlots / 8) * 10 // Assuming max 8 slots

    // Weighted score
    const score = distanceScore * 0.5 + ratingScore * 0.3 + availabilityScore * 0.2

    return {
      ...venue,
      score,
      distance,
      availableSlots,
    }
  })

  // Return highest scoring venue
  const bestVenue = scoredVenues.sort((a, b) => b.score - a.score)[0]
  return bestVenue.name
}

/**
 * Find the best available time slot for a venue
 * Preference: evening times, and closest to suggested time if provided
 * Never suggests times that have already passed today
 */
export function selectBestTimeSlot(venueName, preferredDate, preferredTime = null, allBookings = []) {
  // Generate available slots for the date
  const allSlots = []
  for (let hour = 6; hour <= 22; hour++) {
    const timeStr = hour < 12 
      ? `${hour.toString().padStart(2, '0')}:00 AM`
      : hour === 12
        ? '12:00 PM'
        : `${(hour - 12).toString().padStart(2, '0')}:00 PM`
    allSlots.push(timeStr)
  }

  // Get current date and time
  const now = new Date()
  const today = now.toISOString().split('T')[0]
  const currentHour = now.getHours()
  const currentMinute = now.getMinutes()

  // Filter out booked slots for this venue and date
  const bookedSlots = new Set(
    allBookings
      .filter(b => b.venue === venueName && b.date === preferredDate)
      .map(b => b.time)
  )

  // Filter out past times if booking is for today
  const availableSlots = allSlots.filter(slot => {
    if (!bookedSlots.has(slot)) {
      // If it's today, exclude past times
      if (preferredDate === today) {
        const slotMinutes = parseTimeToMinutes(slot)
        const nowMinutes = currentHour * 60 + currentMinute
        return slotMinutes > nowMinutes + 60 // Must be at least 1 hour from now
      }
      return true
    }
    return false
  })

  if (availableSlots.length === 0) {
    // No available slots, return null
    return null
  }

  // Score slots: prefer evening (after 4 PM), then proximity to preferred time
  const scoredSlots = availableSlots.map(slot => {
    let score = 0

    // Prefer evening times (4 PM onwards)
    const hour = parseInt(slot)
    if (hour >= 16) {
      score += 5 // Evening bonus
    } else if (hour >= 14) {
      score += 3 // Afternoon acceptable
    }

    // If preferred time given, prefer closer times
    if (preferredTime) {
      const slotMinutes = parseTimeToMinutes(slot)
      const preferredMinutes = parseTimeToMinutes(preferredTime)

      if (slotMinutes !== null && preferredMinutes !== null) {
        const timeDiff = Math.abs(slotMinutes - preferredMinutes)
        score += Math.max(0, 10 - timeDiff / 60) // Closer times score higher
      }
    }

    return { slot, score }
  })

  // Return highest scoring slot
  const bestSlot = scoredSlots.sort((a, b) => b.score - a.score)[0]
  return bestSlot ? bestSlot.slot : availableSlots[0]
}

/**
 * Helper: Parse time string to minutes since midnight
 */
function parseTimeToMinutes(timeStr) {
  if (!timeStr) return null

  const is12Hour = /AM|PM/i.test(timeStr)
  if (!is12Hour) {
    // 24-hour format
    const [h, m] = timeStr.split(':').map(Number)
    if (Number.isNaN(h) || Number.isNaN(m)) return null
    return h * 60 + m
  }

  // 12-hour format
  const parts = timeStr.trim().split(' ')
  const [h, m] = parts[0].split(':').map(Number)
  const meridiem = parts[1]?.toUpperCase()

  if (Number.isNaN(h) || Number.isNaN(m) || !meridiem) return null

  let hour = h
  if (meridiem === 'PM' && hour !== 12) hour += 12
  if (meridiem === 'AM' && hour === 12) hour = 0

  return hour * 60 + m
}

/**
 * Select both venue and time optimally for a match
 * Returns { venue, time } object
 */
export function selectOptimalMatchLocation(teamA, teamB, preferredDate, preferredTime = null, allBookings = []) {
  const venue = selectBestVenue(teamA, teamB, allBookings)
  const time = selectBestTimeSlot(venue, preferredDate, preferredTime, allBookings)

  return {
    venue,
    time: time || preferredTime || '06:00 PM', // Fallback times
  }
}
