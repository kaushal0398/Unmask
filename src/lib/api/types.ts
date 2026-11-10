import type { AgentClaim } from "@/lib/agent";
import type { RawLaunch, RawResult } from "@/lib/verify-result";
import type { Destination } from "@/lib/intents/addresses";

/**
 * The contract between this interface and the core (the enclave, the payment checks and the token). Every screen
 * reads and writes through `LaunchApi`; today a mock implements it (`mock.ts`), and the real one replaces the mock
 * without a screen changing. `docs/api-contract.md` is this file in prose, for the people building the core.
 *
 * Amounts that are USD prices are plain numbers here because the interface only displays them; the real contract
 * should carry token amounts as decimal strings of the smallest unit.
 */

export type LaunchStatus = "open" | "sealed" | "settled";

/** A launch as the public sees it: no bid amounts, ever, until it has settled. */
export type Launch = {
  id: string;
  name: string;
  symbol: string;
  emoji: string;
  /** 0 to 360: the colour of the token's art. */
  hue: number;
  tagline: string;
  creator: string;
  supply: number;
  /** Lowest price the creator will sell at, per token. */
  reserve: number;
  /** Most one account may bid for, as a share of the supply (0 to 1), or null. */
  cap: number | null;
  status: LaunchStatus;
  /** When bidding closes (ISO 8601). Present while open. */
  closesAt?: string;
  /** How many bids there are. Never an amount. */
  bidCount: number;
  tokenContract: string;
  codeHash: string;
};

/** The enclave's public key for one launch: bids are sealed to it, and only the enclave can open them. */
export type EnclaveKey = {
  keyId: string;
  /** 32 bytes, hex. A libsodium box public key. */
  publicKey: string;
  /** Where the attestation that binds this key to the enclave's code can be fetched. */
  attestationRef: string;
};

/** What a buyer's browser puts inside the sealed box. Only the enclave ever reads this. */
export type BidPlaintext = {
  launchId: string;
  bidder: string;
  /** Most the buyer will pay per token. */
  limit: number;
  qty: number;
  /** The payment check that backs the bid, and the key the enclave needs to claim it. */
  paymentCheck: { id: string; key: string };
  /** Random bytes that make the commitment unguessable. */
  salt: string;
  /** Set when an agent placed this bid for its owner: the rules it must stay inside. */
  agent?: AgentClaim;
  /** Where refunds and tokens should go. Default: the bidder's own NEAR account. */
  payout?: { refundTo?: Destination; tokensTo?: Destination };
};

/** What the browser sends to the core. The amounts are inside `ciphertext`. */
export type SealedBid = {
  launchId: string;
  bidder: string;
  /** Base64 of a libsodium sealed box over a `BidPlaintext`. */
  ciphertext: string;
  /** SHA-256 over the plaintext, hex. The bidder keeps the salt to prove the bid was theirs. */
  commitment: string;
  /** The id (not the key) of the backing payment check. */
  paymentCheckId: string;
  keyId: string;
};

export type PaymentCheckState = "creating" | "locked" | "failed" | "expired" | "reclaimed" | "claimed";

/**
 * An OutLayer payment check: funds locked for one bid. `expired` blocks new claims but does NOT return the funds;
 * the buyer must reclaim them.
 */
export type PaymentCheck = {
  id: string;
  token: string;
  /** USD, as displayed. */
  amount: number;
  state: PaymentCheckState;
  /** ISO 8601. */
  expiresAt: string;
  error?: string;
};

export type Attestation = {
  /** "dev" is the development enclave: reproducible, but NOT attested. */
  kind: "tdx" | "dev";
  /** Opaque quote bytes, base64. */
  quote: string;
  codeHash: string;
  inputHash: string;
  resultHash: string;
  /** Hex: the key that signed the result. */
  signer: string;
};

export type Allocation = {
  bidder: string;
  limit: number;
  qty: number;
  filled: number;
  paid: number;
  refund: number;
  isBot?: boolean;
  /** Set when an agent placed this bid. `signed` is true only if the owner's wallet signature was verified. */
  agent?: { signed: boolean };
};

/** Money the settlement WOULD send, per bidder. A plan: nothing moves until real payment checks and a token exist. */
export type PlannedTransfer = {
  bidId: string;
  bidder: string;
  kind: "refund" | "tokens";
  amountAtomic: string;
  to: { chain: string; address: string };
  /** True when the destination is not NEAR, so the transfer would go through NEAR Intents. */
  viaIntents: boolean;
};

export type SkippedBid = { bidId: string; reason: string };

