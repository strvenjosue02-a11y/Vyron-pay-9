import {
  createPublicClient, createWalletClient, custom, http, encodeDeployData, getContractAddress,
  concat, parseUnits, formatUnits, erc20Abi, defineChain,
} from "https://cdn.jsdelivr.net/npm/viem@2.21.54/+esm";
import { CONFIG } from "./config.js";
import { ALCANCIA_ABI as ABI, ALCANCIA_BYTECODE } from "./alcancia.js";

// ?rpc=... solo para pruebas locales
const RPC = new URLSearchParams(location.search).get("rpc") || CONFIG.rpc;
const SALT = "0x" + "00".repeat(32);
const STATE = ["En venta", "Activo (entregas por etapas)", "Reembolsos"];

const chain = defineChain({
  id: CONFIG.chainId, name: CONFIG.chainName,
  nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [RPC] } },
  blockExplorers: { default: { name: "Basescan", url: CONFIG.explorer } },
  contracts: { multicall3: { address: "0xcA11bde05977b3631167028862bE2a173976CA11" } },
});
const pub = createPublicClient({ chain, transport: http(RPC) });

let wallet = null, me = null, projects = [];
const $ = (s) => document.querySelector(s);
const usd = (v) => Number(formatUnits(v, 6)).toLocaleString("es", { maximumFractionDigits: 2 });
const tok = (v) => Number(formatUnits(v, 18)).toLocaleString("es", { maximumFractionDigits: 0 });
const short = (a) => a.slice(0, 6) + "…" + a.slice(-4);

function toast(msg, ms = 0) {
  const t = $("#toast");
  t.innerHTML = msg; t.style.display = msg ? "block" : "none";
  if (ms) setTimeout(() => (t.style.display = "none"), ms);
}

// ------------------------------------------------------------ dirección perezosa
function buildParams(p) {
  return {
    usdc: CONFIG.usdc, platform: CONFIG.platform, creator: p.creator, name: p.name, symbol: p.symbol,
    softcap: BigInt(p.softcap), hardcap: BigInt(p.hardcap), saleTokens: BigInt(p.saleTokens),
    creatorTokens: BigInt(p.creatorTokens), saleEnd: BigInt(p.saleEnd), initialBps: p.initialBps,
    milestones: p.milestones, milestonePeriod: BigInt(p.milestonePeriod),
  };
}
function prepare(project) {
  const params = buildParams(project.params);
  const initCode = encodeDeployData({ abi: ABI, bytecode: ALCANCIA_BYTECODE, args: [params] });
  const address = getContractAddress({ opcode: "CREATE2", from: CONFIG.deployer, salt: SALT, bytecode: initCode });
  return { ...project, params, initCode, address, exists: false, now: Math.floor(Date.now() / 1000),
    s: { state: 0, totalRaised: 0n, poolAfterFees: 0n, usdcReleased: 0n, milestonesDone: 0, voteEnd: 0n,
      votesYes: 0n, votesNo: 0n, deadline: 0n, succeeded: false, refundPool: 0n, voteRound: 0n },
    u: { contributed: 0n, claimed: false, settled: false, voted: false, balance: 0n } };
}

// ------------------------------------------------------------ lectura
const READS = ["state", "totalRaised", "poolAfterFees", "usdcReleased", "milestonesDone", "voteEnd",
  "votesYes", "votesNo", "deadline", "succeeded", "refundPool", "voteRound"];

async function load(p) {
  const code = await pub.getCode({ address: p.address });
  p.exists = !!code && code !== "0x";
  const block = await pub.getBlock();
  p.now = Number(block.timestamp);
  p.s = { state: 0, totalRaised: 0n, poolAfterFees: 0n, usdcReleased: 0n, milestonesDone: 0, voteEnd: 0n,
    votesYes: 0n, votesNo: 0n, deadline: 0n, succeeded: false, refundPool: 0n, voteRound: 0n };
  p.u = { contributed: 0n, claimed: false, settled: false, voted: false, balance: 0n };
  if (p.exists) {
    const r = await pub.multicall({ contracts: READS.map((f) => ({ address: p.address, abi: ABI, functionName: f })) });
    READS.forEach((f, i) => (p.s[f] = r[i].result));
    if (me) {
      const u = await pub.multicall({ contracts: [
        { address: p.address, abi: ABI, functionName: "contributed", args: [me] },
        { address: p.address, abi: ABI, functionName: "claimedTokens", args: [me] },
        { address: p.address, abi: ABI, functionName: "settled", args: [me] },
        { address: p.address, abi: ABI, functionName: "voted", args: [p.s.voteRound, me] },
        { address: p.address, abi: ABI, functionName: "balanceOf", args: [me] },
      ] });
      [p.u.contributed, p.u.claimed, p.u.settled, p.u.voted, p.u.balance] = u.map((x) => x.result);
    }
  }
}

