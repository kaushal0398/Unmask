# Technical video (Unmask-Tech.mp4)

A 6 minute 36 second voice-over walkthrough for engineers. **No screen demo:** every card shows data captured from a real run of the backend (`capture.mts` makes real calls and records the answers), so a teammate can check each value against the code.

| Scene | What it covers |
|---|---|
| t02 | Architecture: who holds what, and what is not built (dashed) |
| t03–t04 | Sign-in challenge (NEP-413) and the payment check, real requests and responses |
| t05–t06 | Sealing in the browser (libsodium sealed box) and the commitment hash |
| t07–t08 | What the submit call carries, what the database stores, what is public, and the four real rejections |
| t09 | The development enclave opening a bid: why the operator can read bids today |
| t10–t11 | Settlement, bids left out with reasons, the uniform-price rule and real fills |
| t12–t13 | The three hashes, and the six browser checks (4 pass, 2 not checked) |
| t14–t15 | What is real on the chain side vs stand-ins, and the tests |

Cross-check against: `src/lib/seal.ts`, `backend/src/server.ts`, `backend/src/dev-enclave.ts`, `docs/AUCTION_SPEC.md`, `src/lib/verify-result.ts`, `docs/PRIVACY_THREAT_MODEL.md`.

## Rebuild it

Needs the backend and PostgreSQL running (see `docs/DEMO_GUIDE.md`), `ffmpeg`, Google Chrome and `edge-tts` (internet).

```sh
npx tsx video/tech/capture.mts      # real calls -> video/tech/data.json (seeds its own launches)
python3 video/tech/tts.py           # narration
python3 video/tech/build.py         # video/tech/Unmask-Tech.mp4 and .srt
```

The `.mp4` and the captured data are not committed. The companion screen demo is in `video/README.md`.
