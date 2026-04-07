// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/// @title Escrow
/// @notice Holds funds per event. Organizer can withdraw after event date.
///         If event is cancelled, buyers can claim refunds.
contract Escrow is Ownable, ReentrancyGuard {

    struct EscrowRecord {
        address organizer;
        uint256 totalDeposited;
        uint256 totalRefunded;
        uint256 eventDate;
        bool cancelled;
        bool withdrawn;
    }

    // eventId => EscrowRecord
    mapping(uint256 => EscrowRecord) public escrows;

    // eventId => buyer => amount deposited
    mapping(uint256 => mapping(address => uint256)) public buyerDeposits;

    address public eventManager;

    event Deposited(uint256 indexed eventId, address indexed buyer, uint256 amount);
    event Withdrawn(uint256 indexed eventId, address indexed organizer, uint256 amount);
    event RefundClaimed(uint256 indexed eventId, address indexed buyer, uint256 amount);
    event EscrowInitialised(uint256 indexed eventId, address indexed organizer, uint256 eventDate);
    event EventMarkedCancelled(uint256 indexed eventId);

    modifier onlyEventManager() {
        require(msg.sender == eventManager, "Caller is not EventManager");
        _;
    }

    constructor() Ownable() {}

    /// @notice Set EventManager — called once after deployment
    function setEventManager(address _eventManager) external onlyOwner {
        require(_eventManager != address(0), "Zero address");
        eventManager = _eventManager;
    }

    /// @notice Initialise escrow record for a new event — called by EventManager on createEvent
    function initialiseEscrow(
        uint256 eventId,
        address organizer,
        uint256 eventDate
    ) external onlyEventManager {
        require(escrows[eventId].organizer == address(0), "Already initialised");
        escrows[eventId] = EscrowRecord({
            organizer: organizer,
            totalDeposited: 0,
            totalRefunded: 0,
            eventDate: eventDate,
            cancelled: false,
            withdrawn: false
        });
        emit EscrowInitialised(eventId, organizer, eventDate);
    }

    /// @notice Deposit funds for a buyer — called by EventManager on buyTicket
    function deposit(uint256 eventId, address buyer) external payable onlyEventManager {
        require(escrows[eventId].organizer != address(0), "Escrow not initialised");
        require(!escrows[eventId].cancelled, "Event cancelled");
        require(msg.value > 0, "No value sent");

        escrows[eventId].totalDeposited += msg.value;
        buyerDeposits[eventId][buyer] += msg.value;

        emit Deposited(eventId, buyer, msg.value);
    }

    /// @notice Mark event as cancelled — called by EventManager on cancelEvent
    function markCancelled(uint256 eventId) external onlyEventManager {
        require(escrows[eventId].organizer != address(0), "Escrow not initialised");
        require(!escrows[eventId].cancelled, "Already cancelled");
        escrows[eventId].cancelled = true;
        emit EventMarkedCancelled(eventId);
    }

    /// @notice Organizer withdraws funds after event date has passed
    function withdraw(uint256 eventId) external nonReentrant {
        EscrowRecord storage rec = escrows[eventId];
        require(rec.organizer == msg.sender, "Not organizer");
        require(!rec.cancelled, "Event cancelled - no withdrawal");
        require(block.timestamp >= rec.eventDate, "Event not yet happened");
        require(!rec.withdrawn, "Already withdrawn");
        require(rec.totalDeposited > rec.totalRefunded, "Nothing to withdraw");

        rec.withdrawn = true;
        uint256 amount = rec.totalDeposited - rec.totalRefunded;

        (bool success, ) = rec.organizer.call{value: amount}("");
        require(success, "Withdrawal failed");

        emit Withdrawn(eventId, rec.organizer, amount);
    }

    /// @notice Buyer claims refund if event was cancelled
    function claimRefund(uint256 eventId) external nonReentrant {
        EscrowRecord storage rec = escrows[eventId];
        require(rec.cancelled, "Event not cancelled");

        uint256 amount = buyerDeposits[eventId][msg.sender];
        require(amount > 0, "No deposit to refund");

        buyerDeposits[eventId][msg.sender] = 0;
        rec.totalRefunded += amount;

        (bool success, ) = msg.sender.call{value: amount}("");
        require(success, "Refund failed");

        emit RefundClaimed(eventId, msg.sender, amount);
    }

    /// @notice View escrow balance for an event
    function getBalance(uint256 eventId) external view returns (uint256) {
        EscrowRecord storage rec = escrows[eventId];
        return rec.totalDeposited - rec.totalRefunded;
    }

    /// @notice View buyer's deposit for an event
    function getBuyerDeposit(uint256 eventId, address buyer) external view returns (uint256) {
        return buyerDeposits[eventId][buyer];
    }
}
