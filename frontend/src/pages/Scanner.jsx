import { useState, useEffect, useRef } from 'react'
import { ethers } from 'ethers'
import { useWallet } from '../hooks/useWallet'
import { ADDRESSES, TICKET_NFT_ABI, EVENT_MANAGER_ABI } from '../contracts/addresses'

const ADMIN_ADDRESS  = '0x382E7A5eA0C6d2DfDB77C3e464227AF45f4ECD9d'
const PUBLIC_RPC     = import.meta.env.VITE_SEPOLIA_RPC_URL

export default function Scanner() {
  const { isAuthed, isConnected, isOnSepolia, address, connect, switchToSepolia, getProvider } = useWallet()

  const [tokenInput, setTokenInput]   = useState('')
  const [verifying, setVerifying]     = useState(false)
  const [result, setResult]           = useState(null) // { valid, ticket, event, message }
  const [error, setError]             = useState(null)

  const isAdmin = address?.toLowerCase() === ADMIN_ADDRESS.toLowerCase()

  async function handleVerify() {
    const tokenId = tokenInput.trim()
    if (!tokenId || isNaN(tokenId)) {
      setError('Enter a valid token ID.')
      return
    }
    try {
      setVerifying(true)
      setError(null)
      setResult(null)

      const provider = (isConnected && isOnSepolia)
        ? await getProvider()
        : new ethers.JsonRpcProvider(PUBLIC_RPC)

      const nftContract = new ethers.Contract(ADDRESSES.TicketNFT, TICKET_NFT_ABI, provider)

      // Check token exists + get owner
      let owner
      try {
        owner = await nftContract.ownerOf(BigInt(tokenId))
      } catch {
        setResult({ valid: false, message: '❌ Token does not exist.' })
        return
      }

      // Get ticket data
      const allEvents = await new ethers.Contract(ADDRESSES.EventManager, EVENT_MANAGER_ABI, provider).getAllEvents()
      const ticket    = await nftContract.getTicket(BigInt(tokenId))
      const eventId   = Number(ticket.eventId)
      const ev        = allEvents[eventId]

      // Checks
      if (ticket.used) {
        setResult({ valid: false, message: '❌ Ticket already used.', ticket, event: ev, owner })
        return
      }

      if (!ev) {
        setResult({ valid: false, message: '❌ Event not found on-chain.', ticket, owner })
        return
      }

      if (ev.cancelled) {
        setResult({ valid: false, message: '❌ Event was cancelled.', ticket, event: ev, owner })
        return
      }

      const now = Math.floor(Date.now() / 1000)
      if (Number(ev.date) < now - 24 * 60 * 60) {
        setResult({ valid: false, message: '❌ Event has ended.', ticket, event: ev, owner })
        return
      }

      // All checks passed
      setResult({
        valid: true,
        message: '✅ Ticket is valid!',
        ticket,
        event: ev,
        owner,
        tokenId,
      })

    } catch (err) {
      setError(err.message || 'Verification failed.')
    } finally {
      setVerifying(false)
    }
  }

  function handleReset() {
    setResult(null)
    setError(null)
    setTokenInput('')
  }

  // ── Guards ────────────────────────────────────────────────────────────────

  if (!isAuthed) return (
    <div className="empty-state">
      <h2>Not signed in</h2>
      <p>Sign in to access the scanner.</p>
    </div>
  )

  if (!isConnected) return (
    <div className="empty-state">
      <h2>Connect your wallet</h2>
      <p style={{ marginBottom: '1.5rem' }}>Scanner requires MetaMask.</p>
      <button className="btn btn-primary" onClick={connect}>Connect Wallet</button>
    </div>
  )

  if (!isAdmin) return (
    <div className="empty-state">
      <h2>🚫 Access Denied</h2>
      <p>Scanner is restricted to admin only.</p>
    </div>
  )

  return (
    <div style={{ maxWidth: 500, margin: '0 auto' }}>
      <div className="page-header">
        <h1>🎫 Ticket Scanner</h1>
        <p>Verify tickets at the gate by entering the token ID.</p>
      </div>

      {!isOnSepolia && (
        <div className="alert alert-error" style={{ marginBottom: '1.5rem' }}>
          Switch to Sepolia to verify tickets.{' '}
          <button className="btn btn-danger" style={{ padding: '0.25rem 0.75rem', marginLeft: '0.75rem' }} onClick={switchToSepolia}>
            Switch Network
          </button>
        </div>
      )}

      {/* Result Card */}
      {result && (
        <div
          className="card"
          style={{
            marginBottom: '1.5rem',
            border: `2px solid ${result.valid ? 'var(--success, #10b981)' : 'var(--danger, #ef4444)'}`,
          }}
        >
          <h2 style={{ marginBottom: '1rem', color: result.valid ? 'var(--success, #10b981)' : 'var(--danger, #ef4444)' }}>
            {result.message}
          </h2>

          {result.ticket && (
            <>
              <p style={{ fontSize: '0.9rem', marginBottom: '0.4rem' }}>
                🎟 Token ID: <strong>#{result.tokenId}</strong>
              </p>
              <p style={{ fontSize: '0.9rem', marginBottom: '0.4rem' }}>
                🎪 Event: <strong>{result.event?.name || `#${Number(result.ticket.eventId)}`}</strong>
              </p>
              <p style={{ fontSize: '0.9rem', marginBottom: '0.4rem' }}>
                📍 Venue: {result.event?.venue || '—'}
              </p>
              <p style={{ fontSize: '0.9rem', marginBottom: '0.4rem' }}>
                💺 Seat: <strong>{result.ticket.seat}</strong>
              </p>
              <p style={{ fontSize: '0.9rem', marginBottom: '0.4rem' }}>
                🏷 Tier: <strong>{result.ticket.tier}</strong>
              </p>
              <p style={{ fontSize: '0.9rem', marginBottom: '0.4rem' }}>
                👤 Owner: {result.owner?.slice(0,6)}...{result.owner?.slice(-4)}
              </p>
              <p style={{ fontSize: '0.9rem', marginBottom: '0' }}>
                💰 Paid: {ethers.formatEther(result.ticket.originalPrice)} ETH
              </p>
            </>
          )}

          <button
            className="btn btn-outline"
            style={{ width: '100%', justifyContent: 'center', marginTop: '1.25rem' }}
            onClick={handleReset}
          >
            Scan Another
          </button>
        </div>
      )}

      {/* Input Form */}
      {!result && (
        <div className="card">
          {error && <div className="alert alert-error" style={{ marginBottom: '1rem' }}>{error}</div>}

          <div className="form-group">
            <label>Token ID</label>
            <input
              type="number"
              min="0"
              placeholder="e.g. 1"
              value={tokenInput}
              onChange={e => setTokenInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleVerify()}
            />
            <span style={{ fontSize: '0.8rem', color: 'var(--text)', marginTop: '0.25rem' }}>
              Enter the NFT token ID shown on the ticket QR
            </span>
          </div>

          <button
            className="btn btn-primary"
            style={{ width: '100%', justifyContent: 'center', padding: '0.75rem' }}
            onClick={handleVerify}
            disabled={verifying}
          >
            {verifying ? <><span className="spinner" /> Verifying...</> : '🔍 Verify Ticket'}
          </button>
        </div>
      )}
    </div>
  )
}