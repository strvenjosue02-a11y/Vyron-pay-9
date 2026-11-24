import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import {
  SIGN_TEMPLATE,
  COLLECT_TEMPLATE,
  normalizeSign,
  normalizeCollect,
  isImageDataUri,
} from "./sign-template.mjs";
import { lockAddress } from "./builder.mjs";
import { CHAINS, MULTISEND, DEPLOYER } from "./chains.mjs";
import { REPO, OFFICIAL } from "./rules.mjs";

const LINKS = [
  "app.uniswap.org",
  "dexscreener.com",
  "api.dexscreener.com",
  "app.bubblemaps.io",
  "github.com",
  "t.me",
  "x.com",
  "twitter.com",
  "etherscan.io",
  "basescan.org",
  "arbiscan.io",
  "optimistic.etherscan.io",
  "sepolia.etherscan.io",
];
const host = (u) => {
  try {
    return new URL(u).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
};
const allowed = (u) => LINKS.some((d) => host(u) === d || host(u).endsWith("." + d));
const KNOWN = [
  OFFICIAL.protocol,
  MULTISEND,
  DEPLOYER,
  ...Object.values(CHAINS).flatMap((c) => [c.npm, c.router, c.weth]),
].map((a) => a.toLowerCase());

export async function checkSite(target, { token, expect } = {}) {
  if (!target) throw new Error("uso: check-site <archivo o URL> [--token 0x…]");
  const code = /^https?:\/\//.test(target)
    ? await fetch(target).then((r) => r.text())
    : readFileSync(target, "utf8");
  const sha = createHash("sha256").update(code).digest("hex"),
    rows = [];
  const tpl = !/eth_sendTransaction|eth_requestAccounts/.test(code)
    ? null
    : normalizeSign(code) === normalizeSign(SIGN_TEMPLATE)
      ? "sign"
      : normalizeCollect(code) === normalizeCollect(COLLECT_TEMPLATE)
        ? "collect"
        : null;
  const scan =
    tpl === "sign" ? normalizeSign(code) : tpl === "collect" ? normalizeCollect(code) : code;
  const rule = (ok, label, detail = "", warn = false) => rows.push({ ok, warn, label, detail });
  const urls = [...new Set(code.match(/https?:\/\/[^\s"'<>)\\]+/g) || [])],
    outside = urls.filter((u) => !allowed(u) && !/^https?:\/\/(www\.)?w3\.org/.test(u));
  rule(
    !/<script[^>]+src\s*=/i.test(code) &&
      !/\bimport\s*\(|<iframe|<link[^>]+rel=["']?(stylesheet|modulepreload)[^>]*href=["']?https?:/i.test(
        code,
      ),
    "No carga código ni recursos de otros sitios (scripts, iframes, hojas de estilo externas)",
  );
  rule(
    outside.length === 0,
    "Solo enlaza a sitios de la lista (Uniswap, DEXScreener, exploradores, GitHub, redes)",
    outside.slice(0, 3).join(" · "),
  );
  const noImg = scan.replace(/data:image\/(?:png|jpeg|gif|webp);base64,[A-Za-z0-9+/=]+/g, "IMG");
  const hidden = [
    /\beval\s*\(/,
    /new\s+Function\s*\(/,
    /document\.write\s*\(/,
    /\batob\s*\(/,
    /[A-Za-z0-9+/=]{300,}/,
    /(\\x[0-9a-f]{2}){20,}/i,
  ].filter((r) => r.test(noImg));
  rule(
    hidden.length === 0,
    "Sin código oculto ni ofuscado (eval, Function, atob, bloques codificados)",
  );
  rule(
    !/type\s*=\s*["']password|seed\s*phrase|recovery\s*phrase|frase\s+secreta|private\s*key|llave\s+privada|mnemonic/i.test(
      code,
    ),
    "Nunca pide llaves privadas ni frases secretas",
  );
  rule(
    !/f{64}|setApprovalForAll|eth_sign\b|personal_sign|signTypedData|eth_signTransaction/i.test(
      scan,
    ),
    "Sin permisos ilimitados ni firmas a ciegas (approve ilimitado, setApprovalForAll, eth_sign…)",
  );
  if (token)
    rule(
      code.toLowerCase().includes(token.toLowerCase()),
      "Contiene la dirección del token que dice vender",
      token,
    );
  const addrs = [...new Set((scan.match(/0x[0-9a-fA-F]{40}/g) || []).map((a) => a.toLowerCase()))],
    unknown = addrs.filter((a) => a !== (token || "").toLowerCase() && !KNOWN.includes(a));
  rule(
    unknown.length === 0,
    "No usa direcciones desconocidas (solo el token y los contratos oficiales de Uniswap/Safe)",
    unknown.slice(0, 2).join(" · "),
    true,
  );
  const sendsTo = [...code.matchAll(/\bto\s*[:=]\s*["'`](0x[0-9a-fA-F]{40})/g)]
    .map((m) => m[1].toLowerCase())
    .filter((a) => a !== (token || "").toLowerCase() && !KNOWN.includes(a));
  rule(
    sendsTo.length === 0,
    "Las transacciones que arma solo van al token o a contratos oficiales",
    sendsTo.slice(0, 2).join(" · "),
  );
  rule(
    code.includes(REPO) || /github\.com\/[\w.-]+\/[\w.-]+/i.test(code),
    "Enlaza su código abierto (GitHub)",
    "",
    true,
  );
  if (/eth_sendTransaction|eth_requestAccounts/.test(code)) {
    const isSign = tpl === "sign",
      isCollect = tpl === "collect";
    rule(
      isSign || isCollect,
      "Es una plantilla oficial (firma o cobro): solo cambian los datos (nombre, símbolo, foto, contrato)",
    );
    const parse = (re) => {
      try {
        return JSON.parse(code.match(re)[1]);
      } catch {
        return {};
      }
    };
    const imageOk = (img) =>
      rule(
        img == null || isImageDataUri(img),
        "La imagen del token es una imagen real (PNG, JPG, GIF o WEBP), no código",
      );
    if (isSign) {
      const to = (parse(/^const TX=(\{.*?\}), INFO=\{/m).to || "").toLowerCase(),
        info = parse(/^const TX=\{.*?\}, INFO=(\{.*\});$/m);
      rule(
        [MULTISEND, DEPLOYER].some((a) => a.toLowerCase() === to),
        "La transacción de la plantilla va solo a Safe MultiSend o al desplegador oficial",
        to,
      );
      imageOk(info.image);
      rule(
        info.buyUrl == null ||
          (/^https:\/\/app\.uniswap\.org\/swap\?chain=[a-z]+&outputCurrency=0x[0-9a-fA-F]{40}&inputCurrency=ETH$/.test(
            info.buyUrl,
          ) &&
            (!token || info.buyUrl.toLowerCase().includes(token.toLowerCase()))),
        "El enlace de compra va solo a Uniswap y con la dirección de este token",
      );
    } else if (isCollect) {
      const info = parse(/^const INFO=(\{.*\});$/m),
        ch = Object.values(CHAINS).find((c) => c.id === info.chainId);
      imageOk(info.image);
      rule(
        !!ch &&
          Array.isArray(info.positions) &&
          info.positions.length > 0 &&
          info.positions.every(
            (p) =>
              /^\d+$/.test(String(p.id)) &&
              lockAddress(ch.npm, p.recipient).toLowerCase() === String(p.lock).toLowerCase(),
          ),
        "Cada cobro va al candado oficial de su dueño (la dirección del candado coincide con sus bytes) y solo llama a collect",
      );
    }
  }
  if (expect)
    rule(
      sha === expect.toLowerCase(),
      "Coincide EXACTAMENTE con el archivo publicado por el creador (hash)",
      sha,
    );
  const ok = rows.every((r) => r.ok || r.warn);
  const text = [
    `Verificación de interfaz: ${target}`,
    `SHA-256: ${sha}  (compáralo con el que publicó el creador)`,
    ...rows.map(
      (r) => `${r.ok ? "✔" : r.warn ? "⚠" : "✘"} ${r.label}${r.detail ? ` — ${r.detail}` : ""}`,
    ),
    ok ? "RESULTADO: cumple las reglas fijas." : "RESULTADO: NO cumple: no uses esta interfaz.",
    "Aviso: esto comprueba el código que se sirve, no el contrato del token (para eso, el informe de confianza).",
  ].join("\n");
  return { ok, sha, rows, text };
}
