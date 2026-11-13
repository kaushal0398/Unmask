# Community treasury

**Status: unit-tested (11 tests) and deployed on NEAR testnet. Not linked to the auction contract.**

- Contract: `68172a040ac2233dc945dea305ce4a49746f7433274ed82103358bdb0959f035` (testnet, implicit account)
- Signers: that account plus `a30e8b2a0193f387c13a813fb7bff4e684c5f29475d0eab82b63a6db089945d3` and `24141688f3cfad82d2dad9344611a906dd885828c33babdd095e52253277b157`; 2 of 3 approvals; 1 hour timelock
- Policy: development 40%, liquidity 20%, grants 20%, community 10%, reserve 10%
- Deploy + init tx: `7v8mFaotKxcaA5QihzaS1BVjZjyrYo2tQzybBgZH4EXo`
- Deposit of 1 NEAR: `2FLjXQSGntbrDQwE5o5rVxU4LEQX644VCighhWCoxFfP`
- Allowed request (development, 0.3 NEAR, id 0): `5dBCALywSLqfGcYySXKiJLJE8u8GbmAzTkAFKkaXM358`, approved by a second signer: `CtSaEZATFiVsjVYjbVrhXLftKgXVSBHjthc7W26od7oA`
- Rejected on-chain: reserve request over its cap `EsPnnAbBRfFeXEuH9ro4HDXhFyWapzgbgsKbJ1kWoV21`, unknown category `9hFsdCCGAT1mcREexRrcTeVEKUXNgevzTiweM7CTyn7e`, execute before the timelock `3U6EsoC9KUsvEpyrKHnBj9AriHs9jSpHgoCJYhf4GdA8`
- The on-chain failure shows as a generic `unreachable` trap, not the revert text; the reasons are asserted in the unit tests.
- Request 0 can be executed once the timelock has passed (1 hour after its proposal). It had not been executed when this was written.

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
