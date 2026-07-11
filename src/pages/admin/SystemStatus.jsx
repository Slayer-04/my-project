import React, { useEffect, useState } from 'react'
import Sidebar from '../../components/Sidebar.jsx'
import Topbar  from '../../components/Topbar.jsx'
import { fetchApiJson } from '../../utils/apiClient.js'

const formatUptime = (seconds) => {
  if (!Number.isFinite(seconds)) return '—'
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)
  if (hours > 0) return `${hours}h ${minutes}m`
  if (minutes > 0) return `${minutes}m ${secs}s`
  return `${secs}s`
}

export default function SystemStatus() {
  const [health, setHealth] = useState(null)
  const [reachable, setReachable] = useState(null)
  const [lastChecked, setLastChecked] = useState(null)

  useEffect(() => {
    let mounted = true

    const check = async () => {
      try {
        const { response, data } = await fetchApiJson('/health')
        if (!mounted) return
        setReachable(response.ok)
        setHealth(response.ok ? data : null)
        setLastChecked(new Date())
      } catch (_error) {
        if (!mounted) return
        setReachable(false)
        setHealth(null)
        setLastChecked(new Date())
      }
    }

    check()
    const intervalId = setInterval(check, 10000)

    return () => {
      mounted = false
      clearInterval(intervalId)
    }
  }, [])

  const dbConnected = health?.dbConnected

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-area">
        <Topbar title="System Status" breadcrumb="Admin / System" />
        <div className="page-inner">

          <div className="sec-hd anim-1">
            <div>
              <h2>System Status</h2>
              <p>Live status of the backend server and database connection</p>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 16px', background: reachable ? 'var(--green-light)' : 'var(--red-light)', borderRadius:'var(--radius-sm)', border:`1px solid ${reachable ? '#a7f3d0' : '#fca5a5'}` }}>
              <span className={`status-dot ${reachable ? 'sd-online' : 'sd-offline'}`} />
              <span style={{ fontSize:13, fontWeight:800, color: reachable ? 'var(--green-dark)' : 'var(--red)' }}>
                {reachable === null ? 'Checking…' : reachable ? 'Backend reachable' : 'Backend unreachable'}
              </span>
            </div>
          </div>

          <div className="stats-row anim-2" style={{ gridTemplateColumns:'repeat(3,1fr)' }}>
            <div className="stat-card">
              <div className={`stat-icon ${reachable ? 'si-green' : 'si-red'}`}><i className="fas fa-server" /></div>
              <div><div className="stat-val">{reachable === null ? '—' : reachable ? 'Up' : 'Down'}</div><div className="stat-label">Backend Server</div></div>
            </div>
            <div className="stat-card">
              <div className={`stat-icon ${dbConnected ? 'si-green' : 'si-red'}`}><i className="fas fa-database" /></div>
              <div><div className="stat-val">{health ? (dbConnected ? 'Connected' : 'Disconnected') : '—'}</div><div className="stat-label">Database</div></div>
            </div>
            <div className="stat-card">
              <div className="stat-icon si-blue"><i className="fas fa-clock" /></div>
              <div><div className="stat-val">{formatUptime(health?.uptimeSeconds)}</div><div className="stat-label">Server Uptime</div></div>
            </div>
          </div>

          <div className="card anim-3" style={{ marginTop:22 }}>
            <div className="card-hd"><h3>Health Check Details</h3></div>
            <div className="card-bd">
              {[
                { lbl:'Backend reachable', val: reachable === null ? 'Checking…' : reachable ? 'Yes' : 'No' },
                { lbl:'Database connected', val: health ? (dbConnected ? 'Yes' : 'No') : '—' },
                { lbl:'Server uptime', val: formatUptime(health?.uptimeSeconds) },
                { lbl:'Last checked', val: lastChecked ? lastChecked.toLocaleTimeString() : '—' },
              ].map(r => (
                <div key={r.lbl} style={{ display:'flex', justifyContent:'space-between', padding:'9px 0', borderBottom:'1px solid #f0f4f8' }}>
                  <span style={{ fontSize:12, fontWeight:800, color:'#8a96a8', textTransform:'uppercase' }}>{r.lbl}</span>
                  <span style={{ fontWeight:700, fontSize:13 }}>{r.val}</span>
                </div>
              ))}
              <p style={{ fontSize:12, color:'#8a96a8', marginTop:14 }}>
                This checks every 10 seconds against the backend's <code>/api/health</code> endpoint.
              </p>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}