import React, { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../App.jsx'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

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
  owner: { name:'Bikash Rai',   email:'owner@fotmatch.com', role:'owner' },
  admin: { name:'Super Admin',  email:'admin@fotmatch.com', role:'admin' },
}

export default function Login() {
  const { setUser } = useAuth()
  const navigate    = useNavigate()
  const [f, setF]   = useState({ email:'', password:'', role:'team' })
  const [teamOptions, setTeamOptions] = useState([])
  const [err, setErr]     = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (f.role !== 'team' || teamOptions.length > 0) return

    let active = true

    const loadTeams = async () => {
      try {
        const response = await fetch(`${API_BASE}/teams`)
        const data = await response.json()

        if (!response.ok || !Array.isArray(data)) {
          throw new Error('Failed to load team accounts')
        }

        const sorted = data
          .map((team, index) => ({
            id: team._id || team.id || `team-${index + 1}`,
            email: team.email || '',
            captainName: team.captainName || 'Team User',
            label: team.teamName || team.name || team.captainName || team.email || `Team ${index + 1}`,
          }))
          .filter(team => team.email)
          .sort((left, right) => left.label.localeCompare(right.label, undefined, { sensitivity: 'base' }))

        if (!active) return

        setTeamOptions(sorted)
        setF(prev => (prev.email || sorted.length === 0 ? prev : { ...prev, email: sorted[0].email }))
      } catch (_error) {
        if (!active) return
        setErr('Unable to load team accounts right now.')
      }
    }

    loadTeams()

    return () => {
      active = false
    }
  }, [f.role, teamOptions.length])

  const selectedTeam = teamOptions.find(team => team.email === f.email) || null

  const changeRole = (role) => {
    if (role === 'team') {
      const nextEmail = teamOptions[0]?.email || ''
      setF(prev => ({ ...prev, role, email: prev.email || nextEmail }))
      return
    }

    setF(prev => ({ ...prev, role, email: DEMO[role].email }))
  }

  const go = async role => {
    if (role === 'team') {
      setErr('Pick a team account from the alphabetical list below.')
      setF(prev => ({ ...prev, role: 'team' }))
      return
    }

    setLoading(true)
    setTimeout(() => {
      setUser(DEMO[role])
      navigate({ team:'/team', owner:'/owner', admin:'/admin' }[role])
    }, 500)
  }

  const submit = async e => {
    e.preventDefault(); setErr('')
    if (!f.email || !f.password) return setErr('Please fill in all fields.')

    if (f.role !== 'team') {
      setLoading(true)
      setTimeout(() => {
        setUser(DEMO[f.role])
        navigate({ owner:'/owner', admin:'/admin' }[f.role])
      }, 500)
      return
    }

    const normalizedEmail = f.email.trim().toLowerCase()

    setLoading(true)
    try {
      const response = await fetch(`${API_BASE}/teams/email/${encodeURIComponent(normalizedEmail)}`)
      const data = await response.json()

      if (!response.ok) {
        setErr(data.message || 'Team account not found. Use a seeded team email or register first.')
        return
      }

      setUser({
        id: data._id,
        name: data.captainName,
        email: data.email,
        role: 'team',
        teamProfileCompleted: data.teamProfileCompleted,
        eloRating: data.eloRating,
        eloMatchesPlayed: data.eloMatchesPlayed || 0,
        teamName: data.teamName || '',
        teamInfo: {
          name: data.teamName || '',
          teamName: data.teamName || '',
          location: data.location || '',
          skill: data.skill || 'Intermediate',
          lat: data.lat,
          lng: data.lng,
          preferredDay: data.preferredDay || 'Saturday',
          preferredTime: data.preferredTime || '06:00 PM',
          currentElo: data.eloRating,
        },
      })

      navigate(data.teamProfileCompleted ? '/team' : '/team/profile')
    } catch (_error) {
      setErr('Unable to connect to server. Please try again.')
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

        <form onSubmit={submit}>
          <div className="form-group">
            <label className="form-label">Email Address</label>
            <input type="email" className="form-control" placeholder="you@example.com"
              value={f.email}
              readOnly={f.role === 'team' && teamOptions.length > 0}
              onChange={e => setF({...f, email:e.target.value})}
            />
          </div>
          {f.role === 'team' && teamOptions.length > 0 && (
            <div className="form-group">
              <label className="form-label">Team Account</label>
              <select
                className="form-control"
                value={f.email}
                onChange={e => setF({ ...f, email: e.target.value })}
              >
                <option value="">Select a team account</option>
                {teamOptions.map(team => (
                  <option key={team.id} value={team.email}>{team.label} ({team.captainName})</option>
                ))}
              </select>
              {selectedTeam && (
                <div style={{ fontSize:12, color:'var(--txt-3)', marginTop:6 }}>
                  User: {selectedTeam.captainName} | Email: {selectedTeam.email}
                </div>
              )}
            </div>
          )}
          <div className="form-group">
            <label className="form-label">Password</label>
            <input type="password" className="form-control" placeholder="••••••••"
              value={f.password} onChange={e => setF({...f, password:e.target.value})} />
          </div>
          <div className="form-group">
            <label className="form-label">Sign in as</label>
            <select className="form-control" value={f.role} onChange={e => changeRole(e.target.value)}>
              <option value="team">⚽  Team User (Player / Manager)</option>
              <option value="owner">🏟️  Futsal Owner</option>
              <option value="admin">🛡️  Administrator</option>
            </select>
          </div>
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
