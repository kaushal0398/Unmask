# Improvements and additions

Ideas to make Unmask stronger, based on a look at nearly.trade and NEAR Intents. Written 9 Nov 2026; submission is 14 Nov 23:59 UTC.

> **Source note.** The nearly.trade product list below comes from an announcement pasted by the team. We could not find nearly.trade's own pages, so its details are unverified. The NEAR Intents facts come from the official docs linked at the end.

## What NEAR Intents is

- A user or agent states the outcome they want. Solvers (market makers) compete to fill it. A Verifier contract on NEAR settles the trade atomically.
- The **1Click API** is the simple integration path: request a quote, get a deposit address, send funds there. If the swap does not complete, funds return to the refund address.
- There is **no testnet**. Real tests use tiny mainnet amounts.
- Without a JWT token the API takes a 0.1% fee. Chain support changes often, so check the docs before building.

## nearly.trade: five products

| Product | One line |
|---|---|
| Keys | Private trading, public PnL |
| Swarm | Onchain jobs for competing AI agents |
| Wiki | Token knowledge powered by prediction markets |
| Checkout | Cross-chain payments, anywhere |
| Agents | AI traders operating within your signed rules |

## How each maps to Unmask

| nearly.trade | Closeness | What it suggests for us |
|---|---|---|
| Keys | Very close: private while it matters, provable afterwards | A public, verifiable result card per bidder: paid, got, refunded, effective price |
| Checkout | Closest to integrate: our README already lists funding from other chains | Fund a bid from any chain or token through 1Click, and choose where refunds and tokens land |
| Agents | Close: fits the Autonomous Business track and our bots-versus-fair story | A rules-bound agent that places sealed bids inside limits its owner signed, shown beside the bots in the race |
| Swarm | Loose: competing bidders is the same shape | A demo where several agents bid in one auction. Stretch goal |
| Wiki | Weak | Skip |

## What to add, in priority order

| # | Feature | Why | Needs the team? | Status |
|---|---|---|---|---|
| 1 | Fund a bid from any chain (1Click deposit address into the payment check) | Real NEAR Intents use, a strong demo, matches the story | A mainnet key and a few dollars for the final test. The typed client and UI can be built without them | Not started |
| 2 | Choose where refunds and tokens go (cross-chain payout) | Winners and losers are not stuck on NEAR. Reuses #1 | Same as #1 | Not started |
| 3 | Agent bidder with signed rules (max price, max quantity, expiry) | Shows the Autonomous Business track and makes the race demo more convincing | No, can be built locally | Not started |
| 4 | Public per-bidder result and PnL card | Keys-style transparency on top of the settlement result we already store | No | Not started |
| 5 | Explorer links for every on-chain step | Makes "check everything" literal | Only after real transfers exist | Not started |

Recommended order: **#1 and #3 first**, then #4 if time remains.

## Further polish that makes the product feel better

- A "pay from any chain" button on the bid form, with the quote, fee and refund address visible before the user confirms.
- A "my launches" and "my bids" view with public result cards that can be shared as an image (the social preview images already exist).
- A live status strip on a launch page: window open, closing, settling, settled, with a link to each proof.
- Empty, loading and failure states for every network call, since real calls will fail sometimes.

## Caveats

- **Do not claim an integration that has not run.** Say "NEAR Intents integration" only after a real 1Click quote or swap has happened. A typed client with no live call is a stand-in and the README must say so.
- 1Click has no testnet, so every end-to-end test spends real (small) money. Keep amounts tiny and keys out of the repository.
- Check chain support and fees in the official docs before choosing which chains to offer.
- Time is short: about five days remain, and the real enclave, real payment checks and the token are still open ([`team-handoff.md`](team-handoff.md)). Do not let this list displace them.

## Sources

- [NEAR Intents overview](https://docs.near.org/chain-abstraction/intents/overview)
- [What are intents](https://docs.near-intents.org/getting-started/what-are-intents)
- [1Click API](https://docs.near-intents.org/near-intents/1click-api)
- [Distribution channels introduction](https://docs.near-intents.org/integration/distribution-channels/introduction)
