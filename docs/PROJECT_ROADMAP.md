> **Source:** written on 9 Nov 2026 by a teammate (with their agent) who is working on the OutLayer and auction-engine side. Saved here unchanged except that its tables were converted to standard Markdown tables. The current-state record is in [`PROJECT_PROGRESS.md`](PROJECT_PROGRESS.md).

# Snipe-Proof Meme Launch --- Future Roadmap to Project Completion

**Document type:** Product, engineering, and delivery roadmap\
**Last updated:** 9 November 2026\
**Repository:** `Meme-Proof-Near`\
**NEAR testnet account:** `proofmeme.testnet`\
**OutLayer project:** `proofmeme.testnet/snipe-proof-auction`\
**Current phase:** Auction-engine prototype and OutLayer integration
investigation

------------------------------------------------------------------------

## 1. Purpose of this roadmap

This document defines the planned work from the current prototype
through a demonstrable end-to-end MVP and, later, a production-ready
system.

It is intended to be the project's forward-looking source of truth. It
separates:

-   Work already completed.
-   Work currently blocked.
-   Work required for a hackathon-quality MVP.
-   Additional work required before real users or real funds can safely
    use the system.

The roadmap is a plan, not a statement that future integrations or
platform capabilities have already been achieved. In particular,
OutLayer execution, TEE attestation verification, private bidding, and
on-chain settlement remain unverified or incomplete.

## 2. Product goal

Build a meme-token launch mechanism designed to reduce the advantages of
sniping and opaque allocation.

The proposed mechanism is a sealed-bid, uniform-price auction:

1.  A project creator configures a launch and token supply for sale.
2.  Participants submit bids during a defined bidding window.
3.  Bid information is kept confidential during the intended sealed-bid
    period.
4.  After bidding closes, the auction engine calculates allocations and
    a common clearing price.
5.  The execution result is accompanied by verifiable evidence, subject
    to the guarantees actually provided by the selected execution
    environment.
6.  Participants can inspect the final outcome and understand their
    allocation.
7.  Settlement and token distribution occur through the chosen on-chain
    mechanism.

The exact auction economics, privacy guarantees, settlement asset, token
standard, and cancellation/refund policy must be finalized before
production.

## 3. Definition of completion

### 3.1 Hackathon MVP completion

The MVP is complete when a reviewer can follow one full demo flow:

-   Create or load a test launch.
-   Configure supply, reserve price, and bidding window.
-   Submit multiple test bids.
-   Demonstrate that bids are not publicly exposed before the
    reveal/clearing stage, to the extent supported by the implemented
    architecture.
-   Close the auction.
-   Execute the Rust auction engine through the selected OutLayer
    workflow, or clearly demonstrate a local fallback if the testnet
    integration remains unavailable.
-   Show the allocations and common clearing price.
-   Show execution metadata and any attestation that has actually been
    verified.
-   Persist and display the auction result in the application.
-   Explain which parts are testnet, mocked, locally executed, or fully
    on-chain.

A demo that uses local execution or mocked settlement must label those
parts honestly. It must not be presented as a successful TEE-backed
execution or live token settlement.

### 3.2 Production completion

Production completion requires more than a successful demo. It
additionally requires:

-   A documented and reviewed auction specification.
-   A robust privacy and threat model.
-   Cryptographic verification of the relevant execution evidence.
-   Audited or independently reviewed smart contracts and settlement
    logic.
-   Real token/payment integration.
-   Secure key and secret management.
-   Replay protection, idempotency, and failure recovery.
-   Monitoring, incident response, and operational procedures.
-   Independent security review and testing.
-   Legal and compliance review appropriate to the jurisdictions and
    assets involved.

The hackathon MVP and production system are separate milestones.

------------------------------------------------------------------------

## 4. Current baseline

### Completed

-   Rust auction-clearing prototype implemented in
    `outlayer-auction/src/main.rs`.
-   Prototype supports price-priority allocation, pro-rata allocation at
    an oversubscribed price tier, largest-remainder distribution,
    deterministic tie-breaking, reserve-price handling, and validation
    of several invalid inputs.
-   Original Rust crate successfully compiled to `wasm32-wasip2`.
-   Local Wasmtime health and auction tests returned expected output.
-   OutLayer CLI `0.2.1` installed.
-   NEAR testnet login completed with `proofmeme.testnet`.
-   OutLayer project scaffold created in `snipe-proof-auction/`.
-   OutLayer project registered as
    `proofmeme.testnet/snipe-proof-auction`.
-   Project status showed UUID `p00000000000000d5` and active version
    hash
    `f52c7cb031343081dd4a2b47fe366719fd83a98fe77e62be2c5d638a5a43b405`.

### Current blocker

FastFS upload and retrieval have not been verified:

