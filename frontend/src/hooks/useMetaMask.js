import { useState, useEffect, useCallback } from 'react'
import { ethers } from 'ethers'

const SEPOLIA_CHAIN_ID = '0xaa36a7'

export function useMetaMask() {
  const [provider, setProvider]     = useState(null)
  const [signer, setSigner]         = useState(null)
  const [address, setAddress]       = useState(null)
  const [chainId, setChainId]       = useState(null)
  const [connecting, setConnecting] = useState(false)
  const [error, setError]           = useState(null)

  const isConnected  = !!address
  const isOnSepolia  = chainId === SEPOLIA_CHAIN_ID
  const shortAddress = address
    ? `${address.slice(0, 6)}...${address.slice(-4)}`
    : null

  async function initProvider() {
    const _provider = new ethers.BrowserProvider(window.ethereum)
    const _signer   = await _provider.getSigner()
    const _address  = await _signer.getAddress()
    const network   = await _provider.getNetwork()
    const _chainId  = '0x' + network.chainId.toString(16)
    setProvider(_provider)
    setSigner(_signer)
    setAddress(_address)
    setChainId(_chainId)
    return { provider: _provider, signer: _signer }
  }

  const connect = useCallback(async (silent = false) => {
    if (!window.ethereum) {
      setError('MetaMask not found. Please install it.')
      return
    }
    try {
      setConnecting(true)
      setError(null)
      if (!silent) {
        await window.ethereum.request({ method: 'eth_requestAccounts' })
      }
      await initProvider()
    } catch (err) {
      if (!silent) setError(err.message || 'Connection failed')
    } finally {
      setConnecting(false)
    }
  }, [])

  const disconnect = useCallback(() => {
    setProvider(null)
    setSigner(null)
    setAddress(null)
    setChainId(null)
  }, [])

  const switchToSepolia = useCallback(async () => {
    if (!window.ethereum) return
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: SEPOLIA_CHAIN_ID }],
      })
    } catch (err) {
      if (err.code === 4902) {
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId: SEPOLIA_CHAIN_ID,
            chainName: 'Sepolia Testnet',
            nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
            rpcUrls: ['https://rpc.sepolia.org'],
            blockExplorerUrls: ['https://sepolia.etherscan.io'],
          }],
        })
      } else {
        setError('Could not switch to Sepolia.')
      }
    }
  }, [])

  useEffect(() => {
    if (!window.ethereum) return
    window.ethereum.request({ method: 'eth_accounts' }).then(accounts => {
      if (accounts.length > 0) connect(true)
    })
  }, [])

  useEffect(() => {
    if (!window.ethereum) return
    const onAccountsChanged = (accounts) => {
      if (accounts.length === 0) disconnect()
      else { setAddress(accounts[0]); initProvider() }
    }
    const onChainChanged = () => window.location.reload()
    window.ethereum.on('accountsChanged', onAccountsChanged)
    window.ethereum.on('chainChanged', onChainChanged)
    return () => {
      window.ethereum.removeListener('accountsChanged', onAccountsChanged)
      window.ethereum.removeListener('chainChanged', onChainChanged)
    }
  }, [])

  async function getSigner()   { return signer }
  async function getProvider() { return provider }

  return {
    provider, signer, address, chainId,
    connecting, error,
    isConnected, isOnSepolia, shortAddress,
    connect, disconnect, switchToSepolia,
    getSigner, getProvider,
  }
}
