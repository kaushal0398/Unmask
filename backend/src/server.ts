import Fastify from "fastify";
import { randomUUID } from "node:crypto";
import { prisma } from "./db.js";
import { createCheckSchema, createLaunchSchema, sealedBidSchema } from "./schemas.js";
import { MockPaymentProvider } from "./payment-provider.js";

const app = Fastify({ logger: true, bodyLimit: 128 * 1024 });
const paymentProvider = new MockPaymentProvider();
const isDev = process.env.NODE_ENV !== "production";

function fail(statusCode: number, code: string, message: string) {
  return Object.assign(new Error(message), { statusCode, code });
}
function publicLaunch(l: any) {
  return {
    id: l.id, name: l.name, symbol: l.symbol, creator: l.creator, emoji: l.emoji,
    hue: l.hue, tagline: l.tagline, supplyAtomic: l.supplyAtomic,
    reserveAtomic: l.reserveAtomic, tokenDecimals: l.tokenDecimals,
    paymentToken: l.paymentToken, paymentDecimals: l.paymentDecimals,
    capBps: l.capBps, status: l.state.toLowerCase(), opensAt: l.opensAt?.toISOString() ?? null,
    closesAt: l.closesAt?.toISOString() ?? null, bidCount: l.bidCount,
    tokenContract: l.tokenContract, codeHash: l.codeHash,
  };
}

app.get("/health", async () => ({ ok: true, service: "snipe-proof-api", mode: isDev ? "development" : "production" }));

app.get("/v1/launches", async () => {
  const launches = await prisma.launch.findMany({ where: { state: { in: ["OPEN", "CLOSED", "SETTLED"] } }, orderBy: { createdAt: "desc" } });
  return { launches: launches.map(publicLaunch) };
});

app.get<{ Params: { id: string } }>("/v1/launches/:id", async (req, reply) => {
  const launch = await prisma.launch.findUnique({ where: { id: req.params.id } });
  if (!launch) return reply.code(404).send({ error: { code: "not_found", message: "Launch not found" } });
  return { launch: publicLaunch(launch) };
});

app.post("/v1/launches", async (req, reply) => {
  if (!isDev) throw fail(501, "not_implemented", "Production launch creation requires the NEAR deployment adapter.");
  const parsed = createLaunchSchema.safeParse(req.body);
  if (!parsed.success) return reply.code(400).send({ error: { code: "validation_error", details: parsed.error.flatten() } });
  const input = parsed.data;
  const close = new Date(input.closesAt);
  const open = input.opensAt ? new Date(input.opensAt) : new Date();
  if (close <= open) return reply.code(400).send({ error: { code: "invalid_window", message: "closesAt must be after opensAt" } });
  const launch = await prisma.launch.create({
    data: {
      name: input.name, symbol: input.symbol.toUpperCase(), creator: input.creator,
      supplyAtomic: input.supplyAtomic, reserveAtomic: input.reserveAtomic,
      tokenDecimals: input.tokenDecimals, paymentToken: input.paymentToken,
      paymentDecimals: input.paymentDecimals, capBps: input.capBps ?? null,
      opensAt: open, closesAt: close, state: "OPEN",
      tagline: "Development launch — token deployment is not yet connected.",
    },
  });
  return reply.code(201).send({ launch: publicLaunch(launch) });
});

app.post<{ Params: { id: string } }>("/v1/launches/:id/payment-checks", async (req, reply) => {
  if (!isDev) throw fail(501, "not_implemented", "Real OutLayer payment checks are not connected.");
  const parsed = createCheckSchema.safeParse(req.body);
  if (!parsed.success) return reply.code(400).send({ error: { code: "validation_error", details: parsed.error.flatten() } });
  const launch = await prisma.launch.findUnique({ where: { id: req.params.id } });
  if (!launch) return reply.code(404).send({ error: { code: "not_found", message: "Launch not found" } });
  if (launch.state !== "OPEN" || !launch.closesAt || launch.closesAt <= new Date()) return reply.code(409).send({ error: { code: "closed", message: "Bidding is closed" } });
  if (parsed.data.token !== launch.paymentToken) return reply.code(400).send({ error: { code: "wrong_token", message: "Payment token does not match this launch" } });
  const provider = await paymentProvider.create({ launchId: launch.id, ...parsed.data });
  const check = await prisma.paymentCheck.create({ data: {
    launchId: launch.id, bidder: parsed.data.bidder, token: parsed.data.token,
    amountAtomic: parsed.data.amountAtomic, expiresAt: provider.expiresAt,
    providerRef: provider.providerRef, state: "LOCKED",
  }});
  return reply.code(201).send({
    check: { id: check.id, launchId: check.launchId, token: check.token, amountAtomic: check.amountAtomic, state: "locked", expiresAt: check.expiresAt.toISOString() },
    claimKey: provider.claimKey,
    warning: "DEVELOPMENT MOCK ONLY: no funds were transferred or locked.",
  });
});

