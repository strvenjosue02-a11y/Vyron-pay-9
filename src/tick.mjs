const MAX_UINT256 = (1n << 256n) - 1n;
const C = [
  0xfff97272373d413259a46990580e213an,
  0xfff2e50f5f656932ef12357cf3c7fdccn,
  0xffe5caca7e10e4e61c3624eaa0941cd0n,
  0xffcb9843d60f6159c9db58835c926644n,
  0xff973b41fa98c081472e6896dfb254c0n,
  0xff2ea16466c96a3843ec78b326b52861n,
  0xfe5dee046a99a2a811c461f1969c3053n,
  0xfcbe86c7900a88aedcffc83b479aa3a4n,
  0xf987a7253ac413176f2b074cf7815e54n,
  0xf3392b0822b70005940c7a398e4b70f3n,
  0xe7159475a2c29b7443b29c7fa6e889d9n,
  0xd097f3bdfd2022b8845ad8f792aa5825n,
  0xa9f746462d870fdf8a65dc1f90e061e5n,
  0x70d869a156d2a1b890bb3df62baf32f7n,
  0x31be135f97d08fd981231505542fcfa6n,
  0x9aa508b5b7a84e1c677de54f3e99bc9n,
  0x5d6af8dedb81196699c329225ee604n,
  0x2216e584f5fa1ea926041bedfe98n,
  0x48a170391f7dc42444e8fa2n,
];
export function sqrtRatioAtTick(tick) {
  if (tick < -887272 || tick > 887272) throw new Error("tick fuera de rango");
  const abs = BigInt(tick < 0 ? -tick : tick);
  let ratio =
    (abs & 1n) !== 0n ? 0xfffcb933bd6fad37aa2d162d1a594001n : 0x100000000000000000000000000000000n;
  for (let i = 0; i < C.length; i++)
    if ((abs & (1n << BigInt(i + 1))) !== 0n) ratio = (ratio * C[i]) >> 128n;
  if (tick > 0) ratio = MAX_UINT256 / ratio;
  return (ratio >> 32n) + (ratio % (1n << 32n) === 0n ? 0n : 1n);
}
export const TICK_SPACING = 200; // pool de 1 %
export const WIDTH = 69200; // rango del pool: ~1000x entre el precio inicial y el tope

export function startTickForFdv(fdvQuote, quoteDecimals) {
  const price = (fdvQuote * 10 ** quoteDecimals) / (1e9 * 1e18);
  const t = Math.log(price) / Math.log(1.0001);
  return Math.round(t / TICK_SPACING) * TICK_SPACING;
}
export function fdvForTick(tick, quoteDecimals) {
  return (1.0001 ** tick * 1e9 * 1e18) / 10 ** quoteDecimals;
}
