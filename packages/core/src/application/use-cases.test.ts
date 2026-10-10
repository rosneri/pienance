import { describe, expect, it } from "vitest";
import { InMemoryPieRepository } from "../adapters/in-memory-pie-repository";
import { PieError } from "../domain";
import { pienance } from ".";

function kitchen(now = new Date(Date.UTC(2026, 9, 10))) {
  let id = 0;
  const clock = { now };

  const app = pienance({
    pies: new InMemoryPieRepository(),
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
});
