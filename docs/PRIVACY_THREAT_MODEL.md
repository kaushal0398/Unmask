# Privacy threat model

Written 10 Nov 2026. It answers one question: **who can read a sealed bid, and when?** It is based on the code as it is today, a test that was run, and OutLayer's published documents. Where something is inferred or not confirmed, it says so.

## 1. The promise, and the honest status

The product promise: *"Buyers submit bids during a window, and nobody (the creator included) can read them until it closes. The public sees only how many bids there are."*

| Part of the promise | Status today |
|---|---|
| Other bidders, the public and the creator cannot read a bid through the application | **True, and tested** (31 checks, section 5) |
| Nobody can read a bid, **the operator of the backend included** | **False.** The development enclave runs inside the backend and holds the key. Whoever runs the backend can read every bid at any time |
| The public sees only the count | **True, but the count itself leaks** (section 4) |
| Bids stay secret from the network | **True** for bid contents; account names and timing are visible |

So the accurate public claim today is: **bids are encrypted in your browser, and the API shows them to no one but you. The development enclave in our backend can read them, so this is not yet private from us.**

## 2. Where a bid goes, and who can read it at each step

What a bid contains: `limit`, `qty`, a random `salt`, the payment check's id and claim key, and optionally agent rules and payout destinations. Everything below is checked against the code.

| # | Stage | What exists there | Readable by |
|---|---|---|---|
| 1 | Your browser | The plaintext bid | You |
| 2 | In transit | A libsodium sealed box (`crypto_box_seal`) to the enclave's public key, a SHA-256 commitment, your account name, the payment check id | A network observer sees the ciphertext, your account and the sizes, not the contents (TLS aside) |
| 3 | Database (`Bid`) | `ciphertext`, `commitment`, `bidder` (plaintext), `paymentCheckId`, `receiptId`, `createdAt` | Anyone with database access sees who bid and when, not the contents |
| 4 | Database (`PaymentCheck`) | **`amountAtomic` in plaintext** | **Anyone with database access sees the most each bid could owe: `limit × qty`.** A real on-chain lock would very likely make this public (section 4) |
| 5 | Public count | `Launch.bidCount`, updated on every bid | Everyone, live |
| 6 | The key | `DEV_ENCLAVE_SEED` in the backend's environment | **The backend operator** |
| 7 | Settlement | The backend process opens every ciphertext in memory and pipes the plaintext bids to the engine | **The backend operator and anyone who can read the process** |
| 8 | Server log | Request URLs: receipt ids and payment check ids. No bodies | Whoever reads the log, which also holds opaque ids but no bid content (tested) |
| 9 | The result, after settlement | **Every bid is public**: account, limit, quantity, what it got. Plus payout destinations in the plan, and which accounts used an agent | Everyone. By design, because the verify page re-runs the rule on them |

## 3. Who can do what

"Before the close" means while bidding is open.

| Who | Can read a bid's contents before the close? | How we know |
|---|---|---|
| Another bidder | No | Tested: they get a 403 or an identical 404 for another user's receipt or payment check, and their own bid list holds only their own bid |
| An anonymous visitor | No | Tested: the public endpoints carry only the launch's rules and the count |
| The launch creator | No | Settling is refused until the window closes (409), and the API has no bid list |
| A bot watching the page | Only the count and its timing | Section 4 |
| **The backend operator** | **Yes** | Holds the seed and the ciphertexts. The development enclave is part of the backend |
| **Someone who compromises the backend host or database** | **Yes** | Same reason |
| OutLayer, if used as designed today | **Likely yes**: not confirmed | A call over the HTTPS API sends the input to OutLayer's coordinator, which queues the task for a worker. The README says the coordinator is a separate component outside the TEE, so plaintext bids sent that way would pass through it. This is an inference from their architecture |
| A network observer | No, for contents | TLS and sealed boxes. They do see account names and timing |

## 4. Leaks that survive even a perfect enclave

These are not bugs in the encryption. They are things the design shows anyway.

| Leak | Why it matters | Fix to consider |
|---|---|---|
| **The count over time.** The count updates on every bid, so a watcher sees the demand curve, and sees a surge arrive | Bots can time their own bid, or stay out | Show the count in steps (say every 5 minutes), or only after the close |
| **The payment check amount.** A bid locks `limit × qty` (the most it could owe). A real on-chain lock is very likely public (not confirmed for OutLayer payment checks), and our database already stores it in plaintext | It reveals the product of the two secret numbers. For one-bid-per-account it nearly reveals the bid | Lock a **fixed amount for everyone** (for example the cap per account times the highest allowed price) and refund the difference at settlement. Needs the payment design (C1 to C4) |
| **Bidder accounts and timestamps** are plaintext | Reveals who bid and when | Hard to avoid with named wallets. State it |
| **The result reveals every bid** (decision D7) | A losing bidder's limit and account become public afterwards | Publish only the aggregate order book. The verify page needs the bids, so this trades verifiability for privacy |
| **Which accounts used agents, and payout addresses**, shown after settlement | Minor, but it links accounts to addresses on other chains | Show the plan without addresses, to the owner only |

