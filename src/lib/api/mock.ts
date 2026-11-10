import { clearAuction } from "@/lib/auction";
import {
  ApiError,
  CreateStepError,
  type Allocation,
  type Attestation,
  type CreateLaunchInput,
  type CreateStep,
  type CreateStepId,
  type EnclaveKey,
  type Launch,
  type LaunchApi,
  type PaymentCheck,
  type Position,
  type Result,
  type SealedBid,
  type MyBid,
  type ReceiptVerification,
} from "@/lib/api/types";
import { clock } from "@/lib/clock";
import { LAUNCHES, outcomeOf, type Launch as DemoLaunch } from "@/lib/demo";
import { mockEnclaveKeys } from "@/lib/seal";
import { SETTLE_MS } from "@/lib/stage";

/**
 * The stand-in for the core. It follows `LaunchApi` exactly, so swapping it for the real thing changes no screen. It
 * keeps its state in memory for the session, takes its time from the page's clock, and can be told to fail so every
 * error state can be seen. It never sees a plaintext bid: `submitBid` refuses one.
 */
export type MockOptions = {
  /** The time, in ms. Defaults to the page's clock, which a presenter can speed up. */
  now?: () => number;
  /** Pretend network delay. 0 in tests. */
  latencyMs?: number;
};

export const CREATE_STEPS: Array<{ id: CreateStepId; label: string }> = [
  { id: "deploy-token", label: "Deploying the token contract" },
  { id: "mint-supply", label: "Minting the supply to the launch" },
  { id: "register-launch", label: "Registering the launch with the enclave" },
  { id: "publish-code", label: "Publishing the code hash" },
  { id: "open-bids", label: "Opening bids" },
];

const hex = (b: ArrayBuffer) => Array.from(new Uint8Array(b), (x) => x.toString(16).padStart(2, "0")).join("");
const sha256 = async (text: string) => hex(await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)));
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const b64encode = (text: string) => btoa(String.fromCharCode(...new TextEncoder().encode(text)));
const randomHex = (bytes: number) => Array.from(globalThis.crypto.getRandomValues(new Uint8Array(bytes)), (x) => x.toString(16).padStart(2, "0")).join("");
const looksLikePlaintext = (b64: string) => {
  try {
    const parsed = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))));
    return typeof parsed === "object" && parsed !== null;
  } catch {
    return false;
  }
};

export class MockLaunchApi implements LaunchApi {
  private readonly now: () => number;
  private readonly latency: number;
  private readonly openedAt: number;
  private checks = new Map<string, PaymentCheck>();
  private bids = new Map<string, { bid: SealedBid; receiptId: string }>();
  private created: DemoLaunch[] = [];
  private seq = 0;
  private armed: { payment: boolean; createStep: CreateStepId | null } = { payment: false, createStep: null };

  constructor(opts: MockOptions = {}) {
    this.now = opts.now ?? (() => clock.now());
    this.latency = opts.latencyMs ?? 450;
    this.openedAt = opts.now ? opts.now() : clock.sessionStart();
  }

  // ---- failure switches, for the demo panel and the tests ---------------------------------------

  /** The next payment check fails, as it does when the buyer's intents balance is short. */
  failNextPayment() {
    this.armed.payment = true;
  }
  /** The next create stops at this step. */
  failNextCreateAt(step: CreateStepId) {
    this.armed.createStep = step;
  }
  /** The most recent payment check, so the demo panel can expire it. */
  get lastCheckId(): string | null {
    return [...this.checks.keys()].at(-1) ?? null;
  }
  /** Mark a locked check as expired: its funds are still there, and must be reclaimed. */
  expireCheck(id: string) {
    const c = this.checks.get(id);
    if (c?.state === "locked") this.checks.set(id, { ...c, state: "expired" });
  }

  private wait = (ms = this.latency) => (ms > 0 ? new Promise<void>((r) => setTimeout(r, ms)) : Promise.resolve());
  private all = (): DemoLaunch[] => [...LAUNCHES, ...this.created];

  private closesAtMs(l: DemoLaunch): number | null {
    return l.status === "open" ? this.openedAt + (l.closesInMs ?? 0) : null;
  }

  private statusOf(l: DemoLaunch): Launch["status"] {
    const closes = this.closesAtMs(l);
    if (closes === null) return l.status;
    const t = this.now();
    return t < closes ? "open" : t < closes + SETTLE_MS ? "sealed" : "settled";
  }

  private publicLaunch(l: DemoLaunch): Launch {
    const closes = this.closesAtMs(l);
    return {
      id: l.id, name: l.name, symbol: l.symbol, emoji: l.emoji, hue: l.hue, tagline: l.tagline, creator: l.creator, supply: l.supply, reserve: l.reserve,
      cap: l.cap, status: this.statusOf(l), ...(closes !== null ? { closesAt: new Date(closes).toISOString() } : {}), bidCount: l.bidCount, tokenContract: l.tokenContract, codeHash: l.codeHash,
    };
  }

