const express = require('express')
const cors = require('cors')
const mongoose = require('mongoose')
const dotenv = require('dotenv')
const { MongoMemoryServer } = require('mongodb-memory-server')
const http = require('http')
const { Server } = require('socket.io')
const teamRoutes = require('./routes/teamRoutes')
const teamJoinRoutes = require('./routes/teamJoinRoutes')
const gameRoutes = require('./routes/gameRoutes')
const dataRoutes = require('./routes/dataRoutes')
const authRoutes = require('./routes/authRoutes')
const { verifyTransport } = require('./utils/emailUtils')

dotenv.config()

const app = express()
const server = http.createServer(app)
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
})

const PORT = process.env.PORT || 5000
const MONGODB_URI = process.env.MONGODB_URI

app.use(cors())
app.use(express.json())

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'fotmatch-backend' })
})

app.use('/api/teams', teamRoutes)
app.use('/api/team-joins', teamJoinRoutes)
app.use('/api', gameRoutes)
app.use('/api', dataRoutes)
app.use('/api/auth', authRoutes)

app.use('/api', (_req, res) => {
  res.status(404).json({ message: 'API route not found.' })
})

// ============================================
// WebSocket Event Handlers
// ============================================

// Store connected users
const connectedUsers = new Map()

io.on('connection', (socket) => {
  console.log(`[WebSocket] User connected: ${socket.id}`)

  // When user joins, store their connection info
  socket.on('user:join', (userData) => {
    connectedUsers.set(socket.id, {
      userId: userData.userId,
      email: userData.email,
      role: userData.role,
      socketId: socket.id,
      joinedAt: new Date(),
    })

    console.log(`[WebSocket] User joined: ${userData.email} (${userData.role})`)
    
    // Notify all users that someone joined
    io.emit('user:joined', {
      email: userData.email,
      role: userData.role,
      totalUsers: connectedUsers.size,
    })
  })

  // Handle new booking
  socket.on('booking:create', (bookingData) => {
    console.log(`[WebSocket] New booking from ${bookingData.email}:`, bookingData)

    // Broadcast to ALL connected users
    io.emit('booking:created', {
      ...bookingData,
      createdBy: bookingData.email,
      timestamp: new Date(),
    })
  })

  // Handle booking status update
  socket.on('booking:update', (updateData) => {
    console.log(`[WebSocket] Booking updated by ${updateData.email}:`, updateData)

    // Broadcast to ALL connected users
    io.emit('booking:updated', {
      ...updateData,
      updatedBy: updateData.email,
      timestamp: new Date(),
    })
  })

  // Handle booking cancellation
  socket.on('booking:cancel', (cancelData) => {
    console.log(`[WebSocket] Booking cancelled by ${cancelData.email}:`, cancelData)

    // Broadcast to ALL connected users
    io.emit('booking:cancelled', {
      ...cancelData,
      cancelledBy: cancelData.email,
      timestamp: new Date(),
    })
  })

  // Handle challenge sent
  socket.on('challenge:create', (challengeData) => {
    console.log(`[WebSocket] New challenge from ${challengeData.from}:`, challengeData)

    // Broadcast to ALL connected users
    io.emit('challenge:created', {
      ...challengeData,
      timestamp: new Date(),
    })
  })

  // Handle challenge response (accept/decline)
  socket.on('challenge:respond', (responseData) => {
    console.log(`[WebSocket] Challenge response from ${responseData.respondedBy}:`, responseData)

    // Broadcast to ALL connected users
    io.emit('challenge:responded', {
      ...responseData,
      timestamp: new Date(),
    })
  })

  // Handle disconnection
  socket.on('disconnect', () => {
    const user = connectedUsers.get(socket.id)
    connectedUsers.delete(socket.id)

    console.log(`[WebSocket] User disconnected: ${socket.id}`)
    
    if (user) {
      io.emit('user:left', {
        email: user.email,
        totalUsers: connectedUsers.size,
      })
    }
  })

  // Handle errors
  socket.on('error', (error) => {
    console.error(`[WebSocket] Error from ${socket.id}:`, error)
  })
})

// ============================================
// MongoDB Connection & Server Start
// ============================================

const start = async () => {
  let mongoUri = MONGODB_URI
  let memoryServer = null

  if (!mongoUri) {
    console.warn('⚠️ MONGODB_URI not set — starting in-memory MongoDB for development...')
    try {
      memoryServer = await MongoMemoryServer.create()
      mongoUri = memoryServer.getUri()
      console.log('🧪 In-memory MongoDB started for dev')
    } catch (err) {
      console.error('❌ Failed to start in-memory MongoDB:', err.message)
      process.exit(1)
    }
  }

  try {
    await mongoose.connect(mongoUri)
    console.log('✅ MongoDB connected successfully.')

    // Verify SMTP transporter (does not block server start on failure)
    try {
      const smtpCheck = await verifyTransport()
      if (!smtpCheck.ok) {
        console.warn('⚠️ SMTP verification failed:', smtpCheck.message)
        console.warn('Set EMAIL_USER and EMAIL_PASS (App Password) in backend/.env to enable sending emails.')
      }
    } catch (e) {
      console.warn('⚠️ SMTP verify check threw an error:', e.message)
    }

    server.listen(PORT, () => {
      console.log(`✅ Backend API listening on http://localhost:${PORT}`)
      console.log(`✅ WebSocket Server ready on ws://localhost:${PORT}`)
      console.log(`📡 Waiting for client connections...`)
    })

    // Clean up memory server on process exit
    const cleanup = async () => {
      try {
        await mongoose.disconnect()
        if (memoryServer) await memoryServer.stop()
      } catch (_e) {}
      process.exit(0)
    }

    process.on('SIGINT', cleanup)
    process.on('SIGTERM', cleanup)
  } catch (error) {
    console.error('❌ Failed to connect to MongoDB:', error.message)
    process.exit(1)
  }
}

start()
