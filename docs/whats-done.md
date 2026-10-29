# What is done

Stage: **the interface is built on demo data; the enclave, the token and the money flows are not.** Update this file as work finishes.

Hackathon: development 1–14 Nov 2026, submit by 14 Nov 23:59 UTC.

## Done

| Item | Date | Where |
|---|---|---|
| Read the hackathon page: tracks, dates, prizes, submission fields | 28 Oct | `submission-checklist.md` |
| Researched the NEAR products involved (OutLayer TEE and payment checks, NEP-141, NEAR Intents) | 28 Oct | `protocols-integrated.md` |
| Chose the idea and the four tracks | 28 Oct | `what-we-are-building.md` |
| Described the product, the auction rule and a worked example | 28 Oct | `what-we-are-building.md` |
| Wrote the full plan with scope, architecture, phases, tests and risks | 28 Oct | `plan.md`, `../PLAN.md` |
| Scaffolded the Next.js app (Next.js 16.4.3, TypeScript, Tailwind CSS 4, App Router, `src/`) | 28 Oct | `src/app/` |
| Connected the GitHub repository and pushed the first commit with the plan (`e303c04`) | 28 Oct | `Meme-Proof-Near` |
| Built the whole interface on demo data: landing, launches, launch page, create, verify | 29 Oct | `src/` |

## Code written

Nothing here talks to a chain, an enclave or a wallet yet. Every launch, bid and result on screen is demo data, and each page says so.

| Piece | What it is | Where |
|---|---|---|
| Black theme and design system | Pure black; amber means sealed, green means verified, red means a sniper or a failed check; Geist, Geist Mono and an italic serif for emphasis | `src/app/globals.css`, `src/components/ui.tsx` |
| **Landing page** | Hero with the sealed-envelope stack, a scrolling ticker, the race, live meme cards, how it works, a clearing demo, hidden-versus-public, honest limits | `src/app/page.tsx` |
| **The race** | The same ten bids in a first-come launch and a sealed one. The sealed side is computed by the real auction rule | `src/components/race-demo.tsx`, `src/lib/race.ts` |
| **Meme cards** | Each token has a colour, a bobbing mascot and a status sticker, and tilts on hover | `src/components/launch-card.tsx` |
| **Launches** | Filterable grid | `src/app/launches/page.tsx` |
| **Launch page, three states** | Bidding open (countdown, sealed stack, bid form), settling (progress steps), settled (clearing price, opened bids, proof hashes) | `src/app/launches/[id]/page.tsx` |
| **Bid form** | Validates limit and cap, shows what you lock, seals with a real SHA-256 commitment, lets you withdraw | `src/components/bid-form.tsx` |
| **Create a launch** | Validated form with a live preview card and a created screen | `src/components/create-form.tsx` |
| **Reveal chart** | Sealed envelopes that open into the order book, with the clearing price and supply lines and a table of who got what | `src/components/auction-ladder.tsx` |
| **Verify** | Five checks redone in the browser (real hashing, the auction re-run), with a "pretend someone cheated" switch that is caught | `src/components/verify-panel.tsx`, `src/lib/verify-demo.ts` |
| The auction rule, in TypeScript | Uniform-price sealed-bid clearing with pro-rata at the price and whole-token rounding | `src/lib/auction.ts` |

17 tests pass (`npm test`) for the auction rule, the race and the checks, and lint, typecheck and the production build are clean.

## Next up (Phase 0, 28–31 Oct)

- [ ] Read OutLayer docs: how to deploy WebAssembly, how to verify an attestation, secrets and key derivation, randomness, fees and limits
- [ ] Test payment checks with tiny amounts: create, peek, claim part, reclaim, early reclaim, expiry
- [ ] Set up an OutLayer wallet with a few dollars of USDC (keys outside the repo)
- [ ] Find the standard NEP-141 contract and the storage deposit flow
- [ ] Check the Rust and WebAssembly toolchain on every machine
- [ ] Send the questions to the organizers
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
