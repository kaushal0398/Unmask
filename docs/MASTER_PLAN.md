# Master plan: what is left and what we add

Written 9 Nov 2026 (Monday). Submission is **Saturday 14 Nov 23:59 UTC**, so there are six working days including today.

This merges three sources: [`PROJECT_PROGRESS.md`](PROJECT_PROGRESS.md) and [`PROJECT_ROADMAP.md`](PROJECT_ROADMAP.md) (the OutLayer and engine side), [`improvements-and-additions.md`](improvements-and-additions.md) (ideas from NEAR Intents and nearly.trade), and the state of this repository ([`whats-done.md`](whats-done.md), [`settlement-dev.md`](settlement-dev.md)).

Owners are **proposed** from who has been doing what. Change them freely.

- **Kaushal (Engineering Lead):** OutLayer, FastFS, the Rust engine and attestation.
- **Ayush (CTO):** backend, frontend, payments, submission.

## 1. The goal: one honest demo

A reviewer can follow one full flow: create a launch, place several sealed bids, close, settle with the Rust engine, see one clearing price and every allocation, and verify the result in the browser. Every part that is not yet real is labelled on screen: `dev` enclave, no attestation, simulated payments. See roadmap section 3.1.

We claim "TEE-backed", "attested" or "NEAR Intents" only after the evidence exists.

## 2. Where we are

| Area | State |
|---|---|
| Interface, wallet sign-in, in-browser bid sealing | Built |
| Auction rule in TypeScript and Rust (`enclave/auction-engine`), 12 shared cases match | Built, tested |
| Backend: launches, bids, sessions, enclave key, settle, result | Built, **not run against a live database** |
| Development enclave (not confidential, no attestation) | Built |
| OutLayer project registered (`proofmeme.testnet/snipe-proof-auction`) | Done |
| FastFS upload and retrieval | **Blocked** (uploads fail with "Exceeded the prepaid gas", gateway returns 502) |
| Real attestation, real payment checks, token and payouts | Not started |

## 3. Decisions to settle today

| # | Decision | Recommendation | Owner |
|---|---|---|---|
| 1 | **Which Rust engine is canonical.** `outlayer-auction/` (`u64`, one bid per bidder) and `enclave/auction-engine/` (exact atomic units, 256-bit math, 12 shared cases) disagree on some inputs | Use `enclave/auction-engine`. Port the `health` action and the OutLayer build setup into it. Delete or archive the other | Both |
| 2 | One bid per wallet or many | One per wallet (the database already enforces it) | Ayush |
| 3 | Settlement asset and token | USDC-style payment token and a plain NEP-141 on testnet | Both |
| 4 | Tie-break at the clearing price | Keep bid-id order for v1, state plainly that it is not random | Kaushal |
| 5 | What we show if OutLayer stays blocked | The local fallback in section 6, labelled | Both |

## 4. Workstreams

Tasks come from the roadmap phases (shown as `R0` to `R11`) and our additions (`A1` to `A5`).

### A. OutLayer and enclave (Kaushal)

| # | Task | Gate | By |
|---|---|---|---|
| A1 | Send the support message (draft is in `PROJECT_PROGRESS.md`) and ask for a documented upload path (`R1`) | Message sent; reply or workaround | Mon 9 |
| A2 | Make the canonical crate build for `wasm32-wasip2` and run under Wasmtime with a `health` and a `clear_auction` request (`R2`) | Same output as the TypeScript rule on all shared cases | Tue 10 |
| A3 | Once a retrievable artifact exists: upload, fetch, compare SHA-256, deploy, run health then the fixture (`R1`, `R4`) | Remote result equals the local result | Wed 11 |
| A4 | Find out what attestation OutLayer returns and how to verify it (`R4`) | A written note, plus a verifier or a clear "not available" | Thu 12 |
| A5 | Write `AUCTION_SPEC.md` and property tests (`R3`) | Spec merged, tests pass | Wed 11 |

### B. Backend (Ayush)

| # | Task | Gate | By |
|---|---|---|---|
| B1 | Run PostgreSQL, apply migrations, exercise `/settle` and `/result` for real | One launch settles end to end locally | Mon 9 |
| B2 | Replace the dev enclave call with an adapter: local engine now, OutLayer when A3 passes (`R5`) | One interface, two backends, chosen by config | Tue 10 |
| B3 | Persist execution record: input hash, code hash, result hash, attestation reference (`R4`, `R5`) | Stored and shown on the verify page | Wed 11 |
| B4 | Idempotent settle and retry, state checks, input size limits (`R5`, `R9`) | Tests for duplicate settle and bad state | Wed 11 |
| B5 | Make the UI read launches and bids from the backend (cards, landing page) | No sample data on live paths | Thu 12 |

### C. Payments and token (Ayush, with Kaushal on OutLayer checks)

| # | Task | Gate | By |
|---|---|---|---|
| C1 | Decide the asset and token (decision 3) and write it down | Entry in `decisions-and-open-questions.md` | Mon 9 |
| C2 | Real payment verification on testnet, one payment per bid (`R7`) | A bid is accepted only if the transfer exists on chain | Wed 11 |
| C3 | Deploy a NEP-141 test token and send winners their tokens (`R7`) | Winner balance visible on chain | Thu 12 |
| C4 | Refunds and reclaim for everyone else (`R7`) | Locked equals paid plus refunded, per bid | Thu 12 |

