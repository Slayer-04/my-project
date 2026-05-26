import React, { lazy, Suspense, useMemo, useState } from 'react'
import Sidebar from '../../components/Sidebar.jsx'
import Topbar  from '../../components/Topbar.jsx'
import { useAuth } from '../../App.jsx'
import { fetchApiJson } from '../../utils/apiClient.js'

const LocationPicker = lazy(() => import('../../components/LocationPicker.jsx'))

export default function OwnerProfile() {
  const { user, setUser, bookings } = useAuth()
  const ownerProfile = user?.ownerProfile || {}

  const [editing, setEditing] = useState(!user?.profileCompleted)
  const formatUid = value => {
    const digits = String(value || '').replace(/\D/g, '')
    if (!digits) return 'Pending'
    return digits.length >= 8 ? digits.slice(-8) : digits.padStart(8, '0')
  }
  const venueUid = formatUid(user?.venueUid || user?.venueId)
  const defaultInfo = useMemo(() => ({
    venueName: ownerProfile.venueName || user?.venueName || '',
    location: ownerProfile.location || '',
    lat: Number.isFinite(Number(ownerProfile.lat)) ? Number(ownerProfile.lat) : 27.7172,
    lng: Number.isFinite(Number(ownerProfile.lng)) ? Number(ownerProfile.lng) : 85.3240,
    locationVerified: Boolean(ownerProfile.locationVerified),
    courts: ownerProfile.courts ? String(ownerProfile.courts) : '',
    phone: ownerProfile.phone || '',
    hours: ownerProfile.hours || '',
  }), [ownerProfile.courts, ownerProfile.hours, ownerProfile.lat, ownerProfile.lng, ownerProfile.location, ownerProfile.locationVerified, ownerProfile.phone, ownerProfile.venueName, user?.venueName])
  const [info, setInfo] = useState({
    venueName: defaultInfo.venueName,
    location: defaultInfo.location,
    lat: defaultInfo.lat,
    lng: defaultInfo.lng,
    locationVerified: defaultInfo.locationVerified,
    courts: defaultInfo.courts,
    phone: defaultInfo.phone,
    hours: defaultInfo.hours,
  })
  const [toast, setToast] = useState('')
  const [saving, setSaving] = useState(false)
  const [showMap, setShowMap] = useState(false)

  const ownerBookings = bookings.filter(b => {
    const byVenue = info.venueName && b.venue === info.venueName
    const byEmail = user?.email && String(b.ownerEmail || '').toLowerCase() === String(user.email).toLowerCase()
    const byName = user?.name && String(b.ownerName || '').toLowerCase() === String(user.name).toLowerCase()
    return byVenue || byEmail || byName
  })

  const save = async () => {
    const venueName = String(info.venueName || '').trim()
    const location = String(info.location || '').trim()
    if (!venueName || !location) {
      setToast('Please provide venue name and location.')
      setTimeout(() => setToast(''), 3000)
      return
    }

    if (!info.locationVerified || !Number.isFinite(Number(info.lat)) || !Number.isFinite(Number(info.lng))) {
      setToast('Please pick and confirm exact location on map.')
      setTimeout(() => setToast(''), 3000)
      return
    }

    setSaving(true)
    try {
      const ownerPayload = {
        venueName,
        location,
        lat: Number(info.lat),
        lng: Number(info.lng),
        locationVerified: true,
        courts: Number(info.courts) || 0,
        phone: String(info.phone || '').trim(),
        hours: String(info.hours || '').trim(),
      }

      if (user?.id) {
        const { response, data } = await fetchApiJson(`/users/${user.id}/profile`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ownerProfile: ownerPayload }),
        })

        if (!response.ok) {
          setToast(data.message || 'Failed to save profile.')
          setTimeout(() => setToast(''), 3000)
          return
        }

        setUser(prev => ({
          ...prev,
          profileCompleted: true,
          ownerProfile: data.user?.ownerProfile || ownerPayload,
          venueName: (data.user?.ownerProfile?.venueName || ownerPayload.venueName),
        }))
      } else {
        setUser(prev => ({
          ...prev,
          profileCompleted: true,
          ownerProfile: ownerPayload,
          venueName: ownerPayload.venueName,
        }))
      }

      setEditing(false)
      setToast('✅ Profile saved!')
      setTimeout(() => setToast(''), 3000)
    } catch (_error) {
      setToast('Unable to save profile right now.')
      setTimeout(() => setToast(''), 3000)
    } finally {
      setSaving(false)
    }
  }

  const totalRev = ownerBookings.filter(b => b.status==='confirmed')
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
              <div className="ph-name">{info.venueName || 'Set your venue name'}</div>
              <div className="ph-sub"><i className="fas fa-location-dot" style={{ marginRight:5 }} />{info.location || 'Set your venue location'}</div>
              <div className="ph-tags">
                <span className="ph-tag">{info.courts || '0'} Courts</span>
                <span className="ph-tag">{info.hours || 'Hours pending'}</span>
                <span className="ph-tag">UID {venueUid}</span>
                <span className="ph-tag">{Number(info.lat).toFixed(4)}, {Number(info.lng).toFixed(4)}</span>
                <span className="ph-tag">{user?.profileCompleted ? 'Verified Partner' : 'Profile Incomplete'}</span>
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

                    <div className="form-group">
                      <label className="form-label">Location</label>
                      <div style={{ display:'flex', gap:8 }}>
                        <input
                          className="form-control"
                          value={info.location}
                          placeholder="Pick exact location from map"
                          readOnly
                          style={{ background: info.locationVerified ? '#f0fdf4' : '#fff', cursor:'default' }}
                        />
                        <button
                          type="button"
                          className="btn btn-outline"
                          onClick={() => setShowMap(true)}
                          style={{ flexShrink:0, whiteSpace:'nowrap' }}
                        >
                          <i className="fas fa-map-marker-alt" /> Pick on Map
                        </button>
                      </div>
                      <div style={{ fontSize:12, marginTop:5, color: info.locationVerified ? 'var(--green)' : '#8a96a8' }}>
                        {info.locationVerified
                          ? `Location verified at (${Number(info.lat).toFixed(4)}, ${Number(info.lng).toFixed(4)})`
                          : 'Exact map point required for algorithm.'}
                      </div>
                    </div>

                    <button className="btn btn-primary btn-full" onClick={save}>
                      <i className="fas fa-floppy-disk" /> {saving ? 'Saving…' : 'Save Changes'}
                    </button>
                  </>
                ) : (
                  <>
                    {[
                      { lbl:'Venue Name',   val: info.venueName || '-',  icon:'fa-building' },
                      { lbl:'Location',     val: info.location || '-',   icon:'fa-location-dot' },
                      { lbl:'Coordinates',  val: `${Number(info.lat).toFixed(4)}, ${Number(info.lng).toFixed(4)}`, icon:'fa-map-pin' },
                      { lbl:'Courts',       val: info.courts || '0',     icon:'fa-table-tennis-paddle-ball' },
                      { lbl:'Phone',        val: info.phone || '-',      icon:'fa-phone' },
                      { lbl:'Hours',        val: info.hours || '-',      icon:'fa-clock' },
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
                    { lbl:'Total Bookings', val: ownerBookings.length, bg:'#e8f0fd', c:'var(--blue)' },
                    { lbl:'Confirmed',      val: ownerBookings.filter(b => b.status === 'confirmed').length, bg:'#e6faf2', c:'var(--green)' },
                    { lbl:'Pending',        val: ownerBookings.filter(b => b.status === 'pending').length, bg:'#fefce8', c:'#ca8a04' },
                    { lbl:'Cancelled',      val: ownerBookings.filter(b => b.status === 'cancelled').length, bg:'#fff5f5', c:'var(--red)' },
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

      {showMap && (
        <Suspense fallback={null}>
          <LocationPicker
            initialLat={Number(info.lat) || 27.7172}
            initialLng={Number(info.lng) || 85.3240}
            onConfirm={loc => setInfo(prev => ({
              ...prev,
              location: loc.address,
              lat: loc.lat,
              lng: loc.lng,
              locationVerified: true,
            }))}
            onClose={() => setShowMap(false)}
          />
        </Suspense>
      )}
    </div>
  )
}
