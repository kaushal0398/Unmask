# Snipe-Proof Meme Launch: plan

How we build it. The product is described in `what-we-are-building.md`. This plan covers scope, architecture, the work in phases, tests, risks and the submission.

## Status on 30 Oct

The interface (all pages, wallet sign-in, browser-side bid sealing, payment-check screens, live launch states, create progress, verify page, preview images, demo mode, tests) is built on demo data. The enclave, payment checks, token and storage are not started. Task-by-task owners: [`team-handoff.md`](team-handoff.md). Phase 1 tasks 1.1, 1.2, 1.4 and 1.5 are done; 1.3 (shared `test-vectors/`) is not. In Phase 4, 4.2 and 4.3 are done on the frontend; 4.1 waits on the real attestation.

## 0. Ground rules

- **Rules check:** the form says to build during the hackathon. This project folder holds only generated `create-next-app` boilerplate. Any older code we reuse is flagged for the organizers.
- **Public repo:** judges cannot open a private one. Create the public repo for this app early and keep it public.
- **Secrets:** API keys and private keys never go in the repo. Use `.env` (ignored) and a local secrets folder (ignored).
- **Money:** everything that spends uses a dedicated low-value account and tiny amounts.

## 1. Scope

### Must have (the submission)
- A sealed-bid, uniform-price auction with the rules in section 4 of the product doc.
- A reference implementation in TypeScript with strong tests (the "source of truth" for behavior).
- The same auction implemented as Rust/WebAssembly and run in an OutLayer enclave, with an attestation.
- Bids locked and refunded with OutLayer payment checks.
- A NEP-141 token distributed to winners.
- A Next.js app with: create a launch, launch page with countdown, bid flow, result page, verify page, and a comparison view (first-come versus sealed-bid).
- One real small launch on mainnet.

### Should have
- Failure handling: no bids, undersubscribed launch, a bid withdrawn early, an enclave failure that refunds everyone.
- A per-account cap.
- A short written verification guide.

### Could have
- Funding bids from other chains through NEAR Intents.
- Orchestration through a NEAR contract instead of the app's API.
- Revealing the full order book after settlement.
- A post-launch module (Meme Court) as a follow-up.

### Out of scope
- Liquidity pools, trading, price promises, anti-whale or identity checks, and any claim about returns.

## 2. Architecture

```
 Browser (Next.js)
   create / bid / results / verify
        |
        v
 Next.js server routes  ---->  Store (launches, encrypted bids, results)
        |
        |  HTTPS
        v
 OutLayer enclave (Rust -> WASM, Intel TDX)
   - decrypts bids
   - claims payment checks
   - runs the auction
   - signs result + attestation
        |
        v
 NEAR:  NEP-141 token  |  OutLayer wallets / payment checks  |  intents.near
```

### Data flow
1. **Create:** the creator calls the app, which stores the launch parameters and deploys or registers the NEP-141 token with the sale supply held by the settlement account.
2. **Bid:** the browser encrypts `{ limitPrice, quantity, bidder, checkId, checkKey }` to the enclave's public key and posts the ciphertext. The bidder has already created the payment check.
3. **Close:** the app asks the enclave to settle with the list of ciphertexts and a hash of that list (published before settlement).
4. **Settle:** the enclave decrypts, validates (is the check funded?), claims, runs the auction, returns the result with the code hash, input hash and attestation. The app then performs the token transfers and refunds the enclave specified.
5. **Verify:** the verify page recomputes the hashes and checks the attestation and the on-chain transfers against the result.

### Orchestration options
| Option | Description | Verdict |
|---|---|---|
| **1. API-orchestrated** | The Next.js server holds the launch state and calls the enclave over HTTPS | **MVP.** Fastest to build. |
| **2. Contract-orchestrated** | A NEAR contract stores encrypted bids and triggers the enclave with NEAR's yield/resume | Target if time allows. Better for trust. |

### Key decisions

| ID | Decision | Default | How to resolve |
|---|---|---|---|
| D1 | How bidders fund a bid: OutLayer wallet and payment check, or deposit to an address | Payment check | Spike S2: create, claim and reclaim a check with tiny amounts; test the signup friction |
| D2 | How the bid is encrypted to the enclave | Public key published by the enclave, bid sealed with a standard sealed-box scheme | Spike S1: read OutLayer docs on secrets and key derivation |
| D3 | Settlement custody: claim whole checks then refund, or claim only the amounts owed | Claim whole checks, then refund (simpler, deterministic) | Spike S2 and design review |
| D4 | Where launch state and ciphertexts live | A small hosted database | Pick the simplest (a managed Postgres or key-value store) |
| D5 | How the token is created | Standard NEP-141 contract from the NEAR standards, deployed to a fresh account | Spike S4 |
| D6 | Tie-breaking at the clearing price | Pro-rata, with verifiable randomness for rounding dust | Spike S1 (OutLayer VRF) |
| D7 | Whether to reveal losing bids after settlement | Reveal aggregate order book only | Decide with the team in week 1 |
| D8 | Next.js version specifics | Follow the project's `AGENTS.md`: read the guide in `node_modules/next/dist/docs/` before writing code | Do this first |

