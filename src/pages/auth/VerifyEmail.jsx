import React, { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../App.jsx'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

export default function VerifyEmail() {
  const { state } = useLocation()
  const navigate = useNavigate()
  const { setUser } = useAuth()
  const email = (state && state.email) || ''
  const team = (state && state.team) || null

  const [otp, setOtp] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async e => {
    e.preventDefault(); setErr('')
    if (!otp || otp.length < 4) return setErr('Enter the OTP sent to your email')
    if (team) {
      if (!password || password.length < 6) return setErr('Password must be at least 6 characters')
      if (password !== confirm) return setErr('Passwords do not match')
    }

    setLoading(true)
    try {
      const body = { email, otp }
      if (team) body.password = password

      const res = await fetch(`${API_BASE}/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const data = await res.json()
      if (!res.ok) return setErr(data.message || 'Verification failed')

      // On success, finalize login using team data if present
      if (team) {
        setUser({
          id: team._id,
          name: team.captainName,
          email,
          role: 'team',
          teamProfileCompleted: team.teamProfileCompleted,
          eloRating: team.eloRating,
          eloMatchesPlayed: team.eloMatchesPlayed || 0,
          teamName: team.teamName || '',
          teamInfo: {
            name: team.teamName || '',
            teamName: team.teamName || '',
            location: team.location || '',
            skill: team.skill || 'Intermediate',
            lat: team.lat,
            lng: team.lng,
            preferredDay: team.preferredDay || 'Saturday',
            preferredTime: team.preferredTime || '06:00 PM',
            currentElo: team.eloRating,
          },
        })
        navigate('/team')
        return
      }

      // Otherwise redirect to login
      navigate('/login')
    } catch (_err) {
      setErr('Unable to verify code. Try again.')
    } finally {
      setLoading(false)
    }
  }

  const resend = async () => {
    try {
      await fetch(`${API_BASE}/auth/resend-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      alert('OTP resent to your email')
    } catch (_e) {
      alert('Unable to resend OTP')
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card" style={{ maxWidth:460 }}>
        <h2>Verify your email</h2>
        <p>Enter the code sent to <strong>{email}</strong></p>

        {err && <div className="alert alert-error">{err}</div>}

        <form onSubmit={submit}>
          <div className="form-group">
            <label className="form-label">One-time code</label>
            <input type="text" className="form-control" value={otp} onChange={e => setOtp(e.target.value)} placeholder="123456" />
          </div>

          {team && (
            <>
              <div className="form-group">
                <label className="form-label">Password</label>
                <input type="password" className="form-control" value={password} onChange={e => setPassword(e.target.value)} placeholder="Min 6 characters" />
              </div>
              <div className="form-group">
                <label className="form-label">Confirm Password</label>
                <input type="password" className="form-control" value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Repeat password" />
              </div>
            </>
          )}

          <div style={{ display:'flex', gap:10 }}>
            <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Verifying…' : 'Verify'}</button>
            <button type="button" className="btn" onClick={resend}>Resend</button>
          </div>
        </form>
      </div>
    </div>
  )
}