  // ---- reading ----------------------------------------------------------------------------------

  async listLaunches() {
    await this.wait(this.latency / 3);
    return this.all().map((l) => this.publicLaunch(l));
  }

  async getLaunch(id: string) {
    await this.wait(this.latency / 3);
    const l = this.all().find((x) => x.id === id);
    return l ? this.publicLaunch(l) : null;
  }

  async getResult(id: string): Promise<Result | null> {
    const l = this.all().find((x) => x.id === id);
    if (!l || this.statusOf(l) !== "settled" || !l.bids) return null;
    const o = clearAuction(l.bids, l.supply, l.reserve);
    const allocations: Allocation[] = o.fills.map((f) => ({ bidder: f.bid.label, limit: f.bid.limit, qty: f.bid.qty, filled: f.filled, paid: f.pays, refund: f.refund, isBot: f.bid.isBot }));
    const inputHash = l.inputHash ?? (await sha256(JSON.stringify(l.bids.map((b) => [b.id, b.label, b.limit, b.qty]).sort())));
    const resultHash = await sha256(JSON.stringify([o.price, allocations.map((a) => [a.bidder, a.filled])]));
    const attestation: Attestation = { kind: "tdx", quote: b64encode(`mock-tdx-quote:${l.codeHash}:${inputHash}:${resultHash}`), codeHash: l.codeHash, inputHash, resultHash, signer: "ed25519:" + "9f".repeat(32) };
    const closes = this.closesAtMs(l);
    return { launchId: id, clearingPrice: o.price, sold: o.sold, unsold: o.unsold, raised: o.raised, allocations, totalBids: l.status === "settled" ? l.bids.length : l.bidCount, codeHash: l.codeHash, inputHash, attestation, settledAt: new Date((closes ?? this.openedAt) + SETTLE_MS).toISOString() };
  }

  async getEnclaveKey(launchId: string): Promise<EnclaveKey> {
    await this.wait(this.latency / 3);
    const keys = await mockEnclaveKeys();
    return { keyId: `enclave-${launchId}-1`, publicKey: keys.publicKey, attestationRef: `mock://attestation/${launchId}` };
  }

  // ---- payment checks ---------------------------------------------------------------------------

  async createPaymentCheck(input: { launchId: string; amount: number }) {
    await this.wait();
    if (!(input.amount > 0)) throw new ApiError("payment_failed", "The amount to lock must be more than zero.");
    if (this.armed.payment) {
      this.armed.payment = false;
      throw new ApiError("payment_failed", "The payment check could not be created: your intents balance is lower than the amount to lock.");
    }
    const id = `chk_${(++this.seq).toString().padStart(4, "0")}_${Math.abs(input.amount * 1000) | 0}`;
    const check: PaymentCheck = { id, token: "USDC", amount: input.amount, state: "locked", expiresAt: new Date(this.now() + 6 * 3_600_000).toISOString() };
    this.checks.set(id, check);
    return { check: { ...check }, key: `ck_${randomHex(12)}` };
  }

  async getPaymentCheck(id: string) {
    const c = this.checks.get(id);
    return c ? { ...c } : null;
  }

  async reclaimPaymentCheck(id: string) {
    await this.wait(this.latency / 2);
    const c = this.checks.get(id);
    if (!c) throw new ApiError("not_found", `No payment check ${id}.`);
    if (c.state !== "locked" && c.state !== "expired") throw new ApiError("payment_failed", `A payment check that is ${c.state} cannot be reclaimed.`);
    const next: PaymentCheck = { ...c, state: "reclaimed" };
    this.checks.set(id, next);
    return { ...next };
  }

  // ---- bids -------------------------------------------------------------------------------------

  async settleLaunch(): Promise<Result> {
    throw new ApiError("closed", "Demo launches settle on their own clock.");
  }

  async submitBid(bid: SealedBid) {
    await this.wait();
    const l = this.all().find((x) => x.id === bid.launchId);
    if (!l) throw new ApiError("not_found", `No launch ${bid.launchId}.`);
    if (this.statusOf(l) !== "open") throw new ApiError("closed", "Bidding on this launch has closed.");
    if (!bid.ciphertext || looksLikePlaintext(bid.ciphertext)) throw new ApiError("bid_rejected", "A bid must be sealed to the enclave's key before it is sent.");
    if (!/^[0-9a-f]{64}$/.test(bid.commitment)) throw new ApiError("bid_rejected", "The commitment must be a SHA-256 hash.");
    const check = this.checks.get(bid.paymentCheckId);
    if (!check || check.state !== "locked") throw new ApiError("bid_rejected", "The payment check behind this bid is not locked.");
    const key = `${bid.launchId}|${bid.bidder}`;
    if (this.bids.has(key)) throw new ApiError("bid_rejected", "You already have a bid on this launch. Withdraw it to bid again.");
    const receiptId = `rcpt_${(++this.seq).toString().padStart(4, "0")}`;
    this.bids.set(key, { bid, receiptId });
    return { receiptId };
  }

