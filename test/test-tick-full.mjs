import { execSync } from "node:child_process";
import { keccak256, concat, pad, toHex } from "viem";
import { sqrtRatioAtTick } from "../src/tick.mjs";
const cwd = new URL("../contracts/", import.meta.url).pathname;
const out = execSync("forge script script/TickHash.s.sol --gas-limit 30000000000000", {
  cwd,
  encoding: "utf8",
  env: { ...process.env, PATH: process.env.PATH + ":/root/.foundry/bin" },
});
const sol = out.match(/0x[0-9a-f]{64}/)?.[0];
let h = "0x" + "00".repeat(32);
for (let t = -887272; t <= 887272; t++)
  h = keccak256(concat([h, pad(toHex(sqrtRatioAtTick(t)), { size: 20 })]));
console.log(
  sol === h
    ? "✔ 1,774,545 ticks: el puerto en JS coincide con TickMath oficial de Uniswap (0 diferencias)"
    : `✘ NO coincide: Solidity ${sol} · JS ${h}`,
);
process.exit(sol === h ? 0 : 1);
