import React, { useState } from 'react'
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet'
import L from 'leaflet'

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

function ClickHandler({ onSelect }) {
  useMapEvents({
    click(e) { onSelect(e.latlng) }
  })
  return null
}

export default function LocationPicker({ initialLat = 27.7172, initialLng = 85.3240, onConfirm, onClose }) {
  const [position, setPosition] = useState(null)
  const [address,  setAddress]  = useState('')
  const [district, setDistrict] = useState('')
  const [loading,  setLoading]  = useState(false)

  const handleSelect = async (latlng) => {
    setPosition(latlng)
    setLoading(true)
    try {
      const res  = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${latlng.lat}&lon=${latlng.lng}&format=json`
      )
      const data = await res.json()
      const resolvedDistrict =
        data.address?.county ||
        data.address?.state_district ||
        data.address?.city_district ||
        data.address?.municipality ||
        data.address?.city ||
        data.address?.town ||
        data.address?.village ||
        ''
      const place =
        data.address?.suburb        ||
        data.address?.neighbourhood ||
        data.address?.city_district ||
        data.address?.town          ||
        data.address?.city          ||
        'Selected location'
      setAddress(place)
      setDistrict(resolvedDistrict)
    } catch {
      setAddress('Selected location')
      setDistrict('')
    }
    setLoading(false)
  }

  const confirm = () => {
    if (!position) return
    onConfirm({ lat: position.lat, lng: position.lng, address, district })
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-box"
        onClick={e => e.stopPropagation()}
        style={{ maxWidth:620, padding:0, overflow:'hidden' }}
      >
        {/* Header */}
        <div style={{ padding:'16px 20px', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div>
            <div style={{ fontFamily:'Barlow Condensed, sans-serif', fontSize:18, fontWeight:900 }}>
              <i className="fas fa-map-marker-alt" style={{ color:'var(--green)', marginRight:8 }} />
              Pick Your Location
            </div>
            <div style={{ fontSize:12, color:'#8a96a8', marginTop:2 }}>
              Click anywhere on the map to drop a pin
            </div>
          </div>
          <button className="modal-close" onClick={onClose}>
            <i className="fas fa-xmark" />
          </button>
        </div>

        {/* Map */}
        <MapContainer
          center={[initialLat, initialLng]}
          zoom={13}
          style={{ height:380, width:'100%' }}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='© OpenStreetMap contributors'
          />
          <ClickHandler onSelect={handleSelect} />
          {position && <Marker position={position} />}
        </MapContainer>

        {/* Footer */}
        <div style={{ padding:'14px 20px', borderTop:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, flexWrap:'wrap' }}>
          <div style={{ fontSize:13, color:'#4a5568', flex:1 }}>
            {loading ? (
              <span>
                <i className="fas fa-circle-notch fa-spin" style={{ marginRight:6 }} />
                Getting address...
              </span>
            ) : position ? (
              <span>
                <i className="fas fa-location-dot" style={{ color:'var(--green)', marginRight:6 }} />
                <strong>{address}</strong>
                {district && (
                  <span style={{ fontSize:12, color:'#5f6f87', marginLeft:8 }}>
                    District: {district}
                  </span>
                )}
                <span style={{ fontSize:11, color:'#8a96a8', marginLeft:8 }}>
                  ({position.lat.toFixed(4)}, {position.lng.toFixed(4)})
                </span>
              </span>
            ) : (
              <span style={{ color:'#8a96a8' }}>
                <i className="fas fa-hand-pointer" style={{ marginRight:6 }} />
                No location selected yet
              </span>
            )}
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <button className="btn btn-outline btn-sm" onClick={onClose}>Cancel</button>
            <button
              className="btn btn-primary btn-sm"
              onClick={confirm}
              disabled={!position || loading}
            >
              <i className="fas fa-check" /> Confirm Location
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}