-   WASM upload transaction
    `APbBBdHbXrPtAqtD5u57D67onCu3DbMy4XtyhbkkRydo` failed with
    `Exceeded the prepaid gas`.
-   Small JSON upload transaction
    `7C9x5QtK9MS1Q8dyygBNSFjdVYT2Ahkio7Ve9uCXvLNK` failed with the same
    error.
-   Requests to `https://test.fastfs.io` and the generated object URL
    returned HTTP 502.
-   An OutLayer execution callback reported
    `wasm_url could not be fetched`.
-   That execution used zero instructions, so the auction engine did not
    run inside OutLayer.
-   No TEE attestation has been obtained or verified.

### Important code distinction

There are two Rust crates:

-   `outlayer-auction/`: contains the implemented auction engine.
-   `snipe-proof-auction/`: currently contains the generated OutLayer
    scaffold; its `src/main.rs` is still a Hello World/JSON echo
    program.

The future implementation must consolidate the actual auction engine
into the intended OutLayer project source. Do not assume the scaffold
currently builds the auction engine.

------------------------------------------------------------------------

# 5. Roadmap overview

The work is divided into sequential phases. Each phase has an outcome
and an explicit completion gate.

| Phase | Focus | Main outcome |
|---|---|---|
| 0 | Preserve and organize | Clean, reproducible repository |
| 1 | Resolve OutLayer artifact delivery | Verified, retrievable WASM artifact |
| 2 | Integrate the auction engine | One canonical Rust/WASM implementation |
| 3 | Harden auction correctness | Written specification and automated tests |
| 4 | Validate OutLayer execution and evidence | Successful remote run and verified attestation, if supported |
| 5 | Build auction lifecycle backend | End-to-end launch and bid APIs |
| 6 | Implement bid privacy | Confidential bid handling and threat-model validation |
| 7 | Implement settlement | Testnet payment, refunds, and token allocation |
| 8 | Build frontend experience | Complete user-facing auction flow |
| 9 | End-to-end testing and security | Reliable demo with documented limitations |
| 10 | Demo, documentation, and release | Hackathon-ready MVP |
| 11 | Production hardening | Audited, monitored production system |

Phases may overlap where safe, but later phases must not assume an
earlier phase has passed its completion gate.

------------------------------------------------------------------------

# 6. Detailed implementation plan

## Phase 0 --- Preserve the current checkpoint and organize the repository

**Goal:** Make the current state reproducible before changing
architecture.

### Tasks

1.  Inspect Git status and all pending changes.
2.  Confirm there are no private keys, wallet API keys, `.env` secrets,
    or local credential files in the repository.
3.  Decide whether `auction-input.json` is a test fixture to retain,
    rename, or ignore.
4.  Add this roadmap as `PROJECT_ROADMAP.md`.
5.  Keep the existing progress/handoff document as
    `PROJECT_PROGRESS.md`.
6.  Add a root README describing the project and current status.
7.  Decide on one canonical Rust crate for the auction workload.
8.  Remove or clearly label duplicate/scaffold code once the intended
    source has been consolidated.
9.  Add a `.gitignore` for Rust build outputs, local environment files,
    and credentials.

### Suggested eventual repository layout

``` text
Meme-Proof-Near/
├── app/                         # Next.js frontend
├── backend/                     # Fastify API
├── outlayer-auction/            # Canonical Rust auction workload (or rename)
│   ├── Cargo.toml
│   ├── src/
│   └── tests/
├── docs/
│   ├── PROJECT_PROGRESS.md
│   ├── PROJECT_ROADMAP.md
│   ├── AUCTION_SPEC.md
│   ├── PRIVACY_THREAT_MODEL.md
│   └── DEPLOYMENT.md
├── prisma/
│   └── schema.prisma
├── package.json
└── README.md
```

This is a target layout, not a claim that every directory currently
exists. Preserve the working Next.js and backend structure rather than
moving files blindly.

### Completion gate

-   Git working tree is understood.
-   No credentials are staged.
-   The current Rust auction source and known-good test input are
    preserved.
-   The team can identify which crate is authoritative.

------------------------------------------------------------------------

## Phase 1 --- Resolve OutLayer and FastFS artifact delivery

**Goal:** Get a WASM artifact that OutLayer can actually retrieve.

### Tasks

1.  Contact OutLayer support with the failed upload transaction IDs and
    the `wasm_url could not be fetched` execution response.
2.  Ask whether FastFS testnet is operational and whether upload
    gas/prepaid-gas requirements have changed.
3.  Ask for the documented method to verify that an upload transaction
    and object storage both succeeded.
4.  Ask whether a supported alternative artifact source or deployment
    path is available.
5.  Confirm whether a payment key and nonce are required for the
    intended execution/logging workflow.
