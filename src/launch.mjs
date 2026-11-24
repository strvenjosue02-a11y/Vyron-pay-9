#!/usr/bin/env node
import {
  createPublicClient,
  http,
  parseEther,
  parseAbi,
  toFunctionSelector,
  concat,
  pad,
} from "viem";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import {
  build,
  buildWithRpc,
  OPEN_BUYER,
  fillOpenBuyer,
  lockAddress,
  lockInit,
} from "./builder.mjs";
import { verify, toMarkdown } from "./verify.mjs";
import { OFFICIAL, isOfficial } from "./rules.mjs";
import { CHAINS, MULTISEND, DEPLOYER } from "./chains.mjs";
import { fdvForTick } from "./tick.mjs";
import { auditPlan } from "./audit-plan.mjs";
import { checkSite } from "./check-site.mjs";
import { renderSign, renderCollect, imageDataUri } from "./sign-template.mjs";
import { pendingFees, feesText } from "./fees.mjs";
import { verifyToken, verifyTokenText } from "./verify-token.mjs";

const [cmd, ...rest] = process.argv.slice(2),
  flags = {},
  pos = [];
for (let i = 0; i < rest.length; i++) {
  if (rest[i].startsWith("--"))
    flags[rest[i].slice(2)] =
      rest[i + 1]?.startsWith("--") || rest[i + 1] === undefined ? "true" : rest[++i];
  else pos.push(rest[i]);
}
const OUT = flags.out || "launches",
  NOW = Math.floor(Date.now() / 1000);
const j = (o) => JSON.stringify(o, (_, v) => (typeof v === "bigint" ? v.toString() : v), 2);
const die = (m) => {
  console.error("✘ " + m);
  process.exit(1);
};
const pubFor = (chain) => createPublicClient({ transport: http(flags.rpc || chain.rpc) });
const signPage = (tx, info) => renderSign(tx, info);

const UNOFFICIAL = process.env.HOLDFAST_UNOFFICIAL === "1";
function inputFromFlags() {
  if (!UNOFFICIAL && (flags.protocol || flags["protocol-bps"]))
    die(
      "La parte del autor es fija en la versión oficial (20 % de la comisión). Quita --protocol y --protocol-bps.",
    );
  if (!flags.name || !flags.symbol || !flags.creator)
    die("faltan --name, --symbol y --creator (dirección pública 0x… de quien lanza)");
  return {
    chain: flags.chain || "base",
    name: flags.name,
    symbol: flags.symbol,
    creator: flags.creator,
    fdv: flags.fdv && Number(flags.fdv),
    buyer: flags.buyer,
    protocol: UNOFFICIAL ? flags.protocol : OFFICIAL.protocol,
    protocolBps: UNOFFICIAL ? Number(flags["protocol-bps"] || 0) : OFFICIAL.protocolBps,
    buyWei: flags["buy-eth"] ? parseEther(flags["buy-eth"]).toString() : 0,
    nonce: flags.nonce ? Number(flags.nonce) : Math.floor(Math.random() * 1e9),
    deadline: NOW + Number(flags["deadline-hours"] || 1) * 3600,
  };
}
const loadPlan = (f) => {
  const saved = JSON.parse(readFileSync(f, "utf8"));
  return { saved, plan: build(saved.input) };
};
async function loadVerifiedPlan(f) {
  const { saved } = loadPlan(f),
    chain = CHAINS[saved.input.chain];
  if (!chain) die("red desconocida en el plan");
  const fresh = await buildWithRpc(saved.input, pubFor(chain)),
    t = saved.tx;
  if (
    !t ||
    fresh.data !== t.data ||
    fresh.to.toLowerCase() !== String(t.to).toLowerCase() ||
    fresh.value.toString() !== String(t.value) ||
    fresh.chainId !== t.chainId
  )
    die(
      "EL ARCHIVO DEL PLAN NO COINCIDE con lo que se calcula desde sus datos: puede haber sido alterado, o cambió algo en la red (p. ej. un candado nuevo). NO lo firmes: vuelve a ejecutar `plan`.",
    );
  const bad = auditPlan(fresh);
  if (bad.length)
    die("La revisión independiente encontró problemas: " + bad.join("; ") + ". NO la firmes.");
  if (!UNOFFICIAL && !isOfficial(fresh))
    die(
      "Este plan NO sigue las reglas oficiales (falta o está reducida la parte fija del autor). No lo firmes: puede venir de una copia modificada.",
    );
  return { saved, plan: fresh };
}
const isAddr = (s) => /^0x[0-9a-fA-F]{40}$/.test(s || "");
const hasCode = async (pub, address) => {
  const x = await pub.getCode({ address });
  return !!x && x !== "0x";
};

