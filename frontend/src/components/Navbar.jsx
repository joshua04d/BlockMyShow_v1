import { Link } from 'react-router-dom'
import { SignInButton, SignedIn, SignedOut, UserButton } from '@clerk/clerk-react'
import { useMetaMask } from '../hooks/useMetaMask'

const OWNER_ADDRESS = '0x382E7A5eA0C6d2DfDB77C3e464227AF45f4ECD9d'

export default function Navbar() {
  const {
    isConnected,
    isOnSepolia,
    shortAddress,
    connecting,
    connect,
    switchToSepolia,
    chainId,
    address,
  } = useMetaMask()

  const isAdmin = address?.toLowerCase() === OWNER_ADDRESS.toLowerCase()

  return (
    <nav className="navbar">
      <Link to="/" className="navbar-brand">
        Block<span>MyShow</span>
      </Link>

      <div className="navbar-links">
        <Link to="/">Home</Link>
        <SignedIn>
          <Link to="/events">Events</Link>
          <Link to="/submit-event">Submit Event</Link>
          <Link to="/my-tickets">My Tickets</Link>
          <Link to="/resale">Resale</Link>
          {isAdmin && (
            <>
              <Link to="/transparency" className="nav-link">Transparency</Link>
              <Link to="/admin" className="nav-link">Admin</Link>
              <Link to="/scan" className="nav-link">📷 Scanner</Link>
            </>
          )}
        </SignedIn>

        <SignedOut>
          <SignInButton mode="modal">
            <button className="btn btn-primary">Sign In</button>
          </SignInButton>
        </SignedOut>

        <SignedIn>
          {!isConnected ? (
            <button
              className="btn btn-outline"
              onClick={() => connect()}
              disabled={connecting}
            >
              {connecting ? <span className="spinner" /> : 'Connect Wallet'}
            </button>
          ) : chainId === null ? (
            <span className="wallet-address">Connecting...</span>
          ) : !isOnSepolia ? (
            <button className="btn btn-danger" onClick={switchToSepolia}>
              Switch to Sepolia
            </button>
          ) : (
            <span className="wallet-address">{shortAddress}</span>
          )}
          <UserButton afterSignOutUrl="/" />
        </SignedIn>
      </div>
    </nav>
  )
}
