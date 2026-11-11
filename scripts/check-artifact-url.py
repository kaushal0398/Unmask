#!/usr/bin/env python3
"""Is this WASM URL actually retrievable, and are they the bytes we think? (Read-only: one HTTP GET.)

Usage:  python3 scripts/check-artifact-url.py <url> <expected-sha256>

Use GET, not HEAD: test.fastfs.io answers HEAD with 404 even when the file is there. Run this BEFORE `outlayer deploy`
or `outlayer run`, so a failed fetch on the OutLayer side is not a surprise (it reports "wasm_url could not be fetched").
Exit code 0 only if the status is 200 and the SHA-256 matches.
"""
import hashlib, sys, urllib.error, urllib.request

def main():
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    url, want = sys.argv[1], sys.argv[2].lower()
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "unmask-artifact-check/1"})
        with urllib.request.urlopen(req, timeout=60) as r:
            body, status, ctype = r.read(), r.status, r.headers.get("content-type", "?")
    except urllib.error.HTTPError as e:
        sys.exit(f"FAIL  HTTP {e.code} from {url}")
    except Exception as e:
        sys.exit(f"FAIL  could not reach {url}: {e}")
    got = hashlib.sha256(body).hexdigest()
    print(f"HTTP {status}  {len(body)} bytes  {ctype}")
    print(f"sha256 got      {got}")
    print(f"sha256 expected {want}")
    if status == 200 and got == want:
        print("OK  the URL serves exactly the expected bytes")
        return
    sys.exit("FAIL  the bytes do not match" if status == 200 else f"FAIL  HTTP {status}")

if __name__ == "__main__":
    main()
