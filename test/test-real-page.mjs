import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { readFileSync, rmSync, mkdirSync } from "node:fs";
import {
  createPublicClient,
  createWalletClient,
  http,
  parseAbi,
  parseEther,
  formatEther,
  defineChain,
} from "viem";
import { privateKeyToAccount, generatePrivateKey } from "viem/accounts";
import { CHAINS } from "../src/chains.mjs";
const require = createRequire(import.meta.url),
  { chromium } = require("playwright");
const CH = CHAINS.sepolia,
  RPC = CH.rpc,
  OUT = "/tmp/holdfast-real-page",
  CLI = new URL("../src/launch.mjs", import.meta.url).pathname;
const chain = defineChain({
  id: CH.id,
  name: "sepolia",
  nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [RPC] } },
});
const pub = createPublicClient({ chain, transport: http(RPC) });
const me = createWalletClient({
  account: privateKeyToAccount(
    JSON.parse(readFileSync(process.env.HOLDFAST_TEST_KEY_FILE, "utf8")).key,
  ),
  chain,
  transport: http(RPC),
});
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let pass = 0,
  fail = 0;
const step = (t) => console.log(`\n── ${t}`);
const check = (c, l, d = "") => {
  c ? pass++ : fail++;
  console.log(`  ${c ? "✔" : "✘"} ${l}${d ? " — " + d : ""}`);
};
const cli = (a) => execFileSync("node", [CLI, ...a], { encoding: "utf8" });
const eventually = async (fn, ok, tries = 14) => {
  let v;
  for (let i = 0; i < tries; i++) {
    try {
      v = await fn();
      if (ok(v)) return v;
    } catch (e) {
      v = undefined; // el nodo público va unos segundos atrasado: se reintenta
    }
    await sleep(4000);
  }
  return v;
};
const ERC = parseAbi(["function balanceOf(address) view returns (uint256)"]);
const WETH = parseAbi(["function balanceOf(address) view returns (uint256)"]);
const ROUTER = parseAbi([
  "function exactInputSingle((address tokenIn,address tokenOut,uint24 fee,address recipient,uint256 amountIn,uint256 amountOutMinimum,uint160 sqrtPriceLimitX96)) payable returns (uint256)",
]);
const bal = (t, a) =>
  pub.readContract({ address: t, abi: ERC, functionName: "balanceOf", args: [a] });
const wbal = (a) =>
  pub.readContract({ address: CH.weth, abi: WETH, functionName: "balanceOf", args: [a] });
