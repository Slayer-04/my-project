import React, { useState } from 'react'
import { useAuth } from '../App.jsx'
import { selectOptimalMatchLocation } from '../utils/venueSelector.js'

export default function Topbar({ title, breadcrumb }) {
  const { user, notifications, setNotifications, challenges, setChallenges, bookings, setBookings } = useAuth()
  const [open, setOpen] = useState(false)
  const myTeamName = user?.teamInfo?.name || user?.teamInfo?.teamName || user?.teamName || ''
  const visibleNotifications = notifications.filter(n => !n.team || n.team === myTeamName).slice(0, 8)
  const unreadCount = visibleNotifications.filter(n => n.unread).length

  const challengeById = id => challenges.find(challenge => challenge.id === id) || null

  const updateNotificationStatus = (notificationId, text) => {
    setNotifications(prev => prev.map(notification => (
      notification.id === notificationId
        ? { ...notification, unread: false, text }
        : notification
    )))
  }

  const acceptChallengeFromNotif = (notification) => {
    const challenge = challengeById(notification.challengeId)
    if (!challenge || challenge.to !== myTeamName || challenge.status !== 'pending') {
      updateNotificationStatus(notification.id, notification.text)
      return
    }

    const useExactSchedule = Boolean(challenge.exactSchedule)
    const location = useExactSchedule
      ? { venue: challenge.venue, time: challenge.time }
      : selectOptimalMatchLocation(
          challenge.from,
          myTeamName,
          challenge.date || new Date().toISOString().split('T')[0],
          challenge.time,
          bookings
        )

    // Update challenge status with selected venue and time
    const bookingDate = challenge.date || new Date().toISOString().split('T')[0]
    setChallenges(prev => prev.map(item => (
      item.id === challenge.id 
        ? { ...item, status: 'accepted', venue: location.venue, time: location.time } 
        : item
    )))

    // Add bookings for BOTH teams so they both see it in upcoming bookings
    const baseBookingId = Date.now()
    setBookings(prev => [
      ...prev,
      {
        id: baseBookingId,
        team: myTeamName,
        venue: location.venue,
        date: bookingDate,
        time: location.time,
        status: 'confirmed',
        players: 11,
        amount: 'Rs. 1,200',
        challengeId: challenge.id,
        opponent: challenge.from,
      },
      {
        id: baseBookingId + 1,
        team: challenge.from,
        venue: location.venue,
        date: bookingDate,
        time: location.time,
        status: 'confirmed',
        players: 11,
        amount: 'Rs. 1,200',
        challengeId: challenge.id,
        opponent: myTeamName,
      }
    ])

    updateNotificationStatus(
      notification.id,
      useExactSchedule
        ? `✅ Challenge accepted with exact schedule: ${location.venue} at ${location.time}`
        : `✅ Challenge accepted! Match at ${location.venue} at ${location.time}`
    )
  }

  const declineChallengeFromNotif = (notification) => {
    const challenge = challengeById(notification.challengeId)
    if (!challenge || challenge.to !== myTeamName || challenge.status !== 'pending') {
      updateNotificationStatus(notification.id, notification.text)
      return
    }

    setChallenges(prev => prev.map(item => (
      item.id === challenge.id ? { ...item, status: 'declined' } : item
    )))
    updateNotificationStatus(notification.id, `${challenge.from} challenge declined.`)
  }

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
            {unreadCount > 0 && <span className="notif-dot" />}
          </button>

          {open && (
            <div className="notif-drop">
              <div className="notif-head">
                Notifications
                <span className="notif-new-badge">{unreadCount} new</span>
              </div>
              {visibleNotifications.length === 0 && (
                <div className="notif-item">
                  <div className="notif-text">No notifications yet.</div>
                  <div className="notif-time">You are all caught up</div>
                </div>
              )}
              {visibleNotifications.map((n, i) => (
                <div key={i} className={`notif-item ${n.unread ? 'unread' : ''}`}>
                  <div className="notif-text">{n.text}</div>
                  <div className="notif-time">{n.time}</div>
                  {n.type === 'challenge-request' && (() => {
                    const challenge = challengeById(n.challengeId)
                    const actionable = challenge && challenge.status === 'pending' && challenge.to === myTeamName
                    if (!actionable) return null

                    return (
                      <div style={{ display:'flex', gap:8, marginTop:8 }}>
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => acceptChallengeFromNotif(n)}
                        >
                          Accept
                        </button>
                        <button
                          className="btn btn-outline btn-sm"
                          onClick={() => declineChallengeFromNotif(n)}
                        >
                          Decline
                        </button>
                      </div>
                    )
                  })()}
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
