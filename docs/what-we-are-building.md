# Snipe-Proof Meme Launch: what we are building

**One line:** a memecoin launch where everyone bids in secret, everyone pays the same price, and anyone can check afterwards that the auction was run fairly.

## 1. The problem

On most launchpads the first buyers win. Bots watch for a launch, buy in the first blocks, bundle many wallets, and sell into the people who arrive later. Ordinary buyers pay a worse price and the creator's community starts with insiders already holding the supply.

The core issue is **timing and visibility**: the price moves as people buy, so being first (or seeing others' orders) is an advantage. Remove both and the advantage goes away.

## 2. What we are building

A fair-launch tool with three parts:

- **A sealed-bid auction.** During a bidding window each buyer submits a bid privately: how much they would pay at most per token, and how much they want. Nobody, including the creator, sees the bids until the window closes.
- **One clearing price.** When the window closes, a private auctioneer running in a hardware enclave (a TEE) sorts the bids and finds the single price that sells the supply. Every winner pays that same price, not their own limit.
- **A public proof.** The enclave's code hash, the result and the allocations are published with an attestation, so anyone can check that the published code ran on the sealed bids and produced the published result.

## 3. How a launch runs, step by step

1. **Create.** The creator sets the token (name, symbol, total supply for sale), a reserve (minimum) price, the bidding window, and an optional per-account cap.
2. **Open.** The launch page shows a countdown and only the *number* of bids, never amounts.
3. **Bid.** A buyer chooses a limit price and a quantity, locks the maximum they could owe in an OutLayer payment check, and submits the bid encrypted so that only the enclave can read it.
4. **Close.** At the deadline no more bids are accepted.
5. **Settle.** The enclave locks the funds, runs the auction, pays out tokens to winners, returns every unused amount to its bidder, and sends proceeds to the creator.
6. **Verify.** The result page lets anyone check the code hash, the attestation and the on-chain transfers against the published result.

## 4. The auction rule (uniform-price, sealed-bid)

- Sort bids by limit price, highest first.
- Fill bids in that order until the supply is sold.
- The **clearing price** is the limit price of the last bid that gets filled (at least partly). If demand at or above the reserve price is less than the supply, the clearing price is the reserve price and the unsold tokens go back to the creator or are burned, as the creator chose up front.
- Every winner pays the clearing price for what they receive. Bids at the clearing price are filled pro-rata when there isn't enough supply for all of them; rounding leftovers are assigned using verifiable randomness.
- A bid below the clearing price wins nothing and is refunded in full.

### Worked example

Supply for sale: 1,000,000 tokens. Reserve price: $0.01.

| Bidder | Limit price | Wants | Result |
|---|---|---|---|
| A | $0.05 | 400,000 | Filled |
| B | $0.04 | 300,000 | Filled |
| C | $0.03 | 300,000 | Filled (last one filled) |
| D | $0.02 | 200,000 | Nothing, refunded in full |

Cumulative demand at C's limit reaches 1,000,000, so the **clearing price is $0.03**. A pays 400,000 × $0.03 = $12,000 (not $0.05), B pays $9,000, C pays $9,000. Proceeds are $30,000. Arriving first or last changes nothing, and nobody could see the order book while bidding.

## 5. What is private and what is public

| When | Visible to the public | Visible to the enclave only |
|---|---|---|
| During bidding | Launch parameters, the number of bids | Every bid (price, quantity, bidder) |
| After settlement | Clearing price, each winner's allocation, total raised, code hash, attestation | Nothing further is needed. Whether losing bids are revealed afterwards is a design choice. |

The enclave sees the bids, so the privacy guarantee is that **the operator and everyone else cannot see or change them**, which rests on the attestation and on the enclave code being public.

## 6. How money is handled

- Each bidder creates an **OutLayer payment check** for the most they could owe. The funds sit in a per-check account and no gas is needed.
- At close, the enclave claims the checks it needs and settles. Anything a bidder does not owe goes back to them.
- A bidder can still reclaim their own check early. That only removes their own bid, and the enclave checks balances at close so a withdrawn bid is simply dropped.

Open question: whether the enclave should claim whole checks and refund, or claim only the amounts owed. See `plan.md`, decision D3.

## 7. Who is involved

| Actor | Role |
|---|---|
| Creator | Sets the launch parameters and receives the proceeds |
| Bidder | Places a sealed bid and receives tokens or a refund |
| Auctioneer enclave | Runs the auction inside the TEE and signs the result |
| Token contract | A standard NEP-141 token holding the supply for sale |
| Anyone | Verifies the result and the attestation |

## 8. What it is not

- It does not stop wealthy buyers from buying a lot, or one person from using many wallets. It removes the timing and visibility advantage, not the wealth advantage.
- It does not promise price, liquidity or returns.
- It is not legal advice. Token launches can be regulated in some places.

## 9. Tracks we are entering

- **11 Memecoins With Mechanics:** the fair-launch auction is the mechanic.
- **3 Privacy & Private AI:** bids stay sealed inside a TEE until the close.
- **4 Autonomous Business:** the launch runs by itself, with the creator setting only the constraints.
- **1 Unstoppable DeFi:** a batch auction settled on NEAR, with cross-chain funding possible through NEAR Intents.

## 10. NEAR products used

| Product | What it does here |
|---|---|
| **OutLayer** | Runs the auctioneer (Rust compiled to WebAssembly) in a TEE with an attestation; payment checks lock bids; verifiable randomness settles ties |
| **NEP-141** | The token being launched |
| **NEAR Intents** | Optional: lets buyers fund bids from other chains |

## 11. Limitations to be honest about

- OutLayer is a third-party service. Its documentation did not spell out how to verify an attestation, so that is the first thing to confirm.
- Enclave code must be Rust compiled to WebAssembly.
- Fees and limits for OutLayer were not stated in the pages I read.
- During settlement the enclave controls the locked funds, so the fairness claim depends on the attestation.
- Recipients of a NEP-141 token need a storage deposit registered, which the settlement has to handle.

## 12. What success looks like

- A real launch, with small amounts, on mainnet.
- A public page showing the clearing price and a verification that anyone can follow.
- A comparison view that shows the same bids in a first-come launch (where a bot wins) and in the sealed-bid launch (where it does not).
