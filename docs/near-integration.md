# How we use OutLayer, payment checks, NEP-141 and NEAR Intents

One page on how the four pieces fit together in a launch. It describes the design and what the OutLayer documentation says. **None of it is integrated yet**: the interface shows the flow on demo data, and `protocols-integrated.md` tracks the status of each piece.

## The idea in one paragraph

Buyers lock money for a sealed bid. At the close, an auctioneer running in a hardware enclave (OutLayer) opens the bids, finds one clearing price, sends tokens (a NEP-141) to the winners, and sends back everything not owed. The money a buyer locks lives in an OutLayer payment check, which is held on the NEAR Intents contract, so a buyer can fund a bid from another chain. Anyone can check afterwards that the published code ran on the sealed bids.

```
 buyer's wallet
     │  1. fund the intents balance (any chain, via NEAR Intents)
     ▼
 intents.near balance ──2. payment-check/create──▶ per-check account on intents.near   (locked, no gas)
     │
     │  3. sealed bid (encrypted to the enclave's public key) ──▶ the app's API stores the ciphertext
     ▼
 ───────────────────────────── bidding closes ─────────────────────────────
     │
     ▼
 OutLayer enclave (Rust → WebAssembly, Intel TDX)
     4. decrypt bids · 5. claim the checks · 6. run the auction · 7. pay out and refund · 8. sign the result
     │
     ├──▶ NEP-141 token: ft_transfer to each winner (after storage_deposit)
     ├──▶ intents balance: unused amounts back to each bidder, proceeds to the creator
     └──▶ published: result, code hash, input hash, attestation ──▶ the verify page
```

## 1. OutLayer TEE: the auctioneer

**What it is.** OutLayer runs Rust compiled to WebAssembly (WASI) inside an Intel TDX enclave. The binary is hosted on GitHub; OutLayer compiles and caches it. It can be triggered from a NEAR contract (yield and resume) or over HTTPS, and secrets are decrypted only inside the enclave. Each result carries an attestation covering the code hash, the input hash and the output.

**What we use it for.**

| Job | How |
|---|---|
| Keep bids secret | Each bid is sealed to a public key the enclave publishes. Only the enclave can decrypt it. The app, the creator and other bidders see ciphertext. |
| Run the auction | The auction rule (`src/lib/auction.ts`, the reference) is ported to Rust and compiled to WebAssembly. The enclave runs it at the close. |
| Settle | After the auction the enclave claims the payment checks, pays winners, refunds the rest and pays the creator. |
| Break ties fairly | Bids at the clearing price share what is left pro-rata. Rounding leftovers (a handful of tokens) are assigned with OutLayer's verifiable randomness. |
| Prove it | The result is published with the code hash, the input hash and the attestation. The verify page recomputes them. |

**What the interface does today.** The verify page hashes the revealed bids with SHA-256 and re-runs the auction rule in the browser, for real. The attestation check is a demo stand-in.

## 2. OutLayer payment checks: locking and refunding bids

**What they are.** A payment check is a pot of funds set aside by the sender. `POST /wallet/v1/payment-check/create` (Bearer `wk_…`) takes a `token`, an `amount`, an optional `memo` and `expires_in`, and returns a `check_id` and a `check_key`. The funds move from the sender's intents balance into a per-check account on `intents.near`, with **no gas**. `/peek` shows the balance and status. `/claim` can take a **partial** amount. `/reclaim` is creator-only. `/batch-create` makes up to ten at once. Expiry blocks new claims but does not return the funds.

**How a bid uses one.**

1. The buyer picks a limit price and a quantity and locks `limit × quantity`, the most they could owe, in a check.
2. The check's key is sent to the enclave inside the encrypted bid, so only the enclave can claim it.
3. At the close the enclave claims the checks it needs. Everything beyond what a winner owes (the clearing price × what they got) goes back, and a loser gets all of it back.
4. A buyer can still `reclaim` their own check early. That only cancels their own bid: the enclave checks balances at the close and drops a bid whose check is empty.

**Decisions still open.** D1: payment check versus a plain deposit address (default: payment check). D3: claim **whole** checks then refund (simple and deterministic; default) or claim only the amounts owed. The first means the enclave controls the funds during settlement, which is why the attestation matters.

**What the interface does today.** The bid form shows what you would lock, seals the bid with a real SHA-256 commitment, and lets you withdraw. Nothing is sent.

## 3. NEP-141: the token being launched

**What it is.** The standard NEAR fungible token. A recipient must have a **storage deposit** registered with the token (`storage_deposit`) before it can receive any, and transfers use `ft_transfer` with 1 yoctoNEAR attached.

**How we use it.**

| Step | What happens |
|---|---|
| Create | The creator's launch deploys a standard NEP-141 contract on a fresh account (D5) and mints the supply for sale to the launch's account. |
| Distribute | At settlement, for each winner: register their storage deposit if they have none, then `ft_transfer` their allocation. The settlement pays that deposit, since a buyer's tokens must not fail to arrive for lack of it. |
| Failure | If a transfer to one winner fails, hold that winner's tokens, retry, and show it on the result page. One failure must not block the others or the refunds. |
| Unsold | If demand falls short of the supply, the unsold tokens go back to the creator or are burned, as the creator chose when creating the launch. |

The money side is also NEP-141: bids and proceeds are in a stablecoin such as USDC (a NEP-141 on NEAR), which is what the payment check's `token` names. Which stablecoin is a decision to confirm.

**What the interface does today.** The create form takes the token name, symbol and supply and shows a preview. Nothing is deployed.

## 4. NEAR Intents: funding a bid from anywhere

**What it is.** The cross-chain layer NEAR's payment checks sit on: balances live on `intents.near`, and deposits and swaps from other chains are available through it (the Agent API documents deposit addresses).

**How we use it.**

- A payment check is funded **from the sender's intents balance**, so the contract our bids live on is `intents.near`. Using payment checks already means using the intents balance.
- **Optional, after the core works:** a buyer on another chain deposits through NEAR Intents (or swaps into the bid token), lands the funds in their intents balance, and bids from there. The auction does not change; only where the money comes from does.
- Refunds and proceeds are paid back to intents balances, from which a user can withdraw to another chain.

**What the interface does today.** Nothing: this is the optional extension. The create and bid screens do not mention other chains yet.

## What we do not know yet

| Question | Why it matters |
|---|---|
| How to verify an OutLayer attestation | The fairness claim rests on it; the page we read did not give the steps |
| OutLayer's fees and limits, for compute and for payment checks | Cost per launch |
| What an early `reclaim` leaves behind | Could disturb settlement if the enclave cannot tell |
| Whether the enclave can take a large batch of encrypted bids in one call | Shapes how settlement is called |
| Which stablecoin, and how the creator is paid | Fixes the bid token |
| Whether a third-party TEE service is acceptable to the organizers | Eligibility |

## Where each piece shows up in the code

| Piece | Today | Planned |
|---|---|---|
| Auction rule | `src/lib/auction.ts`, tested | `enclave/` (Rust), checked against shared test vectors |
| Payment checks | the bid form's lock and withdraw, as a demo | `src/lib/outlayer/` |
| NEP-141 | the create form's token fields, as a demo | `src/lib/near/` (deploy, storage deposits, transfers) |
| NEAR Intents | not shown | optional funding path |
| Verification | `src/lib/verify-demo.ts`: real hashing and a real re-run, demo attestation | the real attestation check |
