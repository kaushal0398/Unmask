# OutLayer attestation: what it covers, how to verify it, and what we may claim

Written 10 Nov 2026 (task A4). Everything here comes from OutLayer's own documents, read on 10 Nov, plus two read-only requests to the testnet API. We could not run an execution (that needs a payment key we do not have), so nothing below was checked against a real attestation. Things not yet confirmed are marked **unconfirmed**.

Sources: [`WORKER_ATTESTATION.md`](https://github.com/out-layer/outlayer/blob/main/WORKER_ATTESTATION.md), the [`outlayer-verify` README](https://github.com/out-layer/outlayer-verify), the [OutLayer README](https://github.com/out-layer/outlayer), and the [OpenAPI spec](https://testnet-api.outlayer.ai/openapi.json) (version `0.1.0-alpha.4`).

## 1. Short answer

OutLayer produces a **TEE attestation for every execution**: an Intel TDX quote that is signed by Intel and covers the hash of the WASM that ran, the hash of the input and the hash of the output. Anyone can check it afterwards **without an account or a key**, using the `outlayer-verify` tool. For an execution started from a NEAR transaction:

```sh
outlayer-verify tx <request_execution transaction hash> --network testnet
```

So the verification path exists and is public. What we do not yet have is a successful execution to point it at.

## 2. How it works

| Stage | What happens | Where |
|---|---|---|
| 1. Registration, on chain | A worker generates a key inside a TDX confidential VM and gets a TDX quote with that key in it. The register contract (`worker.outlayer.testnet`) verifies the quote with Intel's collateral, requires TCB status `UpToDate`, and requires **five measurements** (MRTD and RTMR0 to 3) to match an entry the contract owner approved. Only then is the key admitted | Register contract |
| 2. Sessions | The worker proves to the coordinator and the keystore that it holds a registered key | Off chain |
| 3. Per execution | Every execution gets a **fresh TDX quote** whose `report_data` is the SHA-256 of the task: `task_type, task_id, repo, commit, build_target, wasm_hash, input_hash, output_hash, block_height, caller_account_id, project_id, secrets_ref, timestamp, attached_usd` | Coordinator, public |

Only execution runs inside the TEE. Compiling a GitHub repository to WASM happens outside it. **We use a prebuilt WASM (`source = "wasm_url"`), so there is no compile step to trust: the attested `wasm_hash` is the SHA-256 of the exact `.wasm` file we uploaded.**

## 3. Where an attestation is published

Both of these are public and need no key. We checked on 10 Nov that the endpoints exist on testnet.

| Request | Result on 10 Nov |
|---|---|
| `GET https://testnet-api.outlayer.ai/attestations/by-tx/<tx_hash>` (also `by-call/<id>`, `by-request/<id>`) | `404` for the teammate's earlier request `EhXCunr8…`, which is correct: that run never executed, so it has no attestation |
| `GET https://testnet-api.outlayer.ai/public/collateral?fmspc=<12 hex chars>` | `400` with `fmspc must be 12 hex characters`: the endpoint is live and validates its input |

A call made over the HTTPS API also returns an `attestation_url` ("the TEE quote for this execution") in its response.

## 4. How to verify one

`outlayer-verify` checks three layers and gives each a verdict (a pass, a fail, or `UNPROVEN`, which means a specific question could not be answered and says which):

| Layer | Question | How |
|---|---|---|
| **Authenticity** | Is it a genuine Intel TDX quote? | Signature chain to an Intel root certificate compiled into the tool, against Intel collateral valid when the execution ran |
| **Identity** | Is the code a build the operator approved? | The five measurements from the verified quote against `is_measurements_approved` on the register contract |
| **Binding** | Does the quote cover *this* execution? | Recomputes the task hash from the execution's inputs and outputs and compares it with `report_data` |

It needs no account, configuration or key. The attestation record comes from OutLayer's API, but altering any field fails a check, and the collateral and the approved list are read from NEAR. Lookup by transaction hash is live on testnet; lookup by `job <task-id>` works on both networks.

## 5. How our fields line up

Our result stores three hashes. They are meant to be the same three values the attestation covers.

| Our field | Meant to equal | State |
|---|---|---|
| `codeHash` | the attested `wasm_hash` | **Matches by construction** when we settle with the WASM: it is the SHA-256 of the `.wasm`. The current canonical build is `7208bea0…` and is the same when built in a clean clone. The version registered today is the older `f52c7cb0…` |
| `inputHash` | the attested `input_hash` | **Unconfirmed.** We hash the exact JSON text we give the engine. OutLayer hashes the input it received, and over the HTTPS API the input is a JSON object it re-serialises, so key order or spacing could differ |
| `resultHash` (the output hash, `engineOutputHash`) | the attested `output_hash` | **Unconfirmed.** We hash the engine's exact output text locally. OutLayer returns `output` already parsed, so over HTTPS we hash our own serialisation of it |

On the first successful run, compare all three with the attestation's values. If the input or output hashes differ, change how we serialise before claiming they match; do not fudge the comparison.

## 6. What it proves, and what it does not

From OutLayer's own threat model, plus what is specific to us.

| It proves | It does not prove |
|---|---|
| This WASM hash ran, with this input hash, and produced this output hash | That the input was the real set of bids. **It attests the computation, not where the bids came from** |
| It ran in a TDX VM whose five measurements the register contract owner approved | That the build is good. The contract owner alone approves measurements, with no vote, and every change is a public NEAR transaction |
| The quote chains to Intel and the platform's TCB was `UpToDate` | That no one else could read the bids: **see section 7** |
| The result is bound to an approved build, not only to the worker's key | Anything about a full-access key on the operator account, which OutLayer's own document lists as a gap in the protocol |

## 7. The gap that attestation alone does not close

**Today our backend opens every sealed bid before the auction runs, so the backend can read all of them.** Sending the already-opened bids to OutLayer would give an attested *computation* but not private *bids*. The privacy claim ("nobody, the creator and us included, can read a bid until the close") needs the ciphertexts to go to OutLayer and be opened **inside** the enclave, with a key only the enclave holds. OutLayer has a keystore and a `secrets_ref` mechanism for that, which we have not read or designed against.

Until that is built, the right label for any OutLayer run is "the computation ran in a TEE", not "bids were private". Section 6 of [`MASTER_PLAN.md`](MASTER_PLAN.md) already says not to show a green "attested" badge unless it is true.

## 8. What the code does about it

- A run on OutLayer is recorded as `mode: "outlayer"` and shown as **"returned by OutLayer, not verified by us"**. The result page and the result card never say "attested".
- `mode: "tee"`, shown as attested, is reserved for a result whose attestation we have verified. **Nothing sets it yet.**
- The OutLayer adapter (`backend/src/outlayer.ts`, selected with `AUCTION_ENGINE=outlayer`) is built from the published API spec and tested against a stub. It has **not** been run against the real service. It needs a payment key in `OUTLAYER_PAYMENT_KEY`, which must stay on the server.
- The backend refuses to settle in production at all, because of section 7.

## 9. Checklist for the first successful run

For whoever has the CLI and the account. Each step ends with something to record.

1. `python3 scripts/check-artifact-url.py <FastFS URL> <sha256>` says OK (see [`OUTLAYER_BLOCKER_REVIEW.md`](OUTLAYER_BLOCKER_REVIEW.md)).
2. Run the project once: `outlayer run proofmeme.testnet/snipe-proof-auction --input .\auction-input.json`. Note the **transaction hash**. Record whether `success` is true.
3. `outlayer-verify tx <that hash> --network testnet`. Record the three verdicts. **If any is `UNPROVEN`, record which question and why.** Do not summarise it as "verified".
4. Also fetch `https://testnet-api.outlayer.ai/attestations/by-tx/<that hash>` and keep the JSON.
5. Compare the attested `wasm_hash`, `input_hash` and `output_hash` with ours (section 5). Record the three comparisons.
6. Check the testnet worker really runs in TDX mode (the worker setting `TEE_MODE=outlayer_tee`). **Unconfirmed:** OutLayer's default is `none`, and we do not know the testnet fleet's setting.
7. Only if steps 3 and 5 pass: we may say "this result ran on OutLayer and its attestation verified". If anything else, say what happened.

## 10. What we may say, and when

| Claim | Allowed when |
|---|---|
| "Settled by a development enclave, reproducible, not attested" | Now |
| "Ran on OutLayer" | After step 2 succeeds |
| "Ran on OutLayer and its attestation verified" | After step 7 |
| "The computation ran in a TEE" | After step 7, and only that |
| "Bids are private from the backend" | After section 7 is built and tested. **Not before** |
| "Attested" with no qualifier | Never, without the qualifier |
