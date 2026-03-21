<<<<<<< HEAD
# ⚽ FotMatch — Futsal Team Finder & Booking Platform

A complete frontend React application for finding futsal teams, sending challenges, booking courts, and managing venues — with three user roles and a full dashboard for each.

---

## 🚀 Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Start development server
npm run dev

# 3. Open in browser
# http://localhost:5173
```

---

## 🔐 Demo Logins

Use the **Quick Demo** buttons on the login screen, or enter any email/password:

| Role | Email | Description |
|------|-------|-------------|
| ⚽ Team User | team@fotmatch.com | Player / Team Manager |
| 🏟️ Futsal Owner | owner@fotmatch.com | Venue Manager |
| 🛡️ Admin | admin@fotmatch.com | Platform Administrator |

---

## 📁 Project Structure

```
fotmatch/
├── index.html
├── vite.config.js
├── package.json
└── src/
    ├── main.jsx               # Entry point
    ├── App.jsx                # Router + Auth Context
    ├── styles/
    │   └── global.css         # Complete design system (CSS variables, components)
    ├── data/
    │   └── mockData.js        # All mock data arrays
    ├── components/
    │   ├── Sidebar.jsx        # Role-aware navigation sidebar
    │   └── Topbar.jsx         # Top bar with notifications
    └── pages/
        ├── auth/
        │   ├── Login.jsx      # Login with role selector + demo buttons
        │   └── Register.jsx   # Registration form
        ├── team/
        │   ├── TeamDashboard.jsx   # Stats, bookings, challenges overview
        │   ├── FindMatch.jsx       # Browse & instantly match with teams
        │   ├── Challenges.jsx      # Send / accept / decline challenges
        │   ├── BookFutsal.jsx      # Browse venues & book slots
        │   └── TeamProfile.jsx     # Team info, edit, match history
        ├── owner/
        │   ├── OwnerDashboard.jsx  # Revenue, today's schedule, bookings
        │   ├── Schedule.jsx        # Weekly slot management (toggle available/blocked)
        │   ├── Bookings.jsx        # Manage team bookings, confirm/cancel
        │   └── OwnerProfile.jsx    # Venue info, edit, performance stats
        └── admin/
            ├── AdminDashboard.jsx  # Platform overview, activity feed
            ├── Users.jsx           # User table, activate/deactivate, modal
            ├── Futsals.jsx         # Partner cards, approve, add partner
            ├── Reports.jsx         # Charts, tabbed logs (activity/bookings/users)
            └── SystemStatus.jsx    # Live service health, resource bars, incidents
```

---

## 🎨 Design System

- **Fonts:** Barlow Condensed (headings/display) + Nunito (body)
- **Colors:** Green `#00b96b` primary, Blue `#1a6fe8` secondary, Orange `#ff5e1f` accent
- **Theme:** Dark sidebar (`#0d1117`) + white card surfaces + light grey background
- **Animations:** Staggered `fadeUp` page entry animations
- **Responsive:** Mobile-friendly, sidebar collapses on small screens

---

## 🛠️ Tech Stack

| Tool | Version |
|------|---------|
| React | 18 |
| React Router | 6 |
| Vite | 5 |
| Font Awesome | 6.5 (CDN) |
| Google Fonts | Barlow Condensed + Nunito |

**No Tailwind. No backend. No database.** Pure React + plain CSS.

---

## ✨ Features by Role

### Team User
- Dashboard with match stats, upcoming bookings, challenge feed
- Find Match — browse & filter teams, instant match request
- Challenges — send/accept/decline with modal form
- Book Futsal — venue cards with live slot selection
- Profile — editable team info + full match history

### Futsal Owner
- Dashboard with revenue bar chart and today's schedule
- Schedule Management — toggle slot states (available/blocked), add new slots
- Bookings — full table with confirm/cancel and detail modal
- Profile — editable venue info + performance metrics

### Admin
- System overview with platform KPIs and quick-nav cards
- User Management — table with role badges, activate/deactivate, user detail modal
- Futsal Partners — venue cards with approval workflow + add partner form
- Reports — bar charts + tabbed log viewer (activity/bookings/users)
- System Status — live latency simulation, health bars, incident history
=======
# my-project
fotmatch
>>>>>>> 75626d80e8c65a9be7fcdfab16c460ee07ccf0d1
