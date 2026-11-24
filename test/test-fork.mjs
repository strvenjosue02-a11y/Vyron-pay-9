import { spawn } from "node:child_process";
import {
  createPublicClient,
  createWalletClient,
  defineChain,
  http,
  parseAbi,
  parseEther,
  concat,
  pad,
  encodeFunctionData,
  encodePacked,
  size,
} from "viem";
import { build, buildWithRpc, fillOpenBuyer, lockInit, lockAddress } from "../src/builder.mjs";
import { sqrtRatioAtTick } from "../src/tick.mjs";
import { verify } from "../src/verify.mjs";
import { OFFICIAL, isOfficial } from "../src/rules.mjs";
import { auditPlan } from "../src/audit-plan.mjs";
import { verifyToken } from "../src/verify-token.mjs";
import { pendingFees } from "../src/fees.mjs";
import { decodeCalls, decodeCall } from "../src/audit-plan.mjs";
import { DEPLOYER, CHAINS } from "../src/chains.mjs";

const NET = process.env.NET || "sepolia",
  CH = CHAINS[NET],
  WANT = process.env.WANT;
const PORT = 8561,
  RPC = `http://127.0.0.1:${PORT}`,
  sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const anvil = process.env.NO_SPAWN
  ? { pid: 0 }
  : spawn(
      process.env.ANVIL_BIN || "anvil",
      ["--fork-url", process.env.FORK_URL || CH.rpc, "--port", String(PORT), "--silent"],
      { stdio: "ignore", detached: true },
    );
let pass = 0,
  fail = 0;
const check = (c, l, d = "") => {
  c ? pass++ : fail++;
  console.log(`${c ? "✔" : "✘"} ${l}${d ? " — " + d : ""}`);
};
const A = (n) => "0x" + n.toString(16).padStart(40, "0");
const [CREATOR, TRADER, KEEPER, RELAYER, WHALE] = [A(0xc1), A(0xd1), A(0xe1), A(0xf1), A(0xb16)],
  PROTOCOL = OFFICIAL.protocol;
const ERC = parseAbi([
  "function balanceOf(address) view returns (uint256)",
  "function approve(address,uint256) returns (bool)",
]);
const WETH = parseAbi([
  "function deposit() payable",
  "function approve(address,uint256) returns (bool)",
  "function balanceOf(address) view returns (uint256)",
]);
const ROUTER = parseAbi([
  "function exactInputSingle((address tokenIn,address tokenOut,uint24 fee,address recipient,uint256 amountIn,uint256 amountOutMinimum,uint160 sqrtPriceLimitX96)) returns (uint256)",
]);
let nonce = Date.now() % 1000000000;
const input = (o = {}) => {
  for (;;) {
    const i = {
      chain: NET,
      name: "Prueba Luna",
      symbol: "LUNA",
      creator: CREATOR,
      protocol: PROTOCOL,
      protocolBps: 2000,
      nonce: nonce++,
      fdv: 4,
      ...o,
    };
    if (!WANT || build(i).tokenIsToken0 === (WANT === "0")) return i;
  }
};

