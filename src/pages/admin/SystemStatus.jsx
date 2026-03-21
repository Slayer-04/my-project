import React, { useState, useEffect } from 'react'
import Sidebar from '../../components/Sidebar.jsx'
import Topbar  from '../../components/Topbar.jsx'

const SERVICES = [
  { name:'API Gateway',        status:'online',  uptime:'99.98%', latency:'12ms',  region:'Asia-Pacific' },
  { name:'Auth Service',       status:'online',  uptime:'99.95%', latency:'8ms',   region:'Asia-Pacific' },
  { name:'Booking Engine',     status:'online',  uptime:'99.91%', latency:'24ms',  region:'Asia-Pacific' },
  { name:'Notification Queue', status:'warning', uptime:'98.72%', latency:'156ms', region:'Asia-Pacific' },
  { name:'Media Storage',      status:'online',  uptime:'99.99%', latency:'5ms',   region:'Global CDN' },
  { name:'Search Index',       status:'online',  uptime:'99.87%', latency:'18ms',  region:'Asia-Pacific' },
  { name:'Payment Gateway',    status:'offline', uptime:'95.10%', latency:'—',     region:'External' },
  { name:'SMS Service',        status:'online',  uptime:'99.60%', latency:'340ms', region:'External' },
]

const HEALTH = [
  { lbl:'CPU Usage',     pct:34,  cls:'hf-green',  c:'var(--green)' },
  { lbl:'Memory Usage',  pct:58,  cls:'hf-blue',   c:'var(--blue)' },
  { lbl:'Disk I/O',      pct:22,  cls:'hf-green',  c:'var(--green)' },
  { lbl:'Network Load',  pct:71,  cls:'hf-orange', c:'var(--orange)' },
  { lbl:'DB Connections',pct:45,  cls:'hf-blue',   c:'var(--blue)' },
]

