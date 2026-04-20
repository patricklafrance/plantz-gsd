-- WR-02 (Phase 5 review): escape hatch from D-03 "no payload snapshot" for
-- cycle_reassigned_* notification types. Stores the outgoing-assignee userId at
-- emission time so read-time UI shows the correct "Alice skipped" name even
-- after further rotation (manual out-of-order skips, chained skips).
-- Nullable: cycle_started + cycle_fallback_owner leave this NULL.
-- onDelete: SetNull — if the prior assignee's User row is deleted, the
-- notification survives with priorAssigneeUserId = NULL (UI falls back to
-- "Someone"), matching the recipient-side cascade contract already in place.

-- AlterTable
ALTER TABLE "HouseholdNotification" ADD COLUMN     "priorAssigneeUserId" TEXT;

-- AddForeignKey
ALTER TABLE "HouseholdNotification" ADD CONSTRAINT "HouseholdNotification_priorAssigneeUserId_fkey" FOREIGN KEY ("priorAssigneeUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
