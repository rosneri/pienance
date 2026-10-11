import { describe, expect, it } from "vitest";
import { InMemoryPieRepository } from "../adapters/in-memory-pie-repository";
import { noAdvice } from "../adapters/no-advice";
import { Month, PieError } from "../domain";
import { pienance } from ".";

function kitchen(now = new Date(Date.UTC(2026, 9, 10))) {
  let id = 0;
  const clock = { now };

  const app = pienance({
    pies: new InMemoryPieRepository(),
    advisor: noAdvice,
    newId: () => `id-${++id}`,
    now: () => clock.now,
  });

  return { app, clock };
}

describe("use cases", () => {
  it("has no pie until one is baked", async () => {
    expect(await kitchen().app.servePie("ada")).toBeNull();
  });

  it("bakes a 50/30/20 pie", async () => {
    const { app } = kitchen();
    await app.bakePie({ ownerId: "ada", monthlyIncome: "3000", currency: "EUR" });
    const pie = await app.servePie("ada");
    expect(pie?.slices.map((slice) => [slice.name, slice.share.ratio])).toEqual([
      ["Needs", 0.5],
      ["Wants", 0.3],
      ["Savings", 0.2],
    ]);
  });

  it("bakes in the chosen currency", async () => {
    const { app } = kitchen();
    const pie = await app.bakePie({ ownerId: "ada", monthlyIncome: "450000", currency: "jpy" });

    expect(pie.currency.code).toBe("JPY");
  });

  it("refuses an unknown currency", async () => {
    await expect(
      kitchen().app.bakePie({ ownerId: "ada", monthlyIncome: "1", currency: "XYZ" }),
    ).rejects.toThrow(RangeError);
  });

  it("weighs, then takes a bite", async () => {
    const { app } = kitchen();
    const pie = await app.bakePie({ ownerId: "ada", monthlyIncome: "3000", currency: "EUR" });
    const wants = pie.slices[1]!.id;

    const weighing = await app.weighBite({ ownerId: "ada", sliceId: wants, amount: "225" });
    expect(weighing.ofSlice.ratio).toBe(0.25);
    expect((await app.servePie("ada"))?.bites).toHaveLength(0);

    await app.takeBite({ ownerId: "ada", sliceId: wants, amount: "225", note: " Shoes " });
    const served = await app.servePie("ada");
    expect(served?.bites.map((bite) => bite.note)).toEqual(["Shoes"]);
    expect(served?.leftover().ratio).toBe(0.925);
  });

  it("keeps each owner's pie to themselves", async () => {
    const { app } = kitchen();
    const pie = await app.bakePie({ ownerId: "ada", monthlyIncome: "3000", currency: "EUR" });

    expect(await app.servePie("grace")).toBeNull();
    await expect(
      app.weighBite({ ownerId: "grace", sliceId: pie.slices[0]!.id, amount: "10" }),
    ).rejects.toThrow(PieError);
  });

  it("refuses an amount that is not money", async () => {
    const { app } = kitchen();
    const pie = await app.bakePie({ ownerId: "ada", monthlyIncome: "3000", currency: "EUR" });

    await expect(
      app.takeBite({ ownerId: "ada", sliceId: pie.slices[0]!.id, amount: "ten", note: "" }),
    ).rejects.toThrow(RangeError);
  });

  it("starts every month with a fresh pie", async () => {
    const { app, clock } = kitchen();
    const pie = await app.bakePie({ ownerId: "ada", monthlyIncome: "3000", currency: "EUR" });
    await app.takeBite({ ownerId: "ada", sliceId: pie.slices[0]!.id, amount: "100", note: "" });

    clock.now = new Date(Date.UTC(2026, 10, 1));
    expect((await app.servePie("ada"))?.bites).toHaveLength(0);
  });

  describe("putting back and moving bites", () => {
    async function withShoes() {
      const { app, clock } = kitchen();
      const pie = await app.bakePie({ ownerId: "ada", monthlyIncome: "3000", currency: "EUR" });
      const [needs, wants] = pie.slices.map((slice) => slice.id);

      const shoes = await app.takeBite({
        ownerId: "ada",
        sliceId: wants!,
        amount: "225",
        note: "Shoes",
      });

      return { app, clock, needs: needs!, wants: wants!, shoes };
    }

    it("puts a bite back for good", async () => {
      const { app, shoes } = await withShoes();

      await app.putBackBite({ ownerId: "ada", biteId: shoes.id });

      expect((await app.servePie("ada"))?.bites).toEqual([]);
    });

    it("moves a bite and keeps its amount, note and day", async () => {
      const { app, needs, shoes } = await withShoes();

      const moved = await app.moveBite({ ownerId: "ada", biteId: shoes.id, sliceId: needs });

      expect(moved).toEqual({ ...shoes, sliceId: needs });
      expect((await app.servePie("ada"))?.bites).toEqual([moved]);
    });

    it("refuses a bite from a past month", async () => {
      const { app, clock, needs, shoes } = await withShoes();

      clock.now = new Date(Date.UTC(2026, 10, 2));

      await expect(app.putBackBite({ ownerId: "ada", biteId: shoes.id })).rejects.toThrow(
        "That bite is not in this month's pie.",
      );
      await expect(
        app.moveBite({ ownerId: "ada", biteId: shoes.id, sliceId: needs }),
      ).rejects.toThrow(PieError);
      expect((await app.servePie("ada", Month.of(shoes.eatenAt)))?.bites).toHaveLength(1);
    });
  });

  describe("re-slicing", () => {
    async function baked() {
      const { app } = kitchen();
      const pie = await app.bakePie({ ownerId: "ada", monthlyIncome: "3000", currency: "EUR" });
      const [needs, wants, savings] = pie.slices.map((slice) => slice.id);

      return { app, needs: needs!, wants: wants!, savings: savings! };
    }

    it("changes income and shares in place, keeping the bites", async () => {
      const { app, needs, wants, savings } = await baked();

      await app.takeBite({ ownerId: "ada", sliceId: wants, amount: "300", note: "Shoes" });
      await app.reslicePie({
        ownerId: "ada",
        monthlyIncome: "4000",
        slices: [
          { id: needs, name: "Needs", percent: 50 },
          { id: wants, name: " Fun ", percent: 25 },
          { id: savings, name: "Savings", percent: 25 },
        ],
      });

      const pie = await app.servePie("ada");

      expect(pie?.income.toDecimal()).toBe("4000.00");
      expect(pie?.slices.map((slice) => [slice.name, slice.share.ratio])).toEqual([
        ["Needs", 0.5],
        ["Fun", 0.25],
        ["Savings", 0.25],
      ]);
      expect(pie?.bites.map((bite) => bite.note)).toEqual(["Shoes"]);
    });

    it("adds new slices and retires the ones left out", async () => {
      const { app, needs, wants } = await baked();

      await app.takeBite({ ownerId: "ada", sliceId: wants, amount: "30", note: "Tea" });
      await app.reslicePie({
        ownerId: "ada",
        slices: [
          { id: needs, name: "Needs", percent: 60 },
          { name: "Travel", percent: 40 },
        ],
      });

      const pie = await app.servePie("ada");

      expect(pie?.slices.map((slice) => [slice.name, Boolean(slice.retired)])).toEqual([
        ["Needs", false],
        ["Travel", false],
        ["Wants", true],
        ["Savings", true],
      ]);
      expect(pie?.servings().map((serving) => serving.slice.name)).toEqual([
        "Needs",
        "Travel",
        "Wants",
      ]);
    });

    it("refuses shares off the 5% steps and unknown slices", async () => {
      const { app, needs } = await baked();

      await expect(
        app.reslicePie({ ownerId: "ada", slices: [{ id: needs, name: "Needs", percent: 99 }] }),
      ).rejects.toThrow("Shares go in steps of 5%.");
      await expect(
        app.reslicePie({ ownerId: "ada", slices: [{ id: "nope", name: "Needs", percent: 100 }] }),
      ).rejects.toThrow(PieError);
    });

    it("previews without saving", async () => {
      const { app, needs, wants } = await baked();

      await app.takeBite({ ownerId: "ada", sliceId: wants, amount: "300", note: "Shoes" });

      const servings = await app.previewReslice({
        ownerId: "ada",
        slices: [
          { id: needs, name: "Needs", percent: 90 },
          { id: wants, name: "Wants", percent: 10 },
        ],
      });

      expect(servings.map((serving) => serving.left.ratio)).toEqual([1, 0]);
      expect((await app.servePie("ada"))?.slices).toHaveLength(3);
    });
  });

  describe("staples", () => {
    async function stocked() {
      const { app, clock } = kitchen();
      const pie = await app.bakePie({ ownerId: "ada", monthlyIncome: "3000", currency: "EUR" });
      const needs = pie.slices[0]!.id;

      const rent = await app.stockStaple({
        ownerId: "ada",
        sliceId: needs,
        amount: "750",
        note: " Rent ",
      });

      return { app, clock, needs, rent };
    }

    it("count from the month they are stocked in, and every month after", async () => {
      const { app, clock, rent } = await stocked();

      expect(rent.note).toBe("Rent");
      expect((await app.servePie("ada"))?.servings()[0]?.stapled.ratio).toBe(0.5);

      clock.now = new Date(Date.UTC(2026, 10, 2));
      expect((await app.servePie("ada"))?.staples.map((staple) => staple.id)).toEqual([rent.id]);
      expect(
        (await app.servePie("ada", Month.of(new Date(Date.UTC(2026, 8, 1)))))?.staples,
      ).toHaveLength(0);
    });

    it("dropped later, still count that month but not the next", async () => {
      const { app, clock, rent } = await stocked();

      clock.now = new Date(Date.UTC(2026, 10, 2));
      const dropped = await app.dropStaple({ ownerId: "ada", stapleId: rent.id });

      expect(dropped.until?.toString()).toBe("2026-12");
      expect((await app.servePie("ada"))?.staples).toHaveLength(1);

      clock.now = new Date(Date.UTC(2026, 11, 2));
      expect((await app.servePie("ada"))?.staples).toHaveLength(0);
    });

    it("dropped in the month they were stocked, never counted", async () => {
      const { app, rent } = await stocked();

      await app.dropStaple({ ownerId: "ada", stapleId: rent.id });

      expect((await app.servePie("ada"))?.staples).toHaveLength(0);
      expect((await app.servePie("ada"))?.leftover().ratio).toBe(1);
    });

    it("change amount without touching past months", async () => {
      const { app, clock, needs, rent } = await stocked();

      clock.now = new Date(Date.UTC(2026, 10, 2));
      await app.stockStaple({
        ownerId: "ada",
        sliceId: needs,
        amount: "900",
        note: "Rent",
        replaces: rent.id,
      });

      const amounts = async (month: Month) =>
        (await app.servePie("ada", month))?.staples.map((staple) => staple.amount.toDecimal());

      expect(await amounts(Month.of(new Date(Date.UTC(2026, 9, 1))))).toEqual(["750.00"]);
      expect(await amounts(Month.of(clock.now))).toEqual(["900.00"]);
    });

    it("refuses one of nothing", async () => {
      const { app, needs } = await stocked();

      await expect(
        app.stockStaple({ ownerId: "ada", sliceId: needs, amount: "0", note: "" }),
      ).rejects.toThrow(PieError);
    });
  });

  describe("shelf", () => {
    it("lists past months newest first, back to the month the pie was baked in", async () => {
      const { app, clock } = kitchen(new Date(Date.UTC(2026, 6, 20)));
      const pie = await app.bakePie({ ownerId: "ada", monthlyIncome: "3000", currency: "EUR" });

      await app.takeBite({ ownerId: "ada", sliceId: pie.slices[1]!.id, amount: "90", note: "" });
      clock.now = new Date(Date.UTC(2026, 9, 10));

      const shelf = await app.shelvePie({ ownerId: "ada", months: 12 });

      expect(shelf.map(({ month }) => month.toString())).toEqual(["2026-09", "2026-08", "2026-07"]);
      expect(shelf.map(({ pie: past }) => past.bites.length)).toEqual([0, 0, 1]);
    });

    it("holds at most the months asked for", async () => {
      const { app, clock } = kitchen(new Date(Date.UTC(2024, 0, 1)));

      await app.bakePie({ ownerId: "ada", monthlyIncome: "3000", currency: "EUR" });
      clock.now = new Date(Date.UTC(2026, 9, 10));

      expect(await app.shelvePie({ ownerId: "ada", months: 12 })).toHaveLength(12);
    });

    it("is empty without a pie or in the month it was baked", async () => {
      const { app } = kitchen();

      expect(await app.shelvePie({ ownerId: "ada", months: 12 })).toEqual([]);
      await app.bakePie({ ownerId: "ada", monthlyIncome: "3000", currency: "EUR" });
      expect(await app.shelvePie({ ownerId: "ada", months: 12 })).toEqual([]);
    });
  });

  describe("appetite", () => {
    it("reads each slice's habit from the three months before this one", async () => {
      const { app, clock } = kitchen(new Date(Date.UTC(2026, 6, 1)));
      const pie = await app.bakePie({ ownerId: "ada", monthlyIncome: "1000", currency: "EUR" });
      const [needs, wants] = pie.slices.map((slice) => slice.id);

      const eatIn = async (month: number, wantsEaten: string) => {
        clock.now = new Date(Date.UTC(2026, month, 3));
        await app.takeBite({ ownerId: "ada", sliceId: needs!, amount: "100", note: "" });
        await app.takeBite({ ownerId: "ada", sliceId: wants!, amount: wantsEaten, note: "" });
      };

      await eatIn(6, "330");
      await eatIn(7, "300");
      await eatIn(8, "400");

      clock.now = new Date(Date.UTC(2026, 8, 20));
      expect(await app.readAppetite({ ownerId: "ada" })).toEqual([]);

      clock.now = new Date(Date.UTC(2026, 9, 2));
      const appetite = await app.readAppetite({ ownerId: "ada" });

      expect(appetite.map(({ slice, appetite: usual }) => [slice.name, usual.streak])).toEqual([
        ["Needs", "leftover"],
        ["Wants", "overflowing"],
        ["Savings", "leftover"],
      ]);
      expect(appetite[0]?.appetite.usual.ratio).toBe(0.2);
    });
  });
});
