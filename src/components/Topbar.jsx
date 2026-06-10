import React, { useEffect, useState } from 'react'
import { useAuth } from '../App.jsx'
import { getApiBaseUrl } from '../utils/apiConfig.js'
import { onChallengeCreated } from '../utils/socketService.js'

const API_BASE = getApiBaseUrl()

export default function Topbar({ title, breadcrumb }) {
  const { user, notifications, setNotifications, challenges, setChallenges, bookings, setBookings } = useAuth()
  const [open, setOpen] = useState(false)
  const [showAllNotifications, setShowAllNotifications] = useState(false)
  const myTeamName = user?.teamInfo?.name || user?.teamInfo?.teamName || user?.teamInfo?.captainName || user?.name || user?.teamName || ''
  const ONE_DAY_MS = 24 * 60 * 60 * 1000

  const isUnreadNotification = (notification) => notification?.unread !== false && notification?.status !== 'read'

  const isRecentNotification = (notification) => {
    const createdAt = new Date(notification?.createdAt || 0).getTime()
    return Number.isFinite(createdAt) && createdAt >= Date.now() - ONE_DAY_MS
  }

  const resolveId = (value) => {
    if (!value) return ''
    if (typeof value === 'string' || typeof value === 'number') return String(value)
    if (typeof value === 'object') return String(value._id || value.id || '')
    return ''
  }

  const challengeById = (id) => challenges.find(challenge => resolveId(challenge.id) === resolveId(id)) || null

  const notificationKey = (notification) => {
    if (notification?.type === 'challenge-request') {
      return `challenge:${resolveId(notification.challengeId)}`
    }
    if (notification?.type === 'join-request') {
      return `join:${resolveId(notification.joinRequestId) || resolveId(notification.id)}:${notification.joinRequestStatus || 'pending'}`
    }
    return `notification:${resolveId(notification?.id)}`
  }

  const dedupeNotifications = (items) => {
    const seen = new Set()
    return items.filter(notification => {
      const key = notificationKey(notification)
      if (!key || seen.has(key)) return false
      seen.add(key)
      return true
    })
  }

  const visibleNotifications = dedupeNotifications(notifications)
    .filter(isRecentNotification)
    .map(notification => ({
      ...notification,
      unread: isUnreadNotification(notification),
    }))
    .sort((left, right) => new Date(right.createdAt || 0).getTime() - new Date(left.createdAt || 0).getTime())
    .filter(n => {
      if (n.team && n.team !== myTeamName) return false
      if (n.type !== 'challenge-request') return true
      const challenge = challengeById(resolveId(n.challengeId))
      return !challenge || challenge.status === 'pending'
    })

  const shownNotifications = showAllNotifications ? visibleNotifications : visibleNotifications.slice(0, 8)
  const unreadCount = visibleNotifications.filter(n => n.unread).length

  useEffect(() => {
    if (user?.role !== 'team' || !myTeamName) return

    let active = true

    const loadTeamData = async () => {
      try {
        const [notificationsResponse, challengesResponse] = await Promise.all([
          fetch(`${API_BASE}/notifications/team/${encodeURIComponent(myTeamName)}`),
          fetch(`${API_BASE}/challenges/team/${encodeURIComponent(myTeamName)}`),
        ])

        const notificationsData = await notificationsResponse.json()
        const challengesData = await challengesResponse.json()
        const mappedNotifications = Array.isArray(notificationsData)
          ? notificationsData.map(notification => ({
              ...notification,
              id: notification._id || notification.id,
              time: notification.time || 'just now',
              unread: isUnreadNotification(notification),
              joinRequestStatus: notification.joinRequestStatus || (notification.type === 'join-request' ? 'pending' : ''),
            }))
          : []

        if (!active) return

        const challengeStatusById = new Map(
          Array.isArray(challengesData)
            ? challengesData.map(challenge => [resolveId(challenge._id || challenge.id), challenge.status])
            : []
        )

        const filteredMappedNotifications = mappedNotifications.filter(notification => {
          if (notification.type !== 'challenge-request') return true
          const challengeStatus = challengeStatusById.get(resolveId(notification.challengeId))
          return !challengeStatus || challengeStatus === 'pending'
        })

        if (notificationsResponse.ok && Array.isArray(notificationsData)) {
          setNotifications(prev => {
            const otherNotifications = prev.filter(notification => notification.team && notification.team !== myTeamName)
            const localOnlyForTeam = prev.filter(
              notification => (!notification.team || notification.team === myTeamName) && !notification._id && !notification.id
            )
            return dedupeNotifications([...otherNotifications, ...filteredMappedNotifications, ...localOnlyForTeam])
          })
        }

        if (challengesResponse.ok && Array.isArray(challengesData)) {
          const challengeNotifications = challengesData
            .filter(challenge => challenge && challenge.to === myTeamName && challenge.status === 'pending')
            .map(challenge => ({
              id: `challenge-${challenge._id || challenge.id}`,
              team: myTeamName,
              type: 'challenge-request',
              challengeId: challenge._id || challenge.id,
              text: `${challenge.from} sent you a match request for ${challenge.venue} on ${challenge.date} at ${challenge.time}.`,
              time: 'just now',
              unread: true,
              createdAt: challenge.createdAt || new Date().toISOString(),
              joinRequestStatus: '',
            }))

          setChallenges(prev => {
            const otherTeamChallenges = prev.filter(challenge => challenge.to !== myTeamName && challenge.from !== myTeamName)
            const mappedChallenges = challengesData.map(challenge => ({
              ...challenge,
              id: challenge._id || challenge.id,
            }))
            return [...otherTeamChallenges, ...mappedChallenges]
          })

          setNotifications(prev => {
            const withoutCurrentTeam = prev.filter(notification => notification.team && notification.team !== myTeamName)
            const localOnlyForTeam = prev.filter(
              notification => (!notification.team || notification.team === myTeamName) && !notification._id && !notification.id
            )
            const existingChallengeIds = new Set(
              [...withoutCurrentTeam, ...localOnlyForTeam, ...filteredMappedNotifications].map(notification => resolveId(notification.challengeId))
            )
            const mergedChallengeNotifications = challengeNotifications.filter(notification => {
              const challengeId = resolveId(notification.challengeId)
              return challengeId && !existingChallengeIds.has(challengeId)
            })
            return dedupeNotifications([...withoutCurrentTeam, ...filteredMappedNotifications, ...localOnlyForTeam, ...mergedChallengeNotifications])
          })
        }
      } catch (_error) {
        // Keep existing in-memory notifications if the backend is unavailable.
      }
    }

    loadTeamData()
    const intervalId = setInterval(loadTeamData, 4000)

    return () => {
      active = false
      clearInterval(intervalId)
    }
  }, [myTeamName, setChallenges, setNotifications, user?.role])

  useEffect(() => {
    if (user?.role !== 'team' || !myTeamName) return

    const unsubscribe = onChallengeCreated((challengeData) => {
      if (!challengeData || challengeData.to !== myTeamName) return

      setNotifications(prev => {
        const alreadyExists = prev.some(notification => (
          resolveId(notification.challengeId) === resolveId(challengeData.id)
          || notification.text === `${challengeData.from} sent you a match request.`
        ))
        if (alreadyExists) return prev
        return dedupeNotifications([{
          id: Date.now(),
          team: myTeamName,
          type: 'challenge-request',
          challengeId: challengeData.id,
          text: `${challengeData.from} sent you a match request for ${challengeData.venue} on ${challengeData.date} at ${challengeData.time}.`,
          time: 'just now',
          unread: true,
          createdAt: new Date().toISOString(),
        }, ...prev])
      })
    })

    return () => {
      if (unsubscribe) unsubscribe()
    }
  }, [myTeamName, setNotifications, user?.role])

  const updateNotificationStatus = (notificationId, text) => {
    setNotifications(prev => prev.map(notification => (
      notification.id === notificationId
        ? { ...notification, unread: false, text }
        : notification
    )))
  }

  const removeNotification = (notification) => {
    const challengeId = resolveId(notification?.challengeId)
    const notificationId = resolveId(notification?.id)
    setNotifications(prev => prev.filter(item => {
      if (notification?.type === 'challenge-request') {
        return resolveId(item.challengeId) !== challengeId
      }
      return resolveId(item.id) !== notificationId
    }))
  }

  const patchChallengeStatus = async (challengeId, status) => {
    if (!challengeId) return
    const response = await fetch(`${API_BASE}/challenges/${challengeId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.message || 'Failed to update challenge.')
    }
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

  const acceptChallengeFromNotif = async (notification) => {
    const challenge = challengeById(resolveId(notification.challengeId))
    if (!challenge || challenge.to !== myTeamName || challenge.status !== 'pending') {
      removeNotification(notification)
      return
    }

    const fromTeam     = String(challenge.from  || '').trim()
    const toTeam       = myTeamName
    const bookingDate  = challenge.date  || new Date().toISOString().split('T')[0]
    const bookingTime  = challenge.time
    const bookingVenue = challenge.venue

    // ── FIX 1: guard against self-match ──────────────────────────────────────
    if (fromTeam.toLowerCase() === toTeam.toLowerCase()) {
      removeNotification(notification)
      return
    }

    setChallenges(prev => prev.map(item => (
      item.id === challenge.id
        ? { ...item, status: 'accepted', venue: bookingVenue, time: bookingTime }
        : item
    )))

    try {
      await patchChallengeStatus(resolveId(challenge.id), 'accepted')
    } catch (_error) {
      return
    }

    // Mark the notification as read in the backend DB
    if (notification._id || notification.id) {
      const notificationId = notification._id || notification.id
      try {
        await fetch(`${API_BASE}/notifications/${notificationId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ unread: false }),
        })
      } catch (_e) {
        // Ignore network errors
      }
    }

    // ── FIX 2: alreadyBooked check — prevents duplicate bookings when ─────────
    // user accepts from both notification bell AND Challenges page
    const alreadyBooked = bookings.some(b =>
      b.status !== 'cancelled'
      && b.date    === bookingDate
      && b.time    === bookingTime
      && b.venue   === bookingVenue
      && (
        (b.team === toTeam   && b.opponent === fromTeam)
        || (b.team === fromTeam && b.opponent === toTeam)
      )
    )

    if (!alreadyBooked) {
      const baseBookingId = Date.now()
      setBookings(prev => [
        {
          id: baseBookingId,
          team: toTeam,
          venue: bookingVenue,
          date: bookingDate,
          time: bookingTime,
          status: 'confirmed',
          players: 11,
          amount: 'Rs. 1,200',
          challengeId: challenge.id,
          opponent: fromTeam,
        },
        {
          id: baseBookingId + 1,
          team: fromTeam,
          venue: bookingVenue,
          date: bookingDate,
          time: bookingTime,
          status: 'confirmed',
          players: 11,
          amount: 'Rs. 1,200',
          challengeId: challenge.id,
          opponent: toTeam,
        },
        ...prev,
      ])
    }

    // ── FIX 3: notify the challenger so they see the accepted match ───────────
    setNotifications(prev => [{
      id: Date.now() + 2,
      text: `${toTeam} accepted your challenge! Match on ${bookingDate} at ${bookingTime} (${bookingVenue}).`,
      time: 'just now',
      unread: true,
      team: fromTeam,
      type: 'match-update',
      createdAt: new Date().toISOString(),
    }, ...prev])

    removeNotification(notification)
  }

  const declineChallengeFromNotif = async (notification) => {
    const challenge = challengeById(resolveId(notification.challengeId))
    if (!challenge || challenge.to !== myTeamName || challenge.status !== 'pending') {
      removeNotification(notification)
      return
    }
    setChallenges(prev => prev.map(item => (
      item.id === challenge.id ? { ...item, status: 'declined' } : item
    )))
    try {
      await patchChallengeStatus(resolveId(challenge.id), 'declined')
    } catch (_error) {
      return
    }

    // Mark the notification as read in the backend DB
    if (notification._id || notification.id) {
      const notificationId = notification._id || notification.id
      try {
        await fetch(`${API_BASE}/notifications/${notificationId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ unread: false }),
        })
      } catch (_e) {
        // Ignore network errors
      }
    }

    removeNotification(notification)
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
              {shownNotifications.map((n, i) => (
                <div key={i} className={`notif-item ${n.unread ? 'unread' : ''}`}>
                  <div className="notif-text">{n.text}</div>
                  <div className="notif-time">{n.time}</div>
                  {n.type === 'challenge-request' && (() => {
                    const challenge = challengeById(resolveId(n.challengeId))
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
              <button
                type="button"
                className="notif-footer"
                onClick={() => setShowAllNotifications(prev => !prev)}
              >
                {showAllNotifications ? 'Show fewer notifications' : `View all notifications${visibleNotifications.length > 8 ? ` (${visibleNotifications.length})` : ''}`}
              </button>
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