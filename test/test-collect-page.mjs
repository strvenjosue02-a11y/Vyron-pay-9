import { createRequire } from "node:module";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { renderCollect } from "../src/sign-template.mjs";
import { lockAddress } from "../src/builder.mjs";
import { checkSite } from "../src/check-site.mjs";
import { CHAINS } from "../src/chains.mjs";
import { OFFICIAL } from "../src/rules.mjs";
const require = createRequire(import.meta.url),
  { chromium } = require("playwright");
const ch = CHAINS.base,
  ME = "0x241B693d55f78A0268eA487a23f3C20E3593Be98",
  SIGNER = "0x1234567890AbcdEF1234567890aBcdef12345678";
const token = "0x4f2a8c1d9e3b7a60c5d84e1f2a9b3c7d6e5f4a31";
const info = {
  name: "Demo",
  symbol: "DEMO",
  image: null,
  chain: "Base",
  chainId: ch.id,
  explorer: ch.explorer,
  token,
  positions: [
    {
      role: "Autor",
      recipient: OFFICIAL.protocol,
      lock: lockAddress(ch.npm, OFFICIAL.protocol),
      id: "123456",
      ethText: "0.00210",
      wethText: "0.002000",
      tokenText: "1,500",
    },
    {
      role: "Creador",
      recipient: ME,
      lock: lockAddress(ch.npm, ME),
      id: "123457",
      ethText: "0.00840",
      wethText: "0.008000",
      tokenText: "6,000",
    },
  ],
};
let pass = 0,
  fail = 0;
const check = (c, l) => {
  c ? pass++ : fail++;
  console.log(`${c ? "✔" : "✘"} ${l}`);
};
const dir = mkdtempSync(tmpdir() + "/cobro-");
const save = (html) => {
  const f = `${dir}/p-${Math.random().toString(36).slice(2)}.html`;
  writeFileSync(f, html);
  return f;
};
const good = save(renderCollect(info));
const r0 = await checkSite(good, { token });
check(r0.ok, "La página de cobro oficial cumple todas las reglas");
const bad1 = await checkSite(
  save(
    renderCollect({
      ...info,
      positions: [{ ...info.positions[0], lock: "0x2222222222222222222222222222222222222222" }],
    }),
  ),
  { token },
);
check(
  !bad1.ok && bad1.rows.some((x) => !x.ok && /candado oficial/.test(x.label)),
  "Un cobro hacia una dirección que NO es el candado del dueño se rechaza",
);
const bad2 = await checkSite(
  save(renderCollect(info).replace("const SEL=", "fetch('//x');const SEL=")),
  { token },
);
check(
  !bad2.ok && bad2.rows.some((x) => !x.ok && /plantilla oficial/.test(x.label)),
  "Una línea de código distinta en la página de cobro se rechaza",
);
const b = await chromium.launch(),
  pg = await b.newPage({ viewport: { width: 390, height: 740 } }),
  sent = [];
await pg.exposeFunction("__sent", (p) => sent.push(p));
await pg.addInitScript((acc) => {
  window.ethereum = {
    request: async ({ method, params }) => {
      if (method === "eth_requestAccounts") return [acc];
      if (method === "eth_chainId") return "0x2105";
      if (method === "eth_sendTransaction") {
        await window.__sent(params[0]);
        return "0x" + "ab".repeat(32);
      }
      throw new Error("no soportado " + method);
    },
  };
}, SIGNER);
await pg.goto("file://" + good);
const fit = await pg.evaluate(() => [
  document.documentElement.scrollHeight <= innerHeight,
  document.documentElement.scrollWidth <= innerWidth,
]);
check(fit[0] && fit[1], "La página de cobro cabe en una pantalla de celular sin scroll");
await pg.click("#claim-123456");
await pg.waitForTimeout(400);
const t = sent[0];
check(
  sent.length === 1 &&
    t.to.toLowerCase() === info.positions[0].lock.toLowerCase() &&
    t.value === "0x0" &&
    t.data === "0xce3f865f" + (123456).toString(16).padStart(64, "0"),
  "Cobrar manda UNA transacción: valor 0, al candado del autor, con collect(id) y nada más",
);
check(
  /Enviado/.test(await pg.textContent("#st")) && /0x0715…b841/i.test(await pg.textContent("#st")),
  "Dice a qué billetera llegan las comisiones (la del dueño, no la de quien firma)",
);
await b.close();
console.log(`\n${pass} correctas · ${fail} fallas`);
process.exit(fail ? 1 : 0);
