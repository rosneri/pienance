import { describe, expect, it } from "vitest";
import { InMemoryPieRepository } from "../adapters/in-memory-pie-repository";
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
    expect(await kitchen().app.servePie()).toBeNull();
  });

  it("bakes a 50/30/20 pie", async () => {
    const { app } = kitchen();
    await app.bakePie({ monthlyIncome: 3000 });
    const pie = await app.servePie();
    expect(pie?.slices.map((slice) => [slice.name, slice.share.ratio])).toEqual([
      ["Needs", 0.5],
      ["Wants", 0.3],
      ["Savings", 0.2],
    ]);
  });

  it("weighs, then takes a bite", async () => {
    const { app } = kitchen();
    const pie = await app.bakePie({ monthlyIncome: 3000 });
    const wants = pie.slices[1]!.id;

    const weighing = await app.weighBite({ sliceId: wants, amount: 225 });
    expect(weighing.ofSlice.ratio).toBe(0.25);
    expect((await app.servePie())?.bites).toHaveLength(0);

    await app.takeBite({ sliceId: wants, amount: 225, note: " Shoes " });
    const served = await app.servePie();
    expect(served?.bites.map((bite) => bite.note)).toEqual(["Shoes"]);
    expect(served?.leftover().ratio).toBe(0.925);
  });

  it("starts every month with a fresh pie", async () => {
    const { app, clock } = kitchen();
    const pie = await app.bakePie({ monthlyIncome: 3000 });
    await app.takeBite({ sliceId: pie.slices[0]!.id, amount: 100, note: "" });

    clock.now = new Date(Date.UTC(2026, 10, 1));
    expect((await app.servePie())?.bites).toHaveLength(0);
  });
});
