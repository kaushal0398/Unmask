# Master plan: what is left and what we add

Written 9 Nov 2026, status updated **Tue 10 Nov**. Submission is **Saturday 14 Nov 23:59 UTC**, so there are five working days left including today.

This merges three sources: [`PROJECT_PROGRESS.md`](PROJECT_PROGRESS.md) and [`PROJECT_ROADMAP.md`](PROJECT_ROADMAP.md) (the OutLayer and engine side), [`improvements-and-additions.md`](improvements-and-additions.md) (ideas from NEAR Intents and nearly.trade), and the state of this repository ([`whats-done.md`](whats-done.md), [`settlement-dev.md`](settlement-dev.md)).

Owners are **proposed** from who has been doing what. Change them freely.

- **Kaushal (Engineering Lead):** OutLayer, FastFS, the Rust engine and attestation.
- **Ayush (CTO):** backend, frontend, payments, submission.

## Status on Tue 10 Nov

**28 tasks: 12 done, 4 partly done, 12 open.** Legend used in every table below: **Done**, **Partly** (works, but not finished or not tried live), **Open**.

| | Done | Partly | Open |
|---|---|---|---|
| A. OutLayer and enclave | A2, A5 | | A1, A3, A4 |
| B. Backend | B1, B3, B4, B5 | B2 | |
| C. Payments and token | | | C1, C2, C3, C4 |
| D. Frontend | D1, D2, D3, D4 | | |
| E. Additions | E3, E4 | E1, E2 | E5 |
| F. Submission | | F2, F4 | F1, F3, F5 |

**What is left, in order of risk:**

| # | What is left | Why it matters | Who |
|---|---|---|---|
| 1 | Retry the OutLayer run once (A1), then deploy the canonical engine (A3) | The engine has never run remotely; the registered version has no `health` | Kaushal, needs the CLI |
| 2 | Real payments, the token and refunds (C1 to C4) | Nothing moves real funds yet; E1, E2 and the payout plan depend on it | Ayush and Kaushal |
| 3 | Attestation: find out what OutLayer returns and how to verify it (A4) | The fairness claim rests on it | Kaushal |
| 4 | Submission: organizer questions, public repo, Vercel, video, form (F1 to F5) | Nothing here has started, and it has a hard deadline | Both |
| 5 | The OutLayer adapter behind the settlement interface (B2). The spec and property tests (A5) are done | The switch from local to remote | Kaushal |

## Progress log

