import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

/** The WASM artifact must give the same answer as the native binary, and be hashed as the bytes that would be deployed. */
const WASM = resolve("../snipe-proof-auction/out/auction-engine.wasm");
const hasWasmtime = (() => { try { execFileSync("wasmtime", ["--version"], { stdio: "ignore" }); return true; } catch { return false; } })();
const skip = !existsSync(WASM) || !hasWasmtime ? "needs `sh snipe-proof-auction/build.sh` and the wasmtime CLI" : false;

describe("settling with the WASM artifact", { skip }, () => {
  it("runs through the backend's runEngine and publishes the SHA-256 of the .wasm as the code hash", async () => {
    process.env.AUCTION_ENGINE_WASM = WASM;
    const { runEngine, engineCodeHash, engineKind } = await import("./dev-enclave.js");
    const doc = JSON.parse(readFileSync(new URL("../../shared/test-vectors/auction-v1-cases.json", import.meta.url), "utf8"));
    assert.equal(engineKind(), "wasm");
    for (const c of doc.cases) assert.deepEqual(await runEngine(c.input), c.expected, c.name);
    const { createHash } = await import("node:crypto");
    assert.equal(engineCodeHash(), createHash("sha256").update(readFileSync(WASM)).digest("hex"));
    delete process.env.AUCTION_ENGINE_WASM;
  });
});
