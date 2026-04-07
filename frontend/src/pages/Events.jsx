import { useState, useEffect } from 'react'
import { ethers } from 'ethers'
import { useWallet } from '../hooks/useWallet'
import { ADDRESSES, EVENT_MANAGER_ABI } from '../contracts/addresses'
import EventCard from '../components/EventCard'

const PUBLIC_RPC = import.meta.env.VITE_SEPOLIA_RPC_URL

export default function Events() {
  const { isAuthed, isConnected, isOnSepolia, connect, switchToSepolia, getProvider } = useWallet()

  const [events, setEvents]   = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState(null)

  useEffect(() => {
    if (isAuthed) fetchEvents()
  }, [isAuthed])

  async function fetchEvents() {
    if (!ADDRESSES.EventManager) {
      setError('Contract addresses not configured yet — deploy first.')
      return
    }
    try {
      setLoading(true)
      setError(null)
      // Use MetaMask provider if connected + on Sepolia, else fall back to public RPC
      const provider = (isConnected && isOnSepolia)
        ? await getProvider()
        : new ethers.JsonRpcProvider(PUBLIC_RPC)
      const contract = new ethers.Contract(ADDRESSES.EventManager, EVENT_MANAGER_ABI, provider)
      const fetched  = await contract.getAllEvents()
      setEvents(fetched)
    } catch (err) {
      setError(err.message || 'Failed to load events.')
    } finally {
      setLoading(false)
    }
  }

  // ── Guards ────────────────────────────────────────────────────────────────

  if (!isAuthed) return (
    <div className="empty-state">
      <h2>Sign in to browse events</h2>
      <p>Create a free account to get started.</p>
    </div>
  )

  return (
    <div>
      <div className="page-header">
        <h1>🎟 Upcoming Events</h1>
        <p>Buy tickets as NFTs — yours forever on-chain.</p>
      </div>

      {/* Prompt to connect wallet if browsing without MetaMask */}
      {!isConnected && (
        <div className="alert" style={{ marginBottom: '1.5rem', background: 'var(--card)', border: '1px solid var(--border)' }}>
          Connect MetaMask to buy tickets.{' '}
          <button className="btn btn-primary" style={{ padding: '0.25rem 0.75rem', marginLeft: '0.75rem' }} onClick={connect}>
            Connect Wallet
          </button>
        </div>
      )}

      {isConnected && !isOnSepolia && (
        <div className="alert alert-error" style={{ marginBottom: '1.5rem' }}>
          Wrong network — switch to Sepolia to buy tickets.{' '}
          <button className="btn btn-danger" style={{ padding: '0.25rem 0.75rem', marginLeft: '0.75rem' }} onClick={switchToSepolia}>
            Switch to Sepolia
          </button>
        </div>
      )}

      {error && <div className="alert alert-error">{error}</div>}

      {loading && (
        <div style={{ textAlign: 'center', padding: '3rem' }}>
          <span className="spinner" style={{ width: 32, height: 32, borderWidth: 3 }} />
        </div>
      )}

      {!loading && events.length === 0 && !error && (
        <div className="empty-state">
          <h2>No events yet</h2>
          <p>Check back soon.</p>
        </div>
      )}

      {!loading && events.length > 0 && (
        <div className="card-grid">
          {events.map((ev, i) => (
            <EventCard key={i} event={ev} />
          ))}
        </div>
      )}
    </div>
  )
}
