import type { PieView } from "@pienance/core";
import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { PieActions } from "@/server/pie-actions";
import { pastPieView, pieView } from "@/testing/fixtures";
import { PieTools } from "./pie-tools";

interface RegisteredTool {
  readonly name: string;
  readonly inputSchema?: {
    readonly properties?: Record<string, { readonly enum?: readonly string[] }>;
  };
  readonly annotations?: { readonly readOnlyHint?: boolean };
  execute(
    input: Record<string, string | number | readonly Record<string, string | number>[]>,
  ): Promise<string | object>;
}

let tools: Map<string, RegisteredTool>;

/** A stand-in for the browser's WebMCP model context. */
function stubModelContext() {
  tools = new Map();

  Object.defineProperty(document, "modelContext", {
    configurable: true,
    value: {
      async registerTool(registered: RegisteredTool, options?: { signal?: AbortSignal }) {
        tools.set(registered.name, registered);
        options?.signal?.addEventListener("abort", () => tools.delete(registered.name));
      },
    },
  });
}

function fakeActions(): PieActions & { calls: string[] } {
  const calls: string[] = [];

  return {
    calls,
    readPie: async (month) => (month === "2026-09" ? pastPieView : pieView),
    readShelf: async () => [
      {
        month: "2026-10",
        label: "Oct",
        name: "October",
        slices: [],
        leftoverWords: "about half",
        current: true,
      },
      {
        month: "2026-09",
        label: "Sep",
        name: "September",
        slices: [],
        leftoverWords: "about a tenth",
        current: false,
      },
    ],
    readAppetite: async () => [{ sentence: "You usually eat about three quarters of Needs." }],
    stockStaple: async (input) => {
      calls.push(`stock ${input.sliceId} ${input.amount} ${input.note}`);

      return { ok: true, value: { ...pieView.staples[0]!, note: input.note } };
    },
    dropStaple: async (input) => {
      calls.push(`drop ${input.stapleId}`);

      return { ok: true, value: { ...pieView.staples[0]!, endsAfter: "October" } };
    },
    bakePie: async (input) => {
      calls.push(`bake ${input.monthlyIncome} ${input.currency}`);

      return { ok: true, value: pieView };
    },
    weighBite: async (input) => {
      calls.push(`weigh ${input.sliceId} ${input.amount}`);

      return {
        ok: true,
        value: {
          sliceName: "Wants",
          portion: "1/5",
          ofSlice: "about a fifth",
          ofLeftover: "about a quarter",
          ofPie: "a sliver",
          leftAfter: "about half",
          stapled: "nothing",
          verdict: "fits",
        },
      };
    },
    takeBite: async (input) => {
      calls.push(`take ${input.sliceId} ${input.amount} ${input.note}`);

      return { ok: false, error: "Bake a pie first" };
    },
    readStatement: async (upload) => {
      calls.push(`read ${upload.csv}`);

      return {
        ok: true,
        value: {
          layout: {
            skipRows: 1,
            columns: ["date", "description", "amount"],
            dates: "ymd",
            decimal: ".",
            spending: "negative",
          },
          header: ["Date", "Description", "Amount"],
          bites: [{ eatenOn: "2026-10-02", amount: "4.20", note: "Bakery", sliceId: "needs" }],
          incoming: 1,
          unreadable: 0,
          trimmed: { kept: 2_000, total: 2_400 },
        },
      };
    },
    recutPie: async (input) => {
      calls.push(
        `recut ${input.slices.map((slice) => `${slice.id ?? "new"}:${slice.name}:${slice.percent}`).join(" ")}`,
      );

      return { ok: true, value: { ...pieView, slices: [{ ...pieView.slices[0]!, name: "Home" }] } };
    },
    resetPie: async () => {
      calls.push("reset");

      return { ok: true, value: null };
    },
    takeBites: async (input) => {
      calls.push(
        ...input.bites.map((bite) => `take ${bite.eatenOn} ${bite.sliceId} ${bite.amount}`),
      );

      return { ok: true, value: { taken: input.bites.length, duplicates: 0 } };
    },
  };
}

function tool(name: string): RegisteredTool {
  const found = tools.get(name);

  if (!found) throw new Error(`${name} is not registered`);

  return found;
}

beforeEach(stubModelContext);

afterEach(() => {
  Reflect.deleteProperty(document, "modelContext");
});