/** The published result of a settled launch. */
export type Result = {
  launchId: string;
  clearingPrice: number;
  sold: number;
  unsold: number;
  raised: number;
  /** Every bid, revealed after settlement (decision D7: or just the aggregate book; verification needs the bids). */
  allocations: Allocation[];
  /** How many bids there were in all. May exceed `allocations.length` in a demo sample. */
  totalBids: number;
  codeHash: string;
  inputHash: string;
  attestation: Attestation;
  settledAt: string;
  /**
   * "dev": the development enclave (reproducible, not confidential, not attested).
   * "outlayer": the run happened on OutLayer and it returned an attestation URL, but WE HAVE NOT VERIFIED IT.
   * "tee": the attestation has been verified. Nothing sets this yet.
   */
  mode?: "dev" | "outlayer" | "tee";
  /** Where OutLayer published the execution's TEE quote, when mode is "outlayer". */
  attestationUrl?: string;
  payouts?: PlannedTransfer[];
  payoutsExecuted?: boolean;
  /** Bids that were left out of the auction, each with the reason. */
  skipped?: SkippedBid[];
};

export type CreateLaunchInput = {
  name: string;
  symbol: string;
  supply: number;
  reserve: number;
  windowMinutes: number;
  /** Percent of supply one account may bid for; 0 for no cap. */
  capPercent: number;
  unsold: "return" | "burn";
};

export type CreateStepId = "deploy-token" | "mint-supply" | "register-launch" | "publish-code" | "open-bids";
export type CreateStep = { id: CreateStepId; label: string; state: "pending" | "running" | "done" | "failed"; error?: string };

/** A create that stopped at a step. Calling again with `resumeFrom` continues without redoing finished steps. */
export class CreateStepError extends Error {
  constructor(
    public readonly step: CreateStepId,
    message: string,
  ) {
    super(message);
    this.name = "CreateStepError";
  }
}

export class ApiError extends Error {
  constructor(
    public readonly code:
      | "payment_failed"
      | "not_found"
      | "bid_rejected"
      | "duplicate_bid"
      | "closed"
      | "network",
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** One of the signed-in buyer's bids, with where its money is. */
export type Position = {
  launchId: string;
  status: "sealed-open" | "won" | "refunded";
  limit: number;
  qty: number;
  locked: number;
  got: number;
  paid: number;
  refunded: number;
  paymentCheckId?: string;
};

/** An authenticated user's bid returned by the backend. */
export type MyBid = {
  id: string;
  launchId: string;
  bidder: string;
  commitment: string;
  paymentCheckId: string;
  keyId: string;
  receiptId: string;
  createdAt: string;

  launch: {
    id: string;
    name: string;
    symbol: string;
    emoji: string;
    hue: number;
    state: string;
    closesAt: string | null;
  };

  paymentCheck: {
    token: string;
    amount: number;
    state: PaymentCheckState;
    expiresAt: string;
  };
};

export type ReceiptVerificationCheck = {
  id: string;
  label: string;
  passed: boolean;
  detail: string;
};

export type ReceiptVerification = {
  receiptId: string;
  status: "record_verified" | "record_check_failed";
  verificationLevel: "backend_record_only";
  checks: ReceiptVerificationCheck[];

  bid: {
    id: string;
    launchId: string;
    bidder: string;
    commitment: string;
    paymentCheckId: string;
    keyId: string;
    createdAt: string;
  };

  launch: {
    id: string;
    name: string;
    symbol: string;
  };

  paymentCheck: {
    id: string;
    token: string;
    state: string;
    expiresAt: string;
  };

  limitations: string[];
};

export interface LaunchApi {
  listLaunches(): Promise<Launch[]>;
  getLaunch(id: string): Promise<Launch | null>;
  /** `null` until the launch has settled. */
  getResult(id: string): Promise<Result | null>;
  getEnclaveKey(launchId: string): Promise<EnclaveKey>;
  /** Ask the backend to settle a launch whose window has closed. Only its creator may. */
  settleLaunch(id: string): Promise<Result>;
  /** The raw public result of a settled launch, for the verify page to recompute. `null` for a sample or an unsettled launch. */
  getVerification(id: string): Promise<{ launch: RawLaunch; result: RawResult } | null>;

  /** Lock funds for a bid. Resolves once the check is `locked`; rejects with `ApiError("payment_failed")`. */
  createPaymentCheck(input: {
  launchId: string;
  bidder: string;
  amount: number;
}): Promise<{ check: PaymentCheck; key: string }>;
  getPaymentCheck(id: string): Promise<PaymentCheck | null>;
  /** Take the funds back. Works while the check is `locked` or `expired`. */
  reclaimPaymentCheck(id: string): Promise<PaymentCheck>;

  submitBid(bid: SealedBid): Promise<{ receiptId: string }>;
  /** Cancel a bid: reclaims its payment check. Only before the close. */
  withdrawBid(launchId: string, bidder: string): Promise<void>;

  /** Runs the steps in order, reporting each. Rejects with `CreateStepError`; call again with `resumeFrom` to continue. */
  createLaunch(input: CreateLaunchInput, onStep: (steps: CreateStep[]) => void, opts?: { resumeFrom?: CreateStepId }): Promise<{ id: string }>;

  /** Fetch the authenticated wallet's bids from the backend. */
  getMyBids(): Promise<MyBid[]>;

  verifyReceipt(receiptId: string): Promise<ReceiptVerification>;
  
  positions(account: string): Promise<Position[]>;
}