// ------------------------------------------------------------ dibujo
function riskBox(p) {
  const { s, u } = p;
  if (!p.exists || s.state === 0)
    return `<div class="risk">🔒 <b>Protegido: 100%</b>. Si no se llega a la meta mínima, cada comprador recupera todo su dinero.</div>`;
  if (s.state === 2) {
    const mine = s.totalRaised > 0n ? (s.refundPool * u.contributed) / s.totalRaised : 0n;
    return `<div class="risk warn">↩️ <b>Reembolsos abiertos.</b> Quedan ${usd(s.refundPool)} USDC para devolver.` +
      (u.contributed ? ` Te corresponden <b>${usd(mine)} USDC</b>.` : "") + `</div>`;
  }
  const locked = s.poolAfterFees - s.usdcReleased;
  const maxLoss = s.totalRaised > 0n ? 100 - Number((locked * 10000n) / s.totalRaised) / 100 : 0;
  return `<div class="risk ${maxLoss > 50 ? "warn" : ""}">
    💰 Juntado: <b>${usd(s.totalRaised)} USDC</b><br>
    🔒 Protegido en la alcancía: <b>${usd(locked)} USDC</b><br>
    💧 Ya entregado al creador: <b>${usd(s.usdcReleased)} USDC</b><br>
    ⚠️ Lo máximo que podrías perder hoy: <b>${maxLoss.toFixed(1)}%</b> de lo que pusiste</div>`;
}

function actions(p) {
  const { s, u, params: q } = p, now = p.now, ended = now >= Number(q.saleEnd) || s.totalRaised >= q.hardcap;
  const isCreator = me && me.toLowerCase() === q.creator.toLowerCase();
  const b = [];
  if (s.state === 0 && !ended) {
    b.push(`<div class="row"><input type="number" min="0" step="0.01" inputmode="decimal" placeholder="USDC" id="amt-${p.id}">
      <button data-act="buy" data-id="${p.id}">${p.exists ? "Comprar" : "Comprar y crear alcancía"}</button></div>`);
  }
  if (p.exists && s.state === 0 && ended) b.push(btn("finalize", p, "Cerrar venta"));
  if (p.exists && s.succeeded && u.contributed > 0n && !u.claimed) b.push(btn("claimTokens", p, "Reclamar mis tokens", "ok"));
  if (s.state === 1) {
    const voteOpen = s.voteEnd > 0n && now < Number(s.voteEnd);
    if (voteOpen && u.contributed > 0n && !u.voted)
      b.push(`<div class="row">${btn("voteYes", p, "👍 Sí cumplió", "ok")}${btn("voteNo", p, "👎 No cumplió", "bad")}</div>`);
    if (s.voteEnd > 0n && !voteOpen) b.push(btn("closeVote", p, "Cerrar votación"));
    const pending = s.milestonesDone < q.milestones && s.voteEnd === 0n;
    if (isCreator && pending && now <= Number(s.deadline)) b.push(btn("requestRelease", p, "Pedir siguiente etapa (creador)", "secondary"));
    if (pending && now > Number(s.deadline)) b.push(btn("abandon", p, "Creador desaparecido: cancelar", "bad"));
  }
  if (s.state === 2 && u.contributed > 0n && !u.settled) b.push(btn("refund", p, "Pedir reembolso", "ok"));
  return b.join("");
}
const btn = (act, p, label, cls = "") => `<button class="${cls}" data-act="${act}" data-id="${p.id}">${label}</button>`;

