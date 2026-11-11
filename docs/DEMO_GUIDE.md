# Demo guide: how to run and show Unmask

Written 10 Nov 2026, updated after a full end-to-end test. On 10 Nov **every step of the run sheet below was run in a real browser** against the production build of the web app, a real PostgreSQL, the real backend and the live NEAR Intents service, and all of it passed with no page errors. The only part never run is signing in with a real wallet (Plan A).

A ready-made walkthrough video with a voice-over is built from this guide: see [`../video/README.md`](../video/README.md) (the file is `video/Unmask-Demo.mp4`, not committed).

## 1. What the demo shows, and what it does not

It shows a sealed-bid launch from bid to result: bids are sealed in the browser, one price is found by the Rust engine, and the result page shows the allocations, who was left out and why, where refunds and tokens would go, and what the evidence is.

It does **not** show real money or a real enclave. Be upfront about all four:

| Part | What it really is today |
|---|---|
| The enclave | A development stand-in inside the backend. It is not confidential and not attested |
| Payment checks | Database rows. No funds are locked |
| NEAR Intents funding | A **real live price preview**. No deposit address, no payment |
| Refunds and tokens | A **plan** in the result. Nothing is sent |

## 2. One-time setup

You need Node 24, Rust, PostgreSQL 16, and for the WASM check `wasmtime`.

```sh
npm install
cd backend && npm install
createdb unmask                                   # or any database name
cp .env.example .env                              # then edit it, see below
npm run engine:build                              # builds the Rust engine
npx prisma migrate deploy
```

Edit `backend/.env`:

| Variable | Set it to |
|---|---|
| `DATABASE_URL` | your PostgreSQL URL, e.g. `postgresql://you@localhost:5432/unmask` |
| `NEAR_RPC_URL` | `https://rpc.testnet.near.org` (**required**: the backend will not start without it) |
| `DEV_ENCLAVE_SEED` | `openssl rand -hex 32`. **Set it once and keep it.** Bids are sealed to this key, so changing it makes seeded bids unreadable |

## 3. Start everything (three terminals)

| Terminal | Command | You should see |
|---|---|---|
| 1 backend | `cd backend && npm run dev` | The server listening on port 4001. Check: `curl localhost:4001/health` returns `{"ok":true,...}` |
| 2 frontend | `npx next build && npx next start -p 3000` | `Ready` on port 3000. **Use this for recording:** the production build is faster and has no "N" development badge in the corner. `npm run dev` also works for rehearsing |
| 3 seeding | below | A launch URL |

## 4. Seed the demo launches

Use the NEAR testnet account you will sign in with (call it `YOU.testnet`).

```sh
cd backend
# A CLOSED launch, ready to settle, with a bid from your account so you get "Your result":
npm run seed:demo -- --creator YOU.testnet --bidder YOU.testnet
# An OPEN launch (60 minutes), for the countdown, the bid form, agent mode and the funding quote:
npm run seed:demo -- --creator YOU.testnet --open-minutes 60
```

Each prints a launch page URL: **copy the two URLs it prints** (one closed, one open). Do not look the ids up some other way. The closed launch holds 11 sealed bids: the README example, an agent bid inside its rules, a cross-chain refund, four snipers who bid low, and two bids that will be rejected so "Bids left out" has something to show. After settling it should read **$0.03, 1,000,000 sold, $30,000 raised, 2 bids left out**.

## 5. Pick a plan

| Plan | When | What you need | Status |
|---|---|---|---|
| **A: live wallet** | You can sign in with a real testnet wallet | A testnet wallet (near-connect, e.g. HOT Wallet) holding `YOU.testnet` | **Untested.** Wallet sign-in has never been tried live. Rehearse it first |
| **B: no wallet** | Always works | Nothing extra. Use the demo wallet and the settle shortcut | **Tested end to end on 10 Nov** |
| **C: samples only** | Backend or network down | Nothing. Sample launches and the verify page work with the backend off | **Tested** (sample launch pages load without the backend) |

What the **demo wallet** can and cannot do: it can show the countdown, open agent mode and set rules (shown as unsigned), fill the payout fields (with live address checks), and fetch the live funding quote. It **cannot** sign in, so **Seal my bid** stays disabled, and it cannot press Settle. That is why Plan B uses the shortcut below.

### The settle shortcut (Plan B)

`npm run settle:demo -- <launchId>` writes a short-lived session for the launch's creator and calls the **real** settle route, which is what the Settle button does after a wallet signs in. Only the sign-in is skipped. Say so out loud when you use it. It refuses to run in production, and running it twice is safe.

## 6. The run sheet (about three and a half minutes)

