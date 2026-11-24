import { build, fillOpenBuyer } from "../src/builder.mjs";
import { auditPlan, decodeCalls } from "../src/audit-plan.mjs";
import { encodeFunctionData, encodePacked, parseAbi, concat, size } from "viem";
const ME = "0x241B693d55f78A0268eA487a23f3C20E3593Be98",
  EVIL = "0x00000000000000000000000000000000DeaDBeef",
  PR = "0x071532b51ae6206e9fdd3152b72999e5f581b841",
  OP = "0x00000000000000000000000000000000000b0b0b";
const DEPLOYER = "0x4e59b44847b379578588920ca78fbf26c0b4956c";
let pass = 0,
  fail = 0;
const check = (c, l) => {
  c ? pass++ : fail++;
  console.log(`${c ? "✔" : "✘"} ${l}`);
};
const MS = parseAbi(["function multiSend(bytes transactions) payable"]);
const repack = (calls) =>
  encodeFunctionData({
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
const base = {
  chain: "sepolia",
  name: "Auditoria",
  symbol: "AUD",
  creator: ME,
  protocol: PR,
  protocolBps: 2000,
  buyWei: "1000000000000000",
  nonce: 4242,
};
for (const [l, extra] of [
  ["con compra (nonce 4242)", {}],
  ["nonce 7", { nonce: 7 }],
  ["nonce 99", { nonce: 99 }],
  ["nonce 12345", { nonce: 12345 }],
  ["sin compra", { buyWei: 0 }],
  ["patrocinado (comprador distinto)", { buyer: OP }],
  ["red Base", { chain: "base" }],
  ["sin parte del autor (no oficial)", { protocolBps: 0 }],
])
  check(auditPlan(build({ ...base, ...extra })).length === 0, `Plan honesto pasa: ${l}`);
const open = build({ ...base, buyer: "open" });
check(auditPlan(open).length === 0, "Comprador abierto (con marcador): pasa");
check(
  auditPlan({ ...open, data: fillOpenBuyer(open.data, ME), cfg: { ...open.cfg, buyer: ME } })
    .length === 0,
  "Con el marcador reemplazado por la billetera de quien firma: pasa",
);
check(
  auditPlan({ ...open, data: fillOpenBuyer(open.data, EVIL) }).length > 0,
  "Si el marcador se reemplaza por una dirección distinta de la declarada: se rechaza",
);
const plan = build(base),
  calls = decodeCalls(plan.data),
  t = plan.token.toLowerCase(),
  lockOf = (r) =>
    plan.positions
      .find((p) => p.role === r)
      .lock.slice(2)
      .toLowerCase();
const idx = (f) => calls.findIndex(f),
  sw = (h, a, b) => h.split(a.slice(2).toLowerCase()).join(b.slice(2).toLowerCase());
const mintOf = (r) =>
  idx((k) => k.data.startsWith("0x88316456") && k.data.toLowerCase().includes(lockOf(r)));
const mut = (label, f, valueDelta = 0n) => {
  const cs = calls.map((k) => ({ ...k }));
  f(cs);
  const r = auditPlan({ ...plan, data: repack(cs), value: plan.value + valueDelta });
  check(
    r.length > 0,
    `Manipulado: ${label} -> ${r.length ? "RECHAZADO (" + r[0].slice(0, 58) + ")" : "¡ACEPTADO!"}`,
  );
};
const transfer = (to, hexAmount = "ffff") =>
  "0xa9059cbb" + to.slice(2).toLowerCase().padStart(64, "0") + hexAmount.padStart(64, "0");
mut("se regalan tokens al creador", (c) =>
  c.push({ op: 0, to: plan.token, value: 0n, data: transfer(ME, "1") }),
);
mut("se manda suministro a una dirección del atacante", (c) =>
  c.push({ op: 0, to: plan.token, value: 0n, data: transfer(EVIL) }),
);
mut(
  "se agrega una llamada a un destino desconocido con ETH",
  (c) => c.push({ op: 0, to: EVIL, value: 1n, data: "0x" }),
  1n,
);
mut("se quita la posición del autor", (c) => c.splice(mintOf("protocolo"), 1));
mut("la posición del autor recibe 1 token menos", (c) => {
  const i = mintOf("protocolo"),
    amt = (2000n * 1_000_000_000n * 10n ** 18n) / 10000n;
  c[i].data = c[i].data.replace(
    amt.toString(16).padStart(64, "0"),
    (amt - 1n).toString(16).padStart(64, "0"),
  );
});
mut("una posición se manda a un receptor del atacante", (c) => {
  const i = mintOf("creador");
  c[i].data = sw(c[i].data, "0x" + lockOf("creador"), EVIL);
});
mut("el rango de una posición es distinto", (c) => {
  const i = mintOf("creador"),
    h = c[i].data;
  c[i].data =
    h.slice(0, 10 + 64 * 3) +
    (BigInt("0x" + h.slice(10 + 64 * 3, 10 + 64 * 4)) + 200n).toString(16).padStart(64, "0") +
    h.slice(10 + 64 * 4);
});
mut("el precio de arranque del pool es otro", (c) => {
  const i = idx((k) => k.data.startsWith("0x13ead562"));
  c[i].data = c[i].data.slice(0, -2) + (c[i].data.slice(-2) === "01" ? "02" : "01");
});
mut("todo el suministro va a otro dueño inicial", (c) => {
  const j = idx((k) => k.to.toLowerCase() === DEPLOYER);
  c[j].data = sw(c[j].data, "0x9641d764fc13c8B624c04430C7356C1C7C8102e2", EVIL);
});
mut("se da permiso ilimitado al atacante", (c) => {
  const j = idx((k) => k.to.toLowerCase() === t && k.data.startsWith("0x095ea7b3"));
  c[j].data = sw(c[j].data, plan.chain.npm, EVIL);
});
mut("una llamada es delegatecall", (c) => {
  c[0].op = 1;
});
mut("se desplegaría un contrato desconocido", (c) =>
  c.push({
    op: 0,
    to: "0x4e59b44847b379578588920cA78FbF26c0B4956C",
    value: 0n,
    data: "0x" + "00".repeat(32) + "6000600055",
  }),
);
mut("se esconde un vesting o contrato extra (se repite el despliegue del token)", (c) =>
  c.push({ ...c[0] }),
);
mut("la compra inicial va a otro comprador", (c) => {
  const j = idx((k) => k.to.toLowerCase() === plan.chain.router.toLowerCase());
  c[j].data = sw(c[j].data, ME, EVIL);
});
mut("el ETH enviado no coincide con las llamadas", () => {}, 5n);
mut(
  "el depósito de WETH es por otro monto",
  (c) => {
    const j = idx((k) => k.value > 0n);
    c[j].value += 1n;
  },
  1n,
);
console.log(`\n${pass} correctas · ${fail} fallas`);
process.exit(fail ? 1 : 0);
