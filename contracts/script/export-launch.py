#!/usr/bin/env python3
"""Copia el ABI y el bytecode compilado de Launch a la web (web/launch-abi.js).
Uso: forge build && python3 script/export-launch.py"""
import json, pathlib
root = pathlib.Path(__file__).resolve().parent.parent
d = json.loads((root / "out/Launch.sol/Launch.json").read_text())
vw = [{"type": "function", "name": "release", "inputs": [{"name": "token", "type": "address"}], "outputs": [], "stateMutability": "nonpayable"}]
out = root.parent / "web/launch-abi.js"
out.write_text(
    "// GENERADO por contracts/script/export-launch.py — no editar a mano.\n"
    f"export const LAUNCH_ABI = {json.dumps(d['abi'])};\n"
    f"export const LAUNCH_BYTECODE = \"{d['bytecode']['object']}\";\n"
    f"export const vestingWalletAbi = {json.dumps(vw)};\n"
)
print("escrito", out)
