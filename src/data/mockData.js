/* ─── TEAMS ──────────────────────────────────────────────────────────────── */
const TEAM_BASES = [
  { location:'Lazimpat', lat:27.7184, lng:85.3235 },
  { location:'Baneshwor', lat:27.6881, lng:85.3470 },
  { location:'Thamel', lat:27.7162, lng:85.3128 },
  { location:'Patan', lat:27.6707, lng:85.3202 },
  { location:'Bhaktapur', lat:27.6710, lng:85.4298 },
  { location:'Koteshwor', lat:27.6798, lng:85.3486 },
  { location:'Kirtipur', lat:27.6777, lng:85.2775 },
  { location:'Kalanki', lat:27.6887, lng:85.2760 },
  { location:'Maharajgunj', lat:27.7360, lng:85.3347 },
  { location:'Chabahil', lat:27.7207, lng:85.3487 },
  { location:'Gongabu', lat:27.7308, lng:85.3292 },
  { location:'Swayambhu', lat:27.7149, lng:85.2908 },
  { location:'Pulchowk', lat:27.6764, lng:85.3166 },
  { location:'Gwarko', lat:27.6576, lng:85.3333 },
  { location:'Balkhu', lat:27.6690, lng:85.2918 },
  { location:'Jorpati', lat:27.7443, lng:85.3660 },
  { location:'Kapan', lat:27.7409, lng:85.3602 },
  { location:'Tokha', lat:27.7480, lng:85.3230 },
  { location:'Sanepa', lat:27.6751, lng:85.3076 },
  { location:'Bhaisepati', lat:27.6605, lng:85.2945 },
  { location:'Balkumari', lat:27.6577, lng:85.3420 },
  { location:'Imadol', lat:27.6428, lng:85.3270 },
  { location:'Sifal', lat:27.7020, lng:85.3410 },
  { location:'Naya Bazaar', lat:27.7298, lng:85.3036 },
  { location:'Maitidevi', lat:27.7055, lng:85.3295 },
]

const TEAM_VARIANTS = [
  { suffix:'Lions', skill:'Advanced', color:'blue', emoji:'🦁', players:10, wins:18, losses:4, streak:4 },
  { suffix:'Falcons', skill:'Intermediate', color:'green', emoji:'🦅', players:9, wins:14, losses:6, streak:2 },
  { suffix:'Rangers', skill:'Beginner', color:'orange', emoji:'⚡', players:8, wins:9, losses:9, streak:-3 },
  { suffix:'Titans', skill:'Advanced', color:'purple', emoji:'🏆', players:10, wins:16, losses:5, streak:1 },
]

const TEAM_OFFSETS = [
  { lat:0.0000, lng:0.0000 },
  { lat:0.0012, lng:0.0010 },
  { lat:-0.0010, lng:0.0013 },
  { lat:0.0015, lng:-0.0011 },
]

const buildTeam = (base, baseIndex, variant, variantIndex) => {
  const offset = TEAM_OFFSETS[variantIndex]
  const id = (baseIndex * TEAM_VARIANTS.length) + variantIndex + 1

  return {
    id,
    name: `${base.location} ${variant.suffix}`,
    skill: variant.skill,
    location: base.location,
    lat: Number((base.lat + offset.lat).toFixed(4)),
    lng: Number((base.lng + offset.lng).toFixed(4)),
    players: variant.players - (baseIndex % 2),
    wins: variant.wins + (baseIndex % 6),
    losses: variant.losses + ((baseIndex + variantIndex) % 4),
    streak: variant.streak + ((baseIndex % 3) - 1),
    color: variant.color,
    emoji: variant.emoji,
  }
}

export const teams = TEAM_BASES.flatMap((base, baseIndex) => (
  TEAM_VARIANTS.map((variant, variantIndex) => buildTeam(base, baseIndex, variant, variantIndex))
))

export const LOCATION_COORDS = {
  ...Object.fromEntries(TEAM_BASES.map(({ location, lat, lng }) => ([location, { lat, lng }]))),
  'Arena Futsal Park': { lat: 27.6881, lng: 85.3470 },
  'Champions Court': { lat: 27.7184, lng: 85.3235 },
  'Goal Zone Futsal': { lat: 27.7162, lng: 85.3128 },
  'Patan Sports Hub': { lat: 27.6707, lng: 85.3202 },
}