6.  Do not repeatedly upload or execute while the platform issue is
    unresolved.
7.  Once support provides instructions, perform one small controlled
    upload.
8.  Verify the upload transaction status on NEARBlocks.
9.  Fetch the exact object URL from PowerShell.
10. Compare the downloaded file's SHA256 with the local artifact.
11. Only after retrieval succeeds, upload the real auction WASM.
12. Record the successful transaction ID, URL, hash, and deployment
    version.

### Verification commands

Rebuild and hash the local artifact:

``` powershell
cd C:\Users\kaush\Meme-Proof-Near\outlayer-auction
cargo build --target wasm32-wasip2 --release
Get-FileHash .\target\wasm32-wasip2\release\outlayer-auction.wasm -Algorithm SHA256
```

After OutLayer provides a working artifact URL, download it:

``` powershell
Invoke-WebRequest `
  -Uri "<VERIFIED_FASTFS_URL>" `
  -OutFile .\downloaded-auction.wasm
```

Compare hashes:

``` powershell
Get-FileHash .\downloaded-auction.wasm -Algorithm SHA256
```

The local and downloaded hashes must match exactly.

### Completion gate

-   Upload transaction is successful.
-   The object can be fetched.
-   Downloaded bytes match the local WASM hash.
-   OutLayer confirms the supported artifact workflow.

**Fallback decision:** If OutLayer testnet remains unavailable, continue
local development and prepare a clearly labeled local Wasmtime demo
path. Do not claim remote TEE execution. Revisit OutLayer when the
service is available.

------------------------------------------------------------------------

## Phase 2 --- Consolidate and integrate the auction engine

**Goal:** Ensure the OutLayer project builds the actual auction engine,
not the generated Hello World scaffold.

### Tasks

1.  Choose the canonical Rust crate location.
2.  Move or copy the tested auction implementation into that crate
    deliberately.
3.  Keep `Cargo.toml`, binary name, and build output path consistent.
4.  Ensure the OutLayer build script compiles the canonical auction
    program.
5.  Define one JSON request schema and one JSON response schema.
6.  Add an explicit `health` action if the OutLayer runtime expects
    health checks.
7.  Keep the `clear_auction` action for auction calculation.
8.  Ensure standard output contains only the machine-readable response;
    send diagnostics to standard error.
9.  Build locally for `wasm32-wasip2`.
10. Run the exact artifact with Wasmtime before uploading.

### Proposed request schema

``` json
{
  "schema_version": 1,
  "action": "clear_auction",
  "auction_id": "demo-auction-001",
  "supply": 100,
  "reserve_price": 10,
  "bids": [
    {
      "bidder": "alice",
      "quantity": 60,
      "limit_price": 20
    },
    {
      "bidder": "bob",
      "quantity": 80,
      "limit_price": 15
    }
  ]
}
```

The `auction_id` and `schema_version` are proposed additions. They must
be implemented and validated before being used.

### Proposed response schema

``` json
{
  "schema_version": 1,
  "status": "success",
  "auction_id": "demo-auction-001",
  "clearing_price": 15,
  "total_allocated": 100,
  "remaining_supply": 0,
  "winner_count": 2,
  "allocations": [
    {
      "bidder": "alice",
      "requested_quantity": 60,
      "allocated_quantity": 60,
      "limit_price": 20,
      "clearing_price": 15
    },
    {
      "bidder": "bob",
      "requested_quantity": 80,
      "allocated_quantity": 40,
      "limit_price": 15,
      "clearing_price": 15
    }
  ]
}
```

This is an illustrative schema. The production schema must be finalized
with the auction specification.

### Completion gate

-   One canonical crate contains the actual auction engine.
-   The OutLayer build produces the correct WASM artifact.
-   Local Wasmtime runs health and auction requests successfully.
-   Input and output schemas are versioned and documented.

------------------------------------------------------------------------

## Phase 3 --- Formalize and harden auction correctness

**Goal:** Turn the prototype rules into a precise, testable auction
specification.

### Tasks

1.  Write `docs/AUCTION_SPEC.md`.
2.  Define the auction timeline: creation, bid open, bid close,
    clearing, result publication, settlement.
3.  Define the reserve-price policy.
4.  Define the clearing-price rule.
5.  Define whether partially filled bids are allowed.
6.  Define how equal-price bids share remaining supply.
7.  Define the tie-breaking method and whether it can be manipulated.
8.  Define one-bid-per-wallet versus multiple bids per wallet.
9.  Define cancellation and amendment rules before bid close.
10. Define the behavior when there are no eligible bids.
11. Define what happens when total demand is below supply.
12. Define integer units, decimal precision, and rounding.
13. Define overflow and malformed-input behavior.
14. Define deterministic output ordering.

