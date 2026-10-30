import type { BidPlaintext, EnclaveKey, SealedBid } from "@/lib/api/types";

/**
 * Sealing a bid in the browser. The bid is put in a libsodium sealed box addressed to the enclave's public key, so
 * only the enclave can read it: not this site, not the creator, not another bidder. Nothing here is a secret
 * except the bidder's salt and the payment check's key, and both travel only inside the box.
 *
 * libsodium is loaded on first use so the 200 KB it weighs is not part of every page.
 */
type Sodium = typeof import("libsodium-wrappers");
let loaded: Promise<Sodium> | null = null;

async function sodium(): Promise<Sodium> {
  loaded ??= import("libsodium-wrappers").then(async (m) => {
    const s = (m as unknown as { default?: Sodium }).default ?? (m as unknown as Sodium);
    await s.ready;
    return s;
  });
  return loaded;
}

const toHex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
const fromHex = (h: string) => Uint8Array.from(h.match(/../g)?.map((x) => parseInt(x, 16)) ?? []);

/** The bytes that are hashed to commit to a bid: fixed field order, so the same bid always hashes the same. */
export const commitmentInput = (b: BidPlaintext) => JSON.stringify([b.launchId, b.bidder, b.limit, b.qty, b.paymentCheck.id, b.salt]);

/** A fresh random salt, hex. */
export async function newSalt(): Promise<string> {
  const s = await sodium();
  return toHex(s.randombytes_buf(16));
}

/** SHA-256 of the committed fields, hex. The bidder can recompute it later with their salt to prove the bid was theirs. */
export async function commitmentOf(b: BidPlaintext): Promise<string> {
  return toHex(new Uint8Array(await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(commitmentInput(b)))));
}

/** Seal a bid to the enclave. The returned object is safe to send: the amounts are inside `ciphertext`. */
export async function sealBid(bid: BidPlaintext, enclave: EnclaveKey): Promise<SealedBid> {
  const s = await sodium();
  const publicKey = fromHex(enclave.publicKey);
  if (publicKey.length !== s.crypto_box_PUBLICKEYBYTES) throw new Error(`the enclave key must be ${s.crypto_box_PUBLICKEYBYTES} bytes of hex`);
  const box = s.crypto_box_seal(s.from_string(JSON.stringify(bid)), publicKey);
  return {
    launchId: bid.launchId,
    bidder: bid.bidder,
    ciphertext: s.to_base64(box, s.base64_variants.ORIGINAL),
    commitment: await commitmentOf(bid),
    paymentCheckId: bid.paymentCheck.id,
    keyId: enclave.keyId,
  };
}

/** What the enclave does: open a sealed bid with its key pair. Used by tests and the mock; never by the interface. */
export async function openBid(sealed: Pick<SealedBid, "ciphertext">, keys: { publicKey: string; secretKey: string }): Promise<BidPlaintext> {
  const s = await sodium();
  const plain = s.crypto_box_seal_open(s.from_base64(sealed.ciphertext, s.base64_variants.ORIGINAL), fromHex(keys.publicKey), fromHex(keys.secretKey));
  return JSON.parse(s.to_string(plain)) as BidPlaintext;
}

/** The mock enclave's key pair, from a fixed seed so tests and demos are repeatable. */
export async function mockEnclaveKeys(seedText = "sealed-mock-enclave"): Promise<{ publicKey: string; secretKey: string }> {
  const s = await sodium();
  const kp = s.crypto_box_seed_keypair(s.crypto_generichash(s.crypto_box_SEEDBYTES, s.from_string(seedText), null));
  return { publicKey: toHex(kp.publicKey), secretKey: toHex(kp.privateKey) };
}
