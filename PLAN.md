# Snipe-Proof Meme Launch: plan at a glance

Tracks: **11 Memecoins With Mechanics, 3 Privacy & Private AI, 4 Autonomous Business, 1 Unstoppable DeFi**
Window: development 1–14 Nov 2026. Submit by **14 Nov 23:59 UTC**; aim for 13 Nov.

Full detail: `../docs/snipe-proof-meme-launch/plan.md`. Product description: `../docs/snipe-proof-meme-launch/what-we-are-building.md`. Progress: `../progress.md`.

| Phase | Dates | Goal | Main tasks | Done when |
|---|---|---|---|---|
| **0 Prepare** | 28–31 Oct | Learn and de-risk. No feature code. | Read OutLayer docs (WASM deploy, attestation check, secrets, randomness, fees); test payment checks with tiny amounts including early reclaim; set up a wallet with a few dollars; find the NEP-141 contract and storage deposit flow; check Rust and WASM toolchain; send organizer questions; create the public repo | One-page notes answer each question; public repo exists |
| **1 Reference auction** | 1–3 Nov | A correct auction in TypeScript, plus a simulator | Read the Next.js guide in `AGENTS.md`; write `auction-core`; write shared test vectors; build the first-come versus sealed-bid comparison view; create-launch and launch pages with fake data | Invariants pass; comparison shows a bot winning in one launch and not the other |
| **2 Enclave** | 4–7 Nov | The same auction running in a TEE | Port to Rust; compile to WebAssembly and run in OutLayer; decrypt sealed bids; return result, code hash and input hash; verify the attestation in code | Rust matches TypeScript on every vector; a real attestation verifies |
| **3 Money and token** | 7–10 Nov | Real funds move correctly | Bid flow with payment checks; settlement (claim, run, refund, proceeds); NEP-141 distribution with storage deposits; failure handling; mainnet rehearsal with a few dollars | Funds in equal funds out; result page matches the chain |
| **4 Polish** | 10–12 Nov | Easy to use and to verify | Verify page; error and empty states; mobile and accessibility; README | A stranger can verify a launch |
| **5 Ship** | 12–14 Nov | Submit | Final recorded launch; demo video and X post; submission form; freeze and tag | Submitted by 13 Nov |

## Decisions to settle early
| ID | Question | Default |
|---|---|---|
| D1 | How bidders fund a bid | OutLayer payment check |
| D3 | Claim whole checks then refund, or claim only the amounts owed | Claim whole, then refund |
| D4 | Where launch state and ciphertexts live | A small hosted database |
| D6 | Ties at the clearing price | Pro-rata; verifiable randomness for rounding dust |
| D7 | Reveal losing bids after settlement | Aggregate order book only |

## Biggest risks
- How to verify an OutLayer attestation is not documented in what we read.
- OutLayer fees and limits are unknown.
- A bidder can reclaim their own check early; the enclave must drop that bid.
- Organizer view on pre-existing work and on a TEE service.