| Time | Screen | Do | Say |
|---|---|---|---|
| 0:00 | `/` hero | Nothing | "The token launch where bots lose their edge. Bid blind, win fair, check everything." |
| 0:15 | The race, press play | Point at the red bars, then the cyan one | "Same bids, two launches. First-come: bots take most of it. Sealed: they win nothing. The cyan bar is an agent bidding inside rules its owner set." |
| 0:40 | The **open** launch | Show the countdown and the sealed stack | "Everyone bids in secret. All anyone sees is a count." |
| 0:55 | Same page, bid form | Use the demo wallet, tick agent mode, set rules | "I set a maximum price, a maximum size and an expiry. The agent can only bid inside them, and the check runs again at settlement." (Plan B: "the demo wallet can't sign, so these are unsigned.") |
| 1:15 | Same form, payout fields | Tick "send my refund somewhere else", type `0x123`, then a real address | "I can send my refund to another chain. A bad address is caught before I seal." |
| 1:30 | Same form, **Pay from another chain** | Pick Arbitrum USDC, enter an address, press the price button | "This is a **live price** from NEAR Intents: about 3,030 USDC on Arbitrum to deliver 3,000 on NEAR, about 25 seconds. It is a preview. No deposit address, nothing moves." |
| 1:55 | The **closed** launch | Show "No more bids are accepted" and "Only the creator can settle it" | "The window has closed. The creator settles it." |
| 2:05 | Settle | Press **Settle** (Plan A) or run `npm run settle:demo -- <id>` (Plan B), refresh | "The engine opens the bids and finds one price." |
| 2:15 | Result page | Scroll: price, allocations, then the payout plan | "$0.03 for everyone. Whatever they offered, every winner paid exactly this. The snipers bid low and were priced out. This refund goes to Arbitrum through NEAR Intents: **a plan**, nothing is sent yet." |
| 2:35 | **Bids left out** | Point at the two reasons | "Two bids were left out, each with a reason: an agent that broke its rules, and a mistyped address. Their funds come back through the payment check." |
| 2:45 | **Check it yourself**, then press **Verify this launch** | Point at the hashes and the amber "none (development enclave)" line | "The code hash, input hash and output hash are public. This was settled by the development enclave, so it's reproducible but **not attested**, and I won't claim otherwise." |
| 3:00 | **Verify page**, press **Run the checks** | Let the six checks appear, open "The enclave used exactly these bids" | "This page rebuilds the input from the public numbers and hashes it, runs the rule again here in my browser, and checks the money. **Four checks pass.** Two say *not checked*: whether the code is the published code, and whether hardware signed it. I can't check those from here, so it doesn't count them as passes." |
| 3:20 | Close | | "Fairness comes from the rule and the proof, not from trusting us, and where we can't prove something yet, it says so." |

If you signed in as the bidder (Plan A, or the seed's `--bidder` account), add at 2:40: show **Your result** and press **Save as image**.

**Optional 20 seconds, if there is time:** open `/verify` with no launch in the address, pick PixelPup, tick **Pretend someone cheated** and run the checks to watch a tampered result get caught. Say it is a sample launch (the page is labelled).

### What the verify page should show for the seeded launch

Four green checks (the bids hash, the rule re-run, the money, the engine output) and two amber **not checked** (the code and the attestation). The verdict is amber: **"Everything we can check from here passed. 4 of 6 checks passed."** If you see "This launch was run fairly" in green, something is wrong, because two checks cannot be done from the browser.

## 7. Say, and do not say

| Say | Do not say |
|---|---|
| "Development enclave", "stand-in", "not attested" | "TEE", "attested", "verified by hardware" |
| "Price preview", "a live quote" | "Funded from Arbitrum", "we took a deposit" |
| "A plan", "would go to" | "Refunded", "sent", "paid out" |
| "Payment checks are stand-ins" | "Funds are locked" |
| "Settled with the real Rust engine" | "Running on OutLayer" (the remote run has not been retried) |
| "Four checks pass, two are not checked" | "Fully verified", "provably fair", or "verified by the enclave" |
| "I can check the arithmetic and the hashes, not who ran the code" | "Nobody can cheat". The backend operator can read every bid today |

## 8. Recording

- Record at 1280x800 or larger. Use a clean browser profile, no bookmarks bar.
- Close other apps and mute notifications. Zoom the page to 110% if text is small.
- Seed fresh launches right before recording so the open launch has plenty of time left.
- Do one full dry run first. Plan A has never been run end to end.
- Keep the video under 3 minutes. Say the honesty line at 2:45 out loud.

## 9. Troubleshooting

| Symptom | Cause and fix |
|---|---|
| The backend exits with `NEAR_RPC_URL is required` | Add it to `backend/.env` |
| The page says it could not connect to the backend | Terminal 1 is not running. Sample launches still work |
| Every seeded bid shows `could not be decrypted` after settling | `DEV_ENCLAVE_SEED` changed or was unset after seeding. Set it once, restart the backend, seed again |
| The funding panel says "NEAR Intents could not price this" | The recipient must be a real **mainnet** account (the default is `intents.near`), or you are offline, or the amount is too small |
| "Live quotes are switched off" | Expected. Live deposits stay off unless `ONECLICK_ALLOW_LIVE=1` |
| No Settle button | Only the launch's creator sees it, and only when signed in. Use `settle:demo` |
| Settle says "The bidding window is still open" | You seeded with `--open-minutes`. Seed a closed one |
| The seal button is disabled | Expected with the demo wallet. Plan A needs a real wallet |
| Two launches look the same | Each seed makes a new launch. Use the URL it printed |
| The verify page says "no published result yet" | The launch has not been settled. Run `settle:demo` first |
| The verify page opens PixelPup and SaltLamp | You opened `/verify` with no launch in the address. Use the **Verify this launch** button on the result page. (Older builds verified a sample whatever the address said: fixed on 10 Nov) |
| A "N" badge in the corner of the page | You are running `npm run dev`. Use `npx next build && npx next start -p 3000` for recording |
| Seeding says it could not reach the backend | Start the backend first. Seeding reads its enclave key |

## 10. Reset

Each seed creates a new launch, so you do not need to reset. To clear everything: drop and recreate the database, then `npx prisma migrate deploy`.

See also [`DEMO_CHECKLIST.md`](DEMO_CHECKLIST.md) for the pre-flight list and [`NEARLY_FEATURES_AND_CHECKS.md`](NEARLY_FEATURES_AND_CHECKS.md) for how to check each feature.
