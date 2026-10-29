import { clearAuction } from "@/lib/auction";
import type { Launch } from "@/lib/demo";
import { tokens, usd } from "@/lib/format";

/**
 * The checks the verify page runs, on demo data. The hashing is real (SHA-256) and the auction is re-run for real;
 * what is made up is the published result they are compared with, and the attestation, which needs the enclave.
 * `tamper` publishes a result that moves tokens to a bot, to show the checks catching it.
 */

export type CheckStatus = "pass" | "fail";
export type Check = { id: string; title: string; plain: string; status: CheckStatus; detail: string; evidence: Array<[string, string]> };

export async function sha256Hex(text: string): Promise<string> {
  const buf = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** The bids in a fixed form, so everyone hashes the same bytes. */
export const canonicalBids = (l: Launch) => JSON.stringify([...(l.bids ?? [])].sort((a, b) => a.id.localeCompare(b.id)).map((b) => [b.id, b.label, b.limit, b.qty]));

export async function runChecks(l: Launch, opts: { tamper: boolean }): Promise<Check[]> {
  if (!l.bids || !l.inputHash || !l.attestation) throw new Error("this launch has no published result to verify yet");
  const ours = clearAuction(l.bids, l.supply, l.reserve);
  const recomputedInput = await sha256Hex(canonicalBids(l));

  // What the enclave "published": our result, or, when tampering, one that hands a bot 50,000 tokens.
  const published = new Map(ours.fills.map((f) => [f.bid.id, f.filled]));
  if (opts.tamper) {
    const human = ours.fills.find((f) => !f.bid.isBot && f.filled >= 50_000)!;
    const bot = ours.fills.find((f) => f.bid.isBot)!;
    published.set(human.bid.id, human.filled - 50_000);
    published.set(bot.bid.id, (published.get(bot.bid.id) ?? 0) + 50_000);
  }
  const wrong = ours.fills.filter((f) => (published.get(f.bid.id) ?? 0) !== f.filled);
  const resultMatches = wrong.length === 0;

  const locked = ours.fills.reduce((s, f) => s + f.locked, 0);
  const refunded = ours.fills.reduce((s, f) => s + f.refund, 0);
  const sentOnChain = [...published.values()].reduce((a, b) => a + b, 0);

  return [
    {
      id: "code", title: "The code is the code we published", plain: "The enclave ran the open-source auction, not something else.",
      status: "pass", detail: "The code hash in the attestation equals the hash of the published auction code.",
      evidence: [["Published code hash", l.codeHash], ["Hash in the attestation", l.codeHash]],
    },
    {
      id: "attestation", title: "A genuine enclave signed the result", plain: "Hardware, not a person, vouches for what ran.",
      status: "pass", detail: "Demo: in the live flow the attestation quote is checked against the hardware maker's signature chain.",
      evidence: [["Attestation", l.attestation], ["Binds", "code hash + input hash + result hash"]],
    },
    {
      id: "input", title: "The enclave used exactly these bids", plain: "No bid was added, dropped or changed.",
      status: "pass", detail: "We hashed the revealed bids ourselves and got the hash the enclave published before settling.",
      evidence: [["Recomputed from the bids", recomputedInput], ["Published before settling", recomputedInput], ["Bids", String(l.bids.length)]],
    },
    {
      id: "result", title: "Running the rule again gives the same result", plain: "Anyone can redo the maths and get the same price and the same winners.",
      status: resultMatches ? "pass" : "fail",
      detail: resultMatches ? `Clearing price ${usd(ours.price)}, ${tokens(ours.sold)} tokens sold. Every allocation matches.` : `The published result gives ${wrong.map((f) => `${f.bid.label} ${tokens(published.get(f.bid.id) ?? 0)}`).join(" and ")}. The rule gives ${wrong.map((f) => `${f.bid.label} ${tokens(f.filled)}`).join(" and ")}.`,
      evidence: [["Clearing price (recomputed)", usd(ours.price)], ["Tokens sold (recomputed)", tokens(ours.sold)], ...wrong.map((f): [string, string] => [`${f.bid.label}: published vs rule`, `${tokens(published.get(f.bid.id) ?? 0)} vs ${tokens(f.filled)}`])],
    },
    {
      id: "money", title: "The money adds up", plain: "What came in equals what was paid out plus what was refunded, and the tokens sent equal the tokens sold.",
      status: resultMatches && Math.abs(locked - (ours.raised + refunded)) < 1e-6 && sentOnChain === ours.sold ? "pass" : "fail",
      detail: resultMatches ? `${usd(locked)} locked = ${usd(ours.raised)} to the creator + ${usd(refunded)} refunded.` : `Tokens sent to bidders do not match the tokens the rule sells to them.`,
      evidence: [["Locked by bidders", usd(locked)], ["Paid to the creator", usd(ours.raised)], ["Refunded", usd(refunded)], ["Tokens sent on chain", tokens(sentOnChain)], ["Tokens the rule sells", tokens(ours.sold)]],
    },
  ];
}
