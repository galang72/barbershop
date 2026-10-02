-- AlterTable
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "branch" TEXT DEFAULT 'Telkom';

-- Backfill existing customers with null branch to default branch 'Telkom'
UPDATE "customers" SET "branch" = 'Telkom' WHERE "branch" IS NULL;
