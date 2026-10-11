import {
  columnRoles,
  dateOrders,
  type Advisor,
  type ColumnRole,
  type Rows,
  type Slice,
  type StatementLayout,
} from "@pienance/core";
import {
  experimental_decide as decide,
  type Experimental_DecisionModel,
  type Experimental_DecisionQuestion,
} from "ai";

/**
 * The decision model behind statement imports, resolved through the Vercel AI Gateway
 * (AI_GATEWAY_API_KEY locally, the deployment's OIDC token on Vercel).
 *
 * TODO: replace with Cloudflare's Clef once the Vercel AI Gateway serves it; Jev stands in until then.
 */
export const statementModel = "typesafe-ai/jev";

type Questions = Record<string, Experimental_DecisionQuestion>;

type Answer = Awaited<ReturnType<typeof decide<Questions>>>["answers"][string];

/** Rows shown to the model: enough to see the layout, few enough to share little. */
const sampleRows = 8;

const mostColumns = 20;

const skipOptions = Array.from({ length: sampleRows }, (_, index) => `${index}`);

const mostNotes = 200;

const notesPerCall = 40;

/** Below this probability a choice is left to the person. */
const likely = 0.5;

const roleMeanings: Record<ColumnRole, string> = {
  date: "The day of the transaction (the booking day, when there are several dates).",
  amount: "One signed amount per transaction, for money both going out and coming in.",
  debit: "Only money going out of the account; empty on rows of money coming in.",
  credit: "Only money coming into the account; empty on rows of money going out.",
  description: "Text saying what the transaction was: payee, merchant, memo or reference.",
  ignore: "Anything else: balances, ids, categories, currencies, other dates.",
};

/** Hints for the slices every pie starts with; other slices go by their name alone. */
const sliceMeanings = new Map([
  ["needs", "Essentials: rent, groceries, utilities, transport, insurance, health, childcare."],
  ["wants", "Nice to have: eating out, entertainment, shopping, hobbies, travel, subscriptions."],
  ["savings", "Money put aside: transfers to savings, investments, paying debt off early."],
]);

function choiceIn<T extends string>(answer: Answer | undefined, options: readonly T[]): T | null {
  if (answer?.type !== "choice") return null;

  const probability = answer.probabilities?.[answer.choice] ?? 1;

  return probability < likely ? null : (options.find((option) => option === answer.choice) ?? null);
}

function layoutQuestions(width: number) {
  const columns = Object.fromEntries(
    Array.from({ length: width }, (_, index): [string, Experimental_DecisionQuestion] => [
      `column${index}`,
      {
        type: "choice",
        instructions: `What does column ${index + 1} (value number ${index + 1} of each row) hold?`,
        criteria: roleMeanings,
      },
    ]),
  );

  return {
    ...columns,
    isTransactions: {
      type: "boolean",
      instructions:
        "Is this a bank or card statement: one transaction per row, each with a day and an amount of money?",
    },
    skipRows: {
      type: "choice",
      instructions:
        "How many rows come before the first transaction (titles, account details, column names)?",
      criteria: Object.fromEntries(skipOptions.map((option) => [option, null])),
    },
    dates: {
      type: "choice",
      instructions: "How are the days written?",
      criteria: { ymd: "Year, month, day", dmy: "Day, month, year", mdy: "Month, day, year" },
    },
    decimal: {
      type: "choice",
      instructions: "Which character comes before the cents in the amounts?",
      criteria: { ".": "A point, as in 1,234.56", ",": "A comma, as in 1.234,56" },
    },
    spending: {
      type: "choice",
      instructions:
        "In a single amount column, how is money going out written? (Answer negative when there is none.)",
      criteria: { negative: "With a minus sign", positive: "Without a sign; income has one" },
    },
  } satisfies Questions;
}

function columnsFrom(answers: Readonly<Record<string, Answer>>, width: number): ColumnRole[] {
  return Array.from(
    { length: width },
    (_, index) => choiceIn(answers[`column${index}`], columnRoles) ?? "ignore",
  );
}

async function layoutOf(
  model: Experimental_DecisionModel,
  rows: Rows,
): Promise<StatementLayout | null> {
  const sample = rows.slice(0, sampleRows);
  const width = Math.min(mostColumns, Math.max(0, ...sample.map((row) => row.length)));

  const { answers } = await decide({
    model,
    state: [
      { type: "text", text: "The first rows of a CSV file a person exported from their bank." },
      { type: "json", value: { rows: sample.map((row) => [...row]) } },
    ],
    questions: layoutQuestions(width),
  });

  const isTransactions = answers.isTransactions;

  if (isTransactions?.type !== "boolean" || isTransactions.probability < likely) return null;

  return {
    skipRows: Number(choiceIn(answers.skipRows, skipOptions) ?? "0"),
    columns: columnsFrom(answers, width),
    dates: choiceIn(answers.dates, dateOrders) ?? "dmy",
    decimal: choiceIn(answers.decimal, [".", ","] as const) ?? ".",
    spending: choiceIn(answers.spending, ["negative", "positive"] as const) ?? "negative",
  };
}

async function slicesFor(
  model: Experimental_DecisionModel,
  notes: readonly string[],
  slices: readonly Slice[],
): Promise<(string | null)[]> {
  const criteria = Object.fromEntries(
    slices.map((slice) => [slice.name, sliceMeanings.get(slice.name.toLowerCase()) ?? null]),
  );

  const names = slices.map((slice) => slice.name);

  const { answers } = await decide({
    model,
    state:
      "Expenses from a person's bank statement, to sort into the slices of their monthly budget.",
    questions: Object.fromEntries(
      notes.map((note, index): [string, Experimental_DecisionQuestion] => [
        `note${index}`,
        { type: "choice", instructions: `Which slice does "${note}" eat from?`, criteria },
      ]),
    ),
  });

  return notes.map((_, index) => {
    const name = choiceIn(answers[`note${index}`], names);

    return slices.find((slice) => slice.name === name)?.id ?? null;
  });
}

function chunks<T>(items: readonly T[], size: number): T[][] {
  return Array.from({ length: Math.ceil(items.length / size) }, (_, index) =>
    items.slice(index * size, (index + 1) * size),
  );
}

/**
 * An Advisor backed by a decision model. A model outage never blocks an import:
 * on any failure it falls back to the rules' guess and to no suggested slices.
 */
export function decisionAdvisor(model: Experimental_DecisionModel = statementModel): Advisor {
  return {
    async layoutOf(rows, guess) {
      try {
        return await layoutOf(model, rows);
      } catch {
        return guess;
      }
    },

    async slicesFor(notes, slices) {
      const asked = notes.slice(0, mostNotes);

      try {
        const answers = await Promise.all(
          chunks(asked, notesPerCall).map((chunk) => slicesFor(model, chunk, slices)),
        );

        return [...answers.flat(), ...notes.slice(mostNotes).map(() => null)];
      } catch {
        return notes.map(() => null);
      }
    },
  };
}
