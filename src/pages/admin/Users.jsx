import React, { useState } from 'react'
import Sidebar from '../../components/Sidebar.jsx'
import Topbar  from '../../components/Topbar.jsx'
import { users as init } from '../../data/mockData.js'

export default function Users() {
  const [list,   setList]   = useState(init)
  const [q,      setQ]      = useState('')
  const [role,   setRole]   = useState('All')
  const [detail, setDetail] = useState(null)
  const [toast,  setToast]  = useState('')

  const toast$ = msg => { setToast(msg); setTimeout(() => setToast(''), 3000) }

  const toggleStatus = id => {
    setList(l => l.map(u => u.id===id ? {...u, status: u.status==='active'?'inactive':'active'} : u))
    toast$('✅ User status updated!')
  }

  const filtered = list.filter(u =>
    (u.name.toLowerCase().includes(q.toLowerCase()) || u.email.toLowerCase().includes(q.toLowerCase())) &&
    (role==='All' || u.role===role)
  )

  const roleBadge = r => r==='Admin'?'purple': r==='Futsal Owner'?'info':'success'

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-area">
        <Topbar title="User Management" breadcrumb="Admin / Users" />
        <div className="page-inner">
          {toast && <div className="alert alert-success"><i className="fas fa-check-circle" />{toast}</div>}

          <div className="sec-hd anim-1">
            <div><h2>All Users</h2><p>Manage platform users, roles, and access</p></div>
            <button className="btn btn-primary">
              <i className="fas fa-user-plus" /> Add User
            </button>
          </div>

          {/* Stats */}
          <div className="stats-row anim-2" style={{ gridTemplateColumns:'repeat(4,1fr)' }}>
            {[
              { lbl:'Total',       cls:'si-blue',   v: list.length },
              { lbl:'Active',      cls:'si-green',  v: list.filter(u=>u.status==='active').length },
              { lbl:'Inactive',    cls:'si-orange', v: list.filter(u=>u.status==='inactive').length },
              { lbl:'Owners',      cls:'si-purple', v: list.filter(u=>u.role==='Futsal Owner').length },
            ].map(s => (
              <div className="stat-card" key={s.lbl}>
                <div className={`stat-icon ${s.cls}`}><i className="fas fa-users" /></div>
                <div><div className="stat-val">{s.v}</div><div className="stat-label">{s.lbl}</div></div>
              </div>
            ))}
          </div>

          {/* Filters */}
          <div className="filter-bar anim-3">
            <div className="search-wrap" style={{ maxWidth:320 }}>
              <i className="fas fa-search" />
              <input placeholder="Search by name or email…" value={q} onChange={e => setQ(e.target.value)} />
            </div>
            <select className="form-control" style={{ width:'auto' }} value={role} onChange={e => setRole(e.target.value)}>
              <option value="All">All Roles</option>
              <option>Team User</option>
              <option>Futsal Owner</option>
              <option>Admin</option>
            </select>
            <span style={{ fontSize:12, color:'#8a96a8', fontWeight:700, marginLeft:'auto' }}>
              {filtered.length} user{filtered.length!==1?'s':''}
            </span>
          </div>

          <div className="card anim-3">
            <div className="table-wrap" style={{ border:'none', borderRadius:0 }}>
              <table>
                <thead>
                  <tr>
                    <th>#</th><th>Name</th><th>Email</th><th>Role</th>
                    <th>Team</th><th>Joined</th><th>Status</th><th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(u => (
                    <tr key={u.id}>
                      <td style={{ color:'#8a96a8', fontWeight:700 }}>#{u.id}</td>
                      <td>
                        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                          <div style={{ width:32, height:32, borderRadius:'50%', background:'var(--green-light)', color:'var(--green-dark)', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:800, fontSize:13 }}>
                            {u.name[0]}
                          </div>
                          <span style={{ fontWeight:700 }}>{u.name}</span>
                        </div>
                      </td>
                      <td style={{ fontSize:13, color:'#4a5568' }}>{u.email}</td>
                      <td><span className={`badge badge-${roleBadge(u.role)}`}>{u.role}</span></td>
                      <td style={{ fontSize:13 }}>{u.team}</td>
                      <td style={{ fontSize:12, color:'#8a96a8' }}>{u.joined}</td>
                      <td>
                        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                          <span className={`status-dot ${u.status==='active'?'sd-online':'sd-offline'}`} />
                          <span style={{ fontSize:12, fontWeight:700, color: u.status==='active'?'var(--green)':'#8a96a8' }}>
                            {u.status}
                          </span>
                        </div>
                      </td>
                      <td>
                        <div style={{ display:'flex', gap:6 }}>
                          <button className="btn btn-ghost btn-sm" onClick={() => setDetail(u)}>
                            <i className="fas fa-eye" />
                          </button>
                          <button
                            className={`btn btn-sm ${u.status==='active'?'btn-outline':'btn-primary'}`}
                            onClick={() => toggleStatus(u.id)}
                          >
                            {u.status==='active' ? 'Deactivate' : 'Activate'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {detail && (
        <div className="modal-overlay" onClick={() => setDetail(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="modal-hd">
              <h3><i className="fas fa-user" style={{ color:'var(--green)', marginRight:8 }} />User Details</h3>
              <button className="modal-close" onClick={() => setDetail(null)}><i className="fas fa-xmark" /></button>
            </div>
            <div style={{ textAlign:'center', marginBottom:20 }}>
              <div style={{ width:64, height:64, borderRadius:'50%', background:'var(--green-light)', color:'var(--green-dark)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:28, fontWeight:900, margin:'0 auto 10px' }}>
                {detail.name[0]}
              </div>
              <div style={{ fontFamily:'Barlow Condensed,sans-serif', fontSize:20, fontWeight:900 }}>{detail.name}</div>
              <div style={{ fontSize:13, color:'#8a96a8' }}>{detail.email}</div>
              <span className={`badge badge-${roleBadge(detail.role)}`} style={{ marginTop:8 }}>{detail.role}</span>
            </div>
            {[
              { lbl:'Team',   val: detail.team,   icon:'fa-users' },
              { lbl:'Joined', val: detail.joined, icon:'fa-calendar' },
              { lbl:'Status', val: detail.status, icon:'fa-circle-dot' },
            ].map(r => (
              <div key={r.lbl} style={{ display:'flex', justifyContent:'space-between', padding:'9px 0', borderBottom:'1px solid #f0f4f8' }}>
                <span style={{ fontSize:12, fontWeight:800, color:'#8a96a8', textTransform:'uppercase', display:'flex', alignItems:'center', gap:7 }}>
                  <i className={`fas ${r.icon}`} style={{ color:'var(--green)', width:14 }} />{r.lbl}
                </span>
                <span style={{ fontWeight:700, fontSize:13 }}>{r.val}</span>
              </div>
            ))}
            <div style={{ display:'flex', gap:10, marginTop:20 }}>
              <button className={`btn ${detail.status==='active'?'btn-danger':'btn-primary'}`} style={{ flex:1 }}
                onClick={() => { toggleStatus(detail.id); setDetail(prev => ({...prev, status: prev.status==='active'?'inactive':'active'})) }}>
                {detail.status==='active' ? 'Deactivate User' : 'Activate User'}
              </button>
              <button className="btn btn-outline" onClick={() => setDetail(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
