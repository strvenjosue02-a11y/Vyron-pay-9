// Prueba de punta a punta del módulo lcchain.js contra una copia local de Sepolia (anvil).
// Uso: anvil --fork-url <sepolia> --port 8545 &  ;  node scripts/lc-chain-test.mjs
import { createPublicClient, createWalletClient, http, parseAbi } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";
import { launchParams, predictAddress, isDeployed, ensureDeployed, readLaunch, deposit, withdraw, claim, collectFees, releaseVesting } from "../lcchain.js";

const RPC = process.env.RPC || "http://127.0.0.1:8545";
// claves públicas de prueba de anvil (no son secretas, no tienen valor real)
const K = { creator: "0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a", alice: "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a", bob: "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6" };
const CONFIG = { usdc: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238", deployer: "0x4e59b44847b379578588920cA78FbF26c0B4956C", positionManager: "0x1238536071E1c677A632429e3655c799b22cDA52", platform: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8" };
const pub = createPublicClient({ chain: sepolia, transport: http(RPC) });
const mk = (k) => { const a = privateKeyToAccount(k); return { a, w: createWalletClient({ account: a, chain: sepolia, transport: http(RPC) }) }; };
const creator = mk(K.creator), alice = mk(K.alice), bob = mk(K.bob);
let ok = 0; const check = (c, m) => { if (!c) { console.log("FALLO:", m); process.exitCode = 1; } else { ok++; console.log("ok  ", m); } };
const rpc = (method, params) => fetch(RPC, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) }).then((r) => r.json());
const slot = (addr) => { // balances de USDC (FiatToken) en el slot 9
  const { keccak256, encodeAbiParameters } = globalThis.__viem; return keccak256(encodeAbiParameters([{ type: "address" }, { type: "uint256" }], [addr, 9n]));
};
globalThis.__viem = await import("viem");
for (const x of [alice, bob, creator]) await rpc("anvil_setStorageAt", [CONFIG.usdc, slot(x.a.address), "0x" + (10_000n * 1_000_000n).toString(16).padStart(64, "0")]);
await rpc("anvil_setBalance", [creator.a.address, "0x56BC75E2D63100000"]);

const p = launchParams(CONFIG, { name: "Moon Bread", symbol: "BREAD", creator: creator.a.address, goal: 100, creatorPct: 10, vestingWeeks: 4 });
const addr = predictAddress(CONFIG, p);
check(!(await isDeployed(pub, addr)), "la dirección se conoce antes de que exista: " + addr);
try { launchParams(CONFIG, { name: "x", symbol: "X", creator: creator.a.address, goal: 123 }); check(false, "meta inválida debe fallar"); } catch { check(true, "metas fuera de 100/500/2000 se rechazan en la web"); }

// primer pago: despliega y mete dinero
await ensureDeployed(CONFIG, pub, alice.w, alice.a, p);
check(await isDeployed(pub, addr), "el contrato se despliega en la dirección predicha");
await deposit(CONFIG, pub, alice.w, alice.a, addr, 40);
let s = await readLaunch(pub, addr, alice.a.address);
check(s.state === "open" && s.raised === 40_000_000n && s.mine === 40_000_000n, "después de poner 40 USDC la ronda sigue abierta (40/100)");
await withdraw(pub, alice.w, alice.a, addr);
s = await readLaunch(pub, addr, alice.a.address);
check(s.raised === 0n && s.mine === 0n, "se puede sacar el dinero antes de llenarse");
await deposit(CONFIG, pub, alice.w, alice.a, addr, 60);
await deposit(CONFIG, pub, bob.w, bob.a, addr, 40);
s = await readLaunch(pub, addr, bob.a.address);
check(s.state === "live" && s.lpTokenId > 0n && s.pool !== "0x0000000000000000000000000000000000000000", "al llenarse se abre el mercado con un pool de Uniswap");
check(s.vesting !== "0x0000000000000000000000000000000000000000", "el goteo del creador existe");
await claim(pub, alice.w, alice.a, addr); await claim(pub, bob.w, bob.a, addr);
const bal = (who) => pub.readContract({ address: addr, abi: parseAbi(["function balanceOf(address) view returns (uint256)"]), functionName: "balanceOf", args: [who] });
check((await bal(alice.a.address)) === 300_000_000n * 10n ** 18n && (await bal(bob.a.address)) === 200_000_000n * 10n ** 18n, "mismo precio para todos: 60% y 40% de los 500M tokens");
await rpc("evm_increaseTime", [14 * 86400]); await rpc("evm_mine", []);
await releaseVesting(pub, creator.w, creator.a, addr, s.vesting);
const cb = await bal(creator.a.address);
console.log("creador recibió", cb / 10n ** 18n); check(cb > 40_000_000n * 10n ** 18n && cb < 60_000_000n * 10n ** 18n, "a mitad del goteo el creador recibió cerca de la mitad de su 10%");
console.log(process.exitCode ? "\nHAY FALLOS" : `\nTodo bien: ${ok} comprobaciones`);