### Automated test cases

At minimum, test:

-   Empty bid list.
-   Zero supply.
-   Empty bidder ID.
-   Zero quantity.
-   Zero limit price.
-   All bids below reserve.
-   One eligible bid.
-   Demand exactly equals supply.
-   Demand below supply.
-   Demand above supply.
-   Multiple bids at the same price.
-   Oversubscribed marginal price tier.
-   Equal largest remainders.
-   Duplicate bidder IDs.
-   Very large quantities and checked-arithmetic overflow.
-   Bid order permutations produce identical results.
-   Invalid action and invalid JSON.

### Property/invariant tests

For every successful result:

-   Total allocated quantity must not exceed supply.
-   Each allocation must be no greater than that bid's requested
    quantity.
-   No bid below reserve receives an allocation.
-   Allocations must follow the specified price-priority policy.
-   All allocations must use the same final clearing price.
-   Output must be deterministic for identical normalized input.
-   The sum of allocation quantities must equal `total_allocated`.
-   `total_allocated + remaining_supply` must equal original supply.

Use Rust unit tests and, where useful, property-based testing.

### Completion gate

-   Auction rules are documented.
-   Automated tests cover edge cases and invariants.
-   Test suite passes locally and in CI.
-   Economic decisions are no longer implicit in code comments.

------------------------------------------------------------------------

## Phase 4 --- Validate OutLayer execution and attestation

**Goal:** Prove that the intended artifact executes remotely and
understand exactly what evidence is returned.

### Tasks

1.  Deploy the verified WASM artifact using the supported OutLayer
    workflow.
2.  Check the active project version and artifact hash.
3.  Run a health request.
4.  Inspect the execution result, not just the outer NEAR transaction
    status.
5.  Run a known auction fixture.
6.  Compare the remote result byte-for-byte or semantically with the
    local expected result.
7.  Inspect the execution metadata and resource usage.
8.  Determine what attestation material OutLayer returns for this
    execution mode.
9.  Read the official verification procedure.
10. Implement verification in a small independent script or backend
    module.
11. Test invalid, missing, mismatched, or stale attestation data.
12. Persist execution ID, project/version, WASM hash, input hash, result
    hash, and attestation reference.

### Evidence required before making claims

A successful NEAR transaction alone is not enough. The project must
distinguish:

-   NEAR request transaction success.
-   OutLayer callback success.
-   WASM compilation success.
-   WASM execution success.
-   Correct auction output.
-   Attestation availability.
-   Attestation cryptographic verification.
-   Evidence that the attested code hash and input correspond to the
    auction being displayed.

Do not describe the auction as TEE-protected or verifiably executed
until the relevant evidence has been checked.

### Completion gate

-   OutLayer successfully fetches and executes the canonical WASM.
-   Remote result matches the local expected result.
-   Attestation format and verification process are understood.
-   The backend can reject a mismatched or invalid attestation.

If the platform cannot provide the required evidence on testnet, record
the limitation and use the local demo fallback.

------------------------------------------------------------------------

## Phase 5 --- Build the auction lifecycle backend

**Goal:** Make the backend own the auction state machine and coordinate
the execution workflow.

The existing project has used Fastify and Prisma/PostgreSQL. Preserve
the working implementation and adapt its actual models rather than
replacing it without inspection.

### Proposed lifecycle

``` text
DRAFT
  |
  v
SCHEDULED
  |
  v
BIDDING_OPEN
  |
  v
BIDDING_CLOSED
  |
  v
CLEARING
  |
  +------> CLEARING_FAILED
  |
  v
CLEARED
  |
  v
SETTLEMENT_PENDING
  |
  +------> SETTLEMENT_FAILED
  |
  v
SETTLED
```

The final states and transitions must be agreed and implemented
explicitly.

### Backend responsibilities

-   Authenticate users/wallets.
-   Create and configure auctions.
-   Validate auction configuration.
-   Enforce open/close timestamps server-side.
-   Accept bids only during the valid window.
-   Enforce bid limits and duplicate-bid policy.
-   Store bids securely according to the privacy design.
-   Prevent unauthorized auction closure or clearing.
-   Create a canonical execution input.
-   Submit the execution request.
-   Track pending, successful, and failed execution states.
-   Verify returned data and attestation.
-   Store immutable auction result records.
-   Trigger settlement only after the required checks pass.
-   Support safe retries without double execution or double payment.

### Proposed API surface

Exact routes should be aligned with the existing Fastify app:

``` text
POST   /api/auctions
GET    /api/auctions
GET    /api/auctions/:auctionId
POST   /api/auctions/:auctionId/bids
GET    /api/auctions/:auctionId/my-bid
POST   /api/auctions/:auctionId/close
POST   /api/auctions/:auctionId/clear
GET    /api/auctions/:auctionId/result
GET    /api/auctions/:auctionId/execution
```

