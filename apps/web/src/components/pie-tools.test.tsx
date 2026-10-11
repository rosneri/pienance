import type { PieView } from "@pienance/core";
import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { PieActions } from "@/server/pie-actions";
import { pieView } from "@/testing/fixtures";
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
    readPie: async () => pieView,
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
          ofSlice: "about a fifth",
          ofLeftover: "about a quarter",
          ofPie: "a sliver",
          leftAfter: "about half",
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
      "read_pie",
      "read_statement",
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
      currency: "EUR",
      slices: ["Needs: all left", "Wants: about a quarter left", "Savings: all left"],
      bites: ["Shoes: about three quarters of Wants", "Something: a crumb of Needs"],
    });
    expect(actions.calls).toEqual(["weigh wants 80", "take needs 5 Tea"]);
  });

  it("reads a statement, then takes its bites", async () => {
    const actions = fakeActions();

    render(<PieTools pie={pieView} actions={actions} />);

    expect(tool("read_statement").annotations?.readOnlyHint).toBe(true);
    expect(await tool("read_statement").execute({ csv: "Date,Description,Amount" })).toEqual({
      found: "1 expenses; skipped 1 incoming and 0 unreadable rows.",
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
