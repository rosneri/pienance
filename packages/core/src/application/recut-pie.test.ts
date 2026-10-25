import { describe, expect, it } from "vitest";
import { InMemoryPieRepository } from "../adapters/in-memory-pie-repository";
import { noAdvice } from "../adapters/no-advice";
import { Month, PieError } from "../domain";
import { pienance } from ".";

async function kitchen() {
  let id = 0;
  const clock = { now: new Date(Date.UTC(2026, 8, 10)) };

  const app = pienance({
    pies: new InMemoryPieRepository(),
    advisor: noAdvice,
    newId: () => `id-${++id}`,
    now: () => clock.now,
  });

  const pie = await app.bakePie({ ownerId: "ada", monthlyIncome: "3000", currency: "EUR" });
  const [needs = "", wants = "", savings = ""] = pie.slices.map((slice) => slice.id);

  return { app, clock, needs, wants, savings };
}

describe("recutting a pie", () => {
  it("renames, resizes and adds slices, keeping what was eaten", async () => {
    const { app, needs, wants, savings } = await kitchen();

    await app.takeBite({ ownerId: "ada", sliceId: wants, amount: "90", note: "Dinner" });

    const pie = await app.recutPie({
      ownerId: "ada",
      slices: [
        { id: needs, name: "Home", percent: "50" },
        { id: wants, name: "Fun", percent: "20" },
        { id: savings, name: "Savings", percent: "20" },
        { name: " Travel ", percent: "10%" },
      ],
    });

    expect(pie.slices.map((slice) => [slice.name, slice.share.ratio])).toEqual([
      ["Home", 0.5],
      ["Fun", 0.2],
      ["Savings", 0.2],
      ["Travel", 0.1],
    ]);

    const served = await app.servePie("ada");

    expect(served?.slices.map((slice) => slice.name)).toEqual(["Home", "Fun", "Savings", "Travel"]);
    expect(served?.bites.map((bite) => [bite.sliceId, bite.note])).toEqual([[wants, "Dinner"]]);
  });

  it("removes a slice with everything eaten from it, in every month", async () => {
    const { app, clock, needs, wants, savings } = await kitchen();

    await app.takeBite({ ownerId: "ada", sliceId: wants, amount: "90", note: "Dinner" });
    await app.stockStaple({ ownerId: "ada", sliceId: wants, amount: "10", note: "Music" });
    clock.now = new Date(Date.UTC(2026, 9, 10));
    await app.takeBite({ ownerId: "ada", sliceId: needs, amount: "50", note: "Bus" });

    await app.recutPie({
      ownerId: "ada",
      slices: [
        { id: needs, name: "Needs", percent: "70" },
        { id: savings, name: "Savings", percent: "30" },
      ],
    });

    const september = await app.servePie("ada", Month.of(new Date(Date.UTC(2026, 8, 1))));
    const october = await app.servePie("ada");

    expect(september?.bites).toEqual([]);
    expect(september?.staples).toEqual([]);
    expect(october?.bites.map((bite) => bite.note)).toEqual(["Bus"]);
  });

  it("refuses slices that do not add up, lack a name or repeat one", async () => {
    const { app, needs } = await kitchen();

    const recut = (slices: { id?: string; name: string; percent: string }[]) =>
      app.recutPie({ ownerId: "ada", slices });

    await expect(recut([{ id: needs, name: "Needs", percent: "90" }])).rejects.toThrow(
      "Slices must add up to 100%, got 90%",
    );
    await expect(recut([{ name: " ", percent: "100" }])).rejects.toThrow("Each slice needs a name");
    await expect(
      recut([
        { name: "Fun", percent: "50" },
        { name: "fun", percent: "50" },
      ]),
    ).rejects.toThrow("Each slice needs its own name");
    await expect(recut([{ name: "All", percent: "100.5" }])).rejects.toThrow(RangeError);
    await expect(recut([{ id: "other", name: "All", percent: "100" }])).rejects.toThrow(PieError);
    await expect(recut([])).rejects.toThrow("Slices must add up to 100%, got 0%");
  });

  it("needs a pie first", async () => {
    const app = pienance({
      pies: new InMemoryPieRepository(),
      advisor: noAdvice,
      newId: () => "id",
      now: () => new Date(),
    });

    await expect(
      app.recutPie({ ownerId: "ada", slices: [{ name: "All", percent: "100" }] }),
    ).rejects.toThrow("Bake a pie first");
  });
});

describe("resetting a pie", () => {
  it("removes the pie and everything eaten from it", async () => {
    const { app, needs } = await kitchen();

    await app.takeBite({ ownerId: "ada", sliceId: needs, amount: "50", note: "Bus" });
    await app.resetPie("ada");

    expect(await app.servePie("ada")).toBeNull();

    const again = await app.bakePie({ ownerId: "ada", monthlyIncome: "1000", currency: "EUR" });

    expect(again.bites).toEqual([]);
  });
});
