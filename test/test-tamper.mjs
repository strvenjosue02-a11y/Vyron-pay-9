import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { build } from "../src/builder.mjs";
const D = new URL("../src/launch.mjs", import.meta.url).pathname,
  OUT = "/tmp/holdfast-tamper";
const ME = "0x241B693d55f78A0268eA487a23f3C20E3593Be98",
  EVIL = "0x00000000000000000000000000000000DeaDBeef";
let pass = 0,
  fail = 0;
const check = (c, l) => {
  c ? pass++ : fail++;
  console.log(`${c ? "✔" : "✘"} ${l}`);
};
const run = (args, env = {}) => {
  try {
    return {
      ok: true,
      out: execFileSync("node", [D, ...args], {
        env: { ...process.env, ...env },
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      }),
    };
  } catch (e) {
    return { ok: false, out: (e.stderr || "") + (e.stdout || "") };
  }
};
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
const planArgs = [
  "plan",
  "--chain",
  "sepolia",
  "--name",
  "Tamper",
  "--symbol",
  "TMP",
  "--creator",
  ME,
  "--buy-eth",
  "0.001",
  "--out",
  OUT,
  "--nonce",
  "777",
];
const p = run(planArgs);
check(p.ok, "El plan honesto se arma");
const file = `${OUT}/TMP-777.json`;
check(run(["sign", file]).ok, "El plan honesto se puede firmar (la página de firma se genera)");
const orig = JSON.parse(readFileSync(file, "utf8"));
const save = (o) => writeFileSync(file, JSON.stringify(o));
const mut = (label, f) => {
  const o = JSON.parse(JSON.stringify(orig));
  f(o);
  save(o);
  const r = run(["sign", file]);
  check(!r.ok && /NO COINCIDE/.test(r.out), `Plan alterado: ${label} -> se rechaza`);
  const r2 = run(["dryrun", file]);
  check(!r2.ok && /NO COINCIDE/.test(r2.out), `   y también el dryrun lo rechaza`);
};
mut("el destinatario de la compra/creador cambiado dentro de los datos", (o) => {
  o.tx.data = o.tx.data.split(ME.slice(2).toLowerCase()).join(EVIL.slice(2).toLowerCase());
});
mut("se cambia el destino de la transacción", (o) => {
  o.tx.to = EVIL;
});
mut("se sube el valor de ETH enviado", (o) => {
  o.tx.value = "1000000000000000000";
});
mut("se cambia la red", (o) => {
  o.tx.chainId = 1;
});
mut("se agregan datos extra al final", (o) => {
  o.tx.data += "deadbeef";
});
mut("se edita el input para quitar el 20 % del autor", (o) => {
  o.input.protocolBps = 0;
});
save(orig);
let r = run([
  ...planArgs.slice(0, 1),
  "--chain",
  "sepolia",
  "--name",
  "X",
  "--symbol",
  "XX",
  "--creator",
  ME,
  "--protocol",
  EVIL,
  "--protocol-bps",
  "0",
  "--out",
  OUT,
]);
check(
  !r.ok && /fija en la versi/.test(r.out),
  "No se puede cambiar el % ni la dirección del autor con --protocol",
);
const sp = run(
  [
    "plan",
    "--chain",
    "sepolia",
    "--name",
    "Fork",
    "--symbol",
    "FRK",
    "--creator",
    ME,
    "--protocol",
    EVIL,
    "--protocol-bps",
    "0",
    "--out",
    OUT,
    "--nonce",
    "888",
  ],
  { HOLDFAST_UNOFFICIAL: "1" },
);
check(sp.ok, "(preparación) un tercero arma un plan sin el 20 % con una copia modificada");
const sr = run(["sign", `${OUT}/FRK-888.json`]);
check(
  !sr.ok && /NO sigue las reglas oficiales/.test(sr.out),
  "Un plan consistente pero NO oficial se rechaza al firmar",
);
const bad = [
  ["RTL (U+202E) para voltear el texto", "Pay‮pal"],
  ["espacio de ancho cero", "Ba​se"],
  ["carácter de control", "Hi\u0007x"],
  ["nombre de 41 letras", "x".repeat(41)],
];
for (const [l, n] of bad) {
  let threw = false;
  try {
    build({ chain: "sepolia", name: n, symbol: "OK", creator: ME });
  } catch {
    threw = true;
  }
  check(threw, `Nombre engañoso rechazado: ${l}`);
}
for (const [l, s] of [
  ["símbolo con minúsculas raras/Unicode", "ΑΒC"],
  ["símbolo largo", "ABCDEFGHIJKLM"],
  ["símbolo con espacio", "A B"],
]) {
  let threw = false;
  try {
    build({ chain: "sepolia", name: "N", symbol: s, creator: ME });
  } catch {
    threw = true;
  }
  check(threw, `Símbolo engañoso rechazado: ${l}`);
}
let z = false;
try {
  build({
    chain: "sepolia",
    name: "N",
    symbol: "NN",
    creator: "0x0000000000000000000000000000000000000000",
  });
} catch {
  z = true;
}
check(z, "La dirección cero como creador se rechaza");
z = false;
try {
  build({
    chain: "sepolia",
    name: "N",
    symbol: "NN",
    creator: ME,
    protocol: "0x0000000000000000000000000000000000000000",
    protocolBps: 100,
  });
} catch {
  z = true;
}
check(z, "La dirección cero como receptor del autor se rechaza");
z = false;
try {
  build({ chain: "sepolia", name: "N", symbol: "NN", creator: "0x1234" });
} catch {
  z = true;
}
check(z, "Una dirección mal escrita se rechaza");
z = false;
try {
  build({
    chain: "sepolia",
    name: "N",
    symbol: "NN",
    creator: ME,
    protocol: EVIL,
    protocolBps: 9901,
  });
} catch {
  z = true;
}
check(z, "Parte del autor por encima del 99 % se rechaza");
rmSync(OUT, { recursive: true, force: true });
console.log(`\n${pass} correctas · ${fail} fallas`);
process.exit(fail ? 1 : 0);
