-- AlterTable
ALTER TABLE "Cycle" ADD COLUMN     "transitionReason" TEXT;

-- CreateTable
CREATE TABLE "HouseholdNotification" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "recipientUserId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "cycleId" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HouseholdNotification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HouseholdNotification_recipientUserId_createdAt_idx" ON "HouseholdNotification"("recipientUserId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "HouseholdNotification_cycleId_recipientUserId_type_key" ON "HouseholdNotification"("cycleId", "recipientUserId", "type");

-- AddForeignKey
ALTER TABLE "HouseholdNotification" ADD CONSTRAINT "HouseholdNotification_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HouseholdNotification" ADD CONSTRAINT "HouseholdNotification_recipientUserId_fkey" FOREIGN KEY ("recipientUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HouseholdNotification" ADD CONSTRAINT "HouseholdNotification_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "Cycle"("id") ON DELETE SET NULL ON UPDATE CASCADE;
