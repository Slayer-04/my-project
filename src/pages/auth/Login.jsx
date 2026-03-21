import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../App.jsx'

const DEMO = {
  team:  { name:'Alex Rivera',  email:'team@fotmatch.com',  role:'team'  },
  owner: { name:'Bikash Rai',   email:'owner@fotmatch.com', role:'owner' },
  admin: { name:'Super Admin',  email:'admin@fotmatch.com', role:'admin' },
}

export default function Login() {
  const { setUser } = useAuth()
  const navigate    = useNavigate()
  const [f, setF]   = useState({ email:'', password:'', role:'team' })
  const [err, setErr]     = useState('')
  const [loading, setLoading] = useState(false)

  const go = role => {
    setLoading(true)
    setTimeout(() => {
      setUser(DEMO[role])
      navigate({ team:'/team', owner:'/owner', admin:'/admin' }[role])
    }, 500)
  }

  const submit = e => {
    e.preventDefault(); setErr('')
    if (!f.email || !f.password) return setErr('Please fill in all fields.')
    go(f.role)
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
              value={f.email} onChange={e => setF({...f, email:e.target.value})} />
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <input type="password" className="form-control" placeholder="••••••••"
              value={f.password} onChange={e => setF({...f, password:e.target.value})} />
          </div>
          <div className="form-group">
            <label className="form-label">Sign in as</label>
            <select className="form-control" value={f.role} onChange={e => setF({...f, role:e.target.value})}>
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