/* ─── VENUES ─────────────────────────────────────────────────────────────── */
export const venues = [
  {
    id:1, name:'Arena Futsal Park',  location:'Baneshwor, Kathmandu', rating:4.8, price:'Rs. 1,200/hr', emoji:'🏟️', type:'Indoor',
    slots:[
      {time:'06:00 AM',status:'booked'}, {time:'08:00 AM',status:'available'},
      {time:'10:00 AM',status:'available'},{time:'12:00 PM',status:'booked'},
      {time:'02:00 PM',status:'available'},{time:'04:00 PM',status:'available'},
      {time:'06:00 PM',status:'booked'},  {time:'08:00 PM',status:'available'},
    ],
  },
  {
    id:2, name:'Champions Court',    location:'Lazimpat, Kathmandu',  rating:4.6, price:'Rs. 1,000/hr', emoji:'⚽', type:'Outdoor',
    slots:[
      {time:'07:00 AM',status:'available'},{time:'09:00 AM',status:'available'},
      {time:'11:00 AM',status:'booked'},  {time:'01:00 PM',status:'available'},
      {time:'03:00 PM',status:'booked'},  {time:'05:00 PM',status:'available'},
      {time:'07:00 PM',status:'available'},
    ],
  },
  {
    id:3, name:'Goal Zone Futsal',   location:'Thamel, Kathmandu',    rating:4.5, price:'Rs. 1,400/hr', emoji:'🥅', type:'Indoor',
    slots:[
      {time:'06:00 AM',status:'available'},{time:'08:00 AM',status:'booked'},
      {time:'10:00 AM',status:'booked'},  {time:'12:00 PM',status:'available'},
      {time:'02:00 PM',status:'available'},{time:'06:00 PM',status:'available'},
      {time:'08:00 PM',status:'booked'},
    ],
  },
  {
    id:4, name:'Patan Sports Hub',   location:'Patan, Lalitpur',      rating:4.3, price:'Rs. 900/hr',   emoji:'🏆', type:'Outdoor',
    slots:[
      {time:'07:00 AM',status:'available'},{time:'09:00 AM',status:'available'},
      {time:'11:00 AM',status:'available'},{time:'01:00 PM',status:'booked'},
      {time:'03:00 PM',status:'available'},{time:'05:00 PM',status:'booked'},
    ],
  },
]

/* ─── BOOKINGS ───────────────────────────────────────────────────────────── */
export const bookings = [
  {id:1, team:'Thunder Strikers', venue:'Arena Futsal Park', date:'2025-03-15', time:'08:00 AM', status:'confirmed', players:10, amount:'Rs. 1,200'},
  {id:2, team:'Green Eagles',     venue:'Champions Court',   date:'2025-03-16', time:'07:00 AM', status:'pending',   players:8,  amount:'Rs. 1,000'},
  {id:3, team:'Red Wolves',       venue:'Goal Zone Futsal',  date:'2025-03-14', time:'06:00 AM', status:'confirmed', players:10, amount:'Rs. 1,400'},
  {id:4, team:'Blue Phoenix',     venue:'Arena Futsal Park', date:'2025-03-17', time:'04:00 PM', status:'cancelled', players:7,  amount:'Rs. 1,200'},
  {id:5, team:'Night Owls',       venue:'Patan Sports Hub',  date:'2025-03-18', time:'09:00 AM', status:'confirmed', players:9,  amount:'Rs. 900'},
  {id:6, team:'Storm United',     venue:'Champions Court',   date:'2025-03-19', time:'03:00 PM', status:'pending',   players:10, amount:'Rs. 1,000'},
]

/* ─── CHALLENGES ─────────────────────────────────────────────────────────── */
export const challenges = [
  {id:1, from:'Thunder Strikers', to:'My Team',        date:'2025-03-16', time:'06:00 PM', venue:'Arena Futsal Park', status:'pending'},
  {id:2, from:'My Team',         to:'Red Wolves',      date:'2025-03-20', time:'08:00 AM', venue:'Champions Court',   status:'accepted'},
  {id:3, from:'Green Eagles',    to:'My Team',         date:'2025-03-22', time:'10:00 AM', venue:'Goal Zone Futsal',  status:'declined'},
  {id:4, from:'My Team',         to:'Storm United',    date:'2025-03-25', time:'06:00 PM', venue:'Patan Sports Hub',  status:'pending'},
]

/* ─── USERS ──────────────────────────────────────────────────────────────── */
export const users = [
  {id:1, name:'Arjun Sharma',     email:'arjun@example.com',  role:'Team User',    status:'active',   joined:'2024-01-15', team:'Thunder Strikers'},
  {id:2, name:'Priya Thapa',      email:'priya@example.com',  role:'Team User',    status:'active',   joined:'2024-02-10', team:'Green Eagles'},
  {id:3, name:'Bikash Rai',       email:'bikash@example.com', role:'Futsal Owner', status:'active',   joined:'2024-01-05', team:'—'},
  {id:4, name:'Sita Karki',       email:'sita@example.com',   role:'Team User',    status:'inactive', joined:'2024-03-01', team:'Blue Phoenix'},
  {id:5, name:'Raj Gurung',       email:'raj@example.com',    role:'Futsal Owner', status:'active',   joined:'2023-12-20', team:'—'},
  {id:6, name:'Nisha Magar',      email:'nisha@example.com',  role:'Team User',    status:'active',   joined:'2024-02-28', team:'Night Owls'},
  {id:7, name:'Dipesh Shrestha',  email:'dipesh@example.com', role:'Admin',        status:'active',   joined:'2023-11-10', team:'—'},
]

