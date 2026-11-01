# Backend Phase 2 — implementation boundary

## Current milestone
Introduce a separate Fastify + PostgreSQL service while keeping the Next.js UI and `LaunchApi` interface unchanged. This is an integration foundation, not the production protocol.

## Data invariants
- Token amounts are stored as unsigned integer strings in smallest units.
- One bid per `(launchId, bidder)` is enforced by a database unique constraint.
- One payment check backs at most one bid.
- Bid ciphertext and commitment are persisted; plaintext bid fields are not accepted by the bid endpoint.
- Launch bid count increments in the same database transaction as bid insertion.

## Explicit trust boundary
The included payment provider is a development stub. It does not lock assets. `bidder` is currently supplied in the request and is not authenticated. Therefore all write endpoints are local-development-only and must not be publicly deployed.

## Next work
1. Add NEAR wallet signature verification and account-bound sessions.
2. Replace mock payment provider with OutLayer's verified payment-check API.
3. Add enclave-key registration and attestation verification.
4. Add withdrawal and ownership checks.
5. Implement a frontend HTTP adapter matching `LaunchApi`.
6. Add integration tests with PostgreSQL and provider failure injection.
