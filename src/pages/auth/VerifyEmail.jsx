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
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async e => {
    e.preventDefault()
    setErr('')
    if (!otp || otp.length < 4) return setErr('Enter the OTP sent to your email')
    // Only OTP is required here; password was collected during registration

    setLoading(true)
    try {
      const body = { email, otp }

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
          teamAccess: 'full',
          isCaptain: true,
          teamProfileCompleted: verifiedTeam.teamProfileCompleted,
          eloRating: verifiedTeam.eloRating || 1000,
          eloMatchesPlayed: verifiedTeam.eloMatchesPlayed || 0,
          teamName: verifiedTeam.teamName || verifiedTeam.captainName || verifiedTeam.name || '',
          teamInfo: {
            teamId: verifiedTeam._id,
            name: verifiedTeam.teamName || verifiedTeam.captainName || verifiedTeam.name || '',
            teamName: verifiedTeam.teamName || verifiedTeam.captainName || verifiedTeam.name || '',
            captainName: verifiedTeam.captainName || verifiedTeam.name || '',
            location: verifiedTeam.location || '',
            district: verifiedTeam.district || '',
          },
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

          {/* Password collected during registration; only OTP is required here */}

          <div style={{ display:'flex', gap:10 }}>
            <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Verifying…' : 'Verify'}</button>
            <button type="button" className="btn" onClick={resend}>Resend</button>
          </div>
        </form>
      </div>
    </div>
  )
}
