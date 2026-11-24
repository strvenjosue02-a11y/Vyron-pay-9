#!/usr/bin/env python3
"""Pruebas de mutación: cambia el contrato de a una pieza (cambio dañino) y comprueba que las pruebas FALLAN. Si alguna mutación sobrevive, las pruebas tienen un hueco.
Uso (desde cualquier carpeta, requiere Foundry y Halmos): python3 test/mutate.py"""
import subprocess, shutil, os, sys
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../contracts"))
env = {**os.environ, "PATH": os.environ["PATH"] + ":/root/.foundry/bin", "FOUNDRY_FUZZ_RUNS": "300", "FOUNDRY_INVARIANT_RUNS": "30"}
LOCK = [("src/Lock.sol", a, b) for a, b in [("IManager.CollectParams(id, RECIPIENT,", "IManager.CollectParams(id, msg.sender,"), ("CollectParams(id, RECIPIENT, type(uint128).max, type(uint128).max)", "CollectParams(id + 1, RECIPIENT, type(uint128).max, type(uint128).max)"),
 ("RECIPIENT, type(uint128).max, type(uint128).max)", "RECIPIENT, 0, 0)"), ("(IManager(npm), recipient)", "(IManager(npm), msg.sender)")]]
def run(kind):
    return subprocess.run(["halmos", "--root", ".", "--contract", "LockSymbolic"], cwd=ROOT, env=env, capture_output=True, text=True).returncode != 0
total = caught = 0; alive = []
for kind, muts in (("lock", LOCK),):
    for f, a, b in muts:
        path = os.path.join(ROOT, f); src = open(path).read()
        if a not in src: print("?? no encontrado:", a[:50]); continue
        total += 1; shutil.copy(path, path + ".orig")
        try:
            open(path, "w").write(src.replace(a, b, 1)); ok = run(kind)
        finally:
            shutil.move(path + ".orig", path)
        caught += ok; print(("✔ detectada  " if ok else "✘ SOBREVIVE  ") + kind + ": " + a.strip()[:55] + " → " + b.strip()[:40]);
        if not ok: alive.append(a)
print(f"\n{caught}/{total} mutaciones detectadas"); sys.exit(0 if caught == total else 1)
