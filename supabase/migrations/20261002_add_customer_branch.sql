-- AlterTable customers: Add branch column if not exists
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "branch" TEXT DEFAULT 'Telkom';

-- Backfill existing customers with null branch to 'Telkom'
UPDATE "customers" SET "branch" = 'Telkom' WHERE "branch" IS NULL;
