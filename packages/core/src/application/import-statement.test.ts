import { describe, expect, it } from "vitest";
import { InMemoryPieRepository } from "../adapters/in-memory-pie-repository";
import { noAdvice } from "../adapters/no-advice";
import { PieError, type StatementLayout } from "../domain";
import type { Advisor, Rows } from "./ports";
import { pienance } from ".";

const statement: Rows = [
  ["Date", "Description", "Amount", "Balance"],
  ["30/09/2026", "Salary", "3000.00", "3100.00"],
  ["30/09/2026", "Corner shop", "-12.40", "3087.60"],
  ["14/10/2026", "Rent", "-900.00", "2187.60"],
  ["15/10/2026", "Coffee", "-3.00", "2184.60"],
  ["15/10/2026", "Coffee", "-3.00", "2181.60"],
];

async function kitchen(advisor: Advisor = noAdvice) {
  let id = 0;

  const app = pienance({
    pies: new InMemoryPieRepository(),
    advisor,
    newId: () => `id-${++id}`,
    now: () => new Date(Date.UTC(2026, 9, 20)),
  });

  const pie = await app.bakePie({ ownerId: "ada", monthlyIncome: "3000", currency: "EUR" });
  const [needs, wants] = pie.slices.map((slice) => slice.id);

  return { app, needs: needs ?? "", wants: wants ?? "" };
}

describe("reading a statement", () => {
  it("drafts a bite for each spend, in the first slice unless advised", async () => {
    const { app, needs } = await kitchen();
    const preview = await app.readStatement({ ownerId: "ada", rows: statement });

    expect(preview.header).toEqual(["Date", "Description", "Amount", "Balance"]);
    expect(preview.incoming).toBe(1);
    expect(preview.bites).toEqual([
      { eatenOn: "2026-09-30", amount: "12.40", note: "Corner shop", sliceId: needs },
      { eatenOn: "2026-10-14", amount: "900.00", note: "Rent", sliceId: needs },
      { eatenOn: "2026-10-15", amount: "3.00", note: "Coffee", sliceId: needs },
      { eatenOn: "2026-10-15", amount: "3.00", note: "Coffee", sliceId: needs },
    ]);
  });

  it("asks the advisor once per note for slices, ignoring slices that do not exist", async () => {
    const asked: string[][] = [];

    const { app, needs, wants } = await kitchen({
      ...noAdvice,
      slicesFor: async (notes) => {
        asked.push([...notes]);

        return notes.map((note) => (note === "Coffee" ? wants : "no-such-slice"));
      },
    });

    const preview = await app.readStatement({ ownerId: "ada", rows: statement });

    expect(asked).toEqual([["Corner shop", "Rent", "Coffee"]]);
    expect(preview.bites.map((bite) => bite.sliceId)).toEqual([needs, needs, wants, wants]);
  });

  it("asks the advisor for the layout only when the rules are unsure", async () => {
    const corrected: StatementLayout = {
      skipRows: 1,
      columns: ["date", "description", "amount"],
      dates: "mdy",
      decimal: ".",
      spending: "negative",
    };

    const guesses: Array<StatementLayout | null> = [];

    const { app } = await kitchen({
      ...noAdvice,
      layoutOf: async (_rows, guess) => {
        guesses.push(guess);

        return corrected;
      },
    });

    await app.readStatement({ ownerId: "ada", rows: statement });
    expect(guesses).toEqual([]);

    const ambiguous = [
      ["Date", "Payee", "Amount"],
      ["03/10/2026", "Cinema", "-12.00"],
    ];

    const preview = await app.readStatement({ ownerId: "ada", rows: ambiguous });

    expect(guesses.map((guess) => guess?.dates)).toEqual(["dmy"]);
    expect(preview.bites.map((bite) => bite.eatenOn)).toEqual(["2026-03-10"]);
  });

  it("reads with the person's own layout when given", async () => {
    const { app } = await kitchen();

    const preview = await app.readStatement({
      ownerId: "ada",
      rows: statement,
      layout: {
        skipRows: 1,
        columns: ["date", "ignore", "amount", "ignore"],
        dates: "dmy",
        decimal: ".",
        spending: "negative",
      },
    });

    expect(preview.bites.map((bite) => bite.note)).toEqual(["", "", "", ""]);
  });

  it("refuses a file that is not a list of transactions", async () => {
    const { app } = await kitchen();

    const contacts = [
      ["Name", "Email"],
      ["Ada", "ada@example.com"],
    ];

    await expect(app.readStatement({ ownerId: "ada", rows: contacts })).rejects.toThrow(
      new PieError("This file does not look like a list of transactions"),
    );
  });

  it("trusts the advisor when it says there are no transactions", async () => {
    const { app } = await kitchen({ ...noAdvice, layoutOf: async () => null });
    const unsure = [["03/10/2026", "Cinema", "-12.00", "88.00"]];

    await expect(app.readStatement({ ownerId: "ada", rows: unsure })).rejects.toThrow(PieError);
  });

  it("needs a pie first", async () => {
    const app = pienance({
      pies: new InMemoryPieRepository(),
      advisor: noAdvice,
      newId: () => "id",
      now: () => new Date(),
    });

    await expect(app.readStatement({ ownerId: "ada", rows: statement })).rejects.toThrow(
      "Bake a pie first",
    );
  });
});

describe("taking many bites", () => {
  it("takes each bite in its own month", async () => {
    const { app, needs } = await kitchen();
    const preview = await app.readStatement({ ownerId: "ada", rows: statement });

    expect(await app.takeBites({ ownerId: "ada", bites: preview.bites })).toEqual({
      taken: 4,
      duplicates: 0,
    });

    const october = await app.servePie("ada");
    expect(
      october?.bites.map((bite) => [bite.note, bite.amount.toDecimal(), bite.sliceId]),
    ).toEqual([
      ["Rent", "900.00", needs],
      ["Coffee", "3.00", needs],
      ["Coffee", "3.00", needs],
    ]);
  });

  it("skips bites already taken, so a statement can be imported twice", async () => {
    const { app } = await kitchen();
    const preview = await app.readStatement({ ownerId: "ada", rows: statement });

    await app.takeBites({ ownerId: "ada", bites: preview.bites.slice(0, 3) });

    expect(await app.takeBites({ ownerId: "ada", bites: preview.bites })).toEqual({
      taken: 1,
      duplicates: 3,
    });
    expect((await app.servePie("ada"))?.bites).toHaveLength(3);
  });

  it("refuses a day or slice that does not exist", async () => {
    const { app, needs } = await kitchen();
    const bite = { eatenOn: "2026-10-01", amount: "1", note: "", sliceId: needs };

    await expect(
      app.takeBites({ ownerId: "ada", bites: [{ ...bite, eatenOn: "2026-02-30" }] }),
    ).rejects.toThrow(RangeError);
    await expect(
      app.takeBites({ ownerId: "ada", bites: [{ ...bite, sliceId: "nope" }] }),
    ).rejects.toThrow(PieError);
  });
});
