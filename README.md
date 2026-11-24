# Holdfast

Lanzador de memecoins sobre Uniswap v3 (Base). El creador no paga ni recibe tokens: el primer comprador paga el gas y abre el mercado. La liquidez queda en un contrato de 13 líneas sin función para sacarla.

Memecoin launcher on Uniswap v3 (Base). The creator pays nothing and gets no tokens: the first buyer pays gas and opens the market. Liquidity sits in a 13-line contract with no way out.

## Lo que hay que leer / What to read
`contracts/src/Lock.sol`: 13 líneas. Es dueño de las posiciones de Uniswap, solo puede cobrar comisiones y las manda a una dirección fija. Lo demás es herramienta, y cada lanzamiento se audita y se verifica en la cadena (`verify`).

## Términos fijos / Fixed terms
Comisión del pool 1 %: 20 % autor, 80 % creador. 100 % del suministro al pool. El creador no recibe tokens. Token OpenZeppelin 4.9.6 sin cambios.

## Usar / Use
Con Claude Code, dentro de este repo: `/lanzar`.
Sin Claude: `npm install --omit=dev` y `node src/launch.mjs plan|dryrun|sign|verify|fees|collect|links|check-site`.
La página de firma va en un hosting estático (GitHub Pages, Vercel…), junto al `plan.json`.

## Probar / Test
`npm test` (sin red) · `forge test` en `contracts/` (`FORK_URL=<rpc sepolia>`) · `node test/test-fork.mjs` (`NET=base|sepolia`, necesita anvil) · `node test/check-artifacts.mjs`.

## Límites / Limits
Sin lanzamiento real en Base todavía. El Lock lo revisa la comunidad; no tiene auditoría profesional. Un bot puede ser el primer comprador. Sin reembolsos. Un memecoin puede perder todo su valor.