| Date | Done | Evidence |
|---|---|---|
| Mon 9 Nov | **A2** The canonical engine builds to `wasm32-wasip2`, has a `health` action and an action envelope, and runs under Wasmtime | `python3 scripts/check-wasm-vectors.py` prints `12/12 match the TypeScript rule` |
| Mon 9 Nov | **B1** A launch settles end to end against a real PostgreSQL, the live backend and the Rust engine | `cd backend && npm run e2e:settle` (needs a database and a running backend, see `settlement-dev.md`) |
| Mon 9 Nov | Decision 1 acted on: `snipe-proof-auction/build.sh` now builds `enclave/auction-engine`, the Hello World scaffold is marked unused | `snipe-proof-auction/README.md` |
| Mon 9 Nov | Found and fixed two bugs by running it: the migration SQL had Prisma's update banner in it, and `.env.example` lacked the required `NEAR_RPC_URL` | `backend/prisma/migrations/20261109120000_add_settlements`, `backend/.env.example` |
| Mon 9 Nov | **E1, E2, E3, E4** built: agent bidding with signed rules, the result card, NEAR Intents price quotes, payout destinations and plan. All tested; see the README "Features" section for how real each is | `npm test` (frontend 116, backend 49), `cd backend && npm run e2e:settle` |
| Mon 9 Nov | **B2** The backend can settle with the WASM artifact under Wasmtime (`AUCTION_ENGINE_WASM`); the code hash is then the SHA-256 of the exact `.wasm` that goes to OutLayer (`7208bea0…` for the current build) | `backend/src/engine-wasm.test.ts` |
| Mon 9 Nov | **B5 (part)** Settled backend launches now show the real result (clearing price, allocations, payout plan, left-out bids, evidence) instead of "settlement pending". Creators get a Settle button | `src/components/backend-result.tsx` |
| Mon 9 Nov | **D3 (part)** Creator can settle from the launch page | same |
| Mon 9 Nov | Found and fixed a **production build failure** (`next build` failed on `/my-bids/[id]`, which would have broken the Vercel deploy) and a **text-contrast regression** from the new pink (small pink text now uses `#FF4FCF`; fills and borders keep `#E501A5`) | `next build` passes; browser accessibility tests pass on all 12 pages |
| Mon 9 Nov | Wallet unit tests rewritten against a fake backend (they were failing without one). Four older browser tests that fail on the previous commit too are marked `test.fixme` with the reason | `e2e/smoke.spec.ts` |
| Tue 10 Nov | **Reviewed the teammate's incident report against the chain.** The FastFS "failed upload" is by design (`gas=1`): both files were recovered from the chain with matching hashes, and FastFS serves them again (GET 200; HEAD returns 404 and must not be used). The registered version fails the `health` action. New read-only tools: `scripts/recover-fastfs-artifact.py`, `scripts/check-artifact-url.py` | [`OUTLAYER_BLOCKER_REVIEW.md`](OUTLAYER_BLOCKER_REVIEW.md) |
| Tue 10 Nov | **Demo kit.** `seed:demo` and `settle:demo` scripts, `DEMO_GUIDE.md`, `DEMO_CHECKLIST.md`, `NEARLY_FEATURES_AND_CHECKS.md`, and a rewritten `demo-script.md`. Checked in a real browser against the real backend and live NEAR Intents: open launch, agent panel, payout validation, a live funding quote, and the settled result page. Found and fixed three bugs doing it: a settled backend launch showed "COUNTING…" and "Demo data", and the funding panel used a made-up recipient that NEAR Intents rejects (now `intents.near`) | [`DEMO_GUIDE.md`](DEMO_GUIDE.md) |
| Tue 10 Nov | **A5.** [`AUCTION_SPEC.md`](AUCTION_SPEC.md), randomized property tests (14 guarantees) in TypeScript and Rust, and 200 seeded random cases that TypeScript, Rust and the WASM all match (212 of 212). The tests were mutation-checked: they caught 4 of 4 real bugs, and the first version missed one (a crumb-order bug), so the fairness check was tightened | `npx tsx --test src/lib/auction-properties.test.ts`, `cd enclave/auction-engine && cargo test`, `python3 scripts/check-wasm-vectors.py` |
| Tue 10 Nov | **UI and tests.** The four stale browser tests are replaced by five that stub the backend, so the browser suite is 17 of 17 with nothing skipped (D4). Both lint errors fixed, lint is clean. The launch list now falls back to samples when the backend is off (B5, D1). The decisions doc matches the code. Doing this found three real bugs: a bad refund address error shown twice, a `<main>` nested inside the layout `<main>` on two pages, and a wrong test example | `npx playwright test`, `npx eslint src` |

## 1. The goal: one honest demo

A reviewer can follow one full flow: create a launch, place several sealed bids, close, settle with the Rust engine, see one clearing price and every allocation, and verify the result in the browser. Every part that is not yet real is labelled on screen: `dev` enclave, no attestation, simulated payments. See roadmap section 3.1.

We claim "TEE-backed", "attested" or "NEAR Intents" only after the evidence exists.

## 2. Where we are

| Area | State |
|---|---|
| Interface, wallet sign-in, in-browser bid sealing | Built. Sign-in with a live wallet has not been tried |
| Auction rule in TypeScript and Rust (`enclave/auction-engine`), 12 shared cases match, also as WASM under Wasmtime | Built, tested |
| Backend: launches, bids, sessions, enclave key, settle, result, agent rules, payout plan, NEAR Intents proxy | Built. A launch settles end to end against a real PostgreSQL (`npm run e2e:settle`) |
| Development enclave (not confidential, no attestation), can run the WASM artifact | Built |
| Settled backend launches show the real result, the result card and the payout plan | Built |
| OutLayer project registered (`proofmeme.testnet/snipe-proof-auction`) | Done |
| FastFS upload and retrieval | **Not blocked any more** (checked 10 Nov): the uploads are on chain (the "prepaid gas" error is by design), and `test.fastfs.io` serves the file again. The OutLayer run has not been retried since the outage. The registered version has no `health` action ([review](OUTLAYER_BLOCKER_REVIEW.md)) |
| Production build, 375px layout and accessibility checks on 13 pages, and 5 flow tests with a stubbed backend | Pass: 17 of 17 browser tests, none skipped |
| Real attestation, real payment checks, the token and payouts | Not started |

