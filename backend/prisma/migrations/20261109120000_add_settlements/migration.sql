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
┌─────────────────────────────────────────────────────────┐
│  Update available 6.19.3 -> 8.0.0-rc.33                 │
│                                                         │
│  This is a major update - please follow the guide at    │
│  https://pris.ly/d/major-version-upgrade                │
│                                                         │
│  Run the following to update                            │
│    npm i --save-dev prisma@latest                       │
│    npm i @prisma/client@latest                          │
└─────────────────────────────────────────────────────────┘

