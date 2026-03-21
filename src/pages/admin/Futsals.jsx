import React, { useState } from 'react'
import Sidebar from '../../components/Sidebar.jsx'
import Topbar  from '../../components/Topbar.jsx'
import { futsalPartners as init } from '../../data/mockData.js'

export default function Futsals() {
  const [list,   setList]   = useState(init)
  const [modal,  setModal]  = useState(false)
  const [detail, setDetail] = useState(null)
  const [toast,  setToast]  = useState('')
  const [form,   setForm]   = useState({ name:'', owner:'', location:'', courts:'1' })

  const toast$ = msg => { setToast(msg); setTimeout(() => setToast(''), 3000) }

  const approve = id => {
    setList(l => l.map(p => p.id===id ? {...p, status:'approved'} : p))
    toast$('✅ Partner approved!')
  }

  const add = () => {
    if (!form.name || !form.owner || !form.location) return
    setList(prev => [...prev, { id:prev.length+1, ...form, courts:+form.courts, status:'pending', joined: new Date().toISOString().split('T')[0], bookings:0 }])
    setModal(false); setForm({ name:'', owner:'', location:'', courts:'1' })
    toast$('✅ New partner added!')
  }

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-area">
        <Topbar title="Futsal Partners" breadcrumb="Admin / Futsals" />
        <div className="page-inner">
          {toast && <div className="alert alert-success"><i className="fas fa-check-circle" />{toast}</div>}

          <div className="sec-hd anim-1">
            <div><h2>Futsal Partner Management</h2><p>Review, approve and manage venue partnerships</p></div>
            <button className="btn btn-primary" onClick={() => setModal(true)}>
              <i className="fas fa-plus" /> Add Partner
            </button>
          </div>

          {/* Stats */}
          <div className="stats-row anim-2" style={{ gridTemplateColumns:'repeat(3,1fr)' }}>
            {[
              { lbl:'Total Partners', cls:'si-blue',   v: list.length },
              { lbl:'Approved',       cls:'si-green',  v: list.filter(p=>p.status==='approved').length },
              { lbl:'Pending Review', cls:'si-orange', v: list.filter(p=>p.status==='pending').length },
            ].map(s => (
              <div className="stat-card" key={s.lbl}>
                <div className={`stat-icon ${s.cls}`}><i className="fas fa-building" /></div>
                <div><div className="stat-val">{s.v}</div><div className="stat-label">{s.lbl}</div></div>
              </div>
            ))}
          </div>

          {/* Cards */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(290px,1fr))', gap:18 }} className="anim-3">
            {list.map((p, i) => (
              <div key={p.id} className="card" style={{ transition:'var(--transition)' }}
                onMouseEnter={e => e.currentTarget.style.boxShadow='var(--shadow-md)'}
                onMouseLeave={e => e.currentTarget.style.boxShadow=''}>
                <div style={{ padding:'20px 20px 14px', borderBottom:'1px solid var(--border)' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:12 }}>
                    <div style={{ width:48, height:48, borderRadius:13, background: p.status==='approved'?'var(--green-light)':'var(--yellow-light)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:22 }}>
                      🏟️
                    </div>
                    <span className={`badge badge-${p.status==='approved'?'success':'warning'}`}>{p.status}</span>
                  </div>
                  <div style={{ fontFamily:'Barlow Condensed,sans-serif', fontWeight:900, fontSize:17 }}>{p.name}</div>
                  <div style={{ fontSize:12, color:'#8a96a8', marginTop:4, display:'flex', alignItems:'center', gap:5 }}>
                    <i className="fas fa-location-dot" style={{ color:'var(--green)' }} />{p.location}
                  </div>
                </div>
                <div style={{ padding:'12px 20px' }}>
                  {[
                    { lbl:'Owner',    val: p.owner,    icon:'fa-user-tie' },
                    { lbl:'Courts',   val: p.courts,   icon:'fa-table-tennis-paddle-ball' },
                    { lbl:'Bookings', val: p.bookings, icon:'fa-clipboard-list' },
                    { lbl:'Since',    val: p.joined,   icon:'fa-calendar' },
                  ].map(r => (
                    <div key={r.lbl} style={{ display:'flex', justifyContent:'space-between', padding:'7px 0', borderBottom:'1px solid #f8fafc' }}>
                      <span style={{ fontSize:11, color:'#8a96a8', fontWeight:700, textTransform:'uppercase', display:'flex', alignItems:'center', gap:6 }}>
                        <i className={`fas ${r.icon}`} style={{ color:'var(--blue)', width:12 }} />{r.lbl}
                      </span>
                      <span style={{ fontSize:13, fontWeight:700 }}>{r.val}</span>
                    </div>
                  ))}
                </div>
                <div style={{ padding:'12px 20px', borderTop:'1px solid var(--border)', display:'flex', gap:8 }}>
                  <button className="btn btn-ghost btn-sm" onClick={() => setDetail(p)} style={{ flex:1 }}>
                    <i className="fas fa-eye" /> Details
                  </button>
                  {p.status==='pending' && (
                    <button className="btn btn-primary btn-sm" style={{ flex:1 }} onClick={() => approve(p.id)}>
                      <i className="fas fa-check" /> Approve
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Add Modal */}
      {modal && (
        <div className="modal-overlay" onClick={() => setModal(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="modal-hd">
              <h3><i className="fas fa-building" style={{ color:'var(--green)', marginRight:8 }} />Add Futsal Partner</h3>
              <button className="modal-close" onClick={() => setModal(false)}><i className="fas fa-xmark" /></button>
            </div>
            {[
              { lbl:'Venue Name', key:'name',     type:'text',   ph:'e.g. Star Futsal Arena' },
              { lbl:'Owner Name', key:'owner',    type:'text',   ph:'Owner full name' },
              { lbl:'Location',   key:'location', type:'text',   ph:'e.g. Thamel, Kathmandu' },
              { lbl:'Courts',     key:'courts',   type:'number', ph:'1' },
            ].map(f => (
              <div className="form-group" key={f.key}>
                <label className="form-label">{f.lbl}</label>
                <input type={f.type} className="form-control" placeholder={f.ph}
                  value={form[f.key]} onChange={e => setForm({...form,[f.key]:e.target.value})} />
              </div>
            ))}
            <div style={{ display:'flex', gap:10, marginTop:8 }}>
              <button className="btn btn-primary" style={{ flex:1 }} onClick={add}>
                <i className="fas fa-plus" /> Add Partner
              </button>
              <button className="btn btn-outline" onClick={() => setModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {detail && (
        <div className="modal-overlay" onClick={() => setDetail(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="modal-hd">
              <h3>🏟️ {detail.name}</h3>
              <button className="modal-close" onClick={() => setDetail(null)}><i className="fas fa-xmark" /></button>
            </div>
            {[
              { lbl:'Owner',    val: detail.owner,    icon:'fa-user-tie' },
              { lbl:'Location', val: detail.location, icon:'fa-location-dot' },
              { lbl:'Courts',   val: detail.courts,   icon:'fa-table-tennis-paddle-ball' },
              { lbl:'Bookings', val: detail.bookings, icon:'fa-clipboard-list' },
              { lbl:'Joined',   val: detail.joined,   icon:'fa-calendar' },
              { lbl:'Status',   val: detail.status,   icon:'fa-circle-dot' },
            ].map(r => (
              <div key={r.lbl} style={{ display:'flex', justifyContent:'space-between', padding:'10px 0', borderBottom:'1px solid #f0f4f8' }}>
                <span style={{ fontSize:12, fontWeight:800, color:'#8a96a8', textTransform:'uppercase', display:'flex', alignItems:'center', gap:7 }}>
                  <i className={`fas ${r.icon}`} style={{ color:'var(--blue)', width:14 }} />{r.lbl}
                </span>
                <span style={{ fontWeight:700, fontSize:13 }}>{r.val}</span>
              </div>
            ))}
            <div style={{ display:'flex', gap:10, marginTop:20 }}>
              {detail.status==='pending' && (
                <button className="btn btn-primary" style={{ flex:1 }} onClick={() => { approve(detail.id); setDetail(null) }}>
                  <i className="fas fa-check" /> Approve Partner
                </button>
              )}
              <button className="btn btn-outline" onClick={() => setDetail(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
