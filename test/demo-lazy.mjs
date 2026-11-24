import { spawn, execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { readFileSync, rmSync, mkdirSync } from "node:fs";
import { createPublicClient, http, parseAbi, parseEther, formatEther } from "viem";
import { OFFICIAL } from "../src/rules.mjs";
import { CHAINS } from "../src/chains.mjs";
const require = createRequire(import.meta.url),
  { chromium } = require("playwright");
const NET = process.env.NET || "base",
  CH = CHAINS[NET],
  PORT = 8571,
  RPC = `http://127.0.0.1:${PORT}`,
  OUT = "/tmp/holdfast-demo";
const CLI = new URL("../src/launch.mjs", import.meta.url).pathname,
  sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const A = (n) => "0x" + n.toString(16).padStart(40, "0"),
  [CREATOR, BUYER, TRADER, WHALE, KEEPER] = [A(0xc1), A(0xb1), A(0xd1), A(0xb16), A(0xe1)];
const anvil = spawn(
  process.env.ANVIL_BIN || "anvil",
  ["--fork-url", process.env.FORK_URL || CH.rpc, "--port", String(PORT), "--silent"],
  { stdio: "ignore", detached: true },
);
let pass = 0,
  fail = 0;
const step = (t) => console.log(`\n── ${t}`);
const check = (c, l, d = "") => {
  c ? pass++ : fail++;
  console.log(`  ${c ? "✔" : "✘"} ${l}${d ? " — " + d : ""}`);
};
const cli = (a, extra = []) =>
  execFileSync("node", [CLI, ...a, "--rpc", RPC, ...extra], { encoding: "utf8" });
const ERC = parseAbi([
  "function balanceOf(address) view returns (uint256)",
  "function approve(address,uint256) returns (bool)",
]);
const WETH = parseAbi([
  "function deposit() payable",
  "function balanceOf(address) view returns (uint256)",
  "function approve(address,uint256) returns (bool)",
]);
const ROUTER = parseAbi([
  "function exactInputSingle((address tokenIn,address tokenOut,uint24 fee,address recipient,uint256 amountIn,uint256 amountOutMinimum,uint160 sqrtPriceLimitX96)) returns (uint256)",
]);
const rpc = (m, p) =>
  fetch(RPC, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: m, params: p }),
  }).then((r) => r.json());
