import { describe, expect, it } from "vitest";
import { Month } from "@/domain";
import { InMemoryPieRepository } from "@/infrastructure/in-memory-pie-repository";
import { bakePie, servePie, takeBite, weighBite } from ".";

function setup() {
  const pies = new InMemoryPieRepository();
  return {
    bakePie: bakePie(pies),
    servePie: servePie(pies),
    weighBite: weighBite(pies),
    takeBite: takeBite(pies),
  };
}

describe("use cases", () => {
  it("has no pie until one is baked", async () => {
    expect(await setup().servePie()).toBeNull();
  });

  it("bakes a 50/30/20 pie", async () => {
    const app = setup();
    await app.bakePie({ monthlyIncome: 3000 });
    const pie = await app.servePie();
    expect(pie?.slices.map((slice) => [slice.name, slice.share.ratio])).toEqual([
      ["Needs", 0.5],
      ["Wants", 0.3],
      ["Savings", 0.2],
    ]);
  });

  it("weighs, then takes a bite", async () => {
    const app = setup();
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

  it("only serves the bites of the asked month", async () => {
    const app = setup();
    const pie = await app.bakePie({ monthlyIncome: 3000 });
    await app.takeBite({ sliceId: pie.slices[0]!.id, amount: 100, note: "" });
    expect((await app.servePie(Month.of(new Date(Date.UTC(2000, 0, 1)))))?.bites).toHaveLength(0);
  });
});
