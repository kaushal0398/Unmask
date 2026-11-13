import assert from "node:assert/strict";
import { test } from "node:test";
import { anchorConfigFromEnv, anchorResult } from "./anchor.js";

const input = { launchId: "L1", inputHash: "i", outputHash: "o", codeHash: "c", clearingPrice: "50000", mode: "dev" };
const cfg = { contractId: "reg.testnet", accountId: "w.testnet", privateKey: "ed25519:x", rpcUrl: "http://x", network: "testnet" };

test("anchoring is off unless every variable is set", () => {
  assert.equal(anchorConfigFromEnv({ NEAR_RPC_URL: "http://x" } as NodeJS.ProcessEnv), null);
  const on = anchorConfigFromEnv({ ANCHOR_CONTRACT: "r", ANCHOR_ACCOUNT_ID: "w", ANCHOR_PRIVATE_KEY: "k", NEAR_RPC_URL: "u" } as NodeJS.ProcessEnv);
  assert.equal(on?.network, "testnet");
});

test("sends the right method and fields and returns the transaction hash", async () => {
  let seen: { method: string; args: unknown } | undefined;
  const rec = await anchorResult(cfg, input, async (_c, method, args) => { seen = { method, args }; return { status: { SuccessValue: "" }, transaction: { hash: "HASH1" } }; });
  assert.equal(rec.txHash, "HASH1");
  assert.equal(seen?.method, "anchor");
  assert.deepEqual(seen?.args, { launch_id: "L1", input_hash: "i", output_hash: "o", code_hash: "c", clearing_price: "50000", mode: "dev" });
});

test("a failed transaction is an error, not a hash", async () => {
  await assert.rejects(anchorResult(cfg, input, async () => ({ status: { Failure: {} }, transaction: { hash: "H" } })));
  await assert.rejects(anchorResult(cfg, input, async () => ({ status: { SuccessValue: "" } })));
});