## 3. Decisions to settle

| # | Decision | Recommendation | Owner | State |
|---|---|---|---|---|
| 1 | **Which Rust engine is canonical.** `outlayer-auction/` (`u64`, one bid per bidder) and `enclave/auction-engine/` (exact atomic units, 256-bit math, 12 shared cases) disagree on some inputs | Use `enclave/auction-engine` | Both | **Acted on, not agreed.** `snipe-proof-auction/build.sh` builds it and it has `health`. Kaushal has not confirmed, and `outlayer-auction/` is not archived yet |
| 2 | One bid per wallet or many | One per wallet (the database already enforces it) | Ayush | Open, default in place |
| 3 | Settlement asset and token | USDC-style payment token and a plain NEP-141 on testnet | Both | **Open. Blocks C2 to C4** |
| 4 | Tie-break at the clearing price | Keep bid-id order for v1, state plainly that it is not random | Kaushal | Open, default in place and documented |
| 5 | What we show if OutLayer stays blocked | The local fallback in section 6, labelled | Both | Agreed in section 6 |

## 4. Workstreams

Tasks come from the roadmap phases (shown as `R0` to `R11`) and our additions (`A1` to `A5`).

### A. OutLayer and enclave (Kaushal)

| # | Task | Gate | By | Status |
|---|---|---|---|---|
| A1 | Retry the run once now that FastFS is back: `python3 scripts/check-artifact-url.py …` then `outlayer run … --input auction-input.json` (steps in [`OUTLAYER_BLOCKER_REVIEW.md`](OUTLAYER_BLOCKER_REVIEW.md)). Contact OutLayer only if it still fails | The run returns `success: true` with 60 / 25 / 15, or a new error to report | Tue 10 | **Open.** Needs the CLI and account |
| A2 | Make the canonical crate build for `wasm32-wasip2` and run under Wasmtime with a `health` and a `clear_auction` request (`R2`) | Same output as the TypeScript rule on all shared cases | Tue 10 | **Done** (12 of 12) |
| A3 | Replace the registered version with the canonical engine (it has `health`): build, upload, **GET and compare the hash**, deploy, run health then the fixture (`R1`, `R4`). The "failed" upload transaction is normal | Remote result equals the local result | Wed 11 | **Open** (after A1) |
| A4 | Find out what attestation OutLayer returns and how to verify it (`R4`) | A written note, plus a verifier or a clear "not available" | Thu 12 | **Open** (after A1) |
| A5 | Write `AUCTION_SPEC.md` and property tests (`R3`) | Spec merged, tests pass | Wed 11 | **Done** (10 Nov). [`AUCTION_SPEC.md`](AUCTION_SPEC.md); 14 guarantees tested on thousands of random auctions in TypeScript and Rust; 212 shared cases match in TypeScript, Rust and the WASM; the property tests catch 4 of 4 deliberate bugs |

### B. Backend (Ayush)

| # | Task | Gate | By | Status |
|---|---|---|---|---|
| B1 | Run PostgreSQL, apply migrations, exercise `/settle` and `/result` for real | One launch settles end to end locally | Mon 9 | **Done** |
| B2 | Replace the dev enclave call with an adapter: local engine now, OutLayer when A3 passes (`R5`) | One interface, two backends, chosen by config | Tue 10 | **Partly.** Native binary or the WASM artifact under Wasmtime, chosen by `AUCTION_ENGINE_WASM`. The OutLayer backend is not written |
| B3 | Persist execution record: input hash, code hash, result hash, attestation reference (`R4`, `R5`) | Stored and shown on the verify page | Wed 11 | **Done** for what exists: stored in `Settlement` and shown on the launch result page. Attestation is `null` and labelled `dev`. The verify page has not been checked against a backend result |
| B4 | Idempotent settle and retry, state checks, input size limits (`R5`, `R9`) | Tests for duplicate settle and bad state | Wed 11 | **Done.** Covered by `e2e:settle`: 401, 403, 404, 409, settling twice |
| B5 | Make the UI read launches and bids from the backend (cards, landing page) | No sample data on live paths | Thu 12 | **Done** for the live paths (10 Nov): the launch list merges backend and sample launches and falls back to samples when the backend is off, the launch page, result and receipts use the backend. The landing page cards are deliberately sample launches and say so |

