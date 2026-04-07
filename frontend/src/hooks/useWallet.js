import { useAuth, useUser } from '@clerk/clerk-react'
import { useMetaMask } from './useMetaMask'

// useWallet bridges Clerk auth + MetaMask into one hook
// isAuthed  = Clerk signed in only (browse events, view resale)
// isConnected = Clerk + MetaMask   (buy tickets, list resale)
export function useWallet() {
  const { isLoaded, isSignedIn } = useAuth()
  const { user } = useUser()
  const mm = useMetaMask()

  const isAuthed     = isSignedIn ?? false          // Clerk only
  const isConnected  = (isSignedIn ?? false) && mm.isConnected  // Clerk + MetaMask
  const isOnSepolia  = mm.isOnSepolia

  async function login() {
    // Clerk SignInButton handles this — fallback no-op
  }

  return {
    ready:           isLoaded,
    isAuthed,
    isConnected,
    isOnSepolia,
    user,
    address:         mm.address,
    shortAddress:    mm.shortAddress,
    chainId:         mm.chainId,
    connecting:      mm.connecting,
    error:           mm.error,
    connect:         mm.connect,
    disconnect:      mm.disconnect,
    switchToSepolia: mm.switchToSepolia,
    getSigner:       mm.getSigner,
    getProvider:     mm.getProvider,
    login,
  }
}
