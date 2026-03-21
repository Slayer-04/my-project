import React, { useState } from 'react'
import Sidebar from '../../components/Sidebar.jsx'
import Topbar  from '../../components/Topbar.jsx'
import { venues } from '../../data/mockData.js'

export default function BookFutsal() {
  const [q,    setQ]   = useState('')
  const [type, setType]= useState('All')
  const [toast,setToast]= useState('')

  const toast$ = msg => { setToast(msg); setTimeout(() => setToast(''), 3000) }

  const book = (venue, slot) => toast$(`✅ Slot ${slot} at ${venue} booked successfully!`)

  const filtered = venues.filter(v =>
    v.name.toLowerCase().includes(q.toLowerCase()) &&
    (type==='All' || v.type===type)
  )

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-area">
        <Topbar title="Book Futsal" breadcrumb="Team / Book Futsal" />
        <div className="page-inner">
          {toast && <div className="alert alert-success"><i className="fas fa-check-circle" />{toast}</div>}

          <div className="sec-hd anim-1">
            <div><h2>Futsal Venues</h2><p>Browse courts and book your preferred time slot</p></div>
          </div>

          <div className="filter-bar anim-2">
            <div className="search-wrap" style={{ maxWidth:320 }}>
              <i className="fas fa-search" />
              <input placeholder="Search venues…" value={q} onChange={e => setQ(e.target.value)} />
            </div>
            <select className="form-control" style={{ width:'auto' }} value={type} onChange={e => setType(e.target.value)}>
              <option value="All">All Types</option>
              <option>Indoor</option>
              <option>Outdoor</option>
            </select>
          </div>

          <div className="venue-grid">
            {filtered.map((v, i) => (
              <div key={v.id} className={`venue-card anim-${Math.min(i+1,5)}`}>
                <div className="vc-img">
                  {v.emoji}
                  <span className="vc-type-tag">{v.type}</span>
                </div>
                <div className="vc-body">
                  <h3>{v.name}</h3>
                  <div className="vc-loc"><i className="fas fa-location-dot" />{v.location}</div>

                  <div style={{ display:'flex', gap:16, marginBottom:12 }}>
                    <div style={{ fontSize:13, fontWeight:700 }}>
                      <i className="fas fa-star" style={{ color:'#eab308', marginRight:4 }} />{v.rating}
                    </div>
                    <div style={{ fontSize:13, fontWeight:800, color:'var(--green)' }}>
                      <i className="fas fa-tag" style={{ marginRight:4 }} />{v.price}
                    </div>
                  </div>

                  <div style={{ fontSize:11, fontWeight:800, color:'#8a96a8', textTransform:'uppercase', letterSpacing:.5, marginBottom:8 }}>
                    Available Slots
                  </div>
                  <div className="slots-wrap">
                    {v.slots.map((s, j) => (
                      <span
                        key={j}
                        className={`slot-pill ${s.status}`}
                        onClick={() => s.status==='available' && book(v.name, s.time)}
                      >
                        {s.time}
                      </span>
                    ))}
                  </div>

                  <button className="btn btn-primary btn-full btn-sm" style={{ marginTop:8 }}
                    onClick={() => {
                      const avail = v.slots.find(s => s.status==='available')
                      avail ? book(v.name, avail.time) : toast$('No available slots at this venue.')
                    }}>
                    <i className="fas fa-calendar-check" /> Book a Slot
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