### C. Payments and token (Ayush, with Kaushal on OutLayer checks)

| # | Task | Gate | By | Status |
|---|---|---|---|---|
| C1 | Decide the asset and token (decision 3) and write it down | Entry in `decisions-and-open-questions.md` | Mon 9 | **Open** |
| C2 | Real payment verification on testnet, one payment per bid (`R7`) | A bid is accepted only if the transfer exists on chain | Wed 11 | **Open.** The payment provider is still a stand-in |
| C3 | Deploy a NEP-141 test token and send winners their tokens (`R7`) | Winner balance visible on chain | Thu 12 | **Open** |
| C4 | Refunds and reclaim for everyone else (`R7`) | Locked equals paid plus refunded, per bid | Thu 12 | **Open.** The numbers are computed and planned, nothing is sent |

If C2 to C4 do not land by Thursday, the demo shows simulated payments, clearly labelled (section 6).

### D. Frontend (Ayush)

| # | Task | Gate | By | Status |
|---|---|---|---|---|
| D1 | Every network call has loading, empty and error states (`R8`) | No blank screens with the backend off | Tue 10 | **Done** (10 Nov): all 13 routes load with the backend off, the launch list and launch page fall back to samples, a receipt without a wallet explains itself, and a stubbed backend is tested for the open, settled and unknown-launch cases |
| D2 | Result page shows execution evidence in plain language, with `dev` shown honestly | Matches `settlement-dev.md` | Wed 11 | **Done** (`backend-result.tsx`) |
| D3 | Creator flow: create, watch the window, settle (`R8`) | One click settles when the window is closed | Wed 11 | **Done** for settle. Create exists but has only been tried with the sample adapter |
| D4 | Mobile pass and accessibility check, run the Playwright tests | Tests green | Fri 13 | **Done** (10 Nov): 17 of 17 browser tests pass, with none skipped. 13 pages at 375px with no serious accessibility problems, plus tests of agent mode, the refund address check, the funding preview, the settled result and the launch list |

### E. Additions that make it feel stronger (from `improvements-and-additions.md`)

| # | Addition | Needs | By | Status |
|---|---|---|---|---|
| E1 | Fund a bid from any chain through NEAR Intents 1Click (typed client and UI first) | A mainnet key and a few dollars for the final test | Thu 12 | **Partly.** A real price preview works through our backend. No deposit has been taken |
| E2 | Choose where refunds and tokens land (cross-chain payout), built on E1 | Same as E1 | Thu 12 | **Partly.** Destinations are sealed in the bid and planned in the result. Nothing is sent |
| E3 | Agent bidder with signed rules (max price, max quantity, expiry) | Nothing external | Wed 11 | **Done.** Signing with a live wallet has not been tried |
| E4 | Public per-bidder result card (paid, got, refunded, effective price) | Nothing external | Thu 12 | **Done** |
| E5 | Explorer links for every real on-chain step | Real transfers (C2 to C4) | Fri 13 | **Open** |

Only E1, E3 and E4 were worth doing if time was short. Do not claim E1 or E2 beyond "price preview" and "plan" until a real transfer has happened.

### F. Submission (both)

