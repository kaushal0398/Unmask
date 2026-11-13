# Remaining work (as of 13 Nov 2026, hackathon deadline 14 Nov 23:59 UTC)

Built and pushed: bid redirect to receipt, Result Certificate, Launch Risk Passport (4 checks), treasury contract + `/treasury` page, market card with demand curve.
None of the new pages has been opened in a browser or tested against a live backend.

## P0: Deployment (blocks any live demo)
Owner: needs Neon and Vercel access. Full detail in [`vercel-fix.md`](vercel-fix.md). Never paste database URLs or passwords into chat or the repo.

- [ ] Create a hosted PostgreSQL (Neon) with a **new** password; keep a direct URL and a pooled URL.
- [ ] `cd backend && npx prisma migrate deploy` with the **direct** URL.
- [ ] Backend service env (Preview + Production): `DATABASE_URL` (pooled, secret), `NEAR_RPC_URL=https://rpc.testnet.near.org`, `NEAR_NETWORK=testnet`, `DEV_ENCLAVE_SEED` (`openssl rand -hex 32`, secret, never change).
- [ ] Delete `HOST`, `PORT`, `NODE_ENV`, `NEXT_PUBLIC_API_MODE`, `TEST_NEAR_ACCOUNT` from Vercel.
- [ ] Redeploy; check `/api/backend/health` then `/api/backend/v1/launches`.
- [ ] Then set `NEXT_PUBLIC_API_URL=/api/backend` and redeploy the frontend.
- [ ] Seed demo launches: `npm run seed:demo -- --creator YOU.testnet --open-minutes 1440`.
- [ ] Verify sign-in, create launch, bid (lands on `/my-bids/<receiptId>`), settle.
- [ ] **Settle cannot run on Vercel** (Rust engine is a child process). Host `backend/Dockerfile` on Render/Railway/Fly, keep the frontend on Vercel, set `NEXT_PUBLIC_API_URL` to that host and `CORS_ORIGINS` to the Vercel origin. Check with `npm run demo:preflight`.
- [ ] Keep the local database as backup until the hosted one works.

## P1: Launch Risk Passport (`/launches/[id]/passport`)
Done: reserve, per-account cap, code hash, token contract checks (from the launch record).
- [ ] Mint / pause / freeze authority: no standard on-chain way to list privileged methods; stays "unknown" (needs source or audit)
- [x] Upgrade authority via access keys (live RPC)
- [x] Supply match and creator-wallet share via NEP-141 views. [ ] Full holder distribution needs an indexer
- [x] Creator account existence and balance. [ ] Transaction history needs an indexer
- [ ] Liquidity setup and lock: no pool is created by this product yet, stays "unknown"
- [ ] AI explanations **after** evidence collection, labelled as AI interpretation, never as a fact
- [ ] Keep heuristics (wallet clustering) visibly separate from verified facts

## P1: Result Certificate (`/launches/[id]/certificate`)
Done: result, code/input/output hashes, algorithm name, honest TEE status.
- [x] Result commitment anchored on NEAR by a registry contract; hash shown and checked on the certificate (see `FAIRNESS_CERTIFICATE.md`). Needs `ANCHOR_*` set on the backend. Token/refund transfers are still plan-only.
- [ ] Real TEE attestation verification (see `OUTLAYER_ATTESTATION.md`); only then show "TEE verified"
- [ ] Show that the auction config was fixed before bidding (e.g. publish a config hash at launch creation)

## P2: Treasury
Done: contract (`contracts/treasury`, 11 tests), `/treasury` page, `TREASURY_POLICY.md`.
- [x] Deployed to testnet (see `TREASURY_POLICY.md` for address and transactions)
- [x] `/treasury` defaults to the deployed address (the env var can override it)
- [x] Allowed and rejected requests run on testnet
- [ ] Execute request 0 after its 1 hour timelock
- [ ] Not implemented: fungible-token proceeds, governance votes, automatic funding from settlement, AI guardian

## Market card
Done: market cap at reserve and clearing, demand curve after settlement.
- [ ] Price-over-time chart needs a trading pool (e.g. Rhea) and a pool price read from RPC. Do not fake price history.

## Docs (from the strategy doc, Appendix B)
- [ ] `ARCHITECTURE.md`, `SECURITY_PASSPORT.md`, `FAIRNESS_CERTIFICATE.md`, `DEMO_SCRIPT.md`; each must separate implemented from planned
- [ ] Label anything still mock or development-only in the demo

## Deferred (do not claim)
Agent marketplace, ZK participation credentials, cross-chain bid funding, milestone escrow, trading agents, prediction markets.

## Honest claims checklist for the demo
- Payment provider and enclave are development mocks unless proven otherwise; no real funds move.
- No TEE claim without a verified attestation.
- Passport is not a security audit; unrun checks say "unknown".
- Treasury is contract-enforced only if the deployed contract is the one shown.
