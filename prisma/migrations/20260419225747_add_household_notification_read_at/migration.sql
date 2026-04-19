-- AlterTable
ALTER TABLE "HouseholdNotification" ADD COLUMN     "readAt" TIMESTAMPTZ(3);

-- CreateIndex
CREATE INDEX "HouseholdNotification_recipientUserId_readAt_idx" ON "HouseholdNotification"("recipientUserId", "readAt");
