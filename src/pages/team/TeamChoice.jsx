import React from 'react'
import { useNavigate } from 'react-router-dom'

export default function TeamChoice() {
  const navigate = useNavigate()

  return (
    <div className="auth-page">
      <div className="auth-card" style={{ maxWidth:600 }}>
        <h2>Welcome to your team</h2>
        <p>Select whether you want to create a new team profile or join an existing team.</p>

        <div style={{ display:'flex', gap:20, marginTop:20 }}>
          <button className="btn btn-primary btn-full" onClick={() => navigate('/team/profile')}>
            Create team (set up profile)
          </button>
          <button className="btn btn-outline btn-full" onClick={() => navigate('/team/join')}>
            Join by UID
          </button>
        </div>

        <p style={{ marginTop:18, fontSize:13, color:'var(--txt-3)' }}>
          If you already have a team, choose "Join" to enter the captain’s UID and request access.
        </p>
      </div>
    </div>
  )
}
