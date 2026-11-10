# Auction specification, version 1

The exact rule Unmask uses to turn sealed bids into one price and one set of allocations. Written 10 Nov 2026. It describes what the code does today and what the tests check; it does not promise anything the code does not do.

Three implementations follow this document and must agree on every input:

| Implementation | Where | Used for |
|---|---|---|
| TypeScript (`bigint`) | `src/lib/auction-core.ts` | The reference, the browser's verify page, the tests |
| Rust | `enclave/auction-engine/src/lib.rs` | Settlement, and the WASM that goes to OutLayer |
| Rust as WASM | `snipe-proof-auction/build.sh` | The exact bytes an enclave would run |

[`auction-core-v1.md`](auction-core-v1.md) is the shorter original note. This file is the full specification.

## 1. What kind of auction

A **sealed-bid, uniform-price** auction for a fixed supply.

1. Every buyer submits one bid: the most they will pay per token (a **limit price**) and how many tokens they want (a **quantity**).
2. Bids are hidden until the window closes.
3. One **clearing price** is found. **Every winner pays that price**, not their own limit.
4. Bids with a limit below the clearing price win nothing and are refunded in full.

Arriving first or last changes nothing. Only the price and the quantity matter.

## 2. Units and encoding

| Field | Meaning | Encoding |
|---|---|---|
| `supply`, `quantity` | Launched-token **atomic** units | Unsigned integer string |
| `limitPrice`, `reservePrice` | Payment-token atomic units **per one whole launched token** | Unsigned integer string |
| `tokenDecimals` | Decimals of the launched token, 0 to 24 | Integer |
| Payments, locks, refunds | Payment-token atomic units | Unsigned integer string |

- Every number is a **canonical base-10 string**: digits only, no sign, no exponent, no leading zero (`"0"` is the only number that starts with 0). `"01"`, `"1e3"` and `-5` are rejected. No JSON number is ever used for money.
- Arithmetic is exact integers. The TypeScript uses `bigint`. The Rust uses `u128` with **256-bit intermediates** (a product like `limit × quantity` can exceed 128 bits at 24 decimals; the Rust computes it exactly and only fails if the final result does not fit in 128 bits).
- The same result in the same order is required of all three implementations. The Rust engine is tested against the TypeScript on 212 shared cases (see section 8).

## 3. Input

```json
{
  "version": "1",
  "auctionId": "string, 1 to 128 chars",
  "supply": "1000000",
  "reservePrice": "10000",
  "tokenDecimals": 0,
  "bids": [
    { "id": "A", "bidder": "ana.near", "limitPrice": "50000", "quantity": "400000" }
  ]
}
```

### Validation: what is rejected

An invalid input produces an **error and no result**. Nothing is partly accepted.

| Rule | Error text (from the engine) |
|---|---|
| `version` is not `"1"` | `unsupported auction core version` |
| `auctionId` empty or over 128 chars | `auctionId is required and must be <= 128 chars` |
| `supply` or `reservePrice` is zero or not canonical | `supply must be greater than zero` / `… canonical unsigned integer string` |
| `tokenDecimals` not an integer from 0 to 24 | `tokenDecimals must be an integer from 0 to 24` |
| More than 10,000 bids | `bids cannot exceed 10000` |
| A bid `id` or `bidder` empty or over 128 chars | `bids[i].id is required and must be <= 128 chars` |
| Two bids share an `id` | `duplicate bid id: X` |
| A `limitPrice` or `quantity` is zero or not canonical | `bids[i].limitPrice must be …` |
| A result that does not fit in 128 bits | `amount overflow` |

**The engine does not limit a bidder to one bid.** It only needs unique bid ids. One bid per account per launch is enforced by the backend (a database constraint on launch and bidder). An empty bid list is valid.

## 4. The algorithm

Let `scale = 10^tokenDecimals`, and let `⌈a / b⌉` mean rounding up.

1. **Eligible bids.** A bid is eligible if `limitPrice ≥ reservePrice`. Bids below the reserve stay in the output with zero allocation.
2. **Order.** Sort eligible bids by `limitPrice` descending, ties by `id` ascending (byte order).
3. **Clearing price.**
   - If total eligible demand `<` `supply`: the price is `reservePrice`, and every eligible bid is filled in full. The rest of the supply is unsold.
   - Otherwise walk the sorted list adding quantities. The price is the `limitPrice` of the first bid at which the running total reaches `supply`.
