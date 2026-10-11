import type { Slice } from "@pienance/core";
import { Proportion } from "@pienance/core";
import { Experimental_DecisionMockModelV4 as MockDecisionModel } from "ai/test";
import { describe, expect, it } from "vitest";
import { decisionAdvisor } from "./decision-advisor";

type CallOptions = Parameters<MockDecisionModel["doDecide"]>[0];

type Answers = Record<
  string,
  | { type: "choice"; choice: string; probabilities?: Record<string, number> }
  | { type: "boolean"; probability: number }
>;

/** A decision model answering from a function of the questions it is asked. */
function model(answer: (options: CallOptions) => Answers) {
  const calls: CallOptions[] = [];

  const mock = new MockDecisionModel({
    supportedQuestionTypes: ["choice", "score", "boolean"],
    doDecide: async (options) => {
      calls.push(options);

      return { answers: answer(options), warnings: [] };
    },
  });

  return { mock, calls };
}

const slices: Slice[] = [
  { id: "needs", name: "Needs", share: Proportion.of(0.5) },
  { id: "wants", name: "Wants", share: Proportion.of(0.3) },
  { id: "savings", name: "Savings", share: Proportion.of(0.2) },
];

const rows = [
  ["Statement for Ada"],
  ["Date", "Payee", "Amount", "Balance"],
  ["03/10/2026", "Cinema", "-12.00", "88.00"],
];

describe("decisionAdvisor", () => {
  it("reads a layout from the model's choices", async () => {
    const { mock, calls } = model(() => ({
      isTransactions: { type: "boolean", probability: 0.97 },
      column0: { type: "choice", choice: "date" },
      column1: { type: "choice", choice: "description" },
      column2: { type: "choice", choice: "amount" },
      column3: { type: "choice", choice: "ignore" },
      skipRows: { type: "choice", choice: "2" },
      dates: { type: "choice", choice: "mdy" },
      decimal: { type: "choice", choice: "." },
      spending: { type: "choice", choice: "negative" },
    }));

    expect(await decisionAdvisor(mock).layoutOf(rows, null)).toEqual({
      skipRows: 2,
      columns: ["date", "description", "amount", "ignore"],
      dates: "mdy",
      decimal: ".",
      spending: "negative",
    });
    expect(Object.keys(calls[0]?.questions ?? {})).toContain("column3");
    expect(calls[0]?.state).toContainEqual({ type: "json", value: { rows } });
  });

  it("leaves unlikely choices out", async () => {
    const { mock } = model(() => ({
      isTransactions: { type: "boolean", probability: 0.9 },
      column0: { type: "choice", choice: "date" },
      column1: {
        type: "choice",
        choice: "amount",
        probabilities: {
          date: 0,
          amount: 0.4,
          debit: 0,
          credit: 0,
          description: 0.25,
          ignore: 0.35,
        },
      },
      column2: { type: "choice", choice: "amount" },
      column3: { type: "choice", choice: "credit" },
      skipRows: { type: "choice", choice: "2" },
      dates: { type: "choice", choice: "dmy" },
      decimal: { type: "choice", choice: "," },
      spending: { type: "choice", choice: "positive" },
    }));

    expect((await decisionAdvisor(mock).layoutOf(rows, null))?.columns).toEqual([
      "date",
      "ignore",
      "amount",
      "credit",
    ]);
  });

  it("says there is no layout when the model sees no transactions", async () => {
    const { mock } = model(() => ({ isTransactions: { type: "boolean", probability: 0.1 } }));

    expect(await decisionAdvisor(mock).layoutOf(rows, null)).toBeNull();
  });

  it("falls back to the guess when the model fails", async () => {
    const failing = new MockDecisionModel({
      supportedQuestionTypes: ["choice", "boolean"],
      doDecide: async () => {
        throw new Error("gateway is down");
      },
    });

    const guess = {
      skipRows: 2,
      columns: ["date", "description", "amount", "ignore"],
      dates: "dmy",
      decimal: ".",
      spending: "negative",
    } as const;

    const advisor = decisionAdvisor(failing);

    expect(await advisor.layoutOf(rows, guess)).toBe(guess);
    expect(await advisor.slicesFor(["Rent"], slices)).toEqual([null]);
  });

  it("suggests a slice for each note, by name", async () => {
    const { mock, calls } = model(({ questions }) =>
      Object.fromEntries(
        Object.keys(questions).map((id, index) => [
          id,
          index === 2
            ? {
                type: "choice",
                choice: "Savings",
                probabilities: { Needs: 0.3, Wants: 0.3, Savings: 0.4 },
              }
            : { type: "choice", choice: index === 0 ? "Needs" : "Wants" },
        ]),
      ),
    );

    expect(await decisionAdvisor(mock).slicesFor(["Rent", "Cinema", "???"], slices)).toEqual([
      "needs",
      "wants",
      null,
    ]);
    expect(calls[0]?.questions.note0).toMatchObject({
      type: "choice",
      instructions: 'Which slice does "Rent" eat from?',
      criteria: { Needs: expect.stringContaining("rent"), Wants: expect.any(String) },
    });
  });

  it("asks about many notes in batches", async () => {
    const { mock, calls } = model(({ questions }) =>
      Object.fromEntries(
        Object.keys(questions).map((id) => [id, { type: "choice", choice: "Wants" }]),
      ),
    );

    const notes = Array.from({ length: 250 }, (_, index) => `Shop ${index}`);
    const suggested = await decisionAdvisor(mock).slicesFor(notes, slices);

    expect(calls.map((call) => Object.keys(call.questions).length)).toEqual([40, 40, 40, 40, 40]);
    expect(suggested.slice(0, 200).every((id) => id === "wants")).toBe(true);
    expect(suggested.slice(200).every((id) => id === null)).toBe(true);
    expect(suggested).toHaveLength(250);
  });
});
