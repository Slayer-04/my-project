import React, { useState } from 'react'
import Sidebar from '../../components/Sidebar.jsx'
import Topbar  from '../../components/Topbar.jsx'
import { useAuth } from '../../App.jsx'
import { bookings } from '../../data/mockData.js'

export default function OwnerProfile() {
  const { user } = useAuth()
  const [editing, setEditing] = useState(false)
  const [info, setInfo] = useState({
    venueName: 'Arena Futsal Park',
    location:  'Baneshwor, Kathmandu',
    courts:    '2',
    phone:     '+977-9801234567',
    hours:     '6:00 AM – 10:00 PM',
  })
  const [toast, setToast] = useState('')

  const save = () => { setEditing(false); setToast('✅ Profile saved!'); setTimeout(() => setToast(''), 3000) }

  const totalRev = bookings.filter(b => b.status==='confirmed')
    .reduce((acc, b) => acc + parseInt(b.amount.replace(/[^0-9]/g, '')), 0)

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-area">
        <Topbar title="Profile" breadcrumb="Owner / Profile" />
        <div className="page-inner">
          {toast && <div className="alert alert-success"><i className="fas fa-check-circle" />{toast}</div>}

          {/* Hero */}
          <div className="profile-hero anim-1" style={{ background:'linear-gradient(130deg, #1a6fe8 0%, #006b3c 100%)' }}>
            <div className="ph-avatar">🏟️</div>
            <div style={{ flex:1 }}>
              <div className="ph-name">{info.venueName}</div>
              <div className="ph-sub"><i className="fas fa-location-dot" style={{ marginRight:5 }} />{info.location}</div>
              <div className="ph-tags">
                <span className="ph-tag">{info.courts} Courts</span>
                <span className="ph-tag">{info.hours}</span>
                <span className="ph-tag">Verified Partner</span>
              </div>
            </div>
            <div className="ph-actions">
              <button
                className="btn"
                style={{ background:'rgba(255,255,255,.15)', border:'1.5px solid rgba(255,255,255,.4)', color:'#fff', fontWeight:700 }}
                onClick={() => setEditing(e => !e)}
              >
                <i className={`fas fa-${editing?'xmark':'pen'}`} />{editing ? 'Cancel' : 'Edit'}
              </button>
            </div>
          </div>

          <div className="two-col anim-2">
            {/* Info / Edit */}
            <div className="card">
              <div className="card-hd"><h3>{editing ? 'Edit Venue Info' : 'Venue Information'}</h3></div>
              <div className="card-bd">
                {editing ? (
                  <>
                    {[
                      { lbl:'Venue Name',   key:'venueName', type:'text' },
                      { lbl:'Location',     key:'location',  type:'text' },
                      { lbl:'Courts',       key:'courts',    type:'number' },
                      { lbl:'Phone',        key:'phone',     type:'text' },
                      { lbl:'Operating Hours', key:'hours',  type:'text' },
                    ].map(f => (
                      <div className="form-group" key={f.key}>
                        <label className="form-label">{f.lbl}</label>
                        <input
                          type={f.type} className="form-control"
                          value={info[f.key]}
                          onChange={e => setInfo({...info, [f.key]: e.target.value})}
                        />
                      </div>
                    ))}
                    <button className="btn btn-primary btn-full" onClick={save}>
                      <i className="fas fa-floppy-disk" /> Save Changes
                    </button>
                  </>
                ) : (
                  <>
                    {[
                      { lbl:'Venue Name',   val: info.venueName,  icon:'fa-building' },
                      { lbl:'Location',     val: info.location,   icon:'fa-location-dot' },
                      { lbl:'Courts',       val: info.courts,     icon:'fa-table-tennis-paddle-ball' },
                      { lbl:'Phone',        val: info.phone,      icon:'fa-phone' },
                      { lbl:'Hours',        val: info.hours,      icon:'fa-clock' },
                      { lbl:'Owner',        val: user?.name,      icon:'fa-user-tie' },
                    ].map(item => (
                      <div key={item.lbl} style={{ display:'flex', justifyContent:'space-between', padding:'10px 0', borderBottom:'1px solid #f0f4f8' }}>
                        <span style={{ fontSize:12, color:'#8a96a8', display:'flex', alignItems:'center', gap:7, fontWeight:700, textTransform:'uppercase', letterSpacing:.3 }}>
                          <i className={`fas ${item.icon}`} style={{ width:14, color:'var(--blue)' }} />{item.lbl}
                        </span>
                        <span style={{ fontSize:13, fontWeight:700 }}>{item.val}</span>
                      </div>
                    ))}
                  </>
                )}
              </div>
            </div>

            {/* Stats */}
            <div className="card">
              <div className="card-hd"><h3>Performance Stats</h3></div>
              <div className="card-bd">
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:20 }}>
                  {[
                    { lbl:'Total Bookings', val: bookings.length,  bg:'#e8f0fd', c:'var(--blue)' },
                    { lbl:'Confirmed',      val: bookings.filter(b=>b.status==='confirmed').length, bg:'#e6faf2', c:'var(--green)' },
                    { lbl:'Pending',        val: bookings.filter(b=>b.status==='pending').length,   bg:'#fefce8', c:'#ca8a04' },
                    { lbl:'Cancelled',      val: bookings.filter(b=>b.status==='cancelled').length, bg:'#fff5f5', c:'var(--red)' },
                  ].map(s => (
                    <div key={s.lbl} style={{ textAlign:'center', padding:'14px 8px', background:s.bg, borderRadius:12 }}>
                      <div style={{ fontFamily:'Barlow Condensed,sans-serif', fontSize:26, fontWeight:900, color:s.c, lineHeight:1 }}>{s.val}</div>
                      <div style={{ fontSize:11, fontWeight:800, color:s.c, marginTop:4, textTransform:'uppercase' }}>{s.lbl}</div>
                    </div>
                  ))}
                </div>

                <div style={{ padding:16, background:'linear-gradient(130deg, var(--green-light), var(--blue-light))', borderRadius:12 }}>
                  <div style={{ fontSize:12, color:'#4a5568', fontWeight:800, textTransform:'uppercase', marginBottom:4 }}>Total Revenue</div>
                  <div style={{ fontFamily:'Barlow Condensed,sans-serif', fontSize:30, fontWeight:900, color:'var(--green-dark)' }}>
                    Rs. {totalRev.toLocaleString()}
                  </div>
                  <div style={{ fontSize:12, color:'#4a5568', marginTop:4 }}>From confirmed bookings</div>
                </div>

                <div style={{ marginTop:16 }}>
                  {[
                    { lbl:'Court Utilisation', pct:72, cls:'hf-green' },
                    { lbl:'Customer Satisfaction', pct:88, cls:'hf-blue' },
                  ].map(h => (
                    <div className="health-row" key={h.lbl}>
                      <div className="health-lbl"><span>{h.lbl}</span><span>{h.pct}%</span></div>
                      <div className="health-track"><div className={`health-fill ${h.cls}`} style={{ width:`${h.pct}%` }} /></div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
