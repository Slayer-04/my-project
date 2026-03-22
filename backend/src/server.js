const express = require('express')
const cors = require('cors')
const mongoose = require('mongoose')
const dotenv = require('dotenv')
const teamRoutes = require('./routes/teamRoutes')

dotenv.config()

const app = express()
const PORT = process.env.PORT || 5000
const MONGODB_URI = process.env.MONGODB_URI

app.use(cors())
app.use(express.json())

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'fotmatch-backend' })
})

app.use('/api/teams', teamRoutes)

app.use('/api', (_req, res) => {
  res.status(404).json({ message: 'API route not found.' })
})

const start = async () => {
  if (!MONGODB_URI) {
    console.error('Missing MONGODB_URI in environment variables.')
    process.exit(1)
  }

  try {
    await mongoose.connect(MONGODB_URI)
    console.log('MongoDB connected successfully.')

    app.listen(PORT, () => {
      console.log(`Backend API listening on http://localhost:${PORT}`)
    })
  } catch (error) {
    console.error('Failed to connect to MongoDB:', error.message)
    process.exit(1)
  }
}

start()
