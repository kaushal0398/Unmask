# Sealed: snipe-proof token launches

> A token launch where everyone bids in secret, everyone pays the same price, and anyone can check afterwards that the auction was run fairly. Built on NEAR.

| | |
|---|---|
| **Status** | Interface built on demo data. Auction rule written and tested. Enclave, payment checks and token not built yet: **nothing here moves real funds.** |
| **Hackathon** | NEAR Hackathon, development 1–14 Nov 2026, submission by 14 Nov 23:59 UTC |
| **Tracks** | 11 Memecoins With Mechanics · 3 Privacy & Private AI · 4 Autonomous Business · 1 Unstoppable DeFi |
| **Stack** | Next.js 16 · React 19 · TypeScript · Tailwind CSS 4 · Rust → WebAssembly (planned) |

## Contents

[The problem](#the-problem) · [The idea](#the-idea) · [How a launch runs](#how-a-launch-runs) · [The auction rule](#the-auction-rule) · [What is real today](#what-is-real-today) · [The interface](#the-interface) · [Architecture](#architecture) · [NEAR protocols](#near-protocols) · [Getting started](#getting-started) · [Project structure](#project-structure) · [Documentation](#documentation) · [Roadmap](#roadmap) · [Limitations](#limitations)

## The problem

On most launchpads the first buyers win. Bots watch for a launch, buy in the first blocks, bundle wallets and sell into the people who arrive later. The advantage comes from **timing and visibility**: the price moves as people buy, so being first, or seeing other people's orders, pays.

## The idea

Take both advantages away.

- **Sealed.** Buyers submit bids during a window, and nobody (the creator included) can read them until it closes. The public sees only how many bids there are.
- **One price.** When the window closes, a private auctioneer running in a hardware enclave (a TEE) finds the single price that sells the supply. Every winner pays it, not their own limit. Everyone else is refunded in full.
- **Provable.** The enclave publishes its code hash, the result and an attestation. Anyone can recompute the hashes, re-run the rule on the bids and check the transfers.

Arriving first or last changes nothing, so being fast stops being worth anything.

## How a launch runs

1. **Create.** The creator sets the token, the supply for sale, a reserve price, the bidding window and an optional cap per account. These are fixed from then on.
2. **Bid.** A buyer chooses a limit price and a quantity, locks the most they could owe in an OutLayer payment check, and submits the bid encrypted to the enclave.
3. **Close.** No more bids are accepted. The public still sees only a count.
4. **Settle.** The enclave opens the bids, finds the clearing price, sends tokens to winners, returns every unused amount and pays the creator.
5. **Verify.** The code hash, the input hash, the attestation and the on-chain transfers are checked against the published result.

## The auction rule

Uniform-price, sealed-bid. Sort bids by limit price, highest first, and fill them until the supply is sold. The **clearing price** is the limit of the last bid filled, even partly, or the reserve price if demand falls short of the supply. Every winner pays the clearing price. Bids at that price share what is left pro-rata, in whole tokens, with verifiable randomness for the rounding crumbs. A bid below the clearing price wins nothing and is refunded.

Example: 1,000,000 tokens for sale, reserve $0.01.

| Bidder | Limit price | Wants | Result |
|---|---|---|---|
| A | $0.05 | 400,000 | Filled |
| B | $0.04 | 300,000 | Filled |
| C | $0.03 | 300,000 | Filled (the last one) |
| D | $0.02 | 200,000 | Nothing, refunded in full |

The clearing price is **$0.03**. A pays $12,000 (not $0.05), B pays $9,000, C pays $9,000, and the creator receives $30,000. The rule is implemented in [`src/lib/auction.ts`](src/lib/auction.ts) and this example is one of its tests.

## What is real today

| Piece | State |
|---|---|
| The interface: every screen below, the animations and the drawings | Built |
| The auction rule (uniform price, pro-rata at the price, whole-token rounding) | Built, 17 tests |
| Hashing and re-running the auction on the verify page | Built, runs in your browser |
| Launches, bids and results on screen | **Demo data** |
| The attestation check | **Demo stand-in** |
| The enclave that runs the auction | Not built |
| OutLayer payment checks and real funds | Not built |
| The NEP-141 token and payouts | Not built |

## The interface

Pure black, square boxes, violet for *sealed*, green for *verified*, red for a bot or a failed check. Every screen runs on demo data and says so.

| Route | What it is |
|---|---|
| `/` | Landing: the sealed-envelope hero, the bots-versus-sealed race, live meme cards, how it works, a clearing demo |
| `/launches` | Every launch, with stats and a filter |
| `/launches/[id]` | One launch in one of three states: bidding open (countdown, sealed stack, bid form), settling, or settled (clearing price, opened bids, proof hashes) |
| `/launches/new` | Create a launch, with a live preview |
| `/verify` | Five checks redone in the browser, with a "pretend someone cheated" switch |
| `/how-it-works` | The six steps, the rule with a worked example computed live, a glossary |
| `/compare` | The race, plus dials for how many bots are in the room and what they will pay |
| `/portfolio` | My bids: one open, one won, one lost, for a demo wallet |
| `/creators` | What a creator sets and gets |
| `/faq`, `/limits` | Short answers, and what this does not do |

## Architecture

```
 Browser (Next.js)
   create / bid / results / verify
        |
        v
 Next.js server routes  ---->  Store (launches, encrypted bids, results)
        |
        v
 OutLayer enclave (Rust -> WebAssembly, Intel TDX)
   decrypts bids, claims payment checks, runs the auction, signs the result
        |
        v
 NEAR: NEP-141 token | OutLayer payment checks | intents.near
```

## NEAR protocols

| Protocol | Role | Status |
|---|---|---|
| OutLayer (TEE) | Runs the auctioneer as Rust compiled to WebAssembly, with an attestation | Researched |
| OutLayer payment checks | Lock each bid; refund what is not owed; gasless | Researched |
| OutLayer verifiable randomness | Rounding crumbs at the clearing price | Researched (briefly) |
| NEP-141 | The token being launched | Not started |
| NEAR Intents | The layer payment checks sit on; optional funding from other chains | Researched |

How the pieces fit together is in [`docs/near-integration.md`](docs/near-integration.md); the status of each is in [`docs/protocols-integrated.md`](docs/protocols-integrated.md). Nothing is integrated yet.

## Getting started

```sh
npm install
npm run dev          # http://localhost:3000
npm test             # the auction rule, the race and the verify checks
npm run typecheck
npm run lint
npm run build
```

Node.js 24 was used during development. This project's `AGENTS.md` asks you to read the guide in `node_modules/next/dist/docs/` before writing code, because this Next.js version has breaking changes. Two matter here: with Cache Components on, anything that depends on the clock lives in a client component, and a dynamic route's `params` is read inside a `Suspense` boundary.

## Project structure

```
src/
├── app/            Routes (see the table above), the theme (globals.css), the icon
├── components/     Nav, footer, cards, the race, the reveal chart, forms, the drawings (art.tsx)
└── lib/
    ├── auction.ts       The uniform-price sealed-bid rule
    ├── race.ts          The same bids as a first-come launch and a sealed one
    ├── verify-demo.ts   The checks the verify page runs
    └── demo.ts          Made-up launches and bids
docs/               Project documentation (below)
PLAN.md             The plan as one table
```

Planned:

```
src/lib/outlayer/       Payment checks and enclave calls
src/lib/near/           Token helpers and storage deposits
enclave/                Rust crate compiled to WebAssembly
test-vectors/           JSON cases shared by TypeScript and Rust
```

## Documentation

| File | What it covers |
|---|---|
| [`docs/what-we-are-building.md`](docs/what-we-are-building.md) | The product, the rule and a worked example |
| [`docs/near-integration.md`](docs/near-integration.md) | How OutLayer, payment checks, NEP-141 and NEAR Intents fit together |
| [`docs/plan.md`](docs/plan.md) | Scope, architecture, phases, tests and risks |
| [`docs/whats-done.md`](docs/whats-done.md) | What is finished and what is next |
| [`docs/protocols-integrated.md`](docs/protocols-integrated.md) | Each NEAR protocol and its status |
| [`docs/decisions-and-open-questions.md`](docs/decisions-and-open-questions.md) | Decisions to settle and open questions |
| [`docs/submission-checklist.md`](docs/submission-checklist.md) | What the hackathon form needs |

## Roadmap

| Phase | Dates | Goal |
|---|---|---|
| 0 Prepare | 28–31 Oct | Read the OutLayer docs, test payment checks with tiny amounts, answer open questions |
| 1 Reference auction | 1–3 Nov | The auction in TypeScript with shared test vectors, and the first-come versus sealed comparison. *The rule and the comparison are built; the shared vectors are not.* |
| 2 Enclave | 4–7 Nov | The same auction in Rust and WebAssembly inside OutLayer, with a verified attestation |
| 3 Money and token | 7–10 Nov | Bid flow, settlement, token distribution, a mainnet rehearsal |
| 4 Polish | 10–12 Nov | The verify page against the real attestation, error states, README |
| 5 Ship | 12–14 Nov | Final launch, demo, submission |

## Limitations

- It removes the timing and visibility advantage, **not** the wealth advantage: a rich buyer can still buy a lot, or split across wallets.
- Fairness rests on the enclave's attestation and on the enclave code being public. How to verify an OutLayer attestation is not yet confirmed.
- Enclave code must be Rust compiled to WebAssembly. OutLayer's fees and limits are not yet known.
- It promises no price, liquidity or returns. Token launches can be regulated in some places. This is a prototype.

## Team

To be added.

## License

To be decided.