try {
  const pub = createPublicClient({ transport: http(RPC) });
  for (let i = 0, up = false; i < 240 && !up; i++) {
    try {
      up = (
        await fetch(RPC, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: '{"jsonrpc":"2.0","id":1,"method":"eth_blockNumber","params":[]}',
        })
      ).ok;
    } catch {
      await sleep(500);
    }
    if (i === 239 && !up) throw new Error("anvil no arrancó");
  }
  const rpc = (m, p) =>
    fetch(RPC, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: m, params: p }),
    }).then((r) => r.json());
  for (const a of [CREATOR, PROTOCOL, TRADER, KEEPER, RELAYER, WHALE]) {
    await rpc("anvil_setBalance", [a, "0x56BC75E2D63100000"]);
    await rpc("anvil_impersonateAccount", [a]);
  }
  const chain = defineChain({
    id: CH.id,
    name: "fork",
    nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
    rpcUrls: { default: { http: [RPC] } },
  });
  const wallet = (a) => createWalletClient({ account: a, chain, transport: http(RPC) });
  const send = async (from, p, data = p.data) =>
    pub.waitForTransactionReceipt({
      hash: await wallet(from).sendTransaction({
        to: p.to,
        data,
        value: p.value,
        gas: 12_000_000n,
      }),
    });
  const tbal = (t, a) =>
    pub.readContract({ address: t, abi: ERC, functionName: "balanceOf", args: [a] });
  const swap = (from, p, tokenIn, tokenOut, amountIn, value = 0n) =>
    wallet(from).writeContract({
      address: p.chain.router,
      abi: ROUTER,
      functionName: "exactInputSingle",
      args: [
        {
          tokenIn,
          tokenOut,
          fee: 10000,
          recipient: from,
          amountIn,
          amountOutMinimum: 1n,
          sqrtPriceLimitX96: 0n,
        },
      ],
      value,
      gas: 1_000_000n,
    });

  const B0 = Number(await pub.getBlockNumber()) + 1; // se lee solo desde el arranque de la copia
  check(
    sqrtRatioAtTick(0) === 2n ** 96n &&
      sqrtRatioAtTick(-887272) === 4295128739n &&
      sqrtRatioAtTick(887272) === 1461446703485210103287273052203988822378723970342n,
    "Matemática de ticks: mínimo, cero y máximo oficiales de Uniswap",
  );

  const plan = await buildWithRpc(input(), pub);
  check(
    auditPlan(plan).length === 0,
    "Revisión independiente de la transacción: hace exactamente lo prometido",
  );
  const rc = await send(RELAYER, plan);
  check(
    rc.status === "success",
    "El lanzamiento completo ocurre en UNA transacción, enviada por cualquiera",
    `${plan.calls} llamadas, gas ${rc.gasUsed}`,
  );
  const res = await verify(plan, RPC);
  for (const k of res.checks) check(k.ok, "Informe: " + k.label, k.detail);
  check(
    (await tbal(plan.token, CREATOR)) === 0n,
    "Modo casino: el creador no recibió ningún token",
  );
  check(
    isOfficial(plan) &&
      !isOfficial({
        ...plan,
        positions: plan.positions.map((p) => (p.role === "protocolo" ? { ...p, bps: 0 } : p)),
      }) &&
      !isOfficial({ ...plan, positions: plan.positions.filter((p) => p.role !== "protocolo") }),
    "Quitar o reducir la parte del autor se marca como NO OFICIAL",
  );
  const w = plan.chain.weth,
    fee = 0.1 * 0.01;
  await wallet(TRADER).writeContract({
    address: w,
    abi: WETH,
    functionName: "deposit",
    value: parseEther("0.1"),
  });
  await wallet(TRADER).writeContract({
    address: w,
    abi: WETH,
    functionName: "approve",
    args: [plan.chain.router, parseEther("0.1")],
  });
  await swap(TRADER, plan, w, plan.token, parseEther("0.1"));
  const wb = (a) =>
      pub.readContract({ address: w, abi: WETH, functionName: "balanceOf", args: [a] }),
    before = await Promise.all([wb(PROTOCOL), wb(CREATOR)]);
  const pf = await pendingFees(plan, res, RPC); // lo que el comando `fees` dice que hay por cobrar, ANTES de cobrar
  for (const p of res.positions)
    await wallet(KEEPER).writeContract({
      address: p.lock,
      abi: parseAbi(["function collect(uint256)"]),
      functionName: "collect",
      args: [BigInt(p.id)],
      gas: 600_000n,
    });
  const [bp, bc] = (await Promise.all([wb(PROTOCOL), wb(CREATOR)])).map(
    (x, i) => Number(x - before[i]) / 1e18,
  );
  check(
    Math.abs((bp + bc) / fee - 1) < 0.01 &&
      Math.abs(bp / fee - 0.2) < 0.005 &&
      Math.abs(bc / fee - 0.8) < 0.005,
    "Comisiones del 1 %: el autor recibe exactamente el 20 % y el creador el 80 %",
    `${((bp / fee) * 100).toFixed(3)} % / ${((bc / fee) * 100).toFixed(3)} %`,
  );
  const dP = (await wb(PROTOCOL)) - before[0],
    dC = (await wb(CREATOR)) - before[1];
  check(
    pf.positions[0].role === "protocolo"
      ? pf.positions[0].weth === dP && pf.positions[1].weth === dC
      : pf.positions[1].weth === dP && pf.positions[0].weth === dC,
    "`fees` acierta: lo que dijo que había por cobrar es EXACTAMENTE lo que recibió cada billetera",
    `autor ${dP} wei · creador ${dC} wei`,
  );
  const pf2 = await pendingFees(plan, res, RPC);
  check(
    pf2.positions.every((x) => x.weth === 0n && x.token === 0n),
    "Después de cobrar no queda nada por cobrar (y cobrar de nuevo no saca nada más)",
  );
  let moved = false;
  try {
    await pub.call({
      account: KEEPER,
      to: res.positions[0].lock,
      data: "0x23b872dd" + "00".repeat(96),
    });
    moved = true;
  } catch {}
  check(!moved, "Intentar mover la posición desde el candado falla");

  const CR2 = A(0xc2);
  await rpc("anvil_setBalance", [CR2, "0x0"]);
  const sp = await buildWithRpc(
      input({
        creator: CR2,
        buyer: TRADER,
        buyWei: parseEther("0.05").toString(),
        name: "Sin Gas",
        symbol: "NOGAS",
      }),
      pub,
    ),
    sr = await send(TRADER, sp);
  check(
    sr.status === "success" &&
      (await pub.getBalance({ address: CR2 })) === 0n &&
      (await tbal(sp.token, TRADER)) > 0n &&
      (await tbal(sp.token, CR2)) === 0n &&
      (await verify(sp, RPC)).checks.every((k) => k.ok),
    "Patrocinado: el creador (0 ETH) lanza sin pagar nada, el comprador recibe su compra y el informe sale en verde",
  );

  const op = await buildWithRpc(
      input({
        creator: A(0xc3),
        buyer: "open",
        buyWei: parseEther("0.05").toString(),
        name: "Abierto",
        symbol: "OPEN",
      }),
      pub,
    ),
    filled = fillOpenBuyer(op.data, TRADER);
  check(
    auditPlan(op).length === 0 &&
      auditPlan({ ...op, data: filled, cfg: { ...op.cfg, buyer: TRADER } }).length === 0,
    "Comprador abierto: la revisión independiente aprueba el plan con el marcador y con la billetera de quien firma",
  );
  const orc = await send(TRADER, op, filled);
  check(
    orc.status === "success" &&
      (await tbal(op.token, TRADER)) > 0n &&
      (await tbal(op.token, A(0xc3))) === 0n &&
      (await verify(op, RPC)).checks.every((k) => k.ok),
    "Comprador abierto: quien envía recibe la compra inicial; el creador no recibe tokens; informe en verde",
  );
  let twice = false;
  try {
    fillOpenBuyer(filled, TRADER);
  } catch {
    twice = true;
  }
  check(twice, "Reemplazar el marcador dos veces se rechaza");

  const RCP = A(0x77),
    inp = input({ creator: RCP, name: "Candado Previo", symbol: "PRE" }),
    antes = build({ ...inp, existingLocks: [lockAddress(plan.chain.npm, PROTOCOL)] }).calls;
  await pub.waitForTransactionReceipt({
    hash: await wallet(KEEPER).sendTransaction({
      to: DEPLOYER,
      data: concat([pad("0x0", { size: 32 }), lockInit(plan.chain.npm, RCP)]),
      gas: 3_000_000n,
    }),
  });
  check(
    (await buildWithRpc(inp, pub)).calls === antes - 1,
    "Con el candado ya creado, el plan siguiente no lo vuelve a desplegar (una llamada menos)",
  );

  for (const [p, label] of [
    [plan, "normal"],
    [sp, "patrocinado"],
    [op, "comprador abierto"],
  ]) {
    const v = await verifyToken(NET, p.token, { rpc: RPC, fromBlock: B0 });
    check(
      v.ok && v.problems.length === 0 && v.res.checks.every((k) => k.ok) && isOfficial(v.plan),
      `Verificar por dirección (${label}): la transacción real cumple lo prometido, el informe sale en verde y es OFICIAL`,
    );
  }
  const { execFileSync } = await import("node:child_process");
  const cobro = JSON.parse(
    execFileSync(
      "node",
      [
        new URL("../src/launch.mjs", import.meta.url).pathname,
        "collect",
        plan.token,
        "--chain",
        NET,
        "--rpc",
        RPC,
        "--from-block",
        String(B0),
        "--json",
        "--recipient",
        PROTOCOL,
      ],
      { encoding: "utf8" },
    ),
  );
  check(
    cobro.length === 1 &&
      cobro[0].to.toLowerCase() === lockAddress(plan.chain.npm, PROTOCOL).toLowerCase() &&
      cobro[0].recipient.toLowerCase() === PROTOCOL.toLowerCase(),
    "Cobrar con solo la dirección del token: el autor obtiene una única transacción, hacia su propio candado",
  );
  const cdir = "/tmp/holdfast-cobro-" + process.pid,
    cli = (a) =>
      execFileSync(
        "node",
        [
          new URL("../src/launch.mjs", import.meta.url).pathname,
          ...a,
          "--chain",
          NET,
          "--rpc",
          RPC,
          "--from-block",
          String(B0),
        ],
        { encoding: "utf8" },
      );
  const out = cli(["collect", plan.token, "--out", cdir]);
  const { checkSite } = await import("../src/check-site.mjs"),
    cs = await checkSite(`${cdir}/cobrar-${plan.cfg.symbol}.html`, { token: plan.token });
  check(
    /Página para cobrar/.test(out) &&
      cs.ok &&
      cs.rows.some((r) => /candado oficial de su dueño/.test(r.label) && r.ok),
    "`collect` con solo la dirección del token arma la página de cobro y el verificador la aprueba (cada cobro va al candado oficial de su dueño)",
  );
  check(
    /Comisiones por cobrar de/.test(cli(["fees", plan.token])) &&
      /Autor/.test(cli(["fees", plan.token])),
    "`fees` muestra cuánto hay por cobrar de cada parte",
  );
  const MS = parseAbi(["function multiSend(bytes transactions) payable"]),
    MINT = parseAbi([
      "function mint((address token0,address token1,uint24 fee,int24 tickLower,int24 tickUpper,uint256 amount0Desired,uint256 amount1Desired,uint256 amount0Min,uint256 amount1Min,address recipient,uint256 deadline)) returns (uint256,uint128,uint256,uint256)",
      "function transfer(address,uint256) returns (bool)",
    ]);
  const evil = await buildWithRpc(input({ name: "Tramposo", symbol: "EVIL" }), pub),
    cut = 100_000_000n * 10n ** 18n,
    calls = decodeCalls(evil.data).map((k) => ({ ...k }));
  const mi = calls.findIndex(
    (k) =>
      decodeCall(k.data)?.args?.[0]?.recipient?.toLowerCase() ===
      evil.positions.find((q) => q.role === "creador").lock.toLowerCase(),
  );
  const m = { ...decodeCall(calls[mi].data).args[0] };
  const f = evil.tokenIsToken0
    ? ["amount0Desired", "amount0Min"]
    : ["amount1Desired", "amount1Min"];
  m[f[0]] -= cut;
  m[f[1]] -= cut;
  calls[mi].data = encodeFunctionData({ abi: MINT, functionName: "mint", args: [m] });
  calls.push({
    op: 0,
    to: evil.token,
    value: 0n,
    data: encodeFunctionData({ abi: MINT, functionName: "transfer", args: [A(0xbad), cut] }),
  });
  const evilData = encodeFunctionData({
    abi: MS,
    functionName: "multiSend",
    args: [
      concat(
        calls.map((k) =>
          encodePacked(
            ["uint8", "address", "uint256", "uint256", "bytes"],
            [k.op, k.to, k.value, BigInt(size(k.data)), k.data],
          ),
        ),
      ),
    ],
  });
  const er = await send(RELAYER, evil, evilData);
  const ev = await verifyToken(NET, evil.token, { rpc: RPC, fromBlock: B0 });
  check(
    er.status === "success" &&
      (await tbal(evil.token, A(0xbad))) === cut &&
      ev.ok &&
      ev.problems.length > 0,
    "Verificar por dirección: un lanzamiento que regaló el 10 % de los tokens a un atacante se DETECTA",
    ev.problems?.[0]?.slice(0, 70),
  );
} catch (e) {
  fail++;
  console.error(
    "ERROR:",
    e.shortMessage || e.message,
    "|",
    (e.stack || "")
      .split("\n")
      .slice(1, 4)
      .map((s) => s.trim().slice(0, 110))
      .join(" | "),
  );
} finally {
  if (anvil.pid) {
    try {
      process.kill(-anvil.pid);
    } catch {}
  }
  console.log(`\n${pass} correctas · ${fail} fallas`);
  process.exit(fail ? 1 : 0);
}