function voteInfo(p) {
  const { s } = p;
  if (s.state !== 1) return "";
  const parts = [`Etapas aprobadas: <b>${s.milestonesDone} de ${p.params.milestones}</b>`];
  if (s.voteEnd > 0n) parts.push(`Votación en curso: 👍 ${usd(s.votesYes)} · 👎 ${usd(s.votesNo)} USDC · termina ${date(s.voteEnd)}`);
  else if (s.milestonesDone < p.params.milestones) parts.push(`El creador debe pedir la siguiente etapa antes del ${date(s.deadline)}`);
  return `<p class="muted">${parts.join("<br>")}</p>`;
}
const date = (t) => new Date(Number(t) * 1000).toLocaleDateString("es", { day: "numeric", month: "short", year: "numeric" });

function render() {
  $("#projects").innerHTML = projects.map((p) => {
    const { s, u, params: q } = p;
    const pct = Math.min(100, Number((s.totalRaised * 100n) / q.hardcap));
    const soft = Number((q.softcap * 100n) / q.hardcap);
    const status = p.exists ? STATE[s.state] : "Sin crear (la crea el primer comprador)";
    return `<div class="card">
      <div class="top"><div class="emoji">${p.image || "🚀"}</div>
        <div><h2>${q.name} <span class="muted">$${q.symbol}</span></h2><span class="badge">${status}</span></div></div>
      <p class="muted">${p.description || ""}</p>
      <div class="bar"><div style="width:${pct}%"></div><span class="soft" style="left:${soft}%"></span></div>
      <div class="muted">${usd(s.totalRaised)} de ${usd(q.hardcap)} USDC · mínimo ${usd(q.softcap)} · cierra ${date(q.saleEnd)}</div>
      <div class="grid">
        <div>Por cada 1 USDC<b>${tok((q.saleTokens * 1_000_000n) / q.hardcap)} ${q.symbol}</b></div>
        <div>Entrega al creador<b>${q.initialBps / 100}% + ${q.milestones} etapas</b></div>
      </div>
      ${riskBox(p)}${voteInfo(p)}
      ${u.contributed > 0n ? `<p class="muted">Tú pusiste <b>${usd(u.contributed)} USDC</b> · tienes <b>${tok(u.balance)} ${q.symbol}</b></p>` : ""}
      ${me ? actions(p) : `<p class="muted">Conecta tu wallet para participar.</p>`}
      <details><summary>Ver detalles técnicos</summary>
        <p>Alcancía: <a class="addr" target="_blank" href="${CONFIG.explorer}/address/${p.address}">${p.address}</a></p>
        <p>Creador: <span class="addr">${q.creator}</span><br>Comisiones: <span class="addr">${CONFIG.platform}</span> (1% USDC + 1,5% tokens, solo si tiene éxito)</p>
        <p class="muted">La dirección se calcula con las reglas del proyecto. Si alguien cambia una regla, la dirección cambia.</p>
      </details>
    </div>`;
  }).join("");
}

async function refresh() {
  await Promise.all(projects.map(load));
  render();
}

// ------------------------------------------------------------ wallet
function provider() { return window.phantom?.ethereum || window.ethereum; }

async function connect() {
  const eth = provider();
  if (!eth) { toast("No encontré una wallet. Abre esta página dentro de Phantom, MetaMask o Coinbase Wallet.", 6000); return; }
  const [addr] = await eth.request({ method: "eth_requestAccounts" });
  me = addr;
  await ensureChain(eth);
  wallet = createWalletClient({ account: me, chain, transport: custom(eth) });
  $("#connect").textContent = short(me);
  eth.on?.("accountsChanged", () => location.reload());
  eth.on?.("chainChanged", () => location.reload());
  await refresh();
}

async function ensureChain(eth) {
  const hex = "0x" + CONFIG.chainId.toString(16);
  if ((await eth.request({ method: "eth_chainId" })) === hex) return;
  try {
    await eth.request({ method: "wallet_switchEthereumChain", params: [{ chainId: hex }] });
  } catch (e) {
    if (e.code !== 4902) throw e;
    await eth.request({ method: "wallet_addEthereumChain", params: [{ chainId: hex, chainName: CONFIG.chainName,
      nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 }, rpcUrls: [CONFIG.rpc], blockExplorerUrls: [CONFIG.explorer] }] });
  }
}

