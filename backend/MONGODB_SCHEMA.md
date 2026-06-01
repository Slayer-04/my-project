# FotMatch MongoDB Schema Documentation

## Overview
MongoDB is the source of truth for FotMatch data. Each Mongoose model maps to one collection, and the collections below cover the full application state: auth, teams, venues, bookings, challenges, match history, score submissions, notifications, join requests, and pending registrations.

## Collection Summary

| Collection | Model | Purpose | Main Relations | Key Indexes |
| --- | --- | --- | --- | --- |
| `teams` | `Team` | Team profile, rating, and match stats | `users.teamInfo.teamId` | `uid`, `email` |
| `users` | `User` | Login identity and role-specific profile | `teamInfo.teamId` -> `teams` | `email` |
| `venues` | `Venue` | Futsal venues and pricing | referenced by bookings | `uid`, `name` |
| `bookings` | `Booking` | Court reservations and confirmations | `venueId` -> `venues`, `challengeId` -> `challenges` | booking lookups by `team`, `ownerEmail`, `venue`, `date` |
| `challenges` | `Challenge` | Team-vs-team match requests | referenced by notifications | `from`, `to`, `createdAt` |
| `matches` | `Match` | Historical match record | `bookingId` -> `bookings` | `team`, `createdAt` |
| `matchresults` | `MatchResult` | Submitted scores for verification / history | `bookingId` -> `bookings` | `bookingId`, `team` |
| `notifications` | `Notification` | In-app team notifications | `challengeId` -> `challenges`, `bookingId` -> `bookings` | `team`, `createdAt` |
| `teamjoinrequests` | `TeamJoinRequest` | Requests to join a team | `teamId` -> `teams` | `teamUid`, `requesterEmail`, `status` |
| `pendingregistrations` | `PendingRegistration` | Email records awaiting verification / onboarding | none | `email` |

## Collection Details

### `Team`
Stores team profile, competitive rating, and profile completion metadata.

```javascript
{
  _id: ObjectId,
  uid: String,
  captainName: String,
  email: String,
  teamName: String,
  district: String,
  location: String,
  skill: Enum['Beginner', 'Intermediate', 'Advanced', ''],
  teamProfileCompleted: Boolean,
  locationVerified: Boolean,
  skillLocked: Boolean,
  locationLocked: Boolean,
  profileCompletedAt: Date,
  preferredDay: Enum['Monday'..'Sunday', ''],
  preferredTime: String,
  lat: Number,
  lng: Number,
  eloRating: Number,
  eloMatchesPlayed: Number,
  matchesWon: Number,
  matchesLost: Number,
  currentStreak: Number,
  createdAt: Date,
  updatedAt: Date
}
```

### `User`
Stores authentication identity and embeds the role-specific profile summary.

```javascript
{
  _id: ObjectId,
  name: String,
  email: String,
  password: String,
  role: Enum['team', 'owner', 'admin'],
  teamInfo: {
    teamId: ObjectId,
    teamName: String,
    captainName: String
  },
  teamAccess: Enum['full', 'basic'],
  isCaptain: Boolean,
  ownerProfile: {
    venueName: String,
    location: String,
    district: String,
    lat: Number,
    lng: Number,
    courts: Number,
    phone: String,
    hours: String,
    operatingHours: {
      open: String,
      close: String
    },
    pricing: {
      weekdayDay: Number,
      weekdayEvening: Number,
      weekend: Number
    },
    locationVerified: Boolean
  },
  status: Enum['active', 'inactive', 'suspended'],
  profileCompleted: Boolean,
  lastLogin: Date,
  verified: Boolean,
  verificationToken: String,
  otp: {
    codeHash: String,
    expiresAt: Date,
    attempts: Number
  },
  createdAt: Date,
  updatedAt: Date
}
```

### `Venue`
Stores futsal venue metadata, operating hours, and pricing plans.

```javascript
{
  _id: ObjectId,
  uid: String,
  name: String,
  location: String,
  rating: Number,
  price: String,
  emoji: String,
  type: Enum['Indoor', 'Outdoor'],
  courts: Number,
  pricePerHour: Number,
  pricing: {
    weekdayDay: Number,
    weekdayEvening: Number,
    weekend: Number,
    eveningStart: String
  },
  lat: Number,
  lng: Number,
  operatingHours: {
    open: String,
    close: String
  },
  owner: String,
  ownerEmail: String,
  contactPhone: String,
  amenities: [String],
  availability: {
    monday: Boolean,
    tuesday: Boolean,
    wednesday: Boolean,
    thursday: Boolean,
    friday: Boolean,
    saturday: Boolean,
    sunday: Boolean
  },
  createdAt: Date,
  updatedAt: Date
}
```

### `Booking`
Tracks court reservations, confirmation state, and booking owner metadata.

```javascript
{
  _id: ObjectId,
  team: String,
  teamEmail: String,
  venueId: ObjectId,
  venue: String,
  ownerName: String,
  ownerEmail: String,
  date: String,
  time: String,
  status: Enum['confirmed', 'pending', 'cancelled'],
  players: Number,
  amount: String,
  opponent: String,
  challengeId: ObjectId,
  source: String,
  postId: String,
  note: String,
  createdAt: Date,
  updatedAt: Date
}
```