4. **Bids above the price.** Every bid with `limitPrice` strictly above the clearing price is filled in full.
5. **Bids at the price (the marginal tier).** Let `pot` be the supply left after step 4, capped at the tier's total demand. Bids at exactly the clearing price share `pot` **pro-rata, in whole tokens**:
   - each gets `⌊pot × quantity ÷ tierDemand⌋`;
   - the tokens left over from rounding (the **crumbs**) go **one each to the bids with the largest remainder**, and equal remainders go to the **lowest bid `id`**.
6. **Money.** For each bid:
   - `locked = ⌈limitPrice × quantity ÷ scale⌉` (the most it could owe)
   - `payment = ⌈clearingPrice × filled ÷ scale⌉`
   - `refund = locked − payment`
7. **Totals.** `sold = Σ filled`, `unsold = supply − sold`, `totalRaised = Σ payment`, `totalLocked = Σ locked`, `totalRefunded = Σ refund`.

Money is rounded **up** so a bid is never under-locked and the seller is never short by a fraction of a unit.

### Output

```json
{
  "version": "1", "auctionId": "…", "tokenDecimals": 0,
  "clearingPrice": "30000", "supply": "1000000", "sold": "1000000", "unsold": "0",
  "totalRaised": "…", "totalLocked": "…", "totalRefunded": "…",
  "fills": [
    { "bidId": "A", "bidder": "ana.near", "limitPrice": "50000", "requested": "400000",
      "filled": "400000", "locked": "…", "payment": "…", "refund": "…" }
  ]
}
```

`fills` has one entry per input bid **in the input order**. All amounts are strings.

## 5. Policy decisions

These are choices the rule makes. Each is stated so it can be argued with, not hidden.

| Decision | What v1 does | Why, and the catch |
|---|---|---|
| Price when demand is below supply | The **reserve price**; everyone eligible is filled | It is the lowest price the seller accepted. The seller is left with unsold tokens |
| Price when demand is above supply | The limit of the bid that makes the running total reach the supply | The highest price at which the whole supply sells |
| Partial fills | **Allowed**, only at the marginal price | A bid at the margin may get fewer tokens than it asked for |
| Ties at the clearing price | Pro-rata, crumbs by largest remainder, then lowest `id` | Deterministic and checkable. **It is not random**, and a bidder who chose their `id` could favour themselves. In the backend the `id` is a database-generated id, not chosen by the bidder |
| One bid per bidder | Not the engine's job: the backend enforces it | Keeps the engine simple |
| Bids below the reserve | Not filled, fully refunded | |
| Cancelling or changing a bid | Not part of the rule. The backend decides when a bid can be withdrawn | The engine only sees the bids it is given |

A later version can replace the tie rule with verifiable randomness. That needs a new `version`, a bound seed and new shared vectors on all three implementations.

## 6. Guarantees

For every valid input, the output satisfies all of these. Each is checked by randomized tests (section 8).

| # | Guarantee |
|---|---|
| 1 | `sold ≤ supply`, and `unsold = supply − sold` |
| 2 | If eligible demand `≥` supply, `sold = supply`; otherwise `sold =` all eligible demand |
| 3 | The clearing price is never below the reserve |
| 4 | No bid gets more than it asked for |
| 5 | A bid below the reserve gets nothing |
| 6 | A bid that gets anything has `limitPrice ≥ clearingPrice` |
| 7 | A bid with `limitPrice >` the clearing price is filled **in full** |
| 8 | Every payment is `⌈clearingPrice × filled ÷ scale⌉`: **one unit price for everyone** |
| 9 | No bid pays more than it locked, or more than its own limit would have cost |
| 10 | `totalLocked = totalRaised + totalRefunded`, to the last unit |
| 11 | At the marginal price each bid gets its rounded-down share or one more, and the extra tokens go to the largest remainders, then the lowest `id` |
| 12 | The result does not depend on the order the bids arrive in |
| 13 | The same input always gives the same output |
| 14 | Raising one bid's limit never reduces what that bid wins |

