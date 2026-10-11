import { currencyOf, Money, Month, Pie, Proportion } from "@pienance/core";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaPieRepository } from "./prisma-pie-repository";
import { startTestDatabase, type TestDatabase } from "./testing/test-database";

const october = Month.of(new Date(Date.UTC(2026, 9, 15)));

const yen = currencyOf("JPY");

let database: TestDatabase;

let pies: PrismaPieRepository;

beforeAll(async () => {
  database = await startTestDatabase();
  pies = new PrismaPieRepository(database.prisma);
});

afterAll(async () => {
  await database.stop();
});

beforeEach(async () => {
  await database.prisma.user.deleteMany();

  await database.prisma.user.createMany({
    data: ["ada", "grace"].map((id) => ({ id, name: id, email: `${id}@example.com` })),
  });
});

function bakeFor(ownerId: string, id = `pie-${ownerId}`, bakedAt = new Date()) {
  return Pie.bake({
    id,
    ownerId,
    bakedAt,
    income: Money.parse("450000", yen),
    slices: [
      { id: `${id}-needs`, name: "Needs", share: Proportion.of(0.5) },
      { id: `${id}-wants`, name: "Wants", share: Proportion.of(0.5) },
    ],
  });
}

describe("PrismaPieRepository (Postgres)", () => {
  it("finds nothing before a pie is baked", async () => {
    expect(await pies.find("ada", october)).toBeNull();
  });

  it("round-trips a pie with its currency, slices and bites", async () => {
    const pie = bakeFor("ada");

    pie.take({
      id: "ramen",
      sliceId: "pie-ada-wants",
      amount: Money.parse("1200", yen),
      note: "Ramen",
      eatenAt: new Date(Date.UTC(2026, 9, 3)),
    });
    await pies.save(pie);

    const found = await pies.find("ada", october);

    expect(found?.currency.code).toBe("JPY");
    expect(found?.income.minor).toBe(450_000);
    expect(found?.slices.map((slice) => [slice.name, slice.share.ratio])).toEqual([
      ["Needs", 0.5],
      ["Wants", 0.5],
    ]);
    expect(found?.bites.map((bite) => [bite.note, bite.amount.minor])).toEqual([["Ramen", 1200]]);
  });

  it("saves again without duplicating bites", async () => {
    const pie = bakeFor("ada");

    await pies.save(pie);
    pie.take({
      id: "tea",
      sliceId: "pie-ada-needs",
      amount: Money.parse("300", yen),
      note: "Tea",
      eatenAt: new Date(Date.UTC(2026, 9, 4)),
    });
    await pies.save(pie);
    await pies.save(pie);

    expect((await pies.find("ada", october))?.bites).toHaveLength(1);
  });

  it("serves only the bites of the asked month", async () => {
    const pie = bakeFor("ada");

    pie.take({
      id: "september",
      sliceId: "pie-ada-needs",
      amount: Money.parse("100", yen),
      note: "",
      eatenAt: new Date(Date.UTC(2026, 8, 30)),
    });
    await pies.save(pie);

    expect((await pies.find("ada", october))?.bites).toHaveLength(0);
  });

  it("keeps owners apart and serves an owner's latest pie", async () => {
    await pies.save(bakeFor("grace"));
    await pies.save(bakeFor("ada", "first", new Date(Date.UTC(2026, 8, 1))));
    await pies.save(bakeFor("ada", "second", new Date(Date.UTC(2026, 9, 1))));

    expect((await pies.find("ada", october))?.id).toBe("second");
    expect((await pies.find("grace", october))?.id).toBe("pie-grace");
  });

  it("keeps when a pie was baked", async () => {
    const bakedAt = new Date(Date.UTC(2026, 6, 14, 9));

    await pies.save(bakeFor("ada", "pie-ada", bakedAt));

    expect((await pies.find("ada", october))?.bakedAt).toEqual(bakedAt);
  });

  it("serves only the staples active in the asked month, and keeps a drop", async () => {
    const pie = bakeFor("ada");

    pie.stock({
      id: "rent",
      sliceId: "pie-ada-needs",
      amount: Money.parse("90000", yen),
      note: "Rent",
      since: october,
    });
    await pies.save(pie);

    const staples = async (month: Month) =>
      (await pies.find("ada", month))?.staples.map((staple) => [
        staple.note,
        staple.amount.minor,
        staple.since.toString(),
        staple.until?.toString(),
      ]);

    const november = october.next();

    expect(await staples(october.previous())).toEqual([]);
    expect(await staples(november)).toEqual([["Rent", 90_000, "2026-10", undefined]]);

    const later = await pies.find("ada", november);

    later?.drop("rent", november);

    if (later) await pies.save(later);

    expect(await staples(november)).toEqual([["Rent", 90_000, "2026-10", "2026-12"]]);
    expect(await staples(november.next())).toEqual([]);
  });

  it("forgets a staple dropped in the month it was stocked", async () => {
    const pie = bakeFor("ada");

    pie.stock({
      id: "oops",
      sliceId: "pie-ada-needs",
      amount: Money.parse("100", yen),
      note: "",
      since: october,
    });
    pie.drop("oops", october);
    await pies.save(pie);

    expect((await pies.find("ada", october))?.staples).toEqual([]);
  });
});
