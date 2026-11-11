# OutLayer project folder

This folder holds the OutLayer project settings (`outlayer.toml`, `skill.md`) created by `outlayer create`.

**The deployed code is not in this folder.** The canonical auction engine is [`../enclave/auction-engine`](../enclave/auction-engine). Build it with:

```sh
sh build.sh      # writes out/auction-engine.wasm and prints its SHA-256
```

`src/main.rs` here is the generated Hello World scaffold and is kept only for reference. See [`../docs/MASTER_PLAN.md`](../docs/MASTER_PLAN.md) decision 1.
