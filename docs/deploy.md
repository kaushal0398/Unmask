# Deploying

The app is a standard Next.js 16 site; nothing needs a server of its own while it runs on demo data.

1. Push to a public GitHub repository (required for submission; making it public is your step).
2. Import it in Vercel (or any Node host). Build command `npm run build`, output default.
3. Environment variables (all optional):

| Variable | Default | Meaning |
|---|---|---|
| `NEXT_PUBLIC_NEAR_NETWORK` | `testnet` | `mainnet` or `testnet` for the wallet connector |
| `NEXT_PUBLIC_SITE_URL` | `http://localhost:3000` | Base URL for social preview images |

4. Open the deployed site, connect a wallet once to confirm the real wallet flow works (it cannot be tested from this repository's tests).
5. Share the preview link: each launch has its own image (`/launches/<id>/opengraph-image`).

## Before recording

`npm run build && npm start`, then press `d` on the page for the demo controls. `npm run test:e2e` checks every route at phone width, accessibility, the bid flow, a failed payment, the clock and a failed create (it uses the dev server on :3000).
