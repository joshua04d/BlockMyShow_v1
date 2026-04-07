# BlockMyShow

A decentralized NFT ticketing platform built on Ethereum Sepolia. Users buy tickets as ERC-721 NFTs, admins manage events, and resale is capped on-chain.

---

## Stack

| Layer | Tech | Version |
|-------|------|---------|
| Runtime | Node.js | v22.x |
| Solidity | Solidity | 0.8.20 |
| Framework | Hardhat | 2.22.0 |
| Toolbox | @nomicfoundation/hardhat-toolbox | hh2 |
| Contracts | OpenZeppelin | 4.9.6 |
| Frontend | React + Vite | 19 + 5.4.x |
| Auth | Clerk | latest |
| Wallet | MetaMask (ethers.js v6) | 6.x |
| Network | Ethereum Sepolia testnet | — |

---

## Project Structure

```
BlockMyShow/
├── contracts/
│   ├── TicketNFT.sol         # ERC-721 ticket, on-chain metadata
│   ├── TicketPricing.sol     # Static pricing per tier, swappable
│   ├── EventManager.sol      # Core orchestrator, event lifecycle
│   ├── Escrow.sol            # Holds ETH, releases on completion
│   └── TicketResale.sol      # Secondary market, variable resale cap
├── scripts/
│   └── deploy.js             # Deploys and wires all 5 contracts
├── test/
│   └── BlockMyShow.test.js   # 17 tests covering all contracts
├── frontend/
│   └── src/
│       ├── components/       # Navbar, EventCard, TicketQR
│       ├── pages/            # Landing, Events, BuyTicket, MyTickets, Resale, Admin, Scanner
│       ├── hooks/            # useMetaMask.js
│       └── contracts/        # addresses.js (deployed contract addresses + ABIs)
├── hardhat.config.js
├── .env                      # SEPOLIA_RPC_URL, PRIVATE_KEY, ETHERSCAN_API_KEY
└── README.md
```

---

## Contract Architecture

```
Owner (deployer wallet)
├── EventManager.sol          ← core orchestrator
│   ├── creates events
│   ├── approves admins
│   ├── mints tickets via TicketNFT
│   └── triggers escrow release
├── TicketNFT.sol             ← ERC-721, minted only by EventManager
│   └── stores: eventId, seat, tier, originalPrice on-chain
├── Escrow.sol                ← holds ETH per event
│   ├── releases on completeEvent()
│   └── refunds on cancelEvent()
├── TicketResale.sol          ← secondary market
│   └── variable resale cap (basis points), set by admin per event or globally
└── TicketPricing.sol         ← static pricing, swappable architecture
```

---

## Key Rules

- **Minting**: Only EventManager can call TicketNFT.mint()
- **Escrow**: ETH held per-event, released by owner; refunds on cancellation
- **Resale**: Cap is variable (default 10%), admin can set globally or per event
- **Admins**: Owner approves admins; admins manage events but cannot withdraw funds
- **Scanner**: Approved admins can mark tickets as used at the gate

---

## Routes

| Route | Access | Description |
|-------|--------|-------------|
| / | Public | Landing page, event teasers |
| /events | Clerk auth | Full event listings |
| /buy/:eventId | Clerk auth | Purchase ticket |
| /my-tickets | Clerk auth | View NFTs + QR codes |
| /resale | Clerk auth | Browse and list resale tickets |
| /admin | Clerk + MetaMask + owner | Event management, pricing, escrow |
| /scanner | Clerk + MetaMask + approved admin | QR scan, mark ticket used |

---

## Setup

```bash
# Install dependencies
npm install

# Compile contracts
npx hardhat compile

# Run tests
npx hardhat test

# Deploy to Sepolia
npx hardhat run scripts/deploy.js --network sepolia

# Start frontend
cd frontend
npm run dev
```

---

## Environment Variables

Root `.env`:
```
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY
PRIVATE_KEY=YOUR_DEPLOYER_PRIVATE_KEY
ETHERSCAN_API_KEY=YOUR_ETHERSCAN_KEY
```

Frontend `.env.local`:
```
VITE_CLERK_PUBLISHABLE_KEY=pk_test_YOUR_CLERK_KEY
VITE_ALCHEMY_KEY=YOUR_ALCHEMY_KEY
```