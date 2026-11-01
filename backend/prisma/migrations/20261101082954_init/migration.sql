-- CreateEnum
CREATE TYPE "LaunchState" AS ENUM ('DRAFT', 'OPEN', 'CLOSED', 'SETTLED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentCheckState" AS ENUM ('LOCKED', 'EXPIRED', 'RECLAIMED', 'CLAIMED', 'FAILED');

-- CreateTable
CREATE TABLE "Launch" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "creator" TEXT NOT NULL,
    "emoji" TEXT NOT NULL DEFAULT '🪙',
    "hue" INTEGER NOT NULL DEFAULT 145,
    "tagline" TEXT NOT NULL DEFAULT 'A sealed-bid launch.',
    "supplyAtomic" TEXT NOT NULL,
    "reserveAtomic" TEXT NOT NULL,
    "tokenDecimals" INTEGER NOT NULL,
    "paymentToken" TEXT NOT NULL,
    "paymentDecimals" INTEGER NOT NULL,
    "capBps" INTEGER,
    "state" "LaunchState" NOT NULL DEFAULT 'DRAFT',
    "opensAt" TIMESTAMP(3),
    "closesAt" TIMESTAMP(3),
    "tokenContract" TEXT,
    "codeHash" TEXT,
    "bidCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Launch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentCheck" (
    "id" TEXT NOT NULL,
    "launchId" TEXT NOT NULL,
    "bidder" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "amountAtomic" TEXT NOT NULL,
    "state" "PaymentCheckState" NOT NULL DEFAULT 'LOCKED',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "providerRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentCheck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bid" (
    "id" TEXT NOT NULL,
    "launchId" TEXT NOT NULL,
    "bidder" TEXT NOT NULL,
    "ciphertext" TEXT NOT NULL,
    "commitment" TEXT NOT NULL,
    "paymentCheckId" TEXT NOT NULL,
    "keyId" TEXT NOT NULL,
    "receiptId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Bid_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Launch_state_closesAt_idx" ON "Launch"("state", "closesAt");

-- CreateIndex
CREATE INDEX "PaymentCheck_launchId_bidder_idx" ON "PaymentCheck"("launchId", "bidder");

-- CreateIndex
CREATE UNIQUE INDEX "Bid_paymentCheckId_key" ON "Bid"("paymentCheckId");

-- CreateIndex
CREATE UNIQUE INDEX "Bid_receiptId_key" ON "Bid"("receiptId");

-- CreateIndex
CREATE INDEX "Bid_launchId_createdAt_idx" ON "Bid"("launchId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Bid_launchId_bidder_key" ON "Bid"("launchId", "bidder");

-- AddForeignKey
ALTER TABLE "PaymentCheck" ADD CONSTRAINT "PaymentCheck_launchId_fkey" FOREIGN KEY ("launchId") REFERENCES "Launch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bid" ADD CONSTRAINT "Bid_launchId_fkey" FOREIGN KEY ("launchId") REFERENCES "Launch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bid" ADD CONSTRAINT "Bid_paymentCheckId_fkey" FOREIGN KEY ("paymentCheckId") REFERENCES "PaymentCheck"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
