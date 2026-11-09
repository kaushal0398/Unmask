# Settlement in development

How a launch settles on one machine today, and exactly what is and is not real.

## The flow

1. The browser asks `GET /v1/launches/:id/enclave-key` and seals each bid to that key (libsodium sealed box).
2. When the window has closed, the creator calls `POST /v1/launches/:id/settle` (signed-in session, creator only).
3. The **development enclave** (`backend/src/dev-enclave.ts`) opens every ciphertext.
4. `buildInput` (`backend/src/settlement-core.ts`) keeps only honest bids and records a reason for every bid it skips: cannot decrypt, wrong launch, wrong bidder, commitment mismatch, payment check not locked or too small, bad amount.
5. The input is hashed (`inputHash`) and passed to the **Rust engine** (`enclave/auction-engine`), which runs the exact integer rule.
6. The outcome, `inputHash`, `codeHash` (SHA-256 of the engine binary) and the skipped list are stored in `Settlement`, and the launch becomes `SETTLED`. Settling twice returns the stored result.
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
