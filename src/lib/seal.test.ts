import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { BidPlaintext } from "@/lib/api/types";
import { commitmentOf, mockEnclaveKeys, newSalt, openBid, sealBid } from "@/lib/seal";

const bid = (over: Partial<BidPlaintext> = {}): BidPlaintext => ({
  launchId: "moonbean", bidder: "you.near", limit: 0.0314, qty: 271_828, paymentCheck: { id: "chk_1", key: "ck_secret_do_not_leak" }, salt: "ab".repeat(8), ...over,
});

describe("sealing a bid in the browser", () => {
  it("the enclave can open it and gets exactly what the buyer sealed", async () => {
    const keys = await mockEnclaveKeys();
    const sealed = await sealBid(bid(), { keyId: "k1", publicKey: keys.publicKey, attestationRef: "x" });
    assert.deepEqual(await openBid(sealed, keys), bid());
  });

  it("nothing about the bid is readable in what is sent", async () => {
    const keys = await mockEnclaveKeys();
    const sealed = await sealBid(bid(), { keyId: "k1", publicKey: keys.publicKey, attestationRef: "x" });
    const everything = JSON.stringify(sealed) + Buffer.from(sealed.ciphertext, "base64").toString("latin1");
    for (const secret of ["0.0314", "271828", "ck_secret_do_not_leak", "abababab", "\"limit\""]) assert.ok(!everything.includes(secret), `leaked ${secret}`);
    assert.deepEqual(Object.keys(sealed).sort(), ["bidder", "ciphertext", "commitment", "keyId", "launchId", "paymentCheckId"]);
  });

  it("only the enclave's key opens it", async () => {
    const keys = await mockEnclaveKeys();
    const stranger = await mockEnclaveKeys("someone else");
    const sealed = await sealBid(bid(), { keyId: "k1", publicKey: keys.publicKey, attestationRef: "x" });
    await assert.rejects(openBid(sealed, stranger));
  });

  it("sealing the same bid twice gives different ciphertext, so equal bids cannot be spotted", async () => {
    const keys = await mockEnclaveKeys();
    const a = await sealBid(bid(), { keyId: "k1", publicKey: keys.publicKey, attestationRef: "x" });
    const b = await sealBid(bid(), { keyId: "k1", publicKey: keys.publicKey, attestationRef: "x" });
    assert.notEqual(a.ciphertext, b.ciphertext);
    assert.equal(a.commitment, b.commitment, "but the commitment to the same bid and salt is the same");
  });

  it("the commitment changes with any field, and is 64 hex characters", async () => {
    const base = await commitmentOf(bid());
    assert.match(base, /^[0-9a-f]{64}$/);
    for (const change of [{ limit: 0.0315 }, { qty: 271_829 }, { salt: "cd".repeat(8) }, { bidder: "other.near" }, { launchId: "frogwave" }] as const) {
      assert.notEqual(await commitmentOf(bid(change)), base, JSON.stringify(change));
    }
  });

  it("the payment check's key is not part of the commitment, so revealing a commitment never reveals the key", async () => {
    assert.equal(await commitmentOf(bid()), await commitmentOf(bid({ paymentCheck: { id: "chk_1", key: "a different key" } })));
  });

  it("refuses a key of the wrong size, and makes fresh salts", async () => {
    await assert.rejects(sealBid(bid(), { keyId: "k", publicKey: "abcd", attestationRef: "x" }), /bytes of hex/);
    assert.notEqual(await newSalt(), await newSalt());
    assert.match(await newSalt(), /^[0-9a-f]{32}$/);
  });
});
