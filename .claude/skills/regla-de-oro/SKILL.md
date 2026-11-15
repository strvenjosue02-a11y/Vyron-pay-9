---
name: regla-de-oro
description: La regla de oro del dueño del proyecto Vyron. Úsala SIEMPRE que el usuario escriba /regla-de-oro, diga "regla de oro", o pida trabajo en la web, los contratos o cualquier conexión del launchpad. Obliga a preguntar antes de cada decisión o conexión, a no hacer webs genéricas, a probar todo y a cuidar el dinero y los tokens.
---

# Regla de oro

Cuando esta skill está activa, estas reglas mandan sobre cualquier otra preferencia. Se cumplen todas, siempre.

## 1. Preguntar antes de cada decisión y cada conexión
Antes de hacerlo, pregunta con la herramienta de preguntas, con 2 a 4 opciones y la recomendada primero:
- Conectar algo: wallets, redes (testnet o real), contratos, APIs, Vercel, GitHub, faucets o cualquier servicio externo.
- Publicar o desplegar: webs, contratos, cualquier cosa visible para otros.
- Cambiar reglas del contrato: comisiones, etapas, votación, montos, wallets.
- Cualquier cosa que cueste dinero, gas o créditos, o que mueva fondos.
- Borrar o reemplazar trabajo existente.
- Elegir entre dos caminos de diseño o de producto.

Una pregunta por decisión, en lenguaje simple. Si la respuesta ya se dio antes en la conversación, no vuelvas a preguntar.

## 2. Nada de webs genéricas
- Antes de tocar cualquier interfaz, carga la skill `frontend-design` y `design-spacing-rhythm` (espaciado). Para logo, tipografía o colores usa `brand-identity`. Si sirve, usa también `theme-factory`.
- Antes de rediseñar, pregunta cómo debe ser cada parte (logo, portada, qué muestra cada pantalla y cómo la ve cada tipo de usuario).
- Sin emojis como íconos: usa íconos SVG y tipografía cuidada.
- Estilo de producto profesional, como los grandes launchpads y exchanges: jerarquía clara, espaciado consistente y estados de carga, error y éxito.
- Primero el celular: se prueba a 360 y 390 px de ancho, sin scroll horizontal.

## 3. Probar todo y mostrar la prueba
- Nunca digas "funciona" sin haberlo probado. Usa la skill `webapp-testing` (Playwright) y `forge test` para los contratos.
- Muestra evidencia: captura o video de la interfaz y el resultado de las pruebas.
- Di claro qué está probado y qué no: copia local, testnet pública o red real.

## 4. Seguridad y dinero
- Nunca pidas palabras secretas, frases semilla ni claves privadas. Solo direcciones públicas (`0x…`).
- Solo piezas auditadas (OpenZeppelin y similares); no reinventes contratos.
- Prioriza las herramientas gratis. Avisa antes de cualquier cosa que cueste.
- Antes de usar dinero real: análisis de seguridad, topes bajos y auditoría.

## 5. Hablar simple y gastar pocos tokens
- Responde en español, corto y sin tecnicismos. Si usas una palabra técnica, explícala en una línea.
- No repitas explicaciones ya dadas. Lee solo lo necesario.
- Al terminar, resume en pocas líneas: qué se hizo, qué se probó y cuál es el siguiente paso.
