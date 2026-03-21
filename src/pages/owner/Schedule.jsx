import React, { useState } from 'react'
import Sidebar from '../../components/Sidebar.jsx'
import Topbar  from '../../components/Topbar.jsx'
import { scheduleData as init } from '../../data/mockData.js'

export default function Schedule() {
  const [sched, setSched] = useState(init)
  const [toast, setToast] = useState('')
  const [modal, setModal] = useState(false)
  const [nSlot, setNSlot] = useState({ day:0, time:'' })

  const toast$ = msg => { setToast(msg); setTimeout(() => setToast(''), 3000) }

  const cycle = (di, si) => {
    const map = { available:'blocked', blocked:'available', booked:'booked' }
    setSched(prev => prev.map((d, i) => i!==di ? d : {
      ...d,
      slots: d.slots.map((s, j) => j!==si ? s : { ...s, status: map[s.status]||'available' })
    }))
  }

  const addSlot = () => {
    if (!nSlot.time) return
    setSched(prev => prev.map((d, i) => i!==nSlot.day ? d : { ...d, slots:[...d.slots,{time:nSlot.time,status:'available'}] }))
    setModal(false); setNSlot({ day:0, time:'' }); toast$('✅ Slot added!')
  }

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-area">
        <Topbar title="Schedule Management" breadcrumb="Owner / Schedule" />
        <div className="page-inner">
          {toast && <div className="alert alert-success"><i className="fas fa-check-circle" />{toast}</div>}

          <div className="sec-hd anim-1">
            <div>
              <h2>Weekly Schedule</h2>
              <p>Click a slot to toggle Available ↔ Blocked. Booked slots are locked.</p>
            </div>
            <button className="btn btn-primary" onClick={() => setModal(true)}>
              <i className="fas fa-plus" /> Add Slot
            </button>
          </div>

          {/* Legend */}
          <div style={{ display:'flex', gap:18, marginBottom:20, flexWrap:'wrap' }} className="anim-2">
            {[
              { lbl:'Available', c:'var(--green)',  bg:'var(--green-light)' },
              { lbl:'Booked',    c:'var(--red)',    bg:'var(--red-light)' },
              { lbl:'Blocked',   c:'#8a96a8',       bg:'#f4f4f4' },
            ].map(l => (
              <div key={l.lbl} style={{ display:'flex', alignItems:'center', gap:7, fontSize:12, fontWeight:800, color:l.c }}>
                <div style={{ width:12, height:12, borderRadius:3, background:l.bg, border:`2px solid ${l.c}` }} />
                {l.lbl}
              </div>
            ))}
          </div>

          <div className="schedule-stack">
            {sched.map((day, di) => (
              <div key={di} className={`sched-day anim-${Math.min(di+1,4)}`}>
                <div className="sched-day-hd">
                  <i className="fas fa-calendar-day" style={{ color:'var(--green)' }} />
                  {day.day}
                  <span className="sched-count">
                    {day.slots.filter(s=>s.status==='available').length} available
                  </span>
                </div>
                <div className="sched-slots">
                  {day.slots.map((slot, si) => (
                    <div
                      key={si}
                      className={`sched-slot ${slot.status}`}
                      onClick={() => cycle(di, si)}
                      title={slot.team ? `Booked: ${slot.team}` : `Click to ${slot.status==='available'?'block':'unblock'}`}
                    >
                      {slot.time}
                      {slot.team && <div className="sched-slot-team">{slot.team}</div>}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {modal && (
        <div className="modal-overlay" onClick={() => setModal(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="modal-hd">
              <h3><i className="fas fa-plus-circle" style={{ color:'var(--green)', marginRight:8 }} />Add New Slot</h3>
              <button className="modal-close" onClick={() => setModal(false)}><i className="fas fa-xmark" /></button>
            </div>
            <div className="form-group">
              <label className="form-label">Day</label>
              <select className="form-control" value={nSlot.day} onChange={e => setNSlot({...nSlot,day:+e.target.value})}>
                {sched.map((d,i) => <option key={i} value={i}>{d.day}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Time</label>
              <input type="time" className="form-control" value={nSlot.time} onChange={e => setNSlot({...nSlot,time:e.target.value})} />
            </div>
            <div style={{ display:'flex', gap:10 }}>
              <button className="btn btn-primary" style={{ flex:1 }} onClick={addSlot}>
                <i className="fas fa-plus" /> Add Slot
              </button>
              <button className="btn btn-outline" onClick={() => setModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
