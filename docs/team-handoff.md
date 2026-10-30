# Team handoff: what is done, what is not, who does what

Updated 30 Oct. Hackathon development 1–14 Nov 2026, submit by 14 Nov 23:59 UTC.

**One line:** the whole interface is built and tested on demo data. Everything that touches a chain, an enclave or real money is not built, and that is the teammates' part below. The two sides meet at one file: [`src/lib/api/types.ts`](../src/lib/api/types.ts) (see [`api-contract.md`](api-contract.md)).

## Done (frontend, on demo data)

| Area | State |
|---|---|
| All pages: landing, launches, launch, create, verify, compare, FAQ, limits, my bids, creators | Done, 375px phone width and accessibility checked |
| The auction rule in TypeScript (uniform price, pro-rata, whole-token rounding) | Done, unit tests |
| Data contract (`LaunchApi`) and an in-memory stand-in | Done, waiting for the core team to confirm the shapes |
| NEAR wallet sign-in (near-connect, signed message) | Done, **not tried on a live testnet wallet yet** |
| Bids sealed in the browser (libsodium sealed box, SHA-256 commitment) | Done, against a **fake** enclave key |
| Bid flow with confirm dialogs, payment-check states (fund, lock, fail, expire, reclaim), withdraw | Done against the stand-in |
| Launch page follows open, closing, settling (five steps), settled | Done on a local clock |
| Create launch with five progress steps and retry from the failed step | Done against the stand-in |
| Verify page: recomputes hashes and re-runs the auction | Done on demo data |
| Toasts, loading, empty and error states, skip link | Done |
| Social preview images (site and per launch) | Done |
| Demo mode: `d` or `?demo=1` fast-forwards the clock and can force failures | Done |
| Tests: 43 unit, 16 Playwright (`npm test`, `npm run test:e2e`) | Passing |

## Not done, by owner

### Backend / core (API and settlement)
- [ ] Implement `LaunchApi` for real and return it from `getApi()` in `src/lib/api/index.ts`. No screen changes needed.
- [ ] Store launches, bid ciphertexts and results (D4, a small hosted database).
- [ ] Settlement run: claim the checks, call the enclave, refund the unused amounts, send proceeds.
- [ ] Failure handling from plan section 6, each with a test.
- [ ] Publish the input hash before settlement.
- [ ] Reject: readable (unsealed) ciphertext, bad commitment, a check that is not `locked`, a second bid from one account.
- [ ] Confirm or change the data shapes in `types.ts` (the first thing to do).

### Enclave / OutLayer (TEE)
- [ ] Read the OutLayer docs: WASM deploy, secrets and key derivation, randomness, fees and limits.
- [ ] Find out how to verify an attestation (not documented in what we read; the whole fairness claim rests on it).
- [ ] Rust port of the auction; it must match the TypeScript output on every shared vector (`test-vectors/` does not exist yet).
- [ ] Run it in OutLayer; decrypt bids inside the enclave; drop a bid whose payment check was reclaimed early.
- [ ] Return `{ result, codeHash, inputHash }` and the attestation quote in the format the verify page shows.
- [ ] Serve the real enclave public key through `getEnclaveKey()`. Replace the fake key in `src/lib/seal.ts`.

### Payments (OutLayer payment checks)
- [ ] Spike with tiny amounts: create, peek, partial claim, reclaim, early reclaim, expiry.
- [ ] Wire `createPaymentCheck`, `getPaymentCheck`, `reclaimPaymentCheck`. An `expired` check does not return funds; the UI already says so.
- [ ] Set up the OutLayer wallet with a few dollars of USDC; keys outside the repo.

### Token (NEP-141)
- [ ] Find the standard NEP-141 contract and the storage deposit flow.
- [ ] Real steps behind create launch: `deploy-token`, `mint-supply`, `register-launch`, `publish-code`, `open-bids`. Each must be safe to skip on a retry (`resumeFrom`).
- [ ] Send tokens to winners with a storage deposit for each recipient.
- [ ] Mainnet rehearsal with a few dollars and three accounts.

### Frontend (follow-ups once the core lands)
- [ ] Check the wallet flow on a real testnet wallet.
- [ ] Point the verify page at the real attestation.
- [ ] Switch the launch page from the local clock to the real status.
- [ ] Preview-image check: paste a link on X.

### Everyone
- [ ] Send the organizer questions ([`questions-for-organizers.md`](questions-for-organizers.md)) and keep the answer in writing.
- [ ] Make the repository public and deploy a hosted preview ([`deploy.md`](deploy.md)).
- [ ] Record the demo ([`demo-script.md`](demo-script.md)), post on X, fill in the submission form ([`submission-checklist.md`](submission-checklist.md)).

## Where the frontend meets the backend

| Frontend piece | Backend piece it waits for |
|---|---|
| `src/lib/api/mock.ts` | The real `LaunchApi` client |
| `src/lib/seal.ts` (fake key) | `getEnclaveKey()` and the enclave's key |
| `payment-check-panel.tsx` | OutLayer payment check calls |
| `create-form.tsx` (five steps) | NEP-141 deploy, mint and register |
| `verify-panel.tsx` | Real code hash, input hash and attestation |
| `live-launch.tsx` (local clock) | Real launch status |
