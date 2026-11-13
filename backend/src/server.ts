
import Fastify from "fastify";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import cors from "@fastify/cors";
import { prisma } from "./db.js";
import {
  createCheckSchema,
  createLaunchSchema,
  sealedBidSchema,
} from "./schemas.js";
import { MockPaymentProvider } from "./payment-provider.js";
import { devEnclaveKey, openBid } from "./dev-enclave.js";
import { runAuction } from "./engine.js";
import { OutLayerError } from "./outlayer.js";
import { anchorConfigFromEnv, anchorResult } from "./anchor.js";
import { buildInput, inputHash, planPayouts, sha256Hex } from "./settlement-core.js";
import { ProxyError, createOneClickProxy } from "./oneclick.js";
import { corsOrigins } from "./cors.js";
import {
  createChallenge,
  verifyChallenge,
  getSessionAccount,
  provider as nearProvider,
} from "./auth.js";

const app = Fastify({
  logger: true,
  bodyLimit: 128 * 1024,
});

// Register CORS here
await app.register(cors, {
  origin: corsOrigins(process.env.CORS_ORIGINS),
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
});

const paymentProvider = new MockPaymentProvider();
const isDev = process.env.NODE_ENV !== "production";

// Authentication request schemas
const authChallengeSchema = z.object({
  accountId: z.string().trim().min(2).max(64),
});

const authVerifySchema = z.object({
  challengeId: z.string().min(1).max(128),
  accountId: z.string().trim().min(2).max(64),
  publicKey: z.string().min(1).max(128),
  signature: z.string().min(1).max(256),
});

type PublicLaunchInput = {
  id: string;
  name: string;
  symbol: string;
  creator: string;
  emoji: string;
  hue: number;
  tagline: string;
  supplyAtomic: string;
  reserveAtomic: string;
  tokenDecimals: number;
  paymentToken: string;
  paymentDecimals: number;
  capBps: number | null;
  state: string;
  opensAt: Date | null;
  closesAt: Date | null;
  bidCount: number;
  tokenContract: string | null;
  codeHash: string | null;
};

type ApiError = Error & {
  statusCode?: number;
  code?: string;
};

function isApiError(error: unknown): error is ApiError {
  return error instanceof Error;
}

function fail(statusCode: number, code: string, message: string) {
  return Object.assign(new Error(message), { statusCode, code });
}
async function requireSession(req: { headers: { authorization?: string } }) {
  const authorization = req.headers.authorization;

  const token =
    typeof authorization === "string" &&
    authorization.startsWith("Bearer ")
      ? authorization.slice(7).trim()
      : "";

  const account = await getSessionAccount(token);

  if (!account) {
    throw fail(
      401,
      "unauthorized",
      "Connect and authenticate your NEAR wallet first.",
    );
  }

  return account;
}

function publicLaunch(l: PublicLaunchInput) {
  return {
    id: l.id,
    name: l.name,
    symbol: l.symbol,
    creator: l.creator,
    emoji: l.emoji,
    hue: l.hue,
    tagline: l.tagline,
    supplyAtomic: l.supplyAtomic,
    reserveAtomic: l.reserveAtomic,
    tokenDecimals: l.tokenDecimals,
    paymentToken: l.paymentToken,
    paymentDecimals: l.paymentDecimals,
    capBps: l.capBps,
    status: l.state.toLowerCase(),
    opensAt: l.opensAt?.toISOString() ?? null,
    closesAt: l.closesAt?.toISOString() ?? null,
    bidCount: l.bidCount,
    tokenContract: l.tokenContract,
    codeHash: l.codeHash,
  };
}

// --------------------------------------------------
// HEALTH
// --------------------------------------------------

app.get("/health", async () => ({
  ok: true,
  service: "unmask-api",
  mode: isDev ? "development" : "production",
}));

// --------------------------------------------------
// NEAR WALLET AUTHENTICATION
// --------------------------------------------------

