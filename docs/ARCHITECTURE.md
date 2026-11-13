# Architecture

Status key: **Implemented** = built and tested here. **Development** = works, but uses a mock. **Planned** = not built.

## Components

| Part | What it does | Status |
|---|---|---|
| Next.js frontend (`src/`) | Launch pages, bid form, receipts, certificate, passport, treasury, market card | Implemented |
| Fastify + Prisma backend (`backend/`) | Auth (NEAR wallet signatures), launches, sealed bids, settlement, results | Implemented |
| Auction engine (`enclave/auction-engine`, Rust, also WASM) | Uniform-price allocation and clearing price | Implemented, deterministic tests |
| Enclave / TEE | Opens sealed bids and runs the auction privately | **Development**: a dev enclave key; no attestation. OutLayer path exists but its quote is not verified by us |
| Payment provider | Locks funds for a bid | **Development**: mock; no real funds move |
| Treasury contract (`contracts/treasury`) | Policy caps, N-of-M approvals, timelock | Implemented, 11 tests, deployed on testnet |
| Registry contract (`contracts/registry`) | Anchors a settlement's hashes on NEAR | Implemented, 3 tests, deployed on testnet |
| Token and refund transfers | Pay out tokens and refunds | **Planned**: plans are computed, nothing is sent |
| Liquidity pool / trading | Secondary market | **Planned** |

## Flow
1. Creator creates a launch (reserve, supply, cap, window).
2. Bidders seal bids in the browser to the enclave key; the backend stores ciphertext + commitment and returns a receipt.
3. After close, the creator settles: the engine computes one clearing price for all winners.
4. The result is stored; if `ANCHOR_*` is set, the input/output/code hashes and price are recorded on NEAR by the registry contract.
5. Public pages: result, certificate (hashes, anchor, TEE status), passport (risk checks), market card.
6. Proceeds are intended to go to the treasury; this link is **not** automated yet.

## Trust boundaries
- **Public:** launch parameters, commitments, results, hashes, the on-chain anchor, treasury state.
- **Private until settlement:** bid values and salts (sealed to the enclave key).
- **Not hidden from the operator today:** in development mode the backend can read bids. Do not claim bid privacy against the operator until a verified TEE is in place (see `PRIVACY_THREAT_MODEL.md`).

## Deployed on NEAR testnet
- Treasury: `68172a040ac2233dc945dea305ce4a49746f7433274ed82103358bdb0959f035`
- Registry: `951abbe83dfc47adeb94652495d612008c215c422cbaa002238449f086eaa755` (writer `cd45f96e0ceaa523cb8038555aef39db40b4deb1b958dc8b352a4cd43da68047`)

See also: `FAIRNESS_CERTIFICATE.md`, `TREASURY_POLICY.md`, `AUCTION_SPEC.md`, `REMAINING_WORK.md`.
