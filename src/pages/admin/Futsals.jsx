import React, { useEffect, useState } from 'react'
import Sidebar from '../../components/Sidebar.jsx'
import Topbar  from '../../components/Topbar.jsx'
import { fetchApiJson } from '../../utils/apiClient.js'

const mapVenue = (venue) => ({
  id: venue._id || venue.id,
  name: venue.name,
  owner: venue.owner || 'Unknown',
  location: venue.location,
  courts: venue.courts || 1,
  status: venue.status || 'pending',
  joined: (venue.createdAt || new Date().toISOString()).split('T')[0],
  bookings: venue.bookings || 0,
})

export default function Futsals() {
  const [list,        setList]        = useState([])
  const [loading,     setLoading]     = useState(true)
  const [ownerOptions, setOwnerOptions] = useState([])
  const [modal,       setModal]       = useState(false)
  const [detail,      setDetail]      = useState(null)
  const [toast,       setToast]       = useState('')
  const [form,        setForm]        = useState({ name:'', owner:'', location:'', courts:'1' })

  const toast$ = msg => { setToast(msg); setTimeout(() => setToast(''), 3000) }

  useEffect(() => {
    let mounted = true

    const loadVenues = async () => {
      try {
        const { response, data } = await fetchApiJson('/venues')
        if (mounted && response.ok && Array.isArray(data)) {
          setList(data.map(mapVenue))
        }
      } catch (_error) {
        // Leave list as-is if the fetch fails momentarily.
      } finally {
        if (mounted) setLoading(false)
      }
    }

    const loadOwners = async () => {
      try {
        const { response, data } = await fetchApiJson('/users?role=owner')
        if (mounted && response.ok && Array.isArray(data)) {
          setOwnerOptions(data.map(u => ({ id: u._id, name: u.name, email: u.email })))
        }
      } catch (_error) {
        // Owner dropdown just stays empty if this fails.
      }
    }

    loadVenues()
    loadOwners()
    const intervalId = setInterval(loadVenues, 5000)

    return () => {
      mounted = false
      clearInterval(intervalId)
    }
  }, [])

  const approve = async (id) => {
    setList(l => l.map(p => p.id === id ? { ...p, status: 'approved' } : p))
    try {
      await fetchApiJson(`/venues/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'approved' }),
      })
      toast$('✅ Partner approved!')
    } catch (_error) {
      toast$('Unable to approve right now. Please check your connection.')
    }
  }

  const remove = async (id) => {
    const confirmed = window.confirm('Delete this futsal partner?')
    if (!confirmed) return

    setList(prev => prev.filter(item => item.id !== id))
    try {
      await fetchApiJson(`/venues/${id}`, { method: 'DELETE' })
      toast$('🗑️ Partner removed!')
    } catch (_error) {
      toast$('Unable to remove right now. Please check your connection.')
    }
  }

  const add = async () => {
    if (!form.name || !form.owner || !form.location) return

    const ownerObj = ownerOptions.find(o => o.name === form.owner) || {}

    try {
      const { response, data } = await fetchApiJson('/venues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          location: form.location,
          rating: 4.5,
          price: 'Rs. 1,200/hr',
          type: 'Indoor',
          courts: Number(form.courts) || 1,
          pricePerHour: 1200,
          owner: ownerObj.name || form.owner,
          ownerEmail: ownerObj.email || '',
        }),
      })

      if (response.ok && data?.venue) {
        setList(prev => [...prev, mapVenue(data.venue)])
        setModal(false)
        setForm({ name:'', owner:'', location:'', courts:'1' })
        toast$('✅ New partner added!')
      } else {
        toast$(data?.message || 'Unable to add that partner right now.')
      }
    } catch (_error) {
      toast$('Unable to add that partner right now. Please check your connection.')
    }
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
              { lbl:'Total Partners', v: list.length },
              { lbl:'Approved',       v: list.filter(p => p.status === 'approved').length },
              { lbl:'Pending Review', v: list.filter(p => p.status === 'pending').length },
            ].map(s => (
              <div className="stat-card" key={s.lbl}>
                <div className="stat-icon si-blue"><i className="fas fa-building" /></div>
                <div><div className="stat-val">{loading ? '—' : s.v}</div><div className="stat-label">{s.lbl}</div></div>
              </div>
            ))}
          </div>

          {/* Cards */}
          {list.length === 0 ? (
            <div className="empty-state">
              <i className="fas fa-building" />
              <h3>{loading ? 'Loading venues…' : 'No futsal partners yet'}</h3>
            </div>
          ) : (
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(290px,1fr))', gap:18 }} className="anim-3">
              {list.map((p, i) => (
                <div key={p.id} className="card">
                  <div style={{ padding:'20px 20px 14px', borderBottom:'1px solid var(--border)' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:12 }}>
                      <div style={{ width:48, height:48, borderRadius:13, background: p.status === 'approved' ? 'var(--green-light)' : 'var(--yellow-light)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:22 }}>
                        🏟️
                      </div>
                      <span className={`badge badge-${p.status === 'approved' ? 'success' : 'warning'}`}>{p.status}</span>
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
                    {p.status === 'pending' && (
                      <button className="btn btn-primary btn-sm" style={{ flex:1 }} onClick={() => approve(p.id)}>
                        <i className="fas fa-check" /> Approve
                      </button>
                    )}
                    <button className="btn btn-outline btn-sm" onClick={() => remove(p.id)}>
                      <i className="fas fa-trash" /> Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
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
              { lbl:'Location',   key:'location', type:'text',   ph:'e.g. Thamel, Kathmandu' },
              { lbl:'Courts',     key:'courts',   type:'number', ph:'1' },
            ].map(f => (
              <div className="form-group" key={f.key}>
                <label className="form-label">{f.lbl}</label>
                <input type={f.type} className="form-control" placeholder={f.ph}
                  value={form[f.key]} onChange={e => setForm({...form,[f.key]:e.target.value})} />
              </div>
            ))}

            <div className="form-group">
              <label className="form-label">Owner Name</label>
              <select className="form-control" value={form.owner} onChange={e => setForm({...form, owner:e.target.value})}>
                <option value="">-- Select owner --</option>
                {ownerOptions.map(o => (
                  <option key={o.id} value={o.name}>{o.name} {o.email ? `(${o.email})` : ''}</option>
                ))}
              </select>
            </div>
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
              {detail.status === 'pending' && (
                <button className="btn btn-primary" style={{ flex:1 }} onClick={() => { approve(detail.id); setDetail(null) }}>
                  <i className="fas fa-check" /> Approve Partner
                </button>
              )}
              <button className="btn btn-outline" style={{ flex:1 }} onClick={() => { remove(detail.id); setDetail(null) }}>
                <i className="fas fa-trash" /> Delete Partner
              </button>
              <button className="btn btn-outline" onClick={() => setDetail(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}