"use client";

import {
  describeDropped,
  describeFocus,
  describeLeftover,
  describeMoved,
  describePace,
  describePastLeftover,
  describeShelfMonth,
  describeStaple,
  describeWeighing,
  putBackSentence,
  type PieView,
  type SliceView,
} from "@pienance/core";
import { useEffect } from "react";
import type { PieActions } from "@/server/pie-actions";

/**
 * WebMCP: exposes pienance to in-browser AI agents as tools
 * (https://github.com/webmachinelearning/webmcp). Tools match the page state:
 * "bake_pie" before there is a pie, reading, weighing and pantry tools after,
 * and only the reading tools on a past month.
 * Every tool goes through the same server actions as the UI, so the page stays in sync.
 */
export function PieTools({
  pie,
  past = false,
  actions,
}: {
  pie: PieView | null;
  /** A past month is read-only. */
  past?: boolean;
  actions: PieActions;
}) {
  useEffect(() => {
    const modelContext = document.modelContext;

    if (!modelContext) return;

    const controller = new AbortController();
    const options = { signal: controller.signal };

    if (!pie) {
      void modelContext.registerTool(
        {
          name: "bake_pie",
          title: "Bake this month's pie",
          description:
            "Creates the user's monthly pie from their monthly income, in any currency. It is cut into Needs (half), Wants (about a third) and Savings (a fifth).",
          inputSchema: {
            type: "object",
            properties: {
              monthlyIncome: { type: "number", description: "Money that comes in each month." },
              currency: { type: "string", description: "ISO 4217 code of that money, e.g. EUR." },
            },
            required: ["monthlyIncome", "currency"],
          } as const,
          async execute(input) {
            const outcome = await actions.bakePie({
              monthlyIncome: String(input.monthlyIncome),
              currency: input.currency,
            });

            return outcome.ok ? describeLeftover(outcome.value.leftoverWords) : outcome.error;
          },
        },
        options,
      );

      return () => controller.abort();
    }

    const { slices } = pie;
    const sliceIdOf = (name: string) => slices.find((slice) => slice.name === name)?.id ?? "";

    const biteProperties = {
      amount: { type: "number", description: `Price of the expense, in ${pie.currency}.` },
      slice: {
        type: "string",
        enum: slices.map((slice) => slice.name),
        description: "The slice the expense eats from.",
      },
    } as const;

    void modelContext.registerTool(
      {
        name: "read_pie",
        title: "Read a month's pie",
        description:
          "Returns how much of the user's monthly pie is left, per slice, how fast slices are eaten, the staples that come back every month and what was eaten, both with their ids. This month by default, or a past month on the shelf; the whole pie by default, or a single view (focus). Everything is described in proportions: rough words, and simple fractions for bites.",
        annotations: { readOnlyHint: true },
        inputSchema: {
          type: "object",
          properties: {
            month: { type: "string", description: 'A past month on the shelf, as "2026-09".' },
            focus: {
              type: "string",
              enum: pie.focuses.map((focus) => focus.name),
              description:
                "A single view instead of the whole pie: one slice, what comes back every month, or what was eaten one time.",
            },
          },
        } as const,
        async execute(input) {
          const served = await actions.readPie(input.month);

          if (!served) return "There is no pie yet.";

          if (input.month && served.month !== input.month) return "That month is not on the shelf.";

          const focus = served.focuses.find((candidate) => candidate.name === input.focus);
          const pace = describePace(served);

          const inView = <T extends { id: string }>(
            items: readonly T[],
            ids?: readonly string[],
          ) => (ids ? items.filter((item) => ids.includes(item.id)) : items);

          return {
            summary:
              served.gone === undefined
                ? describePastLeftover(served.leftoverWords, served.monthName)
                : describeLeftover(served.leftoverWords),
            ...(focus ? { focus: describeFocus(focus, served) } : pace && { pace }),
            month: served.monthName,
            currency: served.currency,
            slices: served.slices.map(describeSlice),
            staples: inView(served.staples, focus?.stapleIds).map((staple) => ({
              id: staple.id,
              staple: `${staple.note || "Something"}: ${staple.portionWords} of ${staple.sliceName}${staple.endsAfter ? `, ends after ${staple.endsAfter}` : ""}`,
            })),
            bites: inView(served.bites, focus?.biteIds).map((bite) => ({
              id: bite.id,
              note: bite.note || "Something",
              slice: bite.sliceName,
              portion: bite.portion,
            })),
          };
        },
      },
      options,
    );

    void modelContext.registerTool(
      {
        name: "read_shelf",
        title: "Read past months",
        description:
          "Returns how much of each past month's pie was left, newest first, and how each slice is usually eaten over the last three months.",
        annotations: { readOnlyHint: true },
        async execute() {
          const [shelf, usually] = await Promise.all([actions.readShelf(), actions.readAppetite()]);

          return {
            months: shelf.slice(1).map(describeShelfMonth),
            usually: usually.map(({ sentence }) => sentence),
          };
        },
      },
      options,
    );

    if (past) return () => controller.abort();

    void modelContext.registerTool(
      {
        name: "weigh_bite",
        title: "Weigh an expense",
        description:
          "Tells whether a prospective expense fits in what is left of a slice this month, without recording it. Use it to answer 'is this worth it?'.",
        annotations: { readOnlyHint: true },
        inputSchema: {
          type: "object",
          properties: biteProperties,
          required: ["amount", "slice"],
        } as const,
        async execute(input) {
          const outcome = await actions.weighBite({
            sliceId: sliceIdOf(input.slice),
            amount: String(input.amount),
          });

          return outcome.ok ? describeWeighing(outcome.value) : outcome.error;
        },
      },
      options,
    );

    void modelContext.registerTool(
      {
        name: "take_bite",
        title: "Record an expense",
        description: "Records an expense the user made in this month's pie.",
        inputSchema: {
          type: "object",
          properties: {
            ...biteProperties,
            note: { type: "string", description: "What the expense was, in a few words." },
          },
          required: ["amount", "slice", "note"],
        } as const,
        async execute(input) {
          const outcome = await actions.takeBite({
            sliceId: sliceIdOf(input.slice),
            amount: String(input.amount),
            note: input.note,
          });

          return outcome.ok ? `Recorded ${input.note} in ${input.slice}.` : outcome.error;
        },
      },
      options,
    );

    void modelContext.registerTool(
      {
        name: "put_back_bite",
        title: "Remove an expense",
        description:
          "Removes an expense recorded this month, as if it was never made. Take the id from read_pie.",
        inputSchema: {
          type: "object",
          properties: { biteId: { type: "string", description: "The bite's id." } },
          required: ["biteId"],
        } as const,
        async execute(input) {
          const outcome = await actions.putBackBite({ biteId: input.biteId });

          return outcome.ok ? putBackSentence : outcome.error;
        },
      },
      options,
    );

    void modelContext.registerTool(
      {
        name: "move_bite",
        title: "Move an expense to another slice",
        description:
          "Moves an expense recorded this month into another slice, keeping its amount and note. Take the id from read_pie.",
        inputSchema: {
          type: "object",
          properties: {
            biteId: { type: "string", description: "The bite's id." },
            slice: biteProperties.slice,
          },
          required: ["biteId", "slice"],
        } as const,
        async execute(input) {
          const outcome = await actions.moveBite({
            biteId: input.biteId,
            sliceId: sliceIdOf(input.slice),
          });

          return outcome.ok ? describeMoved(outcome.value) : outcome.error;
        },
      },
      options,
    );

    void modelContext.registerTool(
      {
        name: "read_statement",
        title: "Read a bank statement",
        description:
          "Reads the text of a CSV file exported from the user's bank, in any layout, without recording anything. Returns the expenses found in it, each with a suggested slice; incoming money is skipped. Show them to the user, then record them with take_bites.",
        annotations: { readOnlyHint: true },
        inputSchema: {
          type: "object",
          properties: { csv: { type: "string", description: "The whole CSV file, as text." } },
          required: ["csv"],
        } as const,
        async execute(input) {
          const outcome = await actions.readStatement({ csv: input.csv });

          if (!outcome.ok) return outcome.error;

          const { bites, incoming, unreadable, trimmed } = outcome.value;
          const lines = trimmed ? `Read the first ${trimmed.kept} of ${trimmed.total} lines. ` : "";

          return {
            found: `${lines}${bites.length} expenses; skipped ${incoming} incoming and ${unreadable} unreadable rows.`,
            bites: bites.map((bite) => ({
              day: bite.eatenOn,
              amount: Number(bite.amount),
              note: bite.note,
              slice: slices.find((slice) => slice.id === bite.sliceId)?.name ?? "",
            })),
          };
        },
      },
      options,
    );

    void modelContext.registerTool(
      {
        name: "take_bites",
        title: "Record many expenses",
        description:
          "Records many expenses at once, each in the month it was made, such as those read_statement found. Expenses already recorded (same day, amount and note) are skipped.",
        inputSchema: {
          type: "object",
          properties: {
            bites: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  ...biteProperties,
                  day: { type: "string", description: "When it was spent, as YYYY-MM-DD." },
                  note: { type: "string", description: "What the expense was." },
                },
                required: ["day", "amount", "slice", "note"],
              },
            },
          },
          required: ["bites"],
        } as const,
        async execute(input) {
          const outcome = await actions.takeBites({
            bites: input.bites.map((bite) => ({
              eatenOn: bite.day,
              amount: String(bite.amount),
              note: bite.note,
              sliceId: sliceIdOf(bite.slice),
            })),
          });

          if (!outcome.ok) return outcome.error;

          return `Recorded ${outcome.value.taken} expenses; ${outcome.value.duplicates} were already there.`;
        },
      },
      options,
    );

    void modelContext.registerTool(
      {
        name: "stock_staple",
        title: "Add an expense that comes back every month",
        description:
          "Adds a staple, such as rent or a subscription, that counts as eaten from its slice every month from this one on.",
        inputSchema: {
          type: "object",
          properties: {
            ...biteProperties,
            note: { type: "string", description: "What the expense is, in a few words." },
          },
          required: ["amount", "slice", "note"],
        } as const,
        async execute(input) {
          const outcome = await actions.stockStaple({
            sliceId: sliceIdOf(input.slice),
            amount: String(input.amount),
            note: input.note,
          });

          return outcome.ok ? describeStaple(outcome.value) : outcome.error;
        },
      },
      options,
    );

    void modelContext.registerTool(
      {
        name: "drop_staple",
        title: "Stop an expense that comes back every month",
        description:
          "Stops a staple after this month (this month still counts it). One added this month is removed altogether. Take the id from read_pie.",
        inputSchema: {
          type: "object",
          properties: { stapleId: { type: "string", description: "The staple's id." } },
          required: ["stapleId"],
        } as const,
        async execute(input) {
          const outcome = await actions.dropStaple({ stapleId: input.stapleId });

          return outcome.ok ? describeDropped(outcome.value) : outcome.error;
        },
      },
      options,
    );

    return () => controller.abort();
  }, [pie, past, actions]);

  return null;
}

/** "Wants: about half left, going fast" */
function describeSlice(slice: SliceView): string {
  return `${slice.name}: ${slice.leftWords} left${slice.pace === "fast" ? ", going fast" : ""}`;
}
