import { currencyOf, Money, Month, Pie, type PieRepository, Proportion } from "@pienance/core";
import type { PrismaClient } from "./generated/client";

export class PrismaPieRepository implements PieRepository {
  constructor(private readonly db: PrismaClient) {}

  async find(ownerId: string, month: Month): Promise<Pie | null> {
    const row = await this.db.pie.findFirst({
      where: { ownerId },
      orderBy: { createdAt: "desc" },
      include: {
        carries: { where: { month: month.start } },
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

    const [carry] = row.carries;

    return Pie.bake({
      id: row.id,
      ownerId: row.ownerId,
      income: Money.ofMinor(Number(row.incomeMinor), currencyOf(row.currency)),
      bakedAt: row.createdAt,
      month,
      slices: row.slices.map((slice) => ({
        id: slice.id,
        name: slice.name,
        share: Proportion.of(slice.share),
        ...(slice.retired && { retired: true }),
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
          ...(bite.spreadId !== null &&
            bite.spreadPart !== null &&
            bite.spreadOf !== null && {
              spread: { id: bite.spreadId, part: bite.spreadPart, of: bite.spreadOf },
            }),
          ...(bite.sweptSliceId !== null &&
            bite.sweptMinor !== null && {
              swept: {
                sliceId: bite.sweptSliceId,
                amount: Money.ofMinor(Number(bite.sweptMinor), currencyOf(bite.currency)),
              },
            }),
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
      ...(row.sweepSliceId !== null &&
        row.sweepStepMinor !== null && {
          sweep: {
            sliceId: row.sweepSliceId,
            step: Money.ofMinor(Number(row.sweepStepMinor), currencyOf(row.currency)),
          },
        }),
      ...(carry && {
        carry: {
          sliceId: carry.sliceId,
          amount: Money.ofMinor(Number(carry.amountMinor), currencyOf(carry.currency)),
        },
      }),
    });
  }

  async save(pie: Pie): Promise<void> {
    const income = {
      currency: pie.currency.code,
      incomeMinor: BigInt(pie.income.minor),
      sweepSliceId: pie.sweep?.sliceId ?? null,
      sweepStepMinor: pie.sweep ? BigInt(pie.sweep.step.minor) : null,
    };

    await this.db.$transaction([
      this.db.pie.upsert({
        where: { id: pie.id },
        create: { id: pie.id, ownerId: pie.ownerId, createdAt: pie.bakedAt, ...income },
        update: income,
      }),
      ...pie.slices.map((slice, position) => {
        const data = {
          name: slice.name,
          share: slice.share.ratio,
          position,
          retired: Boolean(slice.retired),
        };

        return this.db.slice.upsert({
          where: { id: slice.id },
          create: { id: slice.id, pieId: pie.id, ...data },
          update: data,
        });
      }),
      ...(pie.putBackIds().length > 0
        ? [
            this.db.bite.deleteMany({
              where: { id: { in: [...pie.putBackIds()] }, slice: { pieId: pie.id } },
            }),
          ]
        : []),
      // A spread put back goes from the served month on; its earlier parts stay.
      ...(pie.putBackSpreadIds().length > 0
        ? [
            this.db.bite.deleteMany({
              where: {
                spreadId: { in: [...pie.putBackSpreadIds()] },
                eatenAt: { gte: pie.month.start },
                slice: { pieId: pie.id },
              },
            }),
          ]
        : []),
      // A bite only changes when it is moved into another slice.
      ...[...pie.bites, ...pie.laterBites].map((bite) =>
        this.db.bite.upsert({
          where: { id: bite.id },
          create: {
            id: bite.id,
            sliceId: bite.sliceId,
            currency: bite.amount.currency.code,
            amountMinor: BigInt(bite.amount.minor),
            note: bite.note,
            eatenAt: bite.eatenAt,
            spreadId: bite.spread?.id ?? null,
            spreadPart: bite.spread?.part ?? null,
            spreadOf: bite.spread?.of ?? null,
            sweptSliceId: bite.swept?.sliceId ?? null,
            sweptMinor: bite.swept ? BigInt(bite.swept.amount.minor) : null,
          },
          update: { sliceId: bite.sliceId },
        }),
      ),
      // One carry a month: it is written once, and only removed when undone.
      ...(pie.carry
        ? [
            this.db.carry.upsert({
              where: { pieId_month: { pieId: pie.id, month: pie.month.start } },
              create: {
                id: `${pie.id}:${pie.month.toString()}`,
                pieId: pie.id,
                sliceId: pie.carry.sliceId,
                month: pie.month.start,
                currency: pie.carry.amount.currency.code,
                amountMinor: BigInt(pie.carry.amount.minor),
              },
              update: {},
            }),
          ]
        : []),
      ...(pie.carryDropped() && !pie.carry
        ? [this.db.carry.deleteMany({ where: { pieId: pie.id, month: pie.month.start } })]
        : []),
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
