-- Sweep: round bites up and count the difference as eaten from one slice.
-- AlterTable
ALTER TABLE "Bite" ADD COLUMN     "sweptMinor" BIGINT,
ADD COLUMN     "sweptSliceId" TEXT;

-- AlterTable
ALTER TABLE "Pie" ADD COLUMN     "sweepSliceId" TEXT,
ADD COLUMN     "sweepStepMinor" BIGINT;
