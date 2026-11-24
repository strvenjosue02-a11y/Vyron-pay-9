import {
  concat,
  encodeAbiParameters,
  encodeFunctionData,
  encodePacked,
  getAddress,
  keccak256,
  pad,
  parseAbi,
} from "viem";
import { readFileSync } from "node:fs";
import { CHAINS, MULTISEND, DEPLOYER } from "./chains.mjs";
import { sqrtRatioAtTick, WIDTH, startTickForFdv } from "./tick.mjs";

const ART = JSON.parse(readFileSync(new URL("./artifacts.json", import.meta.url), "utf8")); // bytes del token (OpenZeppelin) y del Lock
export const SUPPLY = 1_000_000_000n * 10n ** 18n; // TODO el suministro va al pool: el creador no recibe tokens
const FEE = 10_000; // pool de 1 %
const ZERO = "0x0000000000000000000000000000000000000000";
const ABI = parseAbi([
  "function createAndInitializePoolIfNecessary(address,address,uint24,uint160) returns (address)",
  "function mint((address token0,address token1,uint24 fee,int24 tickLower,int24 tickUpper,uint256 amount0Desired,uint256 amount1Desired,uint256 amount0Min,uint256 amount1Min,address recipient,uint256 deadline)) returns (uint256,uint128,uint256,uint256)",
  "function approve(address,uint256) returns (bool)",
  "function deposit() payable",
  "function exactInputSingle((address tokenIn,address tokenOut,uint24 fee,address recipient,uint256 amountIn,uint256 amountOutMinimum,uint160 sqrtPriceLimitX96)) returns (uint256)",
  "function multiSend(bytes transactions) payable",
]);

export const create2 = (salt, init) =>
  getAddress("0x" + keccak256(concat(["0xff", DEPLOYER, salt, keccak256(init)])).slice(26));
export const tokenInit = (c) =>
  concat([
    ART.token,
    encodeAbiParameters(
      [{ type: "string" }, { type: "string" }, { type: "uint256" }, { type: "address" }],
      [c.name, c.symbol, SUPPLY, MULTISEND],
    ),
  ]);
export const lockInit = (npm, recipient) =>
  concat([
    ART.lock,
    encodeAbiParameters([{ type: "address" }, { type: "address" }], [npm, recipient]),
  ]);
export const lockAddress = (npm, recipient) =>
  create2(pad("0x0", { size: 32 }), lockInit(npm, recipient));

const deriveSalt = (c) =>
  keccak256(
    encodeAbiParameters(
      [
        { type: "address" },
        { type: "address" },
        { type: "uint16" },
        { type: "string" },
        { type: "string" },
        { type: "int24" },
        { type: "uint256" },
      ],
      [
        c.creator,
        c.protocol ?? c.creator,
        c.protocolBps,
        c.name,
        c.symbol,
        c.startTick,
        BigInt(c.nonce),
      ],
    ),
  );

export const OPEN_BUYER = getAddress("0x00000000000000000000000000000000ffffffff");
export function fillOpenBuyer(data, who) {
  const parts = data.toLowerCase().split(OPEN_BUYER.slice(2).toLowerCase());
  if (parts.length !== 2)
    throw new Error("el marcador del comprador debe aparecer exactamente una vez");
  return parts.join(getAddress(who).slice(2).toLowerCase());
}

export function normalize(i) {
  const chain = CHAINS[i.chain || "base"];
  if (!chain) throw new Error("red desconocida: " + i.chain);
  const addr = (a) => {
    const x = getAddress(a);
    if (x === ZERO) throw new Error("ninguna dirección puede ser la dirección cero");
    return x;
  };
  const c = {
    chain,
    name: String(i.name || "").trim(),
    symbol: String(i.symbol || "")
      .trim()
      .toUpperCase(),
    creator: addr(i.creator),
    protocol: i.protocol ? addr(i.protocol) : null,
    protocolBps: Number(i.protocolBps || 0),
    buyEth: BigInt(i.buyWei || 0),
    nonce: Number(i.nonce || 0),
    deadline: Number(i.deadline || Math.floor(Date.now() / 1000) + 3600),
  };
  c.buyer = i.buyer === "open" ? OPEN_BUYER : addr(i.buyer || i.creator); // quien recibe la compra inicial (por defecto, el creador)
  if (/[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁠-⁤⁦-⁩﻿]/.test(c.name))
    throw new Error("el nombre tiene caracteres invisibles o de control (engaño visual)");
  if (!c.name || c.name.length > 40) throw new Error("nombre vacío o de más de 40 letras");
  if (!/^[A-Z0-9]{2,12}$/.test(c.symbol)) throw new Error("símbolo: 2 a 12 letras o números");
  if (
    !Number.isInteger(c.protocolBps) ||
    c.protocolBps < 0 ||
    c.protocolBps > 9900 ||
    (c.protocolBps > 0 && !c.protocol)
  )
    throw new Error("parte del autor inválida");
  if (i.buyer === "open" && !(c.buyEth > 0n))
    throw new Error("comprador abierto requiere una compra inicial (--buy-eth)");
  c.startTick = i.startTick ?? startTickForFdv(Number(i.fdv || 4), 18); // valor de arranque (por defecto 4 ETH) -> precio inicial
  if (c.startTick % 200 !== 0) throw new Error("startTick debe ser múltiplo de 200");
  return c;
}

