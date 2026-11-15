#!/usr/bin/env python3
"""Copia el ABI y el bytecode compilado de Alcancia a la web (web/alcancia.js).
Uso: forge build && python3 script/export-web.py"""
import json, pathlib
root = pathlib.Path(__file__).resolve().parent.parent
d = json.loads((root / "out/Alcancia.sol/Alcancia.json").read_text())
out = root.parent / "web/alcancia.js"
out.write_text(
    "// GENERADO por contracts/script/export-web.py — no editar a mano.\n"
    f"export const ALCANCIA_ABI = {json.dumps(d['abi'])};\n"
    f"export const ALCANCIA_BYTECODE = \"{d['bytecode']['object']}\";\n"
)
print("escrito", out)
