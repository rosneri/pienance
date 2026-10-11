import { describe, expect, it } from "vitest";
import { currencyOf, Money, Month, Pie, Proportion, type Bite } from "../domain";
import { InMemoryPieRepository } from "./in-memory-pie-repository";

const eur = currencyOf("EUR");

const october = Month.of(new Date(Date.UTC(2026, 9, 1)));

function pieFor(ownerId: string, bites: readonly Bite[] = []) {
  return Pie.bake({
    id: `pie-${ownerId}`,
    ownerId,
    income: Money.parse("1000", eur),
    slices: [{ id: "all", name: "All", share: Proportion.of(1) }],
    bakedAt: new Date(Date.UTC(2026, 8, 1)),
    bites,
  });
}

function biteOn(day: Date, id = `bite-${day.getTime()}`): Bite {
  return { id, sliceId: "all", amount: Money.parse("10", eur), note: "", eatenAt: day };
}

describe("InMemoryPieRepository", () => {
  it("finds nothing for an owner without a pie", async () => {
    expect(await new InMemoryPieRepository().find("ada", october)).toBeNull();
  });

  it("keeps each owner's pie apart", async () => {
    const pies = new InMemoryPieRepository();

    await pies.save(pieFor("ada"));
    await pies.save(pieFor("grace"));

    expect((await pies.find("ada", october))?.id).toBe("pie-ada");
    expect((await pies.find("grace", october))?.id).toBe("pie-grace");
  });

  it("serves only the bites of the asked month", async () => {
    const pies = new InMemoryPieRepository();

    await pies.save(
      pieFor("ada", [
        biteOn(new Date(Date.UTC(2026, 8, 30))),
        biteOn(new Date(Date.UTC(2026, 9, 2))),
      ]),
    );

    expect((await pies.find("ada", october))?.bites).toHaveLength(1);
  });

  it("keeps earlier bites when a month's pie is saved again", async () => {
    const pies = new InMemoryPieRepository();
    const september = biteOn(new Date(Date.UTC(2026, 8, 30)), "september");

    await pies.save(pieFor("ada", [september]));

    const thisMonth = await pies.find("ada", october);

    thisMonth?.take(biteOn(new Date(Date.UTC(2026, 9, 2)), "october"));

    if (thisMonth) await pies.save(thisMonth);

    const all = await pies.find("ada", Month.of(new Date(Date.UTC(2026, 8, 1))));

    expect(all?.bites.map((bite) => bite.id)).toEqual(["september"]);
    expect((await pies.find("ada", october))?.bites.map((bite) => bite.id)).toEqual(["october"]);
  });

  it("serves only the staples active in the asked month, and keeps a drop", async () => {
    const pies = new InMemoryPieRepository();

    const rent = {
      id: "rent",
      sliceId: "all",
      amount: Money.parse("500", eur),
      note: "Rent",
      since: october,
    };

    await pies.save(pieFor("ada"));
    const pie = await pies.find("ada", october);

    pie?.stock(rent);

    if (pie) await pies.save(pie);

    const november = october.next();

    expect((await pies.find("ada", october.previous()))?.staples).toHaveLength(0);
    expect((await pies.find("ada", november))?.staples).toHaveLength(1);

    const later = await pies.find("ada", november);

    later?.drop("rent", november);

    if (later) await pies.save(later);

    expect((await pies.find("ada", october))?.staples).toHaveLength(1);
    expect((await pies.find("ada", november))?.staples).toHaveLength(1);
    expect((await pies.find("ada", november.next()))?.staples).toHaveLength(0);
  });
});