export default function SystemStatus() {
  const [tick, setTick] = useState(0)
  const [latencies, setLatencies] = useState(SERVICES.map(s => s.latency))

  // Simulate live latency jitter
  useEffect(() => {
    const id = setInterval(() => {
      setTick(t => t+1)
      setLatencies(SERVICES.map((s, i) => {
        if (s.status==='offline') return '—'
        const base = parseInt(s.latency) || 10
        const jitter = Math.round((Math.random() - 0.5) * base * 0.3)
        return `${base + jitter}ms`
      }))
    }, 2500)
    return () => clearInterval(id)
  }, [])

  const online  = SERVICES.filter(s => s.status==='online').length
  const warning = SERVICES.filter(s => s.status==='warning').length
  const offline = SERVICES.filter(s => s.status==='offline').length

  const statusDot  = s => s==='online'?'sd-online': s==='warning'?'sd-warn':'sd-offline'
  const statusBadge= s => s==='online'?'success':   s==='warning'?'warning':'danger'

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-area">
        <Topbar title="System Status" breadcrumb="Admin / System" />
        <div className="page-inner">

          <div className="sec-hd anim-1">
            <div>
              <h2>System Health</h2>
              <p>Real-time service monitoring and infrastructure metrics</p>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 16px', background: offline>0?'var(--red-light)':'var(--green-light)', borderRadius:'var(--radius-sm)', border:`1px solid ${offline>0?'#fca5a5':'#a7f3d0'}` }}>
              <span className={`status-dot ${offline>0?'sd-warn':'sd-online'}`} />
              <span style={{ fontSize:13, fontWeight:800, color: offline>0?'var(--red)':'var(--green-dark)' }}>
                {offline>0 ? `${offline} service${offline>1?'s':''} down` : 'All systems go'}
              </span>
            </div>
          </div>

          {/* Summary */}
          <div className="stats-row anim-2" style={{ gridTemplateColumns:'repeat(4,1fr)' }}>
            {[
              { lbl:'Total Services', cls:'si-blue',   v: SERVICES.length, icon:'fa-server' },
              { lbl:'Online',         cls:'si-green',  v: online,           icon:'fa-circle-check' },
              { lbl:'Warning',        cls:'si-orange', v: warning,          icon:'fa-triangle-exclamation' },
              { lbl:'Offline',        cls:'si-red',    v: offline,          icon:'fa-circle-xmark' },
            ].map(s => (
              <div className="stat-card" key={s.lbl}>
                <div className={`stat-icon ${s.cls}`}><i className={`fas ${s.icon}`} /></div>
                <div><div className="stat-val">{s.v}</div><div className="stat-label">{s.lbl}</div></div>
              </div>
            ))}
          </div>

          <div className="two-col anim-3">
            {/* Services table */}
            <div className="card">
              <div className="card-hd">
                <h3>Service Registry</h3>
                <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:12, color:'#8a96a8', fontWeight:700 }}>
                  <span className="status-dot sd-online" /> Live
                </div>
              </div>
              <div className="table-wrap" style={{ border:'none', borderRadius:0 }}>
                <table>
                  <thead>
                    <tr><th>Service</th><th>Status</th><th>Latency</th><th>Uptime</th></tr>
                  </thead>
                  <tbody>
                    {SERVICES.map((s, i) => (
                      <tr key={s.name}>
                        <td>
                          <div style={{ fontWeight:700, fontSize:13 }}>{s.name}</div>
                          <div style={{ fontSize:11, color:'#8a96a8' }}>{s.region}</div>
                        </td>
                        <td>
                          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                            <span className={`status-dot ${statusDot(s.status)}`} />
                            <span className={`badge badge-${statusBadge(s.status)}`}>{s.status}</span>
                          </div>
                        </td>
                        <td style={{ fontFamily:'monospace', fontSize:13, fontWeight:700, color: s.status==='offline'?'#8a96a8': parseInt(latencies[i])>100?'var(--orange)':'var(--green-dark)' }}>
                          {latencies[i]}
                        </td>
                        <td style={{ fontSize:13, fontWeight:700, color: parseFloat(s.uptime)<99?'var(--orange)':'var(--green-dark)' }}>
                          {s.uptime}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Server health */}
            <div style={{ display:'flex', flexDirection:'column', gap:18 }}>
              <div className="card">
                <div className="card-hd"><h3>Server Resources</h3></div>
                <div className="card-bd">
                  {HEALTH.map(h => (
                    <div className="health-row" key={h.lbl}>
                      <div className="health-lbl">
                        <span>{h.lbl}</span>
                        <span style={{ color:h.c }}>{h.pct}%</span>
                      </div>
                      <div className="health-track">
                        <div className={`health-fill ${h.cls}`} style={{ width:`${h.pct}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="card">
                <div className="card-hd"><h3>Platform Info</h3></div>
                <div className="card-bd">
                  {[
                    { lbl:'Version',       val:'v2.4.1',             icon:'fa-code-branch' },
                    { lbl:'Environment',   val:'Production',         icon:'fa-server' },
                    { lbl:'Last Deploy',   val:'Mar 13, 2025 · 02:14', icon:'fa-rocket' },
                    { lbl:'Node Version',  val:'v20.11.0',            icon:'fa-node-js',  fab:true },
                    { lbl:'Database',      val:'PostgreSQL 16.1',     icon:'fa-database' },
                    { lbl:'Cache',         val:'Redis 7.2',           icon:'fa-bolt' },
                  ].map(r => (
                    <div key={r.lbl} style={{ display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid #f0f4f8' }}>
                      <span style={{ fontSize:11, color:'#8a96a8', fontWeight:700, textTransform:'uppercase', display:'flex', alignItems:'center', gap:6 }}>
                        <i className={`${r.fab?'fab':'fas'} ${r.icon}`} style={{ color:'var(--blue)', width:13 }} />
                        {r.lbl}
                      </span>
                      <span style={{ fontFamily:'monospace', fontSize:12, fontWeight:700 }}>{r.val}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Incident log */}
          <div className="card anim-4" style={{ marginTop:22 }}>
            <div className="card-hd"><h3>Incident History (Last 30 Days)</h3></div>
            <div className="card-bd" style={{ paddingTop:8 }}>
              {[
                { date:'Mar 12, 2025', svc:'Payment Gateway', dur:'4h 22m', severity:'high',   desc:'External payment provider outage. Resolved by switching to backup.' },
                { date:'Mar 8, 2025',  svc:'Notification Queue', dur:'18m', severity:'medium', desc:'Message queue backlog due to spike in booking confirmations.' },
                { date:'Mar 2, 2025',  svc:'Auth Service',    dur:'3m',    severity:'low',    desc:'Temporary latency increase during scheduled database maintenance.' },
              ].map((inc, i) => (
                <div key={i} style={{ padding:'14px 0', borderBottom:'1px solid #f0f4f8', display:'flex', gap:16 }}>
                  <div style={{ width:10, height:10, borderRadius:'50%', background: inc.severity==='high'?'var(--red)': inc.severity==='medium'?'var(--orange)':'var(--yellow)', marginTop:5, flexShrink:0 }} />
                  <div style={{ flex:1 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', flexWrap:'wrap', gap:8 }}>
                      <div style={{ fontWeight:700, fontSize:13 }}>{inc.svc}</div>
                      <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                        <span className={`badge badge-${inc.severity==='high'?'danger': inc.severity==='medium'?'warning':'info'}`}>{inc.severity}</span>
                        <span style={{ fontSize:12, color:'#8a96a8' }}>Duration: {inc.dur}</span>
                      </div>
                    </div>
                    <div style={{ fontSize:12, color:'#4a5568', marginTop:4 }}>{inc.desc}</div>
                    <div style={{ fontSize:11, color:'#8a96a8', marginTop:3 }}>{inc.date}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
