# FotMatch MongoDB Schema Documentation

## Overview
FotMatch uses MongoDB as its primary database with the following collections to manage teams, matches, challenges, venues, and match results.

---

## Collections & Schema

### 1. **Teams** (`Team`)
Stores information about futsal teams participating in the platform.

```javascript
{
  _id: ObjectId,
  captainName: String (required, unique),
  email: String (required, unique, lowercase),
  teamName: String,
  district: String,
  location: String,
  skill: Enum['Beginner', 'Intermediate', 'Advanced'],
  teamProfileCompleted: Boolean (default: false),
  locationVerified: Boolean (default: false),
  skillLocked: Boolean (default: false),
  locationLocked: Boolean (default: false),
  profileCompletedAt: Date,
  preferredDay: Enum['Monday'-'Sunday'],
  preferredTime: String,
  lat: Number (latitude),
  lng: Number (longitude),
  eloRating: Number (default: 1000, min: 100, max: 3000),
  eloMatchesPlayed: Number (default: 0),
  matchesWon: Number (default: 0),
  matchesLost: Number (default: 0),
  currentStreak: Number (default: 0),
  createdAt: Date,
  updatedAt: Date
}
```

**API Endpoints:**
- `POST /api/teams/register` - Register a new team
- `GET /api/teams/email/:email` - Get team by email

---

### 2. **Bookings** (`Booking`)
Tracks futsal court bookings made by teams.

```javascript
{
  _id: ObjectId,
  team: String (required, team name),
  venue: String (required),
  date: String (required, format: YYYY-MM-DD),
  time: String (required, format: HH:MM AM/PM),
  status: Enum['confirmed', 'pending', 'cancelled'] (default: 'pending'),
  players: Number (required, min: 1),
  amount: String (e.g., 'Rs. 1,200'),
  opponent: String (opponent team name, if from challenge),
  challengeId: ObjectId (reference to Challenge, if applicable),
  note: String,
  createdAt: Date,
  updatedAt: Date
}
```

**API Endpoints:**
- `GET /api/bookings` - Get all bookings
- `GET /api/bookings/team/:teamName` - Get bookings for a specific team
- `POST /api/bookings` - Create new booking
- `PATCH /api/bookings/:id` - Update booking
- `DELETE /api/bookings/:id` - Cancel booking

---

### 3. **Challenges** (`Challenge`)
Manages match challenges between teams.

```javascript
{
  _id: ObjectId,
  from: String (required, sending team name),
  to: String (required, receiving team name),
  date: String (required, format: YYYY-MM-DD),
  time: String (required, format: HH:MM AM/PM),
  venue: String (required),
  status: Enum['pending', 'accepted', 'declined', 'cancelled'] (default: 'pending'),
  note: String,
  acceptedAt: Date (when challenge was accepted),
  sentAt: Date (when challenge was sent),
  createdAt: Date,
  updatedAt: Date
}
```

**API Endpoints:**
- `GET /api/challenges` - Get all challenges
- `GET /api/challenges/team/:teamName` - Get challenges for a specific team
- `POST /api/challenges` - Create new challenge
- `PATCH /api/challenges/:id` - Update challenge status

---

### 4. **Matches** (`Match`)
Stores match results and historical match data.

```javascript
{
  _id: ObjectId,
  bookingId: ObjectId (ref: Booking, required),
  team: String (required, team that is playing),
  opponent: String (required, opponent team name),
  venue: String (required),
  date: String (required, format: YYYY-MM-DD),
  time: String (required, format: HH:MM AM/PM),
  myScore: Number (required, min: 0),
  opponentScore: Number (required, min: 0),
  result: Enum['win', 'loss', 'draw'] (required),
  note: String,
  createdAt: Date,
  updatedAt: Date
}
```

**API Endpoints:**
- `GET /api/matches` - Get all match results
- `GET /api/matches/team/:teamName` - Get matches for a specific team
- `POST /api/matches` - Record a match result

---

### 5. **MatchResults** (`MatchResult`)
Captures submitted match scores for verification.

```javascript
{
  _id: ObjectId,
  bookingId: ObjectId (ref: Booking, required),
  team: String (required, team submitting score),
  opponent: String (required),
  myScore: Number (required, min: 0, max: 100),
  opponentScore: Number (required, min: 0, max: 100),
  matchDate: String (format: YYYY-MM-DD),
  matchTime: String (format: HH:MM AM/PM),
  venue: String (required),
  submittedBy: String (captain name),
  verified: Boolean (default: false),
  verifiedByOpponent: Boolean (default: false),
  timestamp: Date (when was score submitted),
  createdAt: Date,
  updatedAt: Date
}
```

**API Endpoints:**
- `POST /api/match-results` - Submit match score
- `GET /api/match-results/booking/:bookingId` - Get results for a specific booking

---

### 6. **Notifications** (`Notification`)
Tracks in-app notifications for teams.

```javascript
{
  _id: ObjectId,
  team: String (required, receiving team),
  text: String (required, notification message),
  time: String (default: 'just now'),
  unread: Boolean (default: true),
  type: Enum['challenge-request', 'match-update', 'score-submission', 'general'] (default: 'general'),
  challengeId: ObjectId (ref: Challenge, optional),
  bookingId: ObjectId (ref: Booking, optional),
  createdAt: Date (when notification was created)
}
```

**API Endpoints:**
- `GET /api/notifications/team/:teamName` - Get notifications for a team
- `POST /api/notifications` - Create notification
- `PATCH /api/notifications/:id` - Mark as read/update notification

---

### 7. **Venues** (`Venue`)
Stores information about futsal court venues.

```javascript
{
  _id: ObjectId,
  name: String (required, unique),
  location: String (required),
  rating: Number (required, min: 0, max: 5),
  price: String (e.g., 'Rs. 1,200/hr'),
  emoji: String (default: '🏟️'),
  type: Enum['Indoor', 'Outdoor'] (required),
  courts: Number (required, min: 1),
  pricePerHour: Number (required, min: 0),
  lat: Number (latitude),
  lng: Number (longitude),
  operatingHours: {
    open: String (format: HH:MM, default: '06:00'),
    close: String (format: HH:MM, default: '22:00')
  },
  owner: String (venue owner name),
  contactPhone: String,
  amenities: [String] (e.g., ['WiFi', 'Parking', 'Seating']),
  availability: {
    monday: Boolean (default: true),
    tuesday: Boolean (default: true),
    wednesday: Boolean (default: true),
    thursday: Boolean (default: true),
    friday: Boolean (default: true),
    saturday: Boolean (default: true),
    sunday: Boolean (default: true)
  },
  createdAt: Date,
  updatedAt: Date
}
```

**API Endpoints:**
- `GET /api/venues` - Get all venues (sorted by rating)
- `POST /api/venues` - Add new venue
- `PATCH /api/venues/:id` - Update venue details

---

### 8. **Users** (`User`)
Manages user authentication and profiles (for team captains, owners, admins).

```javascript
{
  _id: ObjectId,
  name: String (required),
  email: String (required, unique, lowercase),
  password: String (required, should be hashed),
  role: Enum['team', 'owner', 'admin'] (required),
  teamInfo: {
    teamId: ObjectId (ref: Team),
    teamName: String,
    captainName: String
  },
  status: Enum['active', 'inactive', 'suspended'] (default: 'active'),
  profileCompleted: Boolean (default: false),
  lastLogin: Date,
  verified: Boolean (default: false),
  verificationToken: String,
  createdAt: Date,
  updatedAt: Date
}
```

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