If C2 to C4 do not land by Thursday, the demo shows simulated payments, clearly labelled (section 6).

### D. Frontend (Ayush)

| # | Task | Gate | By |
|---|---|---|---|
| D1 | Every network call has loading, empty and error states (`R8`) | No blank screens with the backend off | Tue 10 |
| D2 | Result page shows execution evidence in plain language, with `dev` shown honestly | Matches `settlement-dev.md` | Wed 11 |
| D3 | Creator flow: create, watch the window, settle (`R8`) | One click settles when the window is closed | Wed 11 |
| D4 | Mobile pass and accessibility check, run the Playwright tests | Tests green | Fri 13 |

### E. Additions that make it feel stronger (from `improvements-and-additions.md`)

| # | Addition | Needs | By |
|---|---|---|---|
| E1 | Fund a bid from any chain through NEAR Intents 1Click (typed client and UI first) | A mainnet key and a few dollars for the final test | Thu 12 |
| E2 | Choose where refunds and tokens land (cross-chain payout), built on E1 | Same as E1 | Thu 12 |
| E3 | Agent bidder with signed rules (max price, max quantity, expiry) | Nothing external | Wed 11 |
| E4 | Public per-bidder result card (paid, got, refunded, effective price) | Nothing external | Thu 12 |
| E5 | Explorer links for every real on-chain step | Real transfers (C2 to C4) | Fri 13 |

Only E1, E3 and E4 are worth doing if time is short. Do E1 only if a real 1Click call can be made and shown.

### F. Submission (both)

| # | Task | By |
|---|---|---|
| F1 | Answer the open organizer questions (eligibility, third-party TEE, real-funds limits) in `questions-for-organizers.md` and send them | Mon 9 |
| F2 | Make the repository public, add the license, check no secrets are committed (`R0`) | Thu 12 |
| F3 | Deploy the frontend to Vercel and point it at a hosted backend | Fri 13 |
| F4 | Rehearse `demo-script.md` from a clean browser, record the video, write the X post | Fri 13 |
| F5 | Fill in the submission form from `submission-checklist.md` and submit | Sat 14, before 18:00 UTC |

## 5. Day by day

| Day | Focus | Done when |
|---|---|---|
| **Mon 9** | Decisions 1 to 5. Support message (A1). Local database and a real settle (B1). Organizer questions (F1). Asset choice (C1) | One launch settles locally; support message sent |
| **Tue 10** | Canonical engine builds to WASM (A2). Settlement adapter (B2). Loading and error states (D1) | Wasmtime output equals TypeScript on every shared case |
| **Wed 11** | Retry the OutLayer upload if support replied (A3). Spec and property tests (A5). Execution record and idempotency (B3, B4). Real payment check (C2). Agent bidder (E3). Creator flow and result evidence (D2, D3) | Remote run, or the fallback chosen on purpose |
| **Thu 12** | Attestation note (A4). Live data in the UI (B5). Token and refunds (C3, C4). 1Click funding (E1, E2). Result card (E4). Repo public (F2) | Feature freeze at end of day |
| **Fri 13** | No new features. Deploy (F3), end to end test, mobile pass (D4), rehearse and record (F4) | Demo runs from a clean browser |
| **Sat 14** | Fix only blockers. Submit (F5) | Submitted before 18:00 UTC |

## 6. Cut line and fallbacks

| If | Then |
|---|---|
| OutLayer upload or fetch is still blocked on Wed 11 | Demo with the local Rust engine, labelled `dev`, no attestation. Keep the OutLayer project and the failed-upload record as an honest "in progress" slide |
| Real payments are not working on Thu 12 | Demo simulated payments, labelled. Do not describe deposits as locked funds |
| No NEP-141 token by Thu 12 | Show allocations only. Say payouts are next |
| 1Click has no live call by Thu 12 | Leave E1 and E2 out of the claims. Mention them as planned in the README |
| Attestation cannot be verified | Say so on the result page. Never show a green "attested" badge |

The rule from the roadmap applies throughout: **one complete, honest demo beats many partial features.**

## 7. What we need from outside

| Need | From | Needed by |
|---|---|---|
| Working FastFS or another artifact path | OutLayer support | Wed 11 |
| Mainnet key and a few dollars of funds for a 1Click test | Team | Wed 11 |
| Testnet funds on `proofmeme.testnet` | Team | Mon 9 |
| Organizer answers on eligibility and real funds | Organizers | Tue 10 |

## 8. Done checklist

- [ ] Canonical engine chosen and the other archived
- [ ] Wasmtime output equals TypeScript on every shared case
- [ ] A launch settles end to end against a live database
- [ ] Remote OutLayer run succeeded, or the fallback is labelled everywhere
- [ ] Execution record stored and shown
- [ ] Payments and token real, or labelled simulated everywhere
- [ ] README, `settlement-dev.md` and the UI agree on what is real
- [ ] Repository public, no secrets committed
- [ ] Deployed, demo rehearsed and recorded
- [ ] Submitted before 14 Nov 18:00 UTC
