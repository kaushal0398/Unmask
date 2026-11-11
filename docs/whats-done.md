# What is done

Stage: **the interface is built on demo data; the enclave, the token and the money flows are not.** Update this file as work finishes. Who owns what is left: [`team-handoff.md`](team-handoff.md).

Hackathon: development 1–14 Nov 2026, submit by 14 Nov 23:59 UTC.

## Status on 9 Nov (read this first; the sections below are the older record)

The product is now called **Unmask**; the theme is pure black with pink `#E501A5` and a white-bordered button style (older sections still say amber/violet and "Sealed").

| Area | Now |
|---|---|
| Backend (Fastify, PostgreSQL, Prisma) | Built for local development: wallet sign-in sessions, launches, payment checks (mock), sealed bids, receipts, **enclave key, settle, result** |
| Frontend to backend | `getApi()` returns the HTTP adapter. Enclave key and result now come from the backend |
| Rust auction engine | `enclave/auction-engine`, exact integers with 256-bit intermediates, matches TypeScript on 12 shared cases (`shared/test-vectors/auction-v1-cases.json`) |
| Settlement | Works on one machine with a **development enclave**: not confidential, not attested ([`settlement-dev.md`](settlement-dev.md)) |
| Still not built | Real OutLayer enclave and attestation, real payment checks and fund movement, NEP-141 token and payouts, deployment, demo video, submission |

## Done

| Item | Date | Where |
|---|---|---|
| Read the hackathon page: tracks, dates, prizes, submission fields | 28 Oct | `submission-checklist.md` |
| Researched the NEAR products involved (OutLayer TEE and payment checks, NEP-141, NEAR Intents) | 28 Oct | `protocols-integrated.md` |
| Chose the idea and the four tracks | 28 Oct | `what-we-are-building.md` |
| Described the product, the auction rule and a worked example | 28 Oct | `what-we-are-building.md` |
| Wrote the full plan with scope, architecture, phases, tests and risks | 28 Oct | `plan.md`, `plan-at-a-glance.md` |
| Scaffolded the Next.js app (Next.js 16.4.3, TypeScript, Tailwind CSS 4, App Router, `src/`) | 28 Oct | `src/app/` |
| Connected the GitHub repository and pushed the first commit with the plan (`e303c04`) | 28 Oct | `Meme-Proof-Near` |
| Built the whole interface on demo data: landing, launches, launch page, create, verify | 29 Oct | `src/` |

## Code written

Nothing here talks to a chain, an enclave or a wallet yet. Every launch, bid and result on screen is demo data, and each page says so.

| Piece | What it is | Where |
|---|---|---|
| Black theme and design system | Pure black; amber means sealed, green means verified, red means a sniper or a failed check; Geist, Geist Mono and an italic serif for emphasis | `src/app/globals.css`, `src/components/ui.tsx` |
| **Landing page** | Hero with the sealed-envelope stack, a scrolling ticker, the race, live meme cards, how it works, a clearing demo, hidden-versus-public, honest limits | `src/app/page.tsx` |
| **The race** | The same eleven bids in a first-come launch and a sealed one. The sealed side is computed by the real auction rule | `src/components/race-demo.tsx`, `src/lib/race.ts` |
| **Meme cards** | Each token has a colour, a bobbing mascot and a status sticker, and tilts on hover | `src/components/launch-card.tsx` |
| **Launches** | Filterable grid | `src/app/launches/page.tsx` |
| **Launch page, three states** | Bidding open (countdown, sealed stack, bid form), settling (progress steps), settled (clearing price, opened bids, proof hashes) | `src/app/launches/[id]/page.tsx` |
| **Bid form** | Validates limit and cap, shows what you lock, seals with a real SHA-256 commitment, lets you withdraw | `src/components/bid-form.tsx` |
| **Create a launch** | Validated form with a live preview card and a created screen | `src/components/create-form.tsx` |
| **Reveal chart** | Sealed envelopes that open into the order book, with the clearing price and supply lines and a table of who got what | `src/components/auction-ladder.tsx` |
| **Verify** | Five checks redone in the browser (real hashing, the auction re-run), with a "pretend someone cheated" switch that is caught | `src/components/verify-panel.tsx`, `src/lib/verify-demo.ts` |
| The auction rule, in TypeScript | Uniform-price sealed-bid clearing with pro-rata at the price and whole-token rounding | `src/lib/auction.ts` |

## Frontend layer added on 30 Oct

| Piece | Where |
|---|---|
| The contract with the core (`LaunchApi`) and an in-memory stand-in with failure switches | `src/lib/api/`, `docs/api-contract.md` |
| Real NEAR wallet sign-in (near-connect, signed message), demo wallet as fallback | `src/components/wallet.tsx`, `src/lib/wallet-core.ts` |
| Bids really sealed in the browser (libsodium sealed box, SHA-256 commitment) | `src/lib/seal.ts` |
| Bid flow: confirm, payment check, seal, submit, withdraw; payment-check panel with expired/reclaim | `src/components/bid-form.tsx`, `payment-check-panel.tsx` |
| Launch pages follow a clock: open, settling in five steps, settled | `src/components/live-launch.tsx`, `src/lib/{clock,stage}.ts` |
| Demo controls (`d` / `?demo=1`): clock speed, skip to close, make things fail | `src/components/demo-panel.tsx` |
| Create launch progress with retry from the failed step; verify reads the result through the adapter | `create-form.tsx`, `verify-panel.tsx` |
| Toasts, confirm dialogs, loading and error pages, skip link, contrast and mobile fixes | `toast.tsx`, `confirm.tsx`, `app/loading.tsx`, `app/error.tsx` |
| Social preview images for the site and every launch | `src/lib/og.tsx`, `opengraph-image.tsx` |
| Playwright tests: every route at 375px with accessibility checks, bid flow, failed payment, clock, failed create | `e2e/` |
| Drafts for you: demo script and X post, deploy notes | `demo-script.md`, `deploy.md` |

43 unit tests pass (`npm test`), 16 browser tests pass (`npm run test:e2e`), and lint, typecheck and the production build are clean.

## Next up (Phase 0, 28–31 Oct)

- [ ] Read OutLayer docs: how to deploy WebAssembly, how to verify an attestation, secrets and key derivation, randomness, fees and limits
- [ ] Test payment checks with tiny amounts: create, peek, claim part, reclaim, early reclaim, expiry
- [ ] Set up an OutLayer wallet with a few dollars of USDC (keys outside the repo)
- [ ] Find the standard NEP-141 contract and the storage deposit flow
- [ ] Check the Rust and WebAssembly toolchain on every machine
- [ ] Make the repository public
- [ ] Decide who owns what

## Then

| Phase | Dates | Status |
|---|---|---|
| 1 Reference auction | 1–3 Nov | Not started |
| 2 Enclave | 4–7 Nov | Not started |
| 3 Money and token | 7–10 Nov | Not started |
| 4 Polish | 10–12 Nov | Not started |
| 5 Ship | 12–14 Nov | Not started |
