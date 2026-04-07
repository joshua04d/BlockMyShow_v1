import { useState, useEffect } from 'react'
import { collection, getDocs, doc, updateDoc, orderBy, query } from 'firebase/firestore'
import { ethers } from 'ethers'
import { db } from '../firebase'
import { useWallet } from '../hooks/useWallet'
import { ADDRESSES, EVENT_MANAGER_ABI } from '../contracts/addresses'

// Only this wallet can access the admin page
const OWNER_ADDRESS = '0x382E7A5eA0C6d2DfDB77C3e464227AF45f4ECD9d'

const STATUS_COLORS = {
  pending:  'var(--warning, #f59e0b)',
  approved: 'var(--success, #10b981)',
  rejected: 'var(--danger, #ef4444)',
}

export default function Admin() {
  const { isAuthed, isConnected, isOnSepolia, address, connect, switchToSepolia, getSigner } = useWallet()

  const [requests, setRequests] = useState([])
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState(null)
  const [acting, setActing]     = useState(null) // docId currently being processed

  const isOwner = address?.toLowerCase() === OWNER_ADDRESS.toLowerCase()

  useEffect(() => {
    if (isAuthed && isOwner) fetchRequests()
  }, [isAuthed, isOwner])

  async function fetchRequests() {
    try {
      setLoading(true)
      setError(null)
      const q    = query(collection(db, 'eventRequests'), orderBy('submittedAt', 'desc'))
      const snap = await getDocs(q)
      setRequests(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    } catch (err) {
      setError(err.message || 'Failed to load requests.')
    } finally {
      setLoading(false)
    }
  }

  async function handleApprove(req) {
    if (!isConnected) { setError('Connect MetaMask to approve events.'); return }
    if (!isOnSepolia) { setError('Switch to Sepolia to approve events.'); return }
    try {
      setActing(req.id)
      setError(null)

      const signer   = await getSigner()
      const contract = new ethers.Contract(ADDRESSES.EventManager, EVENT_MANAGER_ABI, signer)

      // Create event on-chain
      const tx = await contract.createEvent(
        req.name,
        req.venue,
        BigInt(req.date),
        BigInt(req.totalSeats),
        req.tier,
        ''  // metadataURI empty for now
      )
      const receipt = await tx.wait()

      // Extract eventId from EventCreated log
      const iface    = new ethers.Interface(EVENT_MANAGER_ABI)
      let onChainId  = null
      for (const log of receipt.logs) {
        try {
          const parsed = iface.parseLog(log)
          if (parsed?.name === 'EventCreated') {
            onChainId = parsed.args.eventId.toString()
            break
          }
        } catch {}
      }

      // Update Firestore
      await updateDoc(doc(db, 'eventRequests', req.id), {
        status:    'approved',
        onChainId,
        approvedAt: new Date().toISOString(),
      })

      setRequests(prev => prev.map(r =>
        r.id === req.id ? { ...r, status: 'approved', onChainId } : r
      ))
    } catch (err) {
      setError(err.reason || err.message || 'Approval failed.')
    } finally {
      setActing(null)
    }
  }

  async function handleReject(req) {
    try {
      setActing(req.id)
      setError(null)
      await updateDoc(doc(db, 'eventRequests', req.id), {
        status:     'rejected',
        rejectedAt: new Date().toISOString(),
      })
      setRequests(prev => prev.map(r =>
        r.id === req.id ? { ...r, status: 'rejected' } : r
      ))
    } catch (err) {
      setError(err.message || 'Rejection failed.')
    } finally {
      setActing(null)
    }
  }

  // ── Guards ────────────────────────────────────────────────────────────────

  if (!isAuthed) return (
    <div className="empty-state">
      <h2>Not signed in</h2>
      <p>Sign in to access the admin panel.</p>
    </div>
  )

  if (!isConnected) return (
    <div className="empty-state">
      <h2>Connect your wallet</h2>
      <p style={{ marginBottom: '1.5rem' }}>Admin access requires MetaMask.</p>
      <button className="btn btn-primary" onClick={connect}>Connect Wallet</button>
    </div>
  )

  if (!isOwner) return (
    <div className="empty-state">
      <h2>🚫 Access Denied</h2>
      <p>This page is restricted to the contract owner.</p>
    </div>
  )

  const pending  = requests.filter(r => r.status === 'pending')
  const approved = requests.filter(r => r.status === 'approved')
  const rejected = requests.filter(r => r.status === 'rejected')

  return (
    <div>
      <div className="page-header">
        <h1>🛠 Admin Dashboard</h1>
        <p>Review and approve event requests from users.</p>
      </div>

      {!isOnSepolia && (
        <div className="alert alert-error" style={{ marginBottom: '1.5rem' }}>
          Switch to Sepolia to approve events.{' '}
          <button className="btn btn-danger" style={{ padding: '0.25rem 0.75rem', marginLeft: '0.75rem' }} onClick={switchToSepolia}>
            Switch Network
          </button>
        </div>
      )}

      {error && <div className="alert alert-error" style={{ marginBottom: '1rem' }}>{error}</div>}

      {/* Stats */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
        {[
          { label: 'Pending',  count: pending.length,  color: STATUS_COLORS.pending  },
          { label: 'Approved', count: approved.length, color: STATUS_COLORS.approved },
          { label: 'Rejected', count: rejected.length, color: STATUS_COLORS.rejected },
        ].map(s => (
          <div key={s.label} className="card" style={{ flex: 1, minWidth: 120, textAlign: 'center', padding: '1rem' }}>
            <div style={{ fontSize: '1.75rem', fontWeight: 700, color: s.color }}>{s.count}</div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text)' }}>{s.label}</div>
          </div>
        ))}
        <button className="btn btn-outline" style={{ alignSelf: 'center' }} onClick={fetchRequests}>
          🔄 Refresh
        </button>
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: '3rem' }}>
          <span className="spinner" style={{ width: 32, height: 32, borderWidth: 3 }} />
        </div>
      )}

      {!loading && requests.length === 0 && (
        <div className="empty-state">
          <h2>No requests yet</h2>
          <p>Users will submit event requests from the Submit Event page.</p>
        </div>
      )}

      {!loading && requests.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {requests.map(req => {
            const dateStr = req.date
              ? new Date(req.date * 1000).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
              : '—'
            const isActing = acting === req.id

            return (
              <div className="card" key={req.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <h3 style={{ margin: 0 }}>{req.name}</h3>
                  <span style={{ fontSize: '0.8rem', fontWeight: 600, color: STATUS_COLORS[req.status], textTransform: 'uppercase' }}>
                    {req.status}
                  </span>
                </div>

                <p style={{ fontSize: '0.9rem', margin: 0 }}>📍 {req.venue}</p>
                <p style={{ fontSize: '0.9rem', margin: 0 }}>🗓 {dateStr}</p>
                <p style={{ fontSize: '0.9rem', margin: 0 }}>🏷 {req.tier} · {req.totalSeats} seats</p>
                {req.description && (
                  <p style={{ fontSize: '0.85rem', color: 'var(--text)', margin: 0 }}>{req.description}</p>
                )}
                <p style={{ fontSize: '0.8rem', color: 'var(--text)', margin: 0 }}>
                  Submitted by: {req.submittedBy}
                </p>
                {req.onChainId !== null && req.onChainId !== undefined && (
                  <p style={{ fontSize: '0.8rem', color: 'var(--success, #10b981)', margin: 0 }}>
                    ✅ On-chain ID: {req.onChainId}
                  </p>
                )}

                {req.status === 'pending' && (
                  <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                    <button
                      className="btn btn-primary"
                      onClick={() => handleApprove(req)}
                      disabled={isActing}
                      style={{ flex: 1, justifyContent: 'center' }}
                    >
                      {isActing ? <><span className="spinner" /> Approving...</> : '✅ Approve'}
                    </button>
                    <button
                      className="btn btn-danger"
                      onClick={() => handleReject(req)}
                      disabled={isActing}
                      style={{ flex: 1, justifyContent: 'center' }}
                    >
                      {isActing ? <><span className="spinner" /> Rejecting...</> : '❌ Reject'}
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