app.post("/v1/auth/challenge", async (req, reply) => {
  const parsed = authChallengeSchema.safeParse(req.body);

  if (!parsed.success) {
    return reply.code(400).send({
      error: {
        code: "validation_error",
        details: parsed.error.flatten(),
      },
    });
  }

  try {
    const challenge = await createChallenge(
      parsed.data.accountId,
    );

    return reply.code(201).send({
      challenge,
    });
  } catch (error) {
    app.log.error(error);

    return reply.code(503).send({
      error: {
        code: "challenge_unavailable",
        message: "Could not create authentication challenge",
      },
    });
  }
});

app.post("/v1/auth/verify", async (req, reply) => {
  const parsed = authVerifySchema.safeParse(req.body);

  if (!parsed.success) {
    return reply.code(400).send({
      error: {
        code: "validation_error",
        details: parsed.error.flatten(),
      },
    });
  }

  try {
    const session = await verifyChallenge(parsed.data);

    return reply.code(200).send({
      session,
    });
  } catch (error) {
    app.log.warn(
      { err: error },
      "NEAR authentication failed",
    );

    return reply.code(401).send({
      error: {
        code: "authentication_failed",
        message:
          "Invalid, expired, or already-used authentication challenge",
      },
    });
  }
});

// --------------------------------------------------
// LAUNCHES
// --------------------------------------------------

