import React, { useEffect, useState } from 'react'
import { useAuth } from '../App.jsx'
import { selectOptimalMatchLocation } from '../utils/venueSelector.js'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

export default function Topbar({ title, breadcrumb }) {
  const { user, notifications, setNotifications, challenges, setChallenges, bookings, setBookings } = useAuth()
  const [open, setOpen] = useState(false)
  const myTeamName = user?.teamInfo?.name || user?.teamInfo?.teamName || user?.teamName || ''
  const visibleNotifications = notifications.filter(n => !n.team || n.team === myTeamName).slice(0, 8)
  const unreadCount = visibleNotifications.filter(n => n.unread).length

  useEffect(() => {
    if (user?.role !== 'team' || !myTeamName) return

    let active = true

    const loadNotifications = async () => {
      try {
        const response = await fetch(`${API_BASE}/notifications/team/${encodeURIComponent(myTeamName)}`)
        const data = await response.json()
        if (!active || !response.ok || !Array.isArray(data)) return

        const mapped = data.map(notification => ({
          ...notification,
          id: notification._id || notification.id,
          time: notification.time || 'just now',
          unread: notification.unread !== false,
          joinRequestStatus: notification.joinRequestStatus || (notification.type === 'join-request' ? 'pending' : ''),
        }))

        setNotifications(prev => {
          const otherNotifications = prev.filter(notification => notification.team && notification.team !== myTeamName)
          const localOnlyForTeam = prev.filter(
            notification => (!notification.team || notification.team === myTeamName) && !notification._id && !notification.id
          )
          return [...otherNotifications, ...mapped, ...localOnlyForTeam]
        })
      } catch (_error) {
        // Keep existing in-memory notifications if the backend is unavailable.
      }
    }

    loadNotifications()
    return () => { active = false }
  }, [myTeamName, setNotifications, user?.role])

  const challengeById = id => challenges.find(challenge => challenge.id === id) || null

  const updateNotificationStatus = (notificationId, text) => {
    setNotifications(prev => prev.map(notification => (
      notification.id === notificationId
        ? { ...notification, unread: false, text }
        : notification
    )))
  }

  const handleJoinRequestAction = async (notification, action) => {
    if (!notification?.joinRequestId) {
      updateNotificationStatus(notification.id, notification.text)
      return
    }

    try {
      const response = await fetch(`${API_BASE}/team-joins/${notification.joinRequestId}/${action}`, {
        method: 'PATCH',
      })
      const data = await response.json()

      if (!response.ok) {
        updateNotificationStatus(notification.id, data.message || notification.text)
        return
      }

      const nextStatus = action === 'approve' ? 'approved' : 'declined'
      const nextText = action === 'approve'
        ? `${notification.requesterName || 'Requester'} join request approved.`
        : `${notification.requesterName || 'Requester'} join request declined.`

      setNotifications(prev => prev.map(item => (
        item.id === notification.id
          ? { ...item, unread: false, text: nextText, joinRequestStatus: nextStatus, time: 'just now' }
          : item
      )))

      if (notification._id || notification.id) {
        const notificationId = notification._id || notification.id
        await fetch(`${API_BASE}/notifications/${notificationId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ unread: false, text: nextText, joinRequestStatus: nextStatus, time: 'just now' }),
        })
      }
    } catch (_error) {
      updateNotificationStatus(notification.id, 'Unable to update join request right now.')
    }
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
                  {n.type === 'join-request' && (n.joinRequestStatus || 'pending') === 'pending' && (
                    <div style={{ display:'flex', gap:8, marginTop:8 }}>
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => handleJoinRequestAction(n, 'approve')}
                      >
                        Accept
                      </button>
                      <button
                        className="btn btn-outline btn-sm"
                        onClick={() => handleJoinRequestAction(n, 'decline')}
                      >
                        Decline
                      </button>
                    </div>
                  )}
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
