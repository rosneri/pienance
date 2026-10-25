import { InMemoryPieRepository, noAdvice, pienance, type PieRepository } from "@pienance/core";
import { describe, expect, it } from "vitest";
import type { ProductEvent } from "@pienance/telemetry/contract";
import { pieActions } from "./pie-actions";

function kitchen(pies: PieRepository = new InMemoryPieRepository()) {
  let id = 0;
  const clock = { now: new Date(Date.UTC(2026, 9, 10)) };
  const now = () => clock.now;

  const app = pienance({ pies, advisor: noAdvice, newId: () => `id-${++id}`, now });

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
        portion: "1/4",
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

  it("takes a bite and answers with it, then puts it back or moves it", async () => {
    const { as, refreshes, tracked } = kitchen();
    const ada = as("ada");
    const baked = await ada.bakePie({ monthlyIncome: "3000", currency: "EUR" });
    const [needs, wants] = baked.ok ? baked.value.slices.map((slice) => slice.id) : [];
    const taken = await ada.takeBite({ sliceId: wants!, amount: "90", note: "Shoes" });

    expect(taken.ok && [taken.value.note, taken.value.portionWords, taken.value.sliceName]).toEqual(
      ["Shoes", "about a tenth", "Wants"],
    );

    const biteId = taken.ok ? taken.value.id : "";
    const moved = await ada.moveBite({ biteId, sliceId: needs! });

    expect(moved.ok && [moved.value.sliceName, moved.value.portionWords]).toEqual([
      "Needs",
      "a sliver",
    ]);
    expect(await ada.putBackBite({ biteId })).toEqual({ ok: true, value: null });
    expect((await ada.readPie())?.bites).toEqual([]);
    expect(await ada.putBackBite({ biteId })).toEqual({
      ok: false,
      error: "That bite is not in this month's pie.",
    });
    expect(refreshes).toHaveLength(4);
    expect(tracked.map(({ event }) => event.name)).toEqual([
      "pie.baked",
      "bite.taken",
      "bite.moved",
      "bite.put-back",
    ]);
  });

  it("re-slices the pie, previewing first, and records only counts", async () => {
    const { as, refreshes, tracked } = kitchen();
    const ada = as("ada");

    await ada.bakePie({ monthlyIncome: "3000", currency: "EUR" });

    const view = await ada.readReslice();
    const [needs, wants] = view?.slices ?? [];

    expect(view?.slices.map((slice) => [slice.name, slice.percent])).toEqual([
      ["Needs", 50],
      ["Wants", 30],
      ["Savings", 20],
    ]);

    await ada.takeBite({ sliceId: wants!.id, amount: "600", note: "Trip" });

    const input = {
      slices: [
        { id: needs!.id, name: "Needs", percent: 80 },
        { id: wants!.id, name: "Wants", percent: 20 },
      ],
    };

    expect(await ada.previewReslice(input)).toEqual({
      ok: true,
      value: { verdict: "overflows", sentence: "Wants would be all eaten." },
    });
    expect(refreshes).toHaveLength(2);

    const resliced = await ada.reslicePie(input);

    expect(resliced.ok && resliced.value.slices.map((slice) => slice.name)).toEqual([
      "Needs",
      "Wants",
    ]);
    expect(refreshes).toHaveLength(3);
    expect(tracked.at(-1)?.event).toEqual({
      name: "pie.resliced",
      properties: { slices: 2, retired: 1 },
    });
    expect(await ada.reslicePie({ slices: [{ name: "All", percent: 95 }] })).toEqual({
      ok: false,
      error: "Slices must add up to the whole pie, got 95%",
    });
  });

  it("takes a spread, answering with this month's part, and puts back the rest", async () => {
    const { as, tracked } = kitchen();
    const ada = as("ada");
    const baked = await ada.bakePie({ monthlyIncome: "3000", currency: "EUR" });
    const wants = baked.ok ? (baked.value.slices[1]?.id ?? "") : "";
    const taken = await ada.takeBite({ sliceId: wants, amount: "900", note: "Laptop", months: 6 });

    expect(taken.ok && [taken.value.portion, taken.value.spread?.words]).toEqual(["1/6", "1 of 6"]);
    expect(
      await ada.putBackSpread({ spreadId: taken.ok ? (taken.value.spread?.id ?? "") : "" }),
    ).toEqual({ ok: true, value: null });
    expect((await ada.readPie())?.bites).toEqual([]);
    expect(tracked.map(({ event }) => event)).toContainEqual({
      name: "spread.taken",
      properties: { months: 6 },
    });
    expect(await ada.takeBite({ sliceId: wants, amount: "9", note: "", months: 40 })).toEqual({
      ok: false,
      error: "Spread it over 2 to 24 months.",
    });
  });

  it("offers last month's leftover, carries it, and undoes it", async () => {
    const { as, clock, tracked } = kitchen();
    const ada = as("ada");
    const baked = await ada.bakePie({ monthlyIncome: "1000", currency: "EUR" });
    const savings = baked.ok ? (baked.value.slices[2]?.id ?? "") : "";

    expect(await ada.readCarryOffer()).toBeNull();

    clock.now = new Date(Date.UTC(2026, 10, 3));

    expect(await ada.readCarryOffer()).toEqual({
      month: "2026-10",
      monthName: "October",
      leftoverWords: "all",
    });

    const carried = await ada.carryOver({ sliceId: savings });

    expect(carried.ok && carried.value.carry).toEqual({
      sliceId: savings,
      sliceName: "Savings",
      from: "October",
    });
    expect(await ada.readCarryOffer()).toBeNull();
    expect((await ada.dropCarry()).ok).toBe(true);
    expect(tracked.slice(-2).map(({ event }) => event.name)).toEqual([
      "carry.carried",
      "carry.dropped",
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

  it("reads a statement, then takes its bites", async () => {
    const { as, refreshes, tracked } = kitchen();
    const ada = as("ada");

    const csv = [
      "Date;Description;Amount",
      "02.10.2026;Bakery;-4,20",
      "03.10.2026;Salary;3.000,00",
      '05.10.2026;"Cinema; two seats";-24,00',
    ].join("\n");

    await ada.bakePie({ monthlyIncome: "3000", currency: "EUR" });

    const read = await ada.readStatement({ csv });
    const bites = read.ok ? read.value.bites : [];

    expect(bites.map((bite) => [bite.eatenOn, bite.amount, bite.note])).toEqual([
      ["2026-10-02", "4.20", "Bakery"],
      ["2026-10-05", "24.00", "Cinema; two seats"],
    ]);
    expect(refreshes).toHaveLength(1);

    expect(await ada.takeBites({ bites })).toEqual({
      ok: true,
      value: { taken: 2, duplicates: 0 },
    });
    expect(await ada.takeBites({ bites })).toEqual({
      ok: true,
      value: { taken: 0, duplicates: 2 },
    });
    expect((await ada.readPie())?.bites).toHaveLength(2);
    expect(refreshes).toHaveLength(3);
    expect(tracked.slice(1).map(({ event }) => event)).toEqual([
      { name: "statement.read", properties: { bites: 2, trimmed: false } },
      { name: "bites.taken", properties: { taken: 2, duplicates: 0 } },
      { name: "bites.taken", properties: { taken: 0, duplicates: 2 } },
    ]);
  });

  it("reads only the first lines of a statement over the limits", async () => {
    const { as, tracked } = kitchen();
    const ada = as("ada");

    const csv = [
      "Date,Description,Amount",
      ...Array.from(
        { length: 2_400 },
        (_, index) => `0${1 + (index % 9)}/10/2026,Coffee ${index},-3.00`,
      ),
    ].join("\n");

    await ada.bakePie({ monthlyIncome: "3000", currency: "EUR" });

    const read = await ada.readStatement({ csv });

    expect(read.ok && read.value.trimmed).toEqual({ kept: 2_000, total: 2_401 });
    expect(read.ok && read.value.bites).toHaveLength(1_999);
    expect(tracked.at(-1)?.event).toEqual({
      name: "statement.read",
      properties: { bites: 1_999, trimmed: true },
    });
  });

  it("returns statement problems as values", async () => {
    const { as } = kitchen();
    const ada = as("ada");

    await ada.bakePie({ monthlyIncome: "3000", currency: "EUR" });

    expect(await ada.readStatement({ csv: "Name,Email\nAda,ada@example.com" })).toEqual({
      ok: false,
      error: "This file does not look like a list of transactions",
    });
    expect(await ada.readStatement({ csv: "x".repeat(2_000_001) })).toEqual({
      ok: false,
      error: "That file is too big to read",
    });
    expect(await as(null).readStatement({ csv: "" })).toEqual({
      ok: false,
      error: "Sign in first.",
    });
  });
});
