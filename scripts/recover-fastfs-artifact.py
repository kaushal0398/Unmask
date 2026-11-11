#!/usr/bin/env python3
"""Recover a file that `outlayer upload` stored on NEAR, straight from the chain, and check its SHA-256.

`outlayer upload` sends a transaction with method `__fastdata_fastfs` and gas=1 (the CLI source says: "intentionally
fails, but data is recorded on-chain"). So that transaction ALWAYS shows "Exceeded the prepaid gas" in an explorer, and
that is NOT evidence the upload failed. The file's bytes are in the transaction's arguments. This script reads them back
from a NEAR RPC node and compares the SHA-256 with the hash in the file name, so you can prove the artifact exists even
when the FastFS web host (test.fastfs.io) is down or does not serve it.

Usage:  python3 scripts/recover-fastfs-artifact.py <signer-account> <tx-hash> [<tx-hash> ...] [--out file] [--network testnet|mainnet]
Several tx hashes are for files over 1 MB, which the CLI splits into chunks (pass them in upload order).
Read-only: it only asks public RPC nodes for transactions. It never signs or sends anything.
"""
import argparse, base64, hashlib, json, struct, sys, urllib.request

RPCS = {
    "testnet": ["https://archival-rpc.testnet.near.org", "https://rpc.testnet.fastnear.com", "https://rpc.testnet.near.org"],
    "mainnet": ["https://archival-rpc.mainnet.near.org", "https://rpc.mainnet.fastnear.com", "https://rpc.mainnet.near.org"],
}

def rpc_tx(network, tx, signer):
    body = json.dumps({"jsonrpc": "2.0", "id": 1, "method": "EXPERIMENTAL_tx_status",
                       "params": {"tx_hash": tx, "sender_account_id": signer, "wait_until": "FINAL"}}).encode()
    last = None
    for url in RPCS[network]:
        try:
            req = urllib.request.Request(url, body, {"Content-Type": "application/json"})
            with urllib.request.urlopen(req, timeout=30) as r:
                data = json.loads(r.read())
            if "result" in data:
                return data["result"], url
            last = data.get("error")
        except Exception as e:  # try the next node
            last = e
    sys.exit(f"no RPC node could return transaction {tx}: {last}")

class Reader:
    def __init__(self, b): self.b, self.i = b, 0
    def take(self, n):
        if self.i + n > len(self.b): raise ValueError("payload ended early")
        out = self.b[self.i:self.i + n]; self.i += n; return out
    def u8(self): return self.take(1)[0]
    def u32(self): return struct.unpack("<I", self.take(4))[0]
    def string(self): return self.take(self.u32()).decode()
    def blob(self): return self.take(self.u32())

def decode(args):
    """Borsh: enum FastfsData { Simple(SimpleFastfs), Partial(PartialFastfs) }, as written by outlayer-cli upload.rs."""
    r = Reader(args)
    variant = r.u8()
    if variant == 0:
        path = r.string()
        if r.u8() != 1: raise ValueError("this upload carries no content")
        mime, content = r.string(), r.blob()
        return {"path": path, "mime": mime, "offset": 0, "full_size": len(content), "bytes": content}
    if variant == 1:
        path = r.string(); offset = r.u32(); full = r.u32(); mime = r.string(); chunk = r.blob(); nonce = r.u32()
        return {"path": path, "mime": mime, "offset": offset, "full_size": full, "bytes": chunk, "nonce": nonce}
    raise ValueError(f"unknown FastFS variant {variant}")

def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("signer"); ap.add_argument("tx", nargs="+")
    ap.add_argument("--out"); ap.add_argument("--network", default="testnet", choices=RPCS)
    a = ap.parse_args()

    parts, path, mime, full = [], None, None, None
    for tx in a.tx:
        res, node = rpc_tx(a.network, tx, a.signer)
        actions = res["transaction"]["actions"]
        calls = [x["FunctionCall"] for x in actions if "FunctionCall" in x]
        if not calls or calls[0]["method_name"] != "__fastdata_fastfs":
            sys.exit(f"{tx} is not a FastFS upload (method: {calls[0]['method_name'] if calls else 'none'})")
        status = res["status"]
        shown = "Success" if "SuccessValue" in status else json.dumps(status)[:110]
        print(f"tx {tx[:10]}…  to {res['transaction']['receiver_id']}  gas={calls[0]['gas']}  status={shown}  (via {node})")
        d = decode(base64.b64decode(calls[0]["args"]))
        path, mime, full = d["path"], d["mime"], d["full_size"]
        parts.append((d["offset"], d["bytes"]))

    parts.sort(key=lambda p: p[0])
    blob = b"".join(b for _, b in parts)
    want = path.split(".")[0]
    got = hashlib.sha256(blob).hexdigest()
    print(f"\nfile name in the upload: {path}  ({mime})")
    print(f"bytes recovered: {len(blob)} of {full}")
    print(f"sha256 recovered: {got}")
    print(f"sha256 in the name: {want}")
    ok = len(blob) == full and got == want
    print("RESULT:", "MATCH. The artifact is recorded on chain; the failed-looking transaction is normal." if ok else "MISMATCH or incomplete.")
    if ok and a.out:
        open(a.out, "wb").write(blob); print("wrote", a.out)
    sys.exit(0 if ok else 1)

if __name__ == "__main__":
    main()
