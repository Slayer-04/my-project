import React, { useState } from 'react'
import { useAuth } from '../App.jsx'

const NOTIFS = [
  { text:'Thunder Strikers challenged your team!', time:'5 min ago',  unread:true },
  { text:'Booking at Arena Futsal confirmed',       time:'1 hr ago',   unread:true },
  { text:'Match reminder: Tomorrow 8:00 AM',        time:'2 hrs ago',  unread:false },
]

export default function Topbar({ title, breadcrumb }) {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)

  return (
    <header className="topbar">
      <div>
        <div className="tb-title">{title}</div>
        {breadcrumb && <div className="tb-crumb">{breadcrumb}</div>}
      </div>

      <div className="tb-right">
        {/* Notifications */}
        <div style={{ position:'relative' }}>
          <button className="icon-btn" onClick={() => setOpen(o => !o)}>
            <i className="fas fa-bell" />
            <span className="notif-dot" />
          </button>

          {open && (
            <div className="notif-drop">
              <div className="notif-head">
                Notifications
                <span className="notif-new-badge">2 new</span>
              </div>
              {NOTIFS.map((n, i) => (
                <div key={i} className={`notif-item ${n.unread ? 'unread' : ''}`}>
                  <div className="notif-text">{n.text}</div>
                  <div className="notif-time">{n.time}</div>
                </div>
              ))}
              <div className="notif-footer">View all notifications</div>
            </div>
          )}
        </div>

        {/* User chip */}
        <div className="tb-user">
          <div className="tb-user-av">{user?.name?.[0]?.toUpperCase()}</div>
          <span className="tb-user-name">{user?.name}</span>
        </div>
      </div>
    </header>
  )
}
