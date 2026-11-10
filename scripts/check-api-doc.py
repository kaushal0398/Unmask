#!/usr/bin/env python3
"""Fails if the backend has a route, or returns an error code, that docs/api-contract.md does not mention.
Usage: python3 scripts/check-api-doc.py        (read-only, no server needed)"""
import pathlib, re, sys

root = pathlib.Path(__file__).resolve().parent.parent
code = (root / "backend/src/server.ts").read_text()
doc = (root / "docs/api-contract.md").read_text()

routes = set()
for m in re.finditer(r'app\.(get|post)(?:<[^>]*>)?\(\s*"([^"]+)"', code):
    routes.add((m.group(1).upper(), m.group(2)))

missing = []
for method, path in sorted(routes):
    # the doc may write two routes in one cell, or list the id as :id: look for the path text
    if path not in doc and not (method + " " + path) in doc:
        missing.append(f"route {method} {path}")

codes = set(re.findall(r'(?:code:\s*|fail\(\s*\d+,\s*)"([a-z_]+)"', code))
codes |= set(re.findall(r'new ProxyError\(\s*\d+,\s*"([a-z_]+)"', (root / "backend/src/oneclick.ts").read_text()))
for c in sorted(codes):
    if c not in doc:
        missing.append(f"error code {c}")

if missing:
    print("docs/api-contract.md is missing:")
    for m in missing:
        print("  -", m)
    sys.exit(1)
print(f"api-contract.md covers all {len(routes)} routes and {len(codes)} error codes")
