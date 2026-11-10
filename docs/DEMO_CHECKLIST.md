# Demo checklist

Tick these before showing or recording the demo. The full walkthrough is in [`DEMO_GUIDE.md`](DEMO_GUIDE.md). Written 10 Nov 2026.

## A. Pre-flight (do once, the day before)

| # | Check | Command or action | Expect | Done |
|---|---|---|---|---|
| 1 | Code is current and clean | `git pull && git status` | Up to date, nothing uncommitted you did not expect | [ ] |
| 2 | Frontend tests | `npm test` | All pass | [ ] |
| 3 | Backend tests | `cd backend && npm test` | All pass | [ ] |
| 4 | WASM matches TypeScript | `sh snipe-proof-auction/build.sh && python3 scripts/check-wasm-vectors.py` | `12/12 match the TypeScript rule` | [ ] |
| 5 | Production build | `npx next build` | `Compiled successfully` and all pages generated | [ ] |
| 6 | Backend env is set | `backend/.env` has `DATABASE_URL`, `NEAR_RPC_URL`, a fixed `DEV_ENCLAVE_SEED` | Backend starts | [ ] |
| 7 | Real settlement end to end | `cd backend && npm run e2e:settle` (backend and database running) | `e2e settle: all checks passed` and a real `intents:` line | [ ] |
| 8 | **Wallet sign-in works** (Plan A only) | Connect a real testnet wallet on the site | Your account shows in the nav, **not** "(demo)" | [ ] |
| 9 | Plan B rehearsed | Seed, open, run `settle:demo`, refresh | The result page appears | [ ] |
| 10 | Internet works for the funding quote | Press **Get a price** on the open launch | A quote with a cost and a time | [ ] |

Item 8 has never been done. If it fails, use Plan B and say the demo wallet is a stand-in.

## B. Just before you start (every time)

| # | Check | Done |
|---|---|---|
| 1 | Backend running: `curl localhost:4001/health` returns `ok` | [ ] |
| 2 | Frontend running at `http://localhost:3000` | [ ] |
| 3 | Seed a **fresh closed** launch: `npm run seed:demo -- --creator YOU.testnet --bidder YOU.testnet` | [ ] |
| 4 | Seed a **fresh open** launch: `npm run seed:demo -- --creator YOU.testnet --open-minutes 60` | [ ] |
| 5 | Both URLs are open in separate tabs, and the closed one shows "No more bids are accepted" | [ ] |
| 6 | The `settle:demo` command is typed in a terminal, ready, with the closed launch's id | [ ] |
| 7 | Browser is clean: no extensions, notifications off, zoom set | [ ] |
| 8 | Do not restart the backend now (a new `DEV_ENCLAVE_SEED` would break the seeded bids) | [ ] |

## C. What must be on screen, and the honesty lines

| Moment | Must show | Must say |
|---|---|---|
| Open launch | Countdown, sealed count | "All anyone sees is a count" |
| Agent mode | Rules summary with a hash | "unsigned" if the demo wallet, "signed by my wallet" only if it really is |
| Funding panel | A quote and `none: a preview, nothing to pay` | "price preview, nothing is paid" |
| Result | One price, allocations, **Bids left out**, the payout plan | "a plan, nothing is sent" |
| Evidence | `none (development enclave)` | "reproducible, not attested" |

## D. Never claim

- That the result is **attested**, **TEE-backed** or **private** from the backend.
- That a bid was **funded** from another chain, or any deposit taken.
- That a refund or token was **sent**.
- That anything runs on **OutLayer** until the remote run has actually succeeded.

## E. After

| # | Do | Done |
|---|---|---|
| 1 | Watch the recording once for any claim from section D | [ ] |
| 2 | Replace the links in the post draft in `demo-script.md` and post it yourself | [ ] |
| 3 | Update `MASTER_PLAN.md` (tasks F4 and F5) | [ ] |
