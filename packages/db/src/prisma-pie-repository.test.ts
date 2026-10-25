import { currencyOf, Money, Month, Pie, Proportion } from "@pienance/core";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaPieRepository } from "./prisma-pie-repository";
import { startTestDatabase, type TestDatabase } from "./testing/test-database";

const october = Month.of(new Date(Date.UTC(2026, 9, 15)));

/** Pies are seeded from September, so October's bites ride along as later ones. */
const september = october.previous();

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
    month: september,
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

  it("forgets a put back bite and keeps a moved one in its new slice", async () => {
    const pie = bakeFor("ada");

    const bite = (id: string, eatenAt: Date) => ({
      id,
      sliceId: "pie-ada-wants",
      amount: Money.parse("1200", yen),
      note: id,
      eatenAt,
    });

    pie.take(bite("september", new Date(Date.UTC(2026, 8, 30))));
    pie.take(bite("ramen", new Date(Date.UTC(2026, 9, 3))));
    pie.take(bite("typo", new Date(Date.UTC(2026, 9, 4))));
    await pies.save(pie);

    const served = await pies.find("ada", october);

    served?.putBack("typo");
    served?.move("ramen", "pie-ada-needs");
    await pies.save(served!);

    expect(
      (await pies.find("ada", october))?.bites.map((found) => [
        found.id,
        found.sliceId,
        found.amount.minor,
      ]),
    ).toEqual([["ramen", "pie-ada-needs", 1200]]);
    expect(
      (await pies.find("ada", Month.of(new Date(Date.UTC(2026, 8, 30)))))?.bites.map(
        (found) => found.id,
      ),
    ).toEqual(["september"]);
  });

  it("re-slices in place, keeping retired slices with their bites", async () => {
    const pie = bakeFor("ada");

    pie.take({
      id: "ramen",
      sliceId: "pie-ada-wants",
      amount: Money.parse("1200", yen),
      note: "Ramen",
      eatenAt: new Date(Date.UTC(2026, 9, 3)),
    });
    await pies.save(pie);
    await pies.save(
      pie.reslice({
        income: Money.parse("500000", yen),
        slices: [
          { id: "pie-ada-needs", name: "Rent", share: Proportion.whole },
          { id: "pie-ada-wants", name: "Wants", share: Proportion.none, retired: true },
        ],
      }),
    );

    const found = await pies.find("ada", october);

    expect(found?.id).toBe("pie-ada");
    expect(found?.income.minor).toBe(500_000);
    expect(
      found?.slices.map((slice) => [slice.name, slice.share.ratio, Boolean(slice.retired)]),
    ).toEqual([
      ["Rent", 1, false],
      ["Wants", 0, true],
    ]);
    expect(found?.bites.map((bite) => bite.id)).toEqual(["ramen"]);
  });

  it("keeps each part of a spread in its month, and puts back the rest", async () => {
    const pie = bakeFor("ada");

    const part = (n: number, eatenAt: Date) => ({
      id: `laptop-${n}`,
      sliceId: "pie-ada-wants",
      amount: Money.parse("1000", yen),
      note: "Laptop",
      eatenAt,
      spread: { id: "laptop", part: n, of: 3 },
    });

    pie.take(part(1, september.start));
    pie.take(part(2, october.start));
    pie.take(part(3, october.next().start));
    await pies.save(pie);

    const served = await pies.find("ada", october);

    expect(served?.bites.map((bite) => bite.spread)).toEqual([{ id: "laptop", part: 2, of: 3 }]);

    served?.putBackSpread("laptop");
    await pies.save(served!);

    expect((await pies.find("ada", september))?.bites.map((bite) => bite.id)).toEqual(["laptop-1"]);
    expect((await pies.find("ada", october))?.bites).toEqual([]);
    expect((await pies.find("ada", october.next()))?.bites).toEqual([]);
  });

  it("keeps one carry a month, and forgets it once undone", async () => {
    await pies.save(bakeFor("ada"));

    const served = await pies.find("ada", october);

    served?.carryOver({ sliceId: "pie-ada-wants", amount: Money.parse("5000", yen) });
    await pies.save(served!);

    const carried = await pies.find("ada", october);

    expect(carried?.carry?.amount.minor).toBe(5000);
    expect(carried?.whole.minor).toBe(455_000);
    expect((await pies.find("ada", september))?.carry).toBeUndefined();

    carried?.dropCarry();
    await pies.save(carried!);

    expect((await pies.find("ada", october))?.carry).toBeUndefined();
  });

  it("keeps the sweep setting and each bite's sweep", async () => {
    const pie = bakeFor("ada");

    pie.setSweep({ sliceId: "pie-ada-needs", step: Money.parse("100", yen) });
    pie.take({
      id: "ramen",
      sliceId: "pie-ada-wants",
      amount: Money.parse("1230", yen),
      note: "Ramen",
      eatenAt: october.start,
      swept: { sliceId: "pie-ada-needs", amount: Money.parse("70", yen) },
    });
    await pies.save(pie);

    const found = await pies.find("ada", october);

    expect(found?.sweep?.step.minor).toBe(100);
    expect(found?.bites[0]?.swept?.amount.minor).toBe(70);

    found?.setSweep(undefined);
    await pies.save(found!);

    const off = await pies.find("ada", october);

    expect(off?.sweep).toBeUndefined();
    expect(off?.bites[0]?.swept?.amount.minor).toBe(70);
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
