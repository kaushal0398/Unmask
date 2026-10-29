# Decisions and open questions

## Decisions

| ID | Decision | Default | Status | Resolve by |
|---|---|---|---|---|
| D1 | How bidders fund a bid: OutLayer wallet and payment check, or a deposit to an address | Payment check | Open | Phase 0 spike on payment checks |
| D2 | How a bid is encrypted to the enclave | The enclave publishes a public key; bids are sealed to it with a standard sealed-box scheme | Open | Phase 0, after reading OutLayer's secrets docs |
| D3 | Settlement custody: claim whole checks then refund, or claim only the amounts owed | Claim whole, then refund (simpler and deterministic) | Open | Phase 0 spike and design review |
| D4 | Where launch state and ciphertexts live | A small hosted database | Open | 1 Nov |
| D5 | How the token is created | The standard NEP-141 contract on a fresh account | Open | Phase 0 |
| D6 | Ties at the clearing price | Pro-rata, with verifiable randomness for rounding leftovers | Open | Phase 0 |
| D7 | Whether to reveal losing bids after settlement | Reveal only the aggregate order book | Open | Team decision, week 1 |
| D8 | Orchestration: the app's API, or a NEAR contract | The app's API for the first version; a contract if time allows | Open | 1 Nov |

## Open questions

| Question | Why it matters | Who | By |
|---|---|---|---|
| How is an OutLayer attestation verified? | The fairness claim rests on it | To assign | End of Phase 0 |
| What are OutLayer's fees and limits? | Cost per launch | To assign | End of Phase 0 |
| What happens when a bidder reclaims a check early? | Could disturb settlement | To assign | End of Phase 0 |
| Can the enclave take many encrypted bids in one call? | Shapes the settle call | To assign | End of Phase 0 |
| What counts as new work for the hackathon, given the scaffold was created on 28 Oct? | Eligibility | Organizers | Before 1 Nov |
| Is a TEE service from a third party acceptable? | Eligibility | Organizers | Before 1 Nov |
| Any limit on using real funds in the demo? | Safety | Organizers | Before 1 Nov |

## Decided so far
- The project is a sealed-bid, uniform-price launch.
- Tracks: 11, 3, 4 and 1.
- The first version is orchestrated by the app's API.
- Nothing may be built before 1 Nov except research and design.
