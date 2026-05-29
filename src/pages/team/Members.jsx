import React, { useEffect, useMemo, useState } from 'react'
import Sidebar from '../../components/Sidebar.jsx'
import Topbar from '../../components/Topbar.jsx'
import { useAuth } from '../../App.jsx'
import { getApiBaseUrl } from '../../utils/apiConfig.js'

const API_BASE = getApiBaseUrl()

export default function Members() {
  const { user } = useAuth()
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)

  const teamUid = useMemo(() => {
    const digits = String(user?.uid || '').replace(/\D/g, '')
    return digits.length === 8 ? digits : ''
  }, [user?.uid])

  useEffect(() => {
    let active = true

    const loadMembers = async () => {
      if (!teamUid) {
        if (active) {
          setMembers([])
          setLoading(false)
        }
        return
      }

      setLoading(true)

      try {
        const response = await fetch(`${API_BASE}/team-joins/team/${encodeURIComponent(teamUid)}`)
        const data = await response.json()

        if (!active) return

        if (!response.ok || !Array.isArray(data)) {
          setMembers([])
          setLoading(false)
          return
        }

        const captainName = user?.teamInfo?.captainName || user?.captainName || user?.name || 'Captain'
        const approvedMembers = data
          .filter(request => request.status === 'approved')
          .map(request => request.requesterName || request.requesterEmail || 'Member')

        setMembers([
          `${captainName} (Captain)`,
          ...approvedMembers.map(name => `${name} (Approved Member)`),
        ])
        setLoading(false)
      } catch (_error) {
        if (!active) return
        setMembers([])
        setLoading(false)
      }
    }

    loadMembers()

    return () => {
      active = false
    }
  }, [teamUid, user?.captainName, user?.name, user?.teamInfo?.captainName])

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-area">
        <Topbar title="Members" breadcrumb="FotMatch / Team User / Members" />
        <div className="page-inner">
          <div className="card anim-1" style={{ maxWidth: 640 }}>
            <div className="card-hd">
              <h3>Team Members</h3>
            </div>

            <div style={{ padding: '18px 22px 22px' }}>
              <p style={{ margin: '0 0 16px', color: '#4a5568' }}>
                {loading ? 'Loading team members...' : 'Simple member names list for this team.'}
              </p>

              <div style={{ display: 'grid', gap: 12 }}>
                {!loading && members.length === 0 && (
                  <div style={{ padding: '14px 16px', border: '1px solid #e9edf2', borderRadius: 12, background: '#fff', color: '#64748b' }}>
                    No approved members yet.
                  </div>
                )}

                {members.map(member => (
                  <div
                    key={member}
                    style={{
                      padding: '14px 16px',
                      border: '1px solid #e9edf2',
                      borderRadius: 12,
                      background: '#fff',
                      fontWeight: 600,
                    }}
                  >
                    {member}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}