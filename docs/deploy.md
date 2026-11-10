# Deploying

Rewritten 10 Nov 2026. **Nothing in this document has been deployed.** The production build passes (`npx next build`), and the container files have never been built, so treat every step as untried until you have done it once.

## What there is to deploy

| Part | What it needs | Where it can run |
|---|---|---|
| **Web app** (Next.js 16) | Node. A static-ish site that calls the backend from the visitor's browser | Vercel, or any Node host |
| **Backend** (Fastify) | Node, **PostgreSQL**, and the **Rust auction engine** binary (or the `.wasm` plus `wasmtime`) | A container host. **Not a Vercel function:** it needs a database and a native binary |
| **Database** | PostgreSQL 16 | Any managed Postgres |

The backend refuses to settle when `NODE_ENV=production` (the development enclave must not run as if it were the real one), so a hosted **demo** runs with `NODE_ENV` unset or `development`. Say that in the demo: it is a development deployment.

## Before anything else

1. Push to a **public** repository (required for submission, and it is your step). Run `sh scripts/scan-secrets.sh` first.
2. **`vercel.json` has been removed** (10 Nov). It routed `/api/backend` to a backend "service", but the web app calls the address in `NEXT_PUBLIC_API_URL` (default `http://127.0.0.1:4001`), which on Vercel would point at the visitor's own machine. Vercel detects Next.js without it. Set `NEXT_PUBLIC_API_URL` as below.

## 1. The backend

Container files are in the repository: `backend/Dockerfile` builds the engine and the backend, and `docker-compose.yml` runs the database, backend and web app together. **Tested on 10 Nov:** `docker compose up --build` builds both images, the stack starts, the backend migrates the database and runs the Rust engine, a seeded launch settles with the expected numbers, and `npm run demo:preflight` passes 12 of 12. Not tested: any hosting provider or HTTPS.

To try it locally: `docker compose up -d`, then seed with `DATABASE_URL=postgresql://postgres:postgres@localhost:54330/unmask` (see `DEMO_GUIDE.md`) and `docker compose down -v` to clear it.

Environment (see `backend/.env.example` for the full list):

| Variable | Value |
|---|---|
| `DATABASE_URL` | Your PostgreSQL URL |
| `NEAR_NETWORK` / `NEAR_RPC_URL` | `testnet` and `https://rpc.testnet.near.org` (**required**; the backend will not start without the RPC URL) |
| `DEV_ENCLAVE_SEED` | `openssl rand -hex 32`. **Set it once and keep it**: bids are sealed to this key, and changing it makes every stored bid unreadable |
| `HOST` | `0.0.0.0` in a container |
| `AUCTION_ENGINE_BIN` | Path to the built engine, or set `AUCTION_ENGINE_WASM` and install `wasmtime` |
| `CORS_ORIGINS` | Your deployed web app's origin (see below) |
| `ONECLICK_ALLOW_LIVE` | Leave unset. Quotes stay a preview |

**Set `CORS_ORIGINS` to your web app's address**, for example `CORS_ORIGINS=https://your-app.example.com` (comma separated for more than one). Until you do, the browser blocks a deployed web app from calling the backend: only `http://localhost:3000` and `http://127.0.0.1:3000` are allowed by default. Only exact origins are accepted; a wildcard is refused at startup, because the API takes a bearer token from the browser. Checked on 10 Nov against the running server.

Apply migrations with `npx prisma migrate deploy` before the first start (the Dockerfile does this on start).

## 2. The web app

1. Import the repository in Vercel (or any Node host). Build command `npm run build`. There is no `vercel.json`: Vercel detects Next.js.
2. Environment variables:

| Variable | Default | Meaning |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `http://127.0.0.1:4001` | **The address the visitor's browser uses to reach the backend.** It is baked in at build time, so set it before building |
| `NEXT_PUBLIC_NEAR_NETWORK` | `testnet` | `mainnet` or `testnet` for the wallet connector |
| `NEXT_PUBLIC_SITE_URL` | `http://localhost:3000` | Base URL for the social preview images |
| `NEXT_PUBLIC_FUNDING_RECIPIENT` | `intents.near` | The account the funding **preview** prices a delivery to. It must be a real mainnet account |

3. Open the deployed site and check, in this order:
   1. The home page loads and the launches list shows the sample launches. (With the backend unreachable it still shows them.)
   2. `GET <backend>/health` returns `{"ok":true,...}`, and the launches list now also shows any backend launches.
   3. Connect a real testnet wallet. **Wallet sign-in has never been tried live.**
   4. Seed and settle a demo launch (`DEMO_GUIDE.md`, using `DATABASE_URL` pointing at the hosted database).
4. Each launch has its own social image at `/launches/<id>/opengraph-image`.

## What a hosted demo is and is not

It is a **development deployment**: settlement uses the development enclave (not confidential, not attested), payment checks are stand-ins, and the funding quote is a price preview. The backend operator can read every bid ([`PRIVACY_THREAT_MODEL.md`](PRIVACY_THREAT_MODEL.md)). Say so on the page and in the video.

## Before recording

`npm run build && npm start` for the web app, and the three-terminal setup in [`DEMO_GUIDE.md`](DEMO_GUIDE.md) for the backend. `npx playwright test` runs the browser checks against the dev server on port 3000 (it stubs the backend, so it needs no database).

## For whoever deploys (quick path)

1. Backend on a container host with a managed PostgreSQL: build `backend/Dockerfile` (build context is the repo root), set `DATABASE_URL`, `NEAR_RPC_URL`, `DEV_ENCLAVE_SEED` (once, keep it), `CORS_ORIGINS=<web origin>`, and leave `NODE_ENV` unset. Check `GET /health`.
2. Web app: build `Dockerfile` with `--build-arg NEXT_PUBLIC_API_URL=<backend public URL>` (it is baked in at build time), or import the repo in Vercel and set `NEXT_PUBLIC_API_URL`.
3. Seed demo launches against the hosted database, then run `npm run demo:preflight -- --api <backend URL> --web <web URL>`. It must show no FAIL.
