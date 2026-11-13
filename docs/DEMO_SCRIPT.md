# Demo script

Do not claim anything below as live unless the matching check passes on the day. Say "development" where it applies.

## Before recording
- [ ] Backend deployed and `/api/backend/health` is OK (see `vercel-fix.md`); Settle works (needs the Docker backend host).
- [ ] `ANCHOR_CONTRACT`, `ANCHOR_ACCOUNT_ID`, `ANCHOR_PRIVATE_KEY` set so the certificate shows a transaction.
- [ ] A launch with a real deployed testnet token exists, so the passport's on-chain checks have something to read.
- [ ] Wallet connected with a funded testnet account.

## Story
"A creator wants to raise funds without asking participants to trust a hidden allocation process."

1. **Create a launch** (`/launches/new`): token, supply, reserve, cap, window.
2. **Passport** (`/launches/[id]/passport`): show verified facts with evidence, then point at the "unknown" rows and say they are not claimed.
3. **Bid** from the launch page. Show it redirecting to the receipt page, and the private reveal file. Say: bids are sealed in the browser; in development the backend can still read them.
4. **Settle** after the window closes: one clearing price for everyone; show the Market card's demand curve and market cap.
5. **Certificate** (`/launches/[id]/certificate`): hashes, algorithm, the on-chain anchor link and its "matches" line. Say plainly: "TEE attestation: not verified", and "token and refund transfers are planned, not sent".
6. **Treasury** (`/treasury`): policy shares and caps read from the contract. Show the transactions in `TREASURY_POLICY.md`: an allowed request, requests the contract rejected, and an execute refused by the timelock.

## What to say, and what not to
- Say: private auction, uniform price, evidence-backed passport, result anchored on NEAR, contract-enforced treasury rules.
- Do not say: "TEE-verified", "audited", "funds are locked/moved", "private from the operator".
- Dev mocks to name: payment provider, enclave key, plan-only payouts.
