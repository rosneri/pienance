-- Carry over: last month's leftover, added to one slice of a month's pie. One per month.
-- CreateTable
CREATE TABLE "Carry" (
    "id" TEXT NOT NULL,
    "pieId" TEXT NOT NULL,
    "sliceId" TEXT NOT NULL,
    "month" TIMESTAMP(3) NOT NULL,
    "currency" TEXT NOT NULL,
    "amountMinor" BIGINT NOT NULL,

    CONSTRAINT "Carry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Carry_sliceId_idx" ON "Carry"("sliceId");

-- CreateIndex
CREATE UNIQUE INDEX "Carry_pieId_month_key" ON "Carry"("pieId", "month");

-- AddForeignKey
ALTER TABLE "Carry" ADD CONSTRAINT "Carry_pieId_fkey" FOREIGN KEY ("pieId") REFERENCES "Pie"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Carry" ADD CONSTRAINT "Carry_sliceId_fkey" FOREIGN KEY ("sliceId") REFERENCES "Slice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
