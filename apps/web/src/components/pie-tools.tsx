"use client";

import {
  describeCarried,
  describeCarry,
  describeCarryOffer,
  describeDropped,
  describeFocus,
  describeLeftover,
  describeMoved,
  describePace,
  describePastLeftover,
  describeShelfMonth,
  describeStaple,
  describeSweep,
  describeSwept,
  describeWeighing,
  droppedCarrySentence,
  putBackSentence,
  spreadMonths,
  viewSweepSteps,
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

    // Nothing more is eaten from a retired slice, so tools only offer the live ones.
    const slices = pie.slices.filter((slice) => !slice.retired);
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
          // Only this month can still carry last month's leftover.

          const offer =
            served.gone !== undefined && !served.carry ? await actions.readCarryOffer() : null;

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
            ...(served.carry && { carry: describeCarry(served.carry) }),
            ...(served.sweep && {
              sweep: `Bites round up to the next ${served.sweep.step} into ${served.sweep.sliceName}.`,
            }),
            ...(served.swept.length > 0 && { swept: describeSwept(served) }),
            ...(offer && { carryOffer: describeCarryOffer(offer) }),
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
              ...(bite.spread && { spreadId: bite.spread.id, part: bite.spread.words }),
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

    const monthsProperty = {
      months: {
        type: "integer",
        minimum: spreadMonths.fewest,
        maximum: spreadMonths.most,
        description: `Spread the expense in equal parts over this many months, starting now (${spreadMonths.fewest} to ${spreadMonths.most}). Leave it out to pay it all this month.`,
      },
    } as const;

    void modelContext.registerTool(
      {
        name: "weigh_bite",
        title: "Weigh an expense",
        description:
          "Tells whether a prospective expense fits in what is left of a slice this month, without recording it. Use it to answer 'is this worth it?'. With months, it compares paying it all now with spreading it; when it is too big, it says over how few months it would fit.",
        annotations: { readOnlyHint: true },
        inputSchema: {
          type: "object",
          properties: { ...biteProperties, ...monthsProperty },
          required: ["amount", "slice"],
        } as const,
        async execute(input) {
          const outcome = await actions.weighBite({
            sliceId: sliceIdOf(input.slice),
            amount: String(input.amount),
            months: input.months,
          });

          if (!outcome.ok) return outcome.error;

          const { fitsOver } = outcome.value;

          const nudge =
            fitsOver === undefined ? "" : ` Spread over ${fitsOver} months, it would fit.`;

          return `${describeWeighing(outcome.value)}${nudge}`;
        },
      },
      options,
    );

    void modelContext.registerTool(
      {
        name: "take_bite",
        title: "Record an expense",
        description:
          "Records an expense the user made in this month's pie, or spreads it in equal parts over several months from this one on.",
        inputSchema: {
          type: "object",
          properties: {
            ...biteProperties,
            ...monthsProperty,
            note: { type: "string", description: "What the expense was, in a few words." },
          },
          required: ["amount", "slice", "note"],
        } as const,
        async execute(input) {
          const outcome = await actions.takeBite({
            sliceId: sliceIdOf(input.slice),
            amount: String(input.amount),
            note: input.note,
            months: input.months,
          });

          if (!outcome.ok) return outcome.error;

          const { swept } = outcome.value;
          const sweep = swept ? ` Swept ${swept.words} into ${swept.sliceName}.` : "";

          return input.months === undefined
            ? `Recorded ${input.note} in ${input.slice}.${sweep}`
            : `Recorded ${input.note} in ${input.slice}, over ${input.months} months.${sweep}`;
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
        name: "put_back_spread",
        title: "Remove the rest of a spread expense",
        description:
          "Removes this month's part of a spread expense and every later part; earlier parts stay. Take the spreadId from read_pie.",
        inputSchema: {
          type: "object",
          properties: { spreadId: { type: "string", description: "The spread's id." } },
          required: ["spreadId"],
        } as const,
        async execute(input) {
          const outcome = await actions.putBackSpread({ spreadId: input.spreadId });

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

    const steps = viewSweepSteps(pie.currency);

    const resliceSchema = {
      type: "object",
      properties: {
        monthlyIncome: {
          type: "number",
          description: `Money that comes in each month, in ${pie.currency}. Leave it out to keep it.`,
        },
        slices: {
          type: "array",
          description:
            "Every slice the pie should have, in order. An existing name keeps its slice and bites, a new name adds a slice, and a slice left out is retired (it keeps this month's bites).",
          items: {
            type: "object",
            properties: {
              name: { type: "string", description: "The slice's name, up to 30 letters." },
              percent: {
                type: "number",
                description: "Its share of the pie in steps of 5; all shares add up to 100.",
              },
            },
            required: ["name", "percent"],
          },
        },
      },
      required: ["slices"],
    } as const;

    const resliceInput = (input: {
      monthlyIncome?: number;
      slices: readonly { name: string; percent: number }[];
    }) => ({
      ...(input.monthlyIncome !== undefined && { monthlyIncome: String(input.monthlyIncome) }),
      slices: input.slices.map((slice) => ({
        id: slices.find((known) => known.name === slice.name.trim())?.id,
        name: slice.name,
        percent: slice.percent,
      })),
    });

    void modelContext.registerTool(
      {
        name: "preview_reslice",
        title: "Preview new slices",
        description:
          "Tells how this month's expenses would sit in the pie with a new income or new slices, without changing anything.",
        annotations: { readOnlyHint: true },
        inputSchema: resliceSchema,
        async execute(input) {
          const outcome = await actions.previewReslice(resliceInput(input));

          return outcome.ok ? outcome.value.sentence : outcome.error;
        },
      },
      options,
    );

    void modelContext.registerTool(
      {
        name: "reslice_pie",
        title: "Change the income or slices",
        description:
          "Changes the pie's monthly income or its slices (names, shares, adding, retiring) in place. Every expense stays. Preview it first with preview_reslice.",
        inputSchema: resliceSchema,
        async execute(input) {
          const outcome = await actions.reslicePie(resliceInput(input));

          return outcome.ok ? describeLeftover(outcome.value.leftoverWords) : outcome.error;
        },
      },
      options,
    );

    void modelContext.registerTool(
      {
        name: "carry_over",
        title: "Carry last month's leftover",
        description:
          "Adds what last month left of the whole pie to one slice of this month's pie, making it bigger. Once a month; read_pie tells when there is a leftover on offer.",
        inputSchema: {
          type: "object",
          properties: { slice: biteProperties.slice },
          required: ["slice"],
        } as const,
        async execute(input) {
          const outcome = await actions.carryOver({ sliceId: sliceIdOf(input.slice) });

          return outcome.ok ? describeCarried(input.slice) : outcome.error;
        },
      },
      options,
    );

    void modelContext.registerTool(
      {
        name: "drop_carry",
        title: "Undo the carry",
        description: "Undoes this month's carry of last month's leftover.",
        async execute() {
          const outcome = await actions.dropCarry();

          return outcome.ok ? droppedCarrySentence : outcome.error;
        },
      },
      options,
    );

    void modelContext.registerTool(
      {
        name: "set_sweep",
        title: "Round expenses up into a slice",
        description:
          "Turns on rounding every expense up to the next step, counting the difference as eaten from one slice (usually Savings); or turns it off with off: true. Past expenses keep what they swept.",
        inputSchema: {
          type: "object",
          properties: {
            slice: biteProperties.slice,
            step: {
              type: "string",
              enum: steps,
              description: `Round up to the next this many ${pie.currency}.`,
            },
            off: { type: "boolean", description: "Turn rounding up off." },
          },
        } as const,
        async execute(input) {
          const outcome = await actions.setSweep(
            input.off || !input.slice || !input.step
              ? { off: true }
              : { sliceId: sliceIdOf(input.slice), step: input.step },
          );

          return outcome.ok ? describeSweep(outcome.value) : outcome.error;
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
  if (slice.retired) return `${slice.name}: retired, still has bites this month`;

  return `${slice.name}: ${slice.leftWords} left${slice.pace === "fast" ? ", going fast" : ""}`;
}