async function send(label, req) {
  toast(`⏳ ${label}: confirma en tu wallet…`);
  const hash = await wallet.writeContract({ account: me, chain, ...req });
  toast(`⏳ ${label}: esperando la red…`);
  const r = await pub.waitForTransactionReceipt({ hash });
  if (r.status !== "success") throw new Error(`${label} falló`);
}

async function buy(p) {
  const raw = $(`#amt-${p.id}`).value;
  if (!raw || Number(raw) <= 0) return toast("Escribe cuántos USDC quieres poner.", 3000);
  const amount = parseUnits(raw, 6);
  const bal = await pub.readContract({ address: CONFIG.usdc, abi: erc20Abi, functionName: "balanceOf", args: [me] });
  if (bal < amount) return toast(`No tienes suficiente USDC (tienes ${usd(bal)}). En testnet pídelo gratis en <a href="https://faucet.circle.com" target="_blank">faucet.circle.com</a>.`, 8000);

  // 1) aprobar USDC hacia la alcancía (aunque todavía no exista)
  const allowance = await pub.readContract({ address: CONFIG.usdc, abi: erc20Abi, functionName: "allowance", args: [me, p.address] });
  if (allowance < amount) await send("Paso 1/3 · Autorizar USDC", { address: CONFIG.usdc, abi: erc20Abi, functionName: "approve", args: [p.address, amount] });

  // 2) crear la alcancía si no existe (el primer comprador paga centavos de gas)
  const code = await pub.getCode({ address: p.address });
  if (!code || code === "0x") {
    toast("⏳ Paso 2/3 · Crear la alcancía: confirma en tu wallet…");
    const hash = await wallet.sendTransaction({ account: me, chain, to: CONFIG.deployer, data: concat([SALT, p.initCode]) });
    toast("⏳ Paso 2/3 · Creando la alcancía…");
    const r = await pub.waitForTransactionReceipt({ hash });
    if (r.status !== "success") throw new Error("No se pudo crear la alcancía");
  }

  // 3) comprar
  await send("Paso 3/3 · Comprar", { address: p.address, abi: ABI, functionName: "buy", args: [amount, me] });
  toast("✅ ¡Compra hecha! Tu dinero está en la alcancía.", 5000);
}

async function onClick(e) {
  const el = e.target.closest("button[data-act]");
  if (!el) return;
  const p = projects.find((x) => x.id === el.dataset.id);
  const act = el.dataset.act;
  document.querySelectorAll("button").forEach((b) => (b.disabled = true));
  try {
    if (act === "buy") await buy(p);
    else {
      const map = { voteYes: ["vote", [true]], voteNo: ["vote", [false]] };
      const [fn, args] = map[act] || [act, []];
      await send(el.textContent, { address: p.address, abi: ABI, functionName: fn, args });
      toast("✅ Listo", 3000);
    }
  } catch (err) {
    console.error(err);
    toast("❌ " + (err.shortMessage || err.message || "Error"), 7000);
  } finally {
    document.querySelectorAll("button").forEach((b) => (b.disabled = false));
    await refresh();
  }
}

// ------------------------------------------------------------ inicio
async function main() {
  $("#net").textContent = "Red: " + CONFIG.chainName;
  if (!provider() && /Android|iPhone|iPad/i.test(navigator.userAgent)) {
    $("#phantom-tip").style.display = "block";
    $("#phantom-link").href = `https://phantom.app/ul/browse/${encodeURIComponent(location.href)}?ref=${encodeURIComponent(location.origin)}`;
  }
  $("#connect").onclick = () => connect().catch((e) => toast("❌ " + (e.shortMessage || e.message), 6000));
  document.addEventListener("click", onClick);
  const list = await (await fetch("./projects.json", { cache: "no-store" })).json();
  projects = list.map(prepare);
  render();
  await refresh();
  const eth = provider();
  if (eth) {
    const accs = await eth.request({ method: "eth_accounts" }).catch(() => []);
    if (accs.length) await connect();
  }
}
main().catch((e) => { console.error(e); toast("❌ " + e.message); });
