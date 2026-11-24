import { execFileSync } from "node:child_process";
import { readFileSync, rmSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url),
  { chromium } = require("playwright");
const D = new URL("../src/launch.mjs", import.meta.url).pathname,
  OUT = "/tmp/holdfast-signpage";
const ME = "0x241B693d55f78A0268eA487a23f3C20E3593Be98",
  SIGNER = "0x1234567890AbcdEF1234567890aBcdef12345678",
  PH = "ffffffff";
const OFFICIAL_AUTHOR = "0x071532b51ae6206e9fdd3152b72999e5f581b841";
let pass = 0,
  fail = 0;
const check = (c, l) => {
  c ? pass++ : fail++;
  console.log(`${c ? "✔" : "✘"} ${l}`);
};
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
const sh = (a) => execFileSync("node", [D, ...a], { encoding: "utf8" });
async function run(file, accounts) {
  const b = await chromium.launch();
  const pg = await b.newPage();
  const sent = [];
  await pg.exposeFunction("__sent", (p) => sent.push(p));
  await pg.addInitScript((acc) => {
    window.ethereum = {
      request: async ({ method, params }) => {
        if (method === "eth_requestAccounts") return [acc];
        if (method === "eth_chainId") return "0xaa36a7";
        if (method === "eth_sendTransaction") {
          await window.__sent(params[0]);
          return "0x" + "ab".repeat(32);
        }
        throw new Error("no soportado " + method);
      },
    };
  }, accounts);
  await pg.goto("file://" + file);
  await pg.context().route("https://github.com/**", (r) => r.abort());
  await pg.click("#gh");
  await pg.evaluate(() => window.dispatchEvent(new Event("focus"))); // primero se ve el código; al volver aparece comprar
  await pg.click("#go");
  await pg.waitForTimeout(800);
  const text = await pg.textContent("#st"),
    info = await pg.textContent("#info");
  await b.close();
  return { sent, text, info };
}
sh([
  "plan",
  "--chain",
  "sepolia",
  "--name",
  "Pagina",
  "--symbol",
  "PAG",
  "--creator",
  ME,
  "--buyer",
  "open",
  "--buy-eth",
  "0.01",
  "--out",
  OUT,
  "--nonce",
  "321",
]);
sh(["sign", `${OUT}/PAG-321.json`]);
const open = await run(`${OUT}/PAG-321-firmar.html`, SIGNER);
const d = open.sent[0]?.data?.toLowerCase() ?? "";
check(open.sent.length === 1, "La página envía UNA transacción a la billetera");
check(
  d.includes(SIGNER.slice(2).toLowerCase()) && d.split(SIGNER.slice(2).toLowerCase()).length === 2,
  "Los tokens de la compra inicial van a quien firma (aparece su dirección exactamente una vez)",
);
check(
  !d.includes("000000000000000000000000" + PH) &&
    !d.includes("00000000000000000000000000000000" + PH),
  "El marcador ya no está en lo que se firma",
);
check(
  open.sent[0].value === "0x" + (10n ** 16n).toString(16),
  "El valor es exactamente el de la compra inicial (0.01 ETH)",
);
check(
  /Compra inicial abierta/.test(open.info) && /0\.01 ETH/.test(open.info),
  "La página le dice al comprador, antes de firmar, que recibirá la compra y cuánto pagará",
);
check(
  /irán a 0x1234/i.test(open.text) || /Enviado/.test(open.text),
  "Muestra a qué billetera irán los tokens",
);
sh([
  "plan",
  "--chain",
  "sepolia",
  "--name",
  "Normal",
  "--symbol",
  "NOR",
  "--creator",
  ME,
  "--out",
  OUT,
  "--nonce",
  "322",
]);
sh(["sign", `${OUT}/NOR-322.json`]);
const saved = JSON.parse(readFileSync(`${OUT}/NOR-322.json`, "utf8"));
const rcpText = await (async () => {
  const b = await chromium.launch(),
    pg = await b.newPage();
  await pg.goto("file://" + `${OUT}/PAG-321-firmar.html`);
  const r = { text: await pg.textContent("#rcp"), hidden: !(await pg.isVisible("#go")) };
  await b.close();
  return r;
})();
check(
  rcpText.hidden &&
    /para siempre/i.test(rcpText.text) &&
    rcpText.text.includes(ME) &&
    rcpText.text.toLowerCase().includes(OFFICIAL_AUTHOR),
  "La página muestra QUIÉN COBRA para siempre (creador y autor) y no deja comprar hasta ver el código en GitHub",
);
const nor = await run(`${OUT}/NOR-322-firmar.html`, SIGNER);
check(
  nor.sent[0]?.data === saved.tx.data,
  "Plan normal: se envía exactamente lo que calculó el plan, sin cambios",
);
{
  const b = await chromium.launch(),
    pg = await b.newPage();
  const sent = [];
  await pg.exposeFunction("__sent", (p) => sent.push(p));
  await pg.addInitScript((acc) => {
    window.ethereum = {
      request: async ({ method, params }) => {
        if (method === "eth_requestAccounts") return [acc];
        if (method === "eth_chainId") return "0xaa36a7";
        if (method === "eth_getCode") return "0x6080";
        if (method === "eth_sendTransaction") {
          await window.__sent(params[0]);
          return "0x" + "ab".repeat(32);
        }
        throw new Error("no soportado " + method);
      },
    };
  }, SIGNER);
  await pg.goto("file://" + `${OUT}/NOR-322-firmar.html`);
  await pg.context().route("https://github.com/**", (r) => r.abort());
  await pg.click("#gh");
  await pg.evaluate(() => window.dispatchEvent(new Event("focus")));
  await pg.click("#go");
  await pg.waitForTimeout(500);
  const view = {
    uni: await pg.isVisible("#uni"),
    go: await pg.isVisible("#go"),
    href: await pg.getAttribute("#uni", "href"),
  };
  check(
    sent.length === 0 &&
      view.uni &&
      !view.go &&
      /^https:\/\/app\.uniswap\.org\/swap\?chain=sepolia&outputCurrency=0x/.test(view.href),
    "Si el token ya existe, la página pasa a su vista final (enlace a Uniswap) y NO manda ninguna transacción",
  );
  await b.close();
}
const shx = (a) => {
  try {
    return [
      0,
      execFileSync("node", [D, ...a], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }),
    ];
  } catch (e) {
    return [e.status, String(e.stdout)];
  }
};
const realPage = `${OUT}/PAG-321-firmar.html`,
  realPlan = `${OUT}/PAG-321.json`,
  tokenOf = readFileSync(realPage, "utf8").match(/outputCurrency=(0x[0-9a-fA-F]{40})/)[1];