Guarantee 14, together with guarantees 8 and 9 (you pay the clearing price, never your own limit), is what supports bidding your true maximum, which is what the agent bidder does. It is a reason to expect that plan to be sound, not a proof that it is the best strategy.

## 7. Worked examples

All numbers below were produced by running the engine.

**A. The README example.** Supply 1,000,000, reserve $0.01, prices at 6 decimals.

| Bid | Limit | Wants | Filled |
|---|---|---|---|
| A | $0.05 | 400,000 | 400,000 |
| B | $0.04 | 300,000 | 300,000 |
| C | $0.03 | 300,000 | 300,000 (the last one) |
| D | $0.02 | 200,000 | 0 |

The price is **$0.03**. A pays $12,000 (not $0.05 × 400,000 = $20,000) and gets $8,000 back. Raised: $30,000.

**B. A tie.** Supply 10, reserve 1, no decimals. Three bids at price 3 for 5 tokens each (ids `A`, `B`, `C`).

Demand at the price is 15 and the pot is 10, so each share is `⌊10 × 5 ÷ 15⌋ = 3` with remainder 5. That is 9 tokens, leaving 1 crumb. The remainders are all equal, so the lowest id wins it: **A gets 4, B gets 3, C gets 3**. Everyone pays 3 per token: 12, 9 and 9, raising 30.

**C. Demand below supply.** Supply 100, reserve 10. A: 30 at 20. B: 40 at 15. C: 50 at 5 (below the reserve).

Eligible demand is 70, under the supply, so the price is the **reserve, 10**. A and B are filled in full and pay 300 and 400. C gets nothing and its 250 is refunded. Sold 70, **unsold 30**, raised 700.

**D. Rounding up.** 6 token decimals, one bid for 1 atomic token at a limit of 7 per whole token. The cost is `7 × 1 ÷ 1,000,000 = 0.000007` payment units, which rounds **up to 1**. Locked 1, paid 1, refunded 0.

## 8. How it is verified

| What | Where | Size |
|---|---|---|
| Hand-picked cases: the README example, below reserve, no bids, a whale, ties, 6 and 24 decimals, 25 distinct prices | `shared/test-vectors/auction-v1-cases.json` | 12 cases |
| Seeded random auctions, small numbers so ties and rounding are constant | `shared/test-vectors/auction-v1-random.json` (generated by `scripts/gen-test-vectors.ts`, seed 20261110) | 200 cases |
| TypeScript reproduces every case | `src/lib/shared-vectors.test.ts` | |
| Rust reproduces every case | `enclave/auction-engine/tests/shared_vectors.rs`, `properties.rs` | |
| The WASM artifact reproduces every case under Wasmtime | `python3 scripts/check-wasm-vectors.py` | 212 of 212 |
| Guarantees 1 to 13 on random auctions, in both languages (14 in TypeScript only) | `src/lib/auction-properties.test.ts`, `enclave/auction-engine/tests/properties.rs` | TypeScript: 3,000 auctions, plus 1,000 for order, plus 1,500 for guarantee 14. Rust: 3,000, plus 1,000 for order |
| A product larger than 128 bits | `tests/shared_vectors.rs` | |

The property tests were checked by breaking the rule on purpose. Four deliberate bugs are each caught: handing the rounding crumbs to the wrong bids, rounding payments down, charging winners their own limit, and ignoring the reserve. (A fifth change, breaking ties by input order, cannot be caught because the bids are already in id order.)

## 9. Known limits

- **Ties are deterministic, not random.** See section 5.
- **Ids compare by byte order in Rust and by UTF-16 code unit in TypeScript.** These agree for ASCII ids and for the characters in the Basic Multilingual Plane the backend produces. They could differ for ids containing characters outside it. Keep ids ASCII.
- **The engine does not know who is real.** It does not check that a bid was funded, that a wallet signed it or that a bidder is one person. The backend does the first two (see [`settlement-dev.md`](settlement-dev.md)); nothing does the third. A buyer can still split money across wallets.
- **Reading a bid is outside the rule.** Whether anyone could see a bid early depends on the enclave, which is a development stand-in today.
- **Not independently reviewed.** The properties are tested; the economics have not been audited. Do not use it for real funds without a review.