Do not expose private bids through a public list endpoint. A user's own
bid endpoint must enforce ownership.

### Data model planning

Review the existing Prisma models (`Launch`, `PaymentCheck`, `Bid`, and
related enums) before changing them.

Potential additional fields/entities:

-   Auction configuration and immutable configuration hash.
-   Bid commitment or encrypted bid payload, depending on privacy
    design.
-   Bid submission timestamp and status.
-   Execution request ID.
-   WASM version and hash.
-   Canonical input hash.
-   Result JSON and result hash.
-   Attestation payload/reference and verification status.
-   Settlement transaction IDs.
-   Idempotency keys and retry metadata.

Avoid storing secrets or private encryption keys in ordinary database
columns.

### Completion gate

-   Auction state transitions are enforced server-side.
-   API validation and authorization tests pass.
-   Duplicate submissions and retries are safe.
-   Public endpoints do not leak private bid information.
-   Execution records can be traced to the exact auction input and code
    version.

------------------------------------------------------------------------

## Phase 6 --- Implement and validate bid privacy

**Goal:** Ensure the sealed-bid promise is supported by the actual
system design.

This phase is security-critical. A private UI or hidden database field
does not by itself create a sealed-bid auction.

### Design decisions to make

1.  Who can see a bid when it is submitted?
2.  Can the application operator or backend administrator read bids
    before close?
3.  Does OutLayer receive plaintext bids?
4.  At what point are bids decrypted?
5.  Who controls decryption keys?
6.  Can a bidder change or cancel a bid?
7.  How is a bidder prevented from submitting multiple identities?
8.  What data is visible on NEAR, in logs, in FastFS, and in the
    frontend?
9.  What happens if the TEE or execution provider is unavailable?
10. What is the recovery path if a key is lost?

### Possible approaches to evaluate

-   Encrypt bids before they reach the backend, with decryption
    restricted to the intended execution environment.
-   Use a commitment/reveal scheme if it fits the product's UX and
    privacy requirements.
-   Use an OutLayer-supported secrets mechanism only after its exact
    lifecycle and security guarantees are confirmed.
-   Consider threshold or multi-party decryption only if the complexity
    is justified and the implementation can be reviewed.

Do not invent a cryptographic design ad hoc. Choose a design based on
the platform's documented guarantees and get it reviewed.

### Threat model

Document protection against:

-   Other bidders viewing bids early.
-   Backend/database operators viewing bids early.
-   Unauthorized bid modification.
-   Replay and duplicate submission.
-   Malicious or compromised execution inputs.
-   Incorrect code version execution.
-   Attestation substitution.
-   Timing and metadata leakage.
-   Denial of service during the bidding window.

### Completion gate

-   A written threat model exists.
-   The chosen confidentiality mechanism is implemented.
-   Tests demonstrate that unauthorized parties cannot retrieve
    plaintext bids through the application.
-   Key handling and failure recovery are documented.
-   Privacy claims match the actual cryptographic and platform
    guarantees.

------------------------------------------------------------------------

## Phase 7 --- Implement payments, refunds, and token settlement

**Goal:** Move from a calculation-only prototype to a complete launch
flow on testnet.

The backend has previously used a mock payment provider. That must
remain clearly labeled until replaced by a real integration.

### Tasks

1.  Choose the settlement asset and token standard.
2.  Confirm supported NEAR testnet token contracts and wallet flow.
3.  Define whether bidders escrow funds before the auction closes.
4.  Define how bid value is calculated and checked.
5.  Implement payment verification against chain data.
6.  Prevent reuse of a payment transaction for multiple bids.
7.  Define how winners pay the clearing price.
8.  Define how overpaid escrow is refunded.
9.  Define how losing bidders reclaim funds.
10. Define what happens when settlement partially fails.
11. Implement idempotent settlement records.
12. Record transaction hashes and final chain status.
13. Add testnet integration tests.
14. Add clear UI states for pending, successful, and failed settlement.

### Accounting invariants

-   No bidder is charged more than the agreed amount.
-   A payment cannot be credited to two bids.
-   Total token allocation does not exceed configured sale supply.
-   Total collected funds reconcile with winner allocations and fees.
-   Refunds cannot be claimed twice.
-   Settlement retries cannot double-transfer assets.

### Completion gate

-   Testnet payment verification works.
-   Winner settlement and loser refunds work end-to-end.
-   Every transfer can be reconciled to an auction and participant.
-   Failure and retry paths are tested.
-   No mock provider is used in the live testnet demo path unless
    clearly labeled.

------------------------------------------------------------------------

## Phase 8 --- Complete the frontend experience

