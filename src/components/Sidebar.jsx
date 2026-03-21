import React from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../App.jsx'

const NAV = {
  team: [
    { label:'Home',        icon:'fa-house',          path:'/team' },
    { label:'Find Match',  icon:'fa-bolt',           path:'/team/find-match' },
    { label:'Challenges',  icon:'fa-flag',           path:'/team/challenges' },
    { label:'Book Futsal', icon:'fa-calendar-check', path:'/team/book-futsal' },
    { label:'Profile',     icon:'fa-user',           path:'/team/profile' },
  ],
  owner: [
    { label:'Home',     icon:'fa-house',         path:'/owner' },
    { label:'Schedule', icon:'fa-calendar',      path:'/owner/schedule' },
    { label:'Bookings', icon:'fa-clipboard-list',path:'/owner/bookings' },
    { label:'Profile',  icon:'fa-user',          path:'/owner/profile' },
  ],
  admin: [
    { label:'Home',          icon:'fa-house',    path:'/admin' },
    { label:'Users',         icon:'fa-users',    path:'/admin/users' },
    { label:'Futsals',       icon:'fa-building', path:'/admin/futsals' },
    { label:'Reports',       icon:'fa-chart-bar',path:'/admin/reports' },
    { label:'System Status', icon:'fa-server',   path:'/admin/system' },
  ],
}

const ROLE_LABELS = { team:'Team User', owner:'Futsal Owner', admin:'Administrator' }

export default function Sidebar() {
  const { user, setUser } = useAuth()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  if (!user) return null

  const items = NAV[user.role] || []

  return (
    <aside className="sidebar">
      <div className="sb-logo">
        <div className="sb-logo-text">Fot<em>Match</em> ⚽</div>
      </div>
      <div style={{ padding:'10px 20px 0' }}>
        <span className="sb-role-chip">{ROLE_LABELS[user.role]}</span>
      </div>

      <nav className="sb-nav">
        <div className="sb-section">Menu</div>
        {items.map(item => (
          <div
            key={item.path}
            className={`sb-link ${pathname === item.path ? 'active' : ''}`}
            onClick={() => navigate(item.path)}
          >
            <i className={`fas ${item.icon}`} />
            {item.label}
          </div>
        ))}
      </nav>

      <div className="sb-footer">
        <div className="sb-user">
          <div className="sb-avatar">{user.name?.[0]?.toUpperCase()}</div>
          <div>
            <div className="sb-name">{user.name}</div>
            <div className="sb-email">{user.email}</div>
          </div>
        </div>
        <button
          className="logout-btn"
          onClick={() => { setUser(null); navigate('/login') }}
        >
          <i className="fas fa-right-from-bracket" />
          Sign Out
        </button>
      </div>
    </aside>
  )
}
