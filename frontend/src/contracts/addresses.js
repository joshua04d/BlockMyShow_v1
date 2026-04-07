// ── Deployed contract addresses on Sepolia ───────────────────────────────

export const ADDRESSES = {
  TicketPricing: "0x0d1cf59994a0dbBd7b64F7b5225c8cd972242214",
  TicketNFT:     "0x9420849e53cBb5e47953f2513e25547725369E81",
  EventManager:  "0x08d767b58984Ca245b1c6b1a09C4bED9084beEFD",
  Escrow:        "0xDD277bCacaAdf85d2109c54Bd6294c0834E0a321",
  TicketResale:  "0x4d0AD14268AB54A88cd7ceeDfd8bF6Bd4fB0F131",
}

// ── ABIs (matched to YOUR contracts) ────────────────────────────────────

export const EVENT_MANAGER_ABI = [
  "function nextEventId() view returns (uint256)",
  "function getEvent(uint256 eventId) view returns (tuple(uint256 eventId, string name, string venue, uint256 date, uint256 totalSeats, uint256 soldSeats, string tier, address organizer, bool active, bool cancelled, string metadataURI))",
  "function getActiveEvents() view returns (tuple(uint256 eventId, string name, string venue, uint256 date, uint256 totalSeats, uint256 soldSeats, string tier, address organizer, bool active, bool cancelled, string metadataURI)[])",
  "function getAllEvents() view returns (tuple(uint256 eventId, string name, string venue, uint256 date, uint256 totalSeats, uint256 soldSeats, string tier, address organizer, bool active, bool cancelled, string metadataURI)[])",
  "function buyTicket(uint256 eventId) payable returns (uint256)",
  "function getCurrentPrice(uint256 eventId) view returns (uint256)",
  "function getAvailableSeats(uint256 eventId) view returns (uint256)",
  "function approveOrganizer(address organizer)",
  "function cancelEvent(uint256 eventId)",
  "function createEvent(string name, string venue, uint256 date, uint256 totalSeats, string tier, string metadataURI) returns (uint256)",
  "event TicketPurchased(uint256 indexed eventId, address indexed buyer, uint256 tokenId, uint256 price)",
  "event EventCreated(uint256 indexed eventId, address indexed organizer, string name, uint256 date)",
]

export const TICKET_NFT_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function getTicket(uint256 tokenId) view returns (tuple(uint256 eventId, string seat, string tier, uint256 originalPrice, bool used))",
  "function getOriginalPrice(uint256 tokenId) view returns (uint256)",
  "function approve(address to, uint256 tokenId)",
  "function getApproved(uint256 tokenId) view returns (address)",
  "function isApprovedForAll(address owner, address operator) view returns (bool)",
  "function safeTransferFrom(address from, address to, uint256 tokenId)",
  "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)",
]

export const TICKET_PRICING_ABI = [
  "function getPrice(string tier) view returns (uint256)",
  "function setTierPrice(string tier, uint256 priceInWei)",
]

export const ESCROW_ABI = [
  "function getBalance(uint256 eventId) view returns (uint256)",
  "function claimRefund(uint256 eventId)",
  "function withdraw(uint256 eventId)",
]

export const TICKET_RESALE_ABI = [
  "function listTicket(uint256 tokenId, uint256 askPrice)",
  "function delistTicket(uint256 tokenId)",
  "function buyTicket(uint256 tokenId) payable",
  "function getListing(uint256 tokenId) view returns (tuple(address seller, uint256 tokenId, uint256 askPrice, bool active))",
  "function getMaxResalePrice(uint256 tokenId) view returns (uint256)",
  "function resaleCapPct() view returns (uint256)",
  "event Listed(uint256 indexed tokenId, address indexed seller, uint256 askPrice)",
  "event Delisted(uint256 indexed tokenId, address indexed seller)",
  "event Sold(uint256 indexed tokenId, address indexed seller, address indexed buyer, uint256 price)",
]
