const hre = require("hardhat");

const EVENT_MANAGER = "0x08d767b58984Ca245b1c6b1a09C4bED9084beEFD";
const ADMIN_ADDRESSES = [
  "0x382E7A5eA0C6d2DfDB77C3e464227AF45f4ECD9d",
  "0xA991B1211b4B7748b0272D70DB03933dAcF5FE30",
];

const arg = process.argv[2] || "1";
const selectedIndex = /^(2|second)$/i.test(arg) ? 1 : 0;
const NEW_ADMIN = ADMIN_ADDRESSES[selectedIndex];

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Using wallet:", deployer.address);

  const eventManager = await hre.ethers.getContractAt("EventManager", EVENT_MANAGER);
  const tx = await eventManager.approveOrganizer(NEW_ADMIN);
  await tx.wait();
  console.log("✅ Organizer approved:", NEW_ADMIN);
}

main().catch((err) => { console.error(err); process.exitCode = 1; });