## 5. What is tested today

`cd backend && npm run e2e:privacy` (needs a database and the backend). It seeds an open launch with three sealed bids, then calls every endpoint as an anonymous visitor, a signed-in stranger and the owner, and asserts that no one gets another user's bid back: no ciphertext, commitment, receipt, payment check, amount, limit, quantity or account name. 31 checks pass, including:

- a receipt that exists but is not yours answers **exactly** like one that does not exist, so ownership cannot be probed;
- even your own ciphertext is not returned, only the commitment;
- the enclave key endpoint returns a public key only;
- the server log, scanned after the run, contains no ciphertext, commitment, amount, limit or quantity.

**What this does not prove:** that the backend operator cannot read bids. It cannot, because they can.

## 6. Options for closing the biggest gap

The gap is rows 6 and 7 of section 2: the backend holds the key and opens the bids.

### A. Open the bids inside the enclave (recommended direction)

Send the ciphertexts to OutLayer and open them **inside** the TEE, with a key that only the TEE holds. The backend then never sees a plaintext bid or the key.

What OutLayer documents that points this way (read 10 Nov): a keystore that runs in the TEE ("key derivation, signing and secrets decryption"), a `secrets_ref` field on every execution, and "TEE execution workers … measure the WASM sha256 and report it to the keystore with every secret decryption". That suggests a secret can be bound to a specific WASM hash, so only our audited engine could receive the key. **Not confirmed:** how a secret is created, whether the key can be generated inside the TEE so even we never see it, and how it reaches the WASM.

What it would take on our side, all unstarted:

1. The engine must open the sealed boxes (the Rust `crypto_box` crate has a sealed-box feature that is believed to be libsodium-compatible: **confirm with a test against `seal.ts` before relying on it**) and then do **everything that needs plaintext inside**: check each commitment, check the payment check covers the bid, check agent rules, validate payout destinations, then run the auction. Today that logic lives in the TypeScript backend (`settlement-core.ts`).
2. **A hard part:** verifying an agent's wallet signature needs the NEAR RPC (is the key a full-access key on the account?). A WASM module cannot make that call. The enclave would have to be given the key lookups as public inputs it can check, or agent signatures would move to a different check.
3. Payment-check facts (which are locked, how much) are public on chain, so they can be passed in as inputs.
4. Tests: the engine opens a box made by the browser's `seal.ts`, rejects a bad commitment, and gives the same result as today's pipeline on the shared vectors.

### B. Commit and reveal

Bidders commit (we already store a SHA-256 commitment) and reveal after the close. No enclave is needed for secrecy, because the auction is public and anyone can re-run it. **The catch:** a bidder who sees others' reveals can refuse to reveal, which gives them a free option unless a deposit is forfeited, and everyone must come back after the close. It also removes the point of the TEE track.

### C. Threshold or multi-party decryption

Out of scope for a hackathon. Listed so it is not forgotten.

### Recommendation

1. **Now:** keep the honest claim in section 1, in the README and in the demo. Done.
2. **Next, cheap:** show the count in steps (section 4), and fix the payment lock policy when C1 is decided.
3. **If OutLayer's secrets API is confirmed** (read `secrets_ref` and the keystore documents, or ask them): build option A. It is a real piece of engineering, not a quick change, so decide on Wednesday whether it fits. If it does not, **say so plainly in the submission.** A project that is honest about being not yet private from its operator is better placed than one that claims it.

## 7. Key handling and failure

| Question | Today | Target |
|---|---|---|
| Where is the key? | `DEV_ENCLAVE_SEED` in the backend's environment | Held by the enclave. We should never see it |
| What if the key is lost or changed? | Every sealed bid becomes unreadable: they are skipped as "could not be decrypted" and refunded through their payment checks | The same fallback must exist, and a launch must be cancellable |
| What if the enclave is down at the close? | Settlement fails and the launch stays unsettled. Payment checks expire and bidders reclaim | Needs a deadline after which a launch can be cancelled and everyone refunded |
| Rotation | Not designed. Each launch could have its own key (the API already returns a key per launch) | Per-launch keys, destroyed after settlement |

## 8. What we may say

| Claim | Allowed |
|---|---|
| "Bids are encrypted in your browser" | Yes |
| "The API shows nobody else's bid" | Yes (tested) |
| "The public sees only the count" | Yes, and say the count leaks demand |
| "Nobody can read a bid before the close" | **No.** The backend operator can |
| "Bids are private from the backend" | **No**, until option A is built and tested |
| "TEE-protected bids" | **No**, same reason |

See [`OUTLAYER_ATTESTATION.md`](OUTLAYER_ATTESTATION.md) for what an attestation proves, and why it does not by itself make the bids private.
