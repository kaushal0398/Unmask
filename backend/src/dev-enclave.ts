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

const ENGINE = resolve(process.env.AUCTION_ENGINE_BIN ?? "../enclave/auction-engine/target/release/auction-engine");

/** SHA-256 of the engine binary: the "code hash" the result is published under. */
export function engineCodeHash(): string {
  return sha256Hex(readFileSync(ENGINE));
}

/** Run the Rust engine on one input. Rejects with the engine's own message if the input is invalid. */
export function runEngine(input: ExactInput): Promise<unknown> {
  return new Promise((ok, fail) => {
    const child = spawn(ENGINE, [], { stdio: ["pipe", "pipe", "pipe"] });
    let out = "", err = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (err += d));
    child.on("error", (e) => fail(new Error(`could not start the auction engine at ${ENGINE}: ${e.message}`)));
    child.on("close", (code) => (code === 0 ? ok(JSON.parse(out)) : fail(new Error(err.trim() || `auction engine exited with ${code}`))));
    child.stdin.end(JSON.stringify(input));
  });
}
