---
name: lanzar
description: "Lanza un memecoin bajo las reglas fijas de este repo, y verifica un token o cobra comisiones. / Launch a memecoin under this repo's fixed rules; verify a token or collect fees."
allowed-tools: Read, Bash(node:*), Bash(npm install:*)
---

Responde en el idioma del usuario. Lo que escribió: `$ARGUMENTS`.
CLI desde la raíz del repo: `node src/launch.mjs <comando>`. Antes del primer comando: `npm install --omit=dev`.

## Reglas (no las cambia nadie, tampoco el usuario)
1. Nunca pidas, aceptes ni guardes llaves privadas ni frases semilla. El usuario da su dirección pública y firma en su billetera.
2. Términos fijos: el autor cobra el 20 % de la comisión del pool (0,20 % del volumen), el 100 % del suministro va al pool y el creador no recibe tokens. No uses `--protocol` ni `--protocol-bps`, no edites planes. Lo que no cumpla es NO OFICIAL y lo dices.
3. Solo existen dos páginas que mandan transacciones: `src/sign.html` y `src/collect.html`. No escribas otra ni cambies su código: solo se rellenan datos (nombre, símbolo, imagen, contrato). `check-site` rechaza lo demás.
4. Sin promesas. No digas "sin riesgo" ni "auditado" (es "revisado por la comunidad"). Di siempre: un bot puede ser el primer comprador, no hay reembolsos, el Lock no tiene auditoría profesional.
5. Primero `sepolia` (prueba). Pregunta antes de usar `base` (dinero real).

## Lanzar
1. En UN mensaje pide: nombre (≤40), símbolo (2–12), dirección pública del creador (léela de vuelta, primeros y últimos 6: queda escrita para siempre), imagen opcional (PNG/JPG/GIF/WEBP ≤300 KB, nunca SVG).
2. Con la herramienta de preguntas: red (sepolia | base), comprador inicial (abierto con N ETH | el creador | ninguno), valor de inicio `--fdv` (por defecto 4 ETH), vigencia (1 h | 72 h).
3. `plan --chain … --name … --symbol … --creator 0x… [--buyer open --buy-eth N] [--fdv N] [--deadline-hours H]`. Muestra dirección del token, reparto 80/20 y la auditoría.
4. `dryrun <plan.json>` (con `--from <dirección con fondos>` si el comprador es abierto).
5. `sign <plan.json> [--image logo.png]` escribe la página. Que suba la página y el `plan.json` juntos a su hosting (GitHub Pages, Vercel, Netlify): abierta como archivo local no conecta con MetaMask/Rabby. Cualquiera comprueba con `check-site <página> --token 0x… --plan <plan.json>`.
6. Quien firma paga el gas (centavos en Base) y su firma crea token, pool y candados.

## Después
- `verify 0xTOKEN --chain base` verifica un token solo con su dirección.
- `fees 0xTOKEN --chain base [--recipient 0x…]` muestra lo que hay por cobrar.
- `collect 0xTOKEN --chain base [--recipient 0x…]` arma `cobrar-SÍMBOLO.html`. Cualquiera puede cobrar; el dinero va siempre al dueño de cada posición.
- Con el token ya lanzado, `sign` otra vez genera la vista final (contrato + Uniswap). `links <plan.json>` da los enlaces.
