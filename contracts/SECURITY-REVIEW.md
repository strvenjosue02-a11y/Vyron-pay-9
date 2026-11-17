# Revisión de seguridad de `Launch.sol` (hecha por mí, no es una auditoría profesional)

Alcance: `contracts/src/Launch.sol` y su uso desde `web/lcchain.js`. Fecha: 17-nov-2026.
**Antes de usar dinero real hace falta una auditoría profesional y topes bajos.**

## Lo que NO es posible (probado con pruebas que atacan el contrato)
| Ataque | Resultado |
|---|---|
| Sacar el NFT del pool (creador, plataforma o cualquiera) | Imposible: el contrato no tiene función que lo mueva. Probado. |
| Sacar el USDC del pool | Solo salen comisiones (`collectFees`), mitad y mitad. Probado. |
| Sacar o reclamar lo de otro | Revierte. Probado. |
| Devolver dinero "antes de tiempo" o desviarlo | `refundFor` solo funciona tras expirar y siempre paga al aportante. Probado. |
| Donar USDC al contrato para alterar cuentas o comisión | Sin efecto: la comisión es 1% de la meta, no del saldo. Probado. |
| Comprar más barato siendo ballena | Mismo precio para todos (100 USDC = 500M tokens). Probado. |
| Reentrada | Todas las funciones con dinero son `nonReentrant`; USDC no tiene ganchos. |
| Crear tokens a voluntad | `_mint` solo en llenado (creador, plataforma, pool) y en `claim` (tope = 500M). |
| Cambiar reglas | Sin dueño, sin pausa, sin upgrade. |

## Riesgos que quedan (de mayor a menor)
1. **ALTO (molestia, no pérdida): matar una ronda a bajo costo.** Como la dirección del token se conoce antes de existir, cualquiera puede crear el pool de Uniswap a un precio equivocado. Al llenarse, el contrato lo detecta y pasa a `Refund` (todos recuperan su dinero, probado), pero esa ronda queda muerta. Cuesta solo gas repetirlo contra cualquier lanzamiento.
   *Opciones:* (a) aceptarlo y relanzar con otro nombre; (b) que el contrato acepte el precio del pool si está dentro de un rango y re-calcule el reparto (más código propio); (c) crear y fijar el pool en el mismo paso del despliegue (el primer pago fija el precio).
2. **MEDIO: USDC es centralizado.** Circle puede congelar (blacklist) la dirección del contrato o la de un aportante. Nada en el contrato lo evita.
3. **MEDIO: contratos falsos.** Cualquiera puede desplegar un `Launch` con un `positionManager` malicioso. La web solo debe aceptar direcciones que coincidan con `predictAddress(CONFIG, params)` (el código ya lo hace al crear) y la API debe verificar lo mismo antes de registrar un lanzamiento.
4. **BAJO: nombres y símbolos repetidos.** No hay unicidad en cadena; solo la web la revisa.
5. **BAJO: el 1,5% de tokens de la plataforma es inmediato.** La plataforma podría venderlo; es una decisión de confianza, no un fallo.
6. **BAJO: redondeo.** Sobrante de USDC al abrir el pool (menos del 1%) va a la plataforma; sobrante de tokens se quema.
7. **BAJO: el plazo corre desde el despliegue, no desde el primer depósito.** La web despliega y deposita seguidos; si alguien más despliega antes con los mismos parámetros, el reloj empieza antes.

## No revisado
Despliegue en red real, comportamiento con wallets reales, límites de gas en otras redes, interacción con otros pools de Uniswap, y un análisis formal. Todo eso es trabajo de auditoría.
