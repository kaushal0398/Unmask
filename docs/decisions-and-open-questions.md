# Decisions and open questions

## Decisions

Updated 10 Nov. "Decided" means the code already does it, so the decision is made by what exists; change it deliberately or not at all.

| ID | Decision | Original default | Status | What the code does today |
|---|---|---|---|---|
| D1 | How bidders fund a bid | Payment check | **Open** | A stand-in payment provider that locks nothing (`backend/src/payment-provider.ts`). Funding from another chain is a price preview only |
| D2 | How a bid is encrypted to the enclave | A public key and a standard sealed box | **Decided** | libsodium sealed box in the browser (`src/lib/seal.ts`) to the enclave's public key; the development enclave opens it (`backend/src/dev-enclave.ts`). The real enclave key and attestation are still open |
| D3 | Settlement custody | Claim whole checks, then refund | **Open** | Settlement computes what each bid pays and is refunded (`locked − payment`) and plans the transfers. Nothing is claimed or sent |
| D4 | Where launch state and ciphertexts live | A small hosted database | **Decided** | PostgreSQL through Prisma, behind the Fastify backend |
| D5 | How the token is created | The standard NEP-141 on a fresh account | **Open** | Not started |
| D6 | Ties at the clearing price | Pro-rata, with verifiable randomness for rounding leftovers | **Decided, differently** | Pro-rata, with leftovers to the largest remainders, then the lowest bid id. Deterministic, **not random**. See [`AUCTION_SPEC.md`](AUCTION_SPEC.md) section 5 for the catch and how a later version could change it |
| D7 | Whether to reveal losing bids after settlement | Only the aggregate order book | **Decided, differently** | After settlement **every bid is public** in the result: bidder, limit, quantity, what it got. The verify page needs them to re-run the rule. The catch: a losing bidder's limit and account are visible |
| D8 | Orchestration | The app's API first | **Decided** | The Fastify backend settles; there is no NEAR contract |

## Open questions

| Question | Why it matters | Who | By | State |
|---|---|---|---|---|
| How is an OutLayer attestation verified? | The fairness claim rests on it | Kaushal | Thu 12 | **Open.** The result is labelled `dev` with no attestation |
| What are OutLayer's fees and limits? | Cost per launch | Kaushal | Thu 12 | **Open.** One run cost about 0.002 NEAR and the unused part was refunded. The request showed a 10 second limit against 60 in `outlayer.toml` |
| What happens when a bidder reclaims a check early? | Could disturb settlement | | | **Answered for the development flow:** a bid whose payment check is no longer locked is left out with a recorded reason. Open for the real checks |
| Can the enclave take many encrypted bids in one call? | Shapes the settle call | | | **Open for OutLayer.** Our engine takes the whole input in one call, up to 10,000 bids |
| What counts as new work for the hackathon, given the scaffold was created on 28 Oct? | Eligibility | Nobody (no organizer contact) | Before 1 Nov | **Dropped: no contact. Plain labelling instead** |
| Is a TEE service from a third party acceptable? | Eligibility | Nobody (no organizer contact) | Before 1 Nov | **Dropped: no contact. Plain labelling instead** |
| Any limit on using real funds in the demo? | Safety | Nobody (no organizer contact) | Before 1 Nov | **Dropped: no contact. Plain labelling instead** |

## Decided so far
- The project is a sealed-bid, uniform-price launch.
- Tracks: 11, 3, 4 and 1.
- The first version is orchestrated by the app's API.
- Nothing may be built before 1 Nov except research and design.
- Bids are sealed with a libsodium sealed box, state lives in PostgreSQL, and the backend orchestrates settlement (D2, D4, D8).
- Ties are deterministic and every bid is revealed after settlement (D6, D7), both different from the original defaults.
