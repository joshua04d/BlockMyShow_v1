import { useState } from 'react'
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase'
import { useWallet } from '../hooks/useWallet'

const TIERS = ['GENERAL', 'VIP']

export default function SubmitEvent() {
  const { isAuthed, user } = useWallet()

  const [form, setForm] = useState({
    name:       '',
    venue:      '',
    date:       '',
    totalSeats: '',
    tier:       'GENERAL',
    description: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess]       = useState(false)
  const [error, setError]           = useState(null)

  function handleChange(e) {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }))
  }

  async function handleSubmit() {
    const { name, venue, date, totalSeats, tier } = form
    if (!name || !venue || !date || !totalSeats || !tier) {
      setError('Please fill in all required fields.')
      return
    }
    if (Number(totalSeats) <= 0) {
      setError('Total seats must be greater than 0.')
      return
    }
    const dateTs = Math.floor(new Date(date).getTime() / 1000)
    if (dateTs <= Math.floor(Date.now() / 1000)) {
      setError('Event date must be in the future.')
      return
    }

    try {
      setSubmitting(true)
      setError(null)
      await addDoc(collection(db, 'eventRequests'), {
        name,
        venue,
        date:        dateTs,
        totalSeats:  Number(totalSeats),
        tier,
        description: form.description,
        status:      'pending',   // pending | approved | rejected
        submittedBy: user?.primaryEmailAddress?.emailAddress || 'unknown',
        submittedAt: serverTimestamp(),
        onChainId:   null,
      })
      setSuccess(true)
      setForm({ name: '', venue: '', date: '', totalSeats: '', tier: 'GENERAL', description: '' })
    } catch (err) {
      setError(err.message || 'Submission failed.')
    } finally {
      setSubmitting(false)
    }
  }

  if (!isAuthed) return (
    <div className="empty-state">
      <h2>Not signed in</h2>
      <p>Sign in to submit an event request.</p>
    </div>
  )

  return (
    <div style={{ maxWidth: 560, margin: '0 auto' }}>
      <div className="page-header">
        <h1>📋 Submit an Event</h1>
        <p>Fill in the details — our admin will review and approve it.</p>
      </div>

      {success && (
        <div className="alert alert-success" style={{ marginBottom: '1.5rem' }}>
          🎉 Event request submitted! We'll review it shortly.
          <div style={{ marginTop: '0.5rem' }}>
            <button className="btn btn-outline" style={{ padding: '0.25rem 0.75rem' }} onClick={() => setSuccess(false)}>
              Submit another
            </button>
          </div>
        </div>
      )}

      {!success && (
        <div className="card">
          {error && <div className="alert alert-error" style={{ marginBottom: '1rem' }}>{error}</div>}

          <div className="form-group">
            <label>Event Name *</label>
            <input
              name="name"
              placeholder="e.g. Sunburn Festival 2026"
              value={form.name}
              onChange={handleChange}
            />
          </div>

          <div className="form-group">
            <label>Venue *</label>
            <input
              name="venue"
              placeholder="e.g. NSCI Dome, Mumbai"
              value={form.venue}
              onChange={handleChange}
            />
          </div>

          <div className="form-group">
            <label>Date & Time *</label>
            <input
              type="datetime-local"
              name="date"
              value={form.date}
              onChange={handleChange}
            />
          </div>

          <div className="form-group">
            <label>Total Seats *</label>
            <input
              type="number"
              name="totalSeats"
              placeholder="e.g. 500"
              min="1"
              value={form.totalSeats}
              onChange={handleChange}
            />
          </div>

          <div className="form-group">
            <label>Ticket Tier *</label>
            <select name="tier" value={form.tier} onChange={handleChange}>
              {TIERS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <span style={{ fontSize: '0.8rem', color: 'var(--text)', marginTop: '0.25rem' }}>
              GENERAL = 0.01 ETH · VIP = 0.05 ETH
            </span>
          </div>

          <div className="form-group">
            <label>Description (optional)</label>
            <textarea
              name="description"
              placeholder="Tell us about the event..."
              value={form.description}
              onChange={handleChange}
              rows={3}
              style={{ width: '100%', background: 'var(--input)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.65rem 0.85rem', color: 'var(--text-h)', resize: 'vertical' }}
            />
          </div>

          <button
            className="btn btn-primary"
            style={{ width: '100%', justifyContent: 'center', padding: '0.75rem' }}
            onClick={handleSubmit}
            disabled={submitting}
          >
            {submitting ? <><span className="spinner" /> Submitting...</> : 'Submit Event Request'}
          </button>
        </div>
      )}
    </div>
  )
}