async function main() {
  if (cmd === "plan") {
    const input = inputFromFlags(),
      chain = CHAINS[input.chain];
    if (!chain) die("red desconocida (usa base o sepolia)");
    const p = await buildWithRpc(input, pubFor(chain)),
      bad = auditPlan(p);
    if (bad.length) die("La revisión independiente encontró problemas: " + bad.join("; "));
    mkdirSync(OUT, { recursive: true });
    const file = `${OUT}/${p.cfg.symbol}-${input.nonce}.json`;
    writeFileSync(
      file,
      j({
        input,
        token: p.token,
        calls: p.calls,
        positions: p.positions,
        startTick: p.startTick,
        tx: { chainId: p.chainId, to: p.to, value: p.value.toString(), data: p.data },
      }),
    );
    console.log(
      `\nPLAN: ${p.cfg.name} (${p.cfg.symbol}) en ${chain.name}${chain.testnet ? "" : "  ← RED REAL (dinero real)"}\nDirección del token (ya se conoce): ${p.token}\nValor de arranque: ${fdvForTick(p.startTick, 18).toFixed(2)} ETH (tick ${p.startTick})\n\nReparto de comisiones del pool (1 %):`,
    );
    for (const q of p.positions)
      console.log(
        `  ${q.role.padEnd(10)} ${(q.bps / 100).toFixed(2).padStart(6)} % de la comisión (= ${(q.bps / 10000).toFixed(4)} % del volumen) → ${q.recipient}`,
      );
    if (!(await hasCode(pubFor(chain), lockAddress(chain.npm, OFFICIAL.protocol))))
      console.log(
        `\n⚠ El candado del autor aún no existe en ${chain.name}. Si vas a compartir este plan por varios días, créalo antes (una vez): node launch.mjs lock --chain ${input.chain} --recipient ${OFFICIAL.protocol}`,
      );
    if (input.buyer === "open")
      console.log(
        `\nPrimer comprador ABIERTO: quien firme y envíe la transacción recibe la compra inicial de ${flags["buy-eth"]} ETH. Nada existe en la cadena hasta que alguien la envíe.`,
      );
    console.log(
      `\nRevisión independiente: ✔ la transacción hace exactamente lo prometido y nada más (${p.calls} llamadas, todas permitidas).`,
    );
    if ([1, 11155111].includes(chain.id))
      console.log(
        "⚠ Esta red tiene cola pública de transacciones: alguien podría adelantarse y hacer fallar el lanzamiento (no se pierde dinero, solo gas). Usa un RPC privado o Base.",
      );
    console.log(
      "\nTokens: el 100 % del suministro va al pool, bloqueado para siempre. El creador NO recibe tokens: cobra comisiones y, si quiere tokens, los compra como cualquiera.\n\nSi alguien compra…",
    );
    console.log(`\nPlan guardado en ${file}. Siguiente: node launch.mjs sign ${file}`);
  } else if (cmd === "sign") {
    const lp = loadPlan(pos[0]),
      exists = await hasCode(pubFor(lp.plan.chain), lp.plan.token).catch(() => false),
      { saved, plan } = exists ? lp : await loadVerifiedPlan(pos[0]),
      t = saved.tx,
      f = pos[0].replace(/\.json$/, "-firmar.html");
    writeFileSync(
      f,
      signPage(
        { chainId: t.chainId, to: t.to, value: t.value, data: t.data, gas: plan.chain.gasLimit },
        {
          name: plan.cfg.name,
          symbol: plan.cfg.symbol,
          image: flags.image ? imageDataUri(readFileSync(flags.image)) : null,
          launched: exists,
          buyUrl: `https://app.uniswap.org/swap?chain=${plan.chain.uniswap}&outputCurrency=${plan.token}&inputCurrency=ETH`,
          token: plan.token,
          chain: plan.chain.name,
          explorer: plan.chain.explorer,
          real: !plan.chain.testnet,
          deadline: plan.cfg.deadline,
          openBuyer: plan.cfg.buyer === OPEN_BUYER ? OPEN_BUYER.slice(2).toLowerCase() : null,
          buyEth: Number(plan.cfg.buyEth) / 1e18,
          recipients: plan.positions.map((p) => ({
            role: p.role === "protocolo" ? "Autor" : "Creador",
            address: p.recipient,
            pct: p.bps / 100,
          })),
        },
      ),
    );
    console.log(
      exists
        ? `El token ya existe: ${f} es la vista final (contrato real + enlace de compra). Súbela de nuevo a tu sitio.`
        : `Página lista: ${f}\nPara compartirla, sube al MISMO sitio (p. ej. GitHub Pages) estos DOS archivos: la página y el plan ${pos[0]}. Así cualquier comprador puede comprobar, antes de pagar, que la transacción de la página es exactamente la auditada: check-site <página> --plan <plan.json>.\nPara probarla tú, ábrela en el navegador donde tengas tu billetera (MetaMask, Rabby, Coinbase Wallet…). Quien firma ve y confirma; Claude nunca ve llaves.`,
    );
  } else if (cmd === "dryrun") {
    const { saved, plan } = await loadVerifiedPlan(pos[0]),
      t = saved.tx,
      open = plan.cfg.buyer === OPEN_BUYER;
    if (open && !flags.from)
      die(
        "Con comprador abierto, usa --from <billetera con saldo> para simular quién lo enviaría.",
      );
    try {
      const pub = pubFor(plan.chain),
        gas = await pub.estimateGas({
          account: flags.from || plan.cfg.buyer,
          to: t.to,
          data: open ? fillOpenBuyer(t.data, flags.from) : t.data,
          value: BigInt(t.value),
        });
      console.log(
        `✔ La transacción se ejecutaría bien en ${plan.chain.name} (simulada contra el estado actual). Gas ≈ ${gas}, costo ≈ ${(Number(gas * (await pub.getGasPrice())) / 1e18).toFixed(6)} ETH.`,
      );
    } catch (e) {
      die(
        "La transacción FALLARÍA en " +
          plan.chain.name +
          ": " +
          (e.shortMessage || e.message) +
          ". No la firmes.",
      );
    }
  } else if (cmd === "verify" && isAddr(pos[0])) {
    const r = await verifyToken(flags.chain || "base", pos[0], {
      rpc: flags.rpc,
      fromBlock: flags["from-block"],
    });
    console.log(verifyTokenText(r, toMarkdown));
    process.exit(r.ok && r.problems.length === 0 && r.res.checks.every((k) => k.ok) ? 0 : 2);
  } else if (cmd === "verify") {
    const { plan } = loadPlan(pos[0]),
      res = await verify(plan, flags.rpc),
      md = toMarkdown(plan, res);
    console.log(md);
    writeFileSync(pos[0].replace(/\.json$/, "-informe.md"), md);
    process.exit(res.checks.every((k) => k.ok) ? 0 : 2);
  } else if (cmd === "fees" || cmd === "collect") {
    let plan, res;
    if (isAddr(pos[0])) {
      const t = await verifyToken(flags.chain || "base", pos[0], {
        rpc: flags.rpc,
        fromBlock: flags["from-block"],
      });
      if (!t.ok) die(t.why);
      ({ plan, res } = t);
    } else {
      ({ plan } = loadPlan(pos[0]));
      res = await verify(plan, flags.rpc);
    }
    if (flags.recipient) {
      res.positions = res.positions.filter(
        (p) => p.recipient.toLowerCase() === flags.recipient.toLowerCase(),
      );
      if (!res.positions.length) die("Esa billetera no tiene posición en este token.");
    }
    const f = await pendingFees(plan, res, flags.rpc),
      sel = toFunctionSelector("collect(uint256)").slice(2),
      chainId = plan.chainId ?? plan.chain.id;
    if (cmd === "fees") {
      console.log(flags.json ? j(f) : feesText(plan, f));
    } else if (flags.json) {
      console.log(
        j(
          f.positions.map((p) => ({
            chainId,
            to: p.lock,
            value: "0",
            data: "0x" + sel + BigInt(p.id).toString(16).padStart(64, "0"),
            role: p.role,
            recipient: p.recipient,
          })),
        ),
      );
    } else {
      const num = (b) => (Number(b) / 1e18).toLocaleString("en-US", { maximumFractionDigits: 2 });
      mkdirSync(OUT, { recursive: true });
      const file = `${OUT}/cobrar-${plan.cfg.symbol}.html`;
      writeFileSync(
        file,
        renderCollect({
          name: plan.cfg.name,
          symbol: plan.cfg.symbol,
          image: flags.image ? imageDataUri(readFileSync(flags.image)) : null,
          chain: plan.chain.name,
          chainId,
          explorer: plan.chain.explorer,
          token: plan.token,
          positions: f.positions.map((p) => ({
            role: p.role === "protocolo" ? "Autor" : "Creador",
            recipient: p.recipient,
            lock: p.lock,
            id: p.id,
            ethText: p.ethValue < 0.00001 ? "<0.00001" : p.ethValue.toFixed(5),
            wethText: (Number(p.weth) / 1e18).toFixed(6),
            tokenText: num(p.token),
          })),
        }),
      );
      console.log(
        `${feesText(plan, f)}\n\nPágina para cobrar: ${file} (ábrela con tu billetera y toca Cobrar en tu fila). Pasa \`check-site\` si quieres comprobarla.`,
      );
    }
  } else if (cmd === "lock") {
    const chain = CHAINS[flags.chain || "base"];
    if (!chain || !flags.recipient) die("uso: lock --chain base --recipient 0x…");
    if (/^0x0{40}$/i.test(flags.recipient))
      die(
        "La dirección cero no sirve: las comisiones se perderían. Usa la billetera real de quien cobra.",
      );
    const addr = lockAddress(chain.npm, flags.recipient);
    if (await hasCode(pubFor(chain), addr))
      return console.log(`✔ El candado de ${flags.recipient} ya existe en ${chain.name}: ${addr}.`);
    mkdirSync(OUT, { recursive: true });
    const f = `${OUT}/candado-${flags.recipient.slice(2, 8)}-firmar.html`;
    writeFileSync(
      f,
      signPage(
        {
          chainId: chain.id,
          to: DEPLOYER,
          value: "0",
          data: concat([pad("0x0", { size: 32 }), lockInit(chain.npm, flags.recipient)]),
        },
        {
          name: "Candado",
          symbol: flags.recipient.slice(0, 8),
          token: addr,
          chain: chain.name,
          explorer: chain.explorer,
          real: !chain.testnet,
          deadline: 0,
          openBuyer: null,
          buyEth: 0,
        },
      ),
    );
    console.log(`Candado futuro: ${addr}\nAbre ${f} en tu billetera y firma (solo gas).`);
  } else if (cmd === "links") {
    const { plan } = loadPlan(pos[0]),
      c = plan.chain;
    console.log(
      `Comprar (Uniswap): https://app.uniswap.org/swap?chain=${c.uniswap}&outputCurrency=${plan.token}&inputCurrency=ETH\nGráfico: https://dexscreener.com/${c.uniswap}/${plan.token}\nContrato: ${c.explorer}/address/${plan.token}\nMapa de wallets: https://app.bubblemaps.io/${c.uniswap === "base" ? "base" : "eth"}/token/${plan.token}`,
    );
  } else if (cmd === "verify-chain") {
    let bad = 0;
    for (const [k, c] of Object.entries(CHAINS))
      try {
        const pub = pubFor(c),
          w = await pub.readContract({
            address: c.npm,
            abi: parseAbi(["function WETH9() view returns (address)"]),
            functionName: "WETH9",
          });
        const ok =
          (
            await Promise.all([c.npm, c.router, MULTISEND, DEPLOYER].map((a) => hasCode(pub, a)))
          ).every(Boolean) && w.toLowerCase() === c.weth.toLowerCase();
        console.log(
          `${ok ? "✔" : "✘"} ${k}: administrador de posiciones, router, Safe MultiSend, desplegador CREATE2 y WETH coinciden`,
        );
        if (!ok) bad++;
      } catch (e) {
        console.log(`? ${k}: no se pudo consultar (${(e.shortMessage || e.message).slice(0, 60)})`);
      }
    process.exit(bad ? 1 : 0);
  } else if (cmd === "check-site") {
    const r = await checkSite(pos[0], { token: flags.token, expect: flags.expect });
    let ok = r.ok,
      extra = "";
    if (flags.plan) {
      const { saved } = await loadVerifiedPlan(flags.plan),
        html = /^https?:\/\//.test(pos[0])
          ? await fetch(pos[0]).then((x) => x.text())
          : readFileSync(pos[0], "utf8"),
        tx = JSON.parse((html.match(/^const TX=(\{.*?\}), INFO=\{/m) || [])[1] || "{}"),
        same =
          tx.data === saved.tx.data &&
          String(tx.to).toLowerCase() === String(saved.tx.to).toLowerCase() &&
          String(tx.value) === String(saved.tx.value);
      ok = ok && same;
      extra = `\n${same ? "✔" : "✘"} La transacción de la página es EXACTAMENTE la del plan, y el plan se recalculó, pasó la revisión independiente y es OFICIAL`;
    }
    console.log(r.text + extra);
    process.exit(ok ? 0 : 2);
  } else
    console.log(
      "Comandos: plan · sign · dryrun · verify · fees · collect · links · lock · verify-chain · check-site  (verify, fees y collect aceptan un archivo de plan o la dirección 0x… del token con --chain)",
    );
}
main().catch((e) => die(e.shortMessage || e.message));
