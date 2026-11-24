import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { keccak256 } from "viem";
const ART = JSON.parse(readFileSync(new URL("../src/artifacts.json", import.meta.url), "utf8"));
const cwd = new URL("../contracts/", import.meta.url).pathname;
execSync("forge build --silent", {
  cwd,
  stdio: "inherit",
  env: { ...process.env, PATH: process.env.PATH + ":/root/.foundry/bin" },
});
const items = [
  ["lock (propio, 2 sentencias)", "out/Lock.sol/Lock.json", ART.lock],
  [
    "token (OpenZeppelin 4.9.6)",
    "out/ERC20PresetFixedSupply.sol/ERC20PresetFixedSupply.json",
    ART.token,
  ],
];
let bad = 0;
for (const [name, file, expected] of items) {
  const out = JSON.parse(readFileSync(cwd + file, "utf8")).bytecode.object;
  const same = out.toLowerCase() === expected.toLowerCase();
  if (!same) bad++;
  console.log(
    `${same ? "✔" : "✘"} ${name}: ${keccak256(expected).slice(0, 18)}… ${same ? "coincide con el código fuente recompilado" : "NO coincide"}`,
  );
}
process.exit(bad ? 1 : 0);
