# Snipe-Proof Auction Core v1

## Scope

This is the deterministic integer-only reference implementation for the sealed-bid, uniform-price auction. It is the source of truth for auction mathematics in application and enclave code. It does not custody funds, authenticate an enclave, verify OutLayer attestations, or prove that an input bid was actually funded; those are integration responsibilities.

## Units

- `supply` and each bid `quantity` are unsigned integer strings in the launched token's smallest units.
- `tokenDecimals` is the launched token's NEP-141 decimal count.
- `reservePrice` and each `limitPrice` are unsigned integer strings in payment-token smallest units per one whole launched token.
- Maximum collateral and settlement payment are `ceil(priceAtomic * quantityAtomic / 10^tokenDecimals)` payment-token atomic units. Rounding up prevents under-collateralization.
- All values are canonical base-10 integer strings. No JSON number is used for financial values.

## Algorithm

1. Validate schema, positive supply/reserve/bid values, unique bid IDs, and configured limits.
2. Exclude bids below reserve from eligible demand; they remain in output and receive zero allocation.
3. If eligible demand is below supply, clear at reserve and fill all eligible demand; remaining supply is unsold.
4. Otherwise sort eligible bids by descending limit price. The clearing price is the limit price at which cumulative demand first reaches supply.
5. Fill all bids strictly above the clearing price in full.
6. Allocate the remaining supply pro-rata across all bids exactly at the clearing price, using largest remainder. Equal remainders are resolved by ascending byte/code-unit lexicographic bid ID.
7. Calculate each bidder's payment at the common clearing price, rounded up to payment-token atomic units; refund is locked collateral less payment.
8. Enforce `sold <= supply` and `totalLocked = totalRaised + totalRefunded`.

## Determinism and tie policy

V1 uses bid ID as the final deterministic tie-break for equal largest remainders. This is deliberately not described as verifiable randomness. If the product requires unpredictable tie resolution, specify and integrate a verifiable randomness source in a new version, bind its seed to the auction ID and input commitment, and update the Rust engine and shared vectors together.

## Security boundaries

- This engine does not establish that the bidder's deposit exists. The payment-check/escrow layer must prove available collateral before accepting a bid and re-check it before settlement.
- A TEE attestation does not prove algorithm correctness. The WASM binary must be audited and tested against shared vectors.
- Never parse financial amounts through JavaScript `number` or floating-point arithmetic in production paths.
- Keep the old `src/lib/auction.ts` API only as a presentation adapter for the existing demo UI. Protocol/backend/enclave code must use `clearAuctionExact` and string atomic units.

## Shared conformance vector

`shared/test-vectors/auction-v1.json` is the first canonical input/output vector. The future Rust engine must deserialize this input and produce the same expected output byte-for-byte after canonical serialization.