**Goal:** Make the full auction process understandable and usable.

The existing Next.js frontend should be improved incrementally. Inspect
the actual pages and components before replacing them.

### Core screens

1.  **Landing page**
    -   Explain the problem and proposed mechanism.
    -   Show how the auction differs from a typical public launch.
    -   Make privacy and fairness claims precise.
2.  **Launch discovery**
    -   List active, upcoming, and completed auctions.
    -   Show token/project information and auction status.
3.  **Auction detail**
    -   Show token sale supply, reserve price, start/end time, and
        rules.
    -   Show a countdown based on server-authoritative timestamps.
    -   Explain the bidding and settlement process.
4.  **Submit bid**
    -   Connect wallet.
    -   Enter quantity and limit price.
    -   Show validation and payment requirements.
    -   Confirm the bid submission.
    -   Do not reveal other participants' private bids.
5.  **My participation**
    -   Show the connected user's own bid and submission state.
    -   Show whether the bid is pending, accepted, or rejected.
6.  **Auction result**
    -   Show clearing price, total allocation, and participant
        allocation.
    -   Explain refunds or amount due.
    -   Link to relevant execution and settlement evidence.
7.  **Creator/admin flow**
    -   Configure and schedule a launch.
    -   Monitor the bidding window.
    -   Close and clear the auction with appropriate authorization.

### UX requirements

-   Clear loading, empty, success, and error states.
-   Wallet connection and network mismatch handling.
-   Mobile-friendly responsive layout.
-   No fake live data presented as real.
-   No public endpoint or UI exposing sealed bids.
-   Distinguish testnet, local demo, and production.
-   Explain execution evidence in plain language.

### Completion gate

A first-time reviewer can complete the intended testnet demo without
manual database edits or developer-only steps.

------------------------------------------------------------------------

## Phase 9 --- End-to-end tests, security, and reliability

**Goal:** Test the whole product as a system rather than testing only
individual modules.

### End-to-end scenarios

1.  Create an auction.
2.  Submit a valid bid.
3.  Reject an invalid bid.
4.  Reject a bid after the close time.
5.  Prevent a participant from reading another participant's sealed bid.
6.  Close the auction.
7.  Submit the canonical input to the execution environment.
8.  Handle execution pending.
9.  Handle execution failure.
10. Validate a successful result.
11. Reject a result with a mismatched code hash or input hash.
12. Settle winners.
13. Refund losing bidders.
14. Retry a failed settlement without double payment.
15. Display the final result and evidence.

### Reliability work

-   Add structured logs with sensitive values redacted.
-   Add request IDs and auction IDs to logs.
-   Add timeouts and bounded retries.
-   Make execution and settlement idempotent.
-   Add database transaction boundaries.
-   Add rate limiting and abuse protection.
-   Add input-size limits.
-   Add monitoring for failed auctions and pending settlements.
-   Add backups and a recovery plan for persistent data.

### Security review checklist

-   Authentication and wallet ownership checks.
-   Authorization for creator/admin actions.
-   SQL/ORM query safety.
-   Input validation and serialization.
-   Secret management.
-   Dependency and build reproducibility.
-   WASM artifact hash pinning.
-   Attestation verification.
-   Replay protection.
-   Privacy and metadata leakage.
-   Settlement accounting.
-   Denial-of-service protections.

### Completion gate

-   Automated tests pass.
-   Critical end-to-end flows pass on testnet.
-   Known limitations are documented.
-   No critical unresolved security issue is knowingly included in the
    demo path.

------------------------------------------------------------------------

## Phase 10 --- Demo preparation, documentation, and release

**Goal:** Produce a reliable, understandable hackathon submission.

### Deliverables

-   Working testnet demo or transparently labeled local fallback.
-   Clean GitHub repository.
-   Root README with setup instructions.
-   Architecture diagram.
-   Auction specification.
-   Privacy threat model.
-   Deployment guide.
-   Test instructions and sample fixture.
-   Demo script.
-   Screenshots or short demo recording.
-   Known limitations section.
-   Clear explanation of what OutLayer/TEE evidence does and does not
    prove.

### Suggested demo sequence

1.  Introduce the problem: public launch mechanics can reward fast bots
    and expose demand.
2.  Explain the sealed-bid auction concept.
3.  Create or open a demo auction.
4.  Submit bids from multiple test participants.
5.  Show that private bids are not publicly listed.
6.  Close the auction.
7.  Show the auction execution request and artifact version/hash.
8.  Show the actual result and, only if verified, its attestation.
9.  Show allocations and clearing price.
10. Show settlement/refund status.
11. Explain current testnet and prototype limitations.

### Completion gate

-   Demo is rehearsed from a clean browser/session.
-   No manual code edits or database patches are required during the
    demo.
