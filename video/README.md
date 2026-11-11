# Demo video (Unmask-Demo.mp4)

A 3 minute 40 second walkthrough with a voice-over, built from the **real running app** (production build, real backend, real PostgreSQL, live NEAR Intents price preview). It follows `docs/DEMO_GUIDE.md` Plan B: the demo wallet is used (so bids and agent rules are unsigned) and the settle step uses the `settle:demo` shortcut, which the narration says out loud. Nothing in it claims attestation, TEE or real funds.

Made the same way as the other hackathon videos: Chrome-recorded screen clips with a visible cursor, edge-tts voice, ffmpeg.

| Scene | What it shows |
|---|---|
| 01–03 | Title, the problem, the four steps |
| 04 | The race: same eleven bids, first-come vs sealed |
| 05–08 | Open launch, agent mode, refund and token address checks, the live NEAR Intents price preview |
| 09–10 | A closed launch, settle, the result and the payout plan |
| 11–12 | Verify page (4 checks pass, 2 say not checked) and a sample where cheating is caught |
| 13 | Launch list, create page, compare playground |
| 14–15 | What is real and what is not yet, close |

## Rebuild it

Needs the app running (`npx next build && npx next start -p 3000`, the backend on 4001 with PostgreSQL), `ffmpeg`, Google Chrome, Pillow and `edge-tts` (internet).

```sh
cd backend && npm run seed:demo -- --creator demo.testnet --open-minutes 90   # note the open launch id it prints
cd .. && python3 video/tts.py                                                  # narration audio and durations.json
OPEN_ID=<that id> node video/record.mjs                                        # records every scene (seeds and settles its own closed launch)
python3 video/build.py                                                         # video/Unmask-Demo.mp4 and .srt
```

Edit the words in `scenes.json` (then re-run `tts.py` and re-record that scene: `node video/record.mjs 12-cheat`). The `.mp4` is not committed.
