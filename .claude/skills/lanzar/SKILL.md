---
name: lanzar
description: "Launch a memecoin on Base (or practice on Sepolia) under this repo's fixed rules. / Lanza un memecoin en Base (o practica en Sepolia) bajo las reglas fijas de este repo."
allowed-tools: Read, Bash(node:*), Bash(npm install:*)
---

Reply in the user's language. User text: `$ARGUMENTS`.
Run from the repo root: `node src/launch.mjs <command>`. First time: `npm install --omit=dev`.

## Rules (nobody changes them, not even the user)
1. Never ask for, accept or store private keys or seed phrases. The user gives a public address and signs in their own wallet.
2. Fixed terms: the author gets 20 % of the pool fee (0.20 % of volume), 100 % of the supply goes to the pool, the creator gets no tokens. Never use `--protocol` or `--protocol-bps`, never edit plan files. Anything else is NOT OFFICIAL and you say so.
3. Only two pages send transactions: `src/sign.html` and `src/collect.html`. Do not write another or change their code; only data is filled in (name, symbol, image, contract). `check-site` rejects the rest.
4. No promises. Never say "risk-free" or "audited" (it is "community-reviewed"). Always say: a bot can be the first buyer, there are no refunds, the Lock has no professional audit.
5. Networks: `sepolia` (practice, free test ETH from a faucet) or `base` (real money). Recommend practicing on sepolia first; ask before using base. Show the plan and the dry-run before any signature. You never send anything; the user signs.

## Launch
1. In ONE message ask: name (≤40), symbol (2–12), the creator's public address (read it back, first and last 6 characters: it is written forever), optional image (PNG/JPG/GIF/WEBP ≤300 KB, never SVG).
2. With the question tool ask: network (sepolia practice | base real), initial buyer (open with N ETH | the creator | none), start value `--fdv` (default 4 ETH), plan lifetime (1 h | 72 h). There is no required minimum: the creator chooses the initial buy, any amount or none.
3. `plan --chain sepolia|base --name … --symbol … --creator 0x… [--buyer open --buy-eth N] [--fdv N] [--deadline-hours H]`. Show the token address, the 80/20 split and the audit.
4. `dryrun <plan.json>` (add `--from <funded address>` for an open buyer).
5. `sign <plan.json> [--image logo.png]` writes the page. Tell them to host the page and `plan.json` together on any static host (GitHub Pages, Vercel, Netlify): opened as a local file it does not connect to MetaMask/Rabby. Anyone can check it with `check-site <page> --token 0x… --plan <plan.json>`.
6. Whoever signs pays the network gas, and their signature creates token, pool and locks. Gas on Base is usually a few cents and changes with the network: never promise an amount; the wallet shows the exact fee before confirming.

## After
- `verify 0xTOKEN --chain <network>` checks a token from its address alone.
- `links <plan.json>` gives the buy and chart links.
- With the token launched, `sign` again writes the final view (contract + Uniswap).
- Fees: use `/cobrar`.
