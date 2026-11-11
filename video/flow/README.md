# Flow video (Unmask-Flow.mp4)

A 2 minute 30 second screen tour with a voice-over, in the order a person would use the app: landing page (short), launches list, create a launch, make a bid (agent rules, refund address, funding quote), live sealed bids arriving, my bids, settle and result, verify, the compare playground, then how-it-works, creators, FAQ and the honest limits page.

What is real and what is not, so nobody is misled:
- Footage is the production build against the real backend and PostgreSQL.
- **Live bids (scene f05):** three real sealed bids are sent through the real API while the page is open (`addbids.mts` seals them with the same `src/lib/seal.ts` the browser uses). The page does not poll, so the count updates on reload: 11, 12, 14.
- **Demo wallet:** create and bid use the demo wallet, so nothing is submitted (the pages say so). Settling skips the wallet sign-in and calls the real settle route, as `settle:demo` does. The narration says both.
- **My bids** is sample data in demo-wallet mode (the page is labelled).
- The landing page's sealed counter and ticker are sample data too.

## Rebuild it

Backend + PostgreSQL + the production web app running (see `docs/DEMO_GUIDE.md`), `ffmpeg`, Chrome, Pillow, `edge-tts`.

```sh
python3 video/flow/tts.py             # narration and durations.json
node video/flow/record.mjs            # seeds an open and a closed launch, records every scene
python3 video/flow/build.py           # video/flow/Unmask-Flow.mp4 and .srt
```

Words are in `scenes.json`; re-record one scene with `node video/flow/record.mjs f09-compare`. The `.mp4` is not committed. Other videos: `../README.md` (demo) and `../tech/README.md` (technical).
