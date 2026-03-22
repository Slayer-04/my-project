import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../App.jsx'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

export default function Register() {
  const { setUser } = useAuth()
  const navigate    = useNavigate()
  const [f, setF]   = useState({ name:'', email:'', password:'', confirm:'', role:'team' })
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async e => {
    e.preventDefault(); setErr('')
    if (!f.name || !f.email || !f.password || !f.confirm) return setErr('All fields are required.')
    if (f.password !== f.confirm) return setErr('Passwords do not match.')
    if (f.password.length < 6) return setErr('Password must be at least 6 characters.')

    setLoading(true)
    try {
      if (f.role === 'team') {
        const response = await fetch(`${API_BASE}/teams/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ captainName: f.name, email: f.email }),
        })

        const data = await response.json()
        if (!response.ok) {
          setErr(data.message || 'Failed to create team account.')
          return
        }

        setUser({
          id: data.team._id,
          name: data.team.captainName,
          email: data.team.email,
          role: 'team',
          teamProfileCompleted: data.team.teamProfileCompleted,
          teamInfo: {
            name: data.team.teamName || '',
            location: data.team.location || '',
            skill: data.team.skill || 'Intermediate',
          },
        })
        navigate('/team')
        return
      }

      setUser({
        name: f.name,
        email: f.email,
        role: f.role,
      })
      navigate('/owner')
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

      <div className="auth-card anim-1" style={{ maxWidth:460 }}>
        <div className="auth-logo">
          <div className="auth-logo-text">Fot<em>Match</em> ⚽</div>
          <div className="auth-logo-sub">Join thousands of futsal players &amp; venues</div>
        </div>

        <h2>Create account</h2>
        <p>Start finding matches and booking courts today</p>

        {err && <div className="alert alert-error"><i className="fas fa-circle-exclamation" />{err}</div>}

        <form onSubmit={submit}>
          <div className="form-group">
            <label className="form-label">Full Name</label>
            <input type="text" className="form-control" placeholder="Your name"
              value={f.name} onChange={e => setF({...f, name:e.target.value})} />
          </div>
          <div className="form-group">
            <label className="form-label">Email Address</label>
            <input type="email" className="form-control" placeholder="you@example.com"
              value={f.email} onChange={e => setF({...f, email:e.target.value})} />
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
            <div className="form-group">
              <label className="form-label">Password</label>
              <input type="password" className="form-control" placeholder="Min 6 chars"
                value={f.password} onChange={e => setF({...f, password:e.target.value})} />
            </div>
            <div className="form-group">
              <label className="form-label">Confirm</label>
              <input type="password" className="form-control" placeholder="Repeat"
                value={f.confirm} onChange={e => setF({...f, confirm:e.target.value})} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">I am a…</label>
            <select className="form-control" value={f.role} onChange={e => setF({...f, role:e.target.value})}>
              <option value="team">⚽  Team User (Player / Manager)</option>
              <option value="owner">🏟️  Futsal Owner</option>
            </select>
          </div>
          <button type="submit" className="btn btn-primary btn-full btn-lg" disabled={loading}>
            {loading
              ? <><i className="fas fa-circle-notch fa-spin" /> Creating account…</>
              : <><i className="fas fa-user-plus" /> Create Account</>}
          </button>
        </form>

        <p className="auth-footer-p">
          Already have an account? <Link to="/login" className="auth-link">Sign in</Link>
        </p>
      </div>
    </div>
  )
}
