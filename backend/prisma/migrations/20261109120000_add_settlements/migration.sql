-- CreateTable
CREATE TABLE "Settlement" (
    "id" TEXT NOT NULL,
    "launchId" TEXT NOT NULL,
    "clearingPrice" TEXT NOT NULL,
    "sold" TEXT NOT NULL,
    "totalRaised" TEXT NOT NULL,
    "outcome" JSONB NOT NULL,
    "inputHash" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "attestation" TEXT,
    "mode" TEXT NOT NULL DEFAULT 'dev',
    "skippedBids" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Settlement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Settlement_launchId_key" ON "Settlement"("launchId");

-- AddForeignKey
ALTER TABLE "Settlement" ADD CONSTRAINT "Settlement_launchId_fkey" FOREIGN KEY ("launchId") REFERENCES "Launch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
