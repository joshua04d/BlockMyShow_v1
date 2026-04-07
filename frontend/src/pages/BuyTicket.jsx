import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ethers } from 'ethers'
import { ADDRESSES, EVENT_MANAGER_ABI } from '../contracts/addresses'
import { useWallet } from '../hooks/useWallet'

const PUBLIC_RPC = import.meta.env.VITE_SEPOLIA_RPC_URL

export default function BuyTicket() {
  const { eventId }  = useParams()
  console.log('eventId from URL:', eventId)
  const navigate     = useNavigate()
  const { isAuthed, isConnected, isOnSepolia, connect, switchToSepolia, getSigner, getProvider } = useWallet()

  const [event, setEvent]       = useState(null)
  const [price, setPrice]       = useState(null)
  const [loading, setLoading]   = useState(false)
  const [fetching, setFetching] = useState(true)
  const [error, setError]       = useState(null)
  const [success, setSuccess]   = useState(null)
  const [txHash, setTxHash]     = useState(null)

  // Load event details as soon as user is authenticated — no wallet needed to view
  useEffect(() => {
    if (isAuthed) fetchEvent()
  }, [isAuthed, eventId])

  async function fetchEvent() {
  try {
    setFetching(true)
    setError(null)
    const provider = (isConnected && isOnSepolia)
      ? await getProvider()
      : new ethers.JsonRpcProvider(PUBLIC_RPC)
    const contract = new ethers.Contract(ADDRESSES.EventManager, EVENT_MANAGER_ABI, provider)
    // Use getAllEvents + index instead of getEvent (ethers v6 struct parsing bug)
    const allEvents = await contract.getAllEvents()
    const ev = allEvents[Number(eventId)]
    if (!ev) { setFetching(false); return }
    const p = await contract.getCurrentPrice(BigInt(eventId))
    setEvent(ev)
    setPrice(p)
  } catch (err) {
    console.error('fetchEvent error:', err)
    setError('Failed to load event details.')
  } finally {
    setFetching(false)
  }
}

  async function handleBuy() {
    try {
      setLoading(true)
      setError(null)
      setSuccess(null)
      const signer   = await getSigner()
      const contract = new ethers.Contract(ADDRESSES.EventManager, EVENT_MANAGER_ABI, signer)
      const tx       = await contract.buyTicket(BigInt(eventId), { value: price })
      setTxHash(tx.hash)
      await tx.wait()
      setSuccess('🎉 Ticket purchased! Your NFT is in your wallet.')
    } catch (err) {
      setError(err.reason || err.message || 'Transaction failed.')
    } finally {
      setLoading(false)
    }
  }

  // ── Guards ────────────────────────────────────────────────────────────────

  if (!isAuthed) return (
    <div className="empty-state">
      <h2>Not signed in</h2>
      <p>Sign in to purchase tickets.</p>
    </div>
  )

  if (fetching) return (
    <div style={{ textAlign: 'center', padding: '4rem' }}>
      <span className="spinner" style={{ width: 36, height: 36, borderWidth: 3 }} />
    </div>
  )

  if (!event) return (
    <div className="empty-state">
      <h2>Event not found</h2>
      <button className="btn btn-outline" onClick={() => navigate('/events')}>Back to Events</button>
    </div>
  )

  const dateStr   = new Date(Number(event.date) * 1000).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  })
  const priceEth  = price ? ethers.formatEther(price) : '...'
  const seatsLeft = Number(event.totalSeats) - Number(event.soldSeats)
  const canBuy    = event.active && !event.cancelled && seatsLeft > 0 && Number(event.date) * 1000 > Date.now()

  return (
    <div style={{ maxWidth: 540, margin: '0 auto' }}>
      <button className="btn btn-outline" onClick={() => navigate('/events')} style={{ marginBottom: '1.5rem' }}>
        ← Back
      </button>

      {/* Event Summary */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ marginBottom: '0.5rem' }}>{event.name}</h2>
        <p style={{ fontSize: '0.9rem', marginBottom: '0.3rem' }}>📍 {event.venue}</p>
        <p style={{ fontSize: '0.9rem', marginBottom: '0.3rem' }}>🗓 {dateStr}</p>
        <p style={{ fontSize: '0.9rem', marginBottom: '0.3rem' }}>🏷 Tier: {event.tier}</p>
        <p style={{ fontSize: '0.9rem' }}>🎟 {seatsLeft} seats remaining</p>
      </div>

      {/* Purchase Card */}
      <div className="card">
        <h3 style={{ marginBottom: '1.25rem' }}>Purchase Ticket</h3>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <span style={{ color: 'var(--text)' }}>Price</span>
          <span style={{ color: 'var(--text-h)', fontWeight: 600, fontSize: '1.1rem' }}>
            {priceEth} ETH
          </span>
        </div>

        <div className="divider" />

        <p style={{ fontSize: '0.85rem', color: 'var(--text)', margin: '1rem 0' }}>
          Your seat number will be assigned on-chain at purchase time.
        </p>

        {error   && <div className="alert alert-error"   style={{ marginBottom: '1rem' }}>{error}</div>}
        {success && (
          <div className="alert alert-success" style={{ marginBottom: '1rem' }}>
            {success}
            {txHash && (
              <div style={{ marginTop: '0.4rem', fontSize: '0.8rem' }}>
                <a href={`https://sepolia.etherscan.io/tx/${txHash}`} target="_blank" rel="noreferrer">
                  View on Etherscan ↗
                </a>
              </div>
            )}
          </div>
        )}

        {/* Wallet gate — only shown at buy time, not on page load */}
        {!isConnected && canBuy && (
          <div style={{ marginBottom: '1rem' }}>
            <p style={{ fontSize: '0.9rem', color: 'var(--text)', marginBottom: '0.75rem' }}>
              Connect MetaMask to complete your purchase.
            </p>
            <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={connect}>
              Connect Wallet
            </button>
          </div>
        )}

        {isConnected && !isOnSepolia && (
          <div style={{ marginBottom: '1rem' }}>
            <button className="btn btn-danger" style={{ width: '100%', justifyContent: 'center' }} onClick={switchToSepolia}>
              Switch to Sepolia
            </button>
          </div>
        )}

        {isConnected && isOnSepolia && (
          <button
            className="btn btn-primary"
            style={{ width: '100%', justifyContent: 'center', padding: '0.75rem' }}
            onClick={handleBuy}
            disabled={loading || !price || !canBuy}
          >
            {loading
              ? <><span className="spinner" /> Processing...</>
              : canBuy ? `Buy for ${priceEth} ETH` : 'Unavailable'}
          </button>
        )}

        {!canBuy && (
          <p style={{ textAlign: 'center', marginTop: '0.75rem', fontSize: '0.85rem', color: 'var(--danger)' }}>
            {event.cancelled ? 'Event cancelled.' : seatsLeft === 0 ? 'Sold out.' : 'Event unavailable.'}
          </p>
        )}
      </div>
    </div>
  )
}