describe("PieTools (WebMCP)", () => {
  it("does nothing in a browser without WebMCP", () => {
    Reflect.deleteProperty(document, "modelContext");

    expect(() => render(<PieTools pie={null} actions={fakeActions()} />)).not.toThrow();
  });

  it("offers only bake_pie before there is a pie", async () => {
    const actions = fakeActions();

    render(<PieTools pie={null} actions={actions} />);

    expect([...tools.keys()]).toEqual(["bake_pie"]);
    expect(await tool("bake_pie").execute({ monthlyIncome: 2000, currency: "GBP" })).toBe(
      "About half of your pie is left.",
    );
    expect(actions.calls).toEqual(["bake 2000 GBP"]);
  });

  it("offers reading and weighing tools once there is a pie", async () => {
    const actions = fakeActions();
    const pie: PieView = pieView;

    render(<PieTools pie={pie} actions={actions} />);

    expect([...tools.keys()].toSorted()).toEqual([
      "drop_staple",
      "read_pie",
      "read_shelf",
      "read_statement",
      "recut_pie",
      "reset_pie",
      "stock_staple",
      "take_bite",
      "take_bites",
      "weigh_bite",
    ]);
    expect(tool("read_pie").annotations?.readOnlyHint).toBe(true);
    expect(tool("weigh_bite").inputSchema?.properties?.slice?.enum).toEqual([
      "Needs",
      "Wants",
      "Savings",
    ]);
    expect(await tool("weigh_bite").execute({ amount: 80, slice: "Wants" })).toBe(
      "Fits. It is about a fifth of your Wants slice and leaves about half of it.",
    );
    expect(await tool("take_bite").execute({ amount: 5, slice: "Needs", note: "Tea" })).toBe(
      "Bake a pie first",
    );
    expect(await tool("read_pie").execute({})).toEqual({
      summary: "About half of your pie is left.",
      pace: "Wants is going fast: about three quarters eaten, about a third of the month gone.",
      month: "October",
      currency: "EUR",
      slices: [
        "Needs: about a third left",
        "Wants: about a quarter left, going fast",
        "Savings: all left",
      ],
      staples: [
        { id: "rent", staple: "Rent: about half of Needs" },
        { id: "gym", staple: "Gym: a sliver of Wants, ends after October" },
      ],
      bites: ["Shoes: 3/4 of Wants", "Something: under 1/10 of Needs"],
    });
    expect(await tool("stock_staple").execute({ amount: 1000, slice: "Needs", note: "Rent" })).toBe(
      "Added. Rent takes about half of Needs every month.",
    );
    expect(await tool("drop_staple").execute({ stapleId: "rent" })).toBe(
      "Stopped. Rent ends after October.",
    );
    expect(actions.calls).toEqual([
      "weigh wants 80",
      "take needs 5 Tea",
      "stock needs 1000 Rent",
      "drop rent",
    ]);
  });

  it("reads a past month and the shelf", async () => {
    render(<PieTools pie={pieView} actions={fakeActions()} />);

    expect(await tool("read_pie").execute({ month: "2026-09" })).toMatchObject({
      summary: "About half of September's pie was left.",
      month: "September",
    });
    expect(await tool("read_pie").execute({ month: "2025-01" })).toBe(
      "That month is not on the shelf.",
    );
    expect(await tool("read_shelf").execute({})).toEqual({
      months: ["September: about a tenth left"],
      usually: ["You usually eat about three quarters of Needs."],
    });
  });

  it("reads a single view", async () => {
    render(<PieTools pie={pieView} actions={fakeActions()} />);

    expect(tool("read_pie").inputSchema?.properties?.focus?.enum).toEqual([
      "Needs",
      "Wants",
      "Savings",
      "Every month",
      "One time",
    ]);
    expect(await tool("read_pie").execute({ focus: "Every month" })).toMatchObject({
      focus: "Every month, 2 staples take about a third of your pie.",
      bites: [],
      staples: [{ id: "rent" }, { id: "gym" }],
    });
  });

  it("offers only reading tools on a past month", () => {
    render(<PieTools pie={pastPieView} past actions={fakeActions()} />);

    expect([...tools.keys()].toSorted()).toEqual(["read_pie", "read_shelf"]);
  });

  it("reads a statement, then takes its bites", async () => {
    const actions = fakeActions();

    render(<PieTools pie={pieView} actions={actions} />);

    expect(tool("read_statement").annotations?.readOnlyHint).toBe(true);
    expect(await tool("read_statement").execute({ csv: "Date,Description,Amount" })).toEqual({
      found:
        "Read the first 2000 of 2400 lines. 1 expenses; skipped 1 incoming and 0 unreadable rows.",
      bites: [{ day: "2026-10-02", amount: 4.2, note: "Bakery", slice: "Needs" }],
    });
    expect(
      await tool("take_bites").execute({
        bites: [{ day: "2026-10-02", amount: 4.2, note: "Bakery", slice: "Wants" }],
      }),
    ).toBe("Recorded 1 expenses; 0 were already there.");
    expect(actions.calls).toEqual(["read Date,Description,Amount", "take 2026-10-02 wants 4.2"]);
  });

  it("swaps tools when the page changes and removes them when it goes away", () => {
    const actions = fakeActions();
    const { rerender, unmount } = render(<PieTools pie={null} actions={actions} />);

    rerender(<PieTools pie={pieView} actions={actions} />);

    expect(tools.has("bake_pie")).toBe(false);
    expect(tools.has("weigh_bite")).toBe(true);

    unmount();

    expect(tools.size).toBe(0);
  });

  it("recuts the pie, keeping slices by their current name, and starts over", async () => {
    const actions = fakeActions();

    render(<PieTools pie={pieView} actions={actions} />);

    expect(
      await tool("recut_pie").execute({
        slices: [
          { name: "Home", percent: 60, was: "Needs" },
          { name: "Wants", percent: 30 },
          { name: "Travel", percent: 10 },
        ],
      }),
    ).toBe("The pie is now cut into Home.");
    expect(await tool("reset_pie").execute({})).toBe(
      "Everything is deleted. Bake a new pie to start over.",
    );
    expect(actions.calls).toEqual([
      `recut ${pieView.slices[0]!.id}:Home:60 ${pieView.slices[1]!.id}:Wants:30 new:Travel:10`,
      "reset",
    ]);
  });
});
