import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../App.jsx'
import { fetchApiJson } from '../../utils/apiClient.js'

export default function Register() {
  const navigate    = useNavigate()
  const [f, setF]   = useState({ name:'', email:'', role:'team', password:'', confirmPassword:'' })
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async e => {
    e.preventDefault(); setErr('')
    if (!f.name || !f.email) return setErr('Name and email are required.')
    if (!f.password || !f.confirmPassword) return setErr('Password and confirm password are required.')
    if (f.password !== f.confirmPassword) return setErr('Passwords do not match.')
    if (f.password.length < 6) return setErr('Password must be at least 6 characters.')

    setLoading(true)
    try {
      if (f.role === 'team') {
        const { response, data } = await fetchApiJson('/teams/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ captainName: f.name, email: f.email, password: f.password, confirmPassword: f.confirmPassword }),
        })
        if (!response.ok) {
          setErr(data.message || 'Failed to create team account.')
          return
        }
        // Send OTP for email verification before finalizing login
        fetchApiJson('/auth/send-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: f.email, name: f.name, role: 'team', password: f.password, confirmPassword: f.confirmPassword }),
          timeoutMs: 5000,
        }).catch(_e => {
          // ignore send failures; user can request resend on verify page
        })

        // Redirect to verify page and pass created team in location state
        navigate('/verify-email', { state: { email: f.email, role: 'team', team: data.team } })
        return
      }

      const { response, data } = await fetchApiJson('/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: f.email, name: f.name, role: 'owner', password: f.password, confirmPassword: f.confirmPassword }),
        timeoutMs: 5000,
      })

      if (!response.ok) {
        setErr(data.message || 'Failed to create owner account.')
        return
      }

      navigate('/verify-email', { state: { email: f.email, role: 'owner', owner: { name: f.name } } })
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
          <div className="form-group">
            <label className="form-label">Password</label>
            <input type="password" className="form-control" placeholder="Min 6 characters"
              value={f.password} onChange={e => setF({...f, password:e.target.value})} />
          </div>
          <div className="form-group">
            <label className="form-label">Confirm Password</label>
            <input type="password" className="form-control" placeholder="Repeat password"
              value={f.confirmPassword} onChange={e => setF({...f, confirmPassword:e.target.value})} />
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
