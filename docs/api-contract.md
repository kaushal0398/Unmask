# The interface the core must provide

The frontend talks to the core only through `LaunchApi` in [`src/lib/api/types.ts`](../src/lib/api/types.ts). Today it is
answered by an in-memory stand-in ([`src/lib/api/mock.ts`](../src/lib/api/mock.ts)). To go live, write a client with the
same shape and return it from `getApi()` in [`src/lib/api/index.ts`](../src/lib/api/index.ts). No screen changes.

## Calls

| Call | What it does | Fails with |
|---|---|---|
| `listLaunches()` / `getLaunch(id)` | Public data only: rules, status, close time, **bid count**. Never a bid. | |
| `getResult(id)` | The published result, or `null` until the launch has settled. | |
| `getEnclaveKey(launchId)` | The enclave's public key for this launch, with a reference to its attestation. Browsers seal bids to it. | |
| `createPaymentCheck({launchId, amount})` | Lock funds for one bid. Resolves once `locked`. Returns the check and the **claim key** (goes inside the sealed bid, never to us). | `payment_failed` |
| `getPaymentCheck(id)` | Current state: `creating`, `locked`, `failed`, `expired`, `reclaimed`, `claimed`. | |
| `reclaimPaymentCheck(id)` | Take the funds back. Valid while `locked` or `expired`. | `payment_failed`, `not_found` |
| `submitBid(sealedBid)` | Accept a sealed bid. Returns a receipt id. | `closed`, `bid_rejected`, `not_found` |
| `withdrawBid(launchId, bidder)` | Cancel before the close and reclaim the check. | `closed`, `not_found` |
| `createLaunch(input, onStep, {resumeFrom})` | Five steps, reported one by one; see below. | `CreateStepError(step)` |
| `positions(account)` | The signed-in buyer's bids and where each one's money is. | |

## The sealed bid

The browser builds this and the core never sees the amounts:

- `ciphertext`: base64 of a libsodium **sealed box** (`crypto_box_seal`) over a JSON `BidPlaintext`
  `{launchId, bidder, limit, qty, paymentCheck: {id, key}, salt}`, to the enclave's public key (X25519, 32 bytes, hex).
- `commitment`: SHA-256 (hex) of `JSON.stringify([launchId, bidder, limit, qty, paymentCheckId, salt])`. The claim key is
  deliberately left out. The buyer keeps the salt to prove the bid was theirs.
- `paymentCheckId`, `keyId`.

The core must reject a bid whose `ciphertext` is readable JSON, whose commitment is not a SHA-256, whose check is not
`locked`, or a second bid from the same account.

## Creating a launch

Steps, in order: `deploy-token`, `mint-supply`, `register-launch`, `publish-code`, `open-bids`. Report progress through
`onStep` after every change. If a step fails, throw `CreateStepError(stepId, message)`. The UI offers "Retry from this step"
and calls again with `resumeFrom`, so steps already done must not be repeated.

## Things the core has to get right (they show on screen)

- An `expired` payment check does **not** return funds. The UI says so and offers Reclaim.
- `getResult` must carry the code hash, input hash, result hash and attestation quote the verify page shows.
- `totalBids` may exceed `allocations.length` only in the demo. In the real thing, decision D7 settles what is revealed.
