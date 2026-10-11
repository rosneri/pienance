-- Spread: one expense split into equal monthly bites that share a spread id.
-- AlterTable
ALTER TABLE "Bite" ADD COLUMN     "spreadId" TEXT,
ADD COLUMN     "spreadOf" INTEGER,
ADD COLUMN     "spreadPart" INTEGER;

-- CreateIndex
CREATE INDEX "Bite_spreadId_idx" ON "Bite"("spreadId");
