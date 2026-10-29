# Submission checklist

Hackathon: development 1–14 Nov 2026. Submissions open 1 Nov 00:00 UTC and close **14 Nov 23:59 UTC**. Aim to submit on 13 Nov. Judging is 16–18 Nov. One submission per team.

## Requirements
- [ ] The repository is **public** (judges cannot open a private one)
- [ ] The project was built during the hackathon (check with the organizers what counts)
- [ ] Demo post on X saying it was built at NEAR HACKATHON, with a video or screenshots
- [ ] Submit the repository link **and** the demo post link; both are required

## Form fields
| Field | Value |
|---|---|
| Project name | Snipe-Proof Meme Launch |
| Team lead | To fill in |
| Email | To fill in |
| Team size | To fill in |
| Tracks | 11 Memecoins With Mechanics, 3 Privacy & Private AI, 4 Autonomous Business, 1 Unstoppable DeFi |
| NEAR wallet address | To fill in (where a prize would be sent) |
| Repository link | `https://github.com/ayushsingh82/Meme-Proof-Near` (currently private) |
| Demo post link | To fill in |
| What did you build? | 20–2,000 characters: the problem, what was built, and how NEAR fits |

## Draft of "What did you build?"
Bots snipe token launches by being first and by seeing orders. Snipe-Proof Meme Launch is a sealed-bid, uniform-price launch: buyers bid in secret, a private auctioneer running in an OutLayer enclave finds one clearing price, and everyone pays it. Bids are locked in OutLayer payment checks, so losing bidders reclaim their funds and winners pay only the clearing price. The enclave publishes its code hash, the result and an attestation, so anyone can verify the auction. It uses OutLayer, NEP-141 and NEAR Intents. *(Update this to match what was actually built.)*

## Before submitting
- [ ] A real launch has run on mainnet with small funds
- [ ] The verify page works for a stranger
- [ ] README states the limitations honestly
- [ ] Demo video and X post are up
- [ ] Release tag created, `main` frozen