  async withdrawBid(launchId: string, bidder: string) {
    await this.wait();
    const l = this.all().find((x) => x.id === launchId);
    if (!l) throw new ApiError("not_found", `No launch ${launchId}.`);
    if (this.statusOf(l) !== "open") throw new ApiError("closed", "Bidding has closed, so the bid can no longer be withdrawn.");
    const key = `${launchId}|${bidder}`;
    const entry = this.bids.get(key);
    if (!entry) throw new ApiError("not_found", "You have no bid on this launch.");
    await this.reclaimPaymentCheck(entry.bid.paymentCheckId);
    this.bids.delete(key);
  }

  // ---- creating a launch ------------------------------------------------------------------------

  async createLaunch(input: CreateLaunchInput, onStep: (steps: CreateStep[]) => void, opts: { resumeFrom?: CreateStepId } = {}) {
    const start = opts.resumeFrom ? CREATE_STEPS.findIndex((s) => s.id === opts.resumeFrom) : 0;
    const steps: CreateStep[] = CREATE_STEPS.map((s, i) => ({ ...s, state: i < start ? "done" : "pending" }));
    onStep(steps.map((s) => ({ ...s })));
    for (let i = start; i < steps.length; i++) {
      steps[i] = { ...steps[i]!, state: "running" };
      onStep(steps.map((s) => ({ ...s })));
      await this.wait(this.latency * 1.4);
      if (this.armed.createStep === steps[i]!.id) {
        this.armed.createStep = null;
        const error = `${steps[i]!.label} failed: the network did not answer. Nothing before this step is lost.`;
        steps[i] = { ...steps[i]!, state: "failed", error };
        onStep(steps.map((s) => ({ ...s })));
        throw new CreateStepError(steps[i]!.id, error);
      }
      steps[i] = { ...steps[i]!, state: "done" };
      onStep(steps.map((s) => ({ ...s })));
    }
    const id = `${slug(input.symbol)}-${(this.created.length + 1).toString(36)}`;
    this.created.push({
      id, name: input.name.trim(), symbol: input.symbol, emoji: "🪙", hue: [...input.name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 17), tagline: "A new sealed launch.",
      creator: "you.near", supply: input.supply, reserve: input.reserve, cap: input.capPercent > 0 ? input.capPercent / 100 : null, status: "open",
      closesInMs: input.windowMinutes * 60_000, bidCount: 0, codeHash: LAUNCHES[0]!.codeHash, tokenContract: `${slug(input.symbol)}.${id}.near`,
    });
    return { id };
  }
  async getMyBids(): Promise<MyBid[]> {
    return [];
  }

  async verifyReceipt(): Promise<ReceiptVerification> {
    throw new ApiError(
      "not_found",
      "Receipt verification is only available with the backend API.",
    );
  }

  // ---- the buyer's own bids ---------------------------------------------------------------------

  async positions(): Promise<Position[]> {
    await this.wait(this.latency / 3);
    const out: Position[] = [];
    for (const { bid } of this.bids.values()) {
      const check = this.checks.get(bid.paymentCheckId);
      out.push({ launchId: bid.launchId, status: "sealed-open", limit: 0, qty: 0, locked: check?.amount ?? 0, got: 0, paid: 0, refunded: 0, paymentCheckId: bid.paymentCheckId });
    }
    // One open, one won and one lost, so a new account has something to look at. The settled ones come from the real rule.
    const demo = (id: string, who: string): Position => {
      const l = LAUNCHES.find((x) => x.id === id)!;
      const f = outcomeOf(l)!.fills.find((x) => x.bid.label === who)!;
      return { launchId: id, status: f.filled > 0 ? "won" : "refunded", limit: f.bid.limit, qty: f.bid.qty, locked: f.locked, got: f.filled, paid: f.pays, refunded: f.refund };
    };
    if (!out.some((p) => p.launchId === "moonbean")) out.push({ launchId: "moonbean", status: "sealed-open", limit: 0, qty: 0, locked: 1200, got: 0, paid: 0, refunded: 0, paymentCheckId: "chk_demo_open" });
    out.push(demo("pixelpup", "dev.near"), demo("saltlamp", "oli.near"));
    return out;
  }
}
