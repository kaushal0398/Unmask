/**
 * Which engine settles a launch, behind one function.
 *
 *   AUCTION_ENGINE unset         the native binary, or the WASM under wasmtime if AUCTION_ENGINE_WASM is set (development)
 *   AUCTION_ENGINE=outlayer      the registered project on OutLayer over HTTPS
 *
 * The result says which one ran. A run on OutLayer is recorded as mode "outlayer", never "tee": "tee" is reserved for a
 * result whose attestation we have verified (see docs/OUTLAYER_ATTESTATION.md).
 */
import { engineCodeHash, engineKind, runEngineRaw } from "./dev-enclave.js";
import { createOutLayerClient, OutLayerError } from "./outlayer.js";
import type { ExactInput } from "./settlement-core.js";

export type EngineRun = {
  /** The engine's output text, exactly. Hash this for the output hash. */
  raw: string;
  kind: "native" | "wasm" | "outlayer";
  /** SHA-256 of the artifact that ran. */
  codeHash: string;
  mode: "dev" | "outlayer";
  attestationUrl: string | null;
  callId: string | null;
};

export const usesOutLayer = () => process.env.AUCTION_ENGINE === "outlayer";

export async function runAuction(input: ExactInput, env: NodeJS.ProcessEnv = process.env): Promise<EngineRun> {
  if (env.AUCTION_ENGINE !== "outlayer") {
    return { raw: await runEngineRaw(input), kind: engineKind(), codeHash: engineCodeHash(), mode: "dev", attestationUrl: null, callId: null };
  }
  const missing = ["OUTLAYER_PROJECT", "OUTLAYER_PAYMENT_KEY", "OUTLAYER_CODE_HASH"].filter((k) => !env[k]);
  if (missing.length) throw new OutLayerError("bad_config", `AUCTION_ENGINE=outlayer needs ${missing.join(", ")}.`);
  const client = createOutLayerClient({ base: env.OUTLAYER_API_BASE, project: env.OUTLAYER_PROJECT!, paymentKey: env.OUTLAYER_PAYMENT_KEY!, versionKey: env.OUTLAYER_VERSION_KEY });
  const run = await client.run(input);
  // The code hash is the one the version was registered with: the SHA-256 of the .wasm. The attestation names the same hash.
  return { raw: run.raw, kind: "outlayer", codeHash: env.OUTLAYER_CODE_HASH!, mode: "outlayer", attestationUrl: run.attestationUrl, callId: run.callId };
}
