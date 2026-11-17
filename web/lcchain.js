// Pieza que une la web con el contrato Launch (lanzamiento rápido, todo o nada).
// No guarda dinero ni claves: solo prepara las llamadas que firma la wallet de la persona.
// Despliegue "perezoso": la dirección se conoce de antemano (CREATE2) y se despliega en el primer pago.
import { encodeDeployData, encodePacked, keccak256, getAddress, erc20Abi, concatHex, pad } from "viem";
import { LAUNCH_ABI, LAUNCH_BYTECODE } from "./launch-abi.js";

export const GOALS = [100, 500, 2000];
export const CREATOR_PCTS = [0, 5, 10];
export const VESTING_WEEKS = [4, 8, 12];
const SALT = pad("0x00", { size: 32 });
const addrOf = (a) => (typeof a === "string" ? a : a.address);

/** Parámetros del contrato a partir de lo que elige el creador en el formulario. */
export function launchParams(CONFIG, { name, symbol, creator, goal, creatorPct = 5, vestingWeeks = 8 }) {
  if (!GOALS.includes(goal)) throw new Error("La meta debe ser 100, 500 o 2000 USDC");
  if (!CREATOR_PCTS.includes(creatorPct)) throw new Error("El % del creador debe ser 0, 5 o 10");
  if (!VESTING_WEEKS.includes(vestingWeeks)) throw new Error("El goteo debe ser 4, 8 o 12 semanas");
  return { usdc: CONFIG.usdc, platform: CONFIG.platform, creator, name, symbol, goal: BigInt(goal) * 1_000_000n, positionManager: CONFIG.positionManager, creatorPct, vestingWeeks };
}

const initCode = (params) => encodeDeployData({ abi: LAUNCH_ABI, bytecode: LAUNCH_BYTECODE, args: [params] });

/** Dirección del token ANTES de que exista (CREATE2 con el deployer público). */
export function predictAddress(CONFIG, params) {
  const hash = keccak256(initCode(params));
  return getAddress(`0x${keccak256(encodePacked(["bytes1", "address", "bytes32", "bytes32"], ["0xff", CONFIG.deployer, SALT, hash])).slice(26)}`);
}

export async function isDeployed(pub, addr) {
  const code = await pub.getCode({ address: addr });
  return !!code && code !== "0x";
}

/** Despliega el contrato si todavía no existe (lo paga quien lo hace; sin dueño ni permisos especiales). */
export async function ensureDeployed(CONFIG, pub, wallet, account, params) {
  const addr = predictAddress(CONFIG, params);
  if (await isDeployed(pub, addr)) return addr;
  const hash = await wallet.sendTransaction({ account, to: CONFIG.deployer, data: concatHex([SALT, initCode(params)]) });
  const rc = await pub.waitForTransactionReceipt({ hash });
  if (rc.status !== "success" || !(await isDeployed(pub, addr))) throw new Error("No se pudo crear el token");
  return addr;
}

/** Lee todo lo que la pantalla necesita de la ronda. */
export async function readLaunch(pub, addr, who) {
  const c = (functionName, args) => ({ address: addr, abi: LAUNCH_ABI, functionName, args });
  const base = await pub.multicall({ allowFailure: false, contracts: [c("state"), c("raised"), c("goal"), c("pool"), c("lpTokenId"), c("vesting"), c("symbol"), c("name"), c("creator")] });
  const [state, raised, goal, pool, lpTokenId, vesting, symbol, name, creator] = base;
  const mine = who ? await pub.readContract(c("contributed", [who])) : 0n;
  return { state: ["open", "live", "refund"][state], raised, goal, pool, lpTokenId, vesting, symbol, name, creator, mine };
}

/** Aprobar USDC (si hace falta) y meter dinero. Si con eso se llena, el contrato abre el mercado. */
export async function deposit(CONFIG, pub, wallet, account, addr, amountUsdc, to) {
  const amt = BigInt(Math.round(amountUsdc * 1e6));
  const allowance = await pub.readContract({ address: CONFIG.usdc, abi: erc20Abi, functionName: "allowance", args: [addrOf(account), addr] });
  if (allowance < amt) { const h = await wallet.writeContract({ account, address: CONFIG.usdc, abi: erc20Abi, functionName: "approve", args: [addr, amt] }); await pub.waitForTransactionReceipt({ hash: h }); }
  const h = await wallet.writeContract({ account, address: addr, abi: LAUNCH_ABI, functionName: "deposit", args: [amt, to || addrOf(account)] });
  return pub.waitForTransactionReceipt({ hash: h });
}

const call = (name) => async (pub, wallet, account, addr) => { const h = await wallet.writeContract({ account, address: addr, abi: LAUNCH_ABI, functionName: name }); return pub.waitForTransactionReceipt({ hash: h }); };
export const withdraw = call("withdraw");      // sacar mi dinero mientras no se llene
export const claim = call("claim");            // reclamar mis tokens al llenarse
export const collectFees = call("collectFees"); // comisiones del pool: mitad plataforma, mitad creador
export async function releaseVesting(pub, wallet, account, addr, vesting) {
  const { vestingWalletAbi } = await import("./launch-abi.js");
  const h = await wallet.writeContract({ account, address: vesting, abi: vestingWalletAbi, functionName: "release", args: [addr] });
  return pub.waitForTransactionReceipt({ hash: h });
}
