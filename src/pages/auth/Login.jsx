import React, { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../App.jsx'
import { futsalPartners, teams as mockTeams, venues as mockVenues } from '../../data/mockData.js'

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
  admin: { name:'Super Admin',  email:'admin@fotmatch.com', role:'admin' },
}

export default function Login() {
  const { setUser } = useAuth()
  const navigate    = useNavigate()
  const [f, setF]   = useState({ email:'', password:'', role:'team' })
  const [teamOptions, setTeamOptions] = useState([])
  const [ownerOptions, setOwnerOptions] = useState([])
  const [err, setErr]     = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (f.role !== 'team' || teamOptions.length > 0) return

    let active = true

    const loadTeams = async () => {
      try {
        // First try to fetch from API
        try {
          const response = await fetch(`${API_BASE}/teams`)
          const data = await response.json()

          if (response.ok && Array.isArray(data)) {
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
            return
          }
        } catch (_apiError) {
          // Fall through to use mock data
        }

        // Use mock data as fallback
        const sorted = mockTeams
          .map((team, index) => ({
            id: team.id,
            email: `team${team.id}@fotmatch.com`,
            captainName: 'Team User',
            label: team.name,
          }))
          .sort((left, right) => left.label.localeCompare(right.label, undefined, { sensitivity: 'base' }))

        if (!active) return
        setTeamOptions(sorted)
        setF(prev => (prev.email || sorted.length === 0 ? prev : { ...prev, email: sorted[0].email }))
      } catch (_error) {
        if (!active) return
        // Still provide access to demo accounts even if loading fails
        setTeamOptions([])
      }
    }

    loadTeams()

    return () => {
      active = false
    }
  }, [f.role, teamOptions.length])

  // Load futsal owner options
  useEffect(() => {
    if (f.role !== 'owner') return

    let active = true

    const loadOwners = async () => {
      try {
        try {
          const response = await fetch(`${API_BASE}/venues`)
          const data = await response.json()

          if (response.ok && Array.isArray(data) && data.length > 0) {
            const ownersFromApi = data
              .filter(venue => venue.owner && venue.ownerEmail)
              .map((venue, index) => ({
                id: venue._id || venue.id || `owner-${index + 1}`,
                email: venue.ownerEmail,
                name: venue.owner,
                venue: venue.name,
                label: `${venue.owner} (${venue.name})`,
              }))
              .sort((left, right) => left.label.localeCompare(right.label, undefined, { sensitivity: 'base' }))

            if (!active) return
            setOwnerOptions(ownersFromApi)
            setF(prev => ({ ...prev, email: ownersFromApi[0]?.email || '' }))
            return
          }
        } catch (_apiError) {
          // Fall through to mock owner options
        }

        const ownersFromMockVenues = mockVenues
          .filter(venue => venue.owner && venue.ownerEmail)
          .map(venue => ({
            id: venue.id,
            email: venue.ownerEmail,
            name: venue.owner,
            venue: venue.name,
            label: `${venue.owner} (${venue.name})`,
          }))
          .sort((left, right) => left.label.localeCompare(right.label, undefined, { sensitivity: 'base' }))

        const owners = ownersFromMockVenues.length > 0
          ? ownersFromMockVenues
          : futsalPartners.map((partner) => ({
              id: partner.id,
              email: `${partner.owner.toLowerCase().replace(/\s+/g, '.')}@fotmatch.com`,
              name: partner.owner,
              venue: partner.name,
              label: `${partner.owner} (${partner.name})`,
            }))

        if (!active) return
        setOwnerOptions(owners)
        setF(prev => ({ ...prev, email: owners[0]?.email || '' }))
      } catch (_error) {
        if (!active) return
        setOwnerOptions([])
        setF(prev => ({ ...prev, email: '' }))
      }
    }

    loadOwners()

    return () => {
      active = false
    }
  }, [f.role])

  const selectedTeam = teamOptions.find(team => team.email === f.email) || null
  const selectedOwner = ownerOptions.find(owner => owner.email === f.email) || null

  const changeRole = (role) => {
    if (role === 'team') {
      const nextEmail = teamOptions[0]?.email || ''
      setF(prev => ({ ...prev, role, email: prev.email || nextEmail }))
      return
    }

    if (role === 'owner') {
      const nextEmail = ownerOptions[0]?.email || ''
      setF(prev => ({ ...prev, role, email: nextEmail }))
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

    if (role === 'owner') {
      setErr('Pick a futsal owner account from the list below.')
      setF(prev => ({ ...prev, role: 'owner' }))
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

    if (f.role !== 'team') {
      if (f.role === 'owner') {
        setLoading(true)
        setTimeout(() => {
          const owner = ownerOptions.find(o => o.email === f.email)
          setUser({
            name: owner?.name || 'Futsal Owner',
            email: owner?.email,
            role: 'owner',
            venueId: owner?.id,
            venueName: owner?.venue,
          })
          navigate('/owner')
        }, 500)
        return
      }

      setLoading(true)
      setTimeout(() => {
        setUser(DEMO[f.role])
        navigate({ admin:'/admin' }[f.role])
      }, 500)
      return
    }

    const normalizedEmail = f.email.trim().toLowerCase()

    setLoading(true)
    try {
      // Try API first
      try {
        const response = await fetch(`${API_BASE}/teams/email/${encodeURIComponent(normalizedEmail)}`)
        const data = await response.json()

        if (response.ok) {
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
          return
        }
      } catch (_apiError) {
        // Fall through to use mock data
      }

      // Use mock data fallback
      const selectedTeam = teamOptions.find(team => team.email === normalizedEmail)
      
      if (!selectedTeam) {
        setErr('Team account not found. Please select a team from the list.')
        setLoading(false)
        return
      }

      setUser({
        id: selectedTeam.id,
        name: selectedTeam.captainName,
        email: selectedTeam.email,
        role: 'team',
        teamProfileCompleted: true,
        eloRating: 1500,
        eloMatchesPlayed: 0,
        teamName: selectedTeam.label || '',
        teamInfo: {
          name: selectedTeam.label || '',
          teamName: selectedTeam.label || '',
          location: 'Kathmandu',
          skill: 'Intermediate',
          lat: 27.7172,
          lng: 85.3240,
          preferredDay: 'Saturday',
          preferredTime: '06:00 PM',
          currentElo: 1500,
        },
      })

      navigate('/team')
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
          {f.role === 'owner' && ownerOptions.length > 0 && (
            <div className="form-group">
              <label className="form-label">Futsal Owner Account</label>
              <select
                className="form-control"
                value={f.email}
                onChange={e => setF({ ...f, email: e.target.value })}
              >
                <option value="">Select an owner account</option>
                {ownerOptions.map(owner => (
                  <option key={owner.id} value={owner.email}>{owner.label}</option>
                ))}
              </select>
              {selectedOwner && (
                <div style={{ fontSize:12, color:'var(--txt-3)', marginTop:6 }}>
                  Owner: {selectedOwner.name} | Venue: {selectedOwner.venue} | Email: {selectedOwner.email}
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
