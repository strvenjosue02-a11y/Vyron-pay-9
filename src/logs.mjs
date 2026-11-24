import { parseAbiItem } from "viem";
const TRANSFER = parseAbiItem(
  "event Transfer(address indexed from, address indexed to, uint256 value)",
);
const ZERO = "0x0000000000000000000000000000000000000000";
const same = (a, b) => String(a).toLowerCase() === String(b).toLowerCase();

export async function transferLogs(pub, token, fromBlock) {
  let step = 2000n,
    logs = [],
    hi = await pub.getBlockNumber(),
    found = false;
  for (let i = 0; i < 400 && !found && hi >= 0n; ) {
    const lo = fromBlock !== undefined ? BigInt(fromBlock) : hi > step ? hi - step : 0n;
    let part;
    try {
      part = await pub.getLogs({ address: token, event: TRANSFER, fromBlock: lo, toBlock: hi });
    } catch (e) {
      if (step <= 250n) throw e;
      step /= 2n;
      continue;
    }
    logs = [...part, ...logs];
    found = logs.some((l) => same(l.args.from, ZERO));
    i++;
    if (fromBlock !== undefined || lo === 0n) break;
    hi = lo - 1n;
  }
  const mint = logs.find((l) => same(l.args.from, ZERO));
  if (!mint)
    throw new Error("no se encontró la creación del token en el rango revisado (usa --from-block)");
  return { logs, mint };
}