## 3. Folder layout (inside `snipe-proof-meme-launch/`)

```
snipe-proof-meme-launch/
  src/
    app/                       Next.js pages and server routes
      page.tsx                 Landing
      launches/new/            Create a launch
      launches/[id]/           Launch page, bid, results
      verify/                  Verification page
      compare/                 First-come versus sealed-bid view
      api/                     Server routes (launches, bids, settle)
    lib/
      auction-core/            TypeScript reference auction + tests
      outlayer/                Client for payment checks and enclave calls
      near/                    Token helpers, storage deposits, reads
      crypto/                  Sealing bids to the enclave key
  enclave/                     Rust crate compiled to WebAssembly
  contracts/                   Optional launch contract (Option 2)
  test-vectors/                JSON cases shared by TypeScript and Rust
  scripts/                     Spikes and end-to-end rehearsal scripts
  .env.example                 Variable names only, never values
```

## 4. Phases

### Phase 0: prepare
| # | Task | Done when |
|---|---|---|
| S1 | Read OutLayer docs end to end: how to deploy WASM, how secrets and key derivation work, how to verify an attestation, VRF, fees and limits | A one-page note answers each, with links |
| S2 | Payment checks with tiny amounts: create, peek, claim part, reclaim, early reclaim, expiry | Written results, including what happens when a bidder reclaims before settlement |
| S3 | Register an OutLayer wallet for the auction account; fund with a few dollars of USDC | Account works; keys stored outside the repo |
| S4 | Find the standard NEP-141 contract and the storage deposit flow; test a transfer to a fresh account | A note with exact steps |
| S5 | Confirm Node, Rust and WASM toolchain versions on the team's machines | Everyone can build a hello-world WASM |
| S6 | List organizer questions (what counts as new work, can a TEE service count, anything on fund use) and send them | Answers recorded |
| S7 | Create the public repo and the empty issue list from this plan | Repo exists; phases are issues |

### Phase 1: reference auction and simulator
| # | Task | Done when |
|---|---|---|
| 1.1 | Read the Next.js guide named in `AGENTS.md` | Notes on anything that differs from what we know |
| 1.2 | Implement `auction-core` in TypeScript: sort, fill, clearing price, pro-rata, reserve, refunds | Passes the invariants in section 5 |
| 1.3 | Write `test-vectors/` JSON: 20+ cases including ties, undersubscription, single bid, all equal | Vectors reviewed by a second person |
| 1.4 | Build the comparison view: same bids in a first-come launch and the sealed-bid launch | Visibly shows a bot winning in one and not the other |
| 1.5 | Build create-launch and launch pages against local state | Works with fake data |

### Phase 2: the enclave
| # | Task | Done when |
|---|---|---|
| 2.1 | Port the auction to Rust; load `test-vectors/` | Rust passes every vector that TypeScript passes, with identical output |
| 2.2 | Compile to WebAssembly and run it in OutLayer with a hello-world input | A response with an attestation |
| 2.3 | Implement bid decryption and input validation inside the enclave | Rejects malformed or replayed bids |
| 2.4 | Return `{ result, codeHash, inputHash }` and publish the input hash before settlement | Verify page can recompute the hashes |
| 2.5 | Verify the attestation in code | A script that returns pass or fail on a real attestation |

### Phase 3: money and token
| # | Task | Done when |
|---|---|---|
| 3.1 | Bid flow: create the check, seal the bid, submit | A bid appears in the count without revealing amounts |
| 3.2 | Settlement: claim checks, run the auction, refund unused amounts, send proceeds | Funds in equals funds out in a tiny rehearsal |
| 3.3 | Token distribution with storage deposits for each recipient | Winners receive tokens |
| 3.4 | Failure handling from section 6 | Each failure has a test |
| 3.5 | Rehearsal on mainnet with a few dollars and three accounts | Results page matches on-chain transfers |

