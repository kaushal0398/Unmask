# Fixing the Vercel deployment (11 Nov 2026)

Written for Kaushal's report. **Nothing here has been run on Vercel**: it is checked against the code and a local test only. Never paste database URLs or passwords into chat: the password in the report was exposed, so **change it at the database**, not only in Vercel.

## What was wrong, in order of importance

| # | Problem | Fix |
|---|---|---|
| 1 | `server.ts` opened a port (`app.listen`) and registered signal handlers. A Vercel function must **export** the app instead | **Fixed in code** (this commit): when `VERCEL` is set it skips `listen` and `export default app`. Local, Docker and any container host behave as before. Checked: `VERCEL=1` loads the module and answers `GET /health` with 200 without opening a port; backend tests 64/64 |
| 2 | `DATABASE_URL` points at `localhost` | Use a hosted PostgreSQL (below) |
| 3 | `DEV_ENCLAVE_SEED` is **not set** in Vercel | **Required.** Without it every cold start makes a new random enclave key, so a bid sealed on one instance cannot be opened on another. Make one with `openssl rand -hex 32` (or any 64 hex characters), set it once, never change it |
| 4 | `HOST=127.0.0.1`, `PORT=4001`, `NODE_ENV=development` are set in Vercel | Delete all three. Vercel manages the port. A custom `NODE_ENV` can also break the Next.js build |
| 5 | `NEXT_PUBLIC_API_MODE` and `TEST_NEAR_ACCOUNT` | Nothing reads them (checked with a search of the code). Delete them |
| 6 | `NEXT_PUBLIC_API_URL=http://127.0.0.1:4001` | On a deployed site this points at the visitor's own computer. Set it to `/api/backend` (same-origin through the rewrite) **after** step 4 below passes, then redeploy the frontend (public variables are baked in at build time) |
| 7 | Settlement cannot run on Vercel | See "What will not work on Vercel" |
| 8 | 24 Rust build files were tracked in git | Untracked in this commit (they were already in `.gitignore`) |

## Variables the backend really reads

`DATABASE_URL`, `NEAR_RPC_URL` (required), `NEAR_NETWORK`, `DEV_ENCLAVE_SEED`, `CORS_ORIGINS`, `ONECLICK_ALLOW_LIVE` (leave unset), `AUTH_CHALLENGE_TTL_SECONDS`, `AUTH_SESSION_TTL_SECONDS`, `AUCTION_ENGINE*`, `HOST`, `PORT`, `NODE_ENV`. Set `DATABASE_URL`, `NEAR_RPC_URL=https://rpc.testnet.near.org`, `NEAR_NETWORK=testnet` and `DEV_ENCLAVE_SEED` on the **backend service**, for Preview and Production, and mark `DATABASE_URL` and `DEV_ENCLAVE_SEED` as secrets.

## Database: do not restore the Windows dump

The local database only holds development data. It is simpler and safer to start the hosted one clean from the migrations:

1. Create a hosted PostgreSQL (Neon or similar) and a **new** password. Keep two URLs: a **direct** one (for migrations) and a **pooled** one (for the running function, ending in something like `?sslmode=require&pgbouncer=true&connect_timeout=15`; follow the provider's wording).
2. From `backend/` on your machine, with the **direct** URL in `DATABASE_URL` for that one command: `npx prisma migrate deploy`.
3. Put the **pooled** URL in Vercel as `DATABASE_URL`.
4. Seed the demo launches into the hosted database with the direct URL: `npm run seed:demo -- --creator YOU.testnet --open-minutes 1440` and again with `--bidder YOU.testnet` for a closed one.
5. Keep the Windows database untouched until everything works.

## Test it, in this order

```sh
vercel                                            # fresh Preview after the env changes
vercel curl /api/backend/health --deployment <PREVIEW_URL>        # expect {"ok":true,"service":"unmask-api","mode":"development"}
vercel curl /api/backend/v1/launches --deployment <PREVIEW_URL>   # expect {"launches":[...]}
vercel logs --deployment <PREVIEW_URL>            # right after the call; Hobby keeps ~30 minutes only
```

Use `/health` first: it needs no database and no body. If `/health` works and `/v1/launches` fails, it is the database URL. A 401 "Protected by Vercel Authentication" is deployment protection, not the app (`vercel curl` bypasses it). `POST /v1/auth/challenge` needs a JSON body: `{"accountId":"proofmeme.testnet"}`.

If `/api/backend/health` returns 404 but `/health` works on the backend service's own URL, the rewrite does not strip the `/api/backend` prefix. Then the simplest route is the second option below.

## What will not work on Vercel (and the better option)

The auction engine is a **Rust program** the backend starts as a child process (`enclave/auction-engine/target/release/auction-engine`, or WASM under `wasmtime`). A Vercel function deploys only the `backend/` folder and has neither. So on Vercel you can list launches, take sealed bids and show results, but **Settle will fail** (`engine` error). Signing in and bidding are fine.

For a demo where Settle must work, the better plan is the one in [`deploy.md`](deploy.md), which was built and run end to end on 10 Nov:

1. Backend: build `backend/Dockerfile` on a container host (Render, Railway, Fly), against the hosted PostgreSQL. It includes the Rust engine and runs migrations on start. Set `CORS_ORIGINS=https://unmasknear.vercel.app`, `DEV_ENCLAVE_SEED`, `NEAR_RPC_URL`, `NEAR_NETWORK=testnet`.
2. Frontend: Vercel only, **delete the `backend` service from `vercel.json`** (or use `{}`), and set `NEXT_PUBLIC_API_URL=https://<your backend host>`.
3. Check with `npm run demo:preflight -- --api https://<backend> --web https://unmasknear.vercel.app`: no FAIL lines.

A third option for recording the video only: run the backend on your own machine against the hosted database and use the deployed frontend with `NEXT_PUBLIC_API_URL` pointing at a tunnel. Not a deployment.
