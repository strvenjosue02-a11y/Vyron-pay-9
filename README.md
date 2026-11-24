# Holdfast

Memecoin launcher on Uniswap v3 (Base). The creator pays nothing and gets no tokens: the first buyer pays the gas and opens the market. Liquidity sits in a 13-line contract with no way to take it out.

## What to read
`contracts/src/Lock.sol`: 13 lines. It owns the Uniswap positions, can only collect fees, and sends them to one fixed address. Everything else is tooling: every launch is audited before signing and checked on-chain afterwards (`verify`).

## Fixed terms
1 % pool fee: 20 % author, 80 % creator. 100 % of the supply goes to the pool. The creator gets no tokens. Token: OpenZeppelin 4.9.6, unmodified.

## Use
With Claude Code, inside this repo: `/lanzar` to launch, `/cobrar` to see and collect fees.
Without Claude: `npm install --omit=dev`, then `node src/launch.mjs plan|dryrun|sign|verify|fees|collect|links|check-site`.
Practice first on `--chain sepolia` with free test ETH from a faucet.
Host the signing page on any static host (GitHub Pages, Vercel…), next to `plan.json`.

## Test
`npm test` (offline) · `forge test` in `contracts/` with `FORK_URL=<rpc>` · `node test/test-fork.mjs` (`NET=base`, needs anvil) · `node test/check-artifacts.mjs`.

## Limits
Never launched on real Base yet. The Lock is community-reviewed, not professionally audited. A bot can be the first buyer. No refunds. A memecoin can lose all its value.
