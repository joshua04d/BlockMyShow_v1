// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./TicketNFT.sol";

/// @title TicketResale
/// @notice Secondary market for BlockMyShow tickets.
///         Resale price capped at (100 + resaleCapPct)% of original price.
contract TicketResale is Ownable, ReentrancyGuard {
    TicketNFT public ticketNFT;

    struct Listing {
        address seller;
        uint256 tokenId;
        uint256 askPrice;   // in wei
        bool    active;
    }

    // tokenId => Listing
    mapping(uint256 => Listing) public listings;

    // Platform fee on resales (basis points, default 5%)
    uint256 public platformFeeBps = 500;
    address public feeRecipient;

    // Max markup over original price (default 120 = 20% above original)
    uint256 public resaleCapPct = 120;

    event Listed(uint256 indexed tokenId, address indexed seller, uint256 askPrice);
    event Delisted(uint256 indexed tokenId, address indexed seller);
    event Sold(uint256 indexed tokenId, address indexed seller, address indexed buyer, uint256 price);

    constructor(address _ticketNFT, address _feeRecipient) Ownable() {
        ticketNFT = TicketNFT(_ticketNFT);
        feeRecipient = _feeRecipient;
    }

    // --- Seller Actions ---

    /// @notice List a ticket for resale
    function listTicket(uint256 tokenId, uint256 askPrice) external {
        require(ticketNFT.ownerOf(tokenId) == msg.sender, "Not your ticket");
        require(
            ticketNFT.getApproved(tokenId) == address(this) ||
            ticketNFT.isApprovedForAll(msg.sender, address(this)),
            "TicketResale not approved to transfer"
        );
        require(askPrice > 0, "Ask price must be > 0");

        // Enforce resale cap
        uint256 originalPrice = ticketNFT.getOriginalPrice(tokenId);
        uint256 maxAllowed = (originalPrice * resaleCapPct) / 100;
        require(askPrice <= maxAllowed, "Ask price exceeds resale cap");

        // Check ticket not used
        TicketNFT.TicketData memory data = ticketNFT.getTicket(tokenId);
        require(!data.used, "Ticket already used");

        listings[tokenId] = Listing({
            seller: msg.sender,
            tokenId: tokenId,
            askPrice: askPrice,
            active: true
        });

        emit Listed(tokenId, msg.sender, askPrice);
    }

    /// @notice Cancel a listing
    function delistTicket(uint256 tokenId) external {
        require(listings[tokenId].seller == msg.sender, "Not your listing");
        require(listings[tokenId].active, "Not active");
        listings[tokenId].active = false;
        emit Delisted(tokenId, msg.sender);
    }

    // --- Buyer Actions ---

    /// @notice Buy a listed ticket
    function buyTicket(uint256 tokenId) external payable nonReentrant {
        Listing storage listing = listings[tokenId];
        require(listing.active, "Listing not active");
        require(msg.value >= listing.askPrice, "Insufficient payment");

        // Verify seller still owns it
        require(ticketNFT.ownerOf(tokenId) == listing.seller, "Seller no longer owns ticket");

        // Verify ticket not used
        TicketNFT.TicketData memory data = ticketNFT.getTicket(tokenId);
        require(!data.used, "Ticket already used");

        listing.active = false;

        uint256 price = listing.askPrice;
        address seller = listing.seller;

        uint256 fee = (price * platformFeeBps) / 10000;
        uint256 sellerShare = price - fee;

        // Transfer NFT to buyer
        ticketNFT.safeTransferFrom(seller, msg.sender, tokenId);

        // Pay fee recipient
        (bool feeSuccess, ) = feeRecipient.call{value: fee}("");
        require(feeSuccess, "Fee transfer failed");

        // Pay seller
        (bool sellerSuccess, ) = seller.call{value: sellerShare}("");
        require(sellerSuccess, "Seller transfer failed");

        // Refund excess
        if (msg.value > price) {
            (bool refundSuccess, ) = msg.sender.call{value: msg.value - price}("");
            require(refundSuccess, "Refund failed");
        }

        emit Sold(tokenId, seller, msg.sender, price);
    }

    // --- Views ---

    function getListing(uint256 tokenId) external view returns (Listing memory) {
        return listings[tokenId];
    }

    function getMaxResalePrice(uint256 tokenId) external view returns (uint256) {
        uint256 originalPrice = ticketNFT.getOriginalPrice(tokenId);
        return (originalPrice * resaleCapPct) / 100;
    }

    // --- Admin ---

    function setResaleCapPct(uint256 pct) external onlyOwner {
        require(pct >= 100, "Cap must be >= 100%");
        require(pct <= 300, "Cap must be <= 300%");
        resaleCapPct = pct;
    }

    function setPlatformFee(uint256 bps) external onlyOwner {
        require(bps <= 1000, "Max 10%");
        platformFeeBps = bps;
    }

    function setFeeRecipient(address _feeRecipient) external onlyOwner {
        feeRecipient = _feeRecipient;
    }
}