-   Every displayed status corresponds to real test data.
-   All claims are supported by visible evidence or explicitly labeled
    as planned.

------------------------------------------------------------------------

## Phase 11 --- Production hardening (after the MVP)

**Goal:** Prepare the product for real users and real assets.

This phase is not required to claim a hackathon prototype, but it is
required before production use.

### Workstreams

**Smart contracts and settlement**

-   Independent design review.
-   Contract tests and invariant testing.
-   External audit.
-   Upgrade and emergency-pause strategy.
-   Formal accounting and reconciliation.

**Privacy and cryptography**

-   Independent cryptographic review.
-   Key lifecycle and rotation.
-   Secure recovery and disaster procedures.
-   Side-channel and metadata analysis appropriate to the platform.
-   Verification of TEE attestation and platform trust assumptions.

**Infrastructure**

-   Production database and backups.
-   Secret manager.
-   Monitoring and alerting.
-   Incident response.
-   Rate limits and abuse controls.
-   Deployment rollback and artifact provenance.

**Product and operations**

-   Terms and risk disclosures.
-   Support and dispute process.
-   Launch creator verification policy.
-   Compliance review for target markets and assets.
-   User education and transparent fee disclosure.

### Completion gate

Production readiness is approved only after independent security review,
operational readiness, and all required legal/compliance checks.

------------------------------------------------------------------------

# 7. Technical decisions that must be finalized

These decisions affect multiple phases and should be tracked explicitly.

| Decision | Current state | Needed decision |
|---|---|---|
| Auction pricing rule | Prototype uses reserve price when demand is below supply and marginal tier price when oversubscribed | Approve formal economic specification |
| Bid policy | One bid per bidder in Rust prototype | Decide one bid or multiple bids per wallet |
| Tie-break | Bidder ID used for deterministic remainder ties | Review fairness/manipulation implications |
| Privacy mechanism | Intended sealed-bid flow; not implemented/verified end-to-end | Choose and review encryption/TEE/commit-reveal design |
| OutLayer artifact source | FastFS testnet currently failing | Confirm supported working deployment path |
| Attestation | Not obtained or verified | Confirm format, trust model, and verification method |
| Payment asset | Not finalized in this roadmap | Choose token and escrow/settlement model |
| Token standard | Not finalized | Select and test the intended standard |
| Fees | Not finalized | Define transparent fee and accounting policy |
| Failure handling | Prototype-level only | Define cancellation, retry, refund, and recovery rules |

Record decisions in `docs/DECISIONS.md` with date, rationale, and
consequences.

------------------------------------------------------------------------

# 8. Recommended order of work from today

The immediate sequence should be:

1.  **Checkpoint the repository.** Inspect Git status, exclude secrets,
    and push the known-good code.
2.  **Resolve the FastFS blocker.** Contact OutLayer and wait for a
    documented answer before spending more testnet funds.
3.  **Consolidate the Rust source.** Make the tested auction engine the
    actual source built by the OutLayer project.
4.  **Write tests and the auction specification.** Make the algorithm's
    economic behavior explicit.
5.  **Validate local WASM execution.** Ensure the exact artifact and
    fixture work locally.
6.  **Retry remote OutLayer execution only after artifact delivery is
    verified.**
7.  **Verify attestation.** Do not integrate or advertise a TEE
    guarantee until this passes.
8.  **Build the backend lifecycle.** Create auctions, accept bids,
    close, execute, persist, and publish results.
9.  **Implement bid confidentiality.** Make the sealed-bid promise true
    in the architecture.
10. **Integrate testnet settlement.** Replace mock payment behavior for
    the demo path.
11. **Finish the frontend flow.**
12. **Run end-to-end tests and rehearse the demo.**
13. **Prepare the submission and technical documentation.**

Do not work around a broken FastFS upload by pretending the remote
auction execution succeeded. Continue the local Rust, test, backend, and
frontend work in parallel where possible.

------------------------------------------------------------------------

# 9. Project management checklist

Use this as the master checklist. Mark an item complete only when its
completion evidence exists.

## Foundation

-   [ ] Repository checkpoint pushed
-   [ ] Secrets excluded from Git
-   [ ] Canonical Rust crate selected
-   [ ] Project README updated
-   [ ] Progress and roadmap documents committed

## OutLayer

-   [ ] OutLayer support response received
-   [ ] Supported artifact upload path confirmed
-   [ ] FastFS or alternative artifact retrieval verified
-   [ ] Local and retrieved artifact hashes match
-   [ ] Canonical WASM deployed
-   [ ] Remote health execution succeeds
-   [ ] Remote auction execution succeeds
-   [ ] Execution result matches local result
-   [ ] Attestation format documented
-   [ ] Attestation verification passes