try {
  const start = await pub.getBalance({ address: me.account.address });
  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  async function open(file) {
    const pg = await browser.newPage({ viewport: { width: 390, height: 740 } }),
      sent = [],
      hashes = [];
    await pg.exposeFunction("__rpc", async (m, p) => {
      if (m === "eth_requestAccounts") return [me.account.address];
      if (m === "eth_chainId") return "0x" + CH.id.toString(16);
      if (m === "eth_getCode") return (await pub.getCode({ address: p[0] })) ?? "0x";
      if (m === "eth_sendTransaction") {
        const t = p[0];
        sent.push(t);
        const req = { to: t.to, data: t.data, value: BigInt(t.value || "0x0") };
        const gas = await pub.estimateGas({ account: me.account, ...req });
        const h = await me.sendTransaction({ ...req, gas: gas + gas / 2n });
        hashes.push(h);
        return h;
      }
      throw new Error("no soportado " + m);
    });
    await pg.addInitScript(() => {
      window.ethereum = { request: ({ method, params }) => window.__rpc(method, params || []) };
    });
    await pg.context().route("https://github.com/**", (r) => r.abort());
    await pg.goto("file://" + file);
    return { pg, sent, hashes };
  }

  step("1 · LAZY EN LA RED REAL: el creador (0 ETH) arma el plan; todavía no existe nada");
  const creator = privateKeyToAccount(generatePrivateKey()).address,
    nonce = String(Math.floor(Math.random() * 1e9));
  cli([
    "plan",
    "--chain",
    "sepolia",
    "--name",
    "Prueba Pagina Real",
    "--symbol",
    "REALP",
    "--creator",
    creator,
    "--buyer",
    "open",
    "--buy-eth",
    "0.0005",
    "--out",
    OUT,
    "--nonce",
    nonce,
  ]);
  const planFile = `${OUT}/REALP-${nonce}.json`,
    page = `${OUT}/REALP-${nonce}-firmar.html`;
  cli(["sign", planFile]);
  const token = readFileSync(page, "utf8").match(/outputCurrency=(0x[0-9a-fA-F]{40})/)[1];
  check(
    (await pub.getCode({ address: token })) === undefined,
    "La dirección del token ya se conoce, pero no existe nada en la red real",
    token,
  );
  check((await pub.getBalance({ address: creator })) === 0n, "El creador tiene 0 ETH");
  check(
    /RESULTADO: cumple/.test(cli(["check-site", page, "--token", token, "--plan", planFile])),
    "La página pasa el verificador y su transacción es exactamente la del plan auditado",
  );

  step("2 · EL PRIMER COMPRADOR firma desde la página (billetera de prueba → red real)");
  let { pg, sent, hashes } = await open(page);
  await pg.click("#gh");
  await pg.evaluate(() => window.dispatchEvent(new Event("focus")));
  await pg.click("#go");
  const h = await eventually(async () => hashes[0], Boolean, 40);
  const rc = await pub.waitForTransactionReceipt({ hash: h, timeout: 180000 });
  check(
    sent.length === 1 && rc.status === "success",
    "La página mandó UNA transacción y se confirmó en Sepolia",
    `${CH.explorer}/tx/${h} · gas ${rc.gasUsed}`,
  );
  const got = await eventually(
    () => bal(token, me.account.address),
    (v) => v > 0n,
  );
  check(
    got > 0n,
    "El comprador recibió sus tokens",
    `${(Number(got) / 1e18).toLocaleString("en-US", { maximumFractionDigits: 0 })} REALP`,
  );
  check(
    (await bal(token, creator)) === 0n && (await pub.getBalance({ address: creator })) === 0n,
    "El creador sigue con 0 tokens y 0 ETH: quien firmó pagó todo",
  );
  const blk = rc.blockNumber;
  await pg.close();

  step("3 · VERIFICAR SOLO CON LA DIRECCIÓN (red real)");
  const v = await eventually(
    async () => {
      try {
        return cli(["verify", token, "--chain", "sepolia", "--from-block", String(blk - 5n)]);
      } catch (e) {
        return String(e.stdout || e);
      }
    },
    (x) => /OFICIAL/.test(x) && !/✘/.test(x),
    6,
  );
  check(/OFICIAL/.test(v) && !/✘/.test(v), "Informe en verde y OFICIAL, leído de la cadena real");

  step("4 · UN SEGUNDO VISITANTE abre la página: ya no manda nada");
  ({ pg, sent } = await open(page));
  await pg.click("#gh");
  await pg.evaluate(() => window.dispatchEvent(new Event("focus")));
  await pg.click("#go");
  await sleep(2500);
  check(
    sent.length === 0 && (await pg.isVisible("#uni")),
    "La página detecta que el token ya existe, muestra Uniswap y NO manda transacción",
  );
  await pg.close();

  step("5 · SE OPERA: una compra real en Uniswap genera comisiones");
  const sw = await me.writeContract({
    address: CH.router,
    abi: ROUTER,
    functionName: "exactInputSingle",
    args: [
      {
        tokenIn: CH.weth,
        tokenOut: token,
        fee: 10000,
        recipient: me.account.address,
        amountIn: parseEther("0.0004"),
        amountOutMinimum: 1n,
        sqrtPriceLimitX96: 0n,
      },
    ],
    value: parseEther("0.0004"),
    gas: 1_500_000n,
  });
  await pub.waitForTransactionReceipt({ hash: sw });
  const fees = JSON.parse(
    await eventually(
      async () => {
        try {
          return cli([
            "fees",
            token,
            "--chain",
            "sepolia",
            "--from-block",
            String(blk - 5n),
            "--json",
          ]);
        } catch {
          return "{}";
        }
      },
      (x) => {
        try {
          return JSON.parse(x).positions?.some((p) => BigInt(p.weth) > 0n);
        } catch {
          return false;
        }
      },
      8,
    ),
  );
  const A = fees.positions.find((p) => p.role === "protocolo"),
    C = fees.positions.find((p) => p.role === "creador");
  check(
    BigInt(A.weth) > 0n && BigInt(C.weth) > 0n,
    "`fees` muestra lo acumulado de cada parte",
    `autor ${formatEther(BigInt(A.weth))} WETH · creador ${formatEther(BigInt(C.weth))} WETH`,
  );
  check(
    Math.abs(Number(A.weth) / (Number(A.weth) + Number(C.weth)) - 0.2) < 0.01,
    "La parte del autor es el 20 % y la del creador el 80 %",
    `${((Number(A.weth) / (Number(A.weth) + Number(C.weth))) * 100).toFixed(2)} %`,
  );

  step(
    "6 · COBRAR desde la página de cobro (la firma una billetera que no es ninguno de los dos dueños)",
  );
  const before = { a: await wbal(A.recipient), c: await wbal(C.recipient) };
  cli(["collect", token, "--chain", "sepolia", "--from-block", String(blk - 5n), "--out", OUT]);
  const c1 = await open(`${OUT}/cobrar-REALP.html`);
  for (const p of fees.positions) {
    await c1.pg.click(`#claim-${p.id}`);
    await eventually(
      async () => c1.hashes.length,
      (n) => n > fees.positions.indexOf(p),
      30,
    );
  }
  for (const hh of c1.hashes) await pub.waitForTransactionReceipt({ hash: hh, timeout: 180000 });
  const after = await eventually(
    async () => ({ a: await wbal(A.recipient), c: await wbal(C.recipient) }),
    (x) => x.a > before.a && x.c > before.c,
  );
  const dA = after.a - before.a,
    dC = after.c - before.c;
  check(
    c1.sent.length === 2 && dA > 0n && dC > 0n,
    "Cada dueño recibió sus comisiones; quien firmó solo pagó el gas",
    `autor +${formatEther(dA)} WETH · creador +${formatEther(dC)} WETH`,
  );
  check(
    dA >= BigInt(A.weth) && dA - BigInt(A.weth) < parseEther("0.00000001") && dC >= BigInt(C.weth),
    "Lo recibido es lo que `fees` dijo (más lo que se acumuló mientras tanto, si algo)",
  );
  await c1.pg.close();
  await browser.close();
  const end = await pub.getBalance({ address: me.account.address });
  console.log(
    `\n${pass} correctas · ${fail} fallas · saldo de prueba gastado ${formatEther(start - end)} ETH`,
  );
} catch (e) {
  fail++;
  console.error("ERROR:", e.shortMessage || e.stack || e);
  console.log(`\n${pass} correctas · ${fail} fallas`);
}
process.exit(fail ? 1 : 0);