const [c0, t0] = shx(["check-site", realPage, "--token", tokenOf, "--plan", realPlan]);
check(
  c0 === 0 && /EXACTAMENTE la del plan/.test(t0),
  "La página real que genera la habilidad pasa el verificador y su transacción es exactamente la del plan",
);
const html0 = readFileSync(realPage, "utf8"),
  m0 = html0.match(/^const TX=(\{.*?\}), INFO=/m)[1],
  tx0 = JSON.parse(m0);
const evilTx = { ...tx0, data: tx0.data.replace(/(?<=0x.{200})./, (c) => (c === "a" ? "b" : "a")) };
require("node:fs").writeFileSync(`${OUT}/evil.html`, html0.replace(m0, JSON.stringify(evilTx)));
const [c1, t1] = shx(["check-site", `${OUT}/evil.html`, "--token", tokenOf, "--plan", realPlan]);
check(
  c1 !== 0 && /✘ La transacción de la página/.test(t1),
  "Una página con la plantilla oficial pero UN byte distinto en la transacción se rechaza al compararla con el plan",
);
{
  const b = await chromium.launch(),
    pg = await b.newPage(),
    sent = [];
  await pg.exposeFunction("__sent", (p) => sent.push(p));
  await pg.addInitScript((acc) => {
    const provider = {
      request: async ({ method, params }) => {
        if (method === "eth_requestAccounts") return [acc];
        if (method === "eth_chainId") return "0xaa36a7";
        if (method === "eth_getCode") return "0x";
        if (method === "eth_sendTransaction") {
          await window.__sent(params[0]);
          return "0x" + "ab".repeat(32);
        }
        throw new Error("no soportado " + method);
      },
    };
    window.addEventListener("eip6963:requestProvider", () =>
      window.dispatchEvent(
        new CustomEvent("eip6963:announceProvider", {
          detail: { info: { name: "Prueba" }, provider },
        }),
      ),
    );
  }, SIGNER);
  await pg.goto("file://" + `${OUT}/NOR-322-firmar.html`);
  await pg.context().route("https://github.com/**", (r) => r.abort());
  await pg.click("#gh");
  await pg.evaluate(() => window.dispatchEvent(new Event("focus")));
  await pg.click("#go");
  await pg.waitForTimeout(600);
  check(
    sent.length === 1,
    "Billetera que solo se anuncia por EIP-6963 (sin window.ethereum): la página la encuentra y manda la transacción",
  );
  await b.close();
}
const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(2000, 7),
]);
require("node:fs").writeFileSync(`${OUT}/logo.png`, PNG);
sh(["sign", `${OUT}/NOR-322.json`, "--image", `${OUT}/logo.png`]);
for (const [w, h] of [
  [360, 640],
  [390, 740],
  [1280, 720],
]) {
  const b = await chromium.launch(),
    pg = await b.newPage({ viewport: { width: w, height: h } });
  await pg.goto("file://" + `${OUT}/NOR-322-firmar.html`);
  const fit = await pg.evaluate(() => [
    document.documentElement.scrollHeight <= innerHeight,
    document.documentElement.scrollWidth <= innerWidth,
    !document.getElementById("img").hidden,
  ]);
  check(
    fit[0] && fit[1] && fit[2],
    `Una sola pantalla sin scroll (${w}×${h}) y con el logo del creador`,
  );
  await b.close();
}
rmSync(OUT, { recursive: true, force: true });
console.log(`\n${pass} correctas · ${fail} fallas`);
process.exit(fail ? 1 : 0);
