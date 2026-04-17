-- AlterTable
ALTER TABLE "HouseholdMember" ADD COLUMN     "isDefault" BOOLEAN NOT NULL DEFAULT false;

-- Backfill: every existing membership becomes the user's default (Phase 1 guarantees exactly one membership per user)
UPDATE "HouseholdMember" SET "isDefault" = true;
