// scripts/createTestEvent.js
// Creates two test events on Sepolia (GENERAL + VIP) so you can test the buy flow
const hre = require("hardhat");

const ADDRESSES = {
  TicketPricing: "0x0d1cf59994a0dbBd7b64F7b5225c8cd972242214",
  EventManager:  "0x08d767b58984Ca245b1c6b1a09C4bED9084beEFD",
};

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Using wallet:", deployer.address);

  const eventManager = await hre.ethers.getContractAt("EventManager", ADDRESSES.EventManager);
  const ticketPricing = await hre.ethers.getContractAt("TicketPricing", ADDRESSES.TicketPricing);

  // Approve deployer as organizer (owner can also create events directly, but let's be explicit)
  console.log("\nApproving deployer as organizer...");
  const approveTx = await eventManager.approveOrganizer(deployer.address);
  await approveTx.wait();
  console.log("✅ Organizer approved");

  // Confirm tier prices are set (they were set in deploy.js but double-check)
  const generalPrice = await ticketPricing.getPrice("GENERAL");
  const vipPrice     = await ticketPricing.getPrice("VIP");
  console.log(`\nTier prices — GENERAL: ${hre.ethers.formatEther(generalPrice)} ETH | VIP: ${hre.ethers.formatEther(vipPrice)} ETH`);

  // Event date: 30 days from now
  const futureDate = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;

  // Create Event 1 — GENERAL
  console.log("\nCreating Event 1: Sunburn Festival (GENERAL)...");
  const tx1 = await eventManager.createEvent(
    "Sunburn Festival 2026",
    "Vagator Beach, Goa",
    futureDate,
    100,           // totalSeats
    "GENERAL",
    "ipfs://QmTestMetadata1"
  );
  const receipt1 = await tx1.wait();
  const event1Id = receipt1.logs
    .map(log => { try { return eventManager.interface.parseLog(log) } catch { return null } })
    .find(e => e?.name === "EventCreated")?.args?.eventId;
  console.log(`✅ Event 1 created — ID: ${event1Id?.toString()}`);

  // Create Event 2 — VIP
  console.log("\nCreating Event 2: Nucleya Live (VIP)...");
  const tx2 = await eventManager.createEvent(
    "Nucleya Live 2026",
    "NSCI Dome, Mumbai",
    futureDate + 7 * 24 * 60 * 60, // 37 days from now
    50,            // totalSeats
    "VIP",
    "ipfs://QmTestMetadata2"
  );
  const receipt2 = await tx2.wait();
  const event2Id = receipt2.logs
    .map(log => { try { return eventManager.interface.parseLog(log) } catch { return null } })
    .find(e => e?.name === "EventCreated")?.args?.eventId;
  console.log(`✅ Event 2 created — ID: ${event2Id?.toString()}`);

  console.log("\n--- Done ---");
  console.log(`Event 1: Sunburn Festival (GENERAL, 0.01 ETH, 100 seats) — ID ${event1Id?.toString()}`);
  console.log(`Event 2: Nucleya Live (VIP, 0.05 ETH, 50 seats) — ID ${event2Id?.toString()}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
