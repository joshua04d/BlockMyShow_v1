import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { SignInButton, SignedIn, SignedOut, UserButton } from '@clerk/clerk-react'
import { useMetaMask } from '../hooks/useMetaMask'

const OWNER_ADDRESS = '0x382E7A5eA0C6d2DfDB77C3e464227AF45f4ECD9d'

const NAV_LINKS = [
  { to: '/',             label: 'Home',         icon: '🏠' },
  { to: '/events',       label: 'Events',       icon: '🎪', authRequired: true },
  { to: '/submit-event', label: 'Submit Event', icon: '📝', authRequired: true },
  { to: '/my-tickets',   label: 'My Tickets',   icon: '🎟',  authRequired: true },
  { to: '/resale',       label: 'Resale',       icon: '🔄', authRequired: true },
  { to: '/transparency', label: 'Transparency', icon: '🔍', adminOnly: true },
  { to: '/admin',        label: 'Admin',        icon: '⚙️',  adminOnly: true },
  { to: '/scan',         label: 'Scanner',      icon: '📷', adminOnly: true },
]

export default function Sidebar() {
  const location = useLocation()
  const [collapsed, setCollapsed] = useState(false)
  const { isConnected, isOnSepolia, shortAddress, connecting, connect, switchToSepolia, chainId, address } = useMetaMask()
  const isAdmin = address?.toLowerCase() === OWNER_ADDRESS.toLowerCase()

  return (
    <aside className={`sidebar ${collapsed ? 'sidebar-collapsed' : ''}`}>
      {/* Brand */}
      <div className="sidebar-brand">
        {!collapsed && (
          <Link to="/" className="sidebar-logo">
            Block<span>MyShow</span>
          </Link>
        )}
        <button className="sidebar-toggle" onClick={() => setCollapsed(v => !v)} title="Toggle sidebar">
          {collapsed ? '→' : '←'}
        </button>
      </div>

      {/* Nav links */}
      <nav className="sidebar-nav">
        <SignedOut>
          {/* Only show Home when signed out */}
          <Link to="/" className={`sidebar-link ${location.pathname === '/' ? 'active' : ''}`}>
            <span className="sidebar-icon">🏠</span>
            {!collapsed && <span>Home</span>}
          </Link>
        </SignedOut>

        <SignedIn>
          {NAV_LINKS.filter(l => !l.adminOnly).map(link => (
            <Link
              key={link.to}
              to={link.to}
              className={`sidebar-link ${location.pathname === link.to ? 'active' : ''}`}
              title={collapsed ? link.label : undefined}
            >
              <span className="sidebar-icon">{link.icon}</span>
              {!collapsed && <span>{link.label}</span>}
            </Link>
          ))}

          {isAdmin && (
            <>
              <div className="sidebar-divider" />
              {NAV_LINKS.filter(l => l.adminOnly).map(link => (
                <Link
                  key={link.to}
                  to={link.to}
                  className={`sidebar-link ${location.pathname === link.to ? 'active' : ''}`}
                  title={collapsed ? link.label : undefined}
                >
                  <span className="sidebar-icon">{link.icon}</span>
                  {!collapsed && <span>{link.label}</span>}
                </Link>
              ))}
            </>
          )}
        </SignedIn>
      </nav>

      {/* Bottom: wallet + auth */}
      <div className="sidebar-footer">
        <SignedOut>
          <SignInButton mode="modal">
            <button className="btn btn-primary sidebar-signin">
              {collapsed ? '🔑' : 'Sign In'}
            </button>
          </SignInButton>
        </SignedOut>

        <SignedIn>
          {/* Wallet button */}
          {!isConnected ? (
            <button
              className="btn btn-outline sidebar-wallet"
              onClick={() => connect()}
              disabled={connecting}
              title="Connect Wallet"
            >
              {connecting
                ? <span className="spinner" />
                : collapsed ? '🦊' : '🦊 Connect Wallet'
              }
            </button>
          ) : !isOnSepolia ? (
            <button className="btn btn-danger sidebar-wallet" onClick={switchToSepolia} title="Switch to Sepolia">
              {collapsed ? '⚠️' : '⚠️ Switch Network'}
            </button>
          ) : (
            <div className="sidebar-wallet-info" title={address}>
              <span className="wallet-dot" />
              {!collapsed && <span className="wallet-addr">{shortAddress}</span>}
            </div>
          )}

          {/* User avatar */}
          <div className="sidebar-user">
            <UserButton afterSignOutUrl="/" />
          </div>
        </SignedIn>
      </div>
    </aside>
  )
}
