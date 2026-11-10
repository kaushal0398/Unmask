# OutLayer blocker: review of the 10 Nov incident report

Written 10 Nov 2026. This checks the teammate's incident report ("Latest Blocker & Exact Stopping Point") against public data: the NEAR testnet chain, the FastFS host and the OutLayer CLI's source. It did not use any credentials and sent nothing to the chain. The `outlayer` CLI is not installed on this machine, so anything that needs it is marked unchecked.

## Verdict

**The upload did not fail.** The report's central conclusion, "the WASM artifact has not been proven to be stored", was wrong, and the "Exceeded the prepaid gas" error is not a bug.

1. `outlayer upload` sends its transaction with **`gas = 1` on purpose**. The CLI source says so in a comment: `gas=1: intentionally fails, but data is recorded on-chain` ([`upload.rs`](https://github.com/out-layer/outlayer-cli/blob/main/src/commands/upload.rs)). FastFS indexes the transaction's arguments, so the transaction always looks failed in an explorer, and "Upload complete!" is accurate.
2. **Both uploads are on chain.** `scripts/recover-fastfs-artifact.py` read the 258,583 WASM bytes back out of transaction `APbBBdHb…` and their SHA-256 is `f52c7cb0…`, exactly the hash the project is registered with. The 269-byte JSON matches `9e38a8ac…` too.
3. **FastFS serves the file again.** A GET on the printed URL returns HTTP 200 with all 258,583 bytes and the right hash, on both `test.fastfs.io/<signer>/<receiver>/<file>` and `<signer>.fastfs.io/<receiver>/<file>`. The 502s in the report were a transient outage, now over. HEAD requests return 404 on this host even when the file is there, so never test with HEAD.
4. So `wasm_url could not be fetched` was most likely that outage, not a gas or storage problem. This is the likely cause and it is **not yet proven**: nobody has re-run the execution since FastFS recovered.

## One real problem found: the registered version has no `health` action

The report says a local health request returned `Snipe-Proof Auction WASM is running`. The artifact actually registered (`f52c7cb0…`) does not do that:

```
$ echo '{"action":"health"}' | wasmtime run outlayer-auction.wasm      # the recovered f52c7cb0… bytes
{"message":"missing field `supply` at line 1 column 19","status":"error"}
```

So the build that was uploaded is not the build that was tested for health (the report itself warns that a rebuild changes the hash). If anyone runs "health first" against the deployed version, it will return an error, not a success.

## Claim by claim

| Claim in the report | What I checked | Result |
|---|---|---|
| Upload transactions failed with `Exceeded the prepaid gas` | Read both from the chain (`EXPERIMENTAL_tx_status`): method `__fastdata_fastfs`, `gas=1`, status Failure, "Exceeded the prepaid gas" | **True, but expected.** It is how FastFS uploads work |
| "Upload complete!" is misleading | CLI source | **Wrong.** The data is recorded on chain |
| The artifact is not proven stored | Recovered 258,583 bytes from the transaction and hashed them | **Wrong.** Stored, hash matches `f52c7cb0…` |
| The JSON upload also failed | Recovered 269 bytes, hash matches `9e38a8ac…` | **Stored** |
| FastFS host and object URL returned 502 | GET today | **True then, not now.** HTTP 200 with the correct bytes |
| OutLayer reported `wasm_url could not be fetched` | Not re-run | Consistent with the outage. **Unchecked** (needs the CLI) |
| Local results: price 15, Alice 60 / Bob 25 / Charlie 15; supply 200 gives 70 and 130; all below reserve gives 0 and 100 | Ran the recovered `.wasm` under Wasmtime | **Confirmed**, identical numbers |
| Local health: `Snipe-Proof Auction WASM is running` | Ran health on the recovered `.wasm` | **Does not hold for the registered version** (see above) |
| Our canonical engine gives the same allocations | Ran `enclave/auction-engine` on the same bids | **Confirmed**: price 15, Alice 60, Bob 25, Charlie 15 |
| Project active version is `f52c7cb0…` | Needs `outlayer status` | **Unchecked.** It matches the hash in the execution request |
| Request limits show 10 seconds but `outlayer.toml` says 60 | Noted only | **Unexplained.** Ask OutLayer which one applies |
| `outlayer logs` needs a payment key nonce | Needs the CLI | **Unchecked** |
| Do not retry uploads blindly | Agree | **Correct, and no re-upload is needed** for this file |

## Revised next steps

The old step 1 was "wait for support". It is now:

1. **Confirm the file is served** (free, read-only):
   `python3 scripts/check-artifact-url.py <FastFS URL> f52c7cb031343081dd4a2b47fe366719fd83a98fe77e62be2c5d638a5a43b405`
2. **Retry the same run once**, from the teammate's machine: `outlayer run proofmeme.testnet/snipe-proof-auction --input .\auction-input.json`. It costs a ~0.002 NEAR deposit and the report shows the unused part is refunded. This is the test that proves whether the fetch problem is gone. Expect `success: true` and Alice 60 / Bob 25 / Charlie 15. Do not upload or deploy anything else first.
3. **If it succeeds,** the engine runs remotely for the first time. Then inspect what the response contains for attestation, and do **not** call it TEE-verified until that is checked.
4. **Then replace the version with the canonical engine** (decision 1 in [`MASTER_PLAN.md`](MASTER_PLAN.md)), which has the `health` action and the exact-integer rule the backend uses:
   1. `sh snipe-proof-auction/build.sh` prints the file and its SHA-256. The hash depends on the machine that builds, so use the hash printed on the machine that uploads.
   2. `outlayer upload` the built `.wasm`. The "failed" transaction is normal.
   3. `python3 scripts/check-artifact-url.py <printed URL> <printed hash>` must say OK before going further.
   4. `outlayer deploy snipe-proof-auction <URL>` (it also accepts any https URL, not just FastFS).
   5. Run `{"action":"health"}` first, then the fixture, and compare with `python3 scripts/check-wasm-vectors.py`.
5. **Only contact OutLayer if step 2 still fails.** Then ask: did the fetch fail again, and does the 10 second limit in the request override `outlayer.toml`? Do not ask about the gas error: it is by design.

## Corrected support message (send only if step 2 fails)

> Hi OutLayer team,
>
> On NEAR testnet, account `proofmeme.testnet`, CLI 0.2.1, project `proofmeme.testnet/snipe-proof-auction` (UUID `p00000000000000d5`). I uploaded a 258,583-byte WASM with `outlayer upload` (tx `APbBBdHbXrPtAqtD5u57D67onCu3DbMy4XtyhbkkRydo`). I understand the `__fastdata_fastfs` call uses gas 1 on purpose, and I recovered the exact bytes from the transaction (SHA-256 `f52c7cb031343081dd4a2b47fe366719fd83a98fe77e62be2c5d638a5a43b405`).
>
> `test.fastfs.io` returned 502 for that object on 9 Nov. It now returns 200 with the right bytes. When I ran the project at the time, the callback said `wasm_url could not be fetched` (receipt `2LkdU72zPzj9dViSA6RyRW3ScRWA859ngV9A8LGEoSj`). I re-ran it on `<date>` and it still failed with `<error>`.
>
> Could you tell me whether the fetch result is cached after a failure, and whether the 10 second limit in the execution request overrides `max_execution_seconds = 60` in `outlayer.toml`?

## New tools

| Script | What it does |
|---|---|
| `scripts/recover-fastfs-artifact.py <signer> <tx> [--out file]` | Reads a FastFS upload back from the chain and checks its SHA-256. Handles chunked uploads over 1 MB. Read-only |
| `scripts/check-artifact-url.py <url> <sha256>` | One GET; passes only if the status is 200 and the bytes match. Run before every `deploy` or `run` |

## Identifiers (from the report, all checked on chain unless noted)

| What | Value |
|---|---|
| Registered artifact | `f52c7cb031343081dd4a2b47fe366719fd83a98fe77e62be2c5d638a5a43b405` (258,583 bytes), the older `outlayer-auction` engine, no `health` action |
| FastFS URL (200 now) | `https://test.fastfs.io/proofmeme.testnet/outlayer.testnet/f52c7cb031343081dd4a2b47fe366719fd83a98fe77e62be2c5d638a5a43b405.wasm` |
| WASM upload tx | `APbBBdHbXrPtAqtD5u57D67onCu3DbMy4XtyhbkkRydo` (on chain, `gas=1`) |
| JSON upload tx | `7C9x5QtK9MS1Q8dyygBNSFjdVYT2Ahkio7Ve9uCXvLNK` (on chain, `gas=1`) |
| Execution request tx | `EhXCunr8V9urg2wV47QHidBf3wXK3TuE5h9ch5PK9z7C` (reported as a callback failure; not re-read here) |
| Project / UUID | `proofmeme.testnet/snipe-proof-auction` / `p00000000000000d5` (from the report; unchecked) |
