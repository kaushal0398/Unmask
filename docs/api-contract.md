# API reference

Rewritten 10 Nov 2026 from the code in `backend/src/server.ts`. `python3 scripts/check-api-doc.py` fails if a route exists in the code that is not listed here, so this table cannot silently go stale.

There are two layers:

1. **The HTTP API** (the backend, Fastify). Section 1 to 6.
2. **`LaunchApi`**, the TypeScript interface the web app uses ([`src/lib/api/types.ts`](../src/lib/api/types.ts)). `getApi()` returns `HttpLaunchApi` ([`http.ts`](../src/lib/api/http.ts)), which calls the HTTP API and falls back to the in-memory sample adapter ([`mock.ts`](../src/lib/api/mock.ts)) for the sample launches. Section 7.

This is a **development** backend: payment checks are stand-ins, settlement uses the development enclave, and the write routes refuse to run when `NODE_ENV=production` (see section 6).

## 1. Basics

| | |
|---|---|
| Base URL | `http://127.0.0.1:4001` by default (`PORT`, `HOST`) |
| Format | JSON. A POST with `Content-Type: application/json` must have a body (send `{}` if there is nothing to send) |
| Errors | `{ "error": { "code": "...", "message": "..." } }`. Validation errors carry `details` instead of `message` |
| Auth | `Authorization: Bearer <session token>` from the wallet sign-in below. A route marked **session** answers `401 unauthorized` without one |
| CORS | Only the origins in `CORS_ORIGINS`, plus `http://localhost:3000` and `http://127.0.0.1:3000`. Exact origins only; a wildcard is refused at startup |
| Amounts | Unsigned integer **strings** in atomic units. Never a JSON number |

## 2. Sign-in (NEP-413)

The wallet signs a message the backend issued; the backend checks the signature and that the key is a full-access key on the account (a NEAR RPC call, so `NEAR_RPC_URL` is required).

| Route | Auth | Body | Success | Errors |
|---|---|---|---|---|
| `GET /health` | none | | `{ ok, service, mode }` | |
| `POST /v1/auth/challenge` | none | `{ accountId }` | `201 { challenge: { challengeId, accountId, nonce, message, recipient, expiresAt } }` | `400 validation_error`, `503 challenge_unavailable` (RPC on the wrong network) |
| `POST /v1/auth/verify` | none | `{ challengeId, accountId, publicKey, signature }` (signature: base64, 64 bytes) | `200 { session: { accountId, token, expiresAt } }` | `400 validation_error`, `401 authentication_failed` |

A challenge is used once and expires after `AUTH_CHALLENGE_TTL_SECONDS` (300). A session lasts `AUTH_SESSION_TTL_SECONDS` (86400).

## 3. Launches

| Route | Auth | Body | Success | Errors |
|---|---|---|---|---|
| `GET /v1/launches` | none | | `{ launches: [Launch] }` | |
| `GET /v1/launches/:id` | none | | `{ launch: Launch }` | `404 not_found` |
| `POST /v1/launches` | session | `{ name, symbol, supplyAtomic, reserveAtomic, tokenDecimals, paymentToken, paymentDecimals, capBps?, opensAt?, closesAt }` | `201 { launch }` | `400 validation_error`, `400 invalid_window`, `401 unauthorized`, `501 not_implemented` |

`Launch` is public data only: `id, name, symbol, creator, emoji, hue, tagline, supplyAtomic, reserveAtomic, tokenDecimals, paymentToken, paymentDecimals, capBps, status, opensAt, closesAt, bidCount, tokenContract, codeHash`. **It never carries a bid.** `status` is `open`, `closed`, `settled`, `draft` or `cancelled`. `bidCount` is public by design and leaks demand over time (see [`PRIVACY_THREAT_MODEL.md`](PRIVACY_THREAT_MODEL.md)).

`POST /v1/launches` ignores any `creator` in the body: **the creator is always the signed-in account.**

## 4. Bidding

A bid is made in four calls: fetch the enclave key, lock a payment check, seal the bid in the browser, submit it.

