import { Money, type Month, Pie, type PieRepository, Proportion } from "@/domain";
import type { PrismaClient } from "./generated/client";

export class PrismaPieRepository implements PieRepository {
  constructor(private readonly db: PrismaClient) {}

  async find(month: Month): Promise<Pie | null> {
    const row = await this.db.pie.findFirst({
      orderBy: { createdAt: "desc" },
      include: {
        slices: {
          orderBy: { position: "asc" },
          include: { bites: { where: { eatenAt: { gte: month.start, lt: month.end } } } },
        },
      },
    });
    if (!row) return null;

    return Pie.bake({
      id: row.id,
      income: Money.ofCents(row.incomeCents),
      slices: row.slices.map((slice) => ({
        id: slice.id,
        name: slice.name,
        share: Proportion.of(slice.share),
      })),
      bites: row.slices
        .flatMap((slice) => slice.bites)
        .toSorted((a, b) => a.eatenAt.getTime() - b.eatenAt.getTime())
        .map((bite) => ({
          id: bite.id,
          sliceId: bite.sliceId,
          amount: Money.ofCents(bite.amountCents),
          note: bite.note,
          eatenAt: bite.eatenAt,
        })),
    });
  }

  async save(pie: Pie): Promise<void> {
    await this.db.$transaction([
      this.db.pie.upsert({
        where: { id: pie.id },
        create: { id: pie.id, incomeCents: pie.income.cents },
        update: { incomeCents: pie.income.cents },
      }),
      ...pie.slices.map((slice, position) => {
        const data = { name: slice.name, share: slice.share.ratio, position };
        return this.db.slice.upsert({
          where: { id: slice.id },
          create: { id: slice.id, pieId: pie.id, ...data },
          update: data,
        });
      }),
      // Bites are immutable: only new ones need writing.
      this.db.bite.createMany({
        data: pie.bites.map((bite) => ({
          id: bite.id,
          sliceId: bite.sliceId,
          amountCents: bite.amount.cents,
          note: bite.note,
          eatenAt: bite.eatenAt,
        })),
        skipDuplicates: true,
      }),
    ]);
  }
}
