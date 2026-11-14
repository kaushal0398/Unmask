import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { KeyPair, KeyPairSigner } from "near-api-js";
import { ACTION_RECIPIENT, actionNonce, bidMessage, checkActionSignature, createMessage } from "./action-sig.js";

const fullAccess = { viewAccessKey: async () => ({ permission: "FullAccess" }) } as never;
const restricted = { viewAccessKey: async () => ({ permission: { FunctionCall: {} } }) } as never;
const now = new Date("2026-11-13T10:00:00.000Z");
const issuedAt = "2026-11-13T09:59:00.000Z";
const launch = { account: "a.near", name: "Bean", symbol: "bean", supplyAtomic: "1000", reserveAtomic: "5", closesAt: "2026-11-13T11:00:00.000Z" };

async function sign(message: string, account = "a.near") {
  const kp = KeyPair.fromRandom("ed25519");
  const signed = await new KeyPairSigner(kp).signNep413Message(account, { message, recipient: ACTION_RECIPIENT, nonce: actionNonce(message) });
  return { message, publicKey: kp.getPublicKey().toString(), signature: Buffer.from(signed.signature).toString("base64") };
}

describe("wallet action signatures", () => {
  it("builds the same text as the frontend (src/lib/action.test.ts)", () => {
    assert.equal(createMessage({ ...launch, issuedAt }), `Unmask: create a launch
Account: a.near
Token: Bean ($BEAN)
Supply (atomic): 1000
Reserve (atomic): 5
Bidding closes: 2026-11-13T11:00:00.000Z
Issued: 2026-11-13T09:59:00.000Z`);
    assert.equal(bidMessage({ account: "a.near", launchId: "L1", commitment: "abc", issuedAt }), `Unmask: place a sealed bid
Account: a.near
Launch: L1
Bid commitment: abc
The bid amount stays sealed.
Issued: 2026-11-13T09:59:00.000Z`);
  });

  const expected = (i: string) => createMessage({ ...launch, issuedAt: i });

  it("accepts a real signature over exactly this launch", async () => {
    assert.equal(await checkActionSignature(await sign(expected(issuedAt)), "a.near", expected, fullAccess, now), null);
  });

  it("rejects a missing or malformed signature", async () => {
    for (const bad of [undefined, null, {}, { message: "x" }]) assert.equal(await checkActionSignature(bad, "a.near", expected, fullAccess, now), "missing wallet signature");
  });

  it("rejects a signature for different details (cannot be reused for another launch)", async () => {
    const other = await sign(createMessage({ ...launch, supplyAtomic: "999999", issuedAt }));
    assert.equal(await checkActionSignature(other, "a.near", expected, fullAccess, now), "signature is for a different action");
  });

  it("rejects stale and future signatures", async () => {
    const old = "2026-11-13T09:00:00.000Z";
    assert.equal(await checkActionSignature(await sign(expected(old)), "a.near", expected, fullAccess, now), "signature is too old or from the future");
    const future = "2026-11-13T10:30:00.000Z";
    assert.equal(await checkActionSignature(await sign(expected(future)), "a.near", expected, fullAccess, now), "signature is too old or from the future");
  });

  it("rejects a forged key, a non-full-access key, and a key that is not on the account", async () => {
    const good = await sign(expected(issuedAt));
    const forged = { ...good, publicKey: KeyPair.fromRandom("ed25519").getPublicKey().toString() };
    assert.equal(await checkActionSignature(forged, "a.near", expected, fullAccess, now), "wallet signature is invalid");
    assert.equal(await checkActionSignature(good, "a.near", expected, restricted, now), "wallet signature is invalid");
    const notOnAccount = { viewAccessKey: async () => { throw new Error("access key does not exist"); } } as never;
    assert.equal(await checkActionSignature(good, "a.near", expected, notOnAccount, now), "wallet signature is invalid");
  });

  it("binds a bid signature to its launch and commitment", async () => {
    const b = (launchId: string, commitment: string) => (i: string) => bidMessage({ account: "a.near", launchId, commitment, issuedAt: i });
    const sig = await sign(b("L1", "abc")(issuedAt));
    assert.equal(await checkActionSignature(sig, "a.near", b("L1", "abc"), fullAccess, now), null);
    assert.equal(await checkActionSignature(sig, "a.near", b("L2", "abc"), fullAccess, now), "signature is for a different action");
    assert.equal(await checkActionSignature(sig, "a.near", b("L1", "zzz"), fullAccess, now), "signature is for a different action");
  });
});