| Route | Auth | Body | Success | Errors |
|---|---|---|---|---|
| `GET /v1/enclave-key` and `GET /v1/launches/:id/enclave-key` | none | | `{ key: { keyId, publicKey, attestationRef } }` (a **public** key only; `attestationRef` is `dev://no-attestation`) | |
| `POST /v1/launches/:id/payment-checks` | session | `{ bidder, token, amountAtomic }` | `201 { check, claimKey, warning }` | `403 bidder_mismatch`, `404 not_found`, `409 closed`, `400 wrong_token`, `400 validation_error` |
| `GET /v1/payment-checks/:id` | session (owner) | | `{ check: { id, launchId, bidder, token, amountAtomic, state, expiresAt } }` | `403 forbidden`, `404 not_found` |
| `POST /v1/payment-checks/:id/reclaim` | session (owner) | | `200 { check: { id, state: "reclaimed" }, warning }` | `403 forbidden`, `404 not_found`, `409 not_reclaimable` |
| `POST /v1/launches/:id/bids` | session | `{ bidder, ciphertext, commitment, paymentCheckId, keyId }` | `201 { receiptId }` | `403 bidder_mismatch`, `404 not_found`, `409 closed`, `409 duplicate_bid`, `409 invalid_payment_check`, `400 plaintext_bid`, `400 validation_error` |
| `GET /v1/me/bids` | session | | `{ bids: [{ id, launchId, bidder, commitment, paymentCheckId, keyId, receiptId, createdAt, launch, paymentCheck }] }` (the caller's own bids only, **no ciphertext**) | |
| `GET /v1/receipts/:receiptId/verify` | session (owner) | | `{ ..., checks: [...] }` consistency checks on the stored record | `404 not_found` (identical for a receipt that exists but is not yours, and one that does not exist) |

`state` of a payment check is `locked`, `expired`, `reclaimed`, `claimed` or `failed`. An `expired` check does **not** return funds; the owner must reclaim it.

**The two warnings are literal:** `DEVELOPMENT MOCK ONLY: no funds were transferred or locked.`

### The sealed bid

The browser builds this ([`src/lib/seal.ts`](../src/lib/seal.ts)); the backend never needs the amounts to accept it.

- `ciphertext`: base64 of a libsodium **sealed box** (`crypto_box_seal`) over a JSON `BidPlaintext`, to the enclave's X25519 public key (32 bytes, hex):
  `{ launchId, bidder, limit, qty, paymentCheck: { id, key }, salt, agent?, payout? }`.
  - `agent?`: `{ rules, rulesHash, signature?, publicKey? }`. The rules an agent must stay inside; see [`agent.ts`](../src/lib/agent.ts).
  - `payout?`: `{ refundTo?, tokensTo? }`, each `{ chain, address }`. Tokens may only go to a NEAR account.
- `commitment`: SHA-256 (hex) of `JSON.stringify([launchId, bidder, limit, qty, paymentCheckId, salt])`. The claim key is left out. The bidder keeps the salt to prove the bid was theirs.

The backend rejects a `ciphertext` that starts with `{`, i.e. raw JSON (`plaintext_bid`). This only guards against sending the bid in the clear by mistake: the server cannot tell a real sealed box from any other opaque text, and base64 of JSON is accepted. It also rejects a commitment that is not 64 hex characters, a payment check that is not `locked`, and a second bid from the same account (`duplicate_bid`).

## 5. Settlement and result

| Route | Auth | Success | Errors |
|---|---|---|---|
| `POST /v1/launches/:id/settle` | session (**creator only**) | `200 { result, alreadySettled }` | `403 forbidden`, `404 not_found`, `409 not_closed` (window still open), `409 bad_state` (draft or cancelled), `501 not_implemented` (production), `outlayer_*` if `AUCTION_ENGINE=outlayer` fails |
| `GET /v1/launches/:id/result` | none | `{ result }` | `404 not_settled` |

Settling twice returns the stored result with `alreadySettled: true`.

`result` is public: `launchId, clearingPrice, sold, totalRaised, inputHash, codeHash, attestation, mode, skippedBids, settledAt, outcome`.

- `mode`: `dev` (the development enclave), `outlayer` (it ran on OutLayer; `attestation` is a URL that **we have not verified**), or `tee` (reserved for a verified attestation; nothing sets it yet).
- `outcome` holds the engine's output (`version, auctionId, tokenDecimals, clearingPrice, supply, sold, unsold, totalRaised, totalLocked, totalRefunded, fills[]`, each fill `{ bidId, bidder, limitPrice, requested, filled, locked, payment, refund }`) plus what settlement added: `skipped[]` (bids left out, each with a reason), `payouts[]` (a **plan**), `payoutsExecuted` (`false`), `agents[]`, `engineOutputHash`, `engineKind` (`native`, `wasm`, `outlayer`) and `outlayerCallId`.
- **After settlement every bid is public** (decision D7).

The browser can recompute the hashes, the rule and the money from this ([`verify-result.ts`](../src/lib/verify-result.ts), [`settlement-dev.md`](settlement-dev.md)).

## 6. Funding quotes (NEAR Intents)

A narrow proxy to the NEAR Intents 1Click service. It only ever asks for **USDC on NEAR** as the output, and live quotes are refused unless `ONECLICK_ALLOW_LIVE=1`.

| Route | Auth | Success | Errors |
|---|---|---|---|
| `GET /v1/intents/tokens` | none | The supported tokens (cached 5 minutes) | `502 upstream_unreachable` |
| `POST /v1/intents/quote` | none | A quote. A dry run has **no** `depositAddress` | `403 live_disabled`, `400 bad_request`, `400 upstream_rejected`, `502 upstream_unreachable` |
| `GET /v1/intents/status?depositAddress=` | none | The swap status | `400 bad_request`, `404`, `502` |

NEAR Intents is mainnet only. The recipient must be a real mainnet account.

### Production

When `NODE_ENV=production`, `POST /v1/launches` and `POST /v1/launches/:id/settle` return `501 not_implemented`: the development enclave must not run as if it were the real one. A hosted **demo** therefore runs without `NODE_ENV=production` ([`deploy.md`](deploy.md)).

## 7. `LaunchApi` (what the web app calls)

| Call | What it does | HTTP behind it |
|---|---|---|
| `listLaunches()` | Backend launches plus the samples. With the backend unreachable it returns the samples | `GET /v1/launches` |
| `getLaunch(id)` | One launch. A sample id still works with the backend off; any other id reports the real error | `GET /v1/launches/:id` |
| `getResult(id)` | The published result, or `null` until the launch has settled | `GET /v1/launches/:id/result` |
| `getVerification(id)` | The raw launch config and result, for the verify page to recompute. `null` for a sample or an unsettled launch | `GET /v1/launches/:id` and `/result` |
| `settleLaunch(id)` | Settle a closed launch. Creator only | `POST /v1/launches/:id/settle` |
| `getEnclaveKey(launchId)` | The public key bids are sealed to. **Never falls back to a demo key** | `GET /v1/launches/:id/enclave-key` |
| `createPaymentCheck({launchId, bidder, amount})` | Lock funds for one bid. Returns the check and the claim key (it goes inside the sealed bid, never to the backend) | `POST /v1/launches/:id/payment-checks` |
| `getPaymentCheck(id)` / `reclaimPaymentCheck(id)` | State, and take the funds back | `GET` / `POST /v1/payment-checks/:id[/reclaim]` |
| `submitBid(sealedBid)` | Accept a sealed bid. Returns a receipt id | `POST /v1/launches/:id/bids` |
| `createLaunch(input, onStep, {resumeFrom})` | Creates a launch; progress is reported step by step (`CreateStepError(step)` on failure) | `POST /v1/launches` |
| `positions()` / `withdrawBid(...)` | The buyer's bids; cancel before the close | Sample adapter today |

## 8. Things that show on screen, so they must stay true

- An `expired` payment check does **not** return funds. The UI says so and offers Reclaim.
- A result carries the code hash, input hash, output hash and, when there is one, the attestation. The result page says plainly when there is none.
- A result with `mode: "outlayer"` is labelled "not verified by us", never "attested".
