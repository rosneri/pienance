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
      calls.push(
        `weigh ${input.sliceId} ${input.amount}${input.months ? ` over ${input.months}` : ""}`,
      );

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
    putBackBite: async (input) => {
      calls.push(`put back ${input.biteId}`);

      return input.biteId === "shoes"
        ? { ok: true, value: null }
        : { ok: false, error: "That bite is not in this month's pie." };
    },
    putBackSpread: async (input) => {
      calls.push(`put back spread ${input.spreadId}`);

      return { ok: true, value: null };
    },
    moveBite: async (input) => {
      calls.push(`move ${input.biteId} ${input.sliceId}`);

      return {
        ok: true,
        value: { ...pieView.bites[0]!, sliceName: "Needs", portionWords: "about a tenth" },
      };
    },
    readReslice: async () => null,
    readCarryOffer: async () => ({
      month: "2026-09",
      monthName: "September",
      leftoverWords: "about a fifth",
    }),
    carryOver: async (input) => {
      calls.push(`carry ${input.sliceId}`);

      return { ok: true, value: pieView };
    },
    dropCarry: async () => {
      calls.push("drop carry");

      return { ok: false, error: "Nothing was carried this month." };
    },
    reslicePie: async (input) => {
      calls.push(`reslice ${JSON.stringify(input)}`);

      return { ok: true, value: pieView };
    },
    previewReslice: async (input) => {
      calls.push(`preview ${input.slices.length}`);

      return { ok: true, value: { verdict: "overflows", sentence: "Wants would be all eaten." } };
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
      "carry_over",
      "drop_carry",
      "drop_staple",
      "move_bite",
      "preview_reslice",
      "put_back_bite",
      "put_back_spread",
      "read_pie",
      "read_shelf",
      "read_statement",
      "reslice_pie",
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
      carryOffer: "September left about a fifth of your pie.",
      slices: [
        "Needs: about a third left",
        "Wants: about a quarter left, going fast",
        "Savings: all left",
      ],
      staples: [
        { id: "rent", staple: "Rent: about half of Needs" },
        { id: "gym", staple: "Gym: a sliver of Wants, ends after October" },
      ],
      bites: [
        { id: "shoes", note: "Shoes", slice: "Wants", portion: "3/4" },
        { id: "nameless", note: "Something", slice: "Needs", portion: "under 1/10" },
      ],
    });
    expect(await tool("put_back_bite").execute({ biteId: "shoes" })).toBe("Put back.");
    expect(await tool("put_back_bite").execute({ biteId: "old" })).toBe(
      "That bite is not in this month's pie.",
    );
    expect(await tool("move_bite").execute({ biteId: "shoes", slice: "Needs" })).toBe(
      "Moved. It is about a tenth of Needs.",
    );
    expect(await tool("stock_staple").execute({ amount: 1000, slice: "Needs", note: "Rent" })).toBe(
      "Added. Rent takes about half of Needs every month.",
    );
    expect(await tool("drop_staple").execute({ stapleId: "rent" })).toBe(
      "Stopped. Rent ends after October.",
    );
    expect(actions.calls).toEqual([
      "weigh wants 80",
      "take needs 5 Tea",
      "put back shoes",
      "put back old",
      "move shoes needs",
      "stock needs 1000 Rent",
      "drop rent",
    ]);
  });

  it("weighs and takes a spread, and puts back the rest of one", async () => {
    const actions = fakeActions();

    render(<PieTools pie={pieView} actions={actions} />);

    expect(tool("weigh_bite").inputSchema?.properties?.months).toMatchObject({
      minimum: 2,
      maximum: 24,
    });
    await tool("weigh_bite").execute({ amount: 600, slice: "Wants", months: 6 });
    expect(await tool("put_back_spread").execute({ spreadId: "laptop" })).toBe("Put back.");
    expect(actions.calls).toEqual(["weigh wants 600 over 6", "put back spread laptop"]);
  });

  it("carries last month's leftover and undoes it", async () => {
    const actions = fakeActions();

    render(<PieTools pie={pieView} actions={actions} />);

    expect(await tool("carry_over").execute({ slice: "Savings" })).toBe(
      "Carried into Savings. It is bigger this month.",
    );
    expect(await tool("drop_carry").execute({})).toBe("Nothing was carried this month.");
    expect(actions.calls).toEqual(["carry savings", "drop carry"]);
  });

  it("re-slices by name: a known name keeps its slice, a new one is added", async () => {
    const actions = fakeActions();

    const input = {
      monthlyIncome: 4000,
      slices: [
        { name: "Needs", percent: 60 },
        { name: "Travel", percent: 40 },
      ],
    };

    render(<PieTools pie={pieView} actions={actions} />);

    expect(tool("preview_reslice").annotations?.readOnlyHint).toBe(true);
    expect(await tool("preview_reslice").execute(input)).toBe("Wants would be all eaten.");
    expect(await tool("reslice_pie").execute(input)).toBe("About half of your pie is left.");
    expect(actions.calls).toEqual([
      "preview 2",
      `reslice ${JSON.stringify({
        monthlyIncome: "4000",
        slices: [
          { id: "needs", name: "Needs", percent: 60 },
          { name: "Travel", percent: 40 },
        ],
      })}`,
    ]);
  });

  it("offers only live slices to eat from", () => {
    const retired = pieView.slices.map((slice) =>
      slice.id === "savings" ? { ...slice, retired: true } : slice,
    );

    render(<PieTools pie={{ ...pieView, slices: retired }} actions={fakeActions()} />);

    expect(tool("take_bite").inputSchema?.properties?.slice?.enum).toEqual(["Needs", "Wants"]);
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
});
