import React, { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../App.jsx'
import { fetchApiJson } from '../../utils/apiClient.js'

const formatUid = value => {
  const digits = String(value || '').replace(/\D/g, '')
  if (digits.length !== 8) return ''
  return digits
}

export default function VerifyEmail() {
  const { state } = useLocation()
  const navigate = useNavigate()
  const { setUser } = useAuth()
  const email = (state && state.email) || ''
  const role = (state && state.role) || (state && state.team ? 'team' : 'owner')
  const team = (state && state.team) || null
  const owner = (state && state.owner) || null

  const [otp, setOtp] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async e => {
    e.preventDefault()
    setErr('')
    if (!otp || otp.length < 4) return setErr('Enter the OTP sent to your email')
    if (team) {
      if (!password || password.length < 6) return setErr('Password must be at least 6 characters')
      if (password !== confirm) return setErr('Passwords do not match')
    }

    setLoading(true)
    try {
      const body = { email, otp }
      if (team) body.password = password

      const { response: res, data } = await fetchApiJson('/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        setErr(data.message || 'Verification failed')
        setLoading(false)
        return
      }

      // Prefer the team returned by the server (created during verification)
      const verifiedTeam = data && data.team ? data.team : team
      const verifiedUser = data && data.user ? data.user : null

      if (verifiedTeam) {
        setUser({
          id: verifiedTeam._id,
          uid: formatUid(verifiedTeam.uid),
          name: verifiedTeam.captainName || verifiedTeam.name || '',
          email,
          role: 'team',
          teamProfileCompleted: verifiedTeam.teamProfileCompleted,
          eloRating: verifiedTeam.eloRating || 1000,
          eloMatchesPlayed: verifiedTeam.eloMatchesPlayed || 0,
          teamName: verifiedTeam.teamName || '',
        })

        navigate(verifiedTeam.teamProfileCompleted ? '/team' : '/team/choice')
        return
      }

      if (role === 'owner' || verifiedUser?.role === 'owner') {
        setUser({
          id: verifiedUser?._id,
          name: verifiedUser?.name || owner?.name || 'Futsal Owner',
          email,
          role: 'owner',
          profileCompleted: Boolean(verifiedUser?.profileCompleted),
          ownerProfile: verifiedUser?.ownerProfile || {
            venueName: '',
            location: '',
            lat: null,
            lng: null,
            courts: 0,
            phone: '',
            hours: '',
            locationVerified: false,
          },
          venueName: verifiedUser?.ownerProfile?.venueName || '',
        })
        navigate('/owner/profile')
        return
      }

      // Fallback: navigate home if no team data is available
      navigate('/')
    } catch (err) {
      console.error('verify submit error', err)
      setErr('Verification failed')
    } finally {
      setLoading(false)
    }
  }

  const resend = async () => {
    try {
      await fetchApiJson('/auth/resend-otp', {
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
