-- Staples: bites that come back every month, counted from `since` up to (not including) `until`.
-- CreateTable
CREATE TABLE "Staple" (
    "id" TEXT NOT NULL,
    "sliceId" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "amountMinor" BIGINT NOT NULL,
    "note" TEXT NOT NULL,
    "since" TIMESTAMP(3) NOT NULL,
    "until" TIMESTAMP(3),

    CONSTRAINT "Staple_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Staple_sliceId_since_idx" ON "Staple"("sliceId", "since");

-- AddForeignKey
ALTER TABLE "Staple" ADD CONSTRAINT "Staple_sliceId_fkey" FOREIGN KEY ("sliceId") REFERENCES "Slice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
