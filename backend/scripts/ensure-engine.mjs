// Builds the native Rust auction engine if it is not there yet, so `npm test` works on a fresh clone.
// Plain Node on purpose: it must run the same on macOS, Linux and Windows (no shell tricks).
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../enclave/auction-engine");
const exe = resolve(process.env.AUCTION_ENGINE_BIN ?? `${root}/target/release/auction-engine${process.platform === "win32" ? ".exe" : ""}`);

if (existsSync(exe)) process.exit(0);
console.log(`The auction engine is not built yet (${exe}). Building it with cargo...`);
const r = spawnSync("cargo", ["build", "--release", "--manifest-path", `${root}/Cargo.toml`], { stdio: "inherit", shell: process.platform === "win32" });
if (r.status !== 0 || !existsSync(exe)) {
  console.error("Could not build the engine. Install Rust (https://rustup.rs) and run `npm run engine:build`.");
  process.exit(1);
}