### Phase 4: polish
| # | Task | Done when |
|---|---|---|
| 4.1 | Verify page that anyone can follow | A person who did not build it can verify a launch |
| 4.2 | Error states and empty states throughout | No dead ends |
| 4.3 | Accessibility and mobile pass | Core flows work on a phone |
| 4.4 | README with setup, how to verify, and the limitations | A stranger can run the simulator |

### Phase 5: ship
| # | Task | Done when |
|---|---|---|
| 5.1 | Final real launch, recorded | A clean run on mainnet |
| 5.2 | Demo video and screenshots; post on X saying it was built at NEAR HACKATHON | Post link saved |
| 5.3 | Fill in the submission form (see section 9) | Submitted before the deadline, with time to spare |
| 5.4 | Freeze `main`; tag the release | Tag exists |

## 5. Tests

### Invariants for the auction (property tests, run in both TypeScript and Rust)
- Total tokens sold never exceeds the supply.
- Every winner pays the same clearing price per token.
- No winner pays more than their limit price.
- Total proceeds equal the clearing price times tokens sold.
- Conservation: for every bidder, locked = paid + refunded.
- Order independence: shuffling the bid list gives the same result (ties resolved by the seed).
- Monotonic: raising a limit price never makes a bid worse off.
- Below-reserve bids never win; an empty or undersubscribed launch behaves as configured.

### Other layers
| Layer | What | How |
|---|---|---|
| Unit | Encoding, hashing, storage deposits | Test runner in the Next.js project |
| Cross-implementation | TypeScript versus Rust | Shared `test-vectors/` |
| Failure injection | Bidder reclaims early, enclave times out, token transfer fails | Scripted in `scripts/` |
| End to end | Create, bid, settle, verify in the browser | Playwright against the simulator |
| Mainnet rehearsal | Real tiny launch | Checklist in section 7 |

## 6. Failure modes

| Failure | Handling |
|---|---|
| A bidder reclaims their check before settlement | Their bid is dropped when the enclave sees the check is empty |
| No bids | Launch ends; supply stays with the creator |
| Undersubscribed | Clearing price is the reserve; unsold supply follows the creator's choice |
| Enclave unavailable at close | Retry; if it cannot settle by a stated deadline, every bidder reclaims their own check |
| Token transfer to a winner fails | Hold that winner's tokens, retry, and show it on the result page |
| Duplicate or replayed bid | The enclave accepts one bid per bidder per launch |
| Bid for the wrong launch | The sealed bid includes the launch id and is rejected otherwise |

## 7. Mainnet rehearsal checklist
- Dedicated accounts and a few dollars only.
- Three bidders, one of whom withdraws early.
- Confirm refunds, proceeds and token balances after settlement.
- Confirm the verify page matches the chain.
- Record the run.

## 8. Security checklist
- No private keys or API keys in the repo, the browser or logs.
- Enclave code is public so its hash can be matched to the source.
- Bids are sealed in the browser; the server only ever stores ciphertext.
- Rate limits on bid submission; cap the size of a bid payload.
- Document the trust assumption: fairness depends on the attestation and the enclave code, and the operator never sees plaintext bids.
- Keep the smallest amount in any hot account.

## 9. Submission checklist
Fields from the hackathon form:
- Project name, team lead, email, team size
- Tracks: **11 Memecoins With Mechanics, 3 Privacy & Private AI, 4 Autonomous Business, 1 Unstoppable DeFi**
- NEAR wallet address (where a prize would be sent)
- Public repository link
- Demo post link (the X post)
- "What did you build?" (20–2,000 characters): the problem, what was built, and how NEAR fits

## 10. Roles
Frontend: done on demo data, then wires the real calls. Backend/core, enclave, payments and token: see the owner lists in [`team-handoff.md`](team-handoff.md). Suggested split: one person on the enclave and auction core, one on the app and verify page, one on the token, money flows and the demo.

## 11. Risks and open questions

| Risk or question | Why it matters | Resolve by |
|---|---|---|
| How to verify an OutLayer attestation | The whole fairness claim rests on it | End of Phase 0 |
| OutLayer fees and limits are unknown | Could affect cost per launch | End of Phase 0 |
| Early reclaim by bidders | Could disturb settlement | S2 |
| Whether enclave code can read many encrypted bids at once | Affects the design of the call | S1 |
| Organizer view on pre-existing work and a TEE service | Eligibility | S6 |
| Legal view of token launches | Keep it a prototype and say so | Ongoing |

## 12. Definition of done
- A real launch on mainnet settles fairly and the result page verifies.
- The tests in section 5 pass in both languages.
- A stranger can follow the verify guide.
- The repo is public, the demo post is up and the form is submitted.