/* ─── FUTSAL PARTNERS ────────────────────────────────────────────────────── */
export const futsalPartners = [
  {id:1, name:'Arena Futsal Park',  owner:'Bikash Rai',          location:'Baneshwor', courts:2, status:'approved', joined:'2024-01-05', bookings:48},
  {id:2, name:'Champions Court',    owner:'Raj Gurung',          location:'Lazimpat',  courts:1, status:'approved', joined:'2023-12-20', bookings:35},
  {id:3, name:'Goal Zone Futsal',   owner:'Raman Koirala',       location:'Thamel',    courts:3, status:'pending',  joined:'2024-03-10', bookings:0},
  {id:4, name:'Patan Sports Hub',   owner:'Sunita Bajracharya',  location:'Patan',     courts:2, status:'approved', joined:'2024-02-14', bookings:22},
]

/* ─── ACTIVITY LOGS ──────────────────────────────────────────────────────── */
export const activityLogs = [
  {id:1, event:'New booking',   detail:'Thunder Strikers booked Arena Futsal Park',  time:'5 min ago',  type:'green'},
  {id:2, event:'Challenge sent',detail:'Green Eagles challenged Red Wolves',          time:'12 min ago', type:'blue'},
  {id:3, event:'New user',      detail:'Nisha Magar registered as Team User',         time:'25 min ago', type:'green'},
  {id:4, event:'Venue review',  detail:'Goal Zone Futsal is pending approval',        time:'1 hr ago',   type:'orange'},
  {id:5, event:'Match ended',   detail:'Night Owls vs Blue Phoenix — 3:2',            time:'2 hrs ago',  type:'blue'},
  {id:6, event:'Cancellation',  detail:'Blue Phoenix cancelled their booking',        time:'3 hrs ago',  type:'red'},
  {id:7, event:'New partner',   detail:'Champions Court owner registered',            time:'5 hrs ago',  type:'green'},
]

/* ─── MATCH HISTORY ──────────────────────────────────────────────────────── */
export const matchHistory = [
  {id:1, opponent:'Thunder Strikers', score:'3-2', result:'win',  date:'Mar 10, 2025', venue:'Arena Futsal Park'},
  {id:2, opponent:'Night Owls',       score:'1-4', result:'loss', date:'Mar 5, 2025',  venue:'Champions Court'},
  {id:3, opponent:'Storm United',     score:'2-2', result:'draw', date:'Feb 28, 2025', venue:'Goal Zone Futsal'},
  {id:4, opponent:'Green Eagles',     score:'5-1', result:'win',  date:'Feb 22, 2025', venue:'Arena Futsal Park'},
  {id:5, opponent:'Blue Phoenix',     score:'3-0', result:'win',  date:'Feb 15, 2025', venue:'Patan Sports Hub'},
]

/* ─── SCHEDULE DATA ──────────────────────────────────────────────────────── */
export const scheduleData = [
  { day:'Monday, Mar 17', slots:[
    {time:'06:00 AM',status:'booked',   team:'Thunder Strikers'},
    {time:'08:00 AM',status:'available'},
    {time:'10:00 AM',status:'available'},
    {time:'12:00 PM',status:'blocked'},
    {time:'02:00 PM',status:'booked',   team:'Green Eagles'},
    {time:'04:00 PM',status:'available'},
    {time:'06:00 PM',status:'booked',   team:'Red Wolves'},
    {time:'08:00 PM',status:'available'},
  ]},
  { day:'Tuesday, Mar 18', slots:[
    {time:'06:00 AM',status:'available'},
    {time:'08:00 AM',status:'booked',   team:'Night Owls'},
    {time:'10:00 AM',status:'available'},
    {time:'12:00 PM',status:'available'},
    {time:'02:00 PM',status:'blocked'},
    {time:'04:00 PM',status:'booked',   team:'Blue Phoenix'},
    {time:'06:00 PM',status:'available'},
    {time:'08:00 PM',status:'available'},
  ]},
  { day:'Wednesday, Mar 19', slots:[
    {time:'06:00 AM',status:'booked',   team:'Storm United'},
    {time:'08:00 AM',status:'available'},
    {time:'10:00 AM',status:'booked',   team:'Thunder Strikers'},
    {time:'12:00 PM',status:'available'},
    {time:'02:00 PM',status:'available'},
    {time:'04:00 PM',status:'available'},
    {time:'06:00 PM',status:'blocked'},
    {time:'08:00 PM',status:'booked',   team:'Green Eagles'},
  ]},
]
