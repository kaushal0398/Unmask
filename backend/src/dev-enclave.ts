/**
 * DEVELOPMENT ENCLAVE. Stands in for the OutLayer TEE so the whole flow runs on one machine.
 *
 * It holds a libsodium key pair, opens sealed bids, and runs the Rust auction engine as a child process.
 * It is NOT confidential (this process can read every bid) and produces NO attestation. Replace it with the
 * real OutLayer enclave before describing any result as private or attested.
 */
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import sodium from "libsodium-wrappers";
import { sha256Hex, type ExactInput, type PlainBid } from "./settlement-core.js";

await sodium.ready;

const hex = (b: Uint8Array) => Buffer.from(b).toString("hex");

const seedHex = process.env.DEV_ENCLAVE_SEED;
if (!seedHex) console.warn("[dev-enclave] DEV_ENCLAVE_SEED is not set: using a throwaway key. Bids sealed before a restart cannot be opened.");
const seed = seedHex && /^[0-9a-f]{64}$/i.test(seedHex) ? Uint8Array.from(Buffer.from(seedHex, "hex")) : sodium.randombytes_buf(sodium.crypto_box_SEEDBYTES);
const pair = sodium.crypto_box_seed_keypair(seed);

export const DEV_KEY_ID = "dev-enclave-1";
export const devEnclaveKey = () => ({ keyId: DEV_KEY_ID, publicKey: hex(pair.publicKey), attestationRef: "dev://no-attestation" });

/** Open one sealed bid, or null if it is not a valid box for this key or not valid JSON. */
export function openBid(ciphertextBase64: string): PlainBid | null {
  try {
    const box = sodium.from_base64(ciphertextBase64, sodium.base64_variants.ORIGINAL);
    const plain = sodium.crypto_box_seal_open(box, pair.publicKey, pair.privateKey);
    return JSON.parse(sodium.to_string(plain)) as PlainBid;
  } catch {
    return null;
  }
}

/**
 * Which engine runs the auction.
 * - AUCTION_ENGINE_WASM set: the WASM artifact (the exact bytes that go to OutLayer) under the `wasmtime` CLI.
 *   `codeHash` is then the SHA-256 of that .wasm, the same hash OutLayer registers for a project version.
 * - otherwise: the native binary at AUCTION_ENGINE_BIN, for fast local development.
 */
// Read per call, so a test or an operator can switch engines without restarting the module.
const wasmPath = () => (process.env.AUCTION_ENGINE_WASM ? resolve(process.env.AUCTION_ENGINE_WASM) : null);
const nativePath = () => resolve(process.env.AUCTION_ENGINE_BIN ?? `../enclave/auction-engine/target/release/auction-engine${process.platform === "win32" ? ".exe" : ""}`);
export const engineKind = (): "wasm" | "native" => (wasmPath() ? "wasm" : "native");

/** SHA-256 of the artifact that actually runs: the .wasm when set, otherwise the native binary. */
export function engineCodeHash(): string {
  return sha256Hex(readFileSync(wasmPath() ?? nativePath()));
}

/**
 * Run the Rust engine on one input and return its stdout EXACTLY as written. Hash these bytes for the output hash: an
 * OutLayer attestation covers the hash of the input it was given and of the output it produced, so ours must be the
 * hash of the engine's own bytes, not of an object we rebuilt. Rejects with the engine's own message on invalid input.
 */
export function runEngineRaw(input: ExactInput): Promise<string> {
  const wasm = wasmPath();
  const [cmd, args] = wasm ? (["wasmtime", ["run", wasm]] as const) : ([nativePath(), []] as const);
  return new Promise((ok, fail) => {
    const child = spawn(cmd, [...args], { stdio: ["pipe", "pipe", "pipe"] });
    let out = "", err = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (err += d));
    child.on("error", (e) => fail(new Error(`could not start the auction engine (${cmd}): ${e.message}`)));
    child.on("close", (code) => (code === 0 ? ok(out) : fail(new Error(err.trim() || `auction engine exited with ${code}`))));
    child.stdin.end(JSON.stringify(input));
  });
}

/** Same as `runEngineRaw`, parsed. */
export async function runEngine(input: ExactInput): Promise<unknown> {
  return JSON.parse(await runEngineRaw(input));
}
