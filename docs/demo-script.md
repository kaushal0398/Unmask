# Demo script (about 3 minutes)

The short version. Setup, the three plans, troubleshooting and the full pre-flight list are in [`DEMO_GUIDE.md`](DEMO_GUIDE.md) and [`DEMO_CHECKLIST.md`](DEMO_CHECKLIST.md).

> The earlier version of this script used the demo wallet to seal a bid and a button that fast-forwards the clock. Neither works any more: the bid flow now needs a real signed-in wallet. This script uses what works today.

| Time | On screen | Say |
|---|---|---|
| 0:00 | Home | "The token launch where bots lose their edge. Bid blind, win fair, check everything." |
| 0:15 | The race, press play | "First-come: bots take most of it. Sealed: they win nothing. The cyan bar is an agent bidding inside rules its owner set." |
| 0:40 | The open launch | "Everyone bids in secret. All anyone sees is a count." |
| 0:55 | Agent mode, set rules | "The agent can only bid inside limits I set, and the check runs again at settlement." |
| 1:15 | Payout fields, bad then good address | "I can send my refund to another chain. A bad address is caught before I seal." |
| 1:30 | Pay from another chain, get a price | "A live price from NEAR Intents. A preview: nothing is paid." |
| 1:55 | The closed launch, then Settle | "The window has closed. The engine opens the bids and finds one price." |
| 2:15 | The result | "$0.03 for everyone. The snipers were priced out. This refund goes to Arbitrum: a plan, nothing is sent yet." |
| 2:35 | Bids left out, then the evidence | "Two bids were left out with reasons. This was settled by the development enclave: reproducible, not attested." |
| 2:55 | Close | "Fairness comes from the rule and the proof, not from trusting us." |

Say this clearly: **the enclave and the payment checks are development stand-ins, and no funds move.** Update this line when the real parts are connected.

## X post draft

> Built at the NEAR Hackathon: Unmask, a token launch where everyone bids in secret and everyone pays the same price, so bots can't snipe it by being first. The Rust engine finds the one fair price, an agent can only bid inside rules you set, and anyone can check the result. Demo: <video link> · Code: <repo link> #NEARHackathon

(Replace the links, and add the handles the organizers ask for. Posting is yours to do. Do not say "attested" or "TEE" until that is true.)
