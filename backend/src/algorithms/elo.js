const DEFAULT_RATING = 1000
const DEFAULT_K_FACTOR = 32
const MIN_RATING = 100
const MAX_RATING = 3000

function assertNumber(value, label) {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    throw new Error(label + ' must be a valid number.')
  }
}

function assertScore(value, label) {
  assertNumber(value, label)
  if (value !== 0 && value !== 0.5 && value !== 1) {
    throw new Error(label + ' must be 0, 0.5, or 1.')
  }
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

function expectedScore(ratingA, ratingB) {
  assertNumber(ratingA, 'ratingA')
  assertNumber(ratingB, 'ratingB')

  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400))
}

function scoreFromGoals(goalsForA, goalsForB) {
  assertNumber(goalsForA, 'goalsForA')
  assertNumber(goalsForB, 'goalsForB')

  if (goalsForA > goalsForB) return 1
  if (goalsForA < goalsForB) return 0
  return 0.5
}

function calculateNewRatings(options) {
  const {
    ratingA,
    ratingB,
    scoreA,
    kFactor = DEFAULT_K_FACTOR,
    round = true,
    minRating = MIN_RATING,
    maxRating = MAX_RATING,
  } = options || {}

  assertNumber(ratingA, 'ratingA')
  assertNumber(ratingB, 'ratingB')
  assertNumber(kFactor, 'kFactor')
  assertNumber(minRating, 'minRating')
  assertNumber(maxRating, 'maxRating')
  assertScore(scoreA, 'scoreA')

  if (kFactor <= 0) {
    throw new Error('kFactor must be greater than 0.')
  }

  if (minRating > maxRating) {
    throw new Error('minRating cannot be greater than maxRating.')
  }

  const expectedA = expectedScore(ratingA, ratingB)
  const expectedB = 1 - expectedA
  const scoreB = 1 - scoreA

  let newRatingA = ratingA + kFactor * (scoreA - expectedA)
  let newRatingB = ratingB + kFactor * (scoreB - expectedB)

  newRatingA = clamp(newRatingA, minRating, maxRating)
  newRatingB = clamp(newRatingB, minRating, maxRating)

  if (round) {
    newRatingA = Math.round(newRatingA)
    newRatingB = Math.round(newRatingB)
  }

  return {
    ratingA: newRatingA,
    ratingB: newRatingB,
    expectedA,
    expectedB,
    scoreA,
    scoreB,
    deltaA: newRatingA - ratingA,
    deltaB: newRatingB - ratingB,
  }
}

function updateRatingsFromGoals(options) {
  const { ratingA = DEFAULT_RATING, ratingB = DEFAULT_RATING, goalsForA, goalsForB, ...rest } = options || {}

  const scoreA = scoreFromGoals(goalsForA, goalsForB)

  return calculateNewRatings({
    ratingA,
    ratingB,
    scoreA,
    ...rest,
  })
}

module.exports = {
  DEFAULT_RATING,
  DEFAULT_K_FACTOR,
  expectedScore,
  scoreFromGoals,
  calculateNewRatings,
  updateRatingsFromGoals,
}
