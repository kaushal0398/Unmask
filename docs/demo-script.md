# Demo script (about 2 minutes)

Press `d` (or open any page with `?demo=1`) to show the demo controls. Use the demo wallet unless the real wallet is tested.

| Time | On screen | Say |
|---|---|---|
| 0:00 | Home: the bots-versus-sealed race | "On most launches the first buyers win. Bots watch, buy in the first blocks, sell into everyone else." |
| 0:15 | Press play on the race | "Same bids, two launches. First-come: bots take most of it. Unmask: they win nothing." |
| 0:30 | `/launches/moonbean`, countdown | "Here everyone bids in secret. All anyone sees is a count." |
| 0:40 | Connect, enter 0.05 and 10,000, Seal | "The bid is encrypted in my browser to the enclave's key. Funds sit in a payment check I control." |
| 1:00 | Withdraw, then bid again (shows the confirm dialogs) | "I can take it back any time before the close." |
| 1:10 | Demo panel: Skip to the close, then 600× | "Window closes. The enclave opens the bids and finds one price." |
| 1:30 | Settled view, the ladder | "Everyone to the left pays the same clearing price. Bots bid low and were priced out." |
| 1:45 | `/verify`, run the checks, then tick "pretend someone cheated" | "Anyone can recompute this. Change one number and a check fails." |
| 2:00 | Close | "Fairness comes from the rule and the proof, not from trusting us." |

Say clearly: this build runs on demo data and a stand-in for the enclave; no funds move. Update this line once the core is connected.

## X post draft

> Built at the NEAR Hackathon: Unmask, a token launch where everyone bids in secret and everyone pays the same price, so bots can't snipe it by being first. A hardware enclave finds the one fair price, and anyone can check afterwards that it ran honestly. Demo: <video link> · Code: <repo link> #NEARHackathon

(Replace the links, and add the handles the organizers ask for. Posting is yours to do.)
