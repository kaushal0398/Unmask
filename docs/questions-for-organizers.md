# Questions for the organizers

Rewritten 10 Nov 2026. **These are overdue: development opened on 1 Nov and the deadline is 14 Nov 23:59 UTC.** Sending is your step. Nothing here is answered by the repository.

## Ready to send

Paste this into the organizers' channel or form. Replace nothing except the bracketed parts.

> Hi, we're team Unmask [add team name and members] building a sealed-bid token launch on NEAR for the Memecoins With Mechanics track (we may also fit Privacy & Private AI, Autonomous Business and Unstoppable DeFi). Four quick eligibility questions, and we'll plan around whatever you say:
>
> 1. **Earlier work.** The first 13 commits, a project scaffold and a demo interface, are dated 28 to 30 October, before development opened on 1 November. Everything else is dated 1 November or later: the backend, the Rust auction engine, the NEAR integration, the tests and the docs. Does the earlier scaffold count, or should we mark it in the repo? We're happy to credit and open-source all of it.
> 2. **Third-party enclave.** We run the auctioneer on OutLayer (Intel TDX), which is not our own infrastructure. Is that acceptable for the build, and does it count for the Privacy track?
> 3. **Real funds.** Our settlement and payment checks are testnet stand-ins and we move no real funds. We also fetch real price quotes from NEAR Intents on mainnet (a read-only preview, no deposit). Is a testnet demo with clearly labelled stand-ins fine, or do you expect a funded mainnet flow?
> 4. **Repository.** Must it be public from now, or only at submission? We plan to make it public by 12 November.
>
> Link to the repo and a three-minute demo will come with the submission. Thanks.

## The full list, and why each matters

| # | Question | Why it matters | If nobody answers by Thursday 12 Nov |
|---|---|---|---|
| 1 | The first 13 commits (a scaffold and a demo interface) are dated 28 to 30 Oct, before development opened on 1 Nov. Everything else, including the backend (1 Nov) and the Rust auction engine (3 Nov), is inside the window. Does the earlier scaffold count? | Eligibility. Checked against `git log` on 10 Nov | Keep the history as it is, say so in the README and the submission, and credit the earlier work |
| 2 | May we use a third-party enclave (OutLayer, Intel TDX) for the auctioneer? | The fairness claim rests on it | Say plainly that the enclave is OutLayer's and that our own run is a development stand-in |
| 3 | Is a testnet demo with labelled stand-ins acceptable, or is a real mainnet flow expected? | Decides what the demo and the video may claim | Demo on testnet with labelled stand-ins. Do not claim real funds moved |
| 4 | Does a stand-in for the attestation check count as "verified" if it is labelled? | We label it; we want to know if that is enough | Never call the result attested. The verify page already shows "not checked" |
| 5 | Must the repository be public from the start, or only at submission? | Planning. It is private today | Make it public by Thursday 12 Nov either way |
| 6 | May one project enter several tracks? | We fit Memecoins With Mechanics, Privacy & Private AI, Autonomous Business and Unstoppable DeFi | Enter the strongest fit (Memecoins With Mechanics) and mention the others in the description |
| 7 | Is a read-only NEAR Intents price quote enough to say we "integrate NEAR Intents", or must a funded swap be shown? | We have a real quote preview and no deposit | Describe it as "a live price preview" and not as an integration that funds bids |
| 8 | Does the privacy track expect the backend operator to be unable to read bids? | Today the operator can (see `PRIVACY_THREAT_MODEL.md`), and we say so | Keep saying so. Do not claim private-from-us |

## What the answers change

| If the answer is | We do |
|---|---|
| Earlier work does not count | Move the early scaffold under a clearly marked folder and list what was built from 1 Nov |
| A third-party enclave is not allowed | The privacy claim shrinks to "bids are encrypted in the browser and the API shows nobody else's". We would remove the enclave claim |
| A funded mainnet flow is expected | We cannot deliver that by 14 Nov. Say so, and show the testnet flow with the stand-ins labelled |
| The repo must be public now | Run `sh scripts/scan-secrets.sh` (it is clean) and make it public |

## After sending

Record the date, who answered, and what they said here, and update `MASTER_PLAN.md` task F1 and the open-questions table in `decisions-and-open-questions.md`.
