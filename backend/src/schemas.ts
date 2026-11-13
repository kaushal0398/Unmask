import { z } from "zod";

const atomicAmount = z.string().regex(/^(0|[1-9][0-9]*)$/, "Must be an unsigned integer string");
const accountId = z.string().min(2).max(64).regex(/^[a-z0-9._-]+$/i);

export const createLaunchSchema = z.object({
  name: z.string().trim().min(1).max(48),
  symbol: z.string().trim().min(1).max(12).regex(/^[A-Za-z0-9]+$/),
  creator: accountId,
  supplyAtomic: atomicAmount.refine((v) => BigInt(v) > 0n),
  reserveAtomic: atomicAmount.refine((v) => BigInt(v) > 0n),
  tokenDecimals: z.number().int().min(0).max(24),
  paymentToken: accountId,
  paymentDecimals: z.number().int().min(0).max(24),
  capBps: z.number().int().min(1).max(10_000).nullable().optional(),
  opensAt: z.string().datetime().optional(),
  closesAt: z.string().datetime(),
});

export const createCheckSchema = z.object({
  bidder: accountId,
  token: accountId,
  amountAtomic: atomicAmount.refine((v) => BigInt(v) > 0n),
});

export const sealedBidSchema = z.object({
  bidder: accountId,
  ciphertext: z.string().min(64).max(100_000),
  commitment: z.string().regex(/^[0-9a-f]{64}$/),
  paymentCheckId: z.string().min(1).max(128),
  keyId: z.string().min(1).max(128),
});