## Auction engine

-   [ ] Auction specification written
-   [ ] Request/response schema versioned
-   [ ] Unit tests added
-   [ ] Edge cases tested
-   [ ] Property/invariant tests added
-   [ ] Determinism tested
-   [ ] Tie-break policy reviewed

## Backend

-   [ ] Auction lifecycle state machine implemented
-   [ ] Auction creation API implemented
-   [ ] Bid submission API implemented
-   [ ] Bid privacy enforced
-   [ ] Auction close/clear flow implemented
-   [ ] Execution records persisted
-   [ ] Attestation verification integrated
-   [ ] Retry/idempotency logic tested
-   [ ] Result API implemented

## Privacy

-   [ ] Threat model documented
-   [ ] Bid confidentiality design selected
-   [ ] Key management implemented
-   [ ] Unauthorized bid access tests pass
-   [ ] Privacy claims independently reviewed

## Payments and settlement

-   [ ] Settlement asset selected
-   [ ] Token standard selected
-   [ ] Testnet payment verification implemented
-   [ ] Winner settlement implemented
-   [ ] Loser refund/reclaim implemented
-   [ ] Double-spend/double-claim tests pass
-   [ ] Settlement reconciliation passes

## Frontend

-   [ ] Landing page
-   [ ] Launch discovery
-   [ ] Auction detail page
-   [ ] Wallet connection
-   [ ] Bid submission flow
-   [ ] My participation page
-   [ ] Auction result page
-   [ ] Creator/admin flow
-   [ ] Responsive and error states

## Release

-   [ ] End-to-end tests pass
-   [ ] Security review completed
-   [ ] Demo script rehearsed
-   [ ] README and setup instructions complete
-   [ ] Architecture diagram complete
-   [ ] Known limitations documented
-   [ ] Hackathon submission ready

## Production (later)

-   [ ] Independent smart-contract audit
-   [ ] Independent privacy/cryptography review
-   [ ] Monitoring and incident response
-   [ ] Backup and recovery plan
-   [ ] Legal/compliance review
-   [ ] Production launch approval

------------------------------------------------------------------------

# 10. Risks and guardrails

| Risk | Why it matters | Mitigation |
|---|---|---|
| FastFS testnet failure | Prevents remote WASM retrieval | Get official support guidance; verify each upload on-chain and over HTTP |
| Scaffold/engine mismatch | Could deploy Hello World instead of auction code | Consolidate to one canonical crate and inspect build output |
| Misleading transaction status | NEAR transaction success does not prove WASM execution success | Inspect execution callback and result payload |
| Unverified TEE claims | Could misrepresent privacy or integrity guarantees | Verify attestation and document trust assumptions |
| Bid leakage | Breaks sealed-bid promise | Threat-model all data paths, logs, APIs, and storage |
| Auction-rule ambiguity | Can produce unexpected or unfair allocations | Formal specification and automated tests |
| Mock settlement | Demo may appear more complete than it is | Label mocks and keep them out of the live testnet path |
| Duplicate execution/payment | Can harm participants | Idempotency keys, state transitions, and accounting invariants |
| Time pressure | Can lead to unfinished integrations | Prioritize one complete, honest demo flow over many partial features |

------------------------------------------------------------------------

# 11. What "done" should look like

At the end of the MVP roadmap, a reviewer should be able to:

-   Understand why the launch mechanism exists.
-   Create or inspect an auction.
-   Submit bids from multiple test accounts.
-   See that private bid data is not exposed before the permitted
    reveal/clearing stage.
-   Trigger or observe auction clearing.
-   Inspect the exact code version and input associated with the
    execution.
-   See the correct uniform-price allocations.
-   Verify execution evidence if the chosen platform provides it and the
    integration is complete.
-   Follow testnet settlement or clearly labeled simulated settlement.
-   Reproduce the demo using the repository instructions.

The final product story should be simple:

**Bids are submitted under the documented privacy model → the auction
closes → a deterministic auction engine computes a common clearing price
and allocations → execution evidence is checked → the result is
published → settlement is completed.**

Every arrow in that story must correspond to implemented and tested
behavior before it is described as complete.

------------------------------------------------------------------------

## 12. Final note

The project already has a meaningful foundation: a working local Rust
auction engine, a WASM build, and an OutLayer testnet project
registration. The current external blocker is artifact delivery through
FastFS, not the local auction calculation.

The next engineering priority is to make the Rust source/build path
canonical, formalize and test the auction rules, and resolve OutLayer
artifact retrieval. In parallel, the backend and frontend can be
developed against a local execution adapter, provided the UI clearly
labels local execution and mock settlement.

**Build one complete, reproducible, honest end-to-end MVP first. Then
harden it for production.**
