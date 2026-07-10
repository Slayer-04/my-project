const Booking = require('../models/Booking')
const MatchPost = require('../models/MatchPost')
const Venue = require('../models/Venue')
const Notification = require('../models/Notification')

const norm = value => (typeof value === 'string' ? value.trim() : '')

/**
 * The app has two different booking flows that historically stored the venue
 * name differently: direct venue booking stores just the plain venue name
 * ("Lalipur Sporting Club"), while the Find Match "post" flow's autocomplete
 * stored "name - location" labels ("Lalipur Sporting Club - Pulchowk"). Those
 * two strings never matched each other, so slot-conflict checks between the
 * two flows silently failed.
 *
 * This resolves ANY venue input (plain name, "name - location" label, or a
 * venueId) down to the venue's canonical `name` in the database, so every
 * flow that touches a venue's schedule (bookings, match posts, accept/confirm)
 * compares against the exact same string. If no matching Venue record is
 * found, the trimmed input is used as-is (so this stays backward compatible
 * with any bookings created before venues were formally seeded).
 */
const resolveVenueName = async (venueInput, venueId = null) => {
  if (venueId) {
    const byId = await Venue.findById(venueId)
    if (byId) return byId.name
  }

  const raw = norm(venueInput)
  if (!raw) return raw

  // Try an exact match first (covers the plain-name case).
  const exact = await Venue.findOne({ name: raw })
  if (exact) return exact.name

  // Fall back to stripping a "name - location" suffix and matching just the name.
  if (raw.includes(' - ')) {
    const namePart = raw.split(' - ')[0].trim()
    const byNamePart = await Venue.findOne({ name: namePart })
    if (byNamePart) return byNamePart.name
  }

  return raw
}

/**
 * Look up the venue record backing a (now-canonical) venue name, returning
 * whatever we know about its owner so a booking can be linked to them and/or
 * they can be notified. Never throws - a venue with no linked owner account
 * simply returns empty strings, and callers should treat that as "nothing to
 * notify" rather than an error.
 */
const getVenueOwnerInfo = async (venueName) => {
  const venue = await Venue.findOne({ name: norm(venueName) })
  if (!venue) return { venueId: null, ownerName: '', ownerEmail: '' }
  return {
    venueId: venue._id,
    ownerName: norm(venue.owner),
    ownerEmail: norm(venue.ownerEmail).toLowerCase(),
  }
}

/**
 * Tell the venue owner a match was just confirmed at their court. Reuses the
 * same Notification model/feed every team already polls - the owner's account
 * just needs its display name (or email) to match `venue.owner`/`ownerEmail`
 * for this to show up in their bell, consistent with how the rest of the app
 * resolves "who am I" for notification purposes.
 */
const notifyVenueOwnerOfMatch = async ({ venueName, teamA, teamB, date, time }) => {
  const { ownerName, ownerEmail } = await getVenueOwnerInfo(venueName)
  const recipient = ownerName || ownerEmail
  if (!recipient) return

  try {
    await Notification.create({
      team: recipient,
      text: `Match confirmed between ${teamA} and ${teamB} for ${date} at ${time} — slot reserved at ${venueName}.`,
      type: 'match-update',
      unread: true,
      createdAt: new Date(),
    })
  } catch (_error) {
    // Best-effort - a failed owner notification should never undo a booking.
  }
}

/**
 * Is this exact venue/date/time slot already held by a confirmed, primary
 * booking? "Primary" is what matters here — the two sibling bookings created
 * for an accepted match share a slot on purpose, but only one of them is ever
 * primary, so this correctly reports "taken" the moment either side exists.
 */
const isSlotTaken = async ({ venue, date, time, session = null }) => {
  const query = {
    venue: norm(venue),
    date: norm(date),
    time: norm(time),
    status: 'confirmed',
    role: 'primary',
  }

  const existing = session
    ? await Booking.findOne(query).session(session)
    : await Booking.findOne(query)

  return !!existing
}

/**
 * Mark any open/requested match posts for this exact slot as expired, except
 * (optionally) the one identified by `exceptId` — used when a booking is
 * created (or confirmed) so any other post pointing at the same now-unavailable
 * slot disappears immediately, for every team, not just the one that acted.
 */
const expirePostsForSlot = async ({ venue, date, time, exceptId = null }, session = null) => {
  const filter = {
    venue: norm(venue),
    date: norm(date),
    time: norm(time),
    status: { $in: ['open', 'requested'] },
  }

  if (exceptId) {
    filter._id = { $ne: exceptId }
  }

  const update = MatchPost.updateMany(filter, { $set: { status: 'expired' } })
  if (session) {
    await update.session(session)
  } else {
    await update
  }
}

/**
 * Safety-net sweep: called on read (GET /match-posts) so that even if some
 * booking-creation path forgets to call expirePostsForSlot directly, stale
 * posts still get cleaned up the next time anyone looks at the board.
 */
const sweepExpiredMatchPosts = async () => {
  const activePosts = await MatchPost.find({ status: { $in: ['open', 'requested'] } })
  if (activePosts.length === 0) return

  const confirmedPrimaryBookings = await Booking.find({ status: 'confirmed', role: 'primary' })
  const takenSlots = new Set(
    confirmedPrimaryBookings.map(b => `${norm(b.venue).toLowerCase()}|${norm(b.date)}|${norm(b.time)}`)
  )

  const now = Date.now()

  const idsToExpire = activePosts
    .filter(post => {
      const slotKey = `${norm(post.venue).toLowerCase()}|${norm(post.date)}|${norm(post.time)}`
      if (takenSlots.has(slotKey)) return true

      // Also expire posts whose visibility window or match date/time has passed.
      const createdAt = post.createdAt ? new Date(post.createdAt).getTime() : now
      const visibilityMs = (Number(post.visibilityHours) || 24) * 60 * 60 * 1000
      if (createdAt + visibilityMs < now) return true

      return false
    })
    .map(post => post._id)

  if (idsToExpire.length > 0) {
    await MatchPost.updateMany({ _id: { $in: idsToExpire } }, { $set: { status: 'expired' } })
  }
}

module.exports = { isSlotTaken, expirePostsForSlot, sweepExpiredMatchPosts, resolveVenueName, getVenueOwnerInfo, notifyVenueOwnerOfMatch }