app.get("/v1/launches", async () => {
  const launches = await prisma.launch.findMany({
    where: {
      state: {
        in: ["OPEN", "CLOSED", "SETTLED"],
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return {
    launches: launches.map(publicLaunch),
  };
});

app.get<{ Params: { id: string } }>(
  "/v1/launches/:id",
  async (req, reply) => {
    const launch = await prisma.launch.findUnique({
      where: { id: req.params.id },
    });

    if (!launch) {
      return reply.code(404).send({
        error: {
          code: "not_found",
          message: "Launch not found",
        },
      });
    }

    return {
      launch: publicLaunch(launch),
    };
  },
);


app.post("/v1/launches", async (req, reply) => {
  if (!isDev) {
    throw fail(
      501,
      "not_implemented",
      "Production launch creation requires the NEAR deployment adapter.",
    );
  }

  // Require a valid authenticated NEAR wallet session.
  const authorization = req.headers.authorization;

  const token =
    typeof authorization === "string" &&
    authorization.startsWith("Bearer ")
      ? authorization.slice(7).trim()
      : "";

  const creator = await getSessionAccount(token);

  if (!creator) {
    return reply.code(401).send({
      error: {
        code: "unauthorized",
        message: "Connect and authenticate your NEAR wallet first.",
      },
    });
  }

  const parsed = createLaunchSchema.safeParse(req.body);

  if (!parsed.success) {
    return reply.code(400).send({
      error: {
        code: "validation_error",
        details: parsed.error.flatten(),
      },
    });
  }

  const input = parsed.data;
  const close = new Date(input.closesAt);
  const open = input.opensAt
    ? new Date(input.opensAt)
    : new Date();

  if (close <= open) {
    return reply.code(400).send({
      error: {
        code: "invalid_window",
        message: "closesAt must be after opensAt",
      },
    });
  }

  const launch = await prisma.launch.create({
    data: {
      name: input.name,
      symbol: input.symbol.toUpperCase(),

      // Always use the authenticated wallet.
      creator,

      supplyAtomic: input.supplyAtomic,
      reserveAtomic: input.reserveAtomic,
      tokenDecimals: input.tokenDecimals,
      paymentToken: input.paymentToken,
      paymentDecimals: input.paymentDecimals,
      capBps: input.capBps ?? null,
      opensAt: open,
      closesAt: close,
      state: "OPEN",
      tagline:
        "Development launch — token deployment is not yet connected.",
    },
  });

  return reply.code(201).send({
    launch: publicLaunch(launch),
  });
});

// --------------------------------------------------
// PAYMENT CHECKS
// --------------------------------------------------

app.post<{ Params: { id: string } }>(
  "/v1/launches/:id/payment-checks",
  async (req, reply) => {
    if (!isDev) {
      throw fail(
        501,
        "not_implemented",
        "Real OutLayer payment checks are not connected.",
      );
    }

    // Require an authenticated NEAR wallet.
    const bidder = await requireSession(req);

    const parsed = createCheckSchema.safeParse(req.body);

    if (!parsed.success) {
      return reply.code(400).send({
        error: {
          code: "validation_error",
          details: parsed.error.flatten(),
        },
      });
    }

    // Prevent a user from creating a payment check for another account.
    if (parsed.data.bidder !== bidder) {
      return reply.code(403).send({
        error: {
          code: "bidder_mismatch",
          message: "Bidder does not match the authenticated wallet.",
        },
      });
    }

    const launch = await prisma.launch.findUnique({
      where: { id: req.params.id },
    });

    if (!launch) {
      return reply.code(404).send({
        error: {
          code: "not_found",
          message: "Launch not found",
        },
      });
    }

    if (
      launch.state !== "OPEN" ||
      !launch.closesAt ||
      launch.closesAt <= new Date()
    ) {
      return reply.code(409).send({
        error: {
          code: "closed",
          message: "Bidding is closed",
        },
      });
    }

    if (parsed.data.token !== launch.paymentToken) {
      return reply.code(400).send({
        error: {
          code: "wrong_token",
          message: "Payment token does not match this launch",
        },
      });
    }

    const provider = await paymentProvider.create({
      launchId: launch.id,
      bidder,
      token: parsed.data.token,
      amountAtomic: parsed.data.amountAtomic,
    });

    const check = await prisma.paymentCheck.create({
      data: {
        launchId: launch.id,
        bidder,
        token: parsed.data.token,
        amountAtomic: parsed.data.amountAtomic,
        expiresAt: provider.expiresAt,
        providerRef: provider.providerRef,
        state: "LOCKED",
      },
    });

    return reply.code(201).send({
      check: {
        id: check.id,
        launchId: check.launchId,
        token: check.token,
        amountAtomic: check.amountAtomic,
        state: "locked",
        expiresAt: check.expiresAt.toISOString(),
      },
      claimKey: provider.claimKey,
      warning:
        "DEVELOPMENT MOCK ONLY: no funds were transferred or locked.",
    });
  },
);

app.get<{ Params: { id: string } }>(
  "/v1/payment-checks/:id",
  async (req, reply) => {
    const account = await requireSession(req);

    const check = await prisma.paymentCheck.findUnique({
      where: { id: req.params.id },
    });

    if (!check) {
      return reply.code(404).send({
        error: {
          code: "not_found",
          message: "Payment check not found",
        },
      });
    }

    if (check.bidder !== account) {
      return reply.code(403).send({
        error: {
          code: "forbidden",
          message: "You cannot access another wallet's payment check.",
        },
      });
    }

    const state =
      check.state === "LOCKED" && check.expiresAt <= new Date()
        ? "expired"
        : check.state.toLowerCase();

    return {
      check: {
        id: check.id,
        launchId: check.launchId,
        bidder: check.bidder,
        token: check.token,
        amountAtomic: check.amountAtomic,
        state,
        expiresAt: check.expiresAt.toISOString(),
      },
    };
  },
);

app.post<{ Params: { id: string } }>(
  "/v1/payment-checks/:id/reclaim",
  async (req, reply) => {
    const account = await requireSession(req);

    const check = await prisma.paymentCheck.findUnique({
      where: { id: req.params.id },
    });

    if (!check) {
      return reply.code(404).send({
        error: {
          code: "not_found",
          message: "Payment check not found",
        },
      });
    }

    if (check.bidder !== account) {
      return reply.code(403).send({
        error: {
          code: "forbidden",
          message: "You cannot reclaim another wallet's payment check.",
        },
      });
    }

    if (
      check.state !== "LOCKED" ||
      check.expiresAt > new Date()
    ) {
      return reply.code(409).send({
        error: {
          code: "not_reclaimable",
          message: "Check is not reclaimable in its current state",
        },
      });
    }

    if (check.providerRef) {
      await paymentProvider.reclaim(check.providerRef);
    }

    const updated = await prisma.paymentCheck.update({
      where: { id: check.id },
      data: { state: "RECLAIMED" },
    });

    return {
      check: {
        id: updated.id,
        state: "reclaimed",
      },
      warning:
        "DEVELOPMENT MOCK ONLY: no real funds were reclaimed.",
    };
  },
);

// --------------------------------------------------
// SEALED BIDS
// --------------------------------------------------

app.post<{ Params: { id: string } }>(
  "/v1/launches/:id/bids",
  async (req, reply) => {
    if (!isDev) {
      throw fail(
        501,
        "not_implemented",
        "Production bid submission requires wallet-signature authentication and a live payment provider.",
      );
    }

    // Derive bidder identity from the authenticated session.
    const bidder = await requireSession(req);

    const parsed = sealedBidSchema.safeParse(req.body);

    if (!parsed.success) {
      return reply.code(400).send({
        error: {
          code: "validation_error",
          details: parsed.error.flatten(),
        },
      });
    }

    // Reject attempts to submit a bid for another wallet.
    if (parsed.data.bidder !== bidder) {
      return reply.code(403).send({
        error: {
          code: "bidder_mismatch",
          message: "Bidder does not match the authenticated wallet.",
        },
      });
    }

    const launch = await prisma.launch.findUnique({
      where: { id: req.params.id },
    });

    if (!launch) {
      return reply.code(404).send({
        error: {
          code: "not_found",
          message: "Launch not found",
        },
      });
    }

    if (
      launch.state !== "OPEN" ||
      !launch.closesAt ||
      launch.closesAt <= new Date()
    ) {
      return reply.code(409).send({
        error: {
          code: "closed",
          message: "Bidding is closed",
        },
      });
    }

    const check = await prisma.paymentCheck.findUnique({
      where: { id: parsed.data.paymentCheckId },
    });

    if (
      !check ||
      check.launchId !== launch.id ||
      check.bidder !== bidder ||
      check.state !== "LOCKED" ||
      check.expiresAt <= new Date()
    ) {
      return reply.code(409).send({
        error: {
          code: "invalid_payment_check",
          message: "A matching, unexpired payment check is required",
        },
      });
    }

    if (parsed.data.ciphertext.trim().startsWith("{")) {
      return reply.code(400).send({
        error: {
          code: "plaintext_bid",
          message: "Bid must be encrypted ciphertext",
        },
      });
    }

    try {
      const bid = await prisma.$transaction(async (tx) => {
        const created = await tx.bid.create({
          data: {
            launchId: launch.id,
            bidder,
            ciphertext: parsed.data.ciphertext,
            commitment: parsed.data.commitment,
            paymentCheckId: check.id,
            keyId: parsed.data.keyId,
            receiptId: `rcpt_${randomUUID()}`,
          },
        });

        await tx.launch.update({
          where: { id: launch.id },
          data: {
            bidCount: {
              increment: 1,
            },
          },
        });

        return created;
      });

      return reply.code(201).send({
        receiptId: bid.receiptId,
      });
    } catch (error: unknown) {
      if (
        isApiError(error) &&
        "code" in error &&
        error.code === "P2002"
      ) {
        return reply.code(409).send({
          error: {
            code: "duplicate_bid",
            message:
              "This account already submitted a bid for this launch",
          },
        });
      }

      throw error;
    }
  },
);


// --------------------------------------------------
// MY BIDS
// --------------------------------------------------

app.get("/v1/me/bids", async (req) => {
  // Identify the wallet from its authenticated session.
  const account = await requireSession(req);

  const bids = await prisma.bid.findMany({
    where: {
      bidder: account,
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 100,
    select: {
      id: true,
      launchId: true,
      bidder: true,
      commitment: true,
      paymentCheckId: true,
      keyId: true,
      receiptId: true,
      createdAt: true,

      launch: {
        select: {
          id: true,
          name: true,
          symbol: true,
          emoji: true,
          hue: true,
          state: true,
          closesAt: true,
        },
      },

      paymentCheck: {
        select: {
          token: true,
          amountAtomic: true,
          state: true,
          expiresAt: true,
        },
      },
    },
  });

  return {
    bids: bids.map((bid) => {
      const paymentCheckExpired =
        bid.paymentCheck.state === "LOCKED" &&
        bid.paymentCheck.expiresAt <= new Date();

      return {
        id: bid.id,
        launchId: bid.launchId,
        bidder: bid.bidder,
        commitment: bid.commitment,
        paymentCheckId: bid.paymentCheckId,
        keyId: bid.keyId,
        receiptId: bid.receiptId,
        createdAt: bid.createdAt.toISOString(),

        launch: {
          ...bid.launch,
          state: bid.launch.state.toLowerCase(),
          closesAt: bid.launch.closesAt?.toISOString() ?? null,
        },

        paymentCheck: {
          token: bid.paymentCheck.token,
          amountAtomic: bid.paymentCheck.amountAtomic,
          state: paymentCheckExpired
            ? "expired"
            : bid.paymentCheck.state.toLowerCase(),
          expiresAt: bid.paymentCheck.expiresAt.toISOString(),
        },
      };
    }),
  };
});


// --------------------------------------------------
// BID RECEIPT VERIFICATION
// --------------------------------------------------

app.get<{ Params: { receiptId: string } }>(
  "/v1/receipts/:receiptId/verify",
  async (req, reply) => {
    const account = await requireSession(req);

    const bid = await prisma.bid.findUnique({
      where: {
        receiptId: req.params.receiptId,
      },
      include: {
        launch: true,
        paymentCheck: true,
      },
    });

    // Do not reveal whether another wallet owns a receipt.
    if (!bid || bid.bidder !== account) {
      return reply.code(404).send({
        error: {
          code: "not_found",
          message: "Receipt not found for this wallet.",
        },
      });
    }

    const checks = [
      {
        id: "receipt",
        label: "Receipt exists",
        passed: Boolean(bid.receiptId),
        detail: "The receipt ID matches a stored bid record.",
      },
      {
        id: "ownership",
        label: "Wallet ownership",
        passed: bid.bidder === account,
        detail: "The bid belongs to the authenticated wallet.",
      },
      {
        id: "launch",
        label: "Launch relationship",
        passed: bid.launch.id === bid.launchId,
        detail: "The bid references its recorded launch.",
      },
      {
        id: "payment",
        label: "Payment-check relationship",
        passed:
          bid.paymentCheck.id === bid.paymentCheckId &&
          bid.paymentCheck.launchId === bid.launchId &&
          bid.paymentCheck.bidder === bid.bidder,
        detail:
          "The payment check references the same launch and bidder.",
      },
      {
        id: "commitment",
        label: "Commitment record",
        passed: /^[0-9a-f]{64}$/i.test(bid.commitment),
        detail:
          "A SHA-256-format commitment is recorded. Its original bid data and salt have not been independently recomputed.",
      },
      {
        id: "ciphertext",
        label: "Encrypted bid record",
        passed:
          bid.ciphertext.length > 0 &&
          !bid.ciphertext.trim().startsWith("{"),
        detail:
          "An encrypted bid payload is recorded rather than a plaintext JSON bid.",
      },
    ];

    const passed = checks.every((check) => check.passed);

    return {
      receiptId: bid.receiptId,
      status: passed ? "record_verified" : "record_check_failed",
      verificationLevel: "backend_record_only",
      checks,

      bid: {
        id: bid.id,
        launchId: bid.launchId,
        bidder: bid.bidder,
        commitment: bid.commitment,
        paymentCheckId: bid.paymentCheckId,
        keyId: bid.keyId,
        createdAt: bid.createdAt.toISOString(),
      },

      launch: {
        id: bid.launch.id,
        name: bid.launch.name,
        symbol: bid.launch.symbol,
      },

      paymentCheck: {
        id: bid.paymentCheck.id,
        token: bid.paymentCheck.token,
        state: bid.paymentCheck.state.toLowerCase(),
        expiresAt: bid.paymentCheck.expiresAt.toISOString(),
      },

      limitations: [
        "The original bid salt and plaintext are not stored by the backend.",
        "The commitment has not been independently recomputed.",
        "TEE attestation and on-chain settlement are not verified.",
      ],
    };
  }
);


// --------------------------------------------------
// ERROR HANDLER
// --------------------------------------------------
// ENCLAVE KEY, SETTLEMENT AND RESULT (development enclave)
// --------------------------------------------------

function publicResult(s: { launchId: string; clearingPrice: string; sold: string; totalRaised: string; outcome: unknown; inputHash: string; codeHash: string; attestation: string | null; mode: string; skippedBids: number; createdAt: Date }) {
  return {
    launchId: s.launchId,
    clearingPrice: s.clearingPrice,
    sold: s.sold,
    totalRaised: s.totalRaised,
    outcome: s.outcome,
    inputHash: s.inputHash,
    codeHash: s.codeHash,
    attestation: s.attestation,
    mode: s.mode,
    skippedBids: s.skippedBids,
    settledAt: s.createdAt.toISOString(),
  };
}

// The key bids are sealed to. In development this is the dev enclave's key and carries no attestation.
app.get("/v1/enclave-key", async () => ({ key: devEnclaveKey() }));
app.get<{ Params: { id: string } }>("/v1/launches/:id/enclave-key", async () => ({ key: devEnclaveKey() }));

app.post<{ Params: { id: string } }>("/v1/launches/:id/settle", async (req, reply) => {
  if (!isDev) {
    throw fail(501, "not_implemented", "Settlement needs the real OutLayer enclave. The development enclave is disabled in production.");
  }
  const account = await requireSession(req);
  const launch = await prisma.launch.findUnique({
    where: { id: req.params.id },
    include: { settlement: true, bids: { include: { paymentCheck: true }, orderBy: { createdAt: "asc" } } },
  });
  if (!launch) return reply.code(404).send({ error: { code: "not_found", message: "Launch not found" } });
  if (launch.creator !== account) throw fail(403, "forbidden", "Only the creator can settle this launch.");
  if (launch.settlement) return { result: publicResult(launch.settlement), alreadySettled: true };
  if (launch.state === "DRAFT" || launch.state === "CANCELLED") throw fail(409, "bad_state", `A ${launch.state.toLowerCase()} launch cannot be settled.`);
  if (launch.state === "OPEN" && (!launch.closesAt || launch.closesAt > new Date())) throw fail(409, "not_closed", "The bidding window is still open.");

  const rows = launch.bids.map((b) => ({
    row: {
      id: b.id,
      bidder: b.bidder,
      commitment: b.commitment,
      paymentCheckId: b.paymentCheckId,
      checkAmountAtomic: b.paymentCheck.amountAtomic,
      checkLocked: b.paymentCheck.state === "LOCKED",
      submittedAt: b.createdAt,
    },
    plain: openBid(b.ciphertext),
  }));
  const { input, skipped, meta } = await buildInput(launch, rows, { provider: nearProvider });
  let run;
  try {
    run = await runAuction(input);
  } catch (error) {
    if (error instanceof OutLayerError) throw fail(error.reason === "bad_config" ? 500 : 502, `outlayer_${error.reason}`, error.message);
    throw error;
  }
  const engineOutput = run.raw;
  const outcome = JSON.parse(engineOutput) as { clearingPrice: string; sold: string; totalRaised: string; fills: Array<{ bidId: string; bidder: string; filled: string; refund: string }> };
  const payouts = planPayouts(outcome.fills, meta);
  const agents = meta.filter((m) => m.agent).map((m) => ({ bidId: m.bidId, bidder: m.bidder, rulesHash: m.agent!.rulesHash, signed: m.agent!.signed }));
  const codeHash = run.codeHash;

  try {
    const saved = await prisma.$transaction(async (tx) => {
      const settlement = await tx.settlement.create({
        data: {
          launchId: launch.id,
          clearingPrice: outcome.clearingPrice,
          sold: outcome.sold,
          totalRaised: outcome.totalRaised,
          outcome: { ...outcome, skipped, payouts, agents, payoutsExecuted: false, engineOutputHash: sha256Hex(engineOutput), engineKind: run.kind, outlayerCallId: run.callId } as object,
          inputHash: inputHash(input),
          codeHash,
          attestation: run.attestationUrl,
          mode: run.mode,
          skippedBids: skipped.length,
        },
      });
      await tx.launch.update({ where: { id: launch.id }, data: { state: "SETTLED", codeHash } });
      return settlement;
    });
    // Best effort: record the result's commitment on NEAR. A failure here never undoes the settlement.
    let final = saved;
    const anchorCfg = anchorConfigFromEnv();
    if (anchorCfg) {
      try {
        const anchor = await anchorResult(anchorCfg, {
          launchId: launch.id,
          inputHash: saved.inputHash,
          outputHash: sha256Hex(engineOutput),
          codeHash: saved.codeHash,
          clearingPrice: saved.clearingPrice,
          mode: saved.mode,
        });
        final = await prisma.settlement.update({ where: { id: saved.id }, data: { outcome: { ...(saved.outcome as object), anchor } as object } });
      } catch (err) {
        req.log.error({ err }, "anchoring the settlement on NEAR failed");
      }
    }
    return { result: publicResult(final), alreadySettled: false };
  } catch (error) {
    if ((error as { code?: string }).code === "P2002") {
      const existing = await prisma.settlement.findUnique({ where: { launchId: launch.id } });
      if (existing) return { result: publicResult(existing), alreadySettled: true };
    }
    throw error;
  }
});

app.get<{ Params: { id: string } }>("/v1/launches/:id/result", async (req, reply) => {
  const settlement = await prisma.settlement.findUnique({ where: { launchId: req.params.id } });
  if (!settlement) return reply.code(404).send({ error: { code: "not_settled", message: "This launch has not been settled yet." } });
  return { result: publicResult(settlement) };
});

// --------------------------------------------------
// FUNDING FROM ANOTHER CHAIN (NEAR Intents 1Click, quotes only unless live is switched on)
// --------------------------------------------------

const oneClick = createOneClickProxy({
  base: process.env.ONECLICK_API_BASE,
  jwt: process.env.ONECLICK_JWT,
  allowLive: process.env.ONECLICK_ALLOW_LIVE === "1",
});

function intentsFailure(error: unknown): never {
  if (error instanceof ProxyError) throw fail(error.status, error.code, error.message);
  throw error;
}

app.get("/v1/intents/tokens", async () => oneClick.tokens().catch(intentsFailure));
app.post("/v1/intents/quote", async (req) => oneClick.quote(req.body).catch(intentsFailure));
app.get<{ Querystring: { depositAddress?: string; depositMemo?: string } }>("/v1/intents/status", async (req) =>
  oneClick.status(req.query.depositAddress, req.query.depositMemo).catch(intentsFailure),
);

// --------------------------------------------------

app.setErrorHandler((error: unknown, _req, reply) => {
  app.log.error(error);

  const status = isApiError(error)
    ? error.statusCode ?? 500
    : 500;

  const code = isApiError(error)
    ? error.code ?? "internal_error"
    : "internal_error";

  const message =
    status >= 500
      ? "Internal server error"
      : isApiError(error)
        ? error.message
        : "Request failed";

  reply.code(status).send({
    error: {
      code,
      message,
    },
  });
});

// --------------------------------------------------
// SERVER STARTUP AND SHUTDOWN
// --------------------------------------------------

// On Vercel the platform calls the exported app itself, so it must not open a port. Everywhere else (local, Docker,
// any container host) we listen as before.
const onVercel = Boolean(process.env.VERCEL);

if (!onVercel) {
  const host = process.env.HOST ?? "127.0.0.1";
  const port = Number(process.env.PORT ?? 4001);

  try {
    await app.listen({ host, port });
  } catch (error) {
    app.log.error(error);
    await prisma.$disconnect();
    process.exit(1);
  }

  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.on(signal, async () => {
      await app.close();
      await prisma.$disconnect();
      process.exit(0);
    });
  }
}

export default app;
