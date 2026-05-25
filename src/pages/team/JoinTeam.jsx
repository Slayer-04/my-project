import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../App.jsx'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

export default function JoinTeam() {
  const { user, setUser } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ teamUid: '', requesterName: user?.name || '', requesterEmail: user?.email || '', message: '' })
  const [status, setStatus] = useState('')
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)
  const [awaitingApproval, setAwaitingApproval] = useState(false)
  const [watchTarget, setWatchTarget] = useState({ teamUid: '', requesterEmail: '', requesterName: '' })

  useEffect(() => {
    if (!awaitingApproval || !watchTarget.teamUid || !watchTarget.requesterEmail) return

    let active = true

    const checkStatus = async () => {
      try {
        const statusResponse = await fetch(
          `${API_BASE}/team-joins/status?teamUid=${encodeURIComponent(watchTarget.teamUid)}&requesterEmail=${encodeURIComponent(watchTarget.requesterEmail)}`
        )

        if (!active || !statusResponse.ok) return

        const statusData = await statusResponse.json()
        if (!active || !statusData?.status) return

        if (statusData.status === 'pending') {
          setStatus('Request sent. Waiting for captain approval. You will be redirected automatically once approved.')
          return
        }

        if (statusData.status === 'declined') {
          setAwaitingApproval(false)
          setStatus('')
          setErr('Sorry, your join request was declined by the captain.')
          setTimeout(() => navigate('/team/choice', { replace: true }), 1800)
          return
        }

        if (statusData.status !== 'approved') {
          return
        }

        const response = await fetch(`${API_BASE}/team-joins/member/${encodeURIComponent(watchTarget.requesterEmail)}`)
        if (!active || !response.ok) return

        const memberData = await response.json()
        if (!active || !memberData?.team) return

        setStatus(`Welcome ${memberData.memberName || watchTarget.requesterName || 'player'}! Your request was accepted.`)
        setErr('')

        setUser({
          id: memberData.team._id,
          uid: memberData.team.uid,
          name: memberData.memberName || watchTarget.requesterName || 'Team Member',
          email: memberData.memberEmail || watchTarget.requesterEmail,
          role: 'team',
          teamAccess: 'basic',
          isCaptain: false,
          teamProfileCompleted: true,
          eloRating: memberData.team.eloRating,
          eloMatchesPlayed: memberData.team.eloMatchesPlayed || 0,
          teamName: memberData.team.teamName || '',
          teamInfo: {
            name: memberData.team.teamName || '',
            teamName: memberData.team.teamName || '',
            location: memberData.team.location || '',
            skill: memberData.team.skill || 'Intermediate',
            lat: memberData.team.lat,
            lng: memberData.team.lng,
            preferredDay: memberData.team.preferredDay || 'Saturday',
            preferredTime: memberData.team.preferredTime || '06:00 PM',
            currentElo: memberData.team.eloRating,
          },
        })

        setAwaitingApproval(false)
        setTimeout(() => navigate('/team', { replace: true }), 900)
      } catch (_error) {
        // Ignore transient errors while waiting for captain approval.
      }
    }

    checkStatus()
    const intervalId = setInterval(checkStatus, 5000)

    return () => {
      active = false
      clearInterval(intervalId)
    }
  }, [awaitingApproval, navigate, setUser, watchTarget])

  const submit = async (e) => {
    e.preventDefault()
    setErr('')
    setStatus('')

    if (!form.teamUid.trim() || !form.requesterName.trim() || !form.requesterEmail.trim()) {
      setErr('UID, your name, and your email are required.')
      return
    }

    setLoading(true)
    try {
      const response = await fetch(`${API_BASE}/team-joins/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teamUid: form.teamUid.trim(),
          requesterName: form.requesterName.trim(),
          requesterEmail: form.requesterEmail.trim(),
          message: form.message.trim(),
        }),
      })

      const data = await response.json()
      if (!response.ok) {
        if (response.status === 409 && data?.request) {
          setWatchTarget({
            teamUid: data.request.teamUid || form.teamUid.trim(),
            requesterEmail: (data.request.requesterEmail || form.requesterEmail.trim()).toLowerCase(),
            requesterName: data.request.requesterName || form.requesterName.trim(),
          })
          setStatus('You already have a pending request. Waiting for captain decision...')
          setAwaitingApproval(true)
          return
        }
        setErr(data.message || 'Failed to send join request.')
        return
      }

      setStatus('Request sent. Waiting for captain approval. You will be redirected automatically once approved.')
      setWatchTarget({
        teamUid: data.request?.teamUid || form.teamUid.trim(),
        requesterEmail: (data.request?.requesterEmail || form.requesterEmail.trim()).toLowerCase(),
        requesterName: data.request?.requesterName || form.requesterName.trim(),
      })
      setAwaitingApproval(true)
    } catch (_error) {
      setErr('Unable to connect to server. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card" style={{ maxWidth:560 }}>
        <h2>Join a team</h2>
        <p>Enter the 8-digit team UID and send a request that appears in the captain’s notification bell.</p>

        {err && <div className="alert alert-error">{err}</div>}
        {status && <div className="alert alert-success">{status}</div>}

        <form onSubmit={submit}>
          <div className="form-group">
            <label className="form-label">Team UID</label>
            <input
              className="form-control"
              inputMode="numeric"
              maxLength={8}
              placeholder="12345678"
              value={form.teamUid}
              onChange={e => setForm({ ...form, teamUid: e.target.value.replace(/\D/g, '').slice(0, 8) })}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Your Name</label>
            <input
              className="form-control"
              value={form.requesterName}
              onChange={e => setForm({ ...form, requesterName: e.target.value })}
              placeholder="Your name"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Your Email</label>
            <input
              type="email"
              className="form-control"
              value={form.requesterEmail}
              onChange={e => setForm({ ...form, requesterEmail: e.target.value })}
              placeholder="you@example.com"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Message to captain</label>
            <textarea
              className="form-control"
              rows={4}
              value={form.message}
              onChange={e => setForm({ ...form, message: e.target.value })}
              placeholder="Introduce yourself briefly"
            />
          </div>
          <div style={{ display:'flex', gap:10 }}>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Sending…' : 'Send Request'}
            </button>
            <button type="button" className="btn" onClick={() => navigate('/team/choice')}>Back</button>
          </div>
        </form>
      </div>
    </div>
  )
}