app.get<{ Params: { id: string } }>("/v1/payment-checks/:id", async (req, reply) => {
  const check = await prisma.paymentCheck.findUnique({ where: { id: req.params.id } });
  if (!check) return reply.code(404).send({ error: { code: "not_found", message: "Payment check not found" } });
  const state = check.state === "LOCKED" && check.expiresAt <= new Date() ? "expired" : check.state.toLowerCase();
  return { check: { id: check.id, launchId: check.launchId, bidder: check.bidder, token: check.token, amountAtomic: check.amountAtomic, state, expiresAt: check.expiresAt.toISOString() } };
});

app.post<{ Params: { id: string } }>("/v1/payment-checks/:id/reclaim", async (req, reply) => {
  const check = await prisma.paymentCheck.findUnique({ where: { id: req.params.id } });
  if (!check) return reply.code(404).send({ error: { code: "not_found", message: "Payment check not found" } });
  if (check.state !== "LOCKED" || check.expiresAt > new Date()) return reply.code(409).send({ error: { code: "not_reclaimable", message: "Check is not reclaimable in its current state" } });
  if (check.providerRef) await paymentProvider.reclaim(check.providerRef);
  const updated = await prisma.paymentCheck.update({ where: { id: check.id }, data: { state: "RECLAIMED" } });
  return { check: { id: updated.id, state: "reclaimed" } };
});

app.post<{ Params: { id: string } }>("/v1/launches/:id/bids", async (req, reply) => {
  if (!isDev) throw fail(501, "not_implemented", "Production bid submission requires wallet-signature authentication and a live payment provider.");
  const parsed = sealedBidSchema.safeParse(req.body);
  if (!parsed.success) return reply.code(400).send({ error: { code: "validation_error", details: parsed.error.flatten() } });
  const launch = await prisma.launch.findUnique({ where: { id: req.params.id } });
  if (!launch) return reply.code(404).send({ error: { code: "not_found", message: "Launch not found" } });
  if (launch.state !== "OPEN" || !launch.closesAt || launch.closesAt <= new Date()) return reply.code(409).send({ error: { code: "closed", message: "Bidding is closed" } });
  const check = await prisma.paymentCheck.findUnique({ where: { id: parsed.data.paymentCheckId } });
  if (!check || check.launchId !== launch.id || check.bidder !== parsed.data.bidder || check.state !== "LOCKED" || check.expiresAt <= new Date()) {
    return reply.code(409).send({ error: { code: "invalid_payment_check", message: "A matching, unexpired payment check is required" } });
  }
  if (parsed.data.ciphertext.trim().startsWith("{")) return reply.code(400).send({ error: { code: "plaintext_bid", message: "Bid must be encrypted ciphertext" } });
  try {
    const bid = await prisma.$transaction(async (tx) => {
      const created = await tx.bid.create({ data: {
        launchId: launch.id, bidder: parsed.data.bidder, ciphertext: parsed.data.ciphertext,
        commitment: parsed.data.commitment, paymentCheckId: check.id, keyId: parsed.data.keyId,
        receiptId: `rcpt_${randomUUID()}`,
      }});
      await tx.launch.update({ where: { id: launch.id }, data: { bidCount: { increment: 1 } } });
      return created;
    });
    return reply.code(201).send({ receiptId: bid.receiptId });
  } catch (error: any) {
    if (error?.code === "P2002") return reply.code(409).send({ error: { code: "duplicate_bid", message: "This account already submitted a bid for this launch" } });
    throw error;
  }
});

app.setErrorHandler((error, _req, reply) => {
  app.log.error(error);
  const status = (error as any).statusCode ?? 500;
  reply.code(status).send({ error: { code: (error as any).code ?? "internal_error", message: status >= 500 ? "Internal server error" : error.message } });
});

const host = process.env.HOST ?? "127.0.0.1";
const port = Number(process.env.PORT ?? 4001);
try {
  await app.listen({ host, port });
} catch (err) {
  app.log.error(err);
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
