import { useState, useEffect } from 'react'
import { ethers } from 'ethers'
import {
  ADDRESSES,
  EVENT_MANAGER_ABI,
  TICKET_NFT_ABI,
  TICKET_RESALE_ABI,
} from '../contracts/addresses'


function getReadProvider() {
  if (window.ethereum) return new ethers.BrowserProvider(window.ethereum)
  throw new Error('MetaMask not found — please install it.')
}

function shortAddr(addr) {
  if (!addr) return '—'
  return addr.slice(0, 6) + '...' + addr.slice(-4)
}

function formatDate(ts) {
  if (!ts) return '—'
  return new Date(Number(ts) * 1000).toLocaleString()
}

function formatEth(wei) {
  try { return ethers.formatEther(wei) + ' ETH' } catch { return '—' }
}

// ─── Section: Contract Addresses ────────────────────────────────────────────
function ContractAddresses() {
  const contracts = [
    { name: 'EventManager', address: ADDRESSES.EventManager },
    { name: 'TicketNFT',    address: ADDRESSES.TicketNFT },
    { name: 'TicketPricing',address: ADDRESSES.TicketPricing },
    { name: 'Escrow',       address: ADDRESSES.Escrow },
    { name: 'TicketResale', address: ADDRESSES.TicketResale },
  ]
  return (
    <section className="t-section">
      <h2 className="t-section-title">🔗 Contract Addresses</h2>
      <p className="t-section-sub">All contracts are verified and publicly auditable on Sepolia Etherscan.</p>
      <div className="t-table-wrap">
        <table className="t-table">
          <thead>
            <tr><th>Contract</th><th>Address</th><th>Etherscan</th></tr>
          </thead>
          <tbody>
            {contracts.map(c => (
              <tr key={c.name}>
                <td><span className="t-badge">{c.name}</span></td>
                <td><code className="t-code">{c.address}</code></td>
                <td>
                  <a
                    href={`https://sepolia.etherscan.io/address/${c.address}`}
                    target="_blank" rel="noreferrer"
                    className="t-link"
                  >↗ View</a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

// ─── Section: All Events ─────────────────────────────────────────────────────
function AllEvents() {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function load() {
      try {
        const provider = getReadProvider()
        const contract = new ethers.Contract(ADDRESSES.EventManager, EVENT_MANAGER_ABI, provider)
        const raw = await contract.getAllEvents()
        setEvents(raw.map(e => ({
          eventId:    e.eventId,
          name:       e.name,
          venue:      e.venue,
          date:       e.date,
          totalSeats: e.totalSeats,
          soldSeats:  e.soldSeats,
          tier:       e.tier,
          organizer:  e.organizer,
          active:     e.active,
          cancelled:  e.cancelled,
        })))
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  return (
    <section className="t-section">
      <h2 className="t-section-title">🎪 All Events</h2>
      <p className="t-section-sub">Every event ever created on-chain — approved, active, or cancelled.</p>
      {loading && <Spinner />}
      {error && !error.includes('eth_getLogs') && !error.includes('block range') && (
  <div className="alert alert-error">{error}</div>
)}
      {!loading && !error && events.length === 0 && <div className="t-empty">No events on-chain yet.</div>}
      {!loading && events.length > 0 && (
        <div className="t-table-wrap">
          <table className="t-table">
            <thead>
              <tr>
                <th>#</th><th>Name</th><th>Venue</th><th>Date</th>
                <th>Tier</th><th>Seats</th><th>Sold</th><th>Organizer</th><th>Status</th>
              </tr>
            </thead>
            <tbody>
              {events.map(ev => (
                <tr key={ev.eventId.toString()}>
                  <td>{ev.eventId.toString()}</td>
                  <td><strong>{ev.name}</strong></td>
                  <td>{ev.venue}</td>
                  <td>{formatDate(ev.date)}</td>
                  <td><span className="t-badge">{ev.tier}</span></td>
                  <td>{ev.totalSeats.toString()}</td>
                  <td>{ev.soldSeats.toString()}</td>
                  <td>
                    <a
                      href={`https://sepolia.etherscan.io/address/${ev.organizer}`}
                      target="_blank" rel="noreferrer"
                      className="t-link"
                    >{shortAddr(ev.organizer)}</a>
                  </td>
                  <td>
                    {ev.cancelled
                      ? <span className="t-status cancelled">Cancelled</span>
                      : ev.active
                        ? <span className="t-status active">Active</span>
                        : <span className="t-status pending">Pending</span>
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

// ─── Section: Tickets Minted ─────────────────────────────────────────────────
function TicketsMinted() {
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function load() {
      try {
        const provider = getReadProvider()
        const eventContract  = new ethers.Contract(ADDRESSES.EventManager, EVENT_MANAGER_ABI, provider)
        const ticketContract = new ethers.Contract(ADDRESSES.TicketNFT, TICKET_NFT_ABI, provider)

        // Fetch purchase events from EventManager
        const filter = eventContract.filters.TicketPurchased()
        const logs   = await eventContract.queryFilter(filter, 0, 'latest')

        const result = await Promise.all(logs.map(async log => {
          const { eventId, buyer, tokenId, price } = log.args
          let owner = buyer
          try { owner = await ticketContract.ownerOf(tokenId) } catch {}
          return {
            tokenId:  tokenId.toString(),
            eventId:  eventId.toString(),
            buyer:    buyer,
            owner:    owner,
            price:    price,
            txHash:   log.transactionHash,
            block:    log.blockNumber,
          }
        }))
        setTickets(result)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  return (
    <section className="t-section">
      <h2 className="t-section-title">🎟 Tickets Minted</h2>
      <p className="t-section-sub">Every ticket NFT minted on-chain — original buyer and current owner.</p>
      {loading && <Spinner />}
      {error && <div className="t-error">{error}</div>}
      {!loading && !error && tickets.length === 0 && <div className="t-empty">No tickets minted yet.</div>}
      {!loading && tickets.length > 0 && (
        <div className="t-table-wrap">
          <table className="t-table">
            <thead>
              <tr>
                <th>Token ID</th><th>Event #</th><th>Price Paid</th>
                <th>Original Buyer</th><th>Current Owner</th><th>Tx</th>
              </tr>
            </thead>
            <tbody>
              {tickets.map(t => (
                <tr key={t.tokenId}>
                  <td><span className="t-badge">#{t.tokenId}</span></td>
                  <td>{t.eventId}</td>
                  <td>{formatEth(t.price)}</td>
                  <td>
                    <a href={`https://sepolia.etherscan.io/address/${t.buyer}`} target="_blank" rel="noreferrer" className="t-link">
                      {shortAddr(t.buyer)}
                    </a>
                  </td>
                  <td>
                    <a href={`https://sepolia.etherscan.io/address/${t.owner}`} target="_blank" rel="noreferrer" className="t-link">
                      {shortAddr(t.owner)}
                    </a>
                  </td>
                  <td>
                    <a href={`https://sepolia.etherscan.io/tx/${t.txHash}`} target="_blank" rel="noreferrer" className="t-link">
                      ↗ Tx
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

// ─── Section: Resale History ─────────────────────────────────────────────────
function ResaleHistory() {
  const [sales, setSales] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function load() {
      try {
        const provider = getReadProvider()
        const resaleContract = new ethers.Contract(ADDRESSES.TicketResale, TICKET_RESALE_ABI, provider)

        const filter = resaleContract.filters.Sold()
        const logs   = await resaleContract.queryFilter(filter, 0, 'latest')

        setSales(logs.map(log => ({
          tokenId: log.args.tokenId.toString(),
          seller:  log.args.seller,
          buyer:   log.args.buyer,
          price:   log.args.price,
          txHash:  log.transactionHash,
          block:   log.blockNumber,
        })))
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  return (
    <section className="t-section">
      <h2 className="t-section-title">🔄 Resale History</h2>
      <p className="t-section-sub">Every secondary sale — seller, buyer, and price — all verifiable on-chain.</p>
      {loading && <Spinner />}
      {error && <div className="t-error">{error}</div>}
      {!loading && !error && sales.length === 0 && <div className="t-empty">No resales have occurred yet.</div>}
      {!loading && sales.length > 0 && (
        <div className="t-table-wrap">
          <table className="t-table">
            <thead>
              <tr>
                <th>Token ID</th><th>Seller</th><th>Buyer</th><th>Price</th><th>Tx</th>
              </tr>
            </thead>
            <tbody>
              {sales.map((s, i) => (
                <tr key={i}>
                  <td><span className="t-badge">#{s.tokenId}</span></td>
                  <td>
                    <a href={`https://sepolia.etherscan.io/address/${s.seller}`} target="_blank" rel="noreferrer" className="t-link">
                      {shortAddr(s.seller)}
                    </a>
                  </td>
                  <td>
                    <a href={`https://sepolia.etherscan.io/address/${s.buyer}`} target="_blank" rel="noreferrer" className="t-link">
                      {shortAddr(s.buyer)}
                    </a>
                  </td>
                  <td>{formatEth(s.price)}</td>
                  <td>
                    <a href={`https://sepolia.etherscan.io/tx/${s.txHash}`} target="_blank" rel="noreferrer" className="t-link">
                      ↗ Tx
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

function Spinner() {
  return (
    <div style={{ textAlign: 'center', padding: '2rem' }}>
      <span className="spinner" style={{ width: 28, height: 28, borderWidth: 3 }} />
    </div>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────
export default function Transparency() {
  return (
    <div className="t-page">
      <div className="page-header">
        <h1>🔍 On-Chain Transparency</h1>
        <p>
          BlockMyShow runs entirely on Ethereum (Sepolia). Every event, ticket, and resale
          is publicly verifiable — no hidden data, no manipulation possible.
        </p>
      </div>

      <ContractAddresses />
      <AllEvents />
      <TicketsMinted />
      <ResaleHistory />

      <style>{`
        .t-page {
          max-width: 1100px;
          margin: 0 auto;
          padding-bottom: 4rem;
        }
        .t-section {
          margin-top: 3rem;
          background: var(--card-bg, #1a1a2e);
          border: 1px solid var(--border, rgba(255,255,255,0.08));
          border-radius: 12px;
          padding: 2rem;
        }
        .t-section-title {
          font-size: 1.3rem;
          font-weight: 700;
          margin: 0 0 0.4rem 0;
        }
        .t-section-sub {
          color: var(--text-muted, #aaa);
          font-size: 0.9rem;
          margin: 0 0 1.5rem 0;
        }
        .t-table-wrap {
          overflow-x: auto;
        }
        .t-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.875rem;
        }
        .t-table th {
          text-align: left;
          padding: 0.6rem 0.8rem;
          border-bottom: 1px solid var(--border, rgba(255,255,255,0.1));
          color: var(--text-muted, #aaa);
          font-weight: 600;
          white-space: nowrap;
        }
        .t-table td {
          padding: 0.65rem 0.8rem;
          border-bottom: 1px solid var(--border, rgba(255,255,255,0.05));
          vertical-align: middle;
        }
        .t-table tr:last-child td { border-bottom: none; }
        .t-table tr:hover td { background: rgba(255,255,255,0.03); }
        .t-badge {
          background: rgba(99,102,241,0.15);
          color: #818cf8;
          border: 1px solid rgba(99,102,241,0.3);
          border-radius: 6px;
          padding: 2px 8px;
          font-size: 0.78rem;
          font-weight: 600;
          white-space: nowrap;
        }
        .t-code {
          font-family: monospace;
          font-size: 0.78rem;
          color: var(--text-muted, #aaa);
          word-break: break-all;
        }
        .t-link {
          color: #60a5fa;
          text-decoration: none;
          font-weight: 500;
        }
        .t-link:hover { text-decoration: underline; }
        .t-status {
          border-radius: 6px;
          padding: 2px 10px;
          font-size: 0.78rem;
          font-weight: 700;
        }
        .t-status.active    { background: rgba(34,197,94,0.15);  color: #4ade80; border: 1px solid rgba(34,197,94,0.3); }
        .t-status.cancelled { background: rgba(239,68,68,0.15);  color: #f87171; border: 1px solid rgba(239,68,68,0.3); }
        .t-status.pending   { background: rgba(234,179,8,0.15);  color: #facc15; border: 1px solid rgba(234,179,8,0.3); }
        .t-error { color: #f87171; padding: 1rem; background: rgba(239,68,68,0.1); border-radius: 8px; }
        .t-empty { color: var(--text-muted, #aaa); text-align: center; padding: 2rem; }
      `}</style>
    </div>
  )
}
