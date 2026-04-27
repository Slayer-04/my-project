import React, { useState } from 'react'

export default function ScoreModal({ booking, myTeamName, onSubmit, onClose }) {
  const [myScore, setMyScore] = useState('')
  const [opponentScore, setOpponentScore] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async () => {
    if (myScore === '' || opponentScore === '') {
      alert('Please enter both scores')
      return
    }

    setSubmitting(true)
    try {
      await onSubmit({
        bookingId: booking.id,
        team: myTeamName,
        opponent: booking.opponent,
        myScore: parseInt(myScore),
        opponentScore: parseInt(opponentScore),
        matchDate: booking.date,
        matchTime: booking.time,
        venue: booking.venue,
        timestamp: new Date().toISOString(),
      })
      setMyScore('')
      setOpponentScore('')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 450 }}>
        <div className="modal-hd">
          <h3>
            <i className="fas fa-trophy" style={{ color: 'var(--green)', marginRight: 8 }} />
            Enter Match Score
          </h3>
          <button className="modal-close" onClick={onClose}>
            <i className="fas fa-xmark" />
          </button>
        </div>

        <div style={{ padding: '20px' }}>
          {/* Match info */}
          <div style={{ marginBottom: 20, textAlign: 'center', paddingBottom: 16, borderBottom: '1px solid #f0f4f8' }}>
            <div style={{ fontFamily: 'Barlow Condensed,sans-serif', fontSize: 16, fontWeight: 900, marginBottom: 8 }}>
              <span style={{ color: 'var(--green)' }}>{myTeamName}</span>
              <span style={{ color: '#ccc', margin: '0 10px' }}>vs</span>
              <span>{booking.opponent}</span>
            </div>
            <div style={{ fontSize: 12, color: '#8a96a8' }}>
              <i className="fas fa-calendar" style={{ marginRight: 4 }} />
              {booking.date}
              <span style={{ margin: '0 8px' }}>•</span>
              <i className="fas fa-clock" style={{ marginRight: 4 }} />
              {booking.time}
            </div>
            <div style={{ fontSize: 12, color: '#8a96a8', marginTop: 4 }}>
              <i className="fas fa-building" style={{ marginRight: 4 }} />
              {booking.venue}
            </div>
          </div>

          {/* Score inputs */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 12, marginBottom: 20, alignItems: 'end' }}>
            {/* My team score */}
            <div>
              <label className="form-label" style={{ marginBottom: 6 }}>
                {myTeamName}
              </label>
              <input
                type="number"
                min="0"
                max="20"
                className="form-control"
                value={myScore}
                onChange={e => setMyScore(e.target.value)}
                placeholder="0"
                style={{ fontSize: 18, textAlign: 'center', fontWeight: 700 }}
              />
            </div>

            {/* vs */}
            <div style={{ textAlign: 'center', fontSize: 14, fontWeight: 700, color: '#8a96a8' }}>
              VS
            </div>

            {/* Opponent score */}
            <div>
              <label className="form-label" style={{ marginBottom: 6 }}>
                {booking.opponent}
              </label>
              <input
                type="number"
                min="0"
                max="20"
                className="form-control"
                value={opponentScore}
                onChange={e => setOpponentScore(e.target.value)}
                placeholder="0"
                style={{ fontSize: 18, textAlign: 'center', fontWeight: 700 }}
              />
            </div>
          </div>

          {/* Result preview */}
          {myScore !== '' && opponentScore !== '' && (
            <div style={{ marginBottom: 20, padding: 12, background: '#f0fdf4', borderRadius: 8, textAlign: 'center', fontSize: 14, color: '#22c55e', fontWeight: 700 }}>
              {myScore > opponentScore
                ? `🎉 ${myTeamName} Won!`
                : myScore < opponentScore
                  ? `😢 ${booking.opponent} Won`
                  : '🤝 It\'s a Draw!'}
            </div>
          )}

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              className="btn btn-primary"
              style={{ flex: 1 }}
              onClick={handleSubmit}
              disabled={submitting || myScore === '' || opponentScore === ''}
            >
              <i className="fas fa-check" /> {submitting ? 'Submitting...' : 'Submit Score'}
            </button>
            <button className="btn btn-outline" onClick={onClose} disabled={submitting}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
