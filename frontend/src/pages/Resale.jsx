import { useState, useEffect } from 'react'
import { ethers } from 'ethers'
import { ADDRESSES, TICKET_NFT_ABI, TICKET_RESALE_ABI } from '../contracts/addresses'
import { useWallet } from '../hooks/useWallet'

const PUBLIC_RPC = import.meta.env.VITE_SEPOLIA_RPC_URL

export default function Resale() {
  const { isAuthed, isConnected, isOnSepolia, address, connect, switchToSepolia, getSigner, getProvider } = useWallet()

  const [listings, setListings]     = useState([])
  const [myTickets, setMyTickets]   = useState([])
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState(null)
  const [success, setSuccess]       = useState(null)
  const [tab, setTab]               = useState('browse')

  const [sellTokenId, setSellTokenId] = useState('')
  const [sellPrice, setSellPrice]     = useState('')
  const [selling, setSelling]         = useState(false)
  const [buying, setBuying]           = useState(null)

  useEffect(() => {
    if (isAuthed) fetchListings()
  }, [isAuthed])

  useEffect(() => {
    if (isConnected && isOnSepolia && tab === 'sell') fetchMyTickets()
  }, [isConnected, isOnSepolia, tab])

  async function fetchListings() {
    try {
      setLoading(true)
      setError(null)

      // Use public RPC for read-only browse — no wallet needed
      const provider = (isConnected && isOnSepolia)
        ? await getProvider()
        : new ethers.JsonRpcProvider(PUBLIC_RPC)

      const resale = new ethers.Contract(ADDRESSES.TicketResale, TICKET_RESALE_ABI, provider)

      // Contract maps tokenId => Listing with no totalListings().
      // Discover all ever-listed tokenIds via Listed event logs,
      // then call getListing() on each to check if still active.
      const listedLogs = await resale.queryFilter(resale.filters.Listed(), -100000)
      const tokenIds   = [...new Set(listedLogs.map(l => l.args.tokenId.toString()))]

      const active = []
      for (const tokenId of tokenIds) {
        try {
          const listing = await resale.getListing(BigInt(tokenId))
          if (listing.active) {
            active.push({
              tokenId: listing.tokenId,
              seller:  listing.seller,
              price:   listing.askPrice,
            })
          }
        } catch { /* skip */ }
      }

      setListings(active)
    } catch (err) {
      setError(err.message || 'Failed to load listings.')
    } finally {
      setLoading(false)
    }
  }

  async function fetchMyTickets() {
    try {
      const provider = await getProvider()
      const nft      = new ethers.Contract(ADDRESSES.TicketNFT, TICKET_NFT_ABI, provider)
      const filter   = nft.filters.Transfer(null, address)
      const logs     = await nft.queryFilter(filter, -100000)
      const tokenIds = [...new Set(logs.map(l => l.args.tokenId))]
      const owned    = []
      for (const tokenId of tokenIds) {
        try {
          const owner = await nft.ownerOf(tokenId)
          if (owner.toLowerCase() === address.toLowerCase()) {
            const data = await nft.getTicket(tokenId)
            owned.push({ tokenId, ...data })
          }
        } catch {}
      }
      setMyTickets(owned)
    } catch (err) {
      console.error(err)
    }
  }

  async function handleList() {
    if (!sellTokenId) { setError('Select a ticket to list.'); return }
    if (!sellPrice || isNaN(sellPrice) || Number(sellPrice) <= 0) {
      setError('Enter a valid price in ETH.')
      return
    }
    try {
      setSelling(true)
      setError(null)
      setSuccess(null)
      const signer   = await getSigner()
      const nft      = new ethers.Contract(ADDRESSES.TicketNFT, TICKET_NFT_ABI, signer)
      const resale   = new ethers.Contract(ADDRESSES.TicketResale, TICKET_RESALE_ABI, signer)
      const priceWei = ethers.parseEther(sellPrice)

      const approveTx = await nft.approve(ADDRESSES.TicketResale, sellTokenId)
      await approveTx.wait()

      const listTx = await resale.listTicket(sellTokenId, priceWei)
      await listTx.wait()

      setSuccess('🎉 Ticket listed for resale!')
      setSellTokenId('')
      setSellPrice('')
      fetchListings()
      fetchMyTickets()
    } catch (err) {
      setError(err.reason || err.message || 'Listing failed.')
    } finally {
      setSelling(false)
    }
  }

  async function handleBuy(tokenId, price) {
    try {
      setBuying(tokenId.toString())
      setError(null)
      setSuccess(null)
      const signer = await getSigner()
      const resale = new ethers.Contract(ADDRESSES.TicketResale, TICKET_RESALE_ABI, signer)
      const tx     = await resale.buyTicket(tokenId, { value: price })
      await tx.wait()
      setSuccess('🎉 Ticket purchased!')
      fetchListings()
    } catch (err) {
      setError(err.reason || err.message || 'Purchase failed.')
    } finally {
      setBuying(null)
    }
  }

  // ── Guards ────────────────────────────────────────────────────────────────

  if (!isAuthed) return (
    <div className="empty-state">
      <h2>Not signed in</h2>
      <p>Sign in to browse and list resale tickets.</p>
    </div>
  )

  return (
    <div>
      <div className="page-header">
        <h1>🔄 Ticket Resale</h1>
        <p>Buy and sell tickets fairly — 20% max markup enforced on-chain.</p>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '2rem' }}>
        <button className={`btn ${tab === 'browse' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setTab('browse')}>
          Browse Listings
        </button>
        <button className={`btn ${tab === 'sell' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setTab('sell')}>
          Sell My Ticket
        </button>
      </div>

      {error   && <div className="alert alert-error"   style={{ marginBottom: '1rem' }}>{error}</div>}
      {success && <div className="alert alert-success" style={{ marginBottom: '1rem' }}>{success}</div>}

      {/* ── Browse Tab ── */}
      {tab === 'browse' && (
        <>
          {!isConnected && (
            <div className="alert" style={{ marginBottom: '1.5rem', background: 'var(--card)', border: '1px solid var(--border)' }}>
              Connect MetaMask to buy resale tickets.{' '}
              <button className="btn btn-primary" style={{ padding: '0.25rem 0.75rem', marginLeft: '0.75rem' }} onClick={connect}>
                Connect Wallet
              </button>
            </div>
          )}
          {isConnected && !isOnSepolia && (
            <div className="alert alert-error" style={{ marginBottom: '1.5rem' }}>
              Switch to Sepolia to buy.{' '}
              <button className="btn btn-danger" style={{ padding: '0.25rem 0.75rem', marginLeft: '0.75rem' }} onClick={switchToSepolia}>
                Switch Network
              </button>
            </div>
          )}

          {loading && (
            <div style={{ textAlign: 'center', padding: '3rem' }}>
              <span className="spinner" style={{ width: 32, height: 32, borderWidth: 3 }} />
            </div>
          )}

          {!loading && listings.length === 0 && (
            <div className="empty-state">
              <h2>No listings yet</h2>
              <p>Be the first to list a ticket for resale.</p>
            </div>
          )}

          {!loading && listings.length > 0 && (
            <div className="card-grid">
              {listings.map((l, i) => {
                const priceEth = ethers.formatEther(l.price)
                const isMine   = l.seller?.toLowerCase() === address?.toLowerCase()
                const tokenKey = l.tokenId?.toString()
                return (
                  <div className="card" key={i}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                      <h3 style={{ margin: 0 }}>Token #{tokenKey}</h3>
                      <span className="badge badge-active">Listed</span>
                    </div>
                    <p style={{ fontSize: '0.9rem', marginBottom: '0.4rem' }}>
                      👤 Seller: {l.seller?.slice(0,6)}...{l.seller?.slice(-4)}
                    </p>
                    <p style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-h)', marginBottom: '1.25rem' }}>
                      💰 {priceEth} ETH
                    </p>
                    <button
                      className="btn btn-primary"
                      style={{ width: '100%', justifyContent: 'center' }}
                      onClick={() => handleBuy(l.tokenId, l.price)}
                      disabled={isMine || buying === tokenKey || !isConnected || !isOnSepolia}
                    >
                      {buying === tokenKey
                        ? <><span className="spinner" /> Buying...</>
                        : isMine
                          ? 'Your Listing'
                          : !isConnected
                            ? 'Connect Wallet to Buy'
                            : `Buy for ${priceEth} ETH`}
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* ── Sell Tab ── */}
      {tab === 'sell' && (
        <>
          {!isConnected && (
            <div className="empty-state">
              <h2>Connect your wallet</h2>
              <p style={{ marginBottom: '1.5rem' }}>MetaMask is needed to list tickets for resale.</p>
              <button className="btn btn-primary" onClick={connect}>Connect Wallet</button>
            </div>
          )}

          {isConnected && !isOnSepolia && (
            <div className="empty-state">
              <h2>Wrong Network</h2>
              <p style={{ marginBottom: '1.5rem' }}>Switch to Sepolia to list tickets.</p>
              <button className="btn btn-danger" onClick={switchToSepolia}>Switch to Sepolia</button>
            </div>
          )}

          {isConnected && isOnSepolia && (
            <div style={{ maxWidth: 480 }}>
              <div className="card">
                <h3 style={{ marginBottom: '1.25rem' }}>List a Ticket for Resale</h3>

                <div className="form-group">
                  <label>Select Ticket</label>
                  <select value={sellTokenId} onChange={e => setSellTokenId(e.target.value)}>
                    <option value="">-- Choose a ticket --</option>
                    {myTickets.map((t, i) => (
                      <option key={i} value={t.tokenId.toString()}>
                        Token #{t.tokenId.toString()} — {t.tier} · Seat {t.seat}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Resale Price (ETH)</label>
                  <input
                    type="number"
                    step="0.001"
                    min="0"
                    placeholder="e.g. 0.011"
                    value={sellPrice}
                    onChange={e => setSellPrice(e.target.value)}
                  />
                  <span style={{ fontSize: '0.8rem', color: 'var(--text)', marginTop: '0.25rem' }}>
                    Max 20% above original price — enforced on-chain
                  </span>
                </div>

                <button
                  className="btn btn-primary"
                  style={{ width: '100%', justifyContent: 'center', padding: '0.75rem' }}
                  onClick={handleList}
                  disabled={selling}
                >
                  {selling ? <><span className="spinner" /> Listing...</> : 'List for Resale'}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
