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
  kind: "tdx";
  /** Opaque quote bytes, base64. */
  quote: string;
  codeHash: string;
  inputHash: string;
  resultHash: string;
  /** Hex: the key that signed the result. */
  signer: string;
};

export type Allocation = { bidder: string; limit: number; qty: number; filled: number; paid: number; refund: number; isBot?: boolean };

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

export interface LaunchApi {
  listLaunches(): Promise<Launch[]>;
  getLaunch(id: string): Promise<Launch | null>;
  /** `null` until the launch has settled. */
  getResult(id: string): Promise<Result | null>;
  getEnclaveKey(launchId: string): Promise<EnclaveKey>;

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
  
  positions(account: string): Promise<Position[]>;
}
