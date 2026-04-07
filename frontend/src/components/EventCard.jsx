import { Link } from 'react-router-dom'

export default function EventCard({ event }) {
  const { eventId, name, venue, date, totalSeats, soldSeats, tier, active, cancelled } = event

  const dateStr = new Date(Number(date) * 1000).toLocaleDateString('en-IN', {
    day:    'numeric',
    month:  'short',
    year:   'numeric',
    hour:   '2-digit',
    minute: '2-digit',
  })

  const seatsLeft = Number(totalSeats) - Number(soldSeats)
  const soldOut   = seatsLeft === 0
  const isPast    = Number(date) * 1000 < Date.now()

  const isAvailable = active && !cancelled && !isPast && !soldOut

  let badgeLabel, badgeCls
  if (cancelled)       { badgeLabel = 'Cancelled'; badgeCls = 'badge-cancelled' }
  else if (isPast)     { badgeLabel = 'Completed'; badgeCls = 'badge-complete'  }
  else if (!active)    { badgeLabel = 'Pending';   badgeCls = 'badge-pending'   }
  else if (soldOut)    { badgeLabel = 'Sold Out';  badgeCls = 'badge-cancelled' }
  else                 { badgeLabel = 'Active';    badgeCls = 'badge-active'    }

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
        <h3 style={{ margin: 0 }}>{name}</h3>
        <span className={`badge ${badgeCls}`}>{badgeLabel}</span>
      </div>

      <p style={{ fontSize: '0.9rem', marginBottom: '0.5rem' }}>📍 {venue}</p>
      <p style={{ fontSize: '0.9rem', marginBottom: '0.5rem' }}>🗓 {dateStr}</p>
      <p style={{ fontSize: '0.9rem', marginBottom: '0.5rem' }}>🏷 {tier}</p>
      <p style={{ fontSize: '0.9rem', marginBottom: '1.25rem' }}>
        🎟 {soldOut
          ? <span style={{ color: 'var(--danger)' }}>Sold Out</span>
          : `${seatsLeft} / ${Number(totalSeats)} seats left`}
      </p>

      {isAvailable ? (
        <Link to={`/buy/${eventId.toString()}`} className="btn btn-primary">
          Buy Ticket
        </Link>
      ) : (
        <button className="btn btn-outline" disabled>Unavailable</button>
      )}
    </div>
  )
}
