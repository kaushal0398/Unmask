# Features inspired by nearly.trade, and how to check each one

Written 10 Nov 2026. One page: what we added, how real each part is, and the exact steps to check it yourself.

> **Source note.** nearly.trade's five products come from an announcement the team pasted: **Keys** (private trading, public PnL), **Swarm** (onchain jobs for competing AI agents), **Wiki** (token knowledge from prediction markets), **Checkout** (cross-chain payments) and **Agents** (AI traders inside your signed rules). We could not find nearly.trade's own pages, so we did not copy any of its features. We took the ideas and applied them to a sealed-bid launch. NEAR Intents facts come from its [official docs](https://docs.near-intents.org/near-intents/1click-api).

## The map

| nearly.trade idea | What we built | How real it is |
|---|---|---|
| **Agents**: AI traders inside your signed rules | **Agent bidding inside signed rules** | Rules, enforcement and signature check are tested. Signing with a live wallet has not been tried |
| **Keys**: private trading, public PnL | **Your result card**: paid, got, refunded, effective price, with an image | Built and tested. Reads the real settlement result |
| **Checkout**: cross-chain payments | **Pay a bid from another chain** (price preview) | A real price from the live NEAR Intents service. No deposit is taken |
| **Checkout**: pay out anywhere | **Choose where refunds and tokens go** | Sealed in the bid and shown as a plan. **Nothing is sent** |
| **Swarm**: competing agents | An agent bar beside the bots in the landing-page race | Sample data, but it runs the real auction rule |
| **Wiki**: prediction-market knowledge | Not built | Skipped on purpose: weak fit |

## The five-minute check

Everything here runs on your machine. The first three need nothing running.

| # | Command | Expect |
|---|---|---|
| 1 | `npm test` | all pass (116 on 10 Nov) |
| 2 | `cd backend && npm test` | all pass (50 on 10 Nov) |
| 3 | `python3 scripts/check-wasm-vectors.py` | `12/12 match the TypeScript rule` |
| 4 | `cd backend && npm run e2e:settle` | `e2e settle: all checks passed` and a line `intents: real dry quote: pay … USDC on Arbitrum …`. Needs PostgreSQL and the backend running |
| 5 | `npm run seed:demo` then open the printed page | the result page described below. See [`DEMO_GUIDE.md`](DEMO_GUIDE.md) |

---

## 1. Agent bidding inside signed rules

**What it does.** You set a maximum price, a maximum quantity, a maximum amount the bid can lock and an expiry, and sign them with your wallet (NEP-413). An agent places the sealed bid inside those limits. The agent bids its **maximum price**: in a uniform-price auction you pay the clearing price, never your own limit, so that cannot cost more than the rules allow. The same rules are checked **again when the launch settles**, so a bid that breaks them is left out.

**Where.** `src/lib/agent.ts`, `src/components/agent-mode.tsx`, `backend/src/agent-rules.ts`, `shared/test-vectors/agent-rules.json`.

**Check it.**

| How | Steps | Expect |
|---|---|---|
| Automated | `npx tsx --test src/lib/agent.test.ts src/lib/agent-sign.test.ts` | 11 rule cases (exactly at every limit, one tick over, a float trap, expired, several at once), the proposal logic, and the signing message |
| Automated, backend | `cd backend && npx tsx --test src/settlement-core.test.ts` | The same 11 cases on the backend, plus **a real NEP-413 signature verified**, and a **forged key**, a **restricted key**, **swapped rules** and a **tampered hash** all rejected |
| In the app | Open an **open** launch, tick "Let an agent place this bid inside rules I set", press "Set the rules" | A summary: rules, a rules hash, `not signed (demo wallet)`, and "The agent will bid $0.03 for 100,000 DEMO" |
| At settlement | `npm run seed:demo`, settle, open the result | `rogue-agent.testnet` appears under **Bids left out** with `agent bid breaks its rules: price_above_max`; `agent-owner.testnet` shows an **agent** badge |
| The race | Home page, press play | A cyan bar (`your-agent.near`) is served at the one price while the red bots win nothing |

**Not real.** The demo wallet cannot sign, so its rules are marked unsigned. A signature from a live wallet has not been tried. A bid with no signature is accepted but recorded `signed: false`.

## 2. Your result card

**What it does.** After a launch settles, your paid, got, refunded and effective price, what you saved against your own limit, with **Save as image** (a 1200x630 PNG) and **Copy summary**. Only public facts go in it, and the copied line does not include your account.

**Where.** `src/lib/result-card.ts`, `src/components/result-card.tsx`, `src/components/backend-result.tsx`.

**Check it.**

| How | Steps | Expect |
|---|---|---|
| Automated | `npx tsx --test src/lib/result-card.test.ts` | 8 tests: won, partly filled, priced out, no effective price when you got nothing, the account kept out of the text, XML-escaping, flat colours |
| In the app | `npm run seed:demo -- --creator <you> --bidder <you>`, settle, sign in as `<you>` | A **Your result** card: 300,000 DEMO, paid $9,000, refunded $3,000, effective price $0.03, saved $3,000 |

**Not real.** Needs a real signed-in account to show your card. The numbers come from the development enclave's result.

## 3. Pay a bid from another chain (NEAR Intents)

**What it does.** In the bid form, pick a token on Ethereum, Base, Arbitrum or Solana and see the real NEAR Intents price to deliver the USDC the bid needs: you pay, the minimum, the cost, the time.

**Where.** `src/lib/intents/oneclick.ts`, `src/components/fund-from-chain.tsx`, `backend/src/oneclick.ts` (the proxy). The field names come from the official OpenAPI spec and a **real response is saved as a test fixture**.

**Check it.**

| How | Steps | Expect |
|---|---|---|
| Automated | `npx tsx --test src/lib/intents/oneclick.test.ts` and `cd backend && npx tsx --test src/oneclick.test.ts` | Request shape, the real fixture, rounding up, error mapping; the proxy refuses live quotes, refuses any asset except USDC on NEAR, refuses bad deadlines, hides the API token |
| **Live call** (needs the backend running and internet) | `curl -s -X POST localhost:4001/v1/intents/quote -H 'Content-Type: application/json' -d '{"dry":true,"swapType":"EXACT_OUTPUT","slippageTolerance":100,"originAsset":"nep141:arb-0xaf88d065e77c8cc2239327c5edb3a432268e5831.omft.near","depositType":"ORIGIN_CHAIN","destinationAsset":"nep141:17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1","amount":"5000000","refundTo":"0x2527D02599Ba641c19FEa793cD0F167589a0f10D","refundType":"ORIGIN_CHAIN","recipient":"intents.near","recipientType":"DESTINATION_CHAIN","deadline":"'$(date -u -v+30M +%Y-%m-%dT%H:%M:%S.000Z)'"}'` (on Linux use `date -u -d '+30 min' +%Y-%m-%dT%H:%M:%S.000Z`) | JSON with `quote.amountIn` a little over `5000000` and **no** `depositAddress` |
| Refusal | Run the same with `"dry":false` | `403` and `live_disabled` |
| In the app | Open an **open** launch, expand **Pay from another chain**, keep Arbitrum USDC, enter an Arbitrum address (`0x2527D02599Ba641c19FEa793cD0F167589a0f10D` works), press **Get a price** | On 10 Nov: you pay 3,030.548226 USDC, the bid receives 3,000 USDC, cost $30.53, about 25 s, deposit address `none: a preview, nothing to pay` |

**Not real.** It is a **price preview** (a dry run). No deposit address exists and no funds move. A real deposit needs the operator to set `ONECLICK_ALLOW_LIVE=1`, and the payment checks that would receive the money are still a development stand-in. NEAR Intents is **mainnet only** (no testnet) and rejects a recipient that does not exist, so the preview prices a delivery to `intents.near`; set `NEXT_PUBLIC_FUNDING_RECIPIENT` to your own mainnet account before any live use.

## 4. Choose where refunds and tokens go

**What it does.** Send your USDC refund to any supported chain (NEAR, Ethereum, Base, Arbitrum, Solana) and your tokens to a NEAR account. The destinations are sealed inside the bid like the amounts. After settlement the public result shows a **plan**: who gets what, where, and which transfers would go through NEAR Intents.

**Where.** `src/components/payout-fields.tsx`, `src/lib/intents/addresses.ts`, `planPayouts` in `backend/src/settlement-core.ts`, `shared/test-vectors/addresses.json`.

**Check it.**

| How | Steps | Expect |
|---|---|---|
| Automated | `cd backend && npx tsx --test src/settlement-core.test.ts` | 13 address cases; a bad address skips the bid; tokens to another chain are refused; the plan marks cross-chain refunds `viaIntents` and defaults to the bidder's own NEAR account |
| In the app (form) | Open an **open** launch, tick "Send my refund and tokens somewhere else", choose Arbitrum, type `0x123` | A red error: `Refund address: not a 0x address with 40 hex characters.` A valid address clears it |
| In the app (result) | `npm run seed:demo`, settle, open the result, scroll to **Where the money and tokens go** | `dev.testnet` refund $4,000 to **Arbitrum 0x2527D025…a0f10D** with a **via NEAR Intents** badge; every other refund and all tokens stay on NEAR. Under **Bids left out**: `invalid payout destination (refundTo: not a 0x address with 40 hex characters)` |
| In the data | `GET /v1/launches/<id>/result` | `outcome.payouts` lists the plan and `outcome.payoutsExecuted` is `false` |

**Not real.** It is a plan. `payoutsExecuted` stays `false` until real payment checks and a deployed token exist. Tokens cannot go to other chains because a new launch token is not carried by NEAR Intents.

---

## What we can and cannot say

| We can say | We cannot say yet |
|---|---|
| An agent can only bid inside rules its owner set, and the check is repeated when the launch settles | That agents are signed with a live wallet (never tried) |
| You get a result card with your real numbers | That the result is attested or private (the enclave is a development stand-in) |
| Bids can be priced from another chain with NEAR Intents, with a real live quote | That a bid was **funded** from another chain, or that any deposit was taken |
| You choose where refunds and tokens go, and the result shows the plan | That any refund or token **was sent** anywhere |
| Settlement can run the same `.wasm` that goes to OutLayer | That it has run on OutLayer (the remote run is not retried yet) |

See [`settlement-dev.md`](settlement-dev.md) for what is real in settlement, [`improvements-and-additions.md`](improvements-and-additions.md) for the reasoning, and [`MASTER_PLAN.md`](MASTER_PLAN.md) for what is left.
