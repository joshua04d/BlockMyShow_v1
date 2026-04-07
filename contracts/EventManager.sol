// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./TicketPricing.sol";
import "./TicketNFT.sol";

contract EventManager is Ownable, ReentrancyGuard {
    TicketPricing public pricingContract;
    TicketNFT public ticketNFT;

    struct Event {
        uint256 eventId;
        string name;
        string venue;
        uint256 date;           // Unix timestamp
        uint256 totalSeats;
        uint256 soldSeats;
        string tier;            // e.g. "VIP", "GENERAL" — maps to TicketPricing tier
        address organizer;
        bool active;
        bool cancelled;
        string metadataURI;
    }

    uint256 public nextEventId;
    mapping(uint256 => Event) public events;
    mapping(uint256 => mapping(address => uint256)) public ticketsBought;
    mapping(address => bool) public approvedOrganizers;

    uint256 public constant MAX_TICKETS_PER_BUYER = 5;
    uint256 public platformFeeBps = 250; // 2.5%
    address public feeRecipient;

    // --- Events ---
    event EventCreated(uint256 indexed eventId, address indexed organizer, string name, uint256 date);
    event EventCancelled(uint256 indexed eventId);
    event TicketPurchased(uint256 indexed eventId, address indexed buyer, uint256 tokenId, uint256 price);
    event OrganizerApproved(address indexed organizer);
    event OrganizerRevoked(address indexed organizer);

    modifier onlyOrganizer(uint256 eventId) {
        require(events[eventId].organizer == msg.sender || owner() == msg.sender, "Not organizer");
        _;
    }

    modifier eventExists(uint256 eventId) {
        require(eventId < nextEventId, "Event does not exist");
        _;
    }

    modifier eventActive(uint256 eventId) {
        require(events[eventId].active, "Event not active");
        require(!events[eventId].cancelled, "Event cancelled");
        require(events[eventId].date > block.timestamp, "Event already passed");
        _;
    }

    constructor(address _pricingContract, address _ticketNFT, address _feeRecipient) Ownable() {
        pricingContract = TicketPricing(_pricingContract);
        ticketNFT = TicketNFT(_ticketNFT);
        feeRecipient = _feeRecipient;
    }

    // --- Organizer Management ---

    function approveOrganizer(address organizer) external onlyOwner {
        approvedOrganizers[organizer] = true;
        emit OrganizerApproved(organizer);
    }

    function revokeOrganizer(address organizer) external onlyOwner {
        approvedOrganizers[organizer] = false;
        emit OrganizerRevoked(organizer);
    }

    // --- Event Management ---

    function createEvent(
        string calldata name,
        string calldata venue,
        uint256 date,
        uint256 totalSeats,
        string calldata tier,
        string calldata metadataURI
    ) external returns (uint256) {
        require(approvedOrganizers[msg.sender] || owner() == msg.sender, "Not approved organizer");
        require(date > block.timestamp, "Date must be in future");
        require(totalSeats > 0, "Must have at least 1 seat");
        // Verify the tier has a price configured in TicketPricing
        require(pricingContract.getPrice(tier) > 0, "Tier not configured in TicketPricing");

        uint256 eventId = nextEventId++;
        events[eventId] = Event({
            eventId: eventId,
            name: name,
            venue: venue,
            date: date,
            totalSeats: totalSeats,
            soldSeats: 0,
            tier: tier,
            organizer: msg.sender,
            active: true,
            cancelled: false,
            metadataURI: metadataURI
        });

        emit EventCreated(eventId, msg.sender, name, date);
        return eventId;
    }

    function cancelEvent(uint256 eventId)
        external
        eventExists(eventId)
        onlyOrganizer(eventId)
    {
        require(!events[eventId].cancelled, "Already cancelled");
        events[eventId].cancelled = true;
        events[eventId].active = false;
        emit EventCancelled(eventId);
    }

    function setEventActive(uint256 eventId, bool active)
        external
        eventExists(eventId)
        onlyOrganizer(eventId)
    {
        require(!events[eventId].cancelled, "Event is cancelled");
        events[eventId].active = active;
    }

    // --- Ticket Purchase ---

    function buyTicket(uint256 eventId)
        external
        payable
        nonReentrant
        eventExists(eventId)
        eventActive(eventId)
        returns (uint256 tokenId)
    {
        Event storage ev = events[eventId];
        require(ev.soldSeats < ev.totalSeats, "Sold out");
        require(ticketsBought[eventId][msg.sender] < MAX_TICKETS_PER_BUYER, "Max tickets reached");

        uint256 price = pricingContract.getPrice(ev.tier);
        require(msg.value >= price, "Insufficient payment");

        uint256 fee = (price * platformFeeBps) / 10000;
        uint256 organizerShare = price - fee;

        ev.soldSeats++;
        ticketsBought[eventId][msg.sender]++;

        // Mint NFT ticket
        tokenId = ticketNFT.mint(msg.sender, eventId, _toString(ev.soldSeats), ev.tier, price);

        // Transfer funds
        (bool feeSuccess, ) = feeRecipient.call{value: fee}("");
        require(feeSuccess, "Fee transfer failed");

        (bool orgSuccess, ) = ev.organizer.call{value: organizerShare}("");
        require(orgSuccess, "Organizer transfer failed");

        // Refund excess
        if (msg.value > price) {
            (bool refundSuccess, ) = msg.sender.call{value: msg.value - price}("");
            require(refundSuccess, "Refund failed");
        }

        emit TicketPurchased(eventId, msg.sender, tokenId, price);
    }

    // --- Views ---

    function getEvent(uint256 eventId) external view eventExists(eventId) returns (Event memory) {
        return events[eventId];
    }

    function getAvailableSeats(uint256 eventId) external view eventExists(eventId) returns (uint256) {
        return events[eventId].totalSeats - events[eventId].soldSeats;
    }

    function getCurrentPrice(uint256 eventId) external view eventExists(eventId) returns (uint256) {
        return pricingContract.getPrice(events[eventId].tier);
    }

    function getAllEvents() external view returns (Event[] memory) {
        Event[] memory allEvents = new Event[](nextEventId);
        for (uint256 i = 0; i < nextEventId; i++) {
            allEvents[i] = events[i];
        }
        return allEvents;
    }

    function getActiveEvents() external view returns (Event[] memory) {
        uint256 count = 0;
        for (uint256 i = 0; i < nextEventId; i++) {
            if (events[i].active && !events[i].cancelled && events[i].date > block.timestamp) {
                count++;
            }
        }
        Event[] memory activeEvents = new Event[](count);
        uint256 idx = 0;
        for (uint256 i = 0; i < nextEventId; i++) {
            if (events[i].active && !events[i].cancelled && events[i].date > block.timestamp) {
                activeEvents[idx++] = events[i];
            }
        }
        return activeEvents;
    }

    // --- Admin ---

    function setPlatformFee(uint256 bps) external onlyOwner {
        require(bps <= 1000, "Max 10%");
        platformFeeBps = bps;
    }

    function setFeeRecipient(address _feeRecipient) external onlyOwner {
        feeRecipient = _feeRecipient;
    }

    // --- Internal Helpers ---

    function _toString(uint256 value) internal pure returns (string memory) {
        if (value == 0) return "0";
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) { digits++; temp /= 10; }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits--;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }
        return string(buffer);
    }
}
