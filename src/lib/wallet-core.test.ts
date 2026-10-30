import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { WalletError, networkFromEnv, signInWithWallet, type ConnectorLike } from "@/lib/wallet-core";

const connector = (over: Partial<{ accounts: Array<{ accountId: string }>; sign: () => Promise<{ accountId: string; publicKey: string; signature: string }>; connect: () => Promise<void> }> = {}) => {
  const calls: Array<{ nonce: Uint8Array; recipient: string; message: string }> = [];
  const c: ConnectorLike = {
    async connect() {
      await over.connect?.();
      return {
        getAccounts: async () => over.accounts ?? [{ accountId: "ayush.testnet" }],
        signMessage: async (p) => {
          calls.push(p);
          return over.sign ? over.sign() : { accountId: "ayush.testnet", publicKey: "ed25519:abc", signature: "sig" };
        },
      };
    },
    async disconnect() {},
  };
  return { c, calls };
};

describe("signInWithWallet", () => {
  it("signs a fresh 32-byte nonce and returns the account", async () => {
    const { c, calls } = connector();
    const r = await signInWithWallet(c);
    assert.equal(r.accountId, "ayush.testnet");
    assert.equal(calls[0]!.nonce.length, 32);
    assert.equal(r.nonce.length, 64);
    assert.match(calls[0]!.message, /does not move funds/);
  });
  it("uses a different nonce each time", async () => {
    const { c } = connector();
    assert.notEqual((await signInWithWallet(c)).nonce, (await signInWithWallet(c)).nonce);
  });
  it("reports a closed wallet as cancelled", async () => {
    const { c } = connector({ connect: async () => { throw new Error("User rejected the request"); } });
    await assert.rejects(signInWithWallet(c), (e) => e instanceof WalletError && e.kind === "cancelled");
  });
  it("reports no account and other failures", async () => {
    await assert.rejects(signInWithWallet(connector({ accounts: [] }).c), (e) => e instanceof WalletError && e.kind === "failed");
    await assert.rejects(signInWithWallet(connector({ sign: async () => { throw new Error("socket hung up"); } }).c), (e) => e instanceof WalletError && e.kind === "failed");
  });
  it("defaults to testnet", () => {
    assert.equal(networkFromEnv(undefined), "testnet");
    assert.equal(networkFromEnv("mainnet"), "mainnet");
    assert.equal(networkFromEnv("garbage"), "testnet");
  });
});
