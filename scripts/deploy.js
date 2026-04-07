// scripts/deploy.js
const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with:", deployer.address);

  // 1. TicketPricing
  const TicketPricing = await hre.ethers.getContractFactory("TicketPricing");
  const ticketPricing = await TicketPricing.deploy();
  await ticketPricing.waitForDeployment();
  console.log("TicketPricing:", await ticketPricing.getAddress());

  // 2. TicketNFT
  const TicketNFT = await hre.ethers.getContractFactory("TicketNFT");
  const ticketNFT = await TicketNFT.deploy();
  await ticketNFT.waitForDeployment();
  console.log("TicketNFT:", await ticketNFT.getAddress());

  // 3. EventManager
  const EventManager = await hre.ethers.getContractFactory("EventManager");
  const eventManager = await EventManager.deploy(
    await ticketPricing.getAddress(),
    await ticketNFT.getAddress(),
    deployer.address // feeRecipient
  );
  await eventManager.waitForDeployment();
  console.log("EventManager:", await eventManager.getAddress());

  // 4. Escrow
  const Escrow = await hre.ethers.getContractFactory("Escrow");
  const escrow = await Escrow.deploy();
  await escrow.waitForDeployment();
  console.log("Escrow:", await escrow.getAddress());

  // 5. TicketResale
  const TicketResale = await hre.ethers.getContractFactory("TicketResale");
  const ticketResale = await TicketResale.deploy(
    await ticketNFT.getAddress(),
    deployer.address // feeRecipient
  );
  await ticketResale.waitForDeployment();
  console.log("TicketResale:", await ticketResale.getAddress());

  // --- Wire up ---
  // Let EventManager mint NFTs
  await ticketNFT.setEventManager(await eventManager.getAddress());
  console.log("TicketNFT: EventManager set");

  // Let EventManager control Escrow
  await escrow.setEventManager(await eventManager.getAddress());
  console.log("Escrow: EventManager set");

  // Set default tier prices (GENERAL = 0.01 ETH, VIP = 0.05 ETH)
  await ticketPricing.setTierPrice("GENERAL", hre.ethers.parseEther("0.01"));
  await ticketPricing.setTierPrice("VIP", hre.ethers.parseEther("0.05"));
  console.log("TicketPricing: tiers set");

  console.log("\n--- Deployment Complete ---");
  console.log({
    TicketPricing: await ticketPricing.getAddress(),
    TicketNFT:     await ticketNFT.getAddress(),
    EventManager:  await eventManager.getAddress(),
    Escrow:        await escrow.getAddress(),
    TicketResale:  await ticketResale.getAddress(),
  });
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
