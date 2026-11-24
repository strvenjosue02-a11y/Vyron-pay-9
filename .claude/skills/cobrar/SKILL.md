---
name: cobrar
description: "Show how much a token has earned in fees and collect it. / Muestra cuánto ha ganado un token en comisiones y las cobra."
allowed-tools: Read, Bash(node:*), Bash(npm install:*)
---

Reply in the user's language. User text: `$ARGUMENTS`.
Run from the repo root: `node src/launch.mjs <command>`. First time: `npm install --omit=dev`.

Rules: never ask for private keys or seed phrases; the user gives public addresses and signs in their own wallet. Collecting only moves accumulated fees to each position's fixed recipient and never touches liquidity. No promises about earnings.

1. In ONE message ask for the token address (0x…) and, optionally, the user's wallet address (if given, show only their share). Network: Base.
2. "How much have I earned?" → `fees 0xTOKEN --chain base [--recipient 0xWALLET]`. Answer with the WETH and token amounts and the approximate ETH value per party. Say these are amounts waiting, not yet paid, and that the ETH value is approximate (the token side is valued at the current pool price). If everything is zero, say so.
3. "Collect" → `collect 0xTOKEN --chain base [--recipient 0xWALLET]`. It writes `launches/cobrar-SYMBOL.html`. The owner opens it where their wallet is installed and taps Collect on their row. The page needs http(s): host it on any static host, or run `python3 -m http.server` in that folder and open `http://localhost:8000/…`. Anyone can collect for anyone: the money goes to the owner of each position and the signer only pays gas (cents on Base).
4. After the signature run `fees` again and confirm it shows 0.

Limits: one token at a time; fees exist only while the token trades.
