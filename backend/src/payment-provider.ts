/**
 * DEVELOPMENT ONLY.
 *
 * This adapter simulates an OutLayer payment check. It does not move funds,
 * call NEAR Intents, or create an enforceable payment claim. Do not deploy it
 * to a public environment. Replace it with the verified OutLayer integration
 * before accepting real bids or describing deposits as locked funds.
 */
export interface PaymentProvider {
  create(input: { launchId: string; bidder: string; token: string; amountAtomic: string }):
    Promise<{ providerRef: string; claimKey: string; expiresAt: Date }>;
  reclaim(providerRef: string): Promise<void>;
}

export class MockPaymentProvider implements PaymentProvider {
  async create(_input: { launchId: string; bidder: string; token: string; amountAtomic: string }) {
    return {
      providerRef: `mock_${crypto.randomUUID()}`,
      claimKey: `mock_claim_${crypto.randomUUID()}`,
      expiresAt: new Date(Date.now() + 6 * 60 * 60 * 1000),
    };
  }

  async reclaim(_providerRef: string) {
    // Intentionally a no-op: this is not a real payment integration.
  }
}
