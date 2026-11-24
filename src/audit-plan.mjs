import { decodeFunctionData, decodeAbiParameters, parseAbi, getAddress } from "viem";
import { readFileSync } from "node:fs";
import { MULTISEND, DEPLOYER } from "./chains.mjs";
import { sqrtRatioAtTick, WIDTH } from "./tick.mjs";
import { SUPPLY, lockAddress, create2 } from "./builder.mjs";
const ART = JSON.parse(readFileSync(new URL("./artifacts.json", import.meta.url), "utf8"));
const ABI = parseAbi([
  "function createAndInitializePoolIfNecessary(address,address,uint24,uint160) returns (address)",
  "function mint((address token0,address token1,uint24 fee,int24 tickLower,int24 tickUpper,uint256 amount0Desired,uint256 amount1Desired,uint256 amount0Min,uint256 amount1Min,address recipient,uint256 deadline)) returns (uint256,uint128,uint256,uint256)",
  "function approve(address,uint256) returns (bool)",
  "function deposit() payable",
  "function exactInputSingle((address tokenIn,address tokenOut,uint24 fee,address recipient,uint256 amountIn,uint256 amountOutMinimum,uint160 sqrtPriceLimitX96)) returns (uint256)",
]);
const same = (a, b) => String(a).toLowerCase() === String(b).toLowerCase();
export const decodeCall = (data) => decode(data);
const decode = (data) => {
  try {
    return decodeFunctionData({ abi: ABI, data });
  } catch {
    return null;
  }
};

export function decodeCalls(data) {
  const hex = decodeFunctionData({
      abi: parseAbi(["function multiSend(bytes transactions)"]),
      data,
    }).args[0].slice(2),
    calls = [];
  for (let i = 0; i < hex.length; ) {
    const len = Number(BigInt("0x" + hex.slice(i + 106, i + 170)));
    calls.push({
      op: parseInt(hex.slice(i, i + 2), 16),
      to: getAddress("0x" + hex.slice(i + 2, i + 42)),
      value: BigInt("0x" + hex.slice(i + 42, i + 106)),
      data: "0x" + hex.slice(i + 170, i + 170 + len * 2),
    });
    i += 170 + len * 2;
  }
  return calls;
}

/** @returns {string[]} problemas (vacío = la transacción hace exactamente lo prometido) */
export function auditPlan(plan) {
  const bad = [],
    need = (ok, msg) => ok || bad.push(msg),
    { cfg: c, chain: ch } = plan;
  let calls;
  try {
    calls = decodeCalls(plan.data);
  } catch {
    return ["la transacción no es un multiSend válido"];
  }
  need(same(plan.to, MULTISEND), "el destino no es Safe MultiSend");
  need(
    calls.every((k) => k.op === 0),
    "hay una llamada que no es 'call' (delegatecall)",
  );
  need(
    calls.reduce((s, k) => s + k.value, 0n) === plan.value,
    "el ETH enviado no coincide con la suma de las llamadas",
  );
  const authorTokens = (SUPPLY * BigInt(c.protocolBps)) / 10000n;
  const expected = [
    ...(c.protocolBps > 0 ? [[c.protocol, authorTokens]] : []),
    [c.creator, SUPPLY - authorTokens],
  ];
  let token = null;
  for (const k of calls.filter((x) => same(x.to, DEPLOYER))) {
    const salt = k.data.slice(0, 66),
      init = "0x" + k.data.slice(66),
      args = (art, types) => decodeAbiParameters(types, "0x" + init.slice(art.length));
    if (init.toLowerCase().startsWith(ART.token.toLowerCase())) {
      const [n, s, sup, holder] = args(ART.token, [
        { type: "string" },
        { type: "string" },
        { type: "uint256" },
        { type: "address" },
      ]);
      need(
        n === c.name && s === c.symbol && sup === SUPPLY && same(holder, MULTISEND),
        "el token no es el esperado (nombre, símbolo, suministro fijo o dueño del suministro)",
      );
      need(token === null, "dos tokens");
      token = create2(salt, init);
    } else if (init.toLowerCase().startsWith(ART.lock.toLowerCase())) {
      const [npm, r] = args(ART.lock, [{ type: "address" }, { type: "address" }]);
      need(
        same(npm, ch.npm) && expected.some(([e]) => same(e, r)) && /^0x0+$/.test(salt),
        "un candado no es el esperado",
      );
    } else bad.push("se despliega un contrato desconocido");
  }
  need(token && same(token, plan.token), "falta el token o su dirección no coincide");
  if (!token) return bad;
  const is0 = BigInt(token) < BigInt(ch.weth),
    t = is0 ? c.startTick : -c.startTick;
  const onToken = calls.filter((k) => same(k.to, token)),
    ap = onToken[0] && decode(onToken[0].data);
  need(
    onToken.length === 1 &&
      ap?.functionName === "approve" &&
      same(ap.args[0], ch.npm) &&
      ap.args[1] === 2n ** 256n - 1n,
    "el token recibe llamadas de más o de menos",
  );
  const npmCalls = calls.filter((k) => same(k.to, ch.npm)).map((k) => decode(k.data)),
    pools = npmCalls.filter((d) => d?.functionName === "createAndInitializePoolIfNecessary"),
    mints = npmCalls.filter((d) => d?.functionName === "mint").map((d) => d.args[0]);
  need(
    pools.length === 1 && mints.length === expected.length && npmCalls.length === 1 + mints.length,
    "número de pools o de posiciones distinto del esperado",
  );
  const [a0, a1, fee, price] = pools[0]?.args ?? [];
  need(
    same(a0, is0 ? token : ch.weth) &&
      same(a1, is0 ? ch.weth : token) &&
      fee === 10000 &&
      price === sqrtRatioAtTick(t),
    "el pool no se crea con el par, comisión o precio de arranque esperados",
  );
  let total = 0n;
  for (const [r, amount] of expected) {
    const m = mints.find(
      (x) =>
        same(x.recipient, lockAddress(ch.npm, r)) &&
        (is0 ? x.amount0Desired : x.amount1Desired) === amount,
    );
    need(
      !!m &&
        m.fee === 10000 &&
        m.tickLower === (is0 ? t : t - WIDTH) &&
        m.tickUpper === (is0 ? t + WIDTH : t) &&
        (is0 ? m.amount1Desired : m.amount0Desired) === 0n,
      `posición de ${r} incorrecta o ausente`,
    );
    total += amount;
  }
  need(total === SUPPLY, "los montos de liquidez no suman todo el suministro");
  const rest = calls.filter(
    (k) => !same(k.to, token) && !same(k.to, ch.npm) && !same(k.to, DEPLOYER),
  );
  need(rest.length === (c.buyEth > 0n ? 3 : 0), "llamadas de más o de menos en la compra inicial");
  if (c.buyEth > 0n && rest.length === 3) {
    const dep = rest.find((k) => same(k.to, ch.weth) && decode(k.data)?.functionName === "deposit"),
      buy = rest.find((k) => same(k.to, ch.router)),
      p = buy && decode(buy.data)?.args[0];
    need(dep?.value === c.buyEth, "el depósito de WETH no es por el monto pedido");
    need(
      p &&
        same(p.tokenIn, ch.weth) &&
        same(p.tokenOut, token) &&
        same(p.recipient, c.buyer) &&
        p.amountIn === c.buyEth &&
        p.fee === 10000,
      "la compra no entrega los tokens al comprador indicado",
    );
  }
  return bad;
}
