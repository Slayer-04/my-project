import React from 'react'
import Sidebar from '../../components/Sidebar.jsx'
import Topbar from '../../components/Topbar.jsx'

const members = [
  'Suyog (Captain)',
  'Sobit (Approved Member)',
]

export default function Members() {
  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-area">
        <Topbar title="Members" breadcrumb="FotMatch / Team User / Members" />
        <div className="page-inner">
          <div className="card anim-1" style={{ maxWidth: 640 }}>
            <div className="card-hd">
              <h3>Team Members</h3>
            </div>

            <div style={{ padding: '18px 22px 22px' }}>
              <p style={{ margin: '0 0 16px', color: '#4a5568' }}>
                Simple member names list for this team.
              </p>

              <div style={{ display: 'grid', gap: 12 }}>
                {members.map(member => (
                  <div
                    key={member}
                    style={{
                      padding: '14px 16px',
                      border: '1px solid #e9edf2',
                      borderRadius: 12,
                      background: '#fff',
                      fontWeight: 600,
                    }}
                  >
                    {member}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}