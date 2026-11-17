// Prueba del bot: dos personas aportan, pasan 49 h, el bot devuelve a cada una; un tercero (el bot) no recibe nada.
import { createPublicClient, createWalletClient, http, erc20Abi, keccak256, encodeAbiParameters } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";
import { writeFileSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { launchParams, predictAddress, ensureDeployed, deposit } from "../lcchain.js";
const RPC = "http://127.0.0.1:8545";
const KEYS = ["0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a", "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a", "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6", "0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba"];
const CONFIG = { usdc: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238", deployer: "0x4e59b44847b379578588920cA78FbF26c0B4956C", positionManager: "0x1238536071E1c677A632429e3655c799b22cDA52", platform: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8" };
const pub = createPublicClient({ chain: sepolia, transport: http(RPC) });
const mk = (k) => { const a = privateKeyToAccount(k); return { a, w: createWalletClient({ account: a, chain: sepolia, transport: http(RPC) }) }; };
const [creator, alice, bob, bot] = KEYS.map(mk);
const rpc = (method, params) => fetch(RPC, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) }).then((r) => r.json());
for (const x of [alice, bob]) await rpc("anvil_setStorageAt", [CONFIG.usdc, keccak256(encodeAbiParameters([{ type: "address" }, { type: "uint256" }], [x.a.address, 9n])), "0x" + (1000n * 1_000_000n).toString(16).padStart(64, "0")]);
await rpc("anvil_setBalance", [bot.a.address, "0x56BC75E2D63100000"]);
const p = launchParams(CONFIG, { name: "Bot Test", symbol: "BOTT", creator: creator.a.address, goal: 500 });
const addr = predictAddress(CONFIG, p);
await ensureDeployed(CONFIG, pub, alice.w, alice.a, p);
const blk = await pub.getBlockNumber();
await deposit(CONFIG, pub, alice.w, alice.a, addr, 120); await deposit(CONFIG, pub, bob.w, bob.a, addr, 80);
const bal = (a) => pub.readContract({ address: CONFIG.usdc, abi: erc20Abi, functionName: "balanceOf", args: [a] });
const before = [await bal(alice.a.address), await bal(bob.a.address), await bal(bot.a.address)];
const reg = "launches.json", orig = readFileSync(reg, "utf8");
writeFileSync(reg, JSON.stringify({ launches: [{ address: addr, fromBlock: Number(blk) - 1 }] }));
try {
  console.log(execFileSync("node", ["scripts/refund-bot.mjs"], { env: { ...process.env, RPC_URL: RPC, BOT_KEY: KEYS[3] }, encoding: "utf8" }).trim());
  console.log("--- ahora pasan 49 horas ---");
  await rpc("evm_increaseTime", [49 * 3600]); await rpc("evm_mine", []);
  console.log(execFileSync("node", ["scripts/refund-bot.mjs"], { env: { ...process.env, RPC_URL: RPC, BOT_KEY: KEYS[3] }, encoding: "utf8" }).trim());
} finally { writeFileSync(reg, orig); }
const after = [await bal(alice.a.address), await bal(bob.a.address), await bal(bot.a.address)];
const ok = after[0] - before[0] === 120_000_000n && after[1] - before[1] === 80_000_000n && after[2] === before[2];
console.log(ok ? "Todo bien: cada aportante recuperó lo suyo y el bot no recibió USDC" : "FALLO", { alice: Number(after[0] - before[0]) / 1e6, bob: Number(after[1] - before[1]) / 1e6, bot: Number(after[2] - before[2]) / 1e6 });
process.exitCode = ok ? 0 : 1;
