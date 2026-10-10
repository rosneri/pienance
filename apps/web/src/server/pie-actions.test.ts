import { InMemoryPieRepository, pienance, type PieRepository } from "@pienance/core";
import { describe, expect, it } from "vitest";
import { pieActions } from "./pie-actions";

function kitchen(pies: PieRepository = new InMemoryPieRepository()) {
  let id = 0;

  const app = pienance({
    pies,
    newId: () => `id-${++id}`,
    now: () => new Date(Date.UTC(2026, 9, 10)),
  });

  const refreshes: string[] = [];

  const as = (owner: string | null) =>
    pieActions({ app, owner: async () => owner, refresh: () => refreshes.push("refresh") });

  return { as, refreshes };
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
    expect((await ada.readPie())?.bites.map((bite) => [bite.note, bite.portionWords])).toEqual([
      ["Groceries", "about a tenth"],
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
});
