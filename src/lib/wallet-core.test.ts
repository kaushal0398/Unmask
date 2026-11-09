import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { APP_RECIPIENT, WalletError, networkFromEnv, signInWithWallet, type ConnectorLike } from "@/lib/wallet-core";

type Signed = { accountId: string; publicKey: string; signature: string };
const connector = (over: Partial<{ accounts: Array<{ accountId: string }>; sign: () => Promise<Signed>; connect: () => Promise<void> }> = {}) => {
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

/** A fake backend: hands out challenges and accepts any signature. `challenge` can be bent to test the checks. */
const realFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = realFetch; });
function backend(opts: { challenge?: Record<string, unknown>; verifyStatus?: number; down?: boolean } = {}) {
  const seen: string[] = [];
  let n = 0;
  globalThis.fetch = (async (url: string, init?: RequestInit) => {
    if (opts.down) throw new TypeError("fetch failed");
    const path = new URL(url).pathname;
    seen.push(path);
    const body = JSON.parse(String(init?.body ?? "{}"));
    if (path === "/v1/auth/challenge") {
      n++;
      const nonce = n.toString(16).padStart(2, "0").repeat(32);
      return Response.json({ challenge: { challengeId: `c${n}`, accountId: body.accountId, nonce, message: `Sign in to Unmask. Challenge: ${nonce}`, recipient: APP_RECIPIENT, expiresAt: "2026-11-10T00:00:00Z", ...(opts.challenge ?? {}) } });
    }
    if (path === "/v1/auth/verify") {
      if (opts.verifyStatus) return Response.json({ error: { message: "Invalid or expired authentication challenge" } }, { status: opts.verifyStatus });
      return Response.json({ session: { accountId: body.accountId, token: `tok-${body.challengeId}`, expiresAt: "2026-11-11T00:00:00Z" } });
    }
    return new Response("nope", { status: 404 });
  }) as typeof fetch;
  return seen;
}

describe("signInWithWallet", () => {
  it("signs the backend's challenge exactly as issued and returns the session", async () => {
    const seen = backend();
    const { c, calls } = connector();
    const r = await signInWithWallet(c);
    assert.equal(r.accountId, "ayush.testnet");
    assert.equal(r.token, "tok-c1");
    assert.deepEqual(seen, ["/v1/auth/challenge", "/v1/auth/verify"]);
    assert.equal(calls[0]!.nonce.length, 32, "a 32-byte nonce, as NEP-413 requires");
    assert.equal(calls[0]!.recipient, APP_RECIPIENT);
    assert.match(calls[0]!.message, /^Sign in to Unmask\. Challenge: /);
    assert.equal(r.nonce.length, 64);
  });
  it("gets a different challenge, and so a different nonce, each time", async () => {
    backend();
    const { c } = connector();
    assert.notEqual((await signInWithWallet(c)).nonce, (await signInWithWallet(c)).nonce);
  });
  it("refuses a challenge issued for another account or another recipient", async () => {
    backend({ challenge: { accountId: "someone-else.testnet" } });
    await assert.rejects(signInWithWallet(connector().c), (e) => e instanceof WalletError && e.kind === "failed");
    backend({ challenge: { recipient: "evil.app" } });
    await assert.rejects(signInWithWallet(connector().c), (e) => e instanceof WalletError && e.kind === "failed");
  });
  it("reports a closed wallet as cancelled", async () => {
    backend();
    const { c } = connector({ connect: async () => { throw new Error("User rejected the request"); } });
    await assert.rejects(signInWithWallet(c), (e) => e instanceof WalletError && e.kind === "cancelled");
  });
  it("reports no account, a signing failure and a refused signature as failures", async () => {
    backend();
    await assert.rejects(signInWithWallet(connector({ accounts: [] }).c), (e) => e instanceof WalletError && e.kind === "failed");
    await assert.rejects(signInWithWallet(connector({ sign: async () => { throw new Error("socket hung up"); } }).c), (e) => e instanceof WalletError && e.kind === "failed");
    backend({ verifyStatus: 400 });
    await assert.rejects(signInWithWallet(connector().c), (e) => e instanceof WalletError && e.kind === "failed" && /expired/.test(e.message));
  });
  it("says so when the backend cannot be reached", async () => {
    backend({ down: true });
    await assert.rejects(signInWithWallet(connector().c), (e) => e instanceof WalletError && e.kind === "unavailable");
  });
  it("defaults to testnet", () => {
    assert.equal(networkFromEnv(undefined), "testnet");
    assert.equal(networkFromEnv("mainnet"), "mainnet");
    assert.equal(networkFromEnv("garbage"), "testnet");
  });
});
