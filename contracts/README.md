# Alcancía: contrato del launchpad

Un proyecto equivale a un contrato `Alcancia`, que es a la vez el **token** y la **alcancía** donde se guarda el USDC.

## Reglas
- **Sin dueño, sin pausa, sin upgrade.** Nadie puede cambiar las reglas.
- **Despliegue perezoso.** El contrato no existe hasta que el primer comprador lo despliega con el
  deployer CREATE2 público `0x4e59b44847b379578588920cA78FbF26c0B4956C`, y él paga solo el gas.
  La dirección se conoce de antemano y cambiar cualquier regla cambia la dirección.
- **El USDC solo sale por 3 puertas:**
  1. Reembolso a los compradores (venta fallida o proyecto cancelado).
  2. Comisión de la plataforma: 1% del USDC y 1,5% del supply de tokens, solo si la venta tiene éxito.
  3. Entregas al creador: un % inicial y después etapas aprobadas por votación.
- **Votación.** El peso de cada voto es el USDC aportado, no los tokens, así que es inmune a los préstamos flash.
  Si gana el NO, el proyecto se cancela y lo que queda se devuelve a los compradores en proporción.
- **Creador desaparecido.** Si no pide la siguiente etapa a tiempo, cualquiera llama a `abandon()` y se reembolsa lo que queda.
- La votación es optimista: una etapa se aprueba salvo que el NO supere al SÍ.

## Probar
```bash
forge install foundry-rs/forge-std OpenZeppelin/openzeppelin-contracts@v5.1.0 --no-git
forge test -vv
```
Las pruebas incluyen 10.000 escenarios al azar que comprueban que nunca sale más dinero del que entró.

## Pendiente antes de usarlo con dinero real
- Análisis con Slither y Aderyn
- Testnet en Base Sepolia
- Auditoría formal (con grants o comisiones)
