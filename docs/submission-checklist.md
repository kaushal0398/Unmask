# Submission checklist

Hackathon: development 1–14 Nov 2026. Submissions open 1 Nov 00:00 UTC and close **14 Nov 23:59 UTC**. Aim to submit on 13 Nov. Judging is 16–18 Nov. One submission per team.

## Requirements
- [ ] The repository is **public** (judges cannot open a private one). It is private today. Run `sh scripts/scan-secrets.sh` first: it was clean on 10 Nov
- [ ] The project was built during the hackathon (there is no organizer contact to ask what counts). The scaffold dates from 28 Oct, before 1 Nov. **Say so in the README and the submission and credit it**
- [ ] Demo post on X saying it was built at NEAR HACKATHON, with a video or screenshots
- [ ] Submit the repository link **and** the demo post link; both are required

## Form fields
| Field | Value |
|---|---|
| Project name | Unmask |
| Team lead | To fill in (Ayush Singh, Co-founder and CTO, or Kaushal, Co-founder and Engineering Lead) |
| Email | To fill in |
| Team size | To fill in (two named in the README) |
| Tracks | 11 Memecoins With Mechanics, 3 Privacy & Private AI, 4 Autonomous Business, 1 Unstoppable DeFi |
| NEAR wallet address | To fill in (where a prize would be sent) |
| Repository link | To confirm. GitHub now redirects `ayushsingh82/Meme-Proof-Near` to `https://github.com/kaushal0398/Unmask`. **Currently private** (anonymous requests return 404). Make it public, then use the final URL |
| Demo post link | To fill in |
| What did you build? | 20–2,000 characters: the problem, what was built, and how NEAR fits |

## Draft of "What did you build?"

Written 10 Nov to match what exists. It is about 1,400 characters (the limit is 2,000). **Update the last paragraph the day you submit**, and remove any sentence that stops being true or add one that becomes true. Do not say "attested", "TEE" or "funded from another chain" unless it is.

Bots snipe token launches by being first and by seeing other people's orders. Unmask is a sealed-bid, uniform-price token launch on NEAR: everyone bids in secret, one clearing price is found after the window closes, and every winner pays that same price. Arriving first or last changes nothing.

What works today: bids are encrypted in the browser with a sealed box. A Rust auction engine, also built to WebAssembly, finds the price with exact integer maths. It matches a TypeScript version on 212 shared cases and satisfies 14 guarantees on thousands of random auctions. The backend leaves out dishonest bids (wrong commitment, unfunded, a rule-breaking agent) and records why. The result page shows every allocation, who was left out, and a transfer plan, and anyone can re-run the rule in the browser on the verify page.

Inspired by NEAR Intents products: an agent can bid for you only inside limits you sign, and those limits are checked again at settlement. You get a shareable result card. The bid form shows a live NEAR Intents price for funding a bid from another chain, and you choose where refunds go.

Honest status: the enclave is a development stand-in (not confidential, not attested), payment checks are stand-ins, the Intents quote is a price preview with no deposit, and payouts are a plan. We are working on running the engine inside OutLayer, real payment checks and a NEP-141 token.

## Before submitting
- [ ] A real launch has run with small funds. **Not planned as written:** NEAR Intents is mainnet only but our settlement and payment checks are development stand-ins. Decide what "real" means for the demo (see `MASTER_PLAN.md` section 6)
- [ ] The verify page works for a stranger (it runs on sample data and re-runs the rule in the browser; the launch result page links to it)
- [x] README states the limitations honestly (Features and "What is built, and what we are making real" say what each part is and is not)
- [ ] Demo video and X post are up
- [ ] Release tag created, `main` frozen
