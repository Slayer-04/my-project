import io from 'socket.io-client'
import { getSocketUrl } from './apiConfig.js'

// Single socket instance for entire app
let socket = null

/**
 * Initialize WebSocket connection
 * Call this once when app starts (in App.jsx)
 */
export const initSocket = () => {
  if (socket) {
    console.log('[Socket] Already connected, skipping re-initialization')
    return socket
  }

  const SOCKET_URL = getSocketUrl()

  try {
    socket = io(SOCKET_URL, {
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
    })

    // Connection events
    socket.on('connect', () => {
      console.log('✅ [Socket] Connected to WebSocket server')
    })

    socket.on('disconnect', () => {
      console.log('❌ [Socket] Disconnected from WebSocket server')
    })

    socket.on('connect_error', (error) => {
      console.error('⚠️ [Socket] Connection error:', error)
    })

    socket.on('error', (error) => {
      console.error('⚠️ [Socket] Error:', error)
    })

    return socket
  } catch (error) {
    console.error('❌ [Socket] Failed to initialize:', error)
    return null
  }
}

/**
 * Get current socket instance
 */
export const getSocket = () => {
  if (!socket) {
    console.warn('[Socket] Socket not initialized, call initSocket() first')
    return null
  }
  return socket
}

/**
 * Disconnect socket
 */
export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect()
    socket = null
    console.log('[Socket] Disconnected')
  }
}

/**
 * Emit user join event
 */
export const emitUserJoin = (userData) => {
  if (!socket) {
    console.warn('[Socket] Socket not connected, skipping user:join emit')
    return
  }

  socket.emit('user:join', {
    userId: userData.id,
    email: userData.email,
    role: userData.role,
  })

  console.log(`[Socket] Emitted user:join - ${userData.email} (${userData.role})`)
}

/**
 * Emit new booking event
 */
export const emitBookingCreate = (bookingData) => {
  if (!socket) {
    console.warn('[Socket] Socket not connected, skipping booking:create emit')
    return
  }

  socket.emit('booking:create', {
    ...bookingData,
    email: bookingData.email,
  })

  console.log('[Socket] Emitted booking:create', bookingData)
}

/**
 * Emit booking update event (status change)
 */
export const emitBookingUpdate = (bookingData) => {
  if (!socket) {
    console.warn('[Socket] Socket not connected, skipping booking:update emit')
    return
  }

  socket.emit('booking:update', {
    ...bookingData,
    email: bookingData.email,
  })

  console.log('[Socket] Emitted booking:update', bookingData)
}

/**
 * Emit booking cancel event
 */
export const emitBookingCancel = (bookingData) => {
  if (!socket) {
    console.warn('[Socket] Socket not connected, skipping booking:cancel emit')
    return
  }

  socket.emit('booking:cancel', {
    ...bookingData,
    email: bookingData.email,
  })

  console.log('[Socket] Emitted booking:cancel', bookingData)
}

/**
 * Emit challenge create event
 */
export const emitChallengeCreate = (challengeData) => {
  if (!socket) {
    console.warn('[Socket] Socket not connected, skipping challenge:create emit')
    return
  }

  socket.emit('challenge:create', challengeData)
  console.log('[Socket] Emitted challenge:create', challengeData)
}

/**
 * Emit challenge response event (accept/decline)
 */
export const emitChallengeRespond = (responseData) => {
  if (!socket) {
    console.warn('[Socket] Socket not connected, skipping challenge:respond emit')
    return
  }

  socket.emit('challenge:respond', {
    ...responseData,
    respondedBy: responseData.respondedBy,
  })

  console.log('[Socket] Emitted challenge:respond', responseData)
}

/**
 * Listen for booking created event
 * Returns unsubscribe function to remove listener
 */
export const onBookingCreated = (callback) => {
  if (!socket) {
    console.warn('[Socket] Socket not connected, skipping onBookingCreated listener')
    return () => {}
  }

  const handler = (data) => {
    console.log('[Socket] Received booking:created', data)
    callback(data)
  }

  socket.on('booking:created', handler)

  return () => {
    socket.off('booking:created', handler)
  }
}

/**
 * Listen for booking updated event
 * Returns unsubscribe function to remove listener
 */
export const onBookingUpdated = (callback) => {
  if (!socket) {
    console.warn('[Socket] Socket not connected, skipping onBookingUpdated listener')
    return () => {}
  }

  const handler = (data) => {
    console.log('[Socket] Received booking:updated', data)
    callback(data)
  }

  socket.on('booking:updated', handler)

  return () => {
    socket.off('booking:updated', handler)
  }
}

/**
 * Listen for booking cancelled event
 * Returns unsubscribe function to remove listener
 */
export const onBookingCancelled = (callback) => {
  if (!socket) {
    console.warn('[Socket] Socket not connected, skipping onBookingCancelled listener')
    return () => {}
  }

  const handler = (data) => {
    console.log('[Socket] Received booking:cancelled', data)
    callback(data)
  }

  socket.on('booking:cancelled', handler)

  return () => {
    socket.off('booking:cancelled', handler)
  }
}

/**
 * Listen for challenge created event
 * Returns unsubscribe function to remove listener
 */
export const onChallengeCreated = (callback) => {
  if (!socket) {
    console.warn('[Socket] Socket not connected, skipping onChallengeCreated listener')
    return () => {}
  }

  const handler = (data) => {
    console.log('[Socket] Received challenge:created', data)
    callback(data)
  }

  socket.on('challenge:created', handler)

  // Return unsubscribe function
  return () => {
    socket.off('challenge:created', handler)
  }
}

/**
 * Listen for challenge responded event
 * Returns unsubscribe function to remove listener
 */
export const onChallengeResponded = (callback) => {
  if (!socket) {
    console.warn('[Socket] Socket not connected, skipping onChallengeResponded listener')
    return () => {}
  }

  const handler = (data) => {
    console.log('[Socket] Received challenge:responded', data)
    callback(data)
  }

  socket.on('challenge:responded', handler)

  return () => {
    socket.off('challenge:responded', handler)
  }
}

/**
 * Listen for user joined event
 * Returns unsubscribe function to remove listener
 */
export const onUserJoined = (callback) => {
  if (!socket) {
    console.warn('[Socket] Socket not connected, skipping onUserJoined listener')
    return () => {}
  }

  const handler = (data) => {
    console.log('[Socket] Received user:joined', data)
    callback(data)
  }

  socket.on('user:joined', handler)

  return () => {
    socket.off('user:joined', handler)
  }
}

/**
 * Remove all listeners for a specific event
 */
export const removeListener = (eventName) => {
  if (socket) {
    socket.off(eventName)
    console.log(`[Socket] Removed listeners for: ${eventName}`)
  }
}

/**
 * Remove all listeners
 */
export const removeAllListeners = () => {
  if (socket) {
    socket.removeAllListeners()
    console.log('[Socket] Removed all listeners')
  }
}
