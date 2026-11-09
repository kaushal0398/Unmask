import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { describe, it } from "node:test";
import { AGENT_RECIPIENT, rulesMessage, rulesNonce, type AgentRules } from "@/lib/agent";
import { WalletError, signAgentRules, type ConnectorLike, type WalletLike } from "@/lib/wallet-core";

const rules: AgentRules = { version: 1, owner: "a.near", launchId: "L1", maxLimitPrice: 0.05, maxQty: 100, maxSpend: 5, expiresAt: "2026-11-10T12:00:00.000Z", nonce: "n" };

function connectorWith(sign: WalletLike["signMessage"]): ConnectorLike {
  const wallet: WalletLike = { getAccounts: async () => [{ accountId: "a.near" }], signMessage: sign };
  return { connect: async () => wallet, wallet: async () => wallet, disconnect: async () => {} };
}

describe("signAgentRules", () => {
  it("signs the exact rules message with the recipient and nonce the backend rebuilds", async () => {
    let seen: Parameters<WalletLike["signMessage"]>[0] | undefined;
    const out = await signAgentRules(connectorWith(async (p) => { seen = p; return { accountId: "a.near", publicKey: "ed25519:K", signature: "c2ln" }; }), rules);
    assert.deepEqual(out, { signature: "c2ln", publicKey: "ed25519:K" });
    assert.equal(seen!.message, rulesMessage(rules));
    assert.equal(seen!.recipient, AGENT_RECIPIENT);
    assert.deepEqual([...seen!.nonce], [...createHash("sha256").update(rulesMessage(rules)).digest()], "same nonce as backend/src/agent-rules.ts");
    assert.deepEqual([...(await rulesNonce(rules))], [...seen!.nonce]);
  });
  it("refuses a signature from a different account", async () => {
    await assert.rejects(signAgentRules(connectorWith(async () => ({ accountId: "evil.near", publicKey: "k", signature: "s" })), rules), (e) => e instanceof WalletError && e.kind === "failed");
  });
  it("reports a closed wallet as cancelled and anything else as failed", async () => {
    await assert.rejects(signAgentRules(connectorWith(async () => { throw new Error("User rejected the request"); }), rules), (e) => e instanceof WalletError && e.kind === "cancelled");
    await assert.rejects(signAgentRules(connectorWith(async () => { throw new Error("socket hung up"); }), rules), (e) => e instanceof WalletError && e.kind === "failed");
  });
});
