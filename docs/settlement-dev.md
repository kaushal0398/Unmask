# Settlement in development

How a launch settles on one machine today, and exactly what is and is not real.

## The flow

1. The browser asks `GET /v1/launches/:id/enclave-key` and seals each bid to that key (libsodium sealed box).
2. When the window has closed, the creator calls `POST /v1/launches/:id/settle` (signed-in session, creator only).
3. The **development enclave** (`backend/src/dev-enclave.ts`) opens every ciphertext.
4. `buildInput` (`backend/src/settlement-core.ts`) keeps only honest bids and records a reason for every bid it skips: cannot decrypt, wrong launch, wrong bidder, commitment mismatch, payment check not locked or too small, bad amount, an invalid payout destination, or an agent bid that breaks its rules (wrong hash, forged or invalid signature, over its limits, expired).
5. The input is hashed (`inputHash`) and passed to the **Rust engine** (`enclave/auction-engine`), which runs the exact integer rule.
6. A payout plan is built from the result (refund and tokens per bidder, to the destination sealed in their bid, defaulting to their NEAR account). The outcome, the plan, the agent flags, `inputHash`, `codeHash` (SHA-256 of the engine binary) and the skipped list are stored in `Settlement`, and the launch becomes `SETTLED`. Settling twice returns the stored result.
7. `GET /v1/launches/:id/result` publishes it. The verify page re-hashes and re-runs the auction in the browser.

## What is real

| Piece | State |
|---|---|
| Sealing in the browser, opening with the matching key | Real |
| The auction rule, in Rust, matching TypeScript on 12 shared cases | Real |
| Input hash that does not depend on database order | Real |
| Rejecting dishonest or unfunded bids with a recorded reason | Real |
| `codeHash` of the engine binary | Real (a hash of a local build, not a reproducible published build) |

## What is NOT real

| Piece | Why |
|---|---|
| Confidentiality | The backend process holds the key and can read every bid. Only a TEE makes the "nobody can read it" claim true |
| Attestation | `attestation` is `null` and the UI labels the result `dev`. Nothing proves which code ran |
| Funds | The payment provider is a mock. Settlement computes payments and refunds but moves nothing |
| Token | No NEP-141 contract is deployed and no tokens are sent |
| Production | `POST /settle` returns 501 when `NODE_ENV=production` |

## Run it

```sh
npm run engine:build --prefix backend   # builds the Rust engine
cd backend && cp .env.example .env      # set DATABASE_URL and DEV_ENCLAVE_SEED
npx prisma migrate dev && npm run dev
```

Tests that need no database: `cd backend && npm test`, and `cd enclave/auction-engine && cargo test`.

## Verified end to end (9 Nov)

`backend/scripts/e2e-settle.ts` seeds a closed launch with four honest sealed bids (the README example), one bid with a wrong commitment and one backed by a payment check that is not locked, then calls the real routes over HTTP against PostgreSQL. It checks:

- settle without a session returns 401, and with someone else's session returns 403
- no result exists before settling (404), and an open launch cannot be settled (409)
- the launch clears at `30000` ($0.03), sells `1000000` tokens and raises `30000000000` ($30,000)
- the dishonest bid and the unfunded bid are skipped with their reasons recorded
- settling twice returns the stored result and exactly one `Settlement` row exists
- the launch becomes `SETTLED`, `attestation` is `null` and `mode` is `dev`

Run it against a throwaway database:

```sh
cd backend && cp .env.example .env            # set DATABASE_URL and DEV_ENCLAVE_SEED
npx prisma migrate deploy && npm run dev       # in one terminal
DATABASE_URL=... API_URL=http://127.0.0.1:4001 npm run e2e:settle
```

WASM: `sh snipe-proof-auction/build.sh && python3 scripts/check-wasm-vectors.py` runs the exact artifact OutLayer would receive under Wasmtime against the same 12 shared cases.

## Agents, payouts and funding (9 Nov)

- **Agent bids.** A sealed bid may carry `agent: { rules, rulesHash, signature?, publicKey? }`. At settlement the rules are re-checked against the bid and its submission time, and the owner's NEP-413 signature (recipient `unmask.agent`, nonce = SHA-256 of the rules message) is verified against a full-access key on the account via the NEAR RPC. A bid without a signature is accepted but marked `signed: false`.
- **Payouts.** A bid may carry `payout: { refundTo?, tokensTo? }`. Destinations are shape-checked (NEAR, Ethereum, Base, Arbitrum, Solana). Tokens may only go to a NEAR account. The result carries `payouts` and `payoutsExecuted: false`.
- **Funding quotes.** `GET /v1/intents/tokens`, `POST /v1/intents/quote`, `GET /v1/intents/status` proxy NEAR Intents 1Click. The proxy only ever asks for USDC on NEAR, refuses live quotes unless `ONECLICK_ALLOW_LIVE=1`, and keeps `ONECLICK_JWT` on the server.
- **WASM.** Set `AUCTION_ENGINE_WASM=../snipe-proof-auction/out/auction-engine.wasm` to settle with the artifact under `wasmtime`. The code hash is then the SHA-256 of that file.

`backend/scripts/e2e-settle.ts` covers all of this against a live database: a rule-breaking agent and a bad address are skipped, a cross-chain refund is planned via NEAR Intents and nothing is executed.

## Checking a settlement in the browser (10 Nov)

The verify page, opened from a settled launch (`/verify?launch=<id>`), recomputes what it can from the public result (`src/lib/verify-result.ts`): it rebuilds the input from the counted bids and compares its SHA-256 with the published input hash, re-runs the rule and compares every allocation and payment, checks that locked = paid + refunded and that the plan adds up, and rebuilds the engine's exact output text (in the engine's own key order, because the database does not keep key order) and compares its hash with the recorded output hash. The code hash and the attestation cannot be checked in the browser, so they show **not checked** and the verdict is never "run fairly" while any check is unchecked. Run against a real settlement it reproduced the real engine's input and output hashes exactly.

## Which engine settles (10 Nov)

| `AUCTION_ENGINE` | What runs | Recorded as |
|---|---|---|
| unset | The native Rust binary, or the `.wasm` under Wasmtime if `AUCTION_ENGINE_WASM` is set | `mode: "dev"` |
| `outlayer` | The registered project on OutLayer, over its HTTPS API (`backend/src/outlayer.ts`). Needs `OUTLAYER_PROJECT`, `OUTLAYER_PAYMENT_KEY` and `OUTLAYER_CODE_HASH` | `mode: "outlayer"`, with the attestation URL OutLayer returns |

- The result records `engineOutputHash`, the SHA-256 of the engine's exact output text, and `engineKind` (`native`, `wasm` or `outlayer`). These are the values an attestation covers, so they are what we compare it with ([`OUTLAYER_ATTESTATION.md`](OUTLAYER_ATTESTATION.md)).
- A run on OutLayer is labelled **"returned by OutLayer, not verified by us"**. `mode: "tee"` is reserved for a verified attestation and nothing sets it yet.
- The OutLayer adapter is built from the published API spec and tested against a stub. **It has not run against the real service** (it needs a payment key).
- The backend still opens every sealed bid before the auction runs, so even a verified OutLayer run would not make the bids private from the backend. That is the gap section 7 of the attestation note describes, and it is why settlement still refuses to run in production.
