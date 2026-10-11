import { currencyOf, Money, Month, Pie, type PieRepository, Proportion } from "@pienance/core";
import type { PrismaClient } from "./generated/client";

export class PrismaPieRepository implements PieRepository {
  constructor(private readonly db: PrismaClient) {}

  async find(ownerId: string, month: Month): Promise<Pie | null> {
    const row = await this.db.pie.findFirst({
      where: { ownerId },
      orderBy: { createdAt: "desc" },
      include: {
        slices: {
          orderBy: { position: "asc" },
          include: {
            bites: { where: { eatenAt: { gte: month.start, lt: month.end } } },
            // Active in the month: stocked by its start, not stopped by then.
            staples: {
              where: {
                since: { lte: month.start },
                OR: [{ until: null }, { until: { gt: month.start } }],
              },
            },
          },
        },
      },
    });

    if (!row) return null;

    return Pie.bake({
      id: row.id,
      ownerId: row.ownerId,
      income: Money.ofMinor(Number(row.incomeMinor), currencyOf(row.currency)),
      bakedAt: row.createdAt,
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
          amount: Money.ofMinor(Number(bite.amountMinor), currencyOf(bite.currency)),
          note: bite.note,
          eatenAt: bite.eatenAt,
        })),
      staples: row.slices
        .flatMap((slice) => slice.staples)
        .toSorted((a, b) => a.since.getTime() - b.since.getTime())
        .map((staple) => ({
          id: staple.id,
          sliceId: staple.sliceId,
          amount: Money.ofMinor(Number(staple.amountMinor), currencyOf(staple.currency)),
          note: staple.note,
          since: Month.of(staple.since),
          ...(staple.until && { until: Month.of(staple.until) }),
        })),
    });
  }

  async save(pie: Pie): Promise<void> {
    const income = { currency: pie.currency.code, incomeMinor: BigInt(pie.income.minor) };

    await this.db.$transaction([
      this.db.pie.upsert({
        where: { id: pie.id },
        create: { id: pie.id, ownerId: pie.ownerId, createdAt: pie.bakedAt, ...income },
        update: income,
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
          currency: bite.amount.currency.code,
          amountMinor: BigInt(bite.amount.minor),
          note: bite.note,
          eatenAt: bite.eatenAt,
        })),
        skipDuplicates: true,
      }),
      // A staple only changes when it is dropped, which sets `until`.
      ...pie.staples.map((staple) => {
        const until = staple.until?.start ?? null;

        return this.db.staple.upsert({
          where: { id: staple.id },
          create: {
            id: staple.id,
            sliceId: staple.sliceId,
            currency: staple.amount.currency.code,
            amountMinor: BigInt(staple.amount.minor),
            note: staple.note,
            since: staple.since.start,
            until,
          },
          update: { until },
        });
      }),
    ]);
  }
}
