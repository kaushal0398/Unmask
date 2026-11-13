# Community treasury

**Status: contract written and unit-tested (11 tests). Not deployed. Not linked to the auction contract.**

`contracts/treasury` is a NEAR contract (near-sdk 5) that holds native NEAR and enforces, on-chain:

| Rule | Where |
|---|---|
| Allocation policy (category -> bps, must sum to 10 000) is fixed at `new`, no setter | `new` |
| A category can never spend more than its share of everything deposited (spent + pending + new request) | `propose`, `category_status` |
| Only listed signers propose / approve / execute; only the proposer cancels | `signer()` |
| `threshold` distinct approvals needed | `execute` |
| Timelock from proposal time | `execute` |
| One execution per proposal | `status` |

Every payout logs `EVENT payout id= category= to= amount=`.

## Not implemented
Fungible-token proceeds (only attached NEAR), community votes, automatic funding from an auction settlement, an AI guardian.
Today a signer deposits (or anyone does) by calling `deposit`. Nothing moves auction proceeds here automatically.

## Test, build, deploy
```sh
cd contracts/treasury && cargo test
cargo near build non-reproducible-wasm          # needs cargo-near
near deploy <account>.testnet target/near/snipe_proof_treasury.wasm
near call <account>.testnet new '{"signers":["a.testnet","b.testnet"],"threshold":2,"timelock_ns":"3600000000000","policy":[["development",4000],["liquidity",2000],["grants",2000],["community",1000],["reserve",1000]]}' --accountId a.testnet
```
Then set `NEXT_PUBLIC_TREASURY_CONTRACT=<account>.testnet` and rebuild the frontend. `/treasury` reads state from RPC; with no variable it shows nothing instead of example data.