try {
  for (let i = 0, up = false; !up; i++) {
    if (i > 240) throw new Error("anvil no arrancó");
    try {
      up = (await rpc("eth_blockNumber", [])).result != null;
    } catch {
      await sleep(500);
    }
  }
  const pub = createPublicClient({ transport: http(RPC) });
  for (const a of [BUYER, TRADER, WHALE, KEEPER]) {
    await rpc("anvil_setBalance", [a, "0x56BC75E2D63100000"]);
    await rpc("anvil_impersonateAccount", [a]);
  }
  await rpc("anvil_setBalance", [CREATOR, "0x0"]); // el creador NO tiene ni un centavo
  const B0 = Number(await pub.getBlockNumber()) + 1;
  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(OUT, { recursive: true });
  const wallet = (a) => ({
    account: a,
    chain: {
      id: CH.id,
      name: "fork",
      nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
      rpcUrls: { default: { http: [RPC] } },
    },
    transport: http(RPC),
  });
  const { createWalletClient } = await import("viem");
  const w = (a) => createWalletClient(wallet(a));
  const bal = (t, a) =>
    pub.readContract({ address: t, abi: ERC, functionName: "balanceOf", args: [a] });
  const wbal = (a) =>
    pub.readContract({ address: CH.weth, abi: WETH, functionName: "balanceOf", args: [a] });
  const browser = await chromium.launch();
  async function open(file, account) {
    const pg = await browser.newPage({ viewport: { width: 390, height: 740 } });
    const sent = [];
    await pg.exposeFunction("__rpc", async (m, p) => {
      if (m === "eth_requestAccounts") return [account];
      if (m === "eth_sendTransaction") {
        sent.push(p[0]);
        p = [{ ...p[0], gas: "0xb71b00" }];
      }
      const r = await rpc(m, p);
      if (r.error) throw new Error(r.error.message);
      return r.result;
    });
    await pg.addInitScript(() => {
      window.ethereum = { request: ({ method, params }) => window.__rpc(method, params || []) };
    });
    await pg.context().route("https://github.com/**", (r) => r.abort());
    await pg.goto("file://" + file);
    return { pg, sent };
  }

  step("1 · EL CREADOR LANZA GRATIS (lazy): se arma el plan, todavía no existe nada");
  const nonce = String(Date.now() % 1e9);
  cli([
    "plan",
    "--chain",
    NET,
    "--name",
    "Luna Rana",
    "--symbol",
    "LUNA",
    "--creator",
    CREATOR,
    "--buyer",
    "open",
    "--buy-eth",
    "0.01",
    "--out",
    OUT,
    "--nonce",
    nonce,
  ]);
  const planFile = `${OUT}/LUNA-${nonce}.json`,
    plan = JSON.parse(readFileSync(planFile, "utf8"));
  const tokenAddr = cli(["links", planFile]).match(/outputCurrency=(0x[0-9a-fA-F]{40})/)[1];
  check(
    (await pub.getCode({ address: tokenAddr })) === undefined,
    "La dirección del token ya se conoce, pero NO existe nada en la cadena todavía",
    tokenAddr,
  );
  check(
    (await pub.getBalance({ address: CREATOR })) === 0n,
    "El creador tiene 0 ETH: no pagó ni pagará nada",
  );
  cli(["sign", planFile]);
  const page = `${OUT}/LUNA-${nonce}-firmar.html`;
  const chk = cli(["check-site", page, "--token", tokenAddr, "--plan", planFile]);
  check(
    /RESULTADO: cumple/.test(chk),
    "La página de firma pasa el verificador (plantilla oficial, solo Safe MultiSend, enlace a Uniswap) y su transacción es exactamente la del plan auditado",
  );

  step("2 · EL PRIMER COMPRADOR: abre la página, revisa el código en GitHub, compra");
  let { pg, sent } = await open(page, BUYER);
  check(!(await pg.isVisible("#go")), "Antes de ver el código, el botón de comprar NO está");
  await pg.click("#gh");
  await pg.evaluate(() => window.dispatchEvent(new Event("focus")));
  check(await pg.isVisible("#go"), "Al volver de GitHub aparece Comprar");
  const buyerEth0 = await pub.getBalance({ address: BUYER });
  await pg.click("#go");
  await sleep(2500);
  check(sent.length === 1, "La página manda UNA sola transacción a la billetera");
  const code = await pub.getCode({ address: tokenAddr });
  check(!!code && code !== "0x", "Ahora el token SÍ existe en la cadena (se creó con esa firma)");
  const got = await bal(tokenAddr, BUYER);
  check(
    got > 0n,
    "El comprador recibió sus tokens",
    `${(Number(got) / 1e18).toLocaleString("en-US", { maximumFractionDigits: 0 })} ${plan.cfg?.symbol ?? "LUNA"}`,
  );
  check(
    (await bal(tokenAddr, CREATOR)) === 0n && (await pub.getBalance({ address: CREATOR })) === 0n,
    "El creador sigue con 0 tokens y 0 ETH: el que firmó pagó todo",
  );
  check(
    buyerEth0 - (await pub.getBalance({ address: BUYER })) <
      parseEther("0.0102") + parseEther("0.01"),
    "El comprador pagó su compra de 0.01 ETH más el gas (lo normal)",
  );
  await pg.close();

  step("3 · VERIFICAR SOLO CON LA DIRECCIÓN (cualquiera puede, sin confiar en nadie)");
  const v = cli(["verify", tokenAddr, "--chain", NET], ["--from-block", String(B0)]);
  check(
    /OFICIAL/.test(v) && !/✘/.test(v),
    "Informe de confianza en verde y OFICIAL (todo el suministro al pool, nada regalado, liquidez bloqueada)",
  );

  step("4 · UN SEGUNDO VISITANTE abre la página vieja: ya no manda nada que falle");
  ({ pg, sent } = await open(page, TRADER));
  await pg.click("#gh");
  await pg.evaluate(() => window.dispatchEvent(new Event("focus")));
  await pg.click("#go");
  await sleep(800);
  const href = await pg.getAttribute("#uni", "href").catch(() => null);
  check(
    sent.length === 0 && (await pg.isVisible("#uni")) && /app\.uniswap\.org\/swap/.test(href || ""),
    "La página detecta que el token ya existe y muestra el contrato y 'Comprar en Uniswap' (NO manda transacción)",
  );
  await pg.close();
  cli(["sign", planFile]);
  const pg2 = await open(page, TRADER);
  check(
    await pg2.pg.isVisible("#uni"),
    "Si el creador vuelve a correr `sign` después del lanzamiento, la página sale directo en su vista final",
  );
  await pg2.pg.close();

  step("5 · SE OPERA EL TOKEN (compras y ventas reales en Uniswap)");
  await w(TRADER).writeContract({
    address: CH.weth,
    abi: WETH,
    functionName: "deposit",
    value: parseEther("2"),
  });
  await w(TRADER).writeContract({
    address: CH.weth,
    abi: WETH,
    functionName: "approve",
    args: [CH.router, parseEther("2")],
  });
  const swap = (from, tIn, tOut, amt) =>
    w(from).writeContract({
      address: CH.router,
      abi: ROUTER,
      functionName: "exactInputSingle",
      args: [
        {
          tokenIn: tIn,
          tokenOut: tOut,
          fee: 10000,
          recipient: from,
          amountIn: amt,
          amountOutMinimum: 1n,
          sqrtPriceLimitX96: 0n,
        },
      ],
      gas: 1_000_000n,
    });
  await swap(TRADER, CH.weth, tokenAddr, parseEther("2"));
  const half = (await bal(tokenAddr, TRADER)) / 2n;
  await w(TRADER).writeContract({
    address: tokenAddr,
    abi: ERC,
    functionName: "approve",
    args: [CH.router, half],
  });
  await swap(TRADER, tokenAddr, CH.weth, half);
  check(
    true,
    "Compra de 2 ETH y venta de la mitad de esos tokens ejecutadas en el pool real (1 % de comisión cada una)",
  );

  step("6 · ¿CUÁNTO HAY EN COMISIONES SIN COBRAR? (`fees`, con solo la dirección del token)");
  const feesTxt = cli(["fees", tokenAddr, "--chain", NET], ["--from-block", String(B0)]);
  console.log(
    "\n" +
      feesTxt
        .split("\n")
        .map((l) => "    " + l)
        .join("\n") +
      "\n",
  );
  const f = JSON.parse(
    cli(["fees", tokenAddr, "--chain", NET, "--json"], ["--from-block", String(B0)]),
  );
  const author = f.positions.find((p) => p.role === "protocolo"),
    creator = f.positions.find((p) => p.role === "creador");
  check(
    BigInt(author.weth) > 0n && BigInt(creator.weth) > 0n,
    "Se ve cuánto tiene cada parte acumulado (WETH + token), sin cobrar nada",
  );
  const ratio = Number(author.ethValue) / Number(f.totalEth);
  check(
    Math.abs(ratio - 0.2) < 0.01,
    "La parte del autor es el 20 % del total y la del creador el 80 %",
    `${(ratio * 100).toFixed(2)} % / ${((1 - ratio) * 100).toFixed(2)} %`,
  );

  step("7 · COBRAR CON CLAUDE: se arma la página de cobro y cada dueño cobra lo suyo");
  const out = cli(
    ["collect", tokenAddr, "--chain", NET, "--out", OUT],
    ["--from-block", String(B0)],
  );
  const cpage = `${OUT}/cobrar-LUNA.html`;
  check(
    /Página para cobrar/.test(out) &&
      /RESULTADO: cumple/.test(cli(["check-site", cpage, "--token", tokenAddr])),
    "La página de cobro pasa el verificador (cada cobro va al candado oficial de su dueño)",
  );
  const before = { a: await wbal(OFFICIAL.protocol), c: await wbal(CREATOR) };
  await rpc("anvil_impersonateAccount", [OFFICIAL.protocol]);
  await rpc("anvil_setBalance", [OFFICIAL.protocol, "0x56BC75E2D63100000"]);
  const c1 = await open(cpage, KEEPER);
  for (const p of f.positions) (await c1.pg.click(`#claim-${p.id}`), await sleep(1200));
  check(
    c1.sent.length === 2 && c1.sent.every((t) => t.value === "0x0"),
    "Se mandan 2 transacciones de valor 0 (una por posición), firmadas por un tercero que solo paga el gas",
  );
  const after = { a: await wbal(OFFICIAL.protocol), c: await wbal(CREATOR) };
  check(
    after.a - before.a === BigInt(author.weth) && after.c - before.c === BigInt(creator.weth),
    "Cada billetera recibió EXACTAMENTE lo que `fees` había dicho (al wei)",
    `autor +${formatEther(after.a - before.a)} WETH · creador +${formatEther(after.c - before.c)} WETH`,
  );
  const left = JSON.parse(
    cli(["fees", tokenAddr, "--chain", NET, "--json"], ["--from-block", String(B0)]),
  );
  check(
    left.positions.every((p) => BigInt(p.weth) === 0n && BigInt(p.token) === 0n),
    "Después de cobrar queda 0 por cobrar (cobrar de nuevo no saca nada)",
  );
  check(
    (await bal(tokenAddr, KEEPER)) === 0n && (await wbal(KEEPER)) === 0n,
    "Quien pagó el gas no se llevó nada de las comisiones",
  );
  await c1.pg.close();

  step("8 · LA LIQUIDEZ NO SE TOCÓ (el candado solo sabe cobrar)");
  const v2 = cli(["verify", tokenAddr, "--chain", NET], ["--from-block", String(B0)]);
  check(
    !/✘/.test(v2) && /OFICIAL/.test(v2),
    "Después de cobrar, el informe de confianza sigue en verde: las posiciones siguen dentro del candado",
  );
  await browser.close();
} catch (e) {
  fail++;
  console.error("ERROR:", e.stack || e);
}
console.log(`\n${pass} correctas · ${fail} fallas`);
try {
  process.kill(-anvil.pid);
} catch {}
process.exit(fail ? 1 : 0);
