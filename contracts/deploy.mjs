import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createAccount, createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { TransactionStatus } from "genlayer-js/types";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = join(root, "contracts", ".env");
const contractPath = join(root, "contracts", "Genwork.py");

function loadPrivateKey() {
  const fromEnv = process.env.PRIVATE_KEY || process.env.private_key;
  if (fromEnv) return fromEnv.trim();
  const raw = readFileSync(envPath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const [key, ...rest] = trimmed.split("=");
    if (key.trim() === "private_key" || key.trim() === "PRIVATE_KEY") {
      return rest.join("=").trim().replace(/^['"]|['"]$/g, "");
    }
  }
  throw new Error("Missing private_key in contracts/.env");
}

const key = loadPrivateKey();
if (!/^0x[0-9a-fA-F]{64}$/.test(key)) {
  throw new Error("private_key must be 0x + 64 hex chars");
}

const account = createAccount(key);
const client = createClient({
  chain: studionet,
  account,
});

const code = readFileSync(contractPath, "utf8");

console.log("Deploying GenWork to GenLayer Studio");
console.log("  network:  studionet");
console.log("  chain id:", studionet.id);
console.log("  rpc:     ", studionet.rpcUrls.default.http[0]);
console.log("  deployer:", account.address);

await client.initializeConsensusSmartContract();
const hash = await client.deployContract({
  code,
  args: [],
  leaderOnly: false,
});
console.log("  tx:", hash);

const receipt = await client.waitForTransactionReceipt({
  hash,
  status: TransactionStatus.ACCEPTED,
  retries: 80,
  interval: 4000,
});

const address =
  receipt?.data?.contract_address ||
  receipt?.contractAddress ||
  receipt?.txDataDecoded?.contractAddress ||
  receipt?.data?.contractAddress ||
  "";

console.log("  receipt status:", receipt?.statusName || receipt?.status);
console.log("CONTRACT_ADDRESS=" + address);
if (!address) {
  console.log("FULL_RECEIPT=" + JSON.stringify(receipt, (_, value) => typeof value === "bigint" ? value.toString() : value, 2));
  process.exit(1);
}