| # | Task | By | Status |
|---|---|---|---|
| F1 | Answer the open organizer questions (eligibility, third-party TEE, real-funds limits) in `questions-for-organizers.md` and send them | Mon 9 | **Open.** Drafted, not sent. Overdue |
| F2 | Make the repository public, add the license, check no secrets are committed (`R0`) | Thu 12 | **Partly.** The secret scan is **done and clean** (10 Nov, `sh scripts/scan-secrets.sh`: no keys, no `.env` files, no credentials in the files or in 53 commits of history). Still open: the repo is private, the license is undecided, and the history carries about 74 MB of `node_modules` and build output committed on 1 to 2 Nov and removed since. Removing it means rewriting history and force-pushing, which breaks Kaushal's clones, so do it together or leave it |
| F3 | Deploy the frontend to Vercel and point it at a hosted backend | Fri 13 | **Open.** The production build passes |
| F4 | Rehearse `demo-script.md` from a clean browser, record the video, write the X post | Fri 13 | **Partly.** The demo kit is written and Plan B was checked in a browser. Plan A (a live wallet) is untested, and nothing is recorded |
| F5 | Fill in the submission form from `submission-checklist.md` and submit | Sat 14, before 18:00 UTC | **Open** |

## 5. Day by day

| Day | Focus | Done when | Status |
|---|---|---|---|
| **Mon 9** | Decisions 1 to 5. Support message (A1). Local database and a real settle (B1). Organizer questions (F1). Asset choice (C1) | One launch settles locally | **Mostly done.** B1 done. F1 and C1 slipped. A1 changed: the support message is no longer needed |
| **Tue 10** | Canonical engine builds to WASM (A2). Settlement adapter (B2). Loading and error states (D1). Retry the OutLayer run (A1) | Wasmtime output equals TypeScript on every shared case | **In progress.** A2 done, B2 and D1 partly. A1 waits on Kaushal. Also done: the four additions, the build fix, the blocker review |
| **Wed 11** | Deploy the canonical engine (A3). Spec and property tests (A5). Real payment check (C2). Decide asset and token (C1) | Remote run, or the fallback chosen on purpose | Not started |
| **Thu 12** | Attestation note (A4). Live data in the UI (B5). Token and refunds (C3, C4). 1Click live call if possible (E1, E2). Repo public (F2) | Feature freeze at end of day | Not started |
| **Fri 13** | No new features. Deploy (F3), end to end test, mobile pass (D4), rehearse and record (F4) | Demo runs from a clean browser | Not started |
| **Sat 14** | Fix only blockers. Submit (F5) | Submitted before 18:00 UTC | Not started |

## 6. Cut line and fallbacks

| If | Then |
|---|---|
| The OutLayer run still fails on Wed 11 after the retry | Demo with the local Rust engine, labelled `dev`, no attestation. Keep the OutLayer project and the failed-upload record as an honest "in progress" slide |
| Real payments are not working on Thu 12 | Demo simulated payments, labelled. Do not describe deposits as locked funds |
| No NEP-141 token by Thu 12 | Show allocations only. Say payouts are next |
| 1Click has no live call by Thu 12 | Leave E1 and E2 out of the claims. Mention them as planned in the README |
| Attestation cannot be verified | Say so on the result page. Never show a green "attested" badge |

The rule from the roadmap applies throughout: **one complete, honest demo beats many partial features.**

## 7. What we need from outside

| Need | From | Needed by | State |
|---|---|---|---|
| Someone with the OutLayer CLI to retry the run and deploy the canonical engine (FastFS itself works again) | Kaushal | Tue 10 | Waiting. A message was drafted for him |
| Decision on the settlement asset and token (C1) | Both | Tue 10 | Open |
| Mainnet key and a few dollars of funds for a 1Click test | Team | Wed 11 | Open |
| Testnet funds on `proofmeme.testnet` for the token and payment work | Team | Wed 11 | Open |
| Organizer answers on eligibility and real funds | Organizers | Tue 10 | **Questions not sent yet** |

## 8. Done checklist

- [ ] Canonical engine chosen and the other archived (chosen in practice; Kaushal has not confirmed and `outlayer-auction/` is still there)
- [x] Wasmtime output equals TypeScript on every shared case
- [x] A launch settles end to end against a live database
- [ ] Remote OutLayer run succeeded, or the fallback is labelled everywhere (the fallback is labelled; the remote run is waiting on A1)
- [x] Execution record stored and shown
- [ ] Payments and token real, or labelled simulated everywhere (labelled simulated for now)
- [x] README, `settlement-dev.md` and the UI agree on what is real
- [ ] Repository public, no secrets committed
- [ ] Deployed, demo rehearsed and recorded
- [ ] Submitted before 14 Nov 18:00 UTC