export function build(input) {
  const c = normalize(input),
    { npm, router, weth } = c.chain;
  const salt = deriveSalt(c),
    token = create2(salt, tokenInit(c)),
    is0 = BigInt(token) < BigInt(weth);
  const authorTokens = (SUPPLY * BigInt(c.protocolBps)) / 10000n;
  const positions = [
    ...(c.protocolBps > 0
      ? [{ role: "protocolo", recipient: c.protocol, bps: c.protocolBps, amount: authorTokens }]
      : []),
    {
      role: "creador",
      recipient: c.creator,
      bps: 10000 - c.protocolBps,
      amount: SUPPLY - authorTokens,
    },
  ];
  for (const p of positions) p.lock = lockAddress(npm, p.recipient);
  const calls = [],
    call = (target, fn, args, value = 0n) =>
      calls.push({ target, value, data: encodeFunctionData({ abi: ABI, functionName: fn, args }) });
  const deploy = (salt0, init) =>
    calls.push({ target: DEPLOYER, value: 0n, data: concat([salt0, init]) });
  deploy(salt, tokenInit(c));
  const have = new Set((input.existingLocks || []).map((a) => getAddress(a))); // los candados que ya existen no se crean otra vez
  for (const p of positions)
    if (!have.has(p.lock)) {
      have.add(p.lock);
      deploy(pad("0x0", { size: 32 }), lockInit(npm, p.recipient));
    }
  const t = is0 ? c.startTick : -c.startTick,
    [t0, t1] = is0 ? [token, weth] : [weth, token];
  calls.push({
    target: token,
    value: 0n,
    data: encodeFunctionData({ abi: ABI, functionName: "approve", args: [npm, 2n ** 256n - 1n] }),
  });
  call(npm, "createAndInitializePoolIfNecessary", [t0, t1, FEE, sqrtRatioAtTick(t)]);
  for (const p of positions) {
    const min = (p.amount * 999n) / 1000n;
    call(npm, "mint", [
      {
        token0: t0,
        token1: t1,
        fee: FEE,
        tickLower: is0 ? t : t - WIDTH,
        tickUpper: is0 ? t + WIDTH : t,
        amount0Desired: is0 ? p.amount : 0n,
        amount1Desired: is0 ? 0n : p.amount,
        amount0Min: is0 ? min : 0n,
        amount1Min: is0 ? 0n : min,
        recipient: p.lock,
        deadline: BigInt(c.deadline),
      },
    ]);
  }
  if (c.buyEth > 0n) {
    call(weth, "deposit", [], c.buyEth);
    call(weth, "approve", [router, c.buyEth]);
    call(router, "exactInputSingle", [
      {
        tokenIn: weth,
        tokenOut: token,
        fee: FEE,
        recipient: c.buyer,
        amountIn: c.buyEth,
        amountOutMinimum: 1n,
        sqrtPriceLimitX96: 0n,
      },
    ]);
  }
  const packed = concat(
    calls.map((k) =>
      encodePacked(
        ["uint8", "address", "uint256", "uint256", "bytes"],
        [0, k.target, k.value, BigInt((k.data.length - 2) / 2), k.data],
      ),
    ),
  );
  return {
    chainId: c.chain.id,
    chain: c.chain,
    to: MULTISEND,
    value: c.buyEth,
    data: encodeFunctionData({ abi: ABI, functionName: "multiSend", args: [packed] }),
    calls: calls.length,
    token,
    tokenIsToken0: is0,
    startTick: c.startTick,
    positions: positions.map(({ amount, ...p }) => p),
    salt,
    cfg: c,
  };
}

export async function buildWithRpc(input, pub) {
  const have = [];
  for (const p of build(input).positions) {
    const code = await pub.getCode({ address: p.lock });
    if (code && code !== "0x") have.push(p.lock);
  }
  return build({ ...input, existingLocks: have });
}
