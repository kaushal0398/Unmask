# NEAR protocols: what we use and where it stands

**No OutLayer, NEP-141 or Intents call exists yet.** Those are researched from documentation only. The one thing in code is the browser side: wallet sign-in with near-connect and bid sealing with libsodium (a fake enclave key), both on the frontend. Backend, enclave and token work is listed in [`team-handoff.md`](team-handoff.md).

## Status levels

| Level | Meaning |
|---|---|
| Not started | Not looked at in depth |
| Researched | Documentation read; nothing run |
| Spiked | Called once with a test amount; result written down |
| Integrated | In the code with tests |
| Live | Used on mainnet |

## Protocols

| Protocol | What we use it for | What the documentation says | Status | Next step |
|---|---|---|---|---|
| **OutLayer (TEE compute)** | Runs the auctioneer privately and signs the result | Runs Rust compiled to WebAssembly (WASI 1 or 2) in an Intel TDX enclave. The binary is hosted on GitHub and OutLayer compiles and caches it. Triggered from a NEAR contract (yield/resume) or over HTTPS. Secrets are decrypted only inside the enclave. Results carry an attestation covering the code hash, input hash and output. A price oracle runs on it today. | Researched | Read how to verify an attestation, then run a hello-world |
| **OutLayer payment checks** | Lock each bid and refund what is not owed | `POST /wallet/v1/payment-check/create` (Bearer `wk_…`; `token`, `amount`, optional `memo`, `expires_in`) returns `check_id` and `check_key`. Funds move from the sender's intents balance into a per-check account on `intents.near`, with no gas. `/claim` supports a partial `amount`. `/peek` shows balance and status. `/reclaim` is creator-only. `/batch-create` takes up to 10. Expiry blocks new claims but does not return funds. | Researched | Spike with tiny amounts, including early reclaim |
| **OutLayer verifiable randomness** | Rounding leftovers at the clearing price | Listed as verifiable randomness with Ed25519 signatures | Researched (briefly) | Read the details |
| **NEP-141** | The token being launched | The standard NEAR fungible token. Recipients need a storage deposit before they can receive it. | Not started | Find the standard contract and test a transfer to a fresh account |
| **NEAR Intents** | Optional: let buyers fund bids from other chains | Cross-chain swaps and deposits; the Agent API documents deposit addresses | Researched (optional) | Decide after the core works |

## Not used in this project
NEAR AI Cloud, Sputnik DAO and Trezu, market.near.ai.

## What we do not know yet
- How to verify an OutLayer attestation (the page we read did not give the steps).
- OutLayer's fees and limits for compute and for payment checks.
- Whether a bidder reclaiming a check before settlement leaves any trace the enclave can use.
- Whether the enclave can read a large batch of encrypted bids in one call.

## Sources
- NEAR docs: OutLayer, `docs.near.org/primitives/off-chain-compute/outlayer`
- OutLayer payment checks, `outlayer.fastnear.com/docs/payment-checks`
- OutLayer agent custody, `outlayer.fastnear.com/docs/agent-custody`

## Evidence log
| Date | What | Result |
|---|---|---|
| 28 Oct | Read the OutLayer pages above | Notes in this file; nothing run |
