// test/BlockMyShow.test.js
const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("BlockMyShow", function () {
  let ticketPricing, ticketNFT, eventManager, escrow, ticketResale;
  let owner, organizer, buyer1, buyer2, feeRecipient;

  const GENERAL_PRICE = ethers.parseEther("0.01");
  const VIP_PRICE     = ethers.parseEther("0.05");
  const ONE_DAY       = 86400;

  async function futureDate(offsetSeconds = ONE_DAY) {
    const block = await ethers.provider.getBlock("latest");
    return block.timestamp + offsetSeconds;
  }

  beforeEach(async () => {
    [owner, organizer, buyer1, buyer2, feeRecipient] = await ethers.getSigners();

    // Deploy
    const TicketPricing = await ethers.getContractFactory("TicketPricing");
    ticketPricing = await TicketPricing.deploy();

    const TicketNFT = await ethers.getContractFactory("TicketNFT");
    ticketNFT = await TicketNFT.deploy();

    const EventManager = await ethers.getContractFactory("EventManager");
    eventManager = await EventManager.deploy(
      await ticketPricing.getAddress(),
      await ticketNFT.getAddress(),
      feeRecipient.address
    );

    const Escrow = await ethers.getContractFactory("Escrow");
    escrow = await Escrow.deploy();

    const TicketResale = await ethers.getContractFactory("TicketResale");
    ticketResale = await TicketResale.deploy(
      await ticketNFT.getAddress(),
      feeRecipient.address
    );

    // Wire up
    await ticketNFT.setEventManager(await eventManager.getAddress());
    await escrow.setEventManager(await eventManager.getAddress());
    await ticketPricing.setTierPrice("GENERAL", GENERAL_PRICE);
    await ticketPricing.setTierPrice("VIP", VIP_PRICE);

    // Approve organizer
    await eventManager.connect(owner).approveOrganizer(organizer.address);
  });

  // ─── TicketPricing ───────────────────────────────────────────────────────────

  describe("TicketPricing", () => {
    it("owner can set tier price", async () => {
      await ticketPricing.setTierPrice("GOLD", ethers.parseEther("0.02"));
      expect(await ticketPricing.getPrice("GOLD")).to.equal(ethers.parseEther("0.02"));
    });

    it("non-owner cannot set tier price", async () => {
      await expect(
        ticketPricing.connect(buyer1).setTierPrice("GOLD", ethers.parseEther("0.02"))
      ).to.be.reverted;
    });

    it("reverts on unconfigured tier", async () => {
      await expect(ticketPricing.getPrice("UNKNOWN")).to.be.revertedWith("Tier not configured");
    });

    it("returns correct price for GENERAL", async () => {
      expect(await ticketPricing.getPrice("GENERAL")).to.equal(GENERAL_PRICE);
    });

    it("returns correct price for VIP", async () => {
      expect(await ticketPricing.getPrice("VIP")).to.equal(VIP_PRICE);
    });
  });

  // ─── TicketNFT ───────────────────────────────────────────────────────────────

  describe("TicketNFT", () => {
    it("only EventManager can mint", async () => {
      await expect(
        ticketNFT.connect(buyer1).mint(buyer1.address, 0, "1", "GENERAL", GENERAL_PRICE)
      ).to.be.revertedWith("Caller is not EventManager");
    });

    it("setEventManager can only be called by owner", async () => {
      await expect(
        ticketNFT.connect(buyer1).setEventManager(buyer1.address)
      ).to.be.reverted;
    });

    it("markUsed can only be called by EventManager", async () => {
      await expect(
        ticketNFT.connect(buyer1).markUsed(1)
      ).to.be.revertedWith("Caller is not EventManager");
    });
  });

  // ─── EventManager ────────────────────────────────────────────────────────────

  describe("EventManager", () => {
    it("approved organizer can create an event", async () => {
      const date = await futureDate();
      await expect(
        eventManager.connect(organizer).createEvent("Rock Fest", "Mumbai", date, 100, "GENERAL", "ipfs://test")
      ).to.emit(eventManager, "EventCreated");
    });

    it("unapproved address cannot create an event", async () => {
      const date = await futureDate();
      await expect(
        eventManager.connect(buyer1).createEvent("Rock Fest", "Mumbai", date, 100, "GENERAL", "ipfs://test")
      ).to.be.revertedWith("Not approved organizer");
    });

    it("cannot create event with unconfigured tier", async () => {
      const date = await futureDate();
      await expect(
        eventManager.connect(organizer).createEvent("Rock Fest", "Mumbai", date, 100, "UNKNOWN", "ipfs://test")
      ).to.be.reverted;
    });

    it("cannot create event in the past", async () => {
      const block = await ethers.provider.getBlock("latest");
      await expect(
        eventManager.connect(organizer).createEvent("Rock Fest", "Mumbai", block.timestamp - 1, 100, "GENERAL", "ipfs://test")
      ).to.be.revertedWith("Date must be in future");
    });

    it("buyer can purchase a ticket", async () => {
      const date = await futureDate();
      await eventManager.connect(organizer).createEvent("Rock Fest", "Mumbai", date, 100, "GENERAL", "ipfs://test");

      await expect(
        eventManager.connect(buyer1).buyTicket(0, { value: GENERAL_PRICE })
      ).to.emit(eventManager, "TicketPurchased");
    });

    it("reverts if payment is too low", async () => {
      const date = await futureDate();
      await eventManager.connect(organizer).createEvent("Rock Fest", "Mumbai", date, 100, "GENERAL", "ipfs://test");

      await expect(
        eventManager.connect(buyer1).buyTicket(0, { value: ethers.parseEther("0.001") })
      ).to.be.revertedWith("Insufficient payment");
    });

    it("soldSeats increments after purchase", async () => {
      const date = await futureDate();
      await eventManager.connect(organizer).createEvent("Rock Fest", "Mumbai", date, 100, "GENERAL", "ipfs://test");
      await eventManager.connect(buyer1).buyTicket(0, { value: GENERAL_PRICE });

      const available = await eventManager.getAvailableSeats(0);
      expect(available).to.equal(99); // 100 total - 1 sold
    });

    it("buyer cannot exceed MAX_TICKETS_PER_BUYER", async () => {
      const date = await futureDate();
      await eventManager.connect(organizer).createEvent("Rock Fest", "Mumbai", date, 100, "GENERAL", "ipfs://test");

      for (let i = 0; i < 5; i++) {
        await eventManager.connect(buyer1).buyTicket(0, { value: GENERAL_PRICE });
      }
      await expect(
        eventManager.connect(buyer1).buyTicket(0, { value: GENERAL_PRICE })
      ).to.be.revertedWith("Max tickets reached");
    });

    it("reverts when sold out", async () => {
      const date = await futureDate();
      await eventManager.connect(organizer).createEvent("Rock Fest", "Mumbai", date, 1, "GENERAL", "ipfs://test");
      await eventManager.connect(buyer1).buyTicket(0, { value: GENERAL_PRICE });

      await expect(
        eventManager.connect(buyer2).buyTicket(0, { value: GENERAL_PRICE })
      ).to.be.revertedWith("Sold out");
    });

    it("organizer can cancel event", async () => {
      const date = await futureDate();
      await eventManager.connect(organizer).createEvent("Rock Fest", "Mumbai", date, 100, "GENERAL", "ipfs://test");
      await expect(
        eventManager.connect(organizer).cancelEvent(0)
      ).to.emit(eventManager, "EventCancelled");
    });

    it("cannot buy ticket for cancelled event", async () => {
      const date = await futureDate();
      await eventManager.connect(organizer).createEvent("Rock Fest", "Mumbai", date, 100, "GENERAL", "ipfs://test");
      await eventManager.connect(organizer).cancelEvent(0);

      await expect(
        eventManager.connect(buyer1).buyTicket(0, { value: GENERAL_PRICE })
      ).to.be.revertedWith("Event not active");
    });

    it("getActiveEvents returns only active events", async () => {
      const date = await futureDate();
      await eventManager.connect(organizer).createEvent("Event A", "Mumbai", date, 100, "GENERAL", "ipfs://a");
      await eventManager.connect(organizer).createEvent("Event B", "Delhi", date, 100, "VIP", "ipfs://b");
      await eventManager.connect(organizer).cancelEvent(1);

      const active = await eventManager.getActiveEvents();
      expect(active.length).to.equal(1);
      expect(active[0].name).to.equal("Event A");
    });

    it("fee recipient receives platform fee on purchase", async () => {
      const date = await futureDate();
      await eventManager.connect(organizer).createEvent("Rock Fest", "Mumbai", date, 100, "GENERAL", "ipfs://test");

      const before = await ethers.provider.getBalance(feeRecipient.address);
      await eventManager.connect(buyer1).buyTicket(0, { value: GENERAL_PRICE });
      const after = await ethers.provider.getBalance(feeRecipient.address);

      const fee = (GENERAL_PRICE * 250n) / 10000n;
      expect(after - before).to.equal(fee);
    });
  });

  // ─── Escrow ──────────────────────────────────────────────────────────────────

  describe("Escrow", () => {
    it("only EventManager can initialise escrow", async () => {
      await expect(
        escrow.connect(buyer1).initialiseEscrow(0, organizer.address, 9999999999)
      ).to.be.revertedWith("Caller is not EventManager");
    });

    it("only EventManager can deposit", async () => {
      await expect(
        escrow.connect(buyer1).deposit(0, buyer1.address, { value: GENERAL_PRICE })
      ).to.be.revertedWith("Caller is not EventManager");
    });

    it("only EventManager can mark cancelled", async () => {
      await expect(
        escrow.connect(buyer1).markCancelled(0)
      ).to.be.revertedWith("Caller is not EventManager");
    });
  });

  // ─── TicketResale ─────────────────────────────────────────────────────────────

  describe("TicketResale", () => {
    let tokenId;

    beforeEach(async () => {
      const date = await futureDate();
      await eventManager.connect(organizer).createEvent("Rock Fest", "Mumbai", date, 100, "GENERAL", "ipfs://test");
      const tx = await eventManager.connect(buyer1).buyTicket(0, { value: GENERAL_PRICE });
      const receipt = await tx.wait();
      // tokenId is 1 (first mint)
      tokenId = 1n;
    });

    it("buyer can list ticket for resale within cap", async () => {
      await ticketNFT.connect(buyer1).approve(await ticketResale.getAddress(), tokenId);
      const maxPrice = await ticketResale.getMaxResalePrice(tokenId);

      await expect(
        ticketResale.connect(buyer1).listTicket(tokenId, maxPrice)
      ).to.emit(ticketResale, "Listed");
    });

    it("cannot list above resale cap", async () => {
      await ticketNFT.connect(buyer1).approve(await ticketResale.getAddress(), tokenId);
      const tooHigh = ethers.parseEther("1");

      await expect(
        ticketResale.connect(buyer1).listTicket(tokenId, tooHigh)
      ).to.be.revertedWith("Ask price exceeds resale cap");
    });

    it("non-owner cannot list ticket", async () => {
      await expect(
        ticketResale.connect(buyer2).listTicket(tokenId, GENERAL_PRICE)
      ).to.be.revertedWith("Not your ticket");
    });

    it("buyer2 can buy a listed ticket", async () => {
      await ticketNFT.connect(buyer1).approve(await ticketResale.getAddress(), tokenId);
      const askPrice = GENERAL_PRICE; // within cap (120% of 0.01)
      await ticketResale.connect(buyer1).listTicket(tokenId, askPrice);

      await expect(
        ticketResale.connect(buyer2).buyTicket(tokenId, { value: askPrice })
      ).to.emit(ticketResale, "Sold");

      expect(await ticketNFT.ownerOf(tokenId)).to.equal(buyer2.address);
    });

    it("seller can delist a ticket", async () => {
      await ticketNFT.connect(buyer1).approve(await ticketResale.getAddress(), tokenId);
      await ticketResale.connect(buyer1).listTicket(tokenId, GENERAL_PRICE);

      await expect(
        ticketResale.connect(buyer1).delistTicket(tokenId)
      ).to.emit(ticketResale, "Delisted");

      const listing = await ticketResale.getListing(tokenId);
      expect(listing.active).to.equal(false);
    });

    it("cannot buy delisted ticket", async () => {
      await ticketNFT.connect(buyer1).approve(await ticketResale.getAddress(), tokenId);
      await ticketResale.connect(buyer1).listTicket(tokenId, GENERAL_PRICE);
      await ticketResale.connect(buyer1).delistTicket(tokenId);

      await expect(
        ticketResale.connect(buyer2).buyTicket(tokenId, { value: GENERAL_PRICE })
      ).to.be.revertedWith("Listing not active");
    });

    it("admin can update resale cap", async () => {
      await ticketResale.connect(owner).setResaleCapPct(150);
      expect(await ticketResale.resaleCapPct()).to.equal(150);
    });

    it("resale cap cannot be set below 100", async () => {
      await expect(
        ticketResale.connect(owner).setResaleCapPct(90)
      ).to.be.revertedWith("Cap must be >= 100%");
    });
  });
});