import { InMemoryPieRepository, pienance, type PieRepository } from "@pienance/core";
import { describe, expect, it } from "vitest";
import type { ProductEvent } from "@pienance/telemetry/contract";
import { pieActions } from "./pie-actions";

function kitchen(pies: PieRepository = new InMemoryPieRepository()) {
  let id = 0;
  const clock = { now: new Date(Date.UTC(2026, 9, 10)) };
  const now = () => clock.now;

  const app = pienance({ pies, newId: () => `id-${++id}`, now });

  const refreshes: string[] = [];
  const tracked: Array<{ event: ProductEvent; ownerId: string }> = [];

  const as = (owner: string | null) =>
    pieActions({
      app,
      owner: async () => owner,
      refresh: () => refreshes.push("refresh"),
      track: (event, ownerId) => tracked.push({ event, ownerId }),
      now,
    });

  return { as, clock, refreshes, tracked };
}

describe("pie actions", () => {
  it("shows nothing to someone signed out", async () => {
    expect(await kitchen().as(null).readPie()).toBeNull();
  });

  it("asks to sign in before changing anything", async () => {
    const { as, refreshes } = kitchen();
    const outcome = await as(null).bakePie({ monthlyIncome: "3000", currency: "EUR" });

    expect(outcome).toEqual({ ok: false, error: "Sign in first." });
    expect(refreshes).toHaveLength(0);
  });

  it("bakes a pie and refreshes the page", async () => {
    const { as, refreshes } = kitchen();
    const outcome = await as("ada").bakePie({ monthlyIncome: "3000", currency: "EUR" });

    expect(outcome.ok && outcome.value.currency).toBe("EUR");
    expect(outcome.ok && outcome.value.leftoverWords).toBe("all");
    expect(refreshes).toEqual(["refresh"]);
    expect((await as("ada").readPie())?.slices.map((slice) => slice.name)).toEqual([
      "Needs",
      "Wants",
      "Savings",
    ]);
  });

  it("weighs a bite without refreshing", async () => {
    const { as, refreshes } = kitchen();
    const ada = as("ada");
    const baked = await ada.bakePie({ monthlyIncome: "3000", currency: "EUR" });
    const wants = baked.ok ? (baked.value.slices[1]?.id ?? "") : "";
    const outcome = await ada.weighBite({ sliceId: wants, amount: "225" });

    expect(outcome).toEqual({
      ok: true,
      value: {
        sliceName: "Wants",
        ofSlice: "about a quarter",
        ofLeftover: "about a quarter",
        ofPie: "a sliver",
        leftAfter: "about three quarters",
        stapled: "nothing",
        verdict: "fits",
      },
    });
    expect(refreshes).toHaveLength(1);
  });

  it("takes a bite and shows it", async () => {
    const { as } = kitchen();
    const ada = as("ada");
    const baked = await ada.bakePie({ monthlyIncome: "3000", currency: "EUR" });
    const needs = baked.ok ? (baked.value.slices[0]?.id ?? "") : "";

    expect((await ada.takeBite({ sliceId: needs, amount: "150", note: "Groceries" })).ok).toBe(
      true,
    );
    expect((await ada.readPie())?.bites.map((bite) => [bite.note, bite.portion])).toEqual([
      ["Groceries", "1/10"],
    ]);
  });

  it("returns domain errors as values", async () => {
    const { as } = kitchen();
    const ada = as("ada");

    expect(await ada.weighBite({ sliceId: "x", amount: "1" })).toEqual({
      ok: false,
      error: "Bake a pie first",
    });

    await ada.bakePie({ monthlyIncome: "3000", currency: "EUR" });

    expect(await ada.takeBite({ sliceId: "x", amount: "ten", note: "" })).toEqual({
      ok: false,
      error: '"ten" is not an amount of money',
    });
    expect(await ada.bakePie({ monthlyIncome: "1", currency: "XYZ" })).toEqual({
      ok: false,
      error: 'Unknown currency "XYZ"',
    });
  });

  it("keeps each person's pie to themselves", async () => {
    const { as } = kitchen();

    await as("ada").bakePie({ monthlyIncome: "3000", currency: "EUR" });

    expect(await as("grace").readPie()).toBeNull();
  });

  it("lets unexpected failures through", async () => {
    const broken: PieRepository = {
      find: async () => {
        throw new Error("database is down");
      },
      save: async () => undefined,
    };

    await expect(
      kitchen(broken).as("ada").weighBite({ sliceId: "x", amount: "1" }),
    ).rejects.toThrow("database is down");
  });

  it("records product events without amounts", async () => {
    const { as, tracked } = kitchen();
    const ada = as("ada");
    const baked = await ada.bakePie({ monthlyIncome: "3000", currency: "EUR" });
    const wants = baked.ok ? (baked.value.slices[1]?.id ?? "") : "";

    await ada.weighBite({ sliceId: wants, amount: "225" });
    await ada.takeBite({ sliceId: wants, amount: "100", note: "Cinema" });

    expect(tracked).toEqual([
      { event: { name: "pie.baked", properties: { currency: "EUR" } }, ownerId: "ada" },
      { event: { name: "bite.weighed", properties: { verdict: "fits" } }, ownerId: "ada" },
      { event: { name: "bite.taken", properties: {} }, ownerId: "ada" },
    ]);
  });

  it("records nothing for someone signed out", async () => {
    const { as, tracked } = kitchen();

    await as(null).bakePie({ monthlyIncome: "3000", currency: "EUR" });

    expect(tracked).toEqual([]);
  });

  it("serves this month with its pace", async () => {
    const { as } = kitchen();
    const ada = as("ada");

    await ada.bakePie({ monthlyIncome: "3000", currency: "EUR" });

    const pie = await ada.readPie();

    expect([pie?.month, pie?.monthName, pie?.goneWords]).toEqual([
      "2026-10",
      "October",
      "about a third",
    ]);
    expect(pie?.slices.map((slice) => slice.pace)).toEqual(["slow", "slow", "slow"]);
  });

  describe("staples", () => {
    it("stocks one, answers with its view, and counts it in the pie", async () => {
      const { as, refreshes, tracked } = kitchen();
      const ada = as("ada");
      const baked = await ada.bakePie({ monthlyIncome: "3000", currency: "EUR" });
      const needs = baked.ok ? (baked.value.slices[0]?.id ?? "") : "";
      const outcome = await ada.stockStaple({ sliceId: needs, amount: "1000", note: "Rent" });

      expect(outcome.ok && outcome.value).toMatchObject({
        note: "Rent",
        sliceName: "Needs",
        portionWords: "about two thirds",
        stockedThisMonth: true,
      });
      expect((await ada.readPie())?.slices[0]?.stapledWords).toBe("about two thirds");
      expect(refreshes).toHaveLength(2);
      expect(tracked.at(-1)?.event).toEqual({
        name: "staple.stocked",
        properties: { replaced: false },
      });
    });

    it("removes one stocked this month, and stops an older one after this month", async () => {
      const { as, clock, tracked } = kitchen();
      const ada = as("ada");
      const baked = await ada.bakePie({ monthlyIncome: "3000", currency: "EUR" });
      const needs = baked.ok ? (baked.value.slices[0]?.id ?? "") : "";
      const stock = () => ada.stockStaple({ sliceId: needs, amount: "100", note: "Water" });
      const fresh = await stock();
      const removed = await ada.dropStaple({ stapleId: fresh.ok ? fresh.value.id : "" });

      expect(removed.ok && removed.value.endsAfter).toBeUndefined();
      expect((await ada.readPie())?.staples).toEqual([]);

      const old = await stock();

      clock.now = new Date(Date.UTC(2026, 10, 3));
      const stopped = await ada.dropStaple({ stapleId: old.ok ? old.value.id : "" });

      expect(stopped.ok && stopped.value.endsAfter).toBe("November");
      expect((await ada.readPie())?.staples.map((staple) => staple.endsAfter)).toEqual([
        "November",
      ]);
      expect(tracked.filter(({ event }) => event.name === "staple.dropped")).toEqual([
        { event: { name: "staple.dropped", properties: { removed: true } }, ownerId: "ada" },
        { event: { name: "staple.dropped", properties: { removed: false } }, ownerId: "ada" },
      ]);
    });

    it("refuses one of nothing, as a value", async () => {
      const { as } = kitchen();
      const ada = as("ada");
      const baked = await ada.bakePie({ monthlyIncome: "3000", currency: "EUR" });
      const needs = baked.ok ? (baked.value.slices[0]?.id ?? "") : "";

      expect(await ada.stockStaple({ sliceId: needs, amount: "0", note: "" })).toEqual({
        ok: false,
        error: "A staple needs an amount above zero",
      });
    });
  });

  describe("shelf", () => {
    async function monthsLater() {
      const { as, clock } = kitchen();
      const ada = as("ada");
      const baked = await ada.bakePie({ monthlyIncome: "3000", currency: "EUR" });
      const wants = baked.ok ? (baked.value.slices[1]?.id ?? "") : "";

      await ada.takeBite({ sliceId: wants, amount: "450", note: "Concert" });
      clock.now = new Date(Date.UTC(2027, 0, 15));

      return ada;
    }

    it("serves a past month on the shelf, without pace", async () => {
      const ada = await monthsLater();
      const october = await ada.readPie("2026-10");

      expect([october?.monthName, october?.gone, october?.bites.length]).toEqual([
        "October",
        undefined,
        1,
      ]);
    });

    it.each(["junk", "2026-9", "2026-09", "2027-01", "2027-02"])(
      "serves this month for %s",
      async (month) => {
        const ada = await monthsLater();

        expect((await ada.readPie(month))?.month).toBe("2027-01");
      },
    );

    it("lists this month, then the past ones, marking the one on screen", async () => {
      const ada = await monthsLater();
      const shelf = await ada.readShelf("2026-11");

      expect(shelf.map(({ month, current }) => [month, current])).toEqual([
        ["2027-01", false],
        ["2026-12", false],
        ["2026-11", true],
        ["2026-10", false],
      ]);
      expect(shelf.at(-1)?.leftoverWords).toBe("about three quarters");
    });

    it("is empty in the month the pie was baked", async () => {
      const { as } = kitchen();
      const ada = as("ada");

      await ada.bakePie({ monthlyIncome: "3000", currency: "EUR" });

      expect(await ada.readShelf()).toEqual([]);
      expect(await as(null).readShelf()).toEqual([]);
    });

    it("tells the appetite once three months have passed", async () => {
      const ada = await monthsLater();

      expect(await ada.readAppetite()).toEqual([
        { sentence: "Needs usually has more than half left.", streak: "leftover" },
        { sentence: "Savings usually has more than half left.", streak: "leftover" },
      ]);
    });
  });
});
