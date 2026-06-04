import React, { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../App.jsx'
import { getApiBaseUrl } from '../../utils/apiConfig.js'

const formatUid = value => {
  const digits = String(value || '').replace(/\D/g, '')
  if (digits.length !== 8) return ''
  return digits
}

const DEMO = {
  team:  {
    name:'Alex Rivera',
    email:'team@fotmatch.com',
    role:'team',
    teamProfileCompleted:true,
    teamInfo:{
      name:'Green Eagles',
      location:'Lazimpat, Kathmandu',
      skill:'Intermediate',
    },
  },
  admin: { name:'Super Admin',  email:'admin@fotmatch.com', role:'admin' },
}

const API_BASE = getApiBaseUrl()

export default function Login() {
  const { setUser } = useAuth()
  const navigate    = useNavigate()
  const [f, setF]   = useState({ email:'', password:'' })
  const [err, setErr]     = useState('')
  const [loading, setLoading] = useState(false)

  const go = async role => {
    if (role === 'team') {
      setErr('Enter your team email and password to sign in.')
      setF(prev => ({ ...prev }))
      return
    }

    if (role === 'owner') {
      setErr('Enter your owner email and password to sign in.')
      setF(prev => ({ ...prev }))
      return
    }

    setLoading(true)
    setTimeout(() => {
      setUser(DEMO[role])
      navigate({ admin:'/admin' }[role])
    }, 500)
  }

  const submit = async e => {
    e.preventDefault(); setErr('')
    if (!f.email || !f.password) return setErr('Please fill in all fields.')
    setLoading(true)
    try {
      const normalizedEmail = f.email.trim().toLowerCase()
      const doLogin = async (payload) => {
        const resp = await fetch(`${API_BASE}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const json = await resp.json()
        return { resp, json }
      }

      let { resp: response, json: data } = await doLogin({ email: normalizedEmail, password: f.password })

      // If account wasn't found, retry as a team login to allow backfilling
      if (!response.ok && response.status === 404) {
        const retry = await doLogin({ email: normalizedEmail, password: f.password, role: 'team' })
        response = retry.resp
        data = retry.json
      }

      if (!response.ok) {
        setErr(data.message || 'Unable to sign in.')
        return
      }

      const loggedInUser = data.user

      if (loggedInUser.role === 'owner') {
        setUser({
          id: loggedInUser._id,
          name: loggedInUser.name,
          email: loggedInUser.email,
          role: 'owner',
          profileCompleted: loggedInUser.profileCompleted || false,
          ownerProfile: loggedInUser.ownerProfile || {
            venueName: '',
            location: '',
            lat: null,
            lng: null,
            courts: 0,
            phone: '',
            hours: '',
            locationVerified: false,
          },
          venueName: loggedInUser.ownerProfile?.venueName || '',
        })
        navigate('/owner')
        return
      }

      const teamAccess = loggedInUser.teamAccess || 'full'
      const isCaptain = loggedInUser.isCaptain !== false
      const teamProfileCompleted = Boolean(data.team?.teamProfileCompleted)
      const teamInfo = {
        teamId: data.team?._id || loggedInUser.teamInfo?.teamId || null,
        uid: formatUid(data.team?.uid || loggedInUser.teamInfo?.uid),
        name: data.team?.teamName || loggedInUser.teamInfo?.teamName || loggedInUser.teamInfo?.captainName || loggedInUser.name || '',
        teamName: data.team?.teamName || loggedInUser.teamInfo?.teamName || loggedInUser.teamInfo?.captainName || loggedInUser.name || '',
        captainName: data.team?.captainName || loggedInUser.teamInfo?.captainName || loggedInUser.name || '',
        location: data.team?.location || loggedInUser.teamInfo?.location || '',
        district: data.team?.district || loggedInUser.teamInfo?.district || '',
        skill: data.team?.skill || 'Intermediate',
        lat: data.team?.lat,
        lng: data.team?.lng,
        currentElo: data.team?.eloRating || 1000,
      }
      const hasJoinedTeam = Boolean(
        teamProfileCompleted
        || (
          (teamAccess === 'basic' || !isCaptain)
          && (teamInfo.teamId || teamInfo.uid || teamInfo.teamName)
        )
      )

      setUser({
        id: data.team?._id || loggedInUser.teamInfo?.teamId || loggedInUser._id,
        uid: teamInfo.uid,
        name: loggedInUser.name,
        email: loggedInUser.email,
        role: 'team',
        teamAccess,
        isCaptain,
        teamProfileCompleted,
        eloRating: data.team?.eloRating || 1000,
        eloMatchesPlayed: data.team?.eloMatchesPlayed || 0,
        teamName: teamInfo.teamName,
        teamInfo,
      })

      // Show the team choice page only on the user's first login when their profile
      // is not yet completed. Persist a per-user flag in localStorage so the
      // choice screen isn't auto-shown again on subsequent logins.
      try {
        const uniqueKey = loggedInUser._id || loggedInUser.email || ''
        const seenKey = `fotmatch.seenTeamChoice:${uniqueKey}`
        if (!hasJoinedTeam && !localStorage.getItem(seenKey)) {
          localStorage.setItem(seenKey, '1')
          navigate('/team/choice')
        } else {
          navigate('/team')
        }
      } catch (_e) {
        navigate(hasJoinedTeam ? '/team' : '/team/choice')
      }
    } catch (_error) {
      setErr('Unable to process login. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-glow-1" />
      <div className="auth-glow-2" />

      <div className="auth-card anim-1">
        <div className="auth-logo">
          <div className="auth-logo-text">Fot<em>Match</em> ⚽</div>
          <div className="auth-logo-sub">Futsal team finder &amp; booking platform</div>
        </div>

        <h2>Welcome back</h2>
        <p>Sign in to access your dashboard</p>

        {err && <div className="alert alert-error"><i className="fas fa-circle-exclamation" />{err}</div>}

        <form onSubmit={submit} autoComplete="off">
          <div className="form-group">
            <label className="form-label">Email Address</label>
            <input type="email" className="form-control" placeholder="you@example.com"
              name="email"
              autoComplete="username"
              value={f.email}
              readOnly={false}
              onChange={e => setF({...f, email:e.target.value})}
            />
          </div>
          {/* Simplified login: only email + password (no account dropdowns) */}
          <div className="form-group">
            <label className="form-label">Password</label>
            <input type="password" className="form-control" placeholder="••••••••"
              name="password"
              autoComplete="new-password"
              value={f.password} onChange={e => setF({...f, password:e.target.value})} />
          </div>
          {/* Removed role selector - backend will infer by email/account */}
          <button type="submit" className="btn btn-primary btn-full btn-lg" disabled={loading}>
            {loading
              ? <><i className="fas fa-circle-notch fa-spin" /> Signing in…</>
              : <><i className="fas fa-right-to-bracket" /> Sign In</>}
          </button>
        </form>

        <div className="auth-divider"><span>Quick demo login</span></div>

        <div className="demo-grid">
          {[
            { role:'team',  label:'Team User', icon:'⚽' },
            { role:'owner', label:'Owner',     icon:'🏟️' },
            { role:'admin', label:'Admin',     icon:'🛡️' },
          ].map(d => (
            <button key={d.role} className="demo-btn" onClick={() => go(d.role)}>
              <span>{d.icon}</span>{d.label}
            </button>
          ))}
        </div>

        <p className="auth-footer-p">
          No account? <Link to="/register" className="auth-link">Register here</Link>
        </p>
      </div>
    </div>
  )
}