### `Challenge`
Represents a challenge sent from one team to another.

```javascript
{
  _id: ObjectId,
  from: String,
  to: String,
  date: String,
  time: String,
  venue: String,
  status: Enum['pending', 'accepted', 'declined', 'cancelled'],
  note: String,
  acceptedAt: Date,
  sentAt: Date,
  createdAt: Date,
  updatedAt: Date
}
```

### `Match`
Stores historical match results tied to bookings.

```javascript
{
  _id: ObjectId,
  bookingId: ObjectId,
  team: String,
  opponent: String,
  venue: String,
  date: String,
  time: String,
  myScore: Number,
  opponentScore: Number,
  result: Enum['win', 'loss', 'draw'],
  note: String,
  createdAt: Date,
  updatedAt: Date
}
```

### `MatchResult`
Stores submitted scores and verification metadata before or alongside match history.

```javascript
{
  _id: ObjectId,
  bookingId: ObjectId,
  team: String,
  opponent: String,
  myScore: Number,
  opponentScore: Number,
  matchDate: String,
  matchTime: String,
  venue: String,
  submittedBy: String,
  verified: Boolean,
  verifiedByOpponent: Boolean,
  timestamp: Date,
  createdAt: Date,
  updatedAt: Date
}
```

### `Notification`
Tracks in-app notifications shown in the team topbar.

```javascript
{
  _id: ObjectId,
  team: String,
  text: String,
  time: String,
  unread: Boolean,
  type: Enum['challenge-request', 'join-request', 'match-update', 'score-submission', 'general'],
  challengeId: ObjectId,
  bookingId: ObjectId,
  joinRequestId: ObjectId,
  joinRequestStatus: Enum['pending', 'approved', 'declined', 'left', ''],
  requesterName: String,
  requesterEmail: String,
  teamUid: String,
  createdAt: Date
}
```

### `TeamJoinRequest`
Tracks requests from players to join a team and their review status.

```javascript
{
  _id: ObjectId,
  teamId: ObjectId,
  teamUid: String,
  teamName: String,
  captainName: String,
  captainEmail: String,
  requesterName: String,
  requesterEmail: String,
  message: String,
  status: Enum['pending', 'approved', 'declined', 'left'],
  reviewedAt: Date,
  createdAt: Date,
  updatedAt: Date
}
```

### `PendingRegistration`
Stores users who started registration but have not fully completed onboarding.

```javascript
{
  _id: ObjectId,
  email: String,
  captainName: String,
  role: String,
  createdAt: Date
}
```

## Notes

- The Mongoose models are the source of truth for the actual collection structure.
- MongoDB collections are created automatically when the application first writes to them.
- For best consistency, keep `User.teamInfo.teamId` synchronized with `Team._id` and use `Team.uid` / `Venue.uid` for public-facing identifiers.

**API Endpoints:**
- `POST /api/users/register` - Register new user
- `GET /api/users/:id` - Get user profile

---

## Relationships

```
Team (1) ─── (many) Bookings
Team (1) ─── (many) Challenges
Team (1) ─── (many) Matches
Team (1) ─── (many) Notifications

Challenge (1) ───── (many) Bookings
Challenge (1) ───── (many) Notifications

Booking (1) ───── (many) Matches
Booking (1) ───── (many) MatchResults
Booking (1) ───── (many) Notifications

Venue (1) ───── (many) Bookings

User (1) ───── (1) Team
```

---

## Indexes (Recommended)

```javascript
// Bookings
db.bookings.createIndex({ team: 1 })
db.bookings.createIndex({ date: 1 })
db.bookings.createIndex({ createdAt: -1 })

// Challenges
db.challenges.createIndex({ from: 1, to: 1 })
db.challenges.createIndex({ status: 1 })
db.challenges.createIndex({ createdAt: -1 })

// Matches
db.matches.createIndex({ team: 1 })
db.matches.createIndex({ bookingId: 1 })
db.matches.createIndex({ createdAt: -1 })

// Notifications
db.notifications.createIndex({ team: 1, unread: 1 })
db.notifications.createIndex({ createdAt: -1 })

// Venues
db.venues.createIndex({ name: 1, unique: true })
db.venues.createIndex({ rating: -1 })

// Users
db.users.createIndex({ email: 1, unique: true })
db.users.createIndex({ role: 1 })
```

---

## Environment Variables

Required in `backend/.env`:

```
MONGODB_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/<database>
PORT=5000
```

---

## Data Flow

1. **Team Registration** → Team document created
2. **Challenge Sent** → Challenge + Notification created
3. **Challenge Accepted** → Challenge status updated, Booking created (2 records - one per team)
4. **Match Finished** → MatchResult submitted
5. **Score Verification** → Match document created, ELO ratings updated

---

## Notes

- All timestamps are ISO 8601 format
- Dates are stored as `YYYY-MM-DD` strings for consistency with frontend
- Times are stored as `HH:MM AM/PM` format
- Passwords should be hashed before storage (use bcrypt)
- Consider adding validation middleware for all POST/PATCH requests
- Implement authentication middleware for protected routes
- Use pagination for list endpoints to handle large datasets
