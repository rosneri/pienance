import { InMemoryPieRepository, noAdvice, pienance, type PieRepository } from "@pienance/core";
import { describe, expect, it } from "vitest";
import type { ProductEvent } from "@pienance/telemetry/contract";
import { pieActions } from "./pie-actions";

function kitchen(pies: PieRepository = new InMemoryPieRepository()) {
  let id = 0;

  const app = pienance({
    pies,
    advisor: noAdvice,
    newId: () => `id-${++id}`,
    now: () => new Date(Date.UTC(2026, 9, 10)),
  });

  const refreshes: string[] = [];
  const tracked: Array<{ event: ProductEvent; ownerId: string }> = [];

  const as = (owner: string | null) =>
    pieActions({
      app,
      owner: async () => owner,
      refresh: () => refreshes.push("refresh"),
      track: (event, ownerId) => tracked.push({ event, ownerId }),
    });

  return { as, refreshes, tracked };
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
      { name: "statement.read", properties: { bites: 2 } },
      { name: "bites.taken", properties: { taken: 2, duplicates: 0 } },
      { name: "bites.taken", properties: { taken: 0, duplicates: 2 } },
    ]);
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
      error: "That file is too big: export a few months at a time",
    });
    expect(await as(null).readStatement({ csv: "" })).toEqual({
      ok: false,
      error: "Sign in first.",
    });
  });
});
