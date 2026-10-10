-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "Pie" (
    "id" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "incomeMinor" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Pie_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Slice" (
    "id" TEXT NOT NULL,
    "pieId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "share" DOUBLE PRECISION NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "Slice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bite" (
    "id" TEXT NOT NULL,
    "sliceId" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "amountMinor" BIGINT NOT NULL,
    "note" TEXT NOT NULL,
    "eatenAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Bite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Slice_pieId_idx" ON "Slice"("pieId");

-- CreateIndex
CREATE INDEX "Bite_sliceId_eatenAt_idx" ON "Bite"("sliceId", "eatenAt");

-- AddForeignKey
ALTER TABLE "Slice" ADD CONSTRAINT "Slice_pieId_fkey" FOREIGN KEY ("pieId") REFERENCES "Pie"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bite" ADD CONSTRAINT "Bite_sliceId_fkey" FOREIGN KEY ("sliceId") REFERENCES "Slice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

