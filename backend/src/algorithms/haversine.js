const EARTH_RADIUS_KM = 6371

function assertNumber(value, label) {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    throw new Error(label + ' must be a valid number.')
  }
}

function toRadians(value) {
  assertNumber(value, 'value')
  return (value * Math.PI) / 180
}

function normalizePoint(point, label) {
  if (!point || typeof point !== 'object') {
    throw new Error(label + ' must be an object with lat and lng.')
  }

  const lat = Number(point.lat)
  const lng = Number(point.lng)

  assertNumber(lat, label + '.lat')
  assertNumber(lng, label + '.lng')

  return { lat, lng }
}

function haversineDistanceKm(pointA, pointB) {
  const from = normalizePoint(pointA, 'pointA')
  const to = normalizePoint(pointB, 'pointB')

  const latDelta = toRadians(to.lat - from.lat)
  const lngDelta = toRadians(to.lng - from.lng)

  const a = Math.sin(latDelta / 2) ** 2
    + Math.cos(toRadians(from.lat)) * Math.cos(toRadians(to.lat)) * Math.sin(lngDelta / 2) ** 2
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  return EARTH_RADIUS_KM * c
}

function resolveCoordinates(team, fallbackMap = {}) {
  if (!team || typeof team !== 'object') {
    return null
  }

  if (typeof team.lat === 'number' && typeof team.lng === 'number') {
    return { lat: team.lat, lng: team.lng }
  }

  if (team.location && fallbackMap[team.location]) {
    return fallbackMap[team.location]
  }

  return null
}

function rankTeamsByDistance(options) {
  const { origin, teams, fallbackMap = {} } = options || {}

  if (!origin) {
    throw new Error('origin is required.')
  }

  if (!Array.isArray(teams)) {
    throw new Error('teams must be an array.')
  }

  const originCoords = resolveCoordinates(origin, fallbackMap)
  if (!originCoords) {
    throw new Error('origin must have coordinates or a known location.')
  }

  return teams
    .map((team) => {
      const coords = resolveCoordinates(team, fallbackMap)
      const distanceKm = coords ? haversineDistanceKm(originCoords, coords) : null

      return {
        ...team,
        distanceKm,
      }
    })
    .sort((left, right) => {
      if (left.distanceKm === null && right.distanceKm === null) return 0
      if (left.distanceKm === null) return 1
      if (right.distanceKm === null) return -1
      return left.distanceKm - right.distanceKm
    })
}

module.exports = {
  EARTH_RADIUS_KM,
  toRadians,
  normalizePoint,
  haversineDistanceKm,
  resolveCoordinates,
  rankTeamsByDistance,
}