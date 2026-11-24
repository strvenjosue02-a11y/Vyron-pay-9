import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { build } from "../src/builder.mjs";
import { OFFICIAL } from "../src/rules.mjs";
import { checkSite } from "../src/check-site.mjs";
import { renderSign } from "../src/sign-template.mjs";
import { MULTISEND } from "../src/chains.mjs";
const dir = mkdtempSync(tmpdir() + "/site-"),
  ME = "0x241B693d55f78A0268eA487a23f3C20E3593Be98";
const plan = build({
  chain: "base",
  name: "Demo",
  symbol: "DEMO",
  creator: ME,
  protocol: OFFICIAL.protocol,
  protocolBps: OFFICIAL.protocolBps,
  nonce: 1,
});
const tx = { chainId: 8453, to: MULTISEND, value: "0", data: "0x00" },
  info = {
    name: "Demo",
    symbol: "DEMO",
    token: plan.token,
    chain: "Base",
    explorer: "https://basescan.org",
    real: true,
    deadline: 0,
    openBuyer: null,
    buyEth: 0,
    recipients: [],
  };
const info0 = {
  ...info,
  buyUrl: `https://app.uniswap.org/swap?chain=base&outputCurrency=${plan.token}&inputCurrency=ETH`,
  launched: false,
};
const ok = renderSign(tx, info0);
let pass = 0,
  fail = 0;
const check = (c, l) => {
  c ? pass++ : fail++;
  console.log(`${c ? "✔" : "✘"} ${l}`);
};
const run = async (html, o = {}) => {
  const f = `${dir}/p-${Math.random().toString(36).slice(2)}.html`;
  writeFileSync(f, html);
  return checkSite(f, { token: plan.token, ...o });
};
const r0 = await run(ok);
check(r0.ok && r0.rows.every((r) => r.ok || r.warn), "La página oficial cumple todas las reglas");
const r1 = await run(ok, { expect: r0.sha });
check(
  r1.ok && r1.rows.some((r) => /EXACTAMENTE/.test(r.label) && r.ok),
  "Con el hash que publicó el creador: coincide exactamente",
);
const r2 = await run(ok + " ");
const r3 = await run(ok + " ", { expect: r0.sha });
check(!r3.ok, "Si alguien cambia UN solo carácter, el hash ya no coincide y se rechaza");
const bad = [
  ["script externo", '<script src="https://cdn.evil.xyz/x.js"></script>', /No carga código/],
  [
    "enlace a sitio fuera de la lista",
    '<a href="https://evil.xyz/airdrop">gratis</a>',
    /Solo enlaza/,
  ],
  ["código oculto (eval)", '<script>eval("1+1")</script>', /Sin código oculto/],
  ["código oculto (atob)", '<script>atob("YQ==")</script>', /Sin código oculto/],
  ["bloque ofuscado", "<script>var a='" + "A".repeat(320) + "'</script>", /Sin código oculto/],
  ["pide la frase secreta", "<p>Escribe tu seed phrase para reclamar</p>", /Nunca pide llaves/],
  ["campo de contraseña", '<input type="password">', /Nunca pide llaves/],
  [
    "permiso ilimitado",
    "<script>var d='0x095ea7b3" + "f".repeat(64) + "'</script>",
    /permisos ilimitados/,
  ],
  ["setApprovalForAll", "<script>c.setApprovalForAll(x,true)</script>", /permisos ilimitados/],
  [
    "firma a ciegas (eth_sign)",
    "<script>ethereum.request({method:'eth_sign'})</script>",
    /permisos ilimitados/,
  ],
  [
    "transacción a una dirección desconocida",
    "<script>ethereum.request({method:'eth_sendTransaction',params:[{to:'0x1111111111111111111111111111111111111111'}]})</script>",
    /solo van al token/,
  ],
  ["iframe", '<iframe src="https://evil.xyz"></iframe>', /No carga código/],
];
for (const [l, html, re] of bad) {
  const r = await run(ok.replace("</main>", html + "</main>"));
  check(
    !r.ok && r.rows.some((x) => !x.ok && !x.warn && re.test(x.label)),
    `Trampa detectada: ${l}`,
  );
}
const other = await run(ok.split(plan.token).join("0x2222222222222222222222222222222222222222"));
check(!other.ok, "Si la página no contiene la dirección del token que dice vender, se rechaza");
const sg = (html, o = {}) => run(html, o);
const s0 = await sg(renderSign(tx, info0));
check(s0.ok, "Página de firma oficial: cumple todo, incluida la plantilla única");
const s2 = await sg(renderSign(tx, info).replace("const st=", "fetch('//x');const st="));
check(
  !s2.ok && s2.rows.some((x) => !x.ok && /plantilla oficial/.test(x.label)),
  "Una página de firma con UNA línea de código distinta se rechaza",
);
const s3 = await sg(renderSign({ ...tx, to: "0x2222222222222222222222222222222222222222" }, info));
check(
  !s3.ok && s3.rows.some((x) => !x.ok && /solo a Safe MultiSend/.test(x.label)),
  "Una plantilla cuya transacción va a otro contrato se rechaza",
);
const s4 = await sg(
  "<html><script>ethereum.request({method:'eth_sendTransaction'})</script>" +
    plan.token +
    "</html>",
);
check(!s4.ok, "Una página propia que manda transacciones (no es la plantilla) se rechaza");
const png =
  "data:image/png;base64," +
  Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47]), Buffer.alloc(3000, 5)]).toString("base64");
const i0 = await sg(renderSign(tx, { ...info, image: png }));
check(i0.ok, "Una página de firma con el logo del creador (imagen real, larga) cumple todo");
let badImg = false;
try {
  renderSign(tx, { ...info, image: "data:text/html;base64,PHNjcmlwdD4=" });
} catch {
  badImg = true;
}
check(badImg, "Un archivo que no es PNG/JPG/GIF/WEBP no entra como imagen");
const i1 = await sg(renderSign(tx, { ...info, image: png }).replace(png.slice(22, 30), "AAAAAAAA"));
check(
  !i1.ok && i1.rows.some((x) => !x.ok && /imagen/.test(x.label)),
  "Si la cabecera de la imagen no es de una imagen real, se rechaza",
);
const sl = await sg(renderSign(tx, { ...info0, launched: true }));
check(sl.ok, "La vista final (token ya creado: contrato + enlace a Uniswap) cumple todo");
const sb = await sg(
  renderSign(tx, { ...info0, buyUrl: "https://evil.xyz/swap?outputCurrency=" + plan.token }),
);
check(
  !sb.ok && sb.rows.some((x) => !x.ok && /enlace de compra/.test(x.label)),
  "Un enlace de compra a un sitio que no es Uniswap se rechaza",
);
const sd = await sg(
  renderSign(tx, { ...info0, buyUrl: info0.buyUrl.replace(plan.token.slice(2), "22".repeat(20)) }),
);
check(!sd.ok, "Un enlace de compra con OTRO token se rechaza");
console.log(`\n${pass} correctas · ${fail} fallas`);
process.exit(fail ? 1 : 0);
