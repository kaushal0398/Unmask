# Auction Result Certificate

Page: `/launches/[id]/certificate`. Shows the published result, code/input/output hashes, the algorithm, TEE status and the on-chain anchor.

## Result anchor (implemented, testnet)
After a launch settles, the backend calls `anchor` on the registry contract (`contracts/registry`) and stores the transaction hash with the result.

- Registry contract: `951abbe83dfc47adeb94652495d612008c215c422cbaa002238449f086eaa755` (testnet), deployed in tx `9sEKNmqz2wjdsw4QNPyg5h5mZqS7UmbV2iqxnoUX9YMN`
- Only the writer account `cd45f96e0ceaa523cb8038555aef39db40b4deb1b958dc8b352a4cd43da68047` can anchor; one anchor per launch id, never overwritten.
- Records: launch id, input hash, output hash, engine code hash, clearing price, mode, block height and time.
- Wiring test (not a real launch): tx `Cc5YMtMH81s4ztoD3kpBtY9w8cxvhmytXEH9zpBoZL4Z` for launch id `wiring-test-1`.
- The certificate reads the anchor back from the contract and says whether it matches the published result.

**What it proves:** the writer published exactly these hashes for this launch at that block, and they cannot change.
**What it does not prove:** that the auction ran correctly, that it ran in a TEE, or that tokens or funds moved. Token and refund transfers are still plan-only.

## Turn it on
Set on the backend service: `ANCHOR_CONTRACT`, `ANCHOR_ACCOUNT_ID`, `ANCHOR_PRIVATE_KEY` (secret; from `~/.near-credentials/implicit/<writer>.json` on the machine that created it). Without all three the certificate says "Not anchored on-chain". A failed anchor never undoes a settlement; it is logged and the certificate shows no transaction.

## Still not implemented
Real TEE attestation (shown as "not verified"); proof the config was fixed before bidding; real token/refund transfers.
