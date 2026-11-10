#!/usr/bin/env python3
"""Runs every shared test case through the WASM artifact under Wasmtime and compares with the TypeScript output.
Usage: python3 scripts/check-wasm-vectors.py [path/to/auction-engine.wasm]
Needs: wasmtime on PATH, and the artifact built with `sh snipe-proof-auction/build.sh`."""
import json, pathlib, subprocess, sys

root = pathlib.Path(__file__).resolve().parent.parent
wasm = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else root / "enclave/auction-engine/target/wasm32-wasip2/release/auction-engine.wasm"
cases = json.load(open(root / "shared/test-vectors/auction-v1-cases.json"))["cases"] + json.load(open(root / "shared/test-vectors/auction-v1-random.json"))["cases"]

def run(payload: str):
    return subprocess.run(["wasmtime", "run", str(wasm)], input=payload, capture_output=True, text=True)

health = run('{"action":"health"}')
assert health.returncode == 0 and json.loads(health.stdout)["status"] == "success", "health check failed"
bad = 0
for c in cases:
    r = run(json.dumps(c["input"]))
    ok = r.returncode == 0 and json.loads(r.stdout) == c["expected"]
    bad += not ok
    if not ok or not c["name"].startswith("random"):
        print("PASS" if ok else "FAIL", c["name"])
print(f"{len(cases) - bad}/{len(cases)} match the TypeScript rule (12 hand-picked, 200 seeded random)")
sys.exit(1 if bad else 0)
