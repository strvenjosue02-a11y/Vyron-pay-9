export const OFFICIAL = Object.freeze({
  protocol: "0x071532b51ae6206e9fdd3152b72999e5f581b841", // billetera pública del autor de la habilidad
  protocolBps: 2000, // 20 % de la comisión del pool de 1 % = 0.20 % del volumen
});
export function isOfficial(plan) {
  const p = plan.positions.find((x) => x.role === "protocolo");
  return (
    !!p &&
    p.recipient.toLowerCase() === OFFICIAL.protocol.toLowerCase() &&
    p.bps === OFFICIAL.protocolBps
  );
}
export const REPO = "https://github.com/strvenjosue02-a11y/Vyron-pay-9"; // código abierto oficial: las interfaces deben enlazarlo
