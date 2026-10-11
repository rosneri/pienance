-- Re-slice: a removed slice is retired. It keeps its past bites but takes no share.
-- AlterTable
ALTER TABLE "Slice" ADD COLUMN     "retired" BOOLEAN NOT NULL DEFAULT